import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon, Button, PageHero, Reveal, ContactBanner } from '../components';
import { useSeo } from '../seo';
import './reviews.css';

const SHEET_ID = '1kyJXiH67w19sgt5sqeDeiqytXUVMlqAsrEKKJwRaue0';
const CUSTOMER_GID = '1902933500';
const VIDEO_GID = '1018172779';
const API = 'https://script.google.com/macros/s/AKfycbzh9gqz8J6qWbiqW0-N1gZMzM66TD7sQ4QHsmDBL7Osml99CEnUPC3LFLnAHCBN2mvSXg/exec';
const PAGE_SIZE = 12;
const clean = (value) => String(value ?? '').trim();

function safeUrl(value) {
  try {
    const url = new URL(clean(value));
    return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

function mediaIds(value) {
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

function imageCandidates(value, size = 1000) {
  const src = safeUrl(value);
  if (!src) return [];
  const { drive } = mediaIds(src);
  return drive ? [
    `https://drive.google.com/thumbnail?id=${encodeURIComponent(drive)}&sz=w${size}`,
    `https://lh3.googleusercontent.com/d/${encodeURIComponent(drive)}=w${size}`,
    src,
  ] : [src];
}

function thumbnail(record) {
  if (record.kind === 'photo') return record.imageUrl;
  if (record.thumbnailUrl) return record.thumbnailUrl;
  const { drive, youtube } = mediaIds(record.videoUrl);
  if (drive) return `https://drive.google.com/thumbnail?id=${drive}&sz=w1000`;
  if (youtube) return `https://i.ytimg.com/vi/${youtube}/hqdefault.jpg`;
  return '';
}

function playerUrl(value) {
  const { drive, youtube, vimeo } = mediaIds(value);
  if (drive) return `https://drive.google.com/file/d/${drive}/preview`;
  if (youtube) return `https://www.youtube-nocookie.com/embed/${youtube}?rel=0&playsinline=1`;
  if (vimeo) return `https://player.vimeo.com/video/${vimeo}`;
  return '';
}

function dateValue(value) {
  const text = clean(value);
  const sheetDate = text.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})\)$/);
  if (sheetDate) return new Date(+sheetDate[1], +sheetDate[2], +sheetDate[3]).getTime();
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value) {
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

function validRows(rows) {
  return Array.isArray(rows) && rows.every((row) => row && typeof row === 'object' && !Array.isArray(row) && Object.hasOwn(row, 'headline'));
}

function fetchSheet(gid, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const callback = `__thimadu_stories_${gid}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    let finished = false;
    let timer;
    const finish = (error, rows) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      delete window[callback];
      script.remove();
      if (error) reject(error); else resolve(rows);
    };
    const abort = () => finish(new DOMException('Aborted', 'AbortError'));
    window[callback] = (payload) => {
      try {
        if (payload?.status !== 'ok' || !payload.table) throw new Error('The story collection is unavailable.');
        const columns = (payload.table.cols || []).map((column) => clean(column.label || column.id));
        const rows = (payload.table.rows || []).map((row) => Object.fromEntries(columns.map((key, index) => [key, row.c?.[index]?.f ?? row.c?.[index]?.v ?? '']))).filter((row) => Object.values(row).some((value) => clean(value)));
        if (!validRows(rows)) throw new Error('The story collection could not be read.');
        finish(null, rows);
      } catch (error) { finish(error); }
    };
    signal.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => finish(new Error('The story collection took too long to respond.')), 8000);
    const tqx = encodeURIComponent(`out:json;responseHandler:${callback}`);
    script.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?gid=${gid}&headers=1&tqx=${tqx}&_=${Date.now()}`;
    script.async = true;
    script.onerror = () => finish(new Error('The story collection could not be reached.'));
    document.head.appendChild(script);
  });
}

