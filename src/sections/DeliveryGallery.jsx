import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components';
import { formatDate, imageCandidates, playerUrl, thumbnail } from '../customer-stories';
import './delivery-gallery.css';

function DeliveryImage({ story, large = false }) {
  const candidates = useMemo(() => {
    const sources = [thumbnail(story), story.imageUrl, story.kind === 'video' ? thumbnail({ ...story, thumbnailUrl: '' }) : ''];
    return [...new Set(sources.flatMap(source => imageCandidates(source, large ? 1800 : 900)))];
  }, [story, large]);
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [candidates]);
  if (!candidates[index]) return <div className="delivery-image-empty"><Icon name={story.kind === 'video' ? 'play' : 'car'} size={30} /><span>{story.kind === 'video' ? 'Open delivery video' : 'Photo preview unavailable'}</span></div>;
  return <img src={candidates[index]} alt={story.title} width="900" height="675" loading={large ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" onError={() => setIndex(previous => previous + 1)} />;
}

export function DeliveryFilters({ value, onChange, counts, label = 'Delivery type', className = '' }) {
  return <div className={`delivery-filters ${className}`} role="group" aria-label={label}>
    {[['all', 'All'], ['photos', 'Photos'], ['videos', 'Videos']].map(([key, name]) => <button type="button" key={key} className={value === key ? 'is-active' : ''} aria-pressed={value === key} onClick={() => onChange(key)}>{name}{counts && <span>{counts[key]}</span>}</button>)}
  </div>;
}

function DeliveryViewer({ story, index, total, onClose, onPrevious, onNext }) {
  const dialogRef = useRef(null);
  const [videoFailed, setVideoFailed] = useState(false);
  useEffect(() => setVideoFailed(false), [story.key]);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  const embed = playerUrl(story.videoUrl);
  const directVideo = story.videoUrl && /\.(?:mp4|webm|ogg)$/i.test(new URL(story.videoUrl).pathname);
  const externalVideo = story.kind === 'video' && ((!embed && !directVideo) || videoFailed);
  const date = formatDate(story.postedDate);
  return <dialog ref={dialogRef} className="delivery-viewer story-dialog" aria-labelledby="delivery-viewer-title" onClose={onClose} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={event => {
    if (event.target.closest('video, iframe, a') || total < 2) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); onPrevious(); }
    if (event.key === 'ArrowRight') { event.preventDefault(); onNext(); }
  }}>
    <div className="delivery-viewer-top">
      <span>Customer deliveries <span className="delivery-viewer-count">{index + 1} / {total}</span></span>
      <button type="button" className="delivery-viewer-close story-dialog-close" onClick={onClose} aria-label="Close delivery" autoFocus><Icon name="close" /></button>
    </div>
    <div className="delivery-viewer-body">
      <div className="delivery-viewer-media">
        {story.kind === 'photo' ? <DeliveryImage key={story.key} story={story} large /> : embed ? <iframe key={story.key} src={embed} title={story.title} allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="no-referrer" /> : directVideo && !videoFailed ? <video key={story.key} src={story.videoUrl} controls playsInline preload="metadata" poster={thumbnail(story) || undefined} onError={() => setVideoFailed(true)} /> : <div className="delivery-external-video"><DeliveryImage key={story.key} story={story} large />{externalVideo && <a href={story.videoUrl} target="_blank" rel="noopener noreferrer"><Icon name="play" />Watch original video <Icon name="arrow-up" size={16} /></a>}</div>}
      </div>
      <div className="delivery-viewer-copy">
        <p className="delivery-viewer-label">{story.kind === 'video' ? 'Delivery video' : 'Delivery day'}</p>
        <h2 id="delivery-viewer-title">{story.title}</h2>
        {(story.customerName || story.location || date) && <p className="delivery-viewer-details">{[story.customerName, story.location, date].filter(Boolean).join(' · ')}</p>}
        {story.description && <p className="delivery-viewer-description">{story.description}</p>}
        {story.kind === 'video' && <a className="delivery-original" href={story.videoUrl} target="_blank" rel="noopener noreferrer">Open original video <Icon name="arrow-up" size={15} /></a>}
        {total > 1 && <div className="delivery-viewer-navigation"><button type="button" onClick={onPrevious} aria-label="Previous delivery"><Icon name="arrow" className="delivery-previous" /> Previous</button><button type="button" onClick={onNext} aria-label="Next delivery">Next <Icon name="arrow" /></button></div>}
      </div>
    </div>
  </dialog>;
}

export default function DeliveryGallery({ stories, loading = false, className = '', children }) {
  const [selectedKey, setSelectedKey] = useState(null);
  const close = useCallback(() => setSelectedKey(null), []);
  const selectedIndex = stories.findIndex(story => story.key === selectedKey);
  const selected = stories[selectedIndex];
  const move = direction => setSelectedKey(stories[(selectedIndex + direction + stories.length) % stories.length].key);
  return <>
    <div className={`delivery-grid ${className}`} aria-busy={loading}>
      {loading ? Array.from({ length: 6 }, (_, index) => <div className="delivery-skeleton" key={index} aria-hidden="true"><div /><span /><span /></div>) : stories.map(story => <article className={`delivery-tile story-card story-card-${story.kind}`} key={story.key}>
        <button type="button" className="delivery-tile-button story-media" onClick={() => setSelectedKey(story.key)} aria-label={`${story.kind === 'video' ? 'Watch' : 'View'} ${story.title}`} aria-haspopup="dialog">
          <div className="delivery-tile-media"><DeliveryImage story={story} />{story.kind === 'video' && <><span className="delivery-video-label"><Icon name="play" size={11} /> Video</span><span className="delivery-play"><Icon name="play" size={23} /></span></>}</div>
          <div className="delivery-tile-copy"><h3>{story.title}</h3><p>{[story.customerName, story.location].filter(Boolean).join(' · ') || formatDate(story.postedDate) || (story.kind === 'video' ? 'Delivery video' : 'Customer delivery')}</p></div>
        </button>
      </article>)}
      {children}
    </div>
    {selected && <DeliveryViewer story={selected} index={selectedIndex} total={stories.length} onClose={close} onPrevious={() => move(-1)} onNext={() => move(1)} />}
  </>;
}
