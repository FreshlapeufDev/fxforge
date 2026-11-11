import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyze } from '../src/analyze.js';
import { crc32, createZip } from '../src/zip.js';
import { cli, readZip, sandbox, writeTree } from './helpers.js';

const frameworks = ['standalone', 'esx', 'qbcore', 'qbox'];
const nuis = ['none', 'vanilla', 'vite'];

for (const framework of frameworks) {
  for (const nui of nuis) {
    test(`create ${framework} + ${nui} passes check`, (t) => {
      const dir = sandbox(t);
      const name = `res_${framework}_${nui}`;
      const res = cli(['create', name, '--framework', framework, '--nui', nui, '--yes', '--no-git', '--author', 'tester'], dir);
      assert.equal(res.code, 0, res.out);
      const root = join(dir, name);
      if (nui === 'vite') {
        writeTree(root, {
          'web/dist/index.html': '<script type="module" src="./assets/index.js"></script><link rel="stylesheet" href="./assets/index.css">',
          'web/dist/assets/index.js': '',
          'web/dist/assets/index.css': '',
        });
      }
      const result = analyze(root);
      assert.deepEqual(result.issues, []);
      const manifest = readFileSync(join(root, 'fxmanifest.lua'), 'utf8');
      if (framework === 'qbox') assert.match(manifest, /@ox_lib\/init\.lua/);
      if (framework === 'esx') assert.match(manifest, /es_extended/);
    });
  }
}

