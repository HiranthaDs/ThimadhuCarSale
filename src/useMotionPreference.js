import { useSyncExternalStore } from 'react';

// Include touch devices in landscape, while preserving motion on mouse-led PCs.
export const MOBILE_MEDIA_QUERY = '(max-width: 767px), (hover: none) and (pointer: coarse)';
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const stores = new Map();
export function useMediaQuery(query) {
  if (!stores.has(query)) {
    let media;
    const getMedia = () => (media ||= window.matchMedia(query));
    stores.set(query, {
      subscribe(listener) {
        const current = getMedia();
        current.addEventListener('change', listener);
        return () => current.removeEventListener('change', listener);
      },
      getSnapshot: () => getMedia().matches,
      getServerSnapshot: () => false,
    });
  }
  const store = stores.get(query);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}

export function useMotionPreference() {
  const mobile = useMediaQuery(MOBILE_MEDIA_QUERY);
  const reduced = useMediaQuery(REDUCED_MOTION_QUERY);
  return { mobile, reduced, motionDisabled: mobile || reduced };
}
