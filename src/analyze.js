import { existsSync, readFileSync } from 'node:fs';
import { basename, join, posix, resolve } from 'node:path';
import { readManifest } from './manifest.js';
import { globToRegExp, isGlob, normalize, walk } from './glob.js';

const KNOWN_FX_VERSIONS = ['cerulean', 'bodacious', 'adamant'];
const KNOWN_GAMES = ['gta5', 'rdr3', 'common'];
const BUILD_HINT = /(^|\/)(dist|build|out)(\/|$)/;

export function analyze(dir) {
  const root = resolve(dir);
  const issues = [];
  const add = (level, code, message, line, hint) => issues.push({ level, code, message, line, hint });
  const manifestPath = join(root, 'fxmanifest.lua');
  const result = { root, issues, manifest: null, files: [], resolved: null };

  if (!existsSync(root)) {
    add('error', 'no-directory', `Directory not found: ${root}`);
    return result;
  }

  if (!existsSync(manifestPath)) {
    if (existsSync(join(root, '__resource.lua'))) {
      add('error', 'legacy-manifest', '__resource.lua is deprecated and no longer supported by FiveM', undefined, 'Rename it to fxmanifest.lua and add fx_version \'cerulean\' + game \'gta5\'');
    } else {
      add('error', 'no-manifest', 'No fxmanifest.lua found in this folder', undefined, 'Run fxforge check from the resource root, or create one with fxforge create');
    }
    return result;
  }

  const manifest = readManifest(readFileSync(manifestPath, 'utf8'));
  const files = walk(root);
  const fileSet = new Set(files);
  const lowerMap = new Map(files.map((file) => [file.toLowerCase(), file]));
  const externalRefs = new Map();
  const resourceName = basename(root);
  result.manifest = manifest;
  result.files = files;

  const fxVersion = manifest.meta.fx_version;
  if (!fxVersion) {
    add('error', 'missing-fx-version', 'fx_version is missing', undefined, "Add fx_version 'cerulean' at the top of fxmanifest.lua");
  } else if (!KNOWN_FX_VERSIONS.includes(fxVersion.value)) {
    add('error', 'unknown-fx-version', `Unknown fx_version '${fxVersion.value}'`, fxVersion.line, `Expected one of: ${KNOWN_FX_VERSIONS.join(', ')}`);
  } else if (fxVersion.value !== 'cerulean') {
    add('warn', 'outdated-fx-version', `fx_version '${fxVersion.value}' is outdated`, fxVersion.line, "Use 'cerulean' to get the latest runtime features");
  }

  if (manifest.games.length === 0) {
    add('error', 'missing-game', 'game is missing', undefined, "Add game 'gta5' (or 'rdr3')");
  }
  for (const game of manifest.games) {
    if (!KNOWN_GAMES.includes(game.value)) add('warn', 'unknown-game', `Unknown game '${game.value}'`, game.line);
  }

  if (/[A-Z\s]/.test(resourceName)) {
    add('warn', 'resource-name', `Folder name '${resourceName}' contains uppercase letters or spaces`, undefined, 'Use lowercase, digits, - and _ only to avoid ensure/start issues');
  }

  const lookup = (raw, kind, line, { required = true } = {}) => {
    const value = normalize(raw);
    if (value.startsWith('@')) {
      const dep = value.slice(1).split('/')[0];
      if (!externalRefs.has(dep)) externalRefs.set(dep, line);
      return [];
    }
    if (/^(https?|nui):\/\//.test(value)) return [];
    if (isGlob(value)) {
      const pattern = globToRegExp(value);
      const matched = files.filter((file) => pattern.test(file));
      if (matched.length === 0) {
        const loose = globToRegExp(value, 'i');
        const caseOnly = files.filter((file) => loose.test(file));
        if (caseOnly.length > 0) {
          add('error', 'case-mismatch', `${kind} '${value}' only matches '${caseOnly[0]}' with different casing`, line, 'Works on Windows, breaks on Linux servers');
          return caseOnly;
        }
        if (required) {
          add('warn', 'empty-glob', `${kind} pattern '${value}' matches no file`, line, BUILD_HINT.test(value) ? 'Looks like a build output: run your UI build first' : undefined);
        }
      }
      return matched;
    }
    if (fileSet.has(value)) return [value];
    const caseOnly = lowerMap.get(value.toLowerCase());
    if (caseOnly) {
      add('error', 'case-mismatch', `${kind} '${value}' only exists as '${caseOnly}'`, line, 'Works on Windows, breaks on Linux servers');
      return [caseOnly];
    }
    if (required) {
      add('error', 'missing-file', `${kind} '${value}' does not exist`, line, BUILD_HINT.test(value) ? 'Looks like a build output: run your UI build first' : undefined);
    }
    return [];
  };

  const collect = (list, kind) => {
    const set = new Set();
    const seen = new Map();
    for (const entry of list) {
      const key = normalize(entry.value);
      if (seen.has(key)) add('warn', 'duplicate-entry', `${kind} '${key}' is listed twice`, entry.line);
      seen.set(key, entry.line);
      for (const file of lookup(entry.value, kind, entry.line)) set.add(file);
    }
    return set;
  };

  const client = collect(manifest.client, 'client_script');
  const server = collect(manifest.server, 'server_script');
  const shared = collect(manifest.shared, 'shared_script');
  const shipped = collect(manifest.files, 'file');
  const extras = new Set();

  for (const data of manifest.dataFiles) {
    for (const file of lookup(data.value, `data_file ${data.type}`, data.line)) {
      extras.add(file);
      if (!shipped.has(file)) {
        add('warn', 'data-file-not-shipped', `data_file '${file}' is not listed in files`, data.line, 'Clients will never download it');
      }
    }
  }

  for (const key of ['ui_page', 'loadscreen']) {
    const entry = manifest.meta[key];
    if (!entry) continue;
    const value = normalize(entry.value);
    if (/^https?:\/\//.test(value)) continue;
    const found = lookup(value, key, entry.line);
    for (const file of found) {
      extras.add(file);
      if (!shipped.has(file)) {
        add('error', `${key.replace('_', '-')}-not-shipped`, `${key} '${file}' is not listed in files`, entry.line, 'The page will be blank in game');
      }
      checkHtmlAssets(root, file, shipped, fileSet, add);
    }
  }

  const scriptFiles = new Set([...client, ...server, ...shared]);

  for (const file of server) {
    if (shipped.has(file) && !shared.has(file) && !client.has(file)) {
      add('error', 'server-file-exposed', `Server script '${file}' is also listed in files`, undefined, 'Every client downloads it: never ship server code or secrets');
    }
  }

  for (const file of client) {
    if (server.has(file) && !shared.has(file)) {
      add('warn', 'client-server-overlap', `'${file}' is loaded on both client and server`, undefined, 'Move it to shared_scripts');
    }
  }

  const luaFiles = files.filter((file) => file.endsWith('.lua') && file !== 'fxmanifest.lua');
  if (luaFiles.length > 0) {
    const lua54 = manifest.meta.lua54;
    if (!lua54) {
      add('warn', 'lua54-missing', 'lua54 is not enabled', undefined, "Add lua54 'yes' for Lua 5.4 (faster, integers, <const>/<close>)");
    } else if (lua54.value !== 'yes') {
      add('warn', 'lua54-missing', `lua54 is set to '${lua54.value}'`, lua54.line, "Use lua54 'yes'");
    }
  }

  for (const file of luaFiles) {
    if (file.startsWith('stream/')) continue;
    if (!scriptFiles.has(file) && !shipped.has(file) && !extras.has(file)) {
      add('info', 'unreferenced-lua', `'${file}' is never loaded by the manifest`);
    }
  }

  const declared = new Set(manifest.dependencies.map((dep) => dep.value.split(/[\s:]/)[0].replace(/^\//, '')));
  for (const [dep, line] of externalRefs) {
    if (dep === resourceName || declared.has(dep)) continue;
    add('warn', 'undeclared-dependency', `'@${dep}/…' is used but '${dep}' is not in dependencies`, line, 'The resource may start before it and crash');
  }

  for (const key of ['version', 'author', 'description']) {
    if (!manifest.meta[key]) add('info', 'missing-metadata', `No ${key} set`);
  }

  result.resolved = { client, server, shared, files: shipped, extras };
  return result;
}

function checkHtmlAssets(root, page, shipped, fileSet, add) {
  if (!/\.html?$/i.test(page)) return;
  let html;
  try {
    html = readFileSync(join(root, page), 'utf8');
  } catch {
    return;
  }
  const base = posix.dirname(page);
  const refs = new Set();
  const attr = /<(?:script|link|img|source|audio|video)\b[^>]*?\s(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = attr.exec(html)) !== null) refs.add(match[1]);
  for (const ref of refs) {
    if (/^(?:[a-z]+:)?\/\//i.test(ref) || ref.startsWith('data:') || ref.startsWith('#')) continue;
    const clean = ref.split(/[?#]/)[0];
    const target = clean.startsWith('/') ? normalize(posix.join(base, clean)) : normalize(posix.join(base, clean));
    if (!fileSet.has(target)) {
      add('warn', 'nui-asset-missing', `${page} references '${ref}' which does not exist`);
    } else if (!shipped.has(target)) {
      add('error', 'nui-asset-not-shipped', `${page} loads '${target}' but it is not listed in files`, undefined, 'It will 404 in game');
    }
  }
}

export function summarize(issues) {
  return {
    errors: issues.filter((issue) => issue.level === 'error').length,
    warnings: issues.filter((issue) => issue.level === 'warn').length,
    infos: issues.filter((issue) => issue.level === 'info').length,
  };
}
