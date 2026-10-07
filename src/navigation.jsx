import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Brand, Icon } from './components';
import './navigation.css';

const CONTACT = 'https://wa.me/94771813928';
const inventoryPath = '/all-vehicles.html';
const links = [[inventoryPath, 'The collection'], ['/reviews.html', 'Customer stories'], ['/aboutus.html', 'Our story']];
const services = [
  ['/sell-your-vehicle-sri-lanka.html', 'Sell your vehicle', 'Make room for your next chapter.', 'key'],
  ['/vehicle-sourcing-sri-lanka.html', 'Find something specific', 'Tell us what you have in mind.', 'search'],
  ['/vehicle-information-support.html', 'Know your next vehicle', 'A little clarity before your next move.', 'shield'],
];
const emptyFilters = { q: '', brand: '', type: '', fuel: '', minPrice: '', maxPrice: '', minYear: '', maxYear: '', sort: 'recommended' };
const number = new Intl.NumberFormat('en-LK', { maximumFractionDigits: 0 });
const numeric = value => value !== '' && Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
const focusable = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]';

function toParams(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    const clean = String(value).trim();
    if (clean && !(key === 'sort' && clean === 'recommended')) params.set(key, clean);
  });
  return params;
}

function SearchThumbnail({ vehicle }) {
  const [failed, setFailed] = useState(false);
  const raw = String(vehicle.image || '');
  useEffect(() => setFailed(false), [raw]);
  const driveId = raw.match(/\/d\/([\w-]+)/)?.[1] || raw.match(/[?&]id=([\w-]+)/)?.[1];
  const source = driveId ? `https://drive.google.com/thumbnail?id=${driveId}&sz=w300` : /^https?:\/\//i.test(raw) ? raw : '';
  return <span className="nav-result-photo">{source && !failed ? <img src={source} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <Icon name="car" size={25} />}</span>;
}

