import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Icon, PageHero } from './components';
import { useSeo } from './seo';
import { useMotionPreference } from './useMotionPreference';
import './inventory.css';

const CONTACT = 'https://wa.me/94771813928';
const number = new Intl.NumberFormat('en-LK', { maximumFractionDigits: 0 });
const priceText = (value) => Number(value) > 0 ? `LKR ${number.format(Number(value))}` : 'Price on request';
const fullName = (vehicle) => [vehicle?.year, vehicle?.brand, vehicle?.model].filter(Boolean).join(' ');
const vehicleUrl = (vehicle) => `/car-details.html?vehicle=${encodeURIComponent(vehicle.slug)}`;
const placeholder = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#eaf2ff"/><path d="M430 450h340l-34-67c-10-18-29-30-50-30H522c-24 0-45 15-53 37l-20 47-19 13Z" fill="none" stroke="#9fb9e7" stroke-width="8" stroke-linejoin="round"/><circle cx="509" cy="455" r="27" fill="#eaf2ff" stroke="#9fb9e7" stroke-width="8"/><circle cx="694" cy="455" r="27" fill="#eaf2ff" stroke="#9fb9e7" stroke-width="8"/><text x="600" y="560" fill="#6d83a9" font-family="Arial,sans-serif" font-size="24" text-anchor="middle" letter-spacing="4">PHOTO COMING SOON</text></svg>')}`;

function imageSources(raw, width = 1100) {
  const source = String(raw || '').trim();
  if (!/^https?:\/\//i.test(source)) return [placeholder];
  const match = source.match(/\/d\/([\w-]+)/) || source.match(/[?&]id=([\w-]+)/);
  return match ? [
    `https://drive.google.com/thumbnail?id=${match[1]}&sz=w${width}`,
    `https://lh3.googleusercontent.com/d/${match[1]}=w${width}`,
    `https://drive.google.com/uc?export=view&id=${match[1]}`,
    source, placeholder,
  ] : [source, placeholder];
}

function VehicleImage({ source, alt, width = 1100, eager = false, ...props }) {
  const sources = useMemo(() => imageSources(source, width), [source, width]);
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [source, width]);
  return <img {...props} src={sources[Math.min(index, sources.length - 1)]} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" onError={() => setIndex((value) => Math.min(value + 1, sources.length - 1))} />;
}

function getStore() {
  if (!window.VehicleStore) throw new Error('The vehicle catalogue could not start. Please reload and try again.');
  return window.VehicleStore;
}

export function useFeaturedVehicles(limit = 3) {
  const [state, setState] = useState({ items: [], total: 0, loading: true, error: null });
  useEffect(() => {
    let active = true;
    let sequence = 0;
    let stop;
    const load = async () => {
      const request = ++sequence;
      try {
        const store = getStore();
        await store.whenReady();
        const result = await store.featured(limit);
        if (active && request === sequence) setState({ items: result.items || [], total: result.total || 0, loading: false, error: null, cached: store.getState?.()?.source === 'cache' });
      } catch (error) {
        if (active && request === sequence) setState({ items: [], total: 0, loading: false, error: error.message });
      }
    };
    setState((value) => ({ ...value, loading: true }));
    load();
    try { stop = getStore().on('update', load); } catch { /* Initial load supplies the error state. */ }
    return () => { active = false; stop?.(); };
  }, [limit]);
  return state;
}

export function VehicleCard({ vehicle, eager = false }) {
  const status = String(vehicle.availability || 'Enquire');
  const sold = /sold|unavailable/i.test(status);
  return <Link className="vehicle-card" to={vehicleUrl(vehicle)} aria-label={`View ${fullName(vehicle)}`}>
    <div className="vehicle-card-media">
      <VehicleImage source={vehicle.image} alt={fullName(vehicle)} eager={eager} width={850} />
      <span className={`vehicle-status${sold ? ' vehicle-status-sold' : ''}`}><i />{status}</span>
      <span className="vehicle-card-arrow"><Icon name="arrow-up" size={19} /></span>
    </div>
    <div className="vehicle-card-body">
      <div className="vehicle-card-overline"><span>{vehicle.brand || 'Vehicle'}</span><span>{vehicle.year || vehicle.condition || ''}</span></div>
      <h3>{vehicle.model || vehicle.brand}{vehicle.grade && <span> {vehicle.grade}</span>}</h3>
      <div className="vehicle-card-specs">
        <span>{vehicle.mileageKm != null ? `${number.format(vehicle.mileageKm)} km` : 'Mileage on request'}</span>
        {vehicle.transmission && <span>{vehicle.transmission}</span>}
        {vehicle.fuel && <span>{vehicle.fuel}</span>}
      </div>
      <div className="vehicle-card-bottom"><strong>{priceText(vehicle.price)}</strong><span>View car <Icon name="arrow" size={15} /></span></div>
    </div>
  </Link>;
}

