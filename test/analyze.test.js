import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { analyze } from '../src/analyze.js';
import { sandbox, writeTree } from './helpers.js';

const codes = (result) => result.issues.map((issue) => issue.code);

const base = `fx_version 'cerulean'
game 'gta5'
lua54 'yes'
version '1.0.0'
author 'me'
description 'test'
`;

test('a clean resource has no issues', (t) => {
  const root = join(sandbox(t), 'clean');
  writeTree(root, {
    'fxmanifest.lua': `${base}client_script 'client/main.lua'\nserver_script 'server/main.lua'\n`,
    'client/main.lua': '',
    'server/main.lua': '',
  });
  assert.deepEqual(analyze(root).issues, []);
});

test('missing manifest and legacy manifest', (t) => {
  const dir = sandbox(t);
  assert.deepEqual(codes(analyze(dir)), ['no-manifest']);
  writeTree(dir, { '__resource.lua': '' });
  assert.deepEqual(codes(analyze(dir)), ['legacy-manifest']);
});

test('detects casing issues that only break on Linux', (t) => {
  const root = join(sandbox(t), 'casing');
  writeTree(root, {
    'fxmanifest.lua': `${base}client_script 'Client/Main.lua'\nclient_script 'Client/*.lua'\n`,
    'client/main.lua': '',
  });
  const result = analyze(root);
  assert.equal(codes(result).filter((code) => code === 'case-mismatch').length, 2);
});

test('flags server code shipped to clients', (t) => {
  const root = join(sandbox(t), 'leak');
  writeTree(root, {
    'fxmanifest.lua': `${base}server_script 'server/main.lua'\nfiles { 'server/*.lua' }\n`,
    'server/main.lua': '',
  });
  assert.ok(codes(analyze(root)).includes('server-file-exposed'));
});

test('checks ui_page and its assets', (t) => {
  const root = join(sandbox(t), 'nui');
  writeTree(root, {
    'fxmanifest.lua': `${base}ui_page 'html/index.html'\nfiles { 'html/index.html' }\n`,
    'html/index.html': '<link rel="stylesheet" href="style.css"><script src="./app.js"></script><img src="https://cdn.example/x.png">',
    'html/style.css': '',
  });
  const result = codes(analyze(root));
  assert.ok(result.includes('nui-asset-not-shipped'));
  assert.ok(result.includes('nui-asset-missing'));
  assert.equal(result.filter((code) => code.startsWith('nui-')).length, 2);
});

test('ui_page missing from files is an error', (t) => {
  const root = join(sandbox(t), 'blank');
  writeTree(root, {
    'fxmanifest.lua': `${base}ui_page 'web/index.html'\n`,
    'web/index.html': '<p>hi</p>',
  });
  assert.ok(codes(analyze(root)).includes('ui-page-not-shipped'));
});

test('build outputs get a helpful hint', (t) => {
  const root = join(sandbox(t), 'vite');
  writeTree(root, {
    'fxmanifest.lua': `${base}ui_page 'web/dist/index.html'\nfiles { 'web/dist/**' }\n`,
  });
  const result = analyze(root);
  const missing = result.issues.find((issue) => issue.code === 'missing-file');
  assert.match(missing.hint, /build/);
  assert.ok(codes(result).includes('empty-glob'));
});

test('undeclared @dependency, lua54, overlap, duplicates and orphans', (t) => {
  const root = join(sandbox(t), 'mixed');
  writeTree(root, {
    'fxmanifest.lua': `fx_version 'cerulean'\ngame 'gta5'\nshared_script '@ox_lib/init.lua'\nclient_scripts { 'shared.lua', 'shared.lua' }\nserver_script 'shared.lua'\n`,
    'shared.lua': '',
    'orphan.lua': '',
  });
  const result = codes(analyze(root));
  for (const code of ['undeclared-dependency', 'lua54-missing', 'client-server-overlap', 'duplicate-entry', 'unreferenced-lua']) {
    assert.ok(result.includes(code), code);
  }
});

test('declared dependencies silence the @ warning', (t) => {
  const root = join(sandbox(t), 'deps');
  writeTree(root, {
    'fxmanifest.lua': `${base}shared_script '@ox_lib/init.lua'\ndependencies { 'ox_lib' }\n`,
  });
  assert.ok(!codes(analyze(root)).includes('undeclared-dependency'));
});

test('fx_version validation', (t) => {
  const root = join(sandbox(t), 'fxv');
  writeTree(root, { 'fxmanifest.lua': "fx_version 'banana'\n" });
  const result = codes(analyze(root));
  assert.ok(result.includes('unknown-fx-version'));
  assert.ok(result.includes('missing-game'));
});
