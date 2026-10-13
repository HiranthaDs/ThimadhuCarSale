import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Icon, Reveal } from '../components';
import { useMediaQuery, useMotionPreference } from '../useMotionPreference';
import './experience-sections.css';

const WHATSAPP = 'https://wa.me/94771813928';
const messageLink = (message) => `${WHATSAPP}?text=${encodeURIComponent(message)}`;

function storyPicture(story) {
  const value = story?.thumbnailUrl || story?.imageUrl || '';
  if (!value) return '';
  try {
    const url = new URL(value);
    if (['drive.google.com', 'docs.google.com'].includes(url.hostname)) {
      const id = url.pathname.match(/\/d\/([\w-]+)/)?.[1] || url.searchParams.get('id');
      if (id) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w500`;
    }
    return value;
  } catch { return ''; }
}

function featuredStories(records, limit = 6) {
  const sorted = [...records].sort((a, b) => a.order - b.order || String(b.postedDate || '').localeCompare(String(a.postedDate || '')));
  const buckets = {
    photo: sorted.filter(story => story.kind === 'photo'),
    video: sorted.filter(story => story.kind === 'video'),
  };
  const firstKind = sorted[0]?.kind === 'video' ? 'video' : 'photo';
  const order = firstKind === 'video' ? ['video', 'photo'] : ['photo', 'video'];
  const mixed = [];
  while (mixed.length < limit && (buckets.photo.length || buckets.video.length)) {
    order.forEach(kind => {
      if (mixed.length < limit && buckets[kind].length) mixed.push(buckets[kind].shift());
    });
  }
  return mixed;
}

export function CustomerStories() {
  const { motionDisabled } = useMotionPreference();
  const section = useRef(null);
  const dragStart = useRef(null);
  const [stories, setStories] = useState([]);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState('loading');
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [paused, setPaused] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const controller = new AbortController();
    let started = false;
    const load = () => {
      if (started) return;
      started = true;
      import('../pages/ReviewsPage').then(({ loadStories }) => loadStories(controller.signal)).then((records) => {
        if (!controller.signal.aborted) {
          setStories(featuredStories(records));
          setStatus('ready');
        }
      }).catch(() => { if (!controller.signal.aborted) setStatus('unavailable'); });
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { load(); observer.disconnect(); }
    }, { rootMargin: '500px' });
    if (section.current) observer.observe(section.current);
    return () => { controller.abort(); observer.disconnect(); };
  }, []);
  useEffect(() => {
    if (motionDisabled) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .2 });
    observer.observe(section.current);
    return () => observer.disconnect();
  }, [motionDisabled]);
  useEffect(() => {
    if (motionDisabled || paused || hovered || !visible || stories.length < 1) return;
    const timer = setInterval(() => { if (!document.hidden) setActive(previous => (previous + 1) % (stories.length + 1)); }, 4500);
    return () => clearInterval(timer);
  }, [paused, hovered, visible, stories.length, motionDisabled]);
  useEffect(() => { if (active > stories.length) setActive(0); }, [active, stories.length]);
  const story = active === 0 ? null : stories[active - 1];
  const portrait = storyPicture(story);
  const slideCount = stories.length + 1;
  const changeStory = (direction) => { if (slideCount < 2) return; setPaused(true); setActive(previous => (previous + direction + slideCount) % slideCount); };

  return <section ref={section} className="ex-stories" aria-labelledby="ex-stories-title">
    <div className="ex-stories-inner">
      <Reveal className="ex-stories-intro">
        <span className="ex-kicker">THE PEOPLE BEHIND THE JOURNEYS</span>
        <h2 id="ex-stories-title">Good cars.<br />Even better <span className="ex-underlined">stories.</span></h2>
        <p>New keys. New beginnings.<br />There is a person behind every journey.</p>
        <p>Discover the deliveries and moments shared by the Thimadu community.</p>
        <Link className="ex-inline-link" to="/reviews.html">Meet our customers <Icon name="arrow" size={18} /></Link>
      </Reveal>
      <Reveal className="ex-stories-stage" delay={100} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setPaused(true)}>
        <div className="ex-story-stack" aria-live={motionDisabled || paused || hovered ? 'polite' : 'off'} aria-atomic="true" onPointerDown={event => { if (event.target.closest('a,button') || slideCount < 2) return; dragStart.current = event.clientX; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerUp={event => { if (dragStart.current === null) return; const distance = event.clientX - dragStart.current; dragStart.current = null; if (Math.abs(distance) > event.currentTarget.offsetWidth * .18) changeStory(distance > 0 ? -1 : 1); }} onPointerCancel={() => { dragStart.current = null; }}>
          <div className="ex-story-layer ex-story-layer-back" aria-hidden="true"><span /><span /><span /></div>
          <div className="ex-story-layer ex-story-layer-mid" aria-hidden="true"><span /><span /><span /></div>
          <article key={story?.key || 'welcome'} className={`ex-story-card ${!story ? 'ex-story-card-welcome' : ''}`}>
            {story ? <>
              <div className="ex-story-topline"><span>From our community</span><Icon name={story.kind === 'video' ? 'play' : 'chat'} size={23} /></div>
              <h3>{story.title}</h3>
              {story.description && <p className="ex-story-description">{story.description}</p>}
              <div className="ex-story-person">
                {portrait ? <img src={portrait} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.hidden = true; }} /> : <span className="ex-story-person-icon"><Icon name="car" /></span>}
                <div><strong>{story.customerName || 'A Thimadu customer story'}</strong>{story.location && <small>{story.location}</small>}</div>
                <Link to="/reviews.html" aria-label={`Explore customer stories including ${story.title}`}><Icon name="arrow-up" /></Link>
              </div>
            </> : <>
              <span className="ex-story-mark"><Icon name="key" size={32} /></span>
              <h3>Your story<br />starts here.</h3>
              <p>A first car. A family upgrade. Something you have always wanted. Let’s talk about your next chapter.</p>
              <Link className="ex-inline-link" to="/all-vehicles.html">Find your next vehicle <Icon name="arrow" size={18} /></Link>
            </>}
          </article>
        </div>
        <div className="ex-story-controls">
          <button type="button" onClick={() => changeStory(-1)} disabled={slideCount < 2} aria-label="Previous customer story"><Icon className="ex-arrow-back" name="arrow" /></button>
          <span className="ex-story-count">{stories.length ? `${String(active + 1).padStart(2, '0')} / ${String(slideCount).padStart(2, '0')}` : status === 'loading' ? 'Discover the community' : 'Your next chapter'}</span>
          <button type="button" onClick={() => changeStory(1)} disabled={slideCount < 2} aria-label="Next customer story"><Icon name="arrow" /></button>
          {!motionDisabled && stories.length > 0 && <button type="button" className="ex-story-motion" onClick={() => setPaused(previous => !previous)} aria-label={paused ? 'Play customer stories' : 'Pause customer stories'} aria-pressed={paused}>{paused ? <Icon name="play" size={14}/> : <span aria-hidden="true">Ⅱ</span>}</button>}
        </div>
        {stories.some(storyPicture) && <div className="ex-portrait-rail" aria-label="Choose a customer story">{stories.map((item, index) => storyPicture(item) && <button type="button" key={item.key} onClick={() => { setActive(index + 1); setPaused(true); }} aria-label={`Show ${item.title}`} aria-pressed={index + 1 === active}><img src={storyPicture(item)} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.hidden = true; }} /></button>)}</div>}
      </Reveal>
    </div>
  </section>;
}

function useScrollProgress(ref, property = '--ex-progress') {
  const { motionDisabled } = useMotionPreference();
  const desktop = useMediaQuery('(min-width: 901px)');
  useEffect(() => {
    const section = ref.current;
    if (!section) return;
    if (motionDisabled || !desktop) { section.style.setProperty(property, '1'); return; }
    let frame = 0;
    const update = () => {
      frame = 0;
      const box = section.getBoundingClientRect();
      const travel = property === '--ex-progress' ? Math.max(1, box.height - innerHeight) : Math.max(1, innerHeight * .8);
      const progress = property === '--ex-progress' ? -box.top / travel : (innerHeight - box.top) / travel;
      section.style.setProperty(property, Math.min(1, Math.max(0, progress)).toFixed(4));
    };
    const requestUpdate = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
    };
  }, [ref, property, motionDisabled, desktop]);
}

export function ConversationJourney() {
  const { motionDisabled } = useMotionPreference();
  const section = useRef(null);
  useScrollProgress(section);
  const revealPanel = (event) => {
    if (!matchMedia('(min-width: 901px)').matches || motionDisabled) return;
    const panel = event.target.closest('[data-ex-panel]');
    if (!panel) return;
    const node = section.current;
    const progress = Number(panel.dataset.exPanel);
    window.scrollTo({ top: window.scrollY + node.getBoundingClientRect().top + (node.offsetHeight - innerHeight) * progress, behavior: 'instant' });
  };
  return <section ref={section} className="ex-conversation" aria-label="A little guidance for the road ahead" onFocusCapture={revealPanel}>
    <div className="ex-conversation-sticky">
      <div className="ex-conversation-track">
        <article className="ex-conversation-panel" data-ex-panel="0">
          <img className="ex-conversation-photo" src="/images/coastal-journey.webp" alt="A white SUV and two travelers at a quiet tropical coastal viewpoint" width="1672" height="941" loading="lazy" decoding="async" />
          <div className="ex-conversation-overlay" />
          <div className="ex-messages" aria-label="An example of how a conversation could start">
            <span className="ex-conversation-label">A CONVERSATION COULD START LIKE THIS</span>
            <div className="ex-message ex-message-customer" style={{ '--ex-message-order': 0 }}><p>Our family is growing.<br />Time for a little more space.</p><span className="ex-message-avatar"><Icon name="car" size={17} /></span></div>
            <div className="ex-message ex-message-team" style={{ '--ex-message-order': 1 }}><span className="ex-message-avatar">T.</span><p>Let’s find a car that fits your life.<br />What do you have in mind?</p></div>
          </div>
          <div className="ex-conversation-caption"><div><span>01 / MADE FOR YOUR EVERYDAY. AND YOUR GETAWAYS.</span><h2>Room for life.<br />Space for possibility.</h2></div><Button href={messageLink('Hi Thimadu, I would like help finding a vehicle that fits my needs.')} variant="white">Start a conversation <Icon name="arrow-up" /></Button></div>
        </article>
        <article className="ex-conversation-panel ex-conversation-panel-second" data-ex-panel="1">
          <img className="ex-conversation-photo" src="/images/journey.webp" alt="The carefully crafted details of a refined vehicle interior" width="1536" height="1024" loading="lazy" decoding="async" />
          <div className="ex-conversation-overlay" />
          <div className="ex-conversation-note"><span className="ex-message-avatar">T.</span><p>You ask the questions.<br /><strong>We help with the next step.</strong></p><Icon name="check" size={20} /></div>
          <div className="ex-conversation-caption"><div><span>02 / FEEL MORE CONFIDENT</span><h2>Less wondering.<br />More looking forward.</h2></div><Button to="/vehicle-information-support.html" variant="white">Get vehicle guidance <Icon name="arrow-up" /></Button></div>
        </article>
      </div>
      <div className="ex-conversation-progress" aria-hidden="true"><span /></div>
    </div>
  </section>;
}

const guides = [
  { number: '01', title: 'The right car starts with the right questions.', tag: 'VEHICLE GUIDANCE', href: '/vehicle-information-support.html', image: '/images/journey.webp', alt: 'A closer look inside a vehicle' },
  { number: '02', title: 'A fresh start for you. A new chapter for your car.', tag: 'SELL YOUR VEHICLE', href: '/sell-your-vehicle-sri-lanka.html', image: '/images/hero.webp', alt: 'A white car ready for the road ahead' },
  { number: '03', title: 'Your wish list. Let’s make it a conversation.', tag: 'VEHICLE SOURCING', href: '/vehicle-sourcing-sri-lanka.html', image: '/images/coastal-journey.webp', alt: 'A white SUV at a coastal viewpoint' },
];

export function GuidesSection() {
  const [active, setActive] = useState(0);
  return <section className="ex-guides" aria-labelledby="ex-guides-title">
    <div className="ex-guides-heading"><Reveal><span className="ex-kicker">A LITTLE CLARITY GOES A LONG WAY</span><h2 id="ex-guides-title">Good to know.<br /><span>Great to move forward.</span></h2></Reveal><Link className="ex-inline-link" to="/services.html">Explore our services <Icon name="arrow" /></Link></div>
    <div className="ex-guide-cards" onMouseLeave={() => setActive(0)}>
      {guides.map((guide, index) => <Link key={guide.number} to={guide.href} className={`ex-guide-card ${active === index ? 'is-active' : ''}`} onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)}>
        <div className="ex-guide-top"><span>{guide.number} / THE ROAD AHEAD</span><Icon name="arrow-up" size={24} /></div>
        <h3>{guide.title}</h3>
        <span className="ex-guide-tag">{guide.tag}</span>
        <div className="ex-guide-picture"><img src={guide.image} alt={guide.alt} width="400" height="400" loading="lazy" decoding="async" /></div>
        <span className="ex-guide-open"><Icon name="arrow" size={22} /></span>
      </Link>)}
    </div>
  </section>;
}

export function FinaleSection() {
  const section = useRef(null);
  useScrollProgress(section, '--ex-finale-progress');
  return <section ref={section} className="ex-finale" aria-labelledby="ex-finale-title">
    <div className="ex-finale-card">
      <div className="ex-finale-glow" aria-hidden="true" />
      <Reveal className="ex-finale-copy"><span className="ex-kicker">THE ROAD AHEAD IS YOURS</span><h2 id="ex-finale-title">Your next<br />move.<br /><span>Make it yours.</span></h2><p>New keys. A new beginning.<br />Let’s find your next chapter.</p><Button to="/all-vehicles.html" variant="white">Find your next vehicle <Icon name="arrow-up" /></Button><a className="ex-finale-talk" href={WHATSAPP}>Or, start with a conversation <Icon name="arrow" size={18} /></a></Reveal>
      <div className="ex-finale-dial" aria-hidden="true">
        <svg viewBox="0 0 500 500" fill="none">
          <defs><linearGradient id="ex-dial-gradient" x1="80" y1="380" x2="420" y2="100" gradientUnits="userSpaceOnUse"><stop stopColor="#fff" /><stop offset=".5" stopColor="#b9d8ff" /><stop offset="1" stopColor="#76b8ff" /></linearGradient></defs>
          <circle cx="250" cy="250" r="248" fill="#ffffff" fillOpacity=".09" stroke="#ffffff" strokeOpacity=".24" />
          <circle cx="250" cy="250" r="222" fill="#ffffff" fillOpacity=".045" />
          <path d="M148 426 A204 204 0 1 1 352 426" stroke="#ffffff" strokeOpacity=".17" strokeWidth="23" strokeLinecap="round" />
          <path className="ex-dial-arc" d="M148 426 A204 204 0 1 1 352 426" stroke="url(#ex-dial-gradient)" strokeWidth="23" strokeLinecap="round" pathLength="100" />
          {Array.from({ length: 49 }, (_, index) => {
            const angle = (150 + index * 5) * Math.PI / 180;
            const radius = index % 4 === 0 ? 159 : 170;
            return <line key={index} x1={250 + Math.cos(angle) * radius} y1={250 + Math.sin(angle) * radius} x2={250 + Math.cos(angle) * 181} y2={250 + Math.sin(angle) * 181} stroke="white" strokeOpacity={index % 4 === 0 ? '.75' : '.35'} strokeWidth={index % 4 === 0 ? 2 : 1.2} />;
          })}
          <g className="ex-dial-needle"><path d="M245 250 250 113 255 250Z" fill="white" fillOpacity=".82" /><circle cx="250" cy="250" r="9" fill="white" /></g>
          <circle cx="148" cy="426" r="13" fill="white" />
        </svg>
        <div className="ex-dial-copy"><span>YOUR NEXT</span><strong>chapter.</strong><span>STARTS WITH YOU</span></div>
        <span className="ex-dial-bottom">READY WHEN YOU ARE <Icon name="arrow-up" size={17} /></span>
      </div>
    </div>
  </section>;
}
