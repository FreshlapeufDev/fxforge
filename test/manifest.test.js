import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readManifest } from '../src/manifest.js';
import { globToRegExp } from '../src/glob.js';
import { parseArgs } from '../src/args.js';

test('reads strings, tables, calls and long strings', () => {
  const m = readManifest(`
fx_version "cerulean"
games { 'gta5', "rdr3" }
lua54 'yes'
description [[multi
line]]
client_script('client/a.lua')
client_scripts {
  'client/b.lua';
  "client/*.lua",
}
server_scripts { 'server/*.lua' }
shared_scripts { '@ox_lib/init.lua', 'config.lua' }
files { 'web/**' }
dependencies { '/server:7290', 'ox_lib' }
data_file 'DLC_ITYP_REQUEST' 'stream/props.ytyp'
my_data 'one' { two = 42, ['three'] = 'x' }
`);
  assert.equal(m.meta.fx_version.value, 'cerulean');
  assert.deepEqual(m.games.map((g) => g.value), ['gta5', 'rdr3']);
  assert.equal(m.meta.description.value, 'multi\nline');
  assert.deepEqual(m.client.map((s) => s.value), ['client/a.lua', 'client/b.lua', 'client/*.lua']);
  assert.deepEqual(m.shared.map((s) => s.value), ['@ox_lib/init.lua', 'config.lua']);
  assert.deepEqual(m.dataFiles, [{ type: 'DLC_ITYP_REQUEST', value: 'stream/props.ytyp', line: 16 }]);
  assert.deepEqual(m.dependencies.map((d) => d.value), ['/server:7290', 'ox_lib']);
});

test('ignores line and block comments', () => {
  const m = readManifest(`
-- client_script 'nope.lua'
--[==[
server_script 'nope.lua'
]==]
server_script 'yes.lua' -- trailing
`);
  assert.deepEqual(m.server.map((s) => s.value), ['yes.lua']);
  assert.equal(m.client.length, 0);
  assert.equal(m.server[0].line, 6);
});

test('glob matching follows FiveM semantics', () => {
  assert.ok(globToRegExp('client/*.lua').test('client/main.lua'));
  assert.ok(!globToRegExp('client/*.lua').test('client/sub/main.lua'));
  assert.ok(globToRegExp('web/**').test('web/dist/assets/index.js'));
  assert.ok(globToRegExp('client/**/*.lua').test('client/main.lua'));
  assert.ok(globToRegExp('client/**/*.lua').test('client/a/b/c.lua'));
  assert.ok(!globToRegExp('client/*.lua').test('client/main.luac'));
});

test('argument parser handles values, booleans and short flags', () => {
  const { positional, flags } = parseArgs(['create', 'garage', '--framework', 'esx', '--yes', '--nui=vite', '-f', 'extra']);
  assert.deepEqual(positional, ['create', 'garage', 'extra']);
  assert.equal(flags.framework, 'esx');
  assert.equal(flags.yes, true);
  assert.equal(flags.nui, 'vite');
  assert.equal(flags.f, true);
});
