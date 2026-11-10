import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULT_IGNORE = new Set(['.git', 'node_modules', '.vscode', '.idea', '.DS_Store', 'Thumbs.db']);

export function normalize(path) {
  return String(path).replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/{2,}/g, '/');
}

export function isGlob(pattern) {
  return /[*?]/.test(pattern);
}

export function globToRegExp(pattern, flags = '') {
  let source = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        if (pattern[i + 2] === '/') {
          source += '(?:.*/)?';
          i += 3;
        } else {
          source += '.*';
          i += 2;
        }
      } else {
        source += '[^/]*';
        i += 1;
      }
      continue;
    }
    if (ch === '?') {
      source += '[^/]';
      i += 1;
      continue;
    }
    source += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    i += 1;
  }
  return new RegExp(`^${source}$`, flags);
}

export function walk(root, ignore = DEFAULT_IGNORE) {
  const out = [];
  const visit = (dir, rel) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (ignore.has(entry.name)) continue;
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) visit(join(dir, entry.name), relPath);
      else if (entry.isFile()) out.push(relPath);
    }
  };
  visit(root, '');
  return out.sort();
}
