import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// This executes the local Apps Script source against mocks. No network or sheet writes.
let configuredToken = '';
let sheetReads = 0;
const sheet = { getLastRow: () => 1 };
const spreadsheet = { getSheetByName: () => { sheetReads++; return sheet; } };
const context = vm.createContext({
  console: { error() {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => configuredToken }) },
  ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) },
  SpreadsheetApp: { openById: () => spreadsheet },
});
vm.runInContext(await readFile(new URL('../Code.gs', import.meta.url), 'utf8'), context);
const post = payload => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(payload) } }).text);
const get = parameter => JSON.parse(context.doGet({ parameter }).text);

const unconfigured = post({ action: 'auth', token: 'unconfigured-example' });
assert.equal(unconfigured.code, 'ADMIN_NOT_CONFIGURED');
assert.equal(unconfigured.apiVersion, '2.1.0');
assert.equal(post({ action: 'delete', token: '' }).code, 'ADMIN_NOT_CONFIGURED');
assert.equal(sheetReads, 0, 'Unconfigured admin actions must not touch the spreadsheet.');
configuredToken = 'synthetic-local-test-token';
const rejected = post({ action: 'auth', token: 'incorrect' });
assert.equal(rejected.status, 'error');
assert.equal(rejected.code, 'UNAUTHORIZED');
assert.equal(post({ action: 'delete', token: 'incorrect' }).code, 'UNAUTHORIZED');
const accepted = post({ action: 'auth', token: configuredToken });
assert.equal(accepted.status, 'success');
assert.equal(accepted.apiVersion, '2.1.0');
assert.equal(sheetReads, 0, 'Login and rejected writes must not initialize spreadsheet structure.');
const health = get({ action: 'health' });
assert.equal(health.status, 'success');
assert.equal(health.version, '2.1.0');
assert.equal(health.apiVersion, '2.1.0');
assert.equal(sheetReads, 0, 'Public health must be read-only.');
const response = get({ action: 'read', type: 'all' });
assert.equal(response.status, 'success');
assert.deepEqual(response.data, { vehicles: [], customers: [], videos: [] });
assert.equal(sheetReads, 3);
console.log('PASS: fail-closed admin configuration, invalid-token rejection, configured login, and read-only public health/collections. No live requests or writes.');
