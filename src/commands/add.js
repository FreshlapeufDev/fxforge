import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { analyze } from '../analyze.js';
import { FxError } from '../errors.js';
import { globToRegExp, isGlob, normalize } from '../glob.js';
import { localeFile } from '../templates/resource.js';
import { vanillaNui } from '../templates/nui.js';
import { banner, c } from '../ui.js';

const SCRIPT_KINDS = {
  client: { folder: 'client', key: 'client_script', list: 'client' },
  server: { folder: 'server', key: 'server_script', list: 'server' },
  shared: { folder: 'shared', key: 'shared_script', list: 'shared' },
};

const NAME_PATTERN = /^[a-z0-9_-]+$/i;

const pascal = (value) => value.replace(/(^|[_-])([a-z0-9])/gi, (_, __, ch) => ch.toUpperCase());

function scriptContent(kind, resource, name) {
  if (kind === 'client') return `RegisterNetEvent('${resource}:client:${name}', function()\nend)\n`;
  if (kind === 'server') return `RegisterNetEvent('${resource}:server:${name}', function()\n    local src = source\nend)\n`;
  return `${pascal(name)} = {}\n`;
}

function covers(patterns, file) {
  return patterns.some((entry) => {
    const value = normalize(entry.value);
    return isGlob(value) ? globToRegExp(value).test(file) : value === file;
  });
}

function writeNew(root, path, content) {
  const full = join(root, path);
  if (existsSync(full)) throw new FxError(`'${path}' already exists`);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  console.log(`  ${c.green('+')} ${path}`);
}

function appendToManifest(root, lines) {
  const manifestPath = join(root, 'fxmanifest.lua');
  const current = readFileSync(manifestPath, 'utf8');
  const prefix = current.endsWith('\n') ? '\n' : '\n\n';
  appendFileSync(manifestPath, `${prefix}${lines.join('\n')}\n`);
  for (const line of lines) if (line.trim()) console.log(`  ${c.cyan('~')} fxmanifest.lua ${c.gray(line.split('\n')[0])}`);
}

export async function add(args, flags) {
  const [kind, name] = args;
  const root = resolve(typeof flags.dir === 'string' ? flags.dir : '.');
  const usage = 'Usage: fxforge add <client|server|shared|locale|nui> [name]';
  if (!kind) throw new FxError('Missing what to add', usage);

  const result = analyze(root);
  if (!result.manifest) throw new FxError('No fxmanifest.lua here', 'Run this command from the resource root or pass --dir');
  const resource = basename(root);

  banner(`add ${kind}${name ? ` ${name}` : ''}`);

  if (SCRIPT_KINDS[kind]) {
    if (!name || !NAME_PATTERN.test(name)) throw new FxError(`A valid file name is required for ${kind}`, `Example: fxforge add ${kind} garage`);
    const spec = SCRIPT_KINDS[kind];
    const path = `${spec.folder}/${name}.lua`;
    writeNew(root, path, scriptContent(kind, resource, name));
    if (!covers(result.manifest[spec.list], path)) appendToManifest(root, [`${spec.key} '${path}'`]);
    console.log('');
    return 0;
  }

  if (kind === 'locale') {
    if (!name || !/^[a-z]{2}(-[a-z]{2})?$/i.test(name)) throw new FxError('A locale code is required', 'Example: fxforge add locale de');
    const code = name.toLowerCase();
    const path = `locales/${code}.lua`;
    const source = join(root, 'locales/en.lua');
    const content = existsSync(source)
      ? readFileSync(source, 'utf8').replace(/Locales\[\s*['"]en['"]\s*\]/, `Locales['${code}']`)
      : localeFile(code, resource, '%s');
    writeNew(root, path, content);
    if (!covers(result.manifest.shared, path)) appendToManifest(root, [`shared_script '${path}'`]);
    console.log(`\n  ${c.gray(`Translate the strings, then set Config.Locale = '${code}'`)}\n`);
    return 0;
  }

  if (kind === 'nui') {
    if (result.manifest.meta.ui_page) throw new FxError(`This resource already has a ui_page (${result.manifest.meta.ui_page.value})`);
    const nui = vanillaNui(resource);
    for (const entry of nui.entries) writeNew(root, entry.path, entry.content);
    appendToManifest(root, [`ui_page '${nui.uiPage}'`, '', `files {\n${nui.files.map((file) => `    '${file}'`).join(',\n')}\n}`]);
    console.log(`\n  ${c.gray("Open it from a client script with SetNuiFocus(true, true) and SendNUIMessage({ action = 'open' })")}\n`);
    return 0;
  }

  throw new FxError(`Unknown kind '${kind}'`, usage);
}
