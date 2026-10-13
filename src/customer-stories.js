import { CONTENT_API_URL, CONTENT_API_VERSION } from './content-api';

const clean = (value) => String(value ?? '').trim();

export function safeUrl(value) {
  try {
    const url = new URL(clean(value));
    return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

export function mediaIds(value) {
  const safe = safeUrl(value);
  if (!safe) return {};
  const url = new URL(safe);
  const host = url.hostname.toLowerCase();
  const isHost = (domain) => host === domain || host.endsWith(`.${domain}`);
  if (host === 'drive.google.com' || host === 'docs.google.com' || host === 'lh3.googleusercontent.com') {
    const id = url.pathname.match(/\/d\/([\w-]+)/)?.[1] || url.searchParams.get('id');
    return /^[\w-]{15,}$/.test(id || '') ? { drive: id } : {};
  }
  if (isHost('youtube.com') || isHost('youtube-nocookie.com') || isHost('youtu.be')) {
    const id = isHost('youtu.be') ? url.pathname.split('/')[1] : url.searchParams.get('v') || url.pathname.match(/\/(?:embed|shorts|live)\/([\w-]+)/)?.[1];
    return /^[\w-]{11}$/.test(id || '') ? { youtube: id } : {};
  }
  if (isHost('vimeo.com')) {
    const id = url.pathname.match(/\/(?:video\/)?(\d+)(?:\/|$)/)?.[1];
    return id ? { vimeo: id } : {};
  }
  return {};
}

export function imageCandidates(value, size = 1000) {
  const src = safeUrl(value);
  if (!src) return [];
  const { drive } = mediaIds(src);
  return drive ? [
    `https://drive.google.com/thumbnail?id=${encodeURIComponent(drive)}&sz=w${size}`,
    `https://lh3.googleusercontent.com/d/${encodeURIComponent(drive)}=w${size}`,
    src,
  ] : [src];
}

export function thumbnail(record) {
  if (record.kind === 'photo') return record.imageUrl;
  if (record.thumbnailUrl) return record.thumbnailUrl;
  const { drive, youtube } = mediaIds(record.videoUrl);
  if (drive) return `https://drive.google.com/thumbnail?id=${drive}&sz=w1000`;
  if (youtube) return `https://i.ytimg.com/vi/${youtube}/hqdefault.jpg`;
  return '';
}

export function playerUrl(value) {
  const { drive, youtube, vimeo } = mediaIds(value);
  if (drive) return `https://drive.google.com/file/d/${drive}/preview`;
  if (youtube) return `https://www.youtube-nocookie.com/embed/${youtube}?rel=0&playsinline=1`;
  if (vimeo) return `https://player.vimeo.com/video/${vimeo}`;
  return '';
}

export function dateValue(value) {
  const text = clean(value);
  const sheetDate = text.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})\)$/);
  if (sheetDate) return new Date(+sheetDate[1], +sheetDate[2], +sheetDate[3]).getTime();
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatDate(value) {
  const date = dateValue(value);
  return date ? new Intl.DateTimeFormat('en-LK', { day: 'numeric', month: 'short', year: 'numeric' }).format(date) : '';
}

function normalize(rows, kind) {
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return [];
    if (clean(row.status || 'Active').toLowerCase() !== 'active') return [];
    const title = clean(row.headline);
    const description = clean(row.description);
    const imageUrl = safeUrl(row.image_url);
    const videoUrl = safeUrl(row.video_url);
    if (!title || (kind === 'video' ? !videoUrl : !imageUrl && !description)) return [];
    const ids = mediaIds(videoUrl);
    return [{
      kind, title, description, imageUrl, videoUrl,
      id: clean(row.id),
      customerName: clean(row.customer_name),
      location: clean(row.location),
      thumbnailUrl: safeUrl(row.thumbnail_url),
      platform: clean(row.platform) || (ids.youtube ? 'YouTube' : ids.drive ? 'Google Drive' : ids.vimeo ? 'Vimeo' : 'Video'),
      order: Number(row.display_order) || 0,
      postedDate: clean(row.posted_date),
    }];
  });
}

function compatibleApiVersion(version) {
  const expectedMajor = CONTENT_API_VERSION.split('.')[0];
  return version === CONTENT_API_VERSION || String(version || '').startsWith(`${expectedMajor}.`);
}

function validRows(rows) {
  return Array.isArray(rows) && rows.every((row) => row && typeof row === 'object' && !Array.isArray(row));
}

async function fetchApi(kind, signal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal.aborted) controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 10000);
  try {
    const url = new URL(CONTENT_API_URL);
    url.searchParams.set('action', 'read');
    url.searchParams.set('type', kind);
    url.searchParams.set('_', Date.now());
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('The story collection could not be reached.');
    const payload = await response.json();
    if (!compatibleApiVersion(payload.apiVersion) || payload.status !== 'success' || !validRows(payload.data)) throw new Error('The story collection could not be read.');
    return payload.data;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}

export async function loadStories(signal, { withStatus = false } = {}) {
  const collections = await Promise.allSettled([
    fetchApi('customers', signal),
    fetchApi('videos', signal),
  ]);
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  if (collections.every(result => result.status === 'rejected')) throw new Error('The story collections could not be reached.');
  const [customers, videos] = collections.map(result => result.status === 'fulfilled' ? result.value : []);
  const unavailable = collections.flatMap((result, index) => result.status === 'rejected' ? [index === 0 ? 'Customer photos' : 'Video stories'] : []);
  const seen = new Set();
  const records = [...normalize(customers, 'photo'), ...normalize(videos, 'video')].filter((record) => {
    const key = `${record.kind}:${record.id || [record.title, record.imageUrl, record.videoUrl, record.postedDate].join('|')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    record.key = key;
    return true;
  });
  return withStatus ? { records, unavailable } : records;
}

