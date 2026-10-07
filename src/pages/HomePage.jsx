import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon, Reveal } from '../components';
import { FeaturedVehicles } from '../inventory';
import { useSeo } from '../seo';
import HeroStory, { ConfidenceGauge } from '../sections/HeroStory';
import JourneyTimeline from '../sections/JourneyTimeline';
import { CustomerStories, ConversationJourney, GuidesSection, FinaleSection } from '../sections/ExperienceSections';
import SriLankaNetwork from '../sections/SriLankaNetwork';
import './home.css';

function VehicleSection() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  return <section className="home-inventory" id="the-collection" aria-labelledby="collection-heading">
    <div className="container">
      <Reveal className="collection-heading">
        <div><p className="eyebrow"><span className="section-rule"/> THE COLLECTION</p><h2 id="collection-heading">Find your kind<br/>of <span>possibility.</span></h2></div>
        <div><p>A daily companion. A family upgrade.<br/>Something you’ve always had in mind.<br/>Your next chapter starts here.</p><Link className="text-link" to="/all-vehicles.html">View the collection <Icon name="arrow-up" size={18}/></Link></div>
      </Reveal>
      <div className="collection-search-panel">
        <form className="home-search" role="search" aria-label="Find your next vehicle" onSubmit={event=>{event.preventDefault();navigate(`/all-vehicles.html${query.trim()?`?q=${encodeURIComponent(query.trim())}`:''}`);}}>
          <Icon name="search"/>
          <label className="sr-only" htmlFor="home-search">Search for a make or model</label>
          <input id="home-search" name="q" type="search" autoComplete="off" maxLength={120} placeholder="Your next drive. Make, model, or keyword…" value={query} onChange={event=>setQuery(event.target.value)}/>
          <button type="submit"><span>Find my vehicle</span><Icon name="arrow" size={19}/></button>
        </form>
        <div className="collection-discovery"><span>A PLACE TO START</span><nav aria-label="Explore vehicle categories"><Link to="/all-vehicles.html?type=SUV">SUVs <Icon name="arrow-up" size={12}/></Link><Link to="/all-vehicles.html?fuel=Hybrid">Hybrids <Icon name="arrow-up" size={12}/></Link><Link to="/all-vehicles.html?type=Sedan">Sedans <Icon name="arrow-up" size={12}/></Link><Link to="/all-vehicles.html?brand=Toyota">Toyota <Icon name="arrow-up" size={12}/></Link></nav></div>
      </div>
      <FeaturedVehicles limit={3}/>
      <div className="collection-tail"><span><Icon name="chat" size={17}/> Your questions deserve a real conversation.</span><Link to="/vehicle-sourcing-sri-lanka.html">Have something specific in mind? <Icon name="arrow" size={17}/></Link></div>
    </div>
  </section>;
}
const faqs = [
  ['How do I check if a vehicle is available?', 'Open a vehicle listing and use its WhatsApp enquiry button. Our team will confirm current availability, price, and viewing arrangements.'],
  ['Can you help me sell my current vehicle?', 'Yes. Share the make, model, year, mileage, condition, location, and expected price through our sell-your-vehicle page. You can send photographs when the conversation opens in WhatsApp.'],
  ['What if I cannot find the vehicle I want?', 'Tell us your preferred make and model, year range, budget, and important features. Our vehicle sourcing service starts with understanding what you need.'],
  ['Can I ask for more vehicle information?', 'Of course. Contact us with the listing or stock ID. We can discuss the available specifications and documents and help you arrange the next step.'],
];
function Questions() {
  return <section className="home-faq" id="questions" aria-labelledby="questions-heading"><div className="container faq-grid"><Reveal><p className="eyebrow"><span className="section-rule"/> A LITTLE CLARITY</p><h2 id="questions-heading">Good questions.<br/><span>Clear answers.</span></h2><p className="faq-introduction">A few things you might be wondering.<br/>And a real team for everything else.</p><a className="text-link" href="https://wa.me/94771813928">Ask us something else <Icon name="arrow-up" size={18}/></a></Reveal><div className="faq-list">{faqs.map(([question,answer],index)=><details name="home-questions" key={question}><summary><span className="faq-number">0{index+1}</span>{question}<Icon name="plus"/></summary><p>{answer}</p></details>)}</div></div></section>;
}
export default function HomePage() {
  useSeo({title:'Thimadu Auto Traders | Your next car. Your next chapter.',description:'Discover cars for sale in Sri Lanka, sell your vehicle, or find a specific model with personal support from Thimadu Auto Traders.'});
  return <><HeroStory/><ConfidenceGauge/><JourneyTimeline/><CustomerStories/><ConversationJourney/><SriLankaNetwork/><VehicleSection/><GuidesSection/><Questions/><FinaleSection/></>;
}
