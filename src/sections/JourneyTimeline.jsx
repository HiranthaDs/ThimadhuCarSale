import { useEffect, useRef, useState } from 'react';
import { Button, Icon } from '../components';
import { PhonePreview } from './HeroStory';
import { useMotionPreference } from '../useMotionPreference';
import './journey-timeline.css';

const journeys = [
  {
    id: 'buy', label: 'Find your vehicle', icon: 'car', phoneTitle: 'Find your next vehicle.', phoneNote: 'A new chapter starts here.',
    steps: [
      { title: 'A vehicle that feels like you.', text: 'Start with what matters to you. Explore our current listings by make, budget, and body type, and find a vehicle that fits your everyday life.', action: 'Explore our vehicles', to: '/all-vehicles.html', phone: 'Explore the collection', detail: 'Make · Model · Budget', icon: 'search' },
      { title: 'Get to know every detail.', text: 'Look through the photographs and listed specifications. Ask our team about availability, condition, and anything else you want to understand before arranging a visit.', action: 'Ask our team', href: 'https://wa.me/94771813928?text=Hi%20Thimadu%2C%20I%20would%20like%20more%20information%20about%20a%20vehicle.', phone: 'Look a little closer', detail: 'Photos · Specifications · Questions', icon: 'car' },
      { title: 'See it. Feel it. Decide.', text: 'Speak with us to arrange a viewing. Take the time to see the vehicle in person and discuss the checks and information you need to make your decision.', action: 'Arrange a viewing', href: 'https://wa.me/94771813928?text=Hi%20Thimadu%2C%20I%20would%20like%20to%20arrange%20a%20vehicle%20viewing.', phone: 'Let’s arrange a viewing', detail: 'A conversation, then a visit.', icon: 'pin' },
      { title: 'Your next chapter starts here.', text: 'Once you have found the right vehicle, confirm the price, documents, and handover arrangements with our team. We will help you understand what comes next.', action: 'Talk about the next steps', to: '/vehicle-information-support.html', phone: 'Ready for the next chapter', detail: 'Documents · Details · Handover', icon: 'key' },
    ],
  },
  {
    id: 'sell', label: 'Sell your vehicle', icon: 'key', phoneTitle: 'Make room for what’s next.', phoneNote: 'Your next move, made clearer.',
    steps: [
      { title: 'Tell us about your vehicle.', text: 'Share the make, model, year, mileage, location, and your expected price. A few useful details help us start the right conversation.', action: 'Start selling your vehicle', to: '/sell-your-vehicle-sri-lanka.html', phone: 'Introduce your vehicle', detail: 'Make · Year · Mileage', icon: 'car' },
      { title: 'Let the details do the talking.', text: 'Gather clear, recent photographs of the exterior and interior. Tell us about the condition, service history, and any details a future owner should know.', action: 'Prepare your vehicle details', to: '/sell-your-vehicle-sri-lanka.html', phone: 'Show its best side', detail: 'Recent photos · Honest details', icon: 'plus' },
      { title: 'A real conversation. A clear plan.', text: 'Our team will review the information you share and discuss the available options. Confirm any terms, appointments, and next steps directly with us.', action: 'Speak with our team', href: 'https://wa.me/94771813928?text=Hi%20Thimadu%2C%20I%20would%20like%20to%20discuss%20selling%20my%20vehicle.', phone: 'Let’s talk it through', detail: 'Your questions. Personal guidance.', icon: 'chat' },
      { title: 'Move forward with confidence.', text: 'Before going ahead, make sure you understand the agreed price, required documents, and handover process. We are here to help with the practical questions.', action: 'Get vehicle support', to: '/vehicle-information-support.html', phone: 'Plan your next move', detail: 'Price · Documents · Next steps', icon: 'check' },
    ],
  },
  {
    id: 'source', label: 'Find something specific', icon: 'search', phoneTitle: 'Your wish list. Our starting point.', phoneNote: 'Let’s find your kind of vehicle.',
    steps: [
      { title: 'Some things are worth looking for.', text: 'Already have a vehicle in mind? Tell us the make, model, preferred year, and budget. Share the features you need and the things you can be flexible about.', action: 'Tell us what you are looking for', to: '/vehicle-sourcing-sri-lanka.html', phone: 'Describe your ideal vehicle', detail: 'Make · Model · Must-haves', icon: 'search' },
      { title: 'Make the brief your own.', text: 'From the right size for your family to the transmission you prefer, the details matter. We will discuss your requirements and clarify the search with you.', action: 'Share your requirements', to: '/vehicle-sourcing-sri-lanka.html', phone: 'The details that matter', detail: 'Budget · Preferences · Timing', icon: 'filter' },
      { title: 'Explore the possibilities together.', text: 'Speak with our team about suitable options and current availability. Take a closer look at any suggested vehicle and ask for the information you need.', action: 'Discuss available options', href: 'https://wa.me/94771813928?text=Hi%20Thimadu%2C%20I%20am%20looking%20for%20a%20specific%20vehicle.', phone: 'Let’s explore the options', detail: 'A personal conversation with our team.', icon: 'chat' },
      { title: 'Find the fit. Take the next step.', text: 'When an option interests you, discuss the viewing, vehicle checks, and documents before committing. The final choice should feel right for you.', action: 'Start your vehicle search', to: '/vehicle-sourcing-sri-lanka.html', phone: 'A step closer to your next vehicle', detail: 'View · Ask · Decide', icon: 'key' },
    ],
  },
  {
    id: 'support', label: 'Vehicle support', icon: 'chat', phoneTitle: 'A little clarity goes a long way.', phoneNote: 'Real people. Useful conversations.',
    steps: [
      { title: 'Every good decision starts with a question.', text: 'Buying, selling, or comparing your options? Tell us what you would like to understand about a vehicle, listing, or the next step in your journey.', action: 'Get vehicle information', to: '/vehicle-information-support.html', phone: 'What would you like to know?', detail: 'Buying · Selling · Vehicle details', icon: 'chat' },
      { title: 'Bring the useful details.', text: 'Send us the listing or the vehicle make, model, and year, together with your question. A little context helps us give you a more useful answer.', action: 'Share your question', href: 'https://wa.me/94771813928?text=Hi%20Thimadu%2C%20I%20have%20a%20vehicle%20information%20question.', phone: 'Start with a little context', detail: 'Vehicle · Listing · Your question', icon: 'car' },
      { title: 'Talk to someone who listens.', text: 'Our team can explain listing details and discuss practical buying or selling questions. Where information needs checking, we will talk through that with you.', action: 'Talk to Thimadu', href: 'https://wa.me/94771813928', phone: 'A real team, here to help', detail: 'Clear information. Personal guidance.', icon: 'phone' },
      { title: 'Know where to go from here.', text: 'Leave the conversation with a clearer picture of your options. Explore a listing, plan a viewing, or find out which documents and details to confirm next.', action: 'Explore our services', to: '/services.html', phone: 'Your next step, a little clearer', detail: 'Information for the road ahead.', icon: 'arrow-up' },
    ],
  },
];