test('generated Lua and JS contain no comments', (t) => {
  const dir = sandbox(t);
  cli(['create', 'clean', '--framework', 'esx', '--nui', 'vanilla', '--yes', '--no-git'], dir);
  for (const file of ['client/main.lua', 'server/main.lua', 'bridge/client.lua', 'shared/locale.lua', 'config.lua']) {
    assert.doesNotMatch(readFileSync(join(dir, 'clean', file), 'utf8'), /^\s*--/m, file);
  }
  assert.doesNotMatch(readFileSync(join(dir, 'clean', 'web/app.js'), 'utf8'), /^\s*\/\//m);
});

test('create rejects bad names and existing folders', (t) => {
  const dir = sandbox(t);
  assert.equal(cli(['create', 'Bad Name', '--yes'], dir).code, 1);
  assert.equal(cli(['create', 'twice', '--yes', '--no-git'], dir).code, 0);
  const again = cli(['create', 'twice', '--yes', '--no-git'], dir);
  assert.equal(again.code, 1);
  assert.match(again.out, /already exists/);
});

test('check exit codes and json output', (t) => {
  const dir = sandbox(t);
  writeTree(dir, { 'ok/fxmanifest.lua': "fx_version 'cerulean'\ngame 'gta5'\n" });
  assert.equal(cli(['check', 'ok'], dir).code, 0);
  writeTree(dir, { 'ok/a.lua': '' });
  assert.equal(cli(['check', 'ok', '--strict'], dir).code, 1);
  const json = JSON.parse(cli(['check', 'ok', '--json'], dir).out);
  assert.equal(json.errors, 0);
  assert.ok(json.issues.some((issue) => issue.code === 'lua54-missing'));
  assert.equal(cli(['check', 'missing'], dir).code, 1);
});

test('add creates files and patches the manifest only when needed', (t) => {
  const dir = sandbox(t);
  cli(['create', 'shop', '--yes', '--no-git'], dir);
  const root = join(dir, 'shop');
  assert.equal(cli(['add', 'client', 'cart'], root).code, 0);
  assert.ok(existsSync(join(root, 'client/cart.lua')));
  const before = readFileSync(join(root, 'fxmanifest.lua'), 'utf8');
  assert.doesNotMatch(before, /client\/cart\.lua/);

  writeTree(root, { 'fxmanifest.lua': "fx_version 'cerulean'\ngame 'gta5'\nlua54 'yes'\nclient_script 'client/main.lua'\n" });
  assert.equal(cli(['add', 'client', 'menu'], root).code, 0);
  assert.match(readFileSync(join(root, 'fxmanifest.lua'), 'utf8'), /client_script 'client\/menu\.lua'/);

  assert.equal(cli(['add', 'nui'], root).code, 0);
  assert.equal(cli(['add', 'nui'], root).code, 1);
  assert.equal(cli(['add', 'locale', 'de'], root).code, 0);
  assert.match(readFileSync(join(root, 'locales/de.lua'), 'utf8'), /Locales\['de'\]/);
  assert.equal(cli(['add', 'client', 'cart'], root).code, 1);
  assert.equal(analyze(root).issues.filter((issue) => issue.level === 'error').length, 0);
});

test('pack ships only what the manifest uses', (t) => {
  const dir = sandbox(t);
  cli(['create', 'hud', '--nui', 'vanilla', '--yes', '--no-git'], dir);
  const root = join(dir, 'hud');
  writeTree(root, { 'notes/todo.txt': 'secret plans', 'stream/prop.ydr': 'binary' });
  const res = cli(['pack'], root);
  assert.equal(res.code, 0, res.out);
  const zip = readZip(readFileSync(join(root, 'dist/hud-1.0.0.zip')));
  const names = Object.keys(zip);
  assert.ok(names.includes('hud/fxmanifest.lua'));
  assert.ok(names.includes('hud/web/app.js'));
  assert.ok(names.includes('hud/stream/prop.ydr'));
  assert.ok(names.includes('hud/README.md'));
  assert.ok(!names.includes('hud/notes/todo.txt'));
  assert.ok(!names.includes('hud/.gitignore'));
  assert.equal(zip['hud/fxmanifest.lua'].toString(), readFileSync(join(root, 'fxmanifest.lua'), 'utf8'));

  const all = cli(['pack', '--all', '--out', join(dir, 'out')], root);
  assert.equal(all.code, 0, all.out);
  const full = Object.keys(readZip(readFileSync(join(dir, 'out/hud-1.0.0.zip'))));
  assert.ok(full.includes('hud/notes/todo.txt'));
  assert.ok(!full.some((name) => name.startsWith('hud/dist/')));
});

test('pack refuses broken resources unless forced', (t) => {
  const dir = sandbox(t);
  writeTree(dir, { 'broken/fxmanifest.lua': "fx_version 'cerulean'\ngame 'gta5'\nclient_script 'nope.lua'\n" });
  assert.equal(cli(['pack', 'broken'], dir).code, 1);
  assert.equal(cli(['pack', 'broken', '--force'], dir).code, 0);
});

test('zip writer roundtrip and crc', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  const big = Buffer.from('fivem '.repeat(500));
  const zip = createZip([
    { name: 'a/b.txt', data: Buffer.from('hi') },
    { name: 'big.txt', data: big },
    { name: 'é.lua', data: Buffer.alloc(0) },
  ]);
  const out = readZip(zip);
  assert.equal(out['a/b.txt'].toString(), 'hi');
  assert.ok(out['big.txt'].equals(big));
  assert.equal(out['é.lua'].length, 0);
});

test('help, version and unknown command', (t) => {
  const dir = sandbox(t);
  assert.match(cli(['--help'], dir).out, /Commands/);
  assert.match(cli(['--version'], dir).out, /^\d+\.\d+\.\d+/);
  assert.equal(cli(['explode'], dir).code, 1);
});

test('FreshDev logo is shown by default and hidden with --no-banner or --json', (t) => {
  const dir = sandbox(t);
  const created = cli(['create', 'logo', '--yes', '--no-git'], dir).out;
  assert.match(created, /███████╗██████╗/);
  assert.match(created, /crafted by FreshDev/);
  const plain = cli(['check', 'logo', '--no-banner'], dir).out;
  assert.doesNotMatch(plain, /███/);
  assert.match(plain, /▲ fxforge · check logo/);
  assert.doesNotMatch(cli(['check', 'logo', '--json'], dir).out, /███/);
  assert.match(cli(['--help'], dir).out, /crafted by FreshDev/);
  assert.doesNotMatch(cli(['--help', '--no-banner'], dir).out, /███/);
});
