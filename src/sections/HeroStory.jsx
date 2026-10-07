import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Icon } from '../components';
import './hero-story.css';

const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));
const makes = [['Toyota','toyota.png'],['BMW','bmw.png'],['Mercedes-Benz','mercedes-benz.png'],['Audi','audi.png'],['Nissan','nissan.png'],['Kia','kia.png'],['Hyundai','hyundai.png'],['Volkswagen','volkswagen.svg']];
const journeys = [
  { id:'buy', title:'Find your vehicle', short:'Explore', icon:'car', to:'/all-vehicles.html', description:'A daily companion. A family upgrade. Find your kind of drive.' },
  { id:'sell', title:'Sell your vehicle', short:'Sell', icon:'key', to:'/sell-your-vehicle-sri-lanka.html', description:'Ready for something new? Start with the vehicle you know.' },
  { id:'source', title:'Find your perfect fit', short:'Find it', icon:'search', to:'/vehicle-sourcing-sri-lanka.html', description:'Your make, your model, your wish list. Let’s find it together.' },
  { id:'support', title:'A little more clarity', short:'Ask us', icon:'chat', to:'/vehicle-information-support.html', description:'Good questions deserve a personal conversation.' },
];

export function PhonePreview({ mode, compact = false, auto = false, paused = false, onViewChange }) {
  const [view, setView] = useState(0);
  const [interacting, setInteracting] = useState(false);
  const [visible, setVisible] = useState(false);
  const root = useRef(null);
  const screen = useRef(null);
  const current = mode ? Math.max(0, journeys.findIndex(item => item.id === mode)) : view;
  const journey = journeys[current];
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {threshold:.2});
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!auto || paused || interacting || !visible || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => { if (!document.hidden) setView(value => (value + 1) % journeys.length); }, 5200);
    return () => clearInterval(timer);
  }, [auto, paused, interacting, visible]);
  useEffect(() => { onViewChange?.(current); }, [current, onViewChange]);
  useEffect(() => {
    const node = screen.current;
    if (!node) return;
    node.scrollTop = 0;
    if (!auto || current !== 0 || paused || interacting || !visible || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame;
    const started = performance.now();
    const animate = now => {
      const phase = clamp((now-started-1000)/3600);
      node.scrollTop = (node.scrollHeight-node.clientHeight) * (1-Math.cos(phase*Math.PI*2))/2;
      if (phase < 1) frame=requestAnimationFrame(animate);
    };
    frame=requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [auto,current,paused,interacting,visible]);
  const select = index => { setInteracting(true); setView(index); };
  return <div ref={root} className={`hs-device ${compact ? 'hs-device-compact' : ''}`} role="group" aria-label="Animated preview of the Thimadu mobile website" onFocusCapture={() => setInteracting(true)} onPointerDown={() => setInteracting(true)} onWheel={() => setInteracting(true)}>
    {Array.from({length:14}, (_,index) => <div key={index} className="hs-chassis-layer" aria-hidden="true" style={{'--depth':`${-index * .9}px`,'--edge-light':`${28 + index * 3.6}%`}}/>)}
    <div className="hs-device-frame"><div className="hs-device-bezel"><div className="hs-device-screen">
      <div className="hs-status" aria-hidden="true"><span>9:41</span><div><span className="hs-cellular"><i/><i/><i/><i/></span><svg width="14" height="11" viewBox="0 0 16 12" fill="none"><path d="M1 3c4-3 10-3 14 0M4 6c2-2 6-2 8 0M7 9h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg><span className="hs-battery"/></div></div>
      <div className="hs-island" aria-hidden="true"><span/><i/></div>
      <div className="hs-screen-header"><img src="/logo.png" alt="Thimadu Auto Traders" width="1115" height="583"/><Link to="/services.html" aria-label="Explore Thimadu services"><Icon name="menu" size={21}/></Link></div>
      <div className="hs-screen-viewport" ref={screen}><div className={`hs-screen-body hs-screen-page-${current}`} key={`${current}-${mode || ''}`}>
        {current === 0 ? <>
          <Link className="hs-screen-hero" to="/all-vehicles.html"><img src="/images/hero-mobile.webp" alt="" width="900" height="507"/><div><span>YOUR NEXT CHAPTER</span><h3>Your next car.<br/>Your kind of drive.</h3><span className="hs-screen-pill">Explore vehicles <Icon name="arrow" size={12}/></span></div></Link>
          <div className="hs-screen-welcome"><h3>What’s your next move?</h3><p>A little guidance. A whole new journey.</p></div>
          <div className="hs-screen-tiles">{journeys.map((item,index) => <Link key={item.id} to={item.to} className={`hs-screen-tile hs-screen-tile-${index}`}><span>0{index + 1}</span><Icon name={item.icon} size={25}/><strong>{item.title}</strong><small>{['Explore the collection','Start something new','Tell us your wish list','Talk to our team'][index]}</small><i>Let’s go <Icon name="arrow" size={10}/></i></Link>)}</div>
          <div className="hs-screen-photo"><img src="/images/coastal-journey.webp" alt="" width="1672" height="941"/><strong>Made for the road ahead.</strong></div>
        </> : <>
          <div className="hs-screen-page-title"><span>THIMADU / {journey.short.toUpperCase()}</span><h3>{journey.title}.</h3><p>{journey.description}</p></div>
          <img className="hs-screen-feature-photo" src={current === 1 ? '/images/journey.webp' : current === 2 ? '/images/coastal-journey.webp' : '/images/hero-mobile.webp'} alt="" width="480" height="260"/>
          <div className="hs-demo-fields" aria-label="An illustration of the enquiry form">
            {(current === 1 ? [['YOUR VEHICLE','Make & model'],['THE DETAILS','Year, mileage & condition'],['YOUR LOCATION','City or area']] : current === 2 ? [['YOUR WISH LIST','Preferred make & model'],['YOUR BUDGET','A range that works for you'],['THE IMPORTANT THINGS','Your must-have features']] : [['LET’S START HERE','A vehicle or listing'],['YOUR QUESTION','What would you like to know?'],['A PERSONAL CONVERSATION','The Thimadu team']]).map(([label,value],index) => <div className="hs-demo-field" key={label} style={{'--field-delay':`${index * .35}s`}}><small>{label}</small><span>{value}<Icon name={index === 2 ? 'check' : 'chevron'} size={11}/></span></div>)}
          </div><Link to={journey.to} className="hs-screen-cta">{current === 1 ? 'Tell us about your vehicle' : current === 2 ? 'Start your vehicle search' : 'Start a conversation'}<Icon name="arrow" size={12}/></Link><p className="hs-screen-small">Your details. Your next step.</p>
        </>}
      </div></div>
      <div className="hs-screen-bottom" aria-label="Phone website preview pages">{journeys.map((item,index) => <button type="button" key={item.id} onClick={() => select(index)} aria-pressed={current === index} aria-label={`Preview ${item.title.toLowerCase()}`} disabled={!!mode}><Icon name={item.icon} size={17}/><span>{item.short}</span></button>)}</div><div className="hs-home-indicator" aria-hidden="true"/>
    </div></div><div className="hs-glass-reflection" aria-hidden="true"/></div>
    <span className="hs-device-button hs-action-button" aria-hidden="true"/><span className="hs-device-button hs-volume-up" aria-hidden="true"/><span className="hs-device-button hs-volume-down" aria-hidden="true"/><span className="hs-device-button hs-power-button" aria-hidden="true"/><span className="hs-antenna hs-antenna-top" aria-hidden="true"/><span className="hs-antenna hs-antenna-bottom" aria-hidden="true"/>
  </div>;
}

function BrandRail() {
  return <div className="hs-brands"><p>Different makes. <strong>The same personal approach.</strong></p><div className="hs-brand-window"><div className="hs-brand-track">{[0,1].map(copy => <div className="hs-brand-group" key={copy} aria-hidden={copy === 1 ? true : undefined}>{makes.map(([name,file]) => <Link key={name} to={`/all-vehicles.html?brand=${encodeURIComponent(name)}`} tabIndex={copy === 1 ? -1 : undefined} className="hs-brand-tile" aria-label={`Explore ${name} vehicles`}><img src={`/brands/${file}`} alt={name} width="100" height="70" loading="lazy"/></Link>)}</div>)}</div></div></div>;
}

export default function HeroStory() {
  const root = useRef(null), video = useRef(null), showcase = useRef(null), opening = useRef(null);
  const [reduced,setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [paused,setPaused] = useState(false);
  const [videoFailed,setVideoFailed] = useState(false);
  const [videoPlaying,setVideoPlaying] = useState(false);
  const [view,setView] = useState(0);
  useEffect(() => { const media = matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReduced(media.matches); media.addEventListener('change',update); return () => media.removeEventListener('change',update); }, []);
  useEffect(() => {
    const node = root.current;
    let frame = 0;
    const render = () => {
      frame = 0;
      const box = node.getBoundingClientRect();
      const staticLayout = reduced || innerWidth < 901;
      const p = staticLayout ? 1 : clamp(-box.top / Math.max(1,box.height-innerHeight));
      const morph = clamp(p / .42), settle = clamp((p-.32)/.43);
      node.style.setProperty('--hero-opacity', staticLayout ? 1 : 1-clamp(p/.24));
      node.style.setProperty('--phone-opacity', staticLayout ? 1 : clamp((p-.08)/.15));
      node.style.setProperty('--phone-scale', staticLayout ? 1 : 2.35 - morph*1.1 - settle*.25);
      node.style.setProperty('--phone-x', staticLayout ? '0px' : `${settle * innerWidth * .255}px`);
      node.style.setProperty('--phone-y', staticLayout ? '0px' : `${160*(1-morph)}px`);
      node.style.setProperty('--phone-ry', `${staticLayout ? -9 : -32 + morph*17 + settle*15}deg`);
      node.style.setProperty('--phone-rz', `${staticLayout ? 4 : -10 + morph*16 - settle*6}deg`);
      node.style.setProperty('--phone-rx', `${staticLayout ? 5 : 10*(1-settle)}deg`);
      node.style.setProperty('--copy-opacity', staticLayout ? 1 : clamp((p-.46)/.18));
      node.style.setProperty('--copy-y', `${staticLayout ? 0 : 40*(1-clamp((p-.46)/.18))}px`);
      node.style.setProperty('--brand-opacity', staticLayout ? 1 : clamp((p-.74)/.15));
      if (showcase.current) showcase.current.inert = !staticLayout && p < .35;
      if (opening.current) opening.current.inert = !staticLayout && p > .24;
      const film = video.current;
      const filmInView = staticLayout ? opening.current?.getBoundingClientRect().bottom > 0 : p < .24;
      if (film && !filmInView && !film.paused) film.pause();
      else if (film && filmInView && film.paused && !paused && !reduced && !navigator.connection?.saveData && !document.hidden) film.play().catch(() => {});
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };
    render(); window.addEventListener('scroll',schedule,{passive:true}); window.addEventListener('resize',schedule);
    return () => {cancelAnimationFrame(frame);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);};
  }, [reduced,paused]);
  useEffect(() => {
    const film = video.current;
    if (!film) return;
    let visible = true;
    const update = () => { if (visible && !opening.current?.inert && !document.hidden && !paused && !reduced && !navigator.connection?.saveData) film.play().catch(() => {}); else film.pause(); };
    const observer = new IntersectionObserver(([entry]) => {visible=entry.isIntersecting;update();}); observer.observe(film); document.addEventListener('visibilitychange',update); update();
    return () => {observer.disconnect();document.removeEventListener('visibilitychange',update);film.pause();};
  }, [paused,reduced]);
  function explorePhone(event) {
    event.preventDefault();
    const node = root.current;
    const top = innerWidth < 901 || reduced ? showcase.current.getBoundingClientRect().top+scrollY-100 : node.getBoundingClientRect().top+scrollY+(node.offsetHeight-innerHeight)*.75;
    scrollTo({top,behavior:reduced?'instant':'smooth'});
  }
  return <section className={`hs-story ${reduced ? 'hs-reduced' : ''} ${paused ? 'hs-paused' : ''}`} ref={root} aria-label="Discover Thimadu Auto Traders">
    <div className="hs-stage">
      <div className="hs-opening" ref={opening}>
        <div className="hs-film"><video ref={video} className="hs-video" src={reduced || navigator.connection?.saveData ? undefined : '/Videos/hero1.mp4'} poster="/images/hero1-poster.webp" muted loop playsInline preload="metadata" aria-label="Thimadu automotive film" onPlay={()=>setVideoPlaying(true)} onPause={()=>setVideoPlaying(false)} onError={() => setVideoFailed(true)}/><div className="hs-film-overlay"/></div>
        <div className="hs-intro"><p className="hs-eyebrow">YOUR NEXT CHAPTER STARTS HERE</p><h1>Thimadu<span>Auto Traders</span></h1><p>Find the vehicle that moves you.<br/>Buying, selling and sourcing.<br/>A more personal journey, across Sri Lanka.</p><Link to="/all-vehicles.html" className="hs-opening-link">Explore our vehicles <Icon name="arrow" size={18}/></Link></div>
        <a className="hs-scroll-link" href="#your-journey" onClick={explorePhone}>Scroll to discover <span><Icon name="arrow" size={18}/></span></a>
        {!videoFailed && <button className="hs-video-control" type="button" onClick={() => {if(reduced || navigator.connection?.saveData){const film=video.current;if(!film.src)film.src='/Videos/hero1.mp4';if(film.paused)film.play().catch(()=>{});else film.pause();}else setPaused(value=>!value);}} aria-label={videoPlaying ? 'Pause hero video' : 'Play hero video'}><Icon name={videoPlaying ? 'pause':'play'} size={14}/>{videoPlaying ? 'Pause film':'Play film'}</button>}
      </div>
      <div className="hs-showcase" id="your-journey" ref={showcase}>
        <div className="hs-copy"><h2>Your next vehicle.<br/>Your next adventure.<br/>Find it. Feel it.<br/><span>Make it yours.</span></h2><p>Explore our collection, tell us what you’re looking for, and connect with a team that understands your next move.</p><Button to="/all-vehicles.html">Find my next vehicle <Icon name="arrow"/></Button><div className="hs-preview-control"><button type="button" onClick={()=>setPaused(value=>!value)} aria-pressed={paused} aria-label={paused?'Play phone website demo':'Pause phone website demo'}><Icon name={paused?'play':'pause'} size={13}/>{paused ? 'Play the website preview':'Website preview playing'}</button></div></div>
        <div className="hs-phone-stage"><div className="hs-phone-scene"><PhonePreview auto paused={paused || reduced} onViewChange={setView}/></div><div className="hs-phone-notice hs-notice-one"><span className="hs-notice-icon"><Icon name="car" size={18}/></span><div><strong>Your mobile showroom</strong><small>Explore wherever you are</small></div><i/></div><div className="hs-phone-notice hs-notice-two"><span className="hs-notice-icon"><Icon name={journeys[view].icon} size={18}/></span><div><strong>{journeys[view].title}</strong><small>A simpler next step</small><span className="hs-demo-progress" key={view}><i/></span></div></div><div className="hs-phone-notice hs-notice-three"><span className="hs-notice-icon"><Icon name="chat" size={18}/></span><div><strong>Real people. Real guidance.</strong><small>One conversation away</small></div></div></div>
        <BrandRail/>
      </div>
    </div>
  </section>;
}

const benefits = [['A car that fits your life','car'],['Details made clearer','shield'],['A more personal search','search'],['Room for your next chapter','key'],['A real conversation','chat'],['Your next adventure','pin']];
export function ConfidenceGauge() {
  const section = useRef(null);
  useEffect(() => {
    let frame=0;
    const update=()=>{frame=0;const node=section.current;if(!node)return;const box=node.getBoundingClientRect();node.style.setProperty('--gauge-progress',clamp((innerHeight-box.top)/(innerHeight+box.height)));};
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};update();window.addEventListener('scroll',schedule,{passive:true});return()=>{cancelAnimationFrame(frame);window.removeEventListener('scroll',schedule);};
  },[]);
  return <section ref={section} className="confidence-gauge" aria-labelledby="confidence-heading"><h2 id="confidence-heading">More possibilities.<br/><span>Less second-guessing.</span></h2><div className="cg-benefit-window"><div className="cg-benefit-track">{[0,1].map(copy=><div className="cg-benefit-group" key={copy} aria-hidden={copy===1?true:undefined}>{benefits.map(([title,icon])=><div className="cg-benefit" key={title}><h3>{title}</h3><Icon name={icon} size={31}/></div>)}</div>)}</div></div><div className="cg-gauge"><svg viewBox="0 0 860 450" fill="none" aria-hidden="true">{Array.from({length:41},(_,index)=>{const angle=(180+index*4.5)*Math.PI/180;const inside=index%5===0?348:370;return <line key={index} x1={430+Math.cos(angle)*inside} y1={430+Math.sin(angle)*inside} x2={430+Math.cos(angle)*395} y2={430+Math.sin(angle)*395} stroke="currentColor" strokeWidth={index%5===0?2.3:1.7}/>;})}<g className="cg-needle"><path d="M422 420 430 155 438 420Z" fill="currentColor"/><circle cx="430" cy="430" r="15" fill="currentColor"/></g></svg><div className="cg-gauge-copy"><h3>A little guidance.<br/>A lot more confidence.</h3><p>Every next move starts with understanding<br/>what matters to you.</p></div></div><a className="cg-discover" href="#how-it-works">Discover how it works <span><Icon name="arrow" size={18}/></span></a></section>;
}