function LoadingCards({ count = 3 }) {
  return <div className="inv-cards" role="status" aria-label="Loading vehicles">{Array.from({ length: count }, (_, index) => <div className="vehicle-skeleton" key={index}><div /><span /><span /><span /></div>)}</div>;
}

function InventoryState({ title, children, retry = false, heading: Heading = 'h3' }) {
  return <div className="inv-empty"><span className="inv-empty-icon"><Icon name="car" size={30} /></span><Heading>{title}</Heading><p>{children}</p><div className="inv-empty-actions">{retry && <button className="inv-action" onClick={() => window.location.reload()}>Try again <Icon name="arrow" size={16} /></button>}<Button href={CONTACT}>Ask about our stock <Icon name="arrow-up" size={17} /></Button></div></div>;
}

export function FeaturedVehicles({ limit = 3 }) {
  const { items, loading, error, cached } = useFeaturedVehicles(limit);
  if (loading) return <LoadingCards count={Math.min(limit, 3)} />;
  if (error) return <InventoryState title="Let’s find your next car." retry>Our live catalogue is taking a little longer to connect. Speak with our team for the latest available vehicles.</InventoryState>;
  if (!items.length) return <InventoryState title="Your next car could be on its way.">Contact our team for current stock and upcoming arrivals.</InventoryState>;
  return <>{cached && <p className="inv-saved-note" role="status">Showing saved stock. Confirm current availability with our team.</p>}<div className="inv-cards">{items.map((vehicle, index) => <VehicleCard key={vehicle.id} vehicle={vehicle} eager={index === 0} />)}</div></>;
}

const FILTERS = [
  { param: 'brand', key: 'brands', title: 'Make' },
  { param: 'type', key: 'types', title: 'Body type' },
  { param: 'fuel', key: 'fuels', title: 'Fuel type' },
  { param: 'condition', key: 'conditions', title: 'Condition' },
  { param: 'status', key: 'availability', title: 'Availability' },
];
const SORTS = [['recommended', 'Recommended'], ['newest', 'Recently added'], ['price-low', 'Price: low to high'], ['price-high', 'Price: high to low'], ['year-new', 'Newest model year'], ['mileage-low', 'Lowest mileage']];
const values = (params, key) => (params.get(key) || '').split(',').filter(Boolean);
const numericParam = (params, key) => { const value = Number(params.get(key)); return value > 0 && Number.isFinite(value) ? value : null; };