export default function JourneyTimeline() {
  const { mobile, motionDisabled } = useMotionPreference();
  const [selected, setSelected] = useState(0);
  const buttonRefs = useRef([]);
  const panelRef = useRef(null);
  const journey = journeys[selected];
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || motionDisabled || !('IntersectionObserver' in window)) return;
    const chapters = [...panel.querySelectorAll('.jt-chapter')];
    const settleTimers = [];
    let animationFrame = 0;
    panel.classList.add('jt-motion-ready');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        settleTimers.push(window.setTimeout(() => entry.target.classList.add('is-settled'), 1100));
        observer.unobserve(entry.target);
      });
    }, { threshold: .16, rootMargin: '0px 0px -8% 0px' });
    chapters.forEach(chapter => observer.observe(chapter));
    const updateCardPositions = () => {
      animationFrame = 0;
      const viewportHeight = window.innerHeight;
      chapters.forEach(chapter => {
        const bounds = chapter.getBoundingClientRect();
        if (bounds.bottom < -100 || bounds.top > viewportHeight + 100) return;
        const travel = (bounds.top + bounds.height / 2 - viewportHeight / 2) / ((viewportHeight + bounds.height) / 2);
        const progress = Math.max(-1, Math.min(1, travel));
        chapter.style.setProperty('--jt-visual-y', `${(progress * 38).toFixed(2)}px`);
        chapter.style.setProperty('--jt-copy-y', `${(progress * -27).toFixed(2)}px`);
      });
    };
    const requestCardUpdate = () => {
      if (!animationFrame) animationFrame = requestAnimationFrame(updateCardPositions);
    };
    window.addEventListener('scroll', requestCardUpdate, { passive: true });
    window.addEventListener('resize', requestCardUpdate);
    updateCardPositions();
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', requestCardUpdate);
      window.removeEventListener('resize', requestCardUpdate);
      if (animationFrame) cancelAnimationFrame(animationFrame);
      settleTimers.forEach(timer => clearTimeout(timer));
      panel.classList.remove('jt-motion-ready');
      chapters.forEach(chapter => {
        chapter.classList.remove('is-visible', 'is-settled');
        chapter.style.removeProperty('--jt-visual-y');
        chapter.style.removeProperty('--jt-copy-y');
      });
    };
  }, [selected, motionDisabled, mobile]);
  function selectJourney(index) { setSelected(index); }
  function handleTabKey(event, index) {
    const next = event.key === 'ArrowRight' ? (index + 1) % journeys.length : event.key === 'ArrowLeft' ? (index + journeys.length - 1) % journeys.length : event.key === 'Home' ? 0 : event.key === 'End' ? journeys.length - 1 : undefined;
    if (next === undefined) return;
    event.preventDefault(); selectJourney(next); buttonRefs.current[next]?.focus({ preventScroll: true });
  }
  if (mobile) return <section className="jt-section jt-mobile" id="how-it-works" aria-labelledby="jt-heading">
    <div className="container jt-container">
      <div className="jt-heading"><span className="jt-eyebrow">AT YOUR SERVICE</span><h2 id="jt-heading">Every move.<br/><span>Thoughtfully handled.</span></h2><p>Buy, sell or find something specific.<br/>A clear next step, with a real person to help.</p></div>
      <div className="jt-mobile-services">
        {[
          { id:'buy', icon:'car', title:'Find your next vehicle', text:'Browse available vehicles, compare the details and arrange a viewing.', action:'Explore vehicles', to:'/all-vehicles.html' },
          { id:'sell', icon:'key', title:'Sell your vehicle', text:'Share your vehicle details and speak with us about the next steps.', action:'Start selling', to:'/sell-your-vehicle-sri-lanka.html' },
          { id:'source', icon:'search', title:'Find your perfect fit', text:'Tell us your preferred make, model and budget. We will help with your search.', action:'Tell us your wish list', to:'/vehicle-sourcing-sri-lanka.html' },
        ].map(service => <article className="jt-mobile-service" key={service.id}><span className="jt-mobile-icon"><Icon name={service.icon} size={23}/></span><div><h3>{service.title}</h3><p>{service.text}</p><Button to={service.to}>{service.action}<Icon name="arrow" size={17}/></Button></div></article>)}
      </div>
      <div className="jt-mobile-help"><Icon name="chat" size={19}/><p>Have a question? <a href="https://wa.me/94771813928">Talk to our team <Icon name="arrow" size={14}/></a></p></div>
    </div>
  </section>;
  return <section className="jt-section" id="how-it-works" aria-labelledby="jt-heading">
    <div className="container jt-container">
      <div className="jt-heading"><div><span className="jt-eyebrow">AT YOUR SERVICE</span><h2 id="jt-heading">Every move.<br/><span>Thoughtfully handled.</span></h2></div><p>Buying. Selling. Finding the one.<br/>Choose your journey. We’ll help you<br className="jt-desktop-break"/> understand what comes next.</p></div>
      <div className="jt-tabs-wrap">
        <div className="jt-tabs" role="tablist" aria-label="Choose your vehicle journey">{journeys.map((item, index) => <button key={item.id} ref={node => { buttonRefs.current[index] = node; }} type="button" role="tab" id={`jt-tab-${item.id}`} aria-selected={selected === index} aria-controls="jt-panel" tabIndex={selected === index ? 0 : -1} onClick={() => selectJourney(index)} onKeyDown={event => handleTabKey(event, index)}><Icon name={item.icon} size={18}/><span>{item.label}</span><span className="jt-tab-index" aria-hidden="true">0{index + 1}</span></button>)}</div>
        <label className="jt-mobile-selector"><span className="sr-only">Choose your vehicle journey</span><select value={selected} onChange={event => selectJourney(Number(event.target.value))}>{journeys.map((item,index) => <option key={item.id} value={index}>{item.label}</option>)}</select><Icon name="chevron" size={18}/></label>
      </div>
      <div className="jt-panel" id="jt-panel" ref={panelRef} key={journey.id} role="tabpanel" aria-labelledby={`jt-tab-${journey.id}`} tabIndex={0}>
        <ol className="jt-chapters">{journey.steps.map((step,index) => <li className={`jt-step-row jt-chapter jt-chapter-${index}`} key={`${journey.id}-${index}`}>
          <div className="jt-chapter-visual"><div className="jt-visual-ring" aria-hidden="true"/><span className="jt-visual-label">THIMADU / 0{index + 1}</span><div className="jt-chapter-phone"><PhonePreview compact mode={index === 0 ? journey.id : ['buy','source','support','sell'][index]}/></div><div className="jt-proof jt-proof-first"><Icon name={step.icon} size={18}/>{step.phone}</div><div className="jt-proof jt-proof-second"><Icon name="check" size={17}/>{step.detail}</div></div>
          <div className="jt-chapter-copy"><span className="jt-chapter-tag">{journey.label} <small>0{index + 1} / 04</small></span><h3>{step.title}</h3><p>{step.text}</p><Button to={step.to} href={step.href} className="jt-step-cta">{step.action}<Icon name="arrow" size={19}/></Button></div>
        </li>)}</ol>
      </div>
      <div className="jt-end-note"><span/><p>Different journeys. The same personal approach.</p><span>THIMADU / SRI LANKA</span></div>
    </div>
  </section>;
}
