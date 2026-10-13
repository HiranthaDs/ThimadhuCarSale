import { useState } from 'react';
import { Icon } from '../components';
import { useMotionPreference } from '../useMotionPreference';
import './country-flags.css';

const countries = [
  ['it', 'Italy'], ['il', 'Israel'], ['ae', 'Dubai', 'United Arab Emirates'],
  ['sa', 'Saudi Arabia'], ['qa', 'Qatar'], ['cy', 'Cyprus'],
];

export default function CountryFlags() {
  const { reduced } = useMotionPreference();
  const [paused, setPaused] = useState(false);
  const animated = !reduced;
  return <section className={`country-flags${animated ? ' country-flags-animated' : ''}${paused ? ' is-paused' : ''}`} aria-labelledby="country-flags-title">
    <div className="container country-flags-inner">
      <div className="country-flags-heading">
        <div><p className="eyebrow">YOUR NEXT CHAPTER IN SRI LANKA</p><h2 id="country-flags-title">Across borders.<br/><span>Closer to home.</span></h2></div>
        <p>Wherever you are, start a conversation about your next vehicle in Sri Lanka.</p>
        {animated && <button type="button" className="country-flags-pause" onClick={() => setPaused(value => !value)} aria-label={paused ? 'Play country flags' : 'Pause country flags'} aria-pressed={paused}>{paused ? <Icon name="play" size={16}/> : <span aria-hidden="true">Ⅱ</span>}</button>}
      </div>
      <div className="country-flags-window" tabIndex={animated ? undefined : 0} role="region" aria-label="Country flags: Italy, Israel, Dubai in the United Arab Emirates, Saudi Arabia, Qatar and Cyprus">
        <div className="country-flags-track">
          {(animated ? [0, 1] : [0]).map(copy => <ul className="country-flags-group" key={copy} aria-hidden={copy === 1 ? true : undefined}>
            {countries.map(([code, name, flagName]) => <li key={code}><img src={`/flags/${code}.svg`} width="60" height="40" alt={`${flagName || name} flag`} loading="eager" decoding="async"/><span>{name}</span></li>)}
          </ul>)}
        </div>
      </div>
      {!animated && <p className="country-flags-hint">Swipe to explore the flags <Icon name="arrow" size={13}/></p>}
    </div>
  </section>;
}