function FilterControls({ params, facets, change, clear }) {
  const prefix = React.useId();
  function toggle(param, value) {
    const current = values(params, param);
    const next = current.some((item) => item.toLowerCase() === value.toLowerCase()) ? current.filter((item) => item.toLowerCase() !== value.toLowerCase()) : [...current, value];
    change(param, next.join(','));
  }
  return <div className="inv-filter-content">
    <div className="inv-filter-heading"><h2>Refine your search</h2><button onClick={clear}>Reset</button></div>
    {FILTERS.map((group) => <details className="inv-filter-group" key={group.param} open>
      <summary>{group.title}<Icon name="chevron" size={15} /></summary>
      <div className="inv-filter-options">{(facets?.[group.key] || []).length ? facets[group.key].map((option) => <label className="inv-check" key={option.key}><input type="checkbox" checked={values(params, group.param).some((value) => value.toLowerCase() === option.key.toLowerCase())} onChange={() => toggle(group.param, option.key)} /><span>{option.value}</span><small>{option.count}</small></label>) : <span className="inv-filter-hint">Options appear with available stock</span>}</div>
    </details>)}
    {[{ title: 'Budget (LKR)', fields: ['minPrice', 'maxPrice'], placeholders: ['Min price', 'Max price'] }, { title: 'Model year', fields: ['minYear', 'maxYear'], placeholders: ['From year', 'To year'] }].map((group) => {
      const minimum = numericParam(params, group.fields[0]);
      const maximum = numericParam(params, group.fields[1]);
      const invalid = minimum !== null && maximum !== null && minimum > maximum;
      const errorId = `${prefix}-${group.fields[0]}-error`;
      return <fieldset className="inv-range" key={group.title}><legend>{group.title}</legend><div>{group.fields.map((field, index) => <div key={field}><label className="inv-visually-hidden" htmlFor={`${prefix}-${field}`}>{group.placeholders[index]}</label><input id={`${prefix}-${field}`} type="number" min="0" step="1" inputMode="numeric" placeholder={group.placeholders[index]} value={params.get(field) || ''} aria-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined} onChange={(event) => change(field, event.target.value)} /></div>)}</div>{invalid && <p className="inv-range-error" id={errorId} role="alert">{group.fields[0] === 'minPrice' ? 'Maximum price must be at least the minimum price.' : 'The end year must be the same as or later than the start year.'}</p>}</fieldset>;
    })}
  </div>;
}

