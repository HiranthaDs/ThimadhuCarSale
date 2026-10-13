import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components';
import { useMotionPreference } from '../useMotionPreference';

export default function ShowroomHero() {
  const film = useRef(null);
  const { mobile, reduced } = useMotionPreference();
  const automatic = !mobile && !reduced && !navigator.connection?.saveData;
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = film.current;
    if (!video) return;
    let visible = true;
    const update = () => {
      if (automatic && !paused && visible && !document.hidden) video.play().catch(() => {});
      else video.pause();
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    observer.observe(video);
    document.addEventListener('visibilitychange', update);
    update();
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); video.pause(); };
  }, [automatic, paused]);

  const toggleFilm = () => {
    const video = film.current;
    if (!video) return;
    if (automatic) { setPaused(!video.paused); return; }
    if (!video.getAttribute('src')) video.src = '/Videos/hero1.mp4';
    if (video.paused) video.play().catch(() => setFailed(true));
    else video.pause();
  };

  return <section className="showroom-hero" aria-labelledby="showroom-title"><div className="container showroom-hero-layout">
    <div className="showroom-hero-copy">
      <p className="eyebrow"><span/>THIMADU AUTO TRADERS · SRI LANKA</p>
      <h1 id="showroom-title">Find a car you’ll<br/>feel good about.</h1>
      <p className="showroom-introduction">Buy, sell or find a specific vehicle with our team. Explore our vehicles and meet the customers driving them home.</p>
      <div className="showroom-actions"><Link to="/all-vehicles.html" className="btn">Browse vehicles <Icon name="arrow" size={18}/></Link><a href="#customer-stories" className="showroom-deliveries-link">See our deliveries <Icon name="arrow" size={18}/></a></div>
      <div className="showroom-contact"><span className="showroom-contact-icon"><Icon name="phone" size={18}/></span><div><span>A conversation is a good place to start.</span><a href="tel:+94771813928">077 181 3928</a></div></div>
    </div>
    <div className="showroom-visual">
      <div className="showroom-film">
        {failed ? <img src="/images/hero1-poster.webp" alt="A vehicle being unloaded from a transporter" width="1600" height="900"/> : <video ref={film} src={automatic ? '/Videos/hero1.mp4' : undefined} poster="/images/hero1-poster.webp" muted loop playsInline preload={automatic ? 'metadata' : 'none'} aria-label="Thimadu automotive film" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setFailed(true)}/>}
        {!failed && <button type="button" className="showroom-film-control" onClick={toggleFilm} aria-label={playing ? 'Pause hero video' : 'Play hero video'}><Icon name={playing ? 'pause' : 'play'} size={15}/><span>{playing ? 'Pause film' : 'Play film'}</span></button>}
      </div>
      <div className="showroom-film-caption"><span>THIMADU AUTO TRADERS</span><span>Buy. Sell. Source.</span></div>
    </div>
  </div></section>;
}
