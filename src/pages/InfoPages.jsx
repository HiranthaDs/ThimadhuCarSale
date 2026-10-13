import { Link, useSearchParams } from 'react-router-dom';
import { Icon, Button, PageHero, Reveal, ContactBanner } from '../components';
import { useSeo } from '../seo';
import './info.css';

const services = [
  { no: '01', icon: 'car', title: 'Find your next vehicle.', description: 'A new chapter starts with the right car. Explore our current collection, compare the details, and get to know the exact vehicle.', to: '/all-vehicles.html', label: 'Explore vehicles', tag: 'BUY A VEHICLE' },
  { no: '02', icon: 'key', title: 'Ready for something new?', description: 'Let’s talk about selling your current vehicle. Share the details, a few current photographs, and what you have in mind.', to: '/sell-your-vehicle-sri-lanka.html', label: 'Sell your vehicle', tag: 'SELL YOUR VEHICLE' },
  { no: '03', icon: 'search', title: 'Your wish list. Our next conversation.', description: 'Have a particular model in mind? Tell us what you are looking for, your budget, and the features that matter to you.', to: '/vehicle-sourcing-sri-lanka.html', label: 'Find a specific vehicle', tag: 'VEHICLE SOURCING' },
  { no: '04', icon: 'chat', title: 'A little more clarity.', description: 'From equipment and condition to available supporting records, ask the questions that help you take the next step.', to: '/vehicle-information-support.html', label: 'Ask about a vehicle', tag: 'VEHICLE SUPPORT' },
];