function SearchDialog({ open, close, dialogRef, initialSearch }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState({ items: [], facets: null, total: 0, loading: true, error: false, cached: false });
  const queryKey = toParams(filters).toString();
  const invalidPrice = numeric(filters.minPrice) !== null && numeric(filters.maxPrice) !== null && Number(filters.minPrice) > Number(filters.maxPrice);
  const invalidYear = numeric(filters.minYear) !== null && numeric(filters.maxYear) !== null && Number(filters.minYear) > Number(filters.maxYear);
  const rangeError = invalidPrice ? 'Maximum budget must be at least the minimum budget.' : invalidYear ? 'The end year must be the same as or later than the start year.' : '';

  useEffect(() => {
    if (!open) { dialogRef.current?.close(); return; }
    const params = new URLSearchParams(initialSearch);
    setFilters(Object.fromEntries(Object.entries(emptyFilters).map(([key, value]) => [key, params.get(key) || value])));
    dialogRef.current?.showModal();
    inputRef.current?.focus();
  }, [open, initialSearch, dialogRef]);

  useEffect(() => {
    if (!open || rangeError) return;
    let active = true;
    let sequence = 0;
    let stop;
    const deadlines = new Set();
    setState(current => ({ ...current, loading: true, error: false }));
    const load = async () => {
      const request = ++sequence;
      let deadline;
      setState(current => ({ ...current, loading: true, error: false }));
      try {
        const store = window.VehicleStore;
        if (!store) throw new Error('Catalogue unavailable');
        await Promise.race([store.whenReady(), new Promise((_, reject) => { deadline = window.setTimeout(() => reject(new Error('Catalogue connection timed out')), 18000); deadlines.add(deadline); })]);
        clearTimeout(deadline);
        if (!active || request !== sequence) return;
        const params = new URLSearchParams(queryKey);
        const response = await store.query({ search: params.get('q') || '', sort: params.get('sort') || 'recommended', page: 1, pageSize: 4, filters: {
          brands: (params.get('brand') || '').split(',').filter(Boolean), types: (params.get('type') || '').split(',').filter(Boolean), fuels: (params.get('fuel') || '').split(',').filter(Boolean),
          minPrice: numeric(params.get('minPrice') || ''), maxPrice: numeric(params.get('maxPrice') || ''), minYear: numeric(params.get('minYear') || ''), maxYear: numeric(params.get('maxYear') || ''),
        } });
        if (active && request === sequence) setState({ ...response, loading: false, error: false, cached: store.getState?.()?.source === 'cache' });
      } catch {
        if (active && request === sequence) setState(current => ({ ...current, loading: false, error: true, items: [], total: 0 }));
      } finally { clearTimeout(deadline); deadlines.delete(deadline); }
    };
    const timer = setTimeout(load, 180);
    stop = window.VehicleStore?.on('update', load);
    return () => { active = false; sequence += 1; clearTimeout(timer); deadlines.forEach(clearTimeout); stop?.(); };
  }, [open, queryKey, retry, rangeError]);

  function change(key, value) { setFilters(current => ({ ...current, [key]: value })); }
  function submit(event) {
    event.preventDefault();
    if (rangeError) return;
    const query = toParams(filters).toString();
    close();
    navigate(`${inventoryPath}${query ? `?${query}` : ''}`);
  }
  const filterCount = Object.entries(filters).filter(([key, value]) => key !== 'q' && key !== 'sort' && value).length;

  return <dialog ref={dialogRef} className="nav-search-dialog" aria-labelledby="nav-search-title" onCancel={event => { event.preventDefault(); close(); }} onClose={close} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="nav-search-panel">
      <div className="nav-search-heading"><div><p className="nav-overline">A GOOD PLACE TO START</p><h2 id="nav-search-title">Your next car. <span>Your way.</span></h2></div><button type="button" className="nav-icon-button" onClick={close} aria-label="Close vehicle search"><Icon name="close" size={22} /></button></div>
      <form onSubmit={submit} className="nav-search-form" role="search" aria-label="Advanced vehicle search">
        <div className="nav-search-input"><Icon name="search" size={25} /><label className="nav-sr-only" htmlFor="global-vehicle-search">Search make, model or keyword</label><input id="global-vehicle-search" ref={inputRef} type="search" autoComplete="off" value={filters.q} onChange={event => change('q', event.target.value)} placeholder="A make, a model, a new possibility…" /><kbd>ESC</kbd></div>
        <div className="nav-search-body">
          <div className="nav-search-filters"><div className="nav-filter-label"><span><Icon name="filter" size={16} /> Refine your search {filterCount > 0 && <i>{filterCount}</i>}</span><button type="button" onClick={() => setFilters(emptyFilters)}>Reset</button></div>
            <div className="nav-select-grid">{[['brand', 'brands', 'Make', 'All makes'], ['type', 'types', 'Body type', 'All body types'], ['fuel', 'fuels', 'Fuel', 'All fuel types']].map(([key, facet, label, placeholder]) => <label className="nav-field" key={key}><span>{label}</span><select aria-label={label} value={filters[key]} onChange={event => change(key, event.target.value)}><option value="">{placeholder}</option>{filters[key] && !(state.facets?.[facet] || []).some(option => option.key === filters[key]) && <option value={filters[key]}>{filters[key].split(',').join(', ')}</option>}{(state.facets?.[facet] || []).map(option => <option value={option.key} key={option.key}>{option.value} ({option.count})</option>)}</select></label>)}</div>
            <fieldset className="nav-range"><legend>Budget <span>LKR</span></legend><div><label className="nav-field"><span className="nav-sr-only">Minimum budget in LKR</span><input type="number" inputMode="numeric" min="0" step="1" placeholder="No minimum" value={filters.minPrice} onChange={event => change('minPrice', event.target.value)} aria-invalid={invalidPrice || undefined} aria-describedby={invalidPrice ? 'nav-range-error' : undefined} /></label><span>—</span><label className="nav-field"><span className="nav-sr-only">Maximum budget in LKR</span><input type="number" inputMode="numeric" min="0" step="1" placeholder="No maximum" value={filters.maxPrice} onChange={event => change('maxPrice', event.target.value)} aria-invalid={invalidPrice || undefined} aria-describedby={invalidPrice ? 'nav-range-error' : undefined} /></label></div></fieldset>
            <fieldset className="nav-range"><legend>Model year</legend><div><label className="nav-field"><span className="nav-sr-only">Earliest model year</span><input type="number" inputMode="numeric" min="1900" max="2100" step="1" placeholder="From" value={filters.minYear} onChange={event => change('minYear', event.target.value)} aria-invalid={invalidYear || undefined} aria-describedby={invalidYear ? 'nav-range-error' : undefined} /></label><span>—</span><label className="nav-field"><span className="nav-sr-only">Latest model year</span><input type="number" inputMode="numeric" min="1900" max="2100" step="1" placeholder="To" value={filters.maxYear} onChange={event => change('maxYear', event.target.value)} aria-invalid={invalidYear || undefined} aria-describedby={invalidYear ? 'nav-range-error' : undefined} /></label></div></fieldset>
            {rangeError && <p className="nav-range-error" id="nav-range-error" role="alert">{rangeError}</p>}
            <label className="nav-field nav-sort-field"><span>Show me</span><select value={filters.sort} onChange={event => change('sort', event.target.value)}><option value="recommended">Recommended first</option><option value="price-low">Lowest price first</option><option value="price-high">Highest price first</option><option value="year-new">Newest model year</option><option value="mileage-low">Lowest mileage first</option><option value="newest">Recently added</option></select></label>
          </div>
          <div className="nav-search-preview" aria-busy={state.loading && !rangeError}><div className="nav-preview-label"><span>{queryKey ? 'YOUR MATCHES' : 'FROM THE COLLECTION'}</span><span role="status" aria-live="polite">{rangeError ? 'Check your range' : state.loading ? 'Searching…' : state.error ? 'Connection unavailable' : `${state.total} ${state.total === 1 ? 'vehicle' : 'vehicles'}`}</span></div>
            {rangeError ? <div className="nav-search-state"><Icon name="filter" size={30} /><h3>A small adjustment.</h3><p>Check the highlighted range to see matching vehicles.</p></div> : state.loading ? <div className="nav-search-skeleton" aria-label="Loading matching vehicles">{[0, 1, 2].map(index => <div key={index}><i /><span><b /><b /></span></div>)}</div> : state.error ? <div className="nav-search-state"><Icon name="car" size={30} /><h3>Let’s connect you.</h3><p>We couldn’t reach the catalogue. Try again, or ask our team about current stock.</p><button type="button" className="nav-inline-link" onClick={() => setRetry(value => value + 1)}>Try again <Icon name="arrow" size={16} /></button><a href={CONTACT}>Ask on WhatsApp <Icon name="arrow-up" size={15} /></a></div> : !state.items?.length ? <div className="nav-search-state"><Icon name="search" size={30} /><h3>Still out there.</h3><p>{queryKey ? 'No vehicles match yet. Widen your search, or let us help find what you have in mind.' : 'New possibilities are always on the way. Ask our team about available stock.'}</p><Link to="/vehicle-sourcing-sri-lanka.html" onClick={close}>Find a specific vehicle <Icon name="arrow" size={16} /></Link></div> : <>{state.cached && <p className="nav-cached-note">Showing saved stock. Please confirm availability.</p>}<div className="nav-result-list">{state.items.map(vehicle => <Link key={vehicle.id} to={`/car-details.html?vehicle=${encodeURIComponent(vehicle.slug)}`} className="nav-result" onClick={close}><SearchThumbnail vehicle={vehicle} /><span className="nav-result-copy"><small>{[vehicle.year, vehicle.type].filter(Boolean).join(' · ')}</small><strong>{[vehicle.brand, vehicle.model].filter(Boolean).join(' ')}</strong><span>{Number(vehicle.price) > 0 ? `LKR ${number.format(vehicle.price)}` : 'Price on request'}<i>{vehicle.availability || 'Enquire'}</i></span></span><Icon name="arrow-up" size={16} /></Link>)}</div></>}
            <Link className="nav-search-help" to="/vehicle-sourcing-sri-lanka.html" onClick={close}><span>Have something specific in mind?</span><strong>Let’s find it together <Icon name="arrow-up" size={15} /></strong></Link>
          </div>
        </div>
        <div className="nav-search-footer"><span><Icon name="shield" size={16} /> A little guidance. A better next move.</span><button className="nav-search-submit" type="submit" disabled={!!rangeError}>Explore {state.loading || state.error || rangeError ? 'the collection' : `${state.total} ${state.total === 1 ? 'vehicle' : 'vehicles'}`} <Icon name="arrow" size={19} /></button></div>
      </form>
    </div>
  </dialog>;
}

