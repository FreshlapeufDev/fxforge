const VITE_VERSION = '^8.3.7';
const TYPESCRIPT_VERSION = '^7.0.2';

const style = `:root {
    --ink: #f4f1ea;
    --mute: #8d8a83;
    --ground: rgba(12, 12, 14, 0.94);
    --line: rgba(244, 241, 234, 0.14);
    --accent: #ff7a1a;
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

html,
body {
    width: 100%;
    height: 100%;
    background: transparent;
    overflow: hidden;
    font-family: 'Segoe UI', system-ui, sans-serif;
    color: var(--ink);
    user-select: none;
}

.dock {
    position: absolute;
    top: 50%;
    right: 0;
    width: 340px;
    transform: translate(0, -50%);
    background: var(--ground);
    border-left: 3px solid var(--accent);
    clip-path: polygon(24px 0, 100% 0, 100% 100%, 0 100%, 0 24px);
    animation: slide 0.22s cubic-bezier(0.2, 0.9, 0.3, 1);
}

.dock[hidden] {
    display: none;
}

.dock__rail {
    display: flex;
    justify-content: space-between;
    padding: 10px 18px 10px 32px;
    font: 600 10px/1 ui-monospace, 'Cascadia Mono', Consolas, monospace;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--mute);
    border-bottom: 1px solid var(--line);
    background: repeating-linear-gradient(135deg, transparent 0 6px, rgba(255, 122, 26, 0.06) 6px 7px);
}

.dock__title {
    padding: 22px 18px 6px;
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.02em;
}

.dock__text {
    padding: 0 18px 22px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--mute);
}

.dock__action {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 16px 18px;
    border: 0;
    border-top: 1px solid var(--line);
    background: transparent;
    color: var(--ink);
    font: 700 12px/1 ui-monospace, 'Cascadia Mono', Consolas, monospace;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
}

.dock__action::after {
    content: '→';
    font-size: 16px;
    transition: transform 0.15s;
}

.dock__action:hover {
    background: var(--accent);
    color: #111;
}

.dock__action:hover::after {
    transform: translateX(4px);
}

.dock__keys {
    padding: 10px 18px;
    font: 10px/1 ui-monospace, 'Cascadia Mono', Consolas, monospace;
    color: var(--mute);
    border-top: 1px solid var(--line);
}

kbd {
    padding: 2px 6px;
    margin-right: 6px;
    border: 1px solid var(--line);
    color: var(--ink);
    font: inherit;
}

@keyframes slide {
    from {
        opacity: 0;
        transform: translate(40px, -50%);
    }
}
`;

const markup = (name, head, body) => `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${name}</title>
${head}
</head>
<body>
    <main id="dock" class="dock" hidden>
        <div class="dock__rail"><span>${name}</span><span id="clock"></span></div>
        <h1 id="title" class="dock__title"></h1>
        <p class="dock__text">Edit web files and restart the resource to see your changes.</p>
        <button id="ping" class="dock__action" type="button">Ping the server</button>
        <div class="dock__keys"><kbd>ESC</kbd>close</div>
    </main>
${body}
</body>
</html>
`;

const script = (name, typed) => {
  const t = (annotation) => (typed ? annotation : '');
  return `const dock = document.getElementById('dock')${t(' as HTMLElement')};
const title = document.getElementById('title')${t(' as HTMLElement')};
const clock = document.getElementById('clock')${t(' as HTMLElement')};
const resource = typeof (window as any).GetParentResourceName === 'function' ? (window as any).GetParentResourceName() : '${name}';

const post = (event${t(': string')}, data${t(': unknown')} = {}) =>
    fetch(\`https://\${resource}/\${event}\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(data),
    }).catch(() => null);

const tick = () => {
    clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

window.addEventListener('message', (event${t(': MessageEvent')}) => {
    const data = event.data${t(' as { action?: string; title?: string }')};
    if (data.action === 'open') {
        title.textContent = data.title ?? '';
        tick();
        dock.hidden = false;
    }
    if (data.action === 'close') dock.hidden = true;
});

document.addEventListener('keydown', (event${t(': KeyboardEvent')}) => {
    if (event.key === 'Escape' && !dock.hidden) post('close');
});

document.getElementById('ping')${t('!')}.addEventListener('click', () => post('ping'));
`.replace(/\(window as any\)/g, typed ? '(window as any)' : 'window');
};

export function vanillaNui(name) {
  return {
    uiPage: 'web/index.html',
    files: ['web/index.html', 'web/style.css', 'web/app.js'],
    entries: [
      { path: 'web/index.html', content: markup(name, '    <link rel="stylesheet" href="style.css">', '    <script src="app.js"></script>') },
      { path: 'web/style.css', content: style },
      { path: 'web/app.js', content: script(name, false) },
    ],
  };
}

export function viteNui(name) {
  return {
    uiPage: 'web/dist/index.html',
    files: ['web/dist/**'],
    entries: [
      {
        path: 'web/package.json',
        content: `${JSON.stringify(
          {
            name: `${name}-ui`,
            private: true,
            type: 'module',
            scripts: { dev: 'vite', build: 'vite build' },
            devDependencies: { typescript: TYPESCRIPT_VERSION, vite: VITE_VERSION },
          },
          null,
          2,
        )}\n`,
      },
      {
        path: 'web/vite.config.ts',
        content: `import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        assetsDir: 'assets',
    },
});
`,
      },
      {
        path: 'web/tsconfig.json',
        content: `${JSON.stringify(
          {
            compilerOptions: {
              target: 'ES2022',
              module: 'ESNext',
              moduleResolution: 'bundler',
              lib: ['ES2022', 'DOM'],
              strict: true,
              noEmit: true,
              skipLibCheck: true,
              types: ['vite/client'],
            },
            include: ['src'],
          },
          null,
          2,
        )}\n`,
      },
      { path: 'web/index.html', content: markup(name, '', '    <script type="module" src="/src/main.ts"></script>') },
      { path: 'web/src/main.ts', content: `import './style.css';\n\n${script(name, true)}` },
      { path: 'web/src/style.css', content: style },
    ],
  };
}
