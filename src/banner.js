const LOGO = [
  '███████╗██████╗ ███████╗███████╗██╗  ██╗██████╗ ███████╗██╗   ██╗',
  '██╔════╝██╔══██╗██╔════╝██╔════╝██║  ██║██╔══██╗██╔════╝██║   ██║',
  '█████╗  ██████╔╝█████╗  ███████╗███████║██║  ██║█████╗  ██║   ██║',
  '██╔══╝  ██╔══██╗██╔══╝  ╚════██║██╔══██║██║  ██║██╔══╝  ╚██╗ ██╔╝',
  '██║     ██║  ██║███████╗███████║██║  ██║██████╔╝███████╗ ╚████╔╝ ',
  '╚═╝     ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚══════╝  ╚═══╝  ',
];

const STOPS = [
  [0, 245, 160],
  [0, 217, 245],
  [123, 97, 255],
];

function colorSupport() {
  if (process.env.NO_COLOR || process.argv.includes('--no-color') || (!process.stdout.isTTY && !process.env.FORCE_COLOR)) return 'none';
  const term = `${process.env.COLORTERM ?? ''} ${process.env.TERM_PROGRAM ?? ''}`.toLowerCase();
  if (/truecolor|24bit|vscode|wezterm|iterm|hyper/.test(term) || process.env.WT_SESSION || process.platform === 'win32') return 'truecolor';
  return '256';
}

function mix(t) {
  const scaled = t * (STOPS.length - 1);
  const index = Math.min(Math.floor(scaled), STOPS.length - 2);
  const local = scaled - index;
  const [a, b] = [STOPS[index], STOPS[index + 1]];
  return a.map((value, i) => Math.round(value + (b[i] - value) * local));
}

function toAnsi256([r, g, b]) {
  const level = (value) => (value < 48 ? 0 : value < 115 ? 1 : Math.min(5, Math.round((value - 35) / 40)));
  return 16 + 36 * level(r) + 6 * level(g) + level(b);
}

function paint(ch, rgb, mode, shade) {
  const color = shade ? rgb.map((value) => Math.round(value * 0.38)) : rgb;
  if (mode === 'truecolor') return `\x1b[38;2;${color[0]};${color[1]};${color[2]}m${ch}`;
  return `\x1b[38;5;${toAnsi256(color)}m${ch}`;
}

export function renderBanner(name, tagline) {
  const mode = colorSupport();
  const width = LOGO[0].length;
  const lines = LOGO.map((row) => {
    if (mode === 'none') return `  ${row}`;
    let out = '  ';
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === ' ') {
        out += ' ';
        continue;
      }
      out += paint(ch, mix(i / (width - 1)), mode, ch !== '█');
    }
    return `${out}\x1b[0m`;
  });
  const rule = '─'.repeat(width);
  const dim = (text) => (mode === 'none' ? text : `\x1b[90m${text}\x1b[0m`);
  const accent = (text) => (mode === 'none' ? text : `${paint('', mix(0.5), mode, false)}\x1b[1m${text}\x1b[0m`);
  return ['', ...lines, `  ${dim(rule)}`, `  ${accent(name)} ${dim(tagline)}`, ''].join('\n');
}
