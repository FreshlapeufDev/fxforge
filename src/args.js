const BOOLEAN_FLAGS = new Set(['yes', 'y', 'force', 'help', 'h', 'version', 'v', 'json', 'strict', 'all', 'no-git', 'verbose', 'no-banner']);

export function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
      if (eq !== -1) {
        flags[key] = arg.slice(eq + 1);
      } else if (BOOLEAN_FLAGS.has(key)) {
        flags[key] = true;
      } else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('-')) {
        flags[key] = argv[++i];
      } else {
        flags[key] = true;
      }
      continue;
    }
    if (arg.startsWith('-') && arg.length > 1) {
      for (const ch of arg.slice(1)) flags[ch] = true;
      continue;
    }
    positional.push(arg);
  }
  return { positional, flags };
}
