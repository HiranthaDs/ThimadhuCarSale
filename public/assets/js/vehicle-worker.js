'use strict';

const DEFAULT_SOURCE = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQtUtkiDWGhuls-2JhfsVL1Hj_oFiFTyBPZyHndMBHeNoRotTcjppZe-tN32NqST4-t-xsgXnjYMK-8/pub?output=csv';
const DB_NAME = 'thimadu-vehicle-cache';
const DB_VERSION = 3;
const STORE_NAME = 'snapshots';
const CACHE_KEY = 'public-inventory-v3';
const CACHE_SCHEMA = 3;
const FRESH_FOR_MS = 5 * 60 * 1000;
const API_FALLBACK = 'https://script.google.com/macros/s/AKfycbzh9gqz8J6qWbiqW0-N1gZMzM66TD7sQ4QHsmDBL7Osml99CEnUPC3LFLnAHCBN2mvSXg/exec?action=read&type=vehicles';
const NETWORK_ATTEMPTS = 3;

let records = [];
let facets = emptyFacets();
let indexes = emptyIndexes();
let sourceUrl = DEFAULT_SOURCE;
let loadingPromise = null;
let ready = false;
let lastSignature = '';
let recordBySlug = new Map();
let recordById = new Map();

function emptyFacets() {
  return { brands: [], types: [], fuels: [], conditions: [], availability: [], years: { min: null, max: null }, prices: { min: null, max: null } };
}

function emptyIndexes() {
  return { brand: new Map(), type: new Map(), fuel: new Map(), condition: new Map(), status: new Map() };
}

self.addEventListener('message', (event) => {
  const message = event.data || {};
  const requestId = message.requestId || null;
  if (message.type === 'init') {
    if (message.source) sourceUrl = message.source;
    if (!loadingPromise) loadingPromise = initialize(Boolean(message.force));
    return;
  }
  if (message.type === 'query') return sendQuery(message.payload || {}, requestId);
  if (message.type === 'suggest') return sendSuggestions(message.payload || {}, requestId);
  if (message.type === 'featured') return sendFeatured(message.payload || {}, requestId);
  if (message.type === 'detail') return sendDetail(message.payload || {}, requestId);
  if (message.type === 'related') return sendRelated(message.payload || {}, requestId);
  if (message.type === 'clear-cache') return clearCache(requestId);
});

async function initialize(force) {
  let hadCache = false;
  if (!force) {
    try {
      const cached = await idbGet(CACHE_KEY);
      if (cached && cached.schema === CACHE_SCHEMA && Array.isArray(cached.records) && cached.records.length) {
        applyRecords(cached.records);
        ready = true;
        lastSignature = cached.signature || signatureFor(records);
        hadCache = true;
        postMessage({
          type: 'ready',
          source: 'cache',
          count: records.length,
          facets,
          savedAt: cached.savedAt || 0,
          stale: Date.now() - (cached.savedAt || 0) > FRESH_FOR_MS
        });
      }
    } catch (error) {
      postMessage({ type: 'warning', message: 'Local inventory cache could not be read.' });
    }
  }

  try {
    let nextRecords = [];
    let liveSource = 'csv';
    try {
      nextRecords = await fetchWithRetries(sourceUrl);
    } catch (csvError) {
      postMessage({ type: 'warning', message: 'Published CSV is temporarily unavailable. Trying the Thimadu API.' });
      nextRecords = await fetchApiFallback();
      liveSource = 'api';
    }
    if (!nextRecords.length) throw new Error('The inventory source returned no valid vehicle rows.');
    const nextSignature = signatureFor(nextRecords);
    const changed = !hadCache || nextSignature !== lastSignature;
    if (changed) {
      applyRecords(nextRecords);
      lastSignature = nextSignature;
      idbPut(CACHE_KEY, {
        schema: CACHE_SCHEMA,
        savedAt: Date.now(),
        signature: nextSignature,
        records
      }).catch(() => postMessage({ type: 'warning', message: 'Inventory loaded, but offline caching is unavailable.' }));
    }
    ready = true;
    postMessage({
      type: 'ready',
      source: `network-${liveSource}`,
      count: records.length,
      facets,
      updated: changed,
      savedAt: Date.now(),
      stale: false
    });
  } catch (error) {
    ready = hadCache;
    postMessage({
      type: 'error',
      fatal: !hadCache,
      message: hadCache ? 'Live inventory is temporarily unavailable. Showing the last saved copy.' : (error.message || 'Inventory could not be loaded.')
    });
  }
}

