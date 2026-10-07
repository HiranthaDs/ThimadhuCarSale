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

assert.equal(post({ action: 'auth', token: 'unconfigured-example' }).code, 'ADMIN_NOT_CONFIGURED');
assert.equal(post({ action: 'delete', token: '' }).code, 'ADMIN_NOT_CONFIGURED');
assert.equal(sheetReads, 0, 'Unconfigured admin actions must not touch the spreadsheet.');
configuredToken = 'synthetic-local-test-token';
assert.equal(post({ action: 'auth', token: 'incorrect' }).status, 'error');
assert.equal(post({ action: 'delete', token: 'incorrect' }).code, 'UNAUTHORIZED');
assert.equal(post({ action: 'auth', token: configuredToken }).status, 'success');
assert.equal(sheetReads, 0, 'Login and rejected writes must not initialize spreadsheet structure.');
assert.equal(get({ action: 'health' }).status, 'success');
assert.equal(sheetReads, 0, 'Public health must be read-only.');
const response = get({ action: 'read', type: 'all' });
assert.equal(response.status, 'success');
assert.deepEqual(response.data, { vehicles: [], customers: [], videos: [] });
assert.equal(sheetReads, 3);
console.log('PASS: fail-closed admin configuration, invalid-token rejection, configured login, and read-only public health/collections. No live requests or writes.');