const serviceData = {
  sell: {
    eyebrow: 'SELL YOUR VEHICLE',
    title: <>The next chapter<br />starts <em>with you.</em></>,
    description: 'Thinking of selling your vehicle? Tell us a little about it, and let’s start a useful conversation.',
    seoTitle: 'Sell Your Vehicle in Sri Lanka | Thimadu Auto Traders',
    seoDescription: 'Start a vehicle selling enquiry with Thimadu Auto Traders in Sri Lanka. Share your make, model, year, mileage, condition and location on WhatsApp.',
    formTitle: 'Tell us about your vehicle.',
    formDescription: 'A few details help us understand what you have. You can add your vehicle photographs in WhatsApp.',
    message: 'Hi Thimadu, I would like to discuss selling my vehicle.',
    processTitle: <>Your vehicle.<br />A clear <em>next step.</em></>,
    process: [
      ['Share the essentials', 'Start with the make, model, year and current mileage. Include the grade, fuel and transmission if you know them.'],
      ['Show the full picture', 'Send clear, current exterior and interior photos on WhatsApp. Mention condition details, known repairs and any important notes.'],
      ['Let’s talk it through', 'Share your location and expected price. The team can then discuss the information and next steps for your particular vehicle.'],
    ],
    fields: [
      { name: 'name', label: 'Your name', placeholder: 'Full name', autoComplete: 'name', required: true },
      { name: 'location', label: 'Vehicle location', placeholder: 'City or area', autoComplete: 'address-level2', required: true },
      { name: 'make', label: 'Make & model', placeholder: 'e.g. Toyota Aqua', required: true },
      { name: 'year', label: 'Model year', placeholder: 'e.g. 2020', type: 'number', min: 1900, max: new Date().getFullYear() + 1, required: true },
      { name: 'mileage', label: 'Mileage (km)', placeholder: 'e.g. 45000', type: 'number', min: 0, required: true },
      { name: 'price', label: 'Expected price (LKR)', placeholder: 'Optional', type: 'number', min: 0 },
      { name: 'notes', label: 'Condition & anything else', placeholder: 'Tell us about the condition, grade, transmission or anything we should know.', textarea: true, required: true },
    ],
    questions: [
      ['What do I need to start?', 'Share the make, model, year, mileage, condition and vehicle location. Add your expected price if you have one, then send clear photographs in WhatsApp.'],
      ['Do I need professional photographs?', 'No. Clear, current phone photographs are useful. Include the exterior, interior and any important condition details.'],
      ['What happens after I send the details?', 'The team can discuss the next step for your vehicle. Any listing, pricing, inspection or transaction arrangements are confirmed directly with you.'],
      ['Does an enquiry guarantee a sale?', 'An enquiry starts a conversation. A sale and any commercial arrangements depend on the specific vehicle and must be agreed directly.'],
    ],
  },
  sourcing: {
    eyebrow: 'FIND YOUR SPECIFIC VEHICLE',
    title: <>Have something<br /><em>in mind?</em></>,
    description: 'A particular model. A favourite colour. Room for everyone. Tell us what your next vehicle looks like.',
    seoTitle: 'Specific Vehicle Sourcing in Sri Lanka | Thimadu Auto Traders',
    seoDescription: 'Request a specific vehicle from Thimadu Auto Traders. Share your preferred make, model, year range, budget and must-have features in Sri Lanka.',
    formTitle: 'Let’s build your wish list.',
    formDescription: 'Be as specific as you like. An approximate budget and acceptable alternatives help keep the conversation focused.',
    message: 'Hi Thimadu, I am looking for a specific vehicle.',
    processTitle: <>A clearer brief.<br /><em>Better possibilities.</em></>,
    process: [
      ['Picture your next vehicle', 'Share your preferred make and model, an acceptable year range, and any alternatives you would consider.'],
      ['Make it personal', 'Tell us your approximate budget, fuel and transmission preferences, seating needs and must-have features.'],
      ['Discuss the possibilities', 'When a potential match is identified, confirm its exact specification, current availability, price and next steps with the team.'],
    ],
    fields: [
      { name: 'name', label: 'Your name', placeholder: 'Full name', autoComplete: 'name', required: true },
      { name: 'model', label: 'Preferred make & model', placeholder: 'e.g. Honda Vezel', required: true },
      { name: 'years', label: 'Preferred year range', placeholder: 'e.g. 2020–2024', required: true },
      { name: 'budget', label: 'Approximate budget (LKR)', placeholder: 'Your budget or price range', required: true },
      { name: 'fuel', label: 'Fuel preference', options: ['No preference', 'Petrol', 'Diesel', 'Hybrid', 'Electric'] },
      { name: 'transmission', label: 'Transmission', options: ['No preference', 'Automatic', 'Manual'] },
      { name: 'notes', label: 'Your must-haves', placeholder: 'Seating, colour, grade, features or other models you would consider…', textarea: true },
    ],
    questions: [
      ['Can I request a vehicle that is not listed?', 'Yes. Share the make, model, preferred year range, approximate budget and requirements to start a specific-model conversation.'],
      ['What if I am open to different models?', 'Tell us your preferred model first and list acceptable alternatives. Include the features or requirements that are most important to you.'],
      ['Do I need to know my exact budget?', 'An approximate budget or price range is a helpful starting point. It helps the team understand which options are relevant to your request.'],
      ['Is availability guaranteed?', 'A sourcing request describes what you are looking for. The availability, specification, price and timeline of any potential match must be confirmed when an actual vehicle is identified.'],
    ],
  },
  support: {
    eyebrow: 'VEHICLE INFORMATION & SUPPORT',
    title: <>The details<br /><em>make a difference.</em></>,
    description: 'Get to know the exact vehicle. Ask about its equipment, current condition and available supporting records.',
    seoTitle: 'Vehicle Information & Document Support | Thimadu Auto Traders',
    seoDescription: 'Ask Thimadu Auto Traders about exact vehicle specifications, condition and available supporting records for listed vehicles in Sri Lanka.',
    formTitle: 'What would you like to know?',
    formDescription: 'Include the vehicle link or stock reference so we can keep your questions connected to the right vehicle.',
    message: 'Hi Thimadu, I have a question about a vehicle.',
    processTitle: <>Know the vehicle.<br /><em>Know your next step.</em></>,
    process: [
      ['Start with the exact vehicle', 'Use the stock ID or listing link. Review the photographs, year, mileage and specifications already on the vehicle page.'],
      ['Ask the questions that matter', 'Clarify equipment or condition details. Ask which inspection, auction or other supporting records are available for this exact vehicle.'],
      ['Put the information in context', 'Check the date, source and scope of available records. Confirm the current price and availability directly before moving forward.'],
    ],
    fields: [
      { name: 'name', label: 'Your name', placeholder: 'Full name', autoComplete: 'name', required: true },
      { name: 'reference', label: 'Stock ID or vehicle link', placeholder: 'Enter the reference or paste a link', required: true },
      { name: 'topic', label: 'What is your question about?', options: ['Vehicle specifications', 'Current condition', 'Supporting documents', 'Price & availability', 'Something else'], full: true },
      { name: 'notes', label: 'Your question', placeholder: 'Tell us which details you would like to confirm…', textarea: true, required: true },
    ],
    questions: [
      ['Can I ask for inspection or auction records?', 'Yes. Ask which supporting records are available for the exact stock item. The availability and scope of records vary by vehicle and source.'],
      ['Why does the stock reference matter?', 'It helps attach your questions to the exact vehicle, rather than a similar model or year. You can also share the link to its listing.'],
      ['Does every vehicle have the same documents?', 'No. Supporting material can differ by vehicle and source. The team can confirm what is available for the particular vehicle you are considering.'],
      ['Should I confirm details before a viewing?', 'Yes. Contact the vehicle desk to confirm the latest availability, price and any important vehicle-specific details before making plans.'],
    ],
  },
};