async function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function fetchWithRetries(url) {
  let lastError;
  for (let attempt = 1; attempt <= NETWORK_ATTEMPTS; attempt += 1) {
    try { return await fetchAndParse(url); } catch (error) {
      lastError = error;
      if (attempt < NETWORK_ATTEMPTS) await sleep(450 * attempt);
    }
  }
  throw lastError || new Error('Inventory request failed.');
}

async function fetchApiFallback() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(`${API_FALLBACK}&_=${Date.now()}`, { cache: 'no-store', credentials: 'omit', redirect: 'follow', signal: controller.signal });
    if (!response.ok) throw new Error(`Inventory API failed with status ${response.status}.`);
    const json = await response.json();
    const raw = Array.isArray(json) ? json : (Array.isArray(json.data) ? json.data : []);
    const normalized = raw.map((row, index) => normalizeRecord(row || {}, index)).filter(Boolean);
    const deduped = new Map();
    normalized.forEach((record) => deduped.set(record.id || record.slug, record));
    postMessage({ type: 'progress', rows: deduped.size, percent: 100 });
    return Array.from(deduped.values());
  } finally { clearTimeout(timeout); }
}

async function fetchAndParse(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, {
      cache: 'no-cache',
      credentials: 'omit',
      redirect: 'follow',
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Inventory request failed with status ${response.status}.`);

    const totalBytes = Number(response.headers.get('content-length')) || 0;
    const parser = new StreamingCSVParser();
    if (response.body && response.body.getReader) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let received = 0;
      let lastProgress = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        received += value.byteLength;
        parser.feed(decoder.decode(value, { stream: true }));
        const now = Date.now();
        if (now - lastProgress > 220) {
          lastProgress = now;
          postMessage({
            type: 'progress',
            rows: parser.validRows,
            percent: totalBytes ? Math.min(99, Math.round((received / totalBytes) * 100)) : null
          });
        }
      }
      parser.feed(decoder.decode());
    } else {
      parser.feed(await response.text());
    }
    const parsed = parser.finish();
    postMessage({ type: 'progress', rows: parsed.length, percent: 100 });
    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

class StreamingCSVParser {
  constructor() {
    this.mode = 'field';
    this.value = '';
    this.row = [];
    this.headers = null;
    this.output = [];
    this.validRows = 0;
    this.invalidRows = 0;
  }

  feed(chunk) {
    for (let index = 0; index < chunk.length; index += 1) {
      const char = chunk[index];
      if (this.mode === 'quoted') {
        if (char === '"') this.mode = 'after-quote';
        else this.value += char;
        continue;
      }
      if (this.mode === 'after-quote') {
        if (char === '"') {
          this.value += '"';
          this.mode = 'quoted';
        } else if (char === ',') {
          this.pushField();
          this.mode = 'field';
        } else if (char === '\n') {
          this.pushField();
          this.pushRow();
          this.mode = 'field';
        } else if (char !== '\r' && !/\s/.test(char)) {
          this.value += char;
          this.mode = 'field';
        }
        continue;
      }
      if (char === '"' && this.value.length === 0) this.mode = 'quoted';
      else if (char === ',') this.pushField();
      else if (char === '\n') {
        this.pushField();
        this.pushRow();
      } else if (char !== '\r') this.value += char;
    }
  }

  pushField() {
    this.row.push(this.value);
    this.value = '';
  }

  pushRow() {
    if (!this.row.some((value) => String(value).trim())) {
      this.row = [];
      return;
    }
    if (!this.headers) {
      this.headers = this.row.map((header) => normalizeHeader(header));
      this.row = [];
      return;
    }
    const object = {};
    this.headers.forEach((header, index) => {
      if (header) object[header] = cleanString(this.row[index] || '', 30000);
    });
    const record = normalizeRecord(object, this.output.length);
    if (record) {
      this.output.push(record);
      this.validRows += 1;
    } else {
      this.invalidRows += 1;
    }
    this.row = [];
  }

  finish() {
    if (this.value || this.row.length) {
      this.pushField();
      this.pushRow();
    }
    const deduped = new Map();
    this.output.forEach((record) => deduped.set(record.id || record.slug, record));
    return Array.from(deduped.values());
  }
}

function normalizeHeader(header) {
  return String(header || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function cleanString(value, max = 5000) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

function read(row, aliases) {
  for (const key of aliases) {
    if (row[key] !== undefined && row[key] !== '') return row[key];
  }
  return '';
}

function parseNumeric(value) {
  const numeric = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function titleCase(value) {
  const acronyms = new Set(['bmw', 'mg', 'byd', 'gac', 'jac', 'vw']);
  return cleanString(value, 120)
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .split(' ')
    .map((word) => acronyms.has(word.toLowerCase()) ? word.toUpperCase() : word)
    .join(' ');
}

function normalizeKey(value) {
  return cleanString(value, 100)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function slugify(value) {
  return normalizeKey(value).replace(/\s+/g, '-').replace(/^-+|-+$/g, '');
}

function normalizeAvailability(value) {
  const text = cleanString(value, 80);
  const key = normalizeKey(text);
  if (/sold|unavailable/.test(key)) return { label: 'Sold', key: 'sold', rank: 4 };
  if (/reserv/.test(key)) return { label: 'Reserved', key: 'reserved', rank: 2 };
  if (/pending|pre order|preorder|auction|japan/.test(key)) return { label: text || 'Coming soon', key: 'pending', rank: 1 };
  if (/avail|stock|ready/.test(key)) return { label: text || 'Available', key: 'available', rank: 0 };
  return { label: text || 'Enquire', key: 'other', rank: 3 };
}

function normalizeRecord(row, rowIndex) {
  const rawBrand = read(row, ['brand', 'make', 'manufacturer']);
  const rawModel = read(row, ['model', 'vehicle_model', 'name']);
  if (!rawBrand && !rawModel) return null;
  const brand = titleCase(rawBrand || 'Other');
  const model = cleanString(rawModel || 'Vehicle', 160);
  const yearNumber = parseNumeric(read(row, ['year', 'model_year']));
  const year = yearNumber && yearNumber > 1900 && yearNumber < 2200 ? Math.round(yearNumber) : null;
  const rawId = read(row, ['id', 'stock_id', 'vehicle_id', 'inventory_id']);
  const id = cleanString(rawId || `row-${rowIndex + 1}`, 120);
  const status = normalizeAvailability(read(row, ['availability', 'status', 'stock_status']));
  const images = [];
  for (let index = 1; index <= 40; index += 1) {
    const image = cleanString(read(row, [`image${index}`, `image_${index}`]), 2048);
    if (image && /^https?:\/\//i.test(image) && !images.includes(image)) images.push(image);
  }
  const directImages = read(row, ['images', 'image_urls']);
  if (directImages) {
    cleanString(directImages, 20000).split(/[|\n]/).forEach((url) => {
      const image = url.trim();
      if (image && /^https?:\/\//i.test(image) && !images.includes(image)) images.push(image);
    });
  }
  const type = titleCase(read(row, ['type', 'body_type', 'body']));
  const fuel = titleCase(read(row, ['fuel_type', 'fuel']));
  const transmission = titleCase(read(row, ['transmission', 'gearbox']));
  const condition = titleCase(read(row, ['condition', 'vehicle_condition']));
  const grade = cleanString(read(row, ['grade', 'auction_grade', 'trim']), 100);
  const price = parseNumeric(read(row, ['price', 'price_lkr', 'selling_price']));
  const mileageKm = parseNumeric(read(row, ['mileage_km', 'mileage', 'odometer']));
  const engine = cleanString(read(row, ['engine_capacity_cc', 'engine', 'engine_cc']), 100);
  const color = titleCase(read(row, ['color', 'colour']));
  const location = cleanString(read(row, ['location', 'showroom']), 180);
  const description = cleanString(read(row, ['description', 'details', 'features']), 30000);
  const postedDate = cleanString(read(row, ['posted_date', 'published_at', 'created_at', 'date']), 80);
  const postedTime = Date.parse(postedDate) || 0;
  const slug = slugify(`${brand}-${model}-${year || ''}-${id}`);
  const search = normalizeKey([
    brand, model, year, type, fuel, transmission, condition, grade, color, location, engine, description.slice(0, 1200), id
  ].filter(Boolean).join(' '));
  return {
    id,
    slug,
    brand,
    brandKey: normalizeKey(brand),
    model,
    grade,
    type,
    typeKey: normalizeKey(type),
    year,
    mileageKm,
    fuel,
    fuelKey: normalizeKey(fuel),
    transmission,
    color,
    engine,
    condition,
    conditionKey: normalizeKey(condition),
    price,
    location,
    description,
    images,
    image: images[0] || '',
    availability: status.label,
    statusKey: status.key,
    statusRank: status.rank,
    postedDate,
    postedTime,
    search
  };
}

function applyRecords(nextRecords) {
  records = nextRecords.slice().sort(recommendedSort);
  facets = buildFacets(records);
  indexes = buildIndexes(records);
  recordBySlug = new Map();
  recordById = new Map();
  records.forEach((record) => {
    if (record.slug) recordBySlug.set(record.slug, record);
    if (record.id) recordById.set(String(record.id), record);
  });
  ready = true;
}

function recommendedSort(a, b) {
  return a.statusRank - b.statusRank || b.postedTime - a.postedTime || Number(b.year || 0) - Number(a.year || 0) || String(b.id).localeCompare(String(a.id), undefined, { numeric: true });
}

function buildIndexes(list) {
  const result = emptyIndexes();
  list.forEach((record, index) => {
    [['brand', record.brandKey], ['type', record.typeKey], ['fuel', record.fuelKey], ['condition', record.conditionKey], ['status', record.statusKey]].forEach(([group, key]) => {
      if (!key) return;
      if (!result[group].has(key)) result[group].set(key, []);
      result[group].get(key).push(index);
    });
  });
  return result;
}

function countValues(list, key, labelKey) {
  const map = new Map();
  list.forEach((record) => {
    const value = record[key];
    if (!value) return;
    if (!map.has(value)) map.set(value, { value: record[labelKey] || value, key: value, count: 0 });
    map.get(value).count += 1;
  });
  return Array.from(map.values()).sort((a, b) => a.value.localeCompare(b.value));
}

function buildFacets(list) {
  const years = list.map((record) => record.year).filter(Number.isFinite);
  const prices = list.map((record) => record.price).filter((value) => Number.isFinite(value) && value > 0);
  return {
    brands: countValues(list, 'brandKey', 'brand'),
    types: countValues(list, 'typeKey', 'type'),
    fuels: countValues(list, 'fuelKey', 'fuel'),
    conditions: countValues(list, 'conditionKey', 'condition'),
    availability: countValues(list, 'statusKey', 'availability'),
    years: { min: years.length ? Math.min(...years) : null, max: years.length ? Math.max(...years) : null },
    prices: { min: prices.length ? Math.min(...prices) : null, max: prices.length ? Math.max(...prices) : null }
  };
}

function getCandidates(filters) {
  const candidateLists = [];
  [['brand', filters.brands], ['type', filters.types], ['fuel', filters.fuels], ['condition', filters.conditions], ['status', filters.statuses]].forEach(([group, values]) => {
    if (!Array.isArray(values) || !values.length) return;
    const merged = new Set();
    values.map(normalizeKey).forEach((value) => {
      const matches = indexes[group].get(value) || [];
      matches.forEach((index) => merged.add(index));
    });
    candidateLists.push(Array.from(merged));
  });
  if (!candidateLists.length) return records.map((_, index) => index);
  candidateLists.sort((a, b) => a.length - b.length);
  return candidateLists[0];
}

function matchesFilter(record, filters, tokens) {
  if (filters.brands?.length && !filters.brands.map(normalizeKey).includes(record.brandKey)) return false;
  if (filters.types?.length && !filters.types.map(normalizeKey).includes(record.typeKey)) return false;
  if (filters.fuels?.length && !filters.fuels.map(normalizeKey).includes(record.fuelKey)) return false;
  if (filters.conditions?.length && !filters.conditions.map(normalizeKey).includes(record.conditionKey)) return false;
  if (filters.statuses?.length && !filters.statuses.map(normalizeKey).includes(record.statusKey)) return false;
  if (Number.isFinite(filters.minPrice) && Number(record.price || 0) < filters.minPrice) return false;
  if (Number.isFinite(filters.maxPrice) && Number(record.price || Infinity) > filters.maxPrice) return false;
  if (Number.isFinite(filters.minYear) && Number(record.year || 0) < filters.minYear) return false;
  if (Number.isFinite(filters.maxYear) && Number(record.year || Infinity) > filters.maxYear) return false;
  return !tokens.length || tokens.every((token) => record.search.includes(token));
}

function sortedMatches(payload) {
  const filters = payload.filters || {};
  const tokens = normalizeKey(payload.search || '').split(' ').filter(Boolean).slice(0, 8);
  const matched = [];
  for (const index of getCandidates(filters)) {
    const record = records[index];
    if (record && matchesFilter(record, filters, tokens)) matched.push(record);
  }
  const sort = payload.sort || 'recommended';
  if (sort === 'newest') matched.sort((a, b) => b.postedTime - a.postedTime || recommendedSort(a, b));
  else if (sort === 'price-low') matched.sort((a, b) => sortableNumber(a.price, Infinity) - sortableNumber(b.price, Infinity) || recommendedSort(a, b));
  else if (sort === 'price-high') matched.sort((a, b) => sortableNumber(b.price, -Infinity) - sortableNumber(a.price, -Infinity) || recommendedSort(a, b));
  else if (sort === 'year-new') matched.sort((a, b) => sortableNumber(b.year, 0) - sortableNumber(a.year, 0) || recommendedSort(a, b));
  else if (sort === 'mileage-low') matched.sort((a, b) => sortableNumber(a.mileageKm, Infinity) - sortableNumber(b.mileageKm, Infinity) || recommendedSort(a, b));
  else matched.sort(recommendedSort);
  return matched;
}

function sortableNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function summary(record) {
  return {
    id: record.id,
    slug: record.slug,
    brand: record.brand,
    model: record.model,
    grade: record.grade,
    type: record.type,
    year: record.year,
    mileageKm: record.mileageKm,
    fuel: record.fuel,
    transmission: record.transmission,
    condition: record.condition,
    price: record.price,
    availability: record.availability,
    image: record.image,
    location: record.location
  };
}

function publicRecord(record) {
  if (!record) return null;
  const { search, brandKey, typeKey, fuelKey, conditionKey, statusKey, statusRank, postedTime, ...safe } = record;
  return safe;
}

function ensureReady(requestId) {
  if (ready) return true;
  postMessage({ type: 'response', requestId, error: 'Inventory is still loading.' });
  return false;
}

function sendQuery(payload, requestId) {
  if (!ensureReady(requestId)) return;
  const pageSize = Math.min(48, Math.max(1, Number(payload.pageSize) || 12));
  const matches = sortedMatches(payload);
  const total = matches.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(totalPages, Math.max(1, Number(payload.page) || 1));
  const start = (page - 1) * pageSize;
  postMessage({
    type: 'response',
    requestId,
    data: {
      items: matches.slice(start, start + pageSize).map(summary),
      page,
      pageSize,
      total,
      totalPages,
      facets
    }
  });
}

function sendSuggestions(payload, requestId) {
  if (!ensureReady(requestId)) return;
  const query = normalizeKey(payload.search || '');
  if (query.length < 2) {
    postMessage({ type: 'response', requestId, data: { items: [] } });
    return;
  }
  const tokens = query.split(' ').filter(Boolean);
  const limit = Math.min(10, Math.max(1, Number(payload.limit) || 6));
  const output = [];
  for (const record of records) {
    if (tokens.every((token) => record.search.includes(token))) output.push(summary(record));
    if (output.length >= limit) break;
  }
  postMessage({ type: 'response', requestId, data: { items: output } });
}

function sendFeatured(payload, requestId) {
  if (!ensureReady(requestId)) return;
  const limit = Math.min(12, Math.max(1, Number(payload.limit) || 6));
  const available = records.filter((record) => record.statusKey !== 'sold').slice(0, limit);
  const output = available.length ? available : records.slice(0, limit);
  postMessage({ type: 'response', requestId, data: { items: output.map(summary), total: records.length } });
}

function sendDetail(payload, requestId) {
  if (!ensureReady(requestId)) return;
  const slug = cleanString(payload.slug, 220);
  const id = cleanString(payload.id, 120);
  const record = (slug && recordBySlug.get(slug)) || (id && recordById.get(String(id))) || null;
  postMessage({ type: 'response', requestId, data: { item: publicRecord(record) } });
}

function sendRelated(payload, requestId) {
  if (!ensureReady(requestId)) return;
  const limit = Math.min(8, Math.max(1, Number(payload.limit) || 3));
  const exclude = cleanString(payload.exclude, 120);
  const brandKey = normalizeKey(payload.brand || '');
  const typeKey = normalizeKey(payload.type || '');
  const scored = records
    .filter((record) => record.id !== exclude && record.statusKey !== 'sold')
    .map((record) => ({ record, score: (brandKey && record.brandKey === brandKey ? 3 : 0) + (typeKey && record.typeKey === typeKey ? 2 : 0) }))
    .sort((a, b) => b.score - a.score || recommendedSort(a.record, b.record))
    .slice(0, limit)
    .map(({ record }) => summary(record));
  postMessage({ type: 'response', requestId, data: { items: scored } });
}

function signatureFor(list) {
  let hash = 2166136261;
  list.forEach((record) => {
    const value = `${record.id}|${record.brand}|${record.model}|${record.price}|${record.availability}|${record.postedDate}|${record.images.join(',')}`;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
  });
  return `${list.length}-${(hash >>> 0).toString(16)}`;
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (!self.indexedDB) return reject(new Error('IndexedDB unavailable'));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

async function idbPut(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(value, key);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

async function clearCache(requestId) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(CACHE_KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
    postMessage({ type: 'response', requestId, data: { cleared: true } });
  } catch (error) {
    postMessage({ type: 'response', requestId, error: 'Cache could not be cleared.' });
  }
}
