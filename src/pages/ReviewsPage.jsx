import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon, Button } from '../components';
import { dateValue, loadStories } from '../customer-stories';
import DeliveryGallery, { DeliveryFilters } from '../sections/DeliveryGallery';
import { useSeo } from '../seo';
import './reviews.css';

export { loadStories } from '../customer-stories';
const PAGE_SIZE = 12;

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

  const counts = { all: records.length, photos: records.filter(story => story.kind === 'photo').length, videos: records.filter(story => story.kind === 'video').length };

  return <>
    <header className="deliveries-page-header">
      <div className="container">
        <nav className="deliveries-breadcrumb" aria-label="Breadcrumb"><Link to="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">Customer deliveries</span></nav>
        <p className="deliveries-page-eyebrow">THE PEOPLE BEHIND THE JOURNEYS</p>
        <div className="deliveries-page-heading"><div><h1>Delivery day.<br /><span>Always a good day.</span></h1><p>Meet our customers, see their new vehicles and watch the handovers. A little look at life at Thimadu.</p></div><a className="deliveries-facebook" href="https://www.facebook.com/thimaducar" target="_blank" rel="noopener noreferrer">Follow us on Facebook <Icon name="arrow-up" size={17} /></a></div>
      </div>
    </header>
    <section className="reviews-section" id="customer-stories" aria-label="Customer delivery gallery">
      <div className="container">
        <div className="reviews-toolbar">
          <DeliveryFilters value={tab} onChange={setTab} counts={status === 'ready' ? counts : undefined} className="reviews-tabs" />
          <div className="reviews-search"><Icon name="search" /><input aria-label="Search customer stories" type="search" placeholder="Find a customer or vehicle" value={query} onChange={event => setQuery(event.target.value)} />{query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><Icon name="close" /></button>}</div>
          <label className="reviews-sort"><span className="reviews-visually-hidden">Sort stories</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="order">Featured order</option><option value="title">Title A-Z</option></select><Icon name="chevron" /></label>
        </div>
        <div className="reviews-result-line" role="status" aria-live="polite"><span>{status === 'loading' ? 'Loading deliveries...' : status === 'error' ? 'Deliveries are temporarily unavailable' : `${filtered.length.toLocaleString()} ${filtered.length === 1 ? 'delivery' : 'deliveries'}${query.trim() ? ` matching "${query.trim()}"` : ''}`}</span>{status === 'ready' && !!records.length && <span>Tap a photo or video to open</span>}</div>
        {!!unavailable.length && <p className="reviews-partial-notice" role="status">{unavailable.join(' and ')} are temporarily unavailable. Available collections are shown below. <button type="button" onClick={() => setAttempt(value => value + 1)}>Try loading again</button></p>}
        <DeliveryGallery stories={status === 'ready' ? filtered.slice(0, shown) : []} loading={status === 'loading'} className="reviews-grid">
          {status === 'error' && <div className="reviews-empty" role="alert"><Icon name="car" size={32} /><h2>We couldn't load the deliveries.</h2><p>Please try again in a moment. Our team is also here to help on WhatsApp.</p><div className="reviews-empty-actions"><button className="reviews-action" type="button" onClick={() => setAttempt(value => value + 1)}>Try again <Icon name="arrow" /></button><a href="https://wa.me/94771813928" target="_blank" rel="noopener noreferrer">Chat with our team <Icon name="arrow-up" /></a></div></div>}
          {status === 'ready' && !filtered.length && <div className="reviews-empty"><Icon name={records.length ? 'search' : 'car'} size={32} /><h2>{records.length ? 'No matching deliveries.' : 'More deliveries to come.'}</h2><p>{records.length ? 'Try a customer name, a vehicle or a different media type.' : unavailable.length ? 'Some deliveries could not be loaded. Try loading again above.' : 'Our next customer photos and videos will appear here.'}</p>{records.length ? <button className="reviews-action" type="button" onClick={resetFilters}>Clear filters <Icon name="arrow" /></button> : <Button to="/all-vehicles.html">Browse available vehicles <Icon name="arrow" /></Button>}</div>}
        </DeliveryGallery>
        {status === 'ready' && filtered.length > 0 && <div className="reviews-load-more">{shown < filtered.length && <button type="button" className="reviews-action" onClick={() => setShown(value => value + PAGE_SIZE)}>More deliveries <Icon name="arrow" /></button>}<p>Showing {Math.min(shown, filtered.length).toLocaleString()} of {filtered.length.toLocaleString()} deliveries</p></div>}
        <div className="deliveries-next-step"><div><h2>Your delivery day could be next.</h2><p>Take a look at the vehicles available at Thimadu.</p></div><Button to="/all-vehicles.html">Find your vehicle <Icon name="arrow" /></Button></div>
      </div>
    </section>
  </>;
}
