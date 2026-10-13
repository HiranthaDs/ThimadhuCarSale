import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components';
import { FeaturedVehicles } from '../inventory';
import { useSeo } from '../seo';
import ShowroomHero from '../sections/ShowroomHero';
import HomeReviews from '../sections/HomeReviews';
import './home.css';

function VehicleSection() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  return <section className="home-inventory" id="the-collection" aria-labelledby="collection-heading">
    <div className="container">
      <div className="collection-heading">
        <div><p className="eyebrow">FIND YOUR NEXT CAR</p><h2 id="collection-heading">Take a look around.</h2></div>
        <div><p>Explore our latest listings. Ask us about the details,<br className="desktop-break"/> or arrange a viewing when you're ready.</p><Link className="text-link" to="/all-vehicles.html">View all vehicles <Icon name="arrow" size={18}/></Link></div>
      </div>
      <div className="collection-search-panel">
        <form className="home-search" role="search" aria-label="Find your next vehicle" onSubmit={event => { event.preventDefault(); navigate(`/all-vehicles.html${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`); }}>
          <Icon name="search"/>
          <label className="sr-only" htmlFor="home-search">Search for a make or model</label>
          <input id="home-search" name="q" type="search" autoComplete="off" maxLength={120} placeholder="Search by make or model" value={query} onChange={event => setQuery(event.target.value)}/>
          <button type="submit"><span>Search vehicles</span><Icon name="arrow" size={19}/></button>
        </form>
        <div className="collection-discovery"><span>POPULAR SEARCHES</span><nav aria-label="Explore vehicle categories"><Link to="/all-vehicles.html?type=SUV">SUVs</Link><Link to="/all-vehicles.html?fuel=Hybrid">Hybrids</Link><Link to="/all-vehicles.html?type=Sedan">Sedans</Link><Link to="/all-vehicles.html?brand=Toyota">Toyota</Link></nav></div>
      </div>
      <FeaturedVehicles limit={3}/>
      <div className="collection-tail"><a href="tel:+94771813928"><Icon name="phone" size={17}/> Want to know more? Call 077 181 3928.</a><Link to="/vehicle-sourcing-sri-lanka.html">Looking for a specific vehicle? <Icon name="arrow" size={17}/></Link></div>
    </div>
  </section>;
}

const services = [
  { number: '01', title: 'Buying a vehicle?', copy: 'Explore the available vehicles, ask for the information you need and arrange a viewing with our team.', to: '/all-vehicles.html', action: 'Browse vehicles' },
  { number: '02', title: 'Time to sell yours?', copy: 'Tell us about your vehicle, its condition and your expected price. We’ll discuss the next steps with you.', to: '/sell-your-vehicle-sri-lanka.html', action: 'Sell your vehicle' },
  { number: '03', title: 'Something specific in mind?', copy: 'Share the make, model and budget you’re working with. We’ll help you explore your options.', to: '/vehicle-sourcing-sri-lanka.html', action: 'Request a vehicle' },
];

function ServicesSection() {
  return <section className="home-services" id="how-it-works" aria-labelledby="home-services-title"><div className="container">
    <div className="home-services-heading"><p className="eyebrow">LET’S TALK CARS</p><h2 id="home-services-title">A real team.<br/>Here to help.</h2><Link className="text-link" to="/aboutus.html">Get to know Thimadu <Icon name="arrow" size={18}/></Link></div>
    <div className="home-service-list">{services.map(service => <Link to={service.to} className="home-service-row" key={service.number}><span className="home-service-number">{service.number}</span><div><h3>{service.title}</h3><p>{service.copy}</p><span className="home-service-action">{service.action}</span></div><Icon name="arrow-up" size={22}/></Link>)}</div>
  </div></section>;
}

const faqs = [
  ['How do I check if a vehicle is available?', 'Open a vehicle listing and use its WhatsApp enquiry button. Our team will confirm current availability, price, and viewing arrangements.'],
  ['Can you help me sell my current vehicle?', 'Yes. Share the make, model, year, mileage, condition, location, and expected price through our sell-your-vehicle page. You can send photographs when the conversation opens in WhatsApp.'],
  ['What if I cannot find the vehicle I want?', 'Tell us your preferred make and model, year range, budget, and important features. Our vehicle sourcing service starts with understanding what you need.'],
  ['Can I ask for more vehicle information?', 'Of course. Contact us with the listing or stock ID. We can discuss the available specifications and documents and help you arrange the next step.'],
];

function Questions() {
  return <section className="home-faq" id="questions" aria-labelledby="questions-heading"><div className="container faq-grid"><div><p className="eyebrow">BEFORE YOU GET IN TOUCH</p><h2 id="questions-heading">A few useful answers.</h2><p className="faq-introduction">Have another question? We're happy to help.</p><a className="text-link" href="https://wa.me/94771813928">Ask us on WhatsApp <Icon name="arrow-up" size={18}/></a></div><div className="faq-list">{faqs.map(([question, answer]) => <details name="home-questions" key={question}><summary>{question}<Icon name="plus"/></summary><p>{answer}</p></details>)}</div></div></section>;
}

export default function HomePage() {
  useSeo({ title: 'Thimadu Auto Traders | Buy, Sell & Source Vehicles in Sri Lanka', description: 'Explore vehicles and customer delivery photos and videos from Thimadu Auto Traders. Buy, sell and source vehicles in Sri Lanka with personal support from our team.' });
  return <div className="dealership-home"><ShowroomHero/><HomeReviews/><VehicleSection/><ServicesSection/><Questions/></div>;
}
