const LIST_KEYS = {
  client_script: 'client',
  client_scripts: 'client',
  server_script: 'server',
  server_scripts: 'server',
  shared_script: 'shared',
  shared_scripts: 'shared',
  file: 'files',
  files: 'files',
  dependency: 'dependencies',
  dependencies: 'dependencies',
  game: 'games',
  games: 'games',
};

function countLines(src, from, to) {
  let n = 0;
  for (let i = from; i < to; i++) if (src[i] === '\n') n++;
  return n;
}

function matchLongBracket(src, start) {
  if (src[start] !== '[') return null;
  let j = start + 1;
  let level = 0;
  while (src[j] === '=') {
    level++;
    j++;
  }
  if (src[j] !== '[') return null;
  const close = `]${'='.repeat(level)}]`;
  const endIndex = src.indexOf(close, j + 1);
  let content = endIndex === -1 ? src.slice(j + 1) : src.slice(j + 1, endIndex);
  if (content.startsWith('\r\n')) content = content.slice(2);
  else if (content.startsWith('\n')) content = content.slice(1);
  return { content, end: endIndex === -1 ? src.length : endIndex + close.length };
}

export function tokenize(src) {
  const tokens = [];
  const n = src.length;
  let i = 0;
  let line = 1;
  while (i < n) {
    const ch = src[i];
    if (ch === '\n') {
      line++;
      i++;
      continue;
    }
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\f' || ch === '\v' || ch === '﻿') {
      i++;
      continue;
    }
    if (ch === '-' && src[i + 1] === '-') {
      i += 2;
      const long = matchLongBracket(src, i);
      if (long) {
        line += countLines(src, i, long.end);
        i = long.end;
        continue;
      }
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (ch === '[') {
      const long = matchLongBracket(src, i);
      if (long) {
        tokens.push({ type: 'string', value: long.content, line });
        line += countLines(src, i, long.end);
        i = long.end;
        continue;
      }
    }
    if (ch === '"' || ch === "'") {
      const startLine = line;
      let value = '';
      i++;
      while (i < n && src[i] !== ch) {
        if (src[i] === '\\' && i + 1 < n) {
          const next = src[i + 1];
          const map = { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'" };
          value += map[next] ?? next;
          i += 2;
          continue;
        }
        if (src[i] === '\n') line++;
        value += src[i];
        i++;
      }
      i++;
      tokens.push({ type: 'string', value, line: startLine });
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
      tokens.push({ type: 'ident', value: src.slice(i, j), line });
      i = j;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let j = i + 1;
      while (j < n && /[0-9A-Fa-fxX._]/.test(src[j])) j++;
      tokens.push({ type: 'number', value: src.slice(i, j), line });
      i = j;
      continue;
    }
    tokens.push({ type: 'symbol', value: ch, line });
    i++;
  }
  return tokens;
}

export function parseEntries(src) {
  const tokens = tokenize(src);
  const entries = [];
  let p = 0;

  const isSymbol = (token, value) => token && token.type === 'symbol' && token.value === value;

  const readValue = () => {
    const token = tokens[p];
    if (!token) return null;
    if (token.type === 'string' || token.type === 'number') {
      p++;
      return [token.value];
    }
    if (isSymbol(token, '(')) {
      p++;
      const values = [];
      while (p < tokens.length && !isSymbol(tokens[p], ')')) {
        if (isSymbol(tokens[p], ',')) {
          p++;
          continue;
        }
        const value = readValue();
        if (value) values.push(...value);
        else p++;
      }
      p++;
      return values;
    }
    if (isSymbol(token, '{')) {
      p++;
      const values = [];
      while (p < tokens.length && !isSymbol(tokens[p], '}')) {
        const current = tokens[p];
        if (isSymbol(current, ',') || isSymbol(current, ';')) {
          p++;
          continue;
        }
        if (current.type === 'ident' && isSymbol(tokens[p + 1], '=')) {
          p += 2;
          readValue();
          continue;
        }
        if (isSymbol(current, '[')) {
          while (p < tokens.length && !isSymbol(tokens[p], ']')) p++;
          p++;
          if (isSymbol(tokens[p], '=')) p++;
          readValue();
          continue;
        }
        const value = readValue();
        if (value) values.push(...value);
        else p++;
      }
      p++;
      return values;
    }
    return null;
  };

  while (p < tokens.length) {
    const token = tokens[p];
    if (token.type !== 'ident') {
      p++;
      continue;
    }
    p++;
    const values = readValue();
    if (!values) continue;
    while (tokens[p] && (tokens[p].type === 'string' || tokens[p].type === 'number')) {
      values.push(tokens[p].value);
      p++;
    }
    entries.push({ key: token.value, values: values.map(String), line: token.line });
  }
  return entries;
}

export function readManifest(src) {
  const entries = parseEntries(src);
  const manifest = {
    client: [],
    server: [],
    shared: [],
    files: [],
    dependencies: [],
    games: [],
    dataFiles: [],
    meta: {},
    entries,
  };
  for (const entry of entries) {
    const list = LIST_KEYS[entry.key];
    if (list) {
      for (const value of entry.values) manifest[list].push({ value, line: entry.line });
      continue;
    }
    if (entry.key === 'data_file') {
      if (entry.values[1]) manifest.dataFiles.push({ type: entry.values[0], value: entry.values[1], line: entry.line });
      continue;
    }
    if (!(entry.key in manifest.meta)) {
      manifest.meta[entry.key] = { value: entry.values[0], line: entry.line };
    }
  }
  return manifest;
}
