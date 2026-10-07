(function () {
  'use strict';

  const SOURCE = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQtUtkiDWGhuls-2JhfsVL1Hj_oFiFTyBPZyHndMBHeNoRotTcjppZe-tN32NqST4-t-xsgXnjYMK-8/pub?output=csv';
  const listeners = new EventTarget();
  const pending = new Map();
  let requestSequence = 0;
  let initialized = false;
  let readyState = null;
  let worker = null;
  let resolveReady;
  let rejectReady;
  const readyPromise = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  function dispatch(name, detail) {
    listeners.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function init(options = {}) {
    if (initialized) return readyPromise;
    initialized = true;
    if (!('Worker' in window)) {
      const error = new Error('This browser cannot run the inventory data worker. Please update your browser.');
      rejectReady(error);
      dispatch('error', { fatal: true, message: error.message });
      return readyPromise;
    }
    try {
      worker = new Worker('assets/js/vehicle-worker.js');
    } catch (error) {
      rejectReady(error);
      dispatch('error', { fatal: true, message: 'The inventory engine could not start.' });
      return readyPromise;
    }

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', (event) => {
      const error = new Error(event.message || 'The inventory worker stopped unexpectedly.');
      if (!readyState) rejectReady(error);
      dispatch('error', { fatal: !readyState, message: error.message });
    });
    worker.postMessage({ type: 'init', source: options.source || SOURCE, force: Boolean(options.force) });
    return readyPromise;
  }

  function handleMessage(event) {
    const message = event.data || {};
    if (message.type === 'ready') {
      const firstReady = !readyState;
      readyState = message;
      if (firstReady) resolveReady(message);
      dispatch(firstReady ? 'ready' : 'update', message);
      return;
    }
    if (message.type === 'progress') {
      dispatch('progress', message);
      return;
    }
    if (message.type === 'warning') {
      dispatch('warning', message);
      return;
    }
    if (message.type === 'error') {
      const error = new Error(message.message || 'Inventory could not be loaded.');
      if (message.fatal && !readyState) rejectReady(error);
      dispatch('error', message);
      return;
    }
    if (message.type === 'response' && message.requestId) {
      const request = pending.get(message.requestId);
      if (!request) return;
      clearTimeout(request.timer);
      pending.delete(message.requestId);
      if (message.error) request.reject(new Error(message.error));
      else request.resolve(message.data);
    }
  }

  async function request(type, payload = {}, timeoutMs = 16000) {
    await init();
    await readyPromise;
    if (!worker) throw new Error('Inventory worker unavailable.');
    const requestId = `r${Date.now().toString(36)}-${(++requestSequence).toString(36)}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error('The inventory request timed out.'));
      }, timeoutMs);
      pending.set(requestId, { resolve, reject, timer });
      worker.postMessage({ type, payload, requestId });
    });
  }

  function on(name, callback, options) {
    listeners.addEventListener(name, callback, options);
    return () => listeners.removeEventListener(name, callback, options);
  }

  window.VehicleStore = {
    init,
    on,
    whenReady: () => init(),
    getState: () => readyState,
    query: (payload) => request('query', payload),
    suggest: (search, limit = 6) => request('suggest', { search, limit }),
    featured: (limit = 6) => request('featured', { limit }),
    detail: (slug) => request('detail', { slug }),
    related: (payload) => request('related', payload),
    clearCache: () => request('clear-cache', {})
  };

  // Pages without a catalogue may never subscribe; their background startup
  // failure should not become an unhandled rejection. Consumers still receive
  // the original rejection from whenReady() and requests.
  init().catch(() => {});
}());