export default function Header() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [shortcut, setShortcut] = useState('Ctrl K');
  const menuRef = useRef(null), toggleRef = useRef(null), servicesRef = useRef(null), servicesButton = useRef(null), searchRef = useRef(null), searchButton = useRef(null), progressRef = useRef(null);
  const initialSearch = location.pathname === inventoryPath ? location.search : '';

  function openSearch() { setMobileOpen(false); setServicesOpen(false); searchButton.current?.focus(); setSearchOpen(true); }
  function closeSearch() { setSearchOpen(false); }
  function closeMobile(restore = false) { setMobileOpen(false); if (restore) toggleRef.current?.focus(); }

  useEffect(() => { setMobileOpen(false); setServicesOpen(false); setSearchOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    setShortcut(/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K');
    const keyboard = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchButton.current?.focus();
        setMobileOpen(false); setServicesOpen(false); setSearchOpen(current => !current);
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => document.removeEventListener('keydown', keyboard);
  }, []);
  useEffect(() => {
    let frame;
    const update = () => {
      frame = null;
      setScrolled(window.scrollY > 32);
      const distance = document.documentElement.scrollHeight - window.innerHeight;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${distance > 0 ? Math.max(0, Math.min(1, window.scrollY / distance)) : 0})`;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true }); window.addEventListener('resize', schedule);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); };
  }, [location.pathname]);
  useEffect(() => {
    if (!mobileOpen && !searchOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [mobileOpen, searchOpen]);
  useEffect(() => {
    if (!mobileOpen) return;
    const hidden = [...document.querySelectorAll('main, .site-footer, .nav-mobile-actions')].map(node => [node, node.inert]);
    hidden.forEach(([node]) => { node.inert = true; });
    let focusFrame;
    const focusFirstLink = () => {
      const firstLink = menuRef.current?.querySelector('a');
      if (!firstLink) return;
      if (getComputedStyle(firstLink).visibility === 'visible') firstLink.focus({ preventScroll: true });
      else focusFrame = requestAnimationFrame(focusFirstLink);
    };
    focusFrame = requestAnimationFrame(focusFirstLink);
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); closeMobile(true); }
      if (event.key === 'Tab') {
        const nodes = [toggleRef.current, ...menuRef.current.querySelectorAll(focusable)].filter(node => node && node.getClientRects().length);
        const first = nodes[0], last = nodes.at(-1);
        if (event.shiftKey && (document.activeElement === first || !nodes.includes(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !nodes.includes(document.activeElement))) { event.preventDefault(); first?.focus(); }
      }
    };
    const resize = () => { if (window.innerWidth > 1100) setMobileOpen(false); };
    document.addEventListener('keydown', keydown); window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(focusFrame); hidden.forEach(([node, previous]) => { node.inert = previous; }); document.removeEventListener('keydown', keydown); window.removeEventListener('resize', resize); };
  }, [mobileOpen]);
  useEffect(() => {
    if (!servicesOpen) return;
    const outside = event => { if (!servicesRef.current?.contains(event.target)) setServicesOpen(false); };
    const escape = event => { if (event.key === 'Escape') { setServicesOpen(false); servicesButton.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [servicesOpen]);

  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className={`site-header premium-header${scrolled ? ' is-scrolled' : ''}${mobileOpen ? ' menu-is-open' : ''}`}>
      <div className="nav-shell premium-nav-shell"><Brand />
        <nav className="premium-desktop-nav" aria-label="Main navigation"><NavLink to={inventoryPath}>The collection</NavLink><div className="nav-services" ref={servicesRef} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setServicesOpen(false); }}><button ref={servicesButton} aria-expanded={servicesOpen} aria-controls="nav-services-menu" onClick={() => setServicesOpen(current => !current)} className={location.pathname.includes('service') || location.pathname.includes('sourcing') || location.pathname.includes('support') || location.pathname.includes('sell-your') ? 'active' : ''}>Our services <Icon name="chevron" size={12} /></button><div id="nav-services-menu" className={`nav-mega-menu${servicesOpen ? ' is-open' : ''}`} inert={!servicesOpen ? true : undefined}><div className="nav-mega-intro"><p className="nav-overline">BEYOND THE DRIVE</p><h2>Every next move.<br /><span>A little easier.</span></h2><Link to="/services.html">Explore our services <Icon name="arrow" size={17} /></Link></div><div className="nav-mega-links">{services.map(([to, title, description, icon]) => <Link to={to} key={to}><span className="nav-service-icon"><Icon name={icon} size={20} /></span><span><strong>{title}</strong><small>{description}</small></span><Icon name="arrow-up" size={16} /></Link>)}</div></div></div><NavLink to="/reviews.html">Customer stories</NavLink><NavLink to="/aboutus.html">Our story</NavLink></nav>
        <div className="nav-utilities"><button ref={searchButton} className="nav-search-trigger" onClick={openSearch} aria-label="Open vehicle search" aria-haspopup="dialog"><Icon name="search" size={18} /><span>Search</span><kbd>{shortcut}</kbd></button><a className="nav-contact premium-contact" href={CONTACT}>Let’s talk <Icon name="arrow-up" size={16} /></a><button ref={toggleRef} className="menu-toggle premium-menu-toggle" aria-controls="mobile-navigation" aria-expanded={mobileOpen} aria-label={mobileOpen ? 'Close menu' : 'Open menu'} onClick={() => { setServicesOpen(false); setMobileOpen(current => !current); }}><Icon name={mobileOpen ? 'close' : 'menu'} size={23} /></button></div>
      </div><div className="nav-reading-progress" aria-hidden="true"><span ref={progressRef} /></div>
    </header>
    <div className={`nav-desktop-actions ${scrolled ? 'is-scrolled' : ''}`} aria-label="Quick vehicle actions"><button type="button" onClick={openSearch}><Icon name="car" size={19}/>Find my next vehicle</button><Link to="/sell-your-vehicle-sri-lanka.html"><Icon name="key" size={18}/>Sell my vehicle <Icon name="arrow" size={17}/></Link></div>
    {mobileOpen && <div className="menu-backdrop premium-menu-backdrop" onClick={() => closeMobile(true)} />}
    <nav ref={menuRef} id="mobile-navigation" className={`mobile-navigation premium-mobile-navigation${mobileOpen ? ' is-open' : ''}`} aria-label="Mobile navigation" inert={!mobileOpen ? true : undefined}>
      <div className="nav-mobile-heading"><span className="nav-overline">YOUR NEXT CHAPTER STARTS HERE</span><span>LK · EST. FOR THE ROAD</span></div>
      <div className="mobile-links"><Link to="/">Home <small>01</small></Link>{[links[0], ['/services.html', 'Our services'], ...links.slice(1)].map(([to, title], index) => <Link to={to} key={to}>{title}<small>0{index + 2}</small></Link>)}</div>
      <div className="nav-mobile-secondary"><Link to="/sell-your-vehicle-sri-lanka.html">Sell your vehicle <Icon name="arrow-up" size={16} /></Link><Link to="/vehicle-sourcing-sri-lanka.html">Find a specific vehicle <Icon name="arrow-up" size={16} /></Link></div>
      <div className="mobile-menu-footer"><button type="button" onClick={openSearch}><Icon name="search" size={20} /> Find your next vehicle <Icon name="arrow" size={20} /></button><a href="tel:+94771813928">077 181 3928 <Icon name="phone" size={17} /></a><a href={CONTACT}>Chat on WhatsApp <Icon name="chat" size={17} /></a></div>
    </nav>
    <div className={`nav-mobile-actions${mobileOpen || searchOpen ? ' is-hidden' : ''}`} aria-label="Start your vehicle journey"><button onClick={openSearch}><Icon name="search" size={18} />Find a vehicle</button><Link to="/sell-your-vehicle-sri-lanka.html">Sell your vehicle <Icon name="arrow-up" size={16} /></Link></div>
    <SearchDialog open={searchOpen} close={closeSearch} dialogRef={searchRef} initialSearch={initialSearch} />
  </>;
}