export function InventoryPage() {
  const { motionDisabled } = useMotionPreference();
  const [params, setParams] = useSearchParams();
  const paramsKey = params.toString();
  const [draft, setDraft] = useState(params.get('q') || '');
  const [state, setState] = useState({ loading: true, error: null, items: [], facets: null, total: 0, totalPages: 1, page: 1 });
  const filterDialog = useRef(null);
  const resultsTop = useRef(null);
  useEffect(() => setDraft(params.get('q') || ''), [paramsKey]);
  useEffect(() => {
    let active = true;
    let sequence = 0;
    let stop;
    const queryParams = new URLSearchParams(paramsKey);
    const load = async () => {
      const request = ++sequence;
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const store = getStore();
        await store.whenReady();
        const response = await store.query({ search: queryParams.get('q') || '', sort: queryParams.get('sort') || 'recommended', page: numericParam(queryParams, 'page') || 1, pageSize: 12, filters: {
          brands: values(queryParams, 'brand'), types: values(queryParams, 'type'), fuels: values(queryParams, 'fuel'), conditions: values(queryParams, 'condition'), statuses: values(queryParams, 'status'),
          minPrice: numericParam(queryParams, 'minPrice'), maxPrice: numericParam(queryParams, 'maxPrice'), minYear: numericParam(queryParams, 'minYear'), maxYear: numericParam(queryParams, 'maxYear'),
        } });
        if (active && request === sequence) setState({ ...response, loading: false, error: null, cached: store.getState?.()?.source === 'cache' });
      } catch (error) { if (active && request === sequence) setState((current) => ({ ...current, loading: false, error: error.message })); }
    };
    load();
    try { stop = getStore().on('update', load); } catch { /* Initial load supplies the error state. */ }
    return () => { active = false; stop?.(); };
  }, [paramsKey]);
  useSeo({ title: 'Cars for Sale in Sri Lanka | Thimadu Auto Traders', description: 'Explore live vehicle stock at Thimadu Auto Traders. Search by make, body type, budget and fuel, compare specifications and enquire directly about your next car.', schema: {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: new URL('/', window.location.href).href }, { '@type': 'ListItem', position: 2, name: 'Vehicles', item: new URL('/all-vehicles.html', window.location.href).href }],
  } });
  function change(key, value) {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  }
  function reset() { setParams({}); setDraft(''); }
  function pageTo(page) { change('page', String(page)); resultsTop.current?.scrollIntoView({ behavior: motionDisabled ? 'instant' : 'smooth', block: 'start' }); }
  const activeFilters = [...params.entries()].filter(([key]) => !['sort', 'page'].includes(key));
  const pages = Array.from({ length: state.totalPages }, (_, index) => index + 1).filter((page) => page === 1 || page === state.totalPages || Math.abs(page - state.page) <= 1);
  const filterProps = { params, facets: state.facets, change, clear: reset };
  return <>
    <PageHero eyebrow="THE COLLECTION" title={<>Find the car.<br /><span>Feel the difference.</span></>} description="A new chapter starts with the right car. Explore our current collection and find a vehicle that fits your life.">
      <form className="inv-search" role="search" onSubmit={(event) => { event.preventDefault(); change('q', draft.trim()); }}><Icon name="search" size={22} /><label htmlFor="inventory-search" className="inv-visually-hidden">Search make, model or keyword</label><input id="inventory-search" type="search" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Make, model, or a little inspiration…" /><button type="submit" aria-label="Search vehicles"><Icon name="arrow" size={21} /></button></form>
    </PageHero>
    <section className="inv-section container" ref={resultsTop}>
      <div className="inv-toolbar"><div><span className="inv-kicker">YOUR NEXT MOVE</span><h2>Explore our vehicles<span className="inv-count">{state.loading && !state.total ? '…' : state.total}</span></h2></div><div className="inv-toolbar-actions"><button className="inv-mobile-filter" onClick={() => filterDialog.current?.showModal()}><Icon name="filter" size={18} />Filters{activeFilters.length > 0 && <span>{activeFilters.length}</span>}</button><label className="inv-sort"><span>Sort by</span><select aria-label="Sort vehicles" value={params.get('sort') || 'recommended'} onChange={(event) => change('sort', event.target.value)}>{SORTS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div></div>
      <div className="inv-layout">
        <aside className="inv-filter-desktop" aria-label="Vehicle filters"><FilterControls {...filterProps} /></aside>
        <div className="inv-results" aria-busy={state.loading}>
          {!!activeFilters.length && <div className="inv-active-filters" aria-label="Active filters">{activeFilters.map(([key, value]) => <button key={key} onClick={() => change(key, '')}><span>{key === 'q' ? `“${value}”` : `${({ minPrice: 'Min LKR', maxPrice: 'Max LKR', minYear: 'From', maxYear: 'To' })[key] || key}: ${value.split(',').join(', ')}`}</span><Icon name="close" size={13} /></button>)}<button className="inv-clear-all" onClick={reset}>Clear all</button></div>}
          <p className="inv-visually-hidden" role="status">{state.loading ? 'Loading vehicles' : `${state.total} matching vehicles`}</p>
          {state.cached && !state.loading && !state.error && <p className="inv-saved-note" role="status">Showing saved stock. Confirm current availability with our team.</p>}
          {state.loading ? <LoadingCards count={6} /> : state.error ? <InventoryState title="We’re reconnecting the catalogue." retry>Our team can help with current prices and availability while the live collection reconnects.</InventoryState> : !state.items.length ? <div className="inv-empty"><span className="inv-empty-icon"><Icon name="search" size={28} /></span><h3>A little wider. A little closer.</h3><p>No vehicles match these filters yet. Try another make or budget, or let us know what you’re looking for.</p><div className="inv-empty-actions"><button className="inv-action" onClick={reset}>Clear filters <Icon name="arrow" size={16} /></button><Button to="/vehicle-sourcing-sri-lanka.html" variant="secondary">Request a vehicle</Button></div></div> : <div className="inv-cards">{state.items.map((vehicle, index) => <VehicleCard key={vehicle.id} vehicle={vehicle} eager={index < 3} />)}</div>}
          {!state.loading && !state.error && state.totalPages > 1 && <nav className="inv-pagination" aria-label="Vehicle catalogue pages"><button disabled={state.page <= 1} onClick={() => pageTo(state.page - 1)} aria-label="Previous page"><span className="inv-prev"><Icon name="arrow" size={19} /></span></button>{pages.map((page, index) => <React.Fragment key={page}>{index > 0 && page > pages[index - 1] + 1 && <span className="inv-page-gap">…</span>}<button className={page === state.page ? 'is-current' : ''} aria-current={page === state.page ? 'page' : undefined} onClick={() => pageTo(page)}>{page}</button></React.Fragment>)}<button disabled={state.page >= state.totalPages} onClick={() => pageTo(state.page + 1)} aria-label="Next page"><Icon name="arrow" size={19} /></button></nav>}
          <div className="inv-bottom-note"><Icon name="chat" size={19} /><p>Have something specific in mind? <Link to="/vehicle-sourcing-sri-lanka.html">Let’s find it together.</Link></p></div>
        </div>
      </div>
    </section>
    <dialog ref={filterDialog} className="inv-filter-dialog" aria-labelledby="inv-dialog-title" onClick={(event) => { if (event.target === event.currentTarget) filterDialog.current?.close(); }}><div className="inv-dialog-header"><h2 id="inv-dialog-title">Find your fit.</h2><button onClick={() => filterDialog.current?.close()} aria-label="Close filters"><Icon name="close" size={23} /></button></div><FilterControls {...filterProps} /><div className="inv-dialog-footer"><button className="inv-action" onClick={() => filterDialog.current?.close()}>Show {state.loading ? '' : state.total} vehicles <Icon name="arrow" size={18} /></button></div></dialog>
  </>;
}