async function fetchApi(kind, signal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal.aborted) controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 10000);
  try {
    const response = await fetch(`${API}?action=read&type=${kind}&_=${Date.now()}`, { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('The story collection could not be reached.');
    const payload = await response.json();
    if (payload.status !== 'success' || !validRows(payload.data)) throw new Error('The story collection could not be read.');
    return payload.data;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}

export async function loadStories(signal, { withStatus = false } = {}) {
  const direct = await Promise.allSettled([fetchSheet(CUSTOMER_GID, signal), fetchSheet(VIDEO_GID, signal)]);
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  // Fall back only for an unavailable collection. Successful direct reads stay authoritative.
  const collections = await Promise.allSettled([
    direct[0].status === 'fulfilled' ? direct[0].value : fetchApi('customers', signal),
    direct[1].status === 'fulfilled' ? direct[1].value : fetchApi('videos', signal),
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

function StoryImage({ src, alt, large = false }) {
  const candidates = useMemo(() => imageCandidates(src, large ? 1800 : 1000), [src, large]);
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [src, large]);
  if (!candidates[index]) return <div className="story-image-empty"><Icon name="car" /><span>Thimadu Auto Traders</span></div>;
  return <img src={candidates[index]} alt={alt} loading={large ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" onError={() => setIndex((previous) => previous + 1)} />;
}

function StoryDialog({ story, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!story || !ref.current) return;
    const dialog = ref.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [story]);
  if (!story) return null;
  const embed = playerUrl(story.videoUrl);
  const directVideo = story.videoUrl && /\.(?:mp4|webm|ogg)$/i.test(new URL(story.videoUrl).pathname);
  const facts = [['Customer', story.customerName], ['Location', story.location], ['Published', formatDate(story.postedDate)]];
  return <dialog ref={ref} className="story-dialog" aria-labelledby="story-dialog-title" onClose={onClose} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="story-dialog-inner">
      <button type="button" className="story-dialog-close" onClick={onClose} aria-label="Close story" autoFocus><Icon name="close" /></button>
      <div className="story-dialog-media">
        {story.kind === 'video' && embed ? <iframe src={embed} title={story.title} allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="no-referrer" /> : story.kind === 'video' && directVideo ? <video src={story.videoUrl} controls playsInline preload="metadata" poster={thumbnail(story) || undefined} /> : <StoryImage src={thumbnail(story)} alt={story.title} large />}
      </div>
      <div className="story-dialog-copy">
        <span className="story-type">{story.kind === 'video' ? `${story.platform} · Video story` : 'A new chapter'}</span>
        <h2 id="story-dialog-title">{story.title}</h2>
        {story.description && <p className="story-full-description">{story.description}</p>}
        {facts.some(([, value]) => value) && <dl className="story-facts">{facts.filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
        <div className="story-dialog-actions">
          {story.kind === 'video' && <a className="story-source-link" href={story.videoUrl} target="_blank" rel="noopener noreferrer">Open original video <Icon name="arrow-up" /></a>}
          <Button href="https://wa.me/94771813928" target="_blank" rel="noopener noreferrer">Start your story <Icon name="arrow" /></Button>
        </div>
      </div>
    </div>
  </dialog>;
}

function StoryCard({ story, onOpen }) {
  return <article className={`story-card story-card-${story.kind}`}>
    <button type="button" className="story-media" onClick={() => onOpen(story)} aria-label={`${story.kind === 'video' ? 'Watch' : 'View'} ${story.title}`}>
      <StoryImage src={thumbnail(story)} alt={story.title} />
      <span className="story-badge">{story.kind === 'video' ? 'Video story' : 'Customer delivery'}</span>
      {story.kind === 'video' && <span className="story-play"><Icon name="play" /></span>}
      <span className="story-media-arrow"><Icon name="arrow-up" /></span>
    </button>
    <div className="story-copy">
      <div className="story-label-row"><span className="story-type">{story.kind === 'video' ? story.platform : 'Happy moments'}</span>{formatDate(story.postedDate) && <span className="story-date">{formatDate(story.postedDate)}</span>}</div>
      <h3><button type="button" onClick={() => onOpen(story)}>{story.title}</button></h3>
      {story.description && <p className="story-description">{story.description}</p>}
      {(story.customerName || story.location) && <div className="story-meta">{story.customerName && <span>{story.customerName}</span>}{story.location && <span><Icon name="pin" />{story.location}</span>}</div>}
      <button type="button" className="story-read-more" onClick={() => onOpen(story)} aria-label={`${story.kind === 'video' ? 'Watch story' : 'Read story'}: ${story.title}`}>{story.kind === 'video' ? 'Watch their story' : 'View their story'}<Icon name="arrow" /></button>
    </div>
  </article>;
}

export default function ReviewsPage() {
  useSeo({ title: 'Customer Stories & Delivery Moments | Thimadu Auto Traders', description: 'Discover published customer delivery photos and video stories from Thimadu Auto Traders in Sri Lanka.' });
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = ['photos', 'videos'].includes(searchParams.get('tab')) ? searchParams.get('tab') : 'all';
  const [records, setRecords] = useState([]);
  const [unavailable, setUnavailable] = useState([]);
  const [status, setStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [shown, setShown] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState(null);
  const closeStory = useCallback(() => setSelected(null), []);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setRecords([]);
    setUnavailable([]);
    loadStories(controller.signal, { withStatus: true }).then(({ records: stories, unavailable: missing }) => {
      if (controller.signal.aborted) return;
      setRecords(stories);
      setUnavailable(missing);
      setStatus('ready');
    }).catch(() => { if (!controller.signal.aborted) setStatus('error'); });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => setShown(PAGE_SIZE), [tab, query, sort, records]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const result = records.filter((story) => (tab === 'all' || story.kind === (tab === 'photos' ? 'photo' : 'video')) && (!term || [story.title, story.description, story.customerName, story.location, story.platform].join(' ').toLowerCase().includes(term)));
    return result.sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      if (sort === 'order') return a.order - b.order || dateValue(b.postedDate) - dateValue(a.postedDate);
      if (sort === 'oldest') return dateValue(a.postedDate) - dateValue(b.postedDate) || a.order - b.order;
      return dateValue(b.postedDate) - dateValue(a.postedDate) || a.order - b.order;
    });
  }, [records, tab, query, sort]);
  const setTab = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'all') next.delete('tab'); else next.set('tab', value);
    setSearchParams(next, { replace: true, preventScrollReset: true });
  };
  const resetFilters = () => { setQuery(''); setSort('newest'); setTab('all'); };

  return <>
    <PageHero eyebrow="THE THIMADU COMMUNITY" title={<>Good cars.<br />Even better <em>stories.</em></>} description="The keys change hands. A new chapter begins. Meet the people and the moments that make what we do worthwhile.">
      <a className="reviews-hero-link" href="#customer-stories">Discover their stories <span><Icon name="arrow" /></span></a>
    </PageHero>
    <section className="reviews-section section" id="customer-stories" aria-labelledby="reviews-heading">
      <div className="container">
        <Reveal><div className="reviews-intro"><div><p className="reviews-eyebrow">REAL PEOPLE. REAL MOMENTS.</p><h2 id="reviews-heading">Every journey<br />starts with a <em>smile.</em></h2></div><p>First cars, family upgrades and new adventures. Explore customer deliveries and stories from our community.</p></div></Reveal>
        <div className="reviews-toolbar">
          <div className="reviews-tabs" role="group" aria-label="Story type">{[['all', 'All stories'], ['photos', 'Photos'], ['videos', 'Videos']].map(([value, label]) => <button type="button" key={value} className={tab === value ? 'is-active' : ''} aria-pressed={tab === value} onClick={() => setTab(value)}>{label}</button>)}</div>
          <div className="reviews-search"><Icon name="search" /><input aria-label="Search customer stories" type="search" placeholder="Search stories…" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><Icon name="close" /></button>}</div>
          <label className="reviews-sort"><span className="reviews-visually-hidden">Sort stories</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="order">Featured order</option><option value="title">Title A–Z</option></select><Icon name="chevron" /></label>
        </div>
        <div className="reviews-result-line" role="status" aria-live="polite"><span>{status === 'loading' ? 'Finding the latest moments…' : status === 'error' ? 'Stories are temporarily unavailable' : `${filtered.length.toLocaleString()} ${filtered.length === 1 ? 'story' : 'stories'}${query.trim() ? ` matching “${query.trim()}”` : ' to explore'}`}</span>{status === 'ready' && <span className="reviews-published"><span />Published customer stories</span>}</div>
        {!!unavailable.length && <p className="reviews-partial-notice" role="status">{unavailable.join(' and ')} are temporarily unavailable. Available collections are shown below. <button type="button" onClick={() => setAttempt(value => value + 1)}>Try loading again</button></p>}
        <div className="reviews-grid" aria-busy={status === 'loading'}>
          {status === 'loading' && Array.from({ length: 6 }, (_, index) => <div className="story-skeleton" key={index} aria-hidden="true"><div /><span /><span /></div>)}
          {status === 'ready' && filtered.slice(0, shown).map((story) => <StoryCard key={story.key} story={story} onOpen={setSelected} />)}
          {status === 'error' && <div className="reviews-empty" role="alert"><span className="reviews-empty-icon"><Icon name="chat" /></span><h3>A little pause in the story.</h3><p>We couldn’t load our customer stories just now. Please try again, or talk to our team on WhatsApp.</p><div className="reviews-empty-actions"><button className="reviews-action" type="button" onClick={() => setAttempt((value) => value + 1)}>Try again <Icon name="arrow" /></button><a href="https://wa.me/94771813928" target="_blank" rel="noopener noreferrer">Chat with our team <Icon name="arrow-up" /></a></div></div>}
          {status === 'ready' && !filtered.length && <div className="reviews-empty"><span className="reviews-empty-icon"><Icon name={records.length ? 'search' : 'car'} /></span><h3>{records.length ? 'Let’s try another search.' : 'More moments are on the way.'}</h3><p>{records.length ? 'No stories match these filters. Try a customer name, location or a different story type.' : unavailable.length ? 'We could not reach every story collection. Try loading again, or speak to our team about starting your own journey.' : 'There are no published stories in this collection yet. Speak to our team about starting your own journey.'}</p>{records.length ? <button className="reviews-action" type="button" onClick={resetFilters}>Clear filters <Icon name="arrow" /></button> : <Button href="https://wa.me/94771813928" target="_blank" rel="noopener noreferrer">Talk to our team <Icon name="arrow" /></Button>}</div>}
        </div>
        {status === 'ready' && filtered.length > 0 && <div className="reviews-load-more">{shown < filtered.length && <button type="button" className="reviews-action" onClick={() => setShown((value) => value + PAGE_SIZE)}>More happy moments <Icon name="arrow" /></button>}<p>Showing {Math.min(shown, filtered.length).toLocaleString()} of {filtered.length.toLocaleString()} stories</p></div>}
      </div>
    </section>
    <ContactBanner />
    <StoryDialog story={selected} onClose={closeStory} />
  </>;
}
