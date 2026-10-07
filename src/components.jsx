import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const paths = {
  arrow: 'M4 12h16m-6-6 6 6-6 6', 'arrow-up': 'M5 19 19 5M5 5h14v14',
  search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  car: 'm4 8 2-5h12l2 5M3 8h18v10H3V8Zm0 10v3m18-3v3M6 12h3m6 0h3',
  check: 'm5 12 4 4L19 6', phone: 'M7 3H3c-1 10 8 19 18 18v-4l-5-2-2 2c-3-1-6-4-7-7l2-2-2-5Z',
  chat: 'M21 11.5a9 9 0 0 1-13 8L3 21l1.5-5A9 9 0 1 1 21 11.5Z',
  close: 'm6 6 12 12M6 18 18 6', chevron: 'm8 4 8 8-8 8',
  filter: 'M4 7h16M4 17h16M9 4v6m6 4v6',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  shield: 'm12 2 9 4v7c0 5-9 9-9 9S3 18 3 13V6l9-4Zm-5 10 3 3 6-6',
  key: 'M14 10a6 6 0 1 0-4 4L3 21H1v-4l7-7M17 7h.01',
  play: 'm9 5 11 7-11 7V5Z', pause: 'M8 5v14M16 5v14', plus: 'M12 4v16M4 12h16', menu: 'M4 7h16M8 12h12M4 17h16',
};
export function Icon({ name = 'arrow', size = 20, className = '', ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}><path d={paths[name] || paths.arrow} /></svg>;
}
export function Button({ to, href, children, variant = 'primary', className = '', ...props }) {
  const classes = `btn btn-${variant} ${className}`;
  if (to) return <Link to={to} className={classes} {...props}>{children}</Link>;
  if (href) return <a href={href} className={classes} {...props}>{children}</a>;
  return <button className={classes} {...props}>{children}</button>;
}
export function Reveal({ children, className = '', delay = 0, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const node = ref.current;
    node.classList.add('reveal-ready');
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { node.classList.add('is-visible'); observer.disconnect(); } }, { threshold: .08 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${className}`} style={{ '--reveal-delay': `${delay}ms` }} {...props}>{children}</div>;
}
export function PageHero({ eyebrow, title, description, children }) {
  return <section className="page-hero"><div className="container"><nav className="page-breadcrumb" aria-label="Breadcrumb"><Link to="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">{eyebrow || 'Explore Thimadu'}</span></nav><p className="eyebrow">{eyebrow || 'THIMADU AUTO TRADERS'}</p><h1>{title}</h1>{description && <p className="page-hero-description">{description}</p>}{children}</div><span className="page-hero-orbit" aria-hidden="true" /></section>;
}
export function Brand({ footer = false }) {
  return <Link to="/" className={`brand ${footer ? 'brand-footer' : ''}`} aria-label="Thimadu Auto Traders home"><img className="brand-logo" src="/logo.png" alt="Thimadu Auto Traders" width="1115" height="583"/></Link>;
}
export function ContactBanner() {
  return <section className="contact-banner"><div className="container"><Reveal><p className="eyebrow">LET’S FIND YOUR NEXT CHAPTER</p><h2>Good things are<br/>just around the bend.</h2><div className="button-row"><Button href="https://wa.me/94771813928" variant="white">Talk to our team <Icon name="arrow-up"/></Button><a className="contact-phone" href="tel:+94771813928">+94 77 181 3928</a></div></Reveal><div className="contact-road" aria-hidden="true"><span/><span/><span/></div></div></section>;
}
export function Footer() {
  const [vehicle, setVehicle] = useState('');
  const [city, setCity] = useState('');
  const [draftOpened, setDraftOpened] = useState(false);
  const submit = event => {
    event.preventDefault();
    if (!vehicle.trim() || !city.trim()) return;
    const message = `Hi Thimadu Auto Traders, I am looking for ${vehicle.trim()}. My location is ${city.trim()}. Could you help me explore my options?`;
    window.open(`https://wa.me/94771813928?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    setDraftOpened(true);
  };
  return <footer className="site-footer">
    <section className="footer-enquiry" aria-labelledby="footer-enquiry-title"><div className="footer-brand-invitation"><p className="footer-kicker"><span/> THE START OF SOMETHING GOOD</p><div className="footer-wordmark" aria-hidden="true">Thimadu</div><p className="footer-invitation-copy">Where your next<br/>chapter begins.</p><a className="footer-direct-link" href="tel:+94771813928">Let’s talk. +94 77 181 3928 <Icon name="arrow-up" size={17}/></a></div><Reveal className="footer-enquiry-inner"><h2 id="footer-enquiry-title">Your next vehicle.<br/>Let’s start the conversation.</h2><p>A make. A model. A little daydream.<br/>Tell us what you have in mind.</p><form className="footer-enquiry-form" onSubmit={submit}><label htmlFor="footer-vehicle">What are you looking for?</label><input id="footer-vehicle" name="vehicle" placeholder="Make, model, or the kind of vehicle" value={vehicle} onChange={event => { setVehicle(event.target.value); setDraftOpened(false); }} required pattern=".*\S.*" maxLength={120}/><label htmlFor="footer-city">Your city</label><input id="footer-city" name="city" autoComplete="address-level2" placeholder="Where will your next journey begin?" value={city} onChange={event => { setCity(event.target.value); setDraftOpened(false); }} required pattern=".*\S.*" maxLength={80}/><button type="submit">Let’s find your next chapter <Icon name="arrow" size={18}/></button><small role="status">{draftOpened ? 'Continue in WhatsApp to review and send your enquiry.' : 'Opens a message in WhatsApp for you to review and send.'}</small></form></Reveal></section>
    <div className="footer-links-panel"><div className="footer-top"><div><Brand footer/><p>A little guidance.<br/>A whole new journey.</p><a className="footer-social" href="https://www.facebook.com/thimaducar" target="_blank" rel="noreferrer">Follow our journey <Icon name="arrow-up" size={17}/></a></div><div><h3>Explore</h3><Link to="/all-vehicles.html">Our vehicles</Link><Link to="/aboutus.html">About Thimadu</Link><Link to="/reviews.html">Customer stories</Link><Link to="/services.html">Our services</Link></div><div><h3>Your next move</h3><Link to="/sell-your-vehicle-sri-lanka.html">Sell your vehicle</Link><Link to="/vehicle-sourcing-sri-lanka.html">Find a specific vehicle</Link><Link to="/vehicle-information-support.html">Vehicle information</Link><Link to="/#questions">Common questions</Link></div><div><h3>Let’s connect</h3><a href="tel:+94771813928">+94 77 181 3928</a><a href="https://wa.me/94771813928">Chat on WhatsApp <Icon name="arrow-up" size={14}/></a><span>Sri Lanka</span></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Thimadu Auto Traders.</span><span>Made for the road ahead.</span><button onClick={() => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}>Back to top <Icon name="arrow-up" size={16}/></button></div></div>
  </footer>;
}