export function VehicleDetailsPage() {
  const [params] = useSearchParams();
  const slug = params.get('vehicle') || params.get('car') || params.get('slug') || '';
  const [state, setState] = useState({ loading: true, vehicle: null, error: null });
  const [related, setRelated] = useState([]);
  const [selected, setSelected] = useState(0);
  const [shareMessage, setShareMessage] = useState('');
  const gallery = useRef(null);
  const touch = useRef(null);
  useEffect(() => {
    let active = true;
    let sequence = 0;
    let stop;
    setState({ loading: true, vehicle: null, error: null });
    setRelated([]); setSelected(0); setShareMessage('');
    gallery.current?.close();
    if (!slug) { setState({ loading: false, vehicle: null, error: null }); return; }
    const load = async () => {
      const request = ++sequence;
      try {
        const store = getStore();
        await store.whenReady();
        const result = await store.detail(slug);
        if (!active || request !== sequence) return;
        setState({ loading: false, vehicle: result.item, error: null, cached: store.getState?.()?.source === 'cache' });
        setSelected(index => Math.min(index, Math.max(0, (result.item?.images?.length || 1) - 1)));
        if (result.item) {
          const similar = await store.related({ brand: result.item.brand, type: result.item.type, exclude: result.item.id, limit: 3 });
          if (active && request === sequence) setRelated(similar.items || []);
        }
      } catch (error) { if (active && request === sequence) setState((current) => ({ ...current, loading: false, error: current.vehicle ? null : error.message })); }
    };
    load();
    try { stop = getStore().on('update', load); } catch { /* Initial load supplies the error state. */ }
    return () => { active = false; stop?.(); };
  }, [slug]);
  const vehicle = state.vehicle;
  const name = fullName(vehicle);
  const canonical = vehicle ? new URL(vehicleUrl(vehicle), window.location.href).href : window.location.href;
  const schema = vehicle ? {
    '@context': 'https://schema.org', '@graph': [{
      '@type': ['Product', 'Car'], '@id': `${canonical}#vehicle`, name, sku: vehicle.id, url: canonical,
      image: (vehicle.images || [vehicle.image]).filter(Boolean).map((source) => imageSources(source, 1600)[0]),
      description: String(vehicle.description || `${name} at Thimadu Auto Traders.`).replace(/\*+/g, '').slice(0, 500),
      brand: { '@type': 'Brand', name: vehicle.brand }, model: vehicle.model, vehicleModelDate: vehicle.year ? String(vehicle.year) : undefined,
      fuelType: vehicle.fuel || undefined, vehicleTransmission: vehicle.transmission || undefined,
      bodyType: vehicle.type || undefined, color: vehicle.color || undefined,
      mileageFromOdometer: vehicle.mileageKm != null ? { '@type': 'QuantitativeValue', value: vehicle.mileageKm, unitCode: 'KMT' } : undefined,
      itemCondition: String(vehicle.condition).toLowerCase() === 'new' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
      offers: Number(vehicle.price) > 0 ? { '@type': 'Offer', priceCurrency: 'LKR', price: vehicle.price, url: canonical, availability: /sold|unavailable/i.test(vehicle.availability) ? 'https://schema.org/OutOfStock' : /reserv/i.test(vehicle.availability) ? 'https://schema.org/LimitedAvailability' : /available|stock|ready/i.test(vehicle.availability) ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder', seller: { '@id': new URL('/#dealer', window.location.href).href } } : undefined,
    }, { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: new URL('/', window.location.href).href }, { '@type': 'ListItem', position: 2, name: 'Vehicles', item: new URL('/all-vehicles.html', window.location.href).href }, { '@type': 'ListItem', position: 3, name, item: canonical }] }],
  } : undefined;
  useSeo({ title: vehicle ? `${name} for Sale | Thimadu Auto Traders` : state.loading ? 'Vehicle Details | Thimadu Auto Traders' : 'Vehicle Not Found | Thimadu Auto Traders', description: vehicle ? `Explore the ${name} at Thimadu Auto Traders. ${vehicle.fuel || ''} ${vehicle.transmission || ''}. ${priceText(vehicle.price)}. View photos and specifications and confirm availability with our team.` : 'Find vehicle photographs, specifications, price and availability at Thimadu Auto Traders in Sri Lanka.', image: vehicle?.image ? imageSources(vehicle.image, 1600)[0] : undefined, noindex: !state.loading && !vehicle, schema });
  const images = (vehicle?.images?.length ? vehicle.images : [vehicle?.image]).filter(Boolean);
  if (!images.length) images.push('');
  const move = (direction) => setSelected((index) => (index + direction + images.length) % images.length);
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: name, text: `${name} at Thimadu Auto Traders`, url: canonical });
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(canonical); setShareMessage('Vehicle link copied.'); }
      else setShareMessage('Copy this page’s address to share this vehicle.');
    } catch (error) { if (error.name !== 'AbortError') setShareMessage('Copy this page’s address to share this vehicle.'); }
  }
  if (state.loading) return <section className="detail-loading container" role="status" aria-label="Loading vehicle"><h1 className="inv-visually-hidden">Vehicle details</h1><Link className="detail-back" to="/all-vehicles.html"><Icon name="arrow" size={17} /> Back to the collection</Link><div className="detail-loading-title" /><div className="detail-loading-layout"><div /><div /></div></section>;
  if (!vehicle) return <section className="detail-missing container"><InventoryState heading="h1" title={state.error ? 'This vehicle is taking a moment.' : 'A different road awaits.'} retry={!!state.error}>{state.error ? 'Please try again or ask our team about this vehicle.' : 'This listing could not be found. Explore our current collection to see what’s available.'}</InventoryState><Button to="/all-vehicles.html">Explore the collection <Icon name="arrow" size={18} /></Button></section>;
  const enquiry = `${CONTACT}?text=${encodeURIComponent(`Hi Thimadu Auto Traders, I’m interested in the ${name} (stock ID ${vehicle.id}). Could you confirm the current price and availability? ${canonical}`)}`;
  const facts = [['Model year', vehicle.year], ['Mileage', vehicle.mileageKm != null ? `${number.format(vehicle.mileageKm)} km` : null], ['Transmission', vehicle.transmission], ['Fuel type', vehicle.fuel], ['Body type', vehicle.type], ['Engine', vehicle.engine], ['Condition', vehicle.condition], ['Colour', vehicle.color], ['Grade / trim', vehicle.grade], ['Location', vehicle.location], ['Stock reference', vehicle.id]];
  return <>
    <section className="detail-top"><div className="container"><Link className="detail-back" to="/all-vehicles.html"><Icon name="arrow" size={17} /> Back to the collection</Link><div className="detail-heading"><div><p className="inv-kicker">{[vehicle.year, vehicle.brand, vehicle.type].filter(Boolean).join(' / ')}</p><h1>{vehicle.model}<span>{vehicle.grade || 'Your next chapter.'}</span></h1></div><button className="detail-share" onClick={share}><Icon name="arrow-up" size={19} />Share vehicle</button></div><span className="detail-share-message" role="status">{shareMessage}</span></div></section>
    <section className="detail-body container">{state.cached && <p className="inv-saved-note" role="status">Showing saved vehicle details. Confirm the latest price and availability with our team.</p>}<div className="detail-main-grid"><div className="detail-gallery"><div className="detail-main-photo" onTouchStart={(event) => { touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }} onTouchEnd={(event) => { if (!touch.current) return; const dx = event.changedTouches[0].clientX - touch.current.x; const dy = event.changedTouches[0].clientY - touch.current.y; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1); touch.current = null; }}><button className="detail-open-photo" onClick={() => gallery.current?.showModal()} aria-label={`Enlarge photo ${selected + 1} of ${name}`}><VehicleImage source={images[selected]} alt={`${name}, photo ${selected + 1}`} width={1600} eager /></button><span className="vehicle-status"><i />{vehicle.availability || 'Enquire'}</span><span className="detail-photo-count">{selected + 1} / {images.length}</span>{images.length > 1 && <div className="detail-photo-arrows"><button onClick={() => move(-1)} aria-label="Previous vehicle photo"><span className="inv-prev"><Icon name="arrow" size={19} /></span></button><button onClick={() => move(1)} aria-label="Next vehicle photo"><Icon name="arrow" size={19} /></button></div>}</div>{images.length > 1 && <div className="detail-thumbnails" aria-label="Vehicle photos">{images.map((source, index) => <button className={index === selected ? 'is-selected' : ''} key={`${source}-${index}`} onClick={() => setSelected(index)} aria-label={`Show photo ${index + 1}`} aria-current={index === selected ? 'true' : undefined}><VehicleImage source={source} alt="" width={300} /></button>)}</div>}</div><aside className="detail-enquiry"><p className="inv-kicker">MAKE YOUR NEXT MOVE</p><p className="detail-price">{priceText(vehicle.price)}</p><div className="detail-enquiry-meta"><span>{vehicle.condition || 'Vehicle'}</span><span>{vehicle.location || 'Sri Lanka'}</span></div><h2>Like what you see?<br />Let’s talk.</h2><p>Get the details you need, confirm availability and arrange your next step with our team.</p><Button href={enquiry}>Enquire on WhatsApp <Icon name="arrow-up" size={18} /></Button><Button href="tel:+94771813928" variant="secondary"><Icon name="phone" size={17} />+94 77 181 3928</Button><span className="detail-enquiry-note">Reference: {vehicle.id}<br />Current price and availability confirmed directly.</span></aside></div>
      <div className="detail-information"><div><p className="inv-kicker">THE FINER DETAILS</p><h2>A closer look.</h2><div className="detail-facts">{facts.filter(([, value]) => value != null && value !== '').map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></div><div className="detail-description"><p className="inv-kicker">GET TO KNOW YOUR CAR</p><h2>Good to know.</h2>{vehicle.description ? String(vehicle.description).replace(/\*\*/g, '').split(/\n+/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>) : <p>Ask our team for the complete specification, condition details and supporting documents available for this vehicle.</p>}<Link to={`/vehicle-information-support.html?reference=${encodeURIComponent(vehicle.id)}`}>Have a question about the details? <Icon name="arrow-up" size={16} /></Link></div></div>
    </section>
    {!!related.length && <section className="detail-related"><div className="container"><div className="detail-related-heading"><div><p className="inv-kicker">KEEP EXPLORING</p><h2>More possibilities.</h2></div><Button to="/all-vehicles.html" variant="secondary">View all vehicles <Icon name="arrow" size={18} /></Button></div><div className="inv-cards">{related.map((item) => <VehicleCard vehicle={item} key={item.id} />)}</div></div></section>}
    <dialog className="detail-lightbox" ref={gallery} aria-label={`Photos of ${name}`} onClick={(event) => { if (event.target === event.currentTarget) gallery.current?.close(); }} onKeyDown={(event) => { if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); } if (event.key === 'ArrowRight') { event.preventDefault(); move(1); } }}><div className="detail-lightbox-toolbar"><span>{name} · {selected + 1} / {images.length}</span><button onClick={() => gallery.current?.close()} aria-label="Close photo gallery"><Icon name="close" size={24} /></button></div><VehicleImage source={images[selected]} alt={`${name}, enlarged photo ${selected + 1}`} width={2000} eager />{images.length > 1 && <div className="detail-lightbox-controls"><button onClick={() => move(-1)} aria-label="Previous photo"><span className="inv-prev"><Icon name="arrow" size={23} /></span></button><button onClick={() => move(1)} aria-label="Next photo"><Icon name="arrow" size={23} /></button></div>}</dialog>
  </>;
}
