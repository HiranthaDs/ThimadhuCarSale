import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, Reveal } from '../components';
import './sri-lanka-network.css';

// The SVG uses this same equirectangular projection. See public/maps/README.md.
const project = (longitude, latitude) => ({
  x: 300 + (longitude - 80.773041) * Math.cos(7.876655 * Math.PI / 180) * 150,
  y: 360 - (latitude - 7.876655) * 150,
});
const cities = [
  { name: 'Jaffna', province: 'Northern Province', latitude: 9.668446, longitude: 80.007420, side: 'left' },
  { name: 'Trincomalee', province: 'Eastern Province', latitude: 8.5778, longitude: 81.2289, side: 'right' },
  { name: 'Kandy', province: 'Central Province', latitude: 7.2906, longitude: 80.6336, side: 'right' },
  { name: 'Colombo', province: 'Western Province', latitude: 6.93548, longitude: 79.84868, side: 'left' },
  { name: 'Galle', province: 'Southern Province', latitude: 6.0461, longitude: 80.2103, side: 'right' },
].map(city => ({ ...city, ...project(city.longitude, city.latitude) }));

const enquiryLink = city => `https://wa.me/94771813928?text=${encodeURIComponent(`Hi Thimadu Auto Traders, I'm in ${city} and would like to discuss my next vehicle.`)}`;

export default function SriLankaNetwork() {
  const inputId = useId();
  const [selectedName, setSelectedName] = useState('Colombo');
  const [customCity, setCustomCity] = useState('');
  const selected = cities.find(city => city.name === selectedName);
  const hasCustomCity = Boolean(customCity.trim());
  const destination = customCity.trim() || selected.name;
  const selectCity = name => { setSelectedName(name); setCustomCity(''); };

  return <section className="sl-network" aria-labelledby="sl-network-title">
    <div className="sl-network-inner">
      <Reveal className="sl-network-copy">
        <span className="sl-network-eyebrow"><span /> ROOTED IN SRI LANKA</span>
        <h2 id="sl-network-title">One island.<br />Endless <br /><em>possibilities.</em></h2>
        <p className="sl-network-intro">City streets. Coastal roads. A little further from the everyday. Wherever your next chapter begins, let's find the vehicle for it.</p>
        <div className="sl-destination">
          <div className="sl-destination-top"><span>YOUR JOURNEY STARTS IN</span><Icon name="pin" size={18} /></div>
          <div className="sl-destination-place" aria-live="polite" aria-atomic="true">
            <h3>{destination}</h3>
            <span>{customCity.trim() ? 'Sri Lanka' : selected.province}</span>
          </div>
          <a className="sl-destination-link" href={enquiryLink(destination)}>Let's talk about your next vehicle <Icon name="arrow-up" size={19} /></a>
        </div>
        <form className="sl-city-form" action="https://wa.me/94771813928" method="get">
          <label htmlFor={inputId}>Somewhere else? Tell us your city.</label>
          <div className="sl-city-input"><Icon name="pin" size={17} /><input id={inputId} value={customCity} onChange={event => setCustomCity(event.target.value)} autoComplete="address-level2" placeholder="Your city or town" maxLength={90} /><input type="hidden" name="text" value={`Hi Thimadu Auto Traders, I'm in ${destination} and would like to discuss my next vehicle.`} /><button type="submit" aria-label={`Start a vehicle enquiry from ${destination} on WhatsApp`}><Icon name="arrow" size={20} /></button></div>
        </form>
        <Link className="sl-sourcing-link" to="/vehicle-sourcing-sri-lanka.html">Have something specific in mind? <Icon name="arrow" size={16} /></Link>
      </Reveal>

      <div className="sl-network-map-panel">
        <div className="sl-map-topline"><span><span className="sl-map-status-dot" /> CHOOSE YOUR CITY</span><span>LK / +94</span></div>
        <div className="sl-map" role="group" aria-label="Select an enquiry destination in Sri Lanka">
          <svg className="sl-map-grid" viewBox="0 0 600 720" fill="none" aria-hidden="true">
            {[6, 7, 8, 9].map(latitude => <g key={latitude}><path d={`M35 ${project(80, latitude).y}H565`} /><text x="17" y={project(80, latitude).y + 4}>{latitude}°</text></g>)}
            {[80, 81].map(longitude => <g key={longitude}><path d={`M${project(longitude, 8).x} 28V690`} /><text x={project(longitude, 8).x - 9} y="710">{longitude}° E</text></g>)}
          </svg>
          <img className="sl-map-coastline" src="/maps/sri-lanka.svg" alt="Geographic outline of Sri Lanka, including the Jaffna peninsula and northern offshore islands" width="600" height="720" loading="lazy" decoding="async" />
          {!hasCustomCity && <svg className="sl-map-selection" viewBox="0 0 600 720" fill="none" aria-hidden="true">
            <g key={selected.name} className="sl-map-beacon" style={{ transformOrigin: `${selected.x}px ${selected.y}px` }}>
              <circle cx={selected.x} cy={selected.y} r="27" /><circle cx={selected.x} cy={selected.y} r="48" />
              <path d={`M${selected.x - 64} ${selected.y}h13m102 0h13M${selected.x} ${selected.y - 64}v13m0 102v13`} />
            </g>
          </svg>}
          <span className="sl-map-ocean" aria-hidden="true">INDIAN<br />OCEAN</span>
          <span className="sl-map-compass" aria-hidden="true"><span>N</span><svg viewBox="0 0 20 32" width="20" height="32"><path d="M10 1 19 29 10 23 1 29Z" fill="none" stroke="currentColor" /><path d="M10 1 10 23 1 29Z" fill="currentColor" /></svg></span>
          {cities.map(city => <button type="button" key={city.name} className={`sl-map-city sl-map-city-${city.side}${!hasCustomCity && selectedName === city.name ? ' is-selected' : ''}`} style={{ left: `${city.x / 6}%`, top: `${city.y / 7.2}%` }} aria-pressed={!hasCustomCity && selectedName === city.name} aria-label={`Choose ${city.name} for a vehicle enquiry`} onClick={() => selectCity(city.name)}>
            <span className="sl-map-city-dot" aria-hidden="true"><span /></span><span className="sl-map-city-name">{city.name}</span>
          </button>)}
        </div>
        <div className="sl-map-bottomline"><a href={enquiryLink(destination)}>ENQUIRE FROM {destination.toLocaleUpperCase()} <Icon name="arrow-up" size={13} /></a><span>SRI LANKA · 07° N 81° E</span></div>
        <p className="sl-map-note">Enquiry destinations. Select your location to start a conversation.</p>
        <p className="sl-map-attribution">Map: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a> · Cities: <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a> (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>)</p>
      </div>
    </div>
  </section>;
}
