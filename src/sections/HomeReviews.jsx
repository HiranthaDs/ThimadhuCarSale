import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components';
import { loadStories } from '../customer-stories';
import DeliveryGallery, { DeliveryFilters } from './DeliveryGallery';
import './home-reviews.css';

const HOME_STORY_LIMIT = 6;

function editorialOrder(a, b) {
  const order = (Number(a.order) || 0) - (Number(b.order) || 0);
  if (order) return order;
  return String(b.postedDate || '').localeCompare(String(a.postedDate || ''));
}

/**
 * Keep the homepage deliberately concise while ensuring that customer photos
 * and video stories both get a turn whenever both collections are available.
 */
export function curateHomeStories(records, limit = HOME_STORY_LIMIT) {
  const maximum = Math.max(0, Math.floor(Number(limit) || 0));
  if (!maximum || !Array.isArray(records)) return [];

  const sorted = records
    .filter((story) => story && ['photo', 'video'].includes(story.kind) && String(story.title || '').trim())
    .map((story, sourceIndex) => ({ story, sourceIndex }))
    .sort((a, b) => editorialOrder(a.story, b.story) || a.sourceIndex - b.sourceIndex)
    .map(({ story }) => story);

  const photos = sorted.filter((story) => story.kind === 'photo');
  const videos = sorted.filter((story) => story.kind === 'video');
  if (!photos.length || !videos.length) return sorted.slice(0, maximum);

  const firstKind = sorted[0].kind;
  const buckets = { photo: photos.slice(), video: videos.slice() };
  const kindOrder = firstKind === 'video' ? ['video', 'photo'] : ['photo', 'video'];
  const curated = [];

  while (curated.length < maximum && (buckets.photo.length || buckets.video.length)) {
    kindOrder.forEach((kind) => {
      if (curated.length < maximum && buckets[kind].length) curated.push(buckets[kind].shift());
    });
  }
  return curated;
}


export default function HomeReviews() {
  const section = useRef(null);
  const [records, setRecords] = useState([]);
  const [status, setStatus] = useState('loading');
  const [unavailable, setUnavailable] = useState([]);
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    const controller = new AbortController();
    let started = false;
    let observer;
    const load = () => {
      if (started || controller.signal.aborted) return;
      started = true;
      observer?.disconnect();
      setStatus('loading');
      setRecords([]);
      setUnavailable([]);
      loadStories(controller.signal, { withStatus: true })
        .then(({ records: stories, unavailable: missing }) => {
          if (controller.signal.aborted) return;
          setRecords(stories);
          setUnavailable(missing);
          setStatus('ready');
        })
        .catch(() => { if (!controller.signal.aborted) setStatus('unavailable'); });
    };
    if ('IntersectionObserver' in window && !attempt) {
      observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) load();
      }, { rootMargin: '500px' });
      if (section.current) observer.observe(section.current);
    } else load();
    return () => { controller.abort(); observer?.disconnect(); };
  }, [attempt]);

  const stories = useMemo(() => curateHomeStories(records.filter(story => tab === 'all' || story.kind === (tab === 'photos' ? 'photo' : 'video'))), [records, tab]);
  const counts = { all: records.length, photos: records.filter(story => story.kind === 'photo').length, videos: records.filter(story => story.kind === 'video').length };
  const retry = () => setAttempt(previous => previous + 1);

  return <section ref={section} className="home-reviews" id="customer-stories" aria-labelledby="home-reviews-title">
    <div className="container">
      <div className="home-reviews-topline">
        <div className="home-reviews-heading">
          <p className="home-reviews-eyebrow">LIFE AT THIMADU</p>
          <h2 id="home-reviews-title">Our latest deliveries.</h2>
          <p>A few familiar faces. A lot of happy miles ahead. Photos and videos from our customer handovers.</p>
        </div>
        <Link className="home-reviews-all" to="/reviews.html">All deliveries <Icon name="arrow" size={18} /></Link>
      </div>
      <div className="home-reviews-toolbar">
        <DeliveryFilters value={tab} onChange={setTab} counts={status === 'ready' ? counts : undefined} />
        <span className="home-reviews-hint">{tab === 'videos' ? 'Press play to watch a handover' : 'Take a closer look'}</span>
      </div>
      {!!unavailable.length && <p className="home-reviews-notice" role="status">{unavailable.join(' and ')} are temporarily unavailable. <button type="button" onClick={retry}>Try loading again</button></p>}
      <DeliveryGallery stories={status === 'ready' ? stories : []} loading={status === 'loading'}>
        {status !== 'loading' && !stories.length && <div className="home-reviews-status" role={status === 'unavailable' ? 'alert' : 'status'}><p>{status === 'unavailable' ? 'We could not load the latest deliveries.' : records.length ? `No ${tab === 'videos' ? 'videos' : 'photos'} are available at the moment.` : 'Our next delivery moments will appear here.'}</p>{status === 'unavailable' || unavailable.length ? <button type="button" onClick={retry}>Try again <Icon name="arrow" size={16} /></button> : records.length ? <button type="button" onClick={() => setTab('all')}>See all deliveries <Icon name="arrow" size={16} /></button> : <Link to="/all-vehicles.html">Browse available vehicles <Icon name="arrow" size={16} /></Link>}</div>}
      </DeliveryGallery>
      <div className="home-reviews-bottom"><p>Every photo, a new beginning.</p><a href="https://www.facebook.com/thimaducar" target="_blank" rel="noopener noreferrer">More from our Facebook page <Icon name="arrow-up" size={15} /></a></div>
    </div>
  </section>;
}
