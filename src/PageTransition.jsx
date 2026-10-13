import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMotionPreference } from './useMotionPreference';

const pageNames = {
  '/': 'THE ROAD AHEAD', '/index.html': 'THE ROAD AHEAD',
  '/all-vehicles.html': 'THE COLLECTION', '/car-details.html': 'A CLOSER LOOK',
  '/services.html': 'AT YOUR SERVICE', '/aboutus.html': 'MEET THIMADU',
  '/reviews.html': 'REAL PEOPLE. NEW CHAPTERS.', '/sell-your-vehicle-sri-lanka.html': 'YOUR NEXT MOVE',
  '/vehicle-sourcing-sri-lanka.html': 'MADE FOR YOUR WISH LIST', '/vehicle-information-support.html': 'A LITTLE CLARITY',
};

export default function PageTransition({ children }) {
  const { motionDisabled } = useMotionPreference();
  const location = useLocation();
  const [displayed, setDisplayed] = useState(location);
  const [phase, setPhase] = useState('idle');
  const displayedRef = useRef(location);
  const changedPage = useRef(false);
  const targetRef = useRef(location);

  useLayoutEffect(() => {
    targetRef.current = location;
    if (displayedRef.current.pathname === location.pathname) {
      setDisplayed(location);
      setPhase('idle');
      return;
    }
    changedPage.current = true;
    if (motionDisabled) {
      displayedRef.current = location;
      setDisplayed(location);
      setPhase('idle');
      return;
    }
    setPhase('covering');
    const swap = setTimeout(() => {
      displayedRef.current = location;
      setDisplayed(location);
      setPhase('revealing');
    }, 240);
    const finish = setTimeout(() => setPhase('idle'), 760);
    return () => { clearTimeout(swap); clearTimeout(finish); };
  }, [location, motionDisabled]);

  useLayoutEffect(() => {
    if (!changedPage.current) return;
    changedPage.current = false;
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.getElementById('main-content')?.focus({ preventScroll: true });
  }, [displayed.pathname]);

  useEffect(() => {
    if (!displayed.hash) return;
    let target;
    try { target = decodeURIComponent(displayed.hash.slice(1)); } catch { return; }
    const timer = setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: 'instant', block: 'start' }), 60);
    return () => clearTimeout(timer);
  }, [displayed.pathname, displayed.hash]);

  return <>
    <div className={`page-transition-view transition-${phase}`}>{children(displayed.pathname === location.pathname ? location : displayed)}</div>
    <div className={`page-curtain curtain-${phase}`} aria-hidden="true">
      <div className="page-curtain-accent"/>
      <div className="page-curtain-panel"><div className="page-curtain-brand"><img src="/logo.png" alt="" width="104" height="54"/><span>THIMADU AUTO TRADERS</span></div><div className="page-curtain-label"><span/>{pageNames[targetRef.current.pathname] || 'YOUR NEXT CHAPTER'}</div><span className="page-curtain-road"/></div>
    </div>
    <span className="sr-only" role="status" aria-live="polite">{phase === 'covering' ? 'Opening the next page' : ''}</span>
  </>;
}