function InfoFaq({ questions }) {
  return <section className="section info-faq-section"><div className="container info-faq-grid">
    <Reveal><p className="eyebrow">A LITTLE MORE INFORMATION</p><h2 className="section-title">Good questions.<br /><em>Clear answers.</em></h2><p className="info-copy">The things you might like to know before we talk.</p></Reveal>
    <div className="info-faq-list">{questions.map(([question, answer]) => <details key={question} className="info-faq"><summary>{question}<span className="info-faq-symbol" aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>
  </div></section>;
}

function ServiceForm({ data, kind }) {
  const [params] = useSearchParams();
  function submit(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    for (const field of data.fields) {
      if (field.required && !String(values.get(field.name) || '').trim()) {
        const input = event.currentTarget.elements.namedItem(field.name);
        input.setCustomValidity('Please enter this information.');
        input.reportValidity();
        return;
      }
    }
    const lines = data.fields.map(field => {
      const value = String(values.get(field.name) || '').trim();
      return value ? `${field.label}: ${value}` : null;
    }).filter(Boolean);
    window.location.assign(`https://wa.me/94771813928?text=${encodeURIComponent(`${data.message}\n\n${lines.join('\n')}`)}`);
  }

  return <form className="service-form" onSubmit={submit} onInput={event => event.target.setCustomValidity?.('')} aria-labelledby="service-form-title">
    <span className="service-form-icon"><Icon name={kind === 'sell' ? 'key' : kind === 'sourcing' ? 'search' : 'chat'} /></span>
    <h2 id="service-form-title">{data.formTitle}</h2><p className="service-form-intro">{data.formDescription}</p>
    <div className="service-fields">{data.fields.map(({ label, options, textarea, full, ...field }) => <div className={`service-field${textarea || full ? ' service-field-full' : ''}`} key={field.name}>
      <label htmlFor={`${kind}-${field.name}`}>{label}{field.required ? <span aria-hidden="true"> *</span> : <span className="service-field-optional"> · optional</span>}</label>
      {textarea ? <textarea {...field} id={`${kind}-${field.name}`} rows="4" maxLength="2000" /> : options ? <select {...field} id={`${kind}-${field.name}`}>{options.map(option => <option key={option} value={option}>{option}</option>)}</select> : <input {...field} id={`${kind}-${field.name}`} defaultValue={kind === 'support' && field.name === 'reference' ? params.get('reference') || '' : undefined} maxLength={field.type === 'number' ? undefined : 180} />}
    </div>)}</div>
    <p className="service-form-note">Fields marked * are required. Your details will open in WhatsApp, ready for you to review and send.{kind === 'sell' && ' Add your photos there.'}</p>
    <Button type="submit" className="service-submit">Continue on WhatsApp <Icon name="arrow-up" /></Button>
  </form>;
}

export function AboutPage() {
  useSeo({ title: 'About Thimadu Auto Traders | Vehicle Dealer in Sri Lanka', description: 'Thimadu Auto Traders is a Sri Lankan vehicle dealer helping customers buy, sell and source quality vehicles with a straightforward, personal purchasing experience.' });
  return <>
    <PageHero eyebrow="A LITTLE ABOUT THIMADU" title={<>Good journeys.<br /><em>Begin together.</em></>} description="Thimadu Auto Traders is a Sri Lankan vehicle dealer helping customers buy, sell and source quality vehicles. A straightforward experience, with personal help at every step.">
      <div className="button-row"><Button to="/all-vehicles.html">Explore our vehicles <Icon name="arrow" /></Button>
      <Button href="https://wa.me/94771813928" variant="outline">Let’s talk <Icon name="chat" /></Button></div>
    </PageHero>
    <section className="about-image-section"><div className="container"><Reveal><figure className="about-image"><img src="/images/journey.webp" alt="A refined vehicle interior overlooking a coastal road" width="1440" height="900" fetchPriority="high" /><figcaption><span>THIMADU AUTO TRADERS</span><strong>For the road<br />ahead.</strong><Icon name="arrow-up" /></figcaption></figure></Reveal></div></section>
    <section className="section"><div className="container about-intro-grid"><Reveal><p className="eyebrow">YOUR VEHICLE DEALER IN SRI LANKA</p><h2 className="section-title">A clearer way<br />to <em>move forward.</em></h2></Reveal><Reveal><div className="about-intro-copy"><p>Thimadu Auto Traders helps customers buy, sell and source quality motor vehicles in Sri Lanka. We bring a carefully selected vehicle catalogue and a straightforward purchasing experience together.</p><p>Explore our current vehicles, compare the details and speak directly with our team. We help you understand the available specifications, condition and supporting information before arranging your next step.</p><p>Have a particular make, model or year in mind? Tell us your requirements and budget. Selling your current vehicle? Share its details and photographs to start the conversation.</p><Link className="info-text-link" to="/services.html">Discover how we can help <Icon name="arrow" /></Link></div></Reveal></div></section>
    <section className="section about-values"><div className="container"><Reveal><p className="eyebrow">WHAT MATTERS TO US</p><h2 className="section-title">Less guesswork.<br /><em>More understanding.</em></h2></Reveal><div className="about-value-grid">{[
      ['01', 'The exact vehicle.', 'Every listing brings its own photographs, specifications and reference. A clear starting point for a conversation about the car you are actually considering.', 'car'],
      ['02', 'A real conversation.', 'Talk directly to the vehicle desk. Share your shortlist, tell us your priorities and ask the questions that make a difference to you.', 'chat'],
      ['03', 'An informed next step.', 'Ask about current availability, the full price and available supporting records. Understand the details before deciding what comes next.', 'check'],
    ].map(([no, title, copy, icon]) => <Reveal key={no}><article className="about-value"><div className="about-value-top"><span>{no}</span><Icon name={icon} /></div><h3>{title}</h3><p>{copy}</p></article></Reveal>)}</div></div></section>
    <section className="section"><div className="container about-story-grid"><Reveal><div className="about-story-photo"><img src="/images/hero.webp" alt="A vehicle ready for its next journey" loading="lazy" width="1440" height="900" /><span className="about-story-caption"><Icon name="pin" /> Sri Lanka</span></div></Reveal><Reveal><div className="about-story-content"><p className="eyebrow">BEHIND EVERY HANDOVER</p><h2 className="section-title">A new set of keys.<br /><em>A new story.</em></h2><p className="info-copy">Meet the people behind the journeys. Explore the customer photographs and videos shared by the Thimadu team.</p><Button to="/reviews.html">Explore customer stories <Icon name="arrow" /></Button></div></Reveal></div></section>
    <InfoFaq questions={[
      ['How can Thimadu help me?', 'Browse vehicles, discuss selling your current car, request a specific model or ask about a listed vehicle and its available supporting information.'],
      ['What should I include in a vehicle enquiry?', 'Share the stock ID or vehicle-page link, followed by your questions about current availability, price, equipment, condition or supporting records.'],
      ['Can I request something that is not currently listed?', 'Yes. Share your preferred make, model, year range, approximate budget and any must-have requirements through our sourcing enquiry.'],
      ['What is the best way to get in touch?', 'Message the vehicle desk on WhatsApp or call +94 77 181 3928. Include your stock reference or requirements so the team has the right context.'],
    ]} />
    <ContactBanner />
  </>;
}

export function ServicesPage() {
  useSeo({ title: 'Vehicle Buying, Selling & Sourcing Services | Thimadu Auto Traders', description: 'Buy, sell or request a specific vehicle with Thimadu Auto Traders in Sri Lanka. Explore vehicle sourcing and information support.' });
  return <>
    <PageHero eyebrow="HERE FOR YOUR NEXT MOVE" title={<>Every journey.<br /><em>A way forward.</em></>} description="Buying, selling, or searching for something specific. Let’s make your next vehicle conversation a little simpler."><div className="button-row"><Button href="#our-services">Explore our services <Icon name="arrow" /></Button></div></PageHero>
    <section className="section info-services-section" id="our-services"><div className="container">{services.map(service => <Reveal key={service.no}><Link className="info-service-row" to={service.to}><div className="info-service-number">{service.no}<span className="info-service-icon"><Icon name={service.icon} /></span></div><div className="info-service-main"><p className="eyebrow">{service.tag}</p><h2>{service.title}</h2></div><div className="info-service-detail"><p>{service.description}</p><span className="info-service-link">{service.label}<span className="info-service-arrow"><Icon name="arrow-up" /></span></span></div></Link></Reveal>)}</div></section>
    <section className="section info-process-section"><div className="container"><Reveal><p className="eyebrow">A SIMPLE START</p><h2 className="section-title">Tell us where<br /><em>you want to go.</em></h2></Reveal><div className="info-process-grid">{[
      ['01', 'Find your starting point.', 'Explore our vehicles, choose a service or simply get in touch with what you have in mind.'],
      ['02', 'Share the details.', 'A stock reference, your vehicle information or a clear wish list helps us understand your request.'],
      ['03', 'Let’s take it from there.', 'Talk directly to the team, confirm the details and discuss the next step for your situation.'],
    ].map(([no, title, copy]) => <Reveal key={no}><article className="info-process-card"><span>{no}</span><h3>{title}</h3><p>{copy}</p></article></Reveal>)}</div></div></section>
    <InfoFaq questions={[
      ['Where can I see the vehicles for sale?', 'Open our Vehicles page to explore the current catalogue. Search and filter, then open an individual vehicle to see its photographs and specifications.'],
      ['Can I talk to someone before making a request?', 'Of course. Call +94 77 181 3928 or message the vehicle desk on WhatsApp to start a direct conversation.'],
      ['Can you help with a specific model?', 'Start a sourcing enquiry with your preferred make and model, year range, approximate budget and requirements. Any potential match is confirmed directly.'],
      ['Should I confirm an online price and status?', 'Yes. The catalogue is a useful starting point. Confirm current availability, price and any decision-critical details directly with the vehicle desk.'],
    ]} />
    <ContactBanner />
  </>;
}

export function ServicePage({ kind }) {
  const data = serviceData[kind] || serviceData.support;
  useSeo({ title: data.seoTitle, description: data.seoDescription, schema: { '@context': 'https://schema.org', '@type': 'Service', name: data.seoTitle.split(' | ')[0], description: data.seoDescription, provider: { '@type': 'Organization', name: 'Thimadu Auto Traders', telephone: '+94771813928' }, areaServed: { '@type': 'Country', name: 'Sri Lanka' } } });
  return <>
    <PageHero eyebrow={data.eyebrow} title={data.title} description={data.description}><div className="button-row"><Button href="#start-enquiry">Start a conversation <Icon name="arrow" /></Button><Button href="tel:+94771813928" variant="outline">Call the team <Icon name="phone" /></Button></div></PageHero>
    <section className="section service-enquiry-section" id="start-enquiry"><div className="container service-enquiry-grid"><Reveal><div className="service-process"><p className="eyebrow">HOW IT WORKS</p><h2 className="section-title">{data.processTitle}</h2><div className="service-step-list">{data.process.map(([title, copy], index) => <article className="service-step" key={title}><span className="service-step-number">0{index + 1}</span><div><h3>{title}</h3><p>{copy}</p></div></article>)}</div><a className="service-call" href="tel:+94771813928"><span className="service-call-icon"><Icon name="phone" /></span><span><small>Prefer a conversation?</small><strong>+94 77 181 3928</strong></span><Icon name="arrow-up" /></a></div></Reveal><Reveal><ServiceForm key={kind} data={data} kind={kind} /></Reveal></div></section>
    <InfoFaq questions={data.questions} />
    <section className="info-other-services"><div className="container"><p className="eyebrow">SOMETHING ELSE IN MIND?</p><Link to="/services.html">Explore all our services <Icon name="arrow" /></Link></div></section>
    <ContactBanner />
  </>;
}

export function NotFoundPage() {
  useSeo({ title: 'Page Not Found | Thimadu Auto Traders', description: 'Find your way back to Thimadu Auto Traders and explore vehicles and services in Sri Lanka.', noindex: true });
  return <section className="not-found-page"><div className="container">
    <div className="not-found-layout">
      <div className="not-found-copy"><p className="eyebrow">404 · A SMALL DETOUR</p><h1>New roads.<br /><em>Still ahead.</em></h1><p>The page you’re looking for has moved or doesn’t exist. Let’s get you back to the good part.</p><div className="button-row"><Button to="/all-vehicles.html">Explore the collection <Icon name="arrow" /></Button><Button to="/" variant="outline">Back to home</Button></div></div>
      <div className="not-found-map" aria-hidden="true"><div className="not-found-map-meta"><span>THIMADU / ROUTE FINDER</span><span>04 : 04</span></div><span className="not-found-code">404</span><svg viewBox="0 0 600 400" fill="none"><path className="not-found-road-outline" d="M-40 310H185C230 310 245 280 245 250V145C245 115 270 95 300 95H455C485 95 500 125 500 150V420" /><path className="not-found-road" d="M-40 310H185C230 310 245 280 245 250V145C245 115 270 95 300 95H455C485 95 500 125 500 150V420" /><circle cx="245" cy="230" r="17" fill="white" stroke="currentColor" strokeWidth="2" /><circle cx="245" cy="230" r="5" fill="currentColor" /><circle cx="430" cy="95" r="7" fill="currentColor" /></svg><span className="not-found-location"><Icon name="pin" size={14} /> Your next chapter</span><span className="not-found-map-caption"><span /> A new direction is always possible.</span></div>
    </div>
    <div className="not-found-search-row"><div><span className="eyebrow">KNOW WHAT YOU’RE LOOKING FOR?</span><h2>Find your way to your next car.</h2></div><form action="/all-vehicles.html" method="get" role="search" className="not-found-search"><label htmlFor="recovery-search" className="visually-hidden">Search make, model or keyword</label><Icon name="search" size={19} /><input type="search" id="recovery-search" name="q" placeholder="Try Toyota, hybrid, or SUV…" maxLength={120} /><button type="submit" aria-label="Search the collection"><Icon name="arrow" size={21} /></button></form></div>
    <div className="not-found-help"><span>A little help finding your next step?</span><Link to="/services.html">Discover our services <Icon name="arrow-up" size={15} /></Link><a href="https://wa.me/94771813928">Talk to the team <Icon name="chat" size={15} /></a></div>
  </div></section>;
}
