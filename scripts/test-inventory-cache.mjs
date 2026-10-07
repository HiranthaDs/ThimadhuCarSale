import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const drain = async () => { for (let index = 0; index < 100; index += 1) await Promise.resolve(); };

function runtime(source, fetchMode = 'pending') {
  const messages = [];
  const timers = new Map();
  let sequence = 0;
  let receive;
  let snapshot;
  let calls = 0;
  const indexedDB = {
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = {
          close() {},
          transaction() {
            const transaction = {
              objectStore() {
                return {
                  get() {
                    const read = {};
                    queueMicrotask(() => {
                      read.result = snapshot;
                      read.onsuccess();
                      transaction.oncomplete?.();
                    });
                    return read;
                  },
                };
              },
            };
            return transaction;
          },
        };
        request.onsuccess();
      });
      return request;
    },
  };
  const sandbox = {
    AbortController, TextDecoder, indexedDB,
    self: { indexedDB, addEventListener: (_type, listener) => { receive = listener; } },
    postMessage: (message) => messages.push(message),
    setTimeout(callback, delay) {
      const id = ++sequence;
      timers.set(id, { callback, delay });
      if (delay < 1000) queueMicrotask(() => { if (timers.delete(id)) callback(); });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    fetch: async () => {
      calls += 1;
      if (fetchMode === 'offline') throw new Error('Network offline');
      return new Promise(() => {});
    },
    fixture: { id: 'TEST-101', brand: 'Toyota', model: 'Aqua', year: '2021', price: '8500000', mileage: '15000', fuel: 'Hybrid', type: 'Hatchback', availability: 'Available', image1: 'https://example.test/car.jpg' },
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(source, context);
  const record = vm.runInContext('normalizeRecord(fixture, 0)', context);
  snapshot = { schema: 3, records: [record], savedAt: Date.now() - 600000 };
  return { context, messages, timers, record, send: (data) => receive({ data }), calls: () => calls };
}

function response(runtime, id) {
  const message = runtime.messages.find((item) => item.type === 'response' && item.requestId === id);
  assert.ok(message, `Expected response to ${id}`);
  assert.equal(message.error, undefined, `Request ${id} must work after cached ready`);
  return message.data;
}

async function testWorker(path) {
  const source = await readFile(new URL(path, root), 'utf8');
  const cached = runtime(source);
  cached.send({ type: 'init' });
  await drain();
  assert.ok(cached.messages.some((message) => message.type === 'ready' && message.source === 'cache' && message.stale));
  cached.send({ type: 'query', requestId: 'query', payload: { filters: { brands: ['toyota'] }, page: 1, pageSize: 12 } });
  assert.equal(response(cached, 'query').items[0].id, 'TEST-101');
  cached.send({ type: 'detail', requestId: 'detail', payload: { slug: cached.record.slug } });
  assert.equal(response(cached, 'detail').item.model, 'Aqua');
  cached.send({ type: 'featured', requestId: 'featured', payload: { limit: 3 } });
  assert.equal(response(cached, 'featured').total, 1);
  assert.equal(cached.calls(), 1, 'The live refresh must remain in flight during cached queries');

  const offline = runtime(source, 'offline');
  offline.send({ type: 'init' });
  await drain();
  const failure = offline.messages.find((message) => message.type === 'error');
  assert.equal(failure?.fatal, false, 'A failed refresh must preserve usable cached records');
  assert.equal(offline.calls(), 4, 'Three CSV attempts should precede the API fallback');
  offline.send({ type: 'query', requestId: 'offline-query', payload: {} });
  assert.equal(response(offline, 'offline-query').total, 1);

  const stalled = runtime(source);
  stalled.context.fetch = async (_url, { signal }) => ({
    ok: true,
    headers: { get: () => null },
    body: { getReader: () => ({ read: () => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('Body read aborted')), { once: true })) }) },
  });
  const pendingRead = vm.runInContext("fetchAndParse('https://example.test/stock.csv')", stalled.context);
  await drain();
  const timeout = [...stalled.timers.values()].find((timer) => timer.delay === 25000);
  assert.ok(timeout, 'The timeout must remain active after headers, until the CSV body finishes');
  const aborted = assert.rejects(pendingRead, /Body read aborted/);
  timeout.callback();
  await aborted;
  assert.equal(stalled.timers.size, 0, 'A failed body read must clear its timeout');
  console.log(`PASS ${path}: cached queries, failed refresh, stalled response timeout`);
}

async function testClient(path) {
  const source = await readFile(new URL(path, root), 'utf8');
  const unhandled = [];
  const onUnhandled = (error) => unhandled.push(error);
  process.on('unhandledRejection', onUnhandled);
  try {
    const sandbox = { window: {}, EventTarget, CustomEvent, setTimeout, clearTimeout };
    vm.runInNewContext(source, sandbox, { filename: fileURLToPath(new URL(path, root)) });
    await new Promise((resolve) => setImmediate(resolve));
    await assert.rejects(sandbox.window.VehicleStore.whenReady(), /cannot run the inventory data worker/);
    assert.equal(unhandled.length, 0, 'Background startup should handle its rejection without hiding it from consumers');
    console.log(`PASS ${path}: unsupported-worker startup and consumer rejection`);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
}

for (const prefix of ['public/assets/js']) {
  await testWorker(`${prefix}/vehicle-worker.js`);
  await testClient(`${prefix}/vehicle-client.js`);
}
