import { readFileSync } from 'node:fs';
import { renderBanner } from './banner.js';

const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const enabled = (Boolean(process.stdout.isTTY) || Boolean(process.env.FORCE_COLOR)) && !process.env.NO_COLOR;

const wrap = (code) => (text) => (enabled ? `\x1b[${code}m${text}\x1b[0m` : String(text));

export const c = {
  bold: wrap('1'),
  dim: wrap('2'),
  red: wrap('31'),
  green: wrap('32'),
  yellow: wrap('33'),
  blue: wrap('34'),
  magenta: wrap('35'),
  cyan: wrap('36'),
  gray: wrap('90'),
  orange: wrap('38;5;208'),
};

let showLogo = true;

export function setBanner(enabled) {
  showLogo = enabled;
}

export function banner(subtitle) {
  if (showLogo) {
    console.log(renderBanner('fxforge', `v${VERSION} · ${subtitle} · crafted by FreshDev`));
    return;
  }
  console.log(`\n ${c.orange('▲')} ${c.bold('fxforge')} ${c.gray('·')} ${c.gray(subtitle)}\n`);
}

export function printTree(paths) {
  const root = {};
  for (const path of paths) {
    let node = root;
    for (const part of path.split('/')) {
      node[part] = node[part] || {};
      node = node[part];
    }
  }
  const lines = [];
  const render = (node, prefix) => {
    const keys = Object.keys(node).sort((a, b) => {
      const aDir = Object.keys(node[a]).length > 0;
      const bDir = Object.keys(node[b]).length > 0;
      if (aDir !== bDir) return aDir ? -1 : 1;
      return a.localeCompare(b);
    });
    keys.forEach((key, index) => {
      const last = index === keys.length - 1;
      const isDir = Object.keys(node[key]).length > 0;
      lines.push(`${prefix}${c.gray(last ? '└─ ' : '├─ ')}${isDir ? c.blue(`${key}/`) : key}`);
      if (isDir) render(node[key], `${prefix}${c.gray(last ? '   ' : '│  ')}`);
    });
  };
  render(root, '  ');
  console.log(lines.join('\n'));
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
