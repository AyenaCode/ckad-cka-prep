/**
 * K8s Learn — Serveur API + fichiers statiques
 * Toute la logique UI est dans public/
 */
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const { spawn } = require('child_process');

const PUBLIC_DIR    = path.join(__dirname, 'public');
const EXERCICES_DIR = (() => {
  const d = path.join(__dirname, 'exercices');
  return fs.existsSync(d) ? d : path.join(__dirname, '..', 'exercices');
})();
const COURSES_DIR = (() => {
  const d = path.join(__dirname, 'courses');
  return fs.existsSync(d) ? d : path.join(__dirname, '..', 'courses');
})();
const RESET_SCRIPT = path.join(EXERCICES_DIR, 'reset.sh');

const MIME = {
  '.html':  'text/html; charset=utf-8',
  '.css':   'text/css; charset=utf-8',
  '.js':    'application/javascript; charset=utf-8',
  '.json':  'application/json',
  '.svg':   'image/svg+xml',
  '.ico':   'image/x-icon',
  '.woff2': 'font/woff2',
};

function serveFile(res, filePath) {
  try {
    const data = fs.readFileSync(filePath);
    const ext  = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    serveIndex(res);
  }
}

function serveIndex(res) {
  const html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'));
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function json(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  });
  res.end(JSON.stringify(data));
}

// ─── Données ──────────────────────────────────────────────────────────────────

function loadCourses() {
  if (!fs.existsSync(COURSES_DIR)) return [];
  return fs.readdirSync(COURSES_DIR)
    .filter(f => f.endsWith('.md'))
    .sort()
    .map(file => {
      const slug  = file.slice(0, -3);
      const raw   = fs.readFileSync(path.join(COURSES_DIR, file), 'utf8');
      const lines = raw.split('\n');
      const h1    = lines.find(l => l.startsWith('# ')) || '';
      const title = h1.slice(2).trim().replace(/^\d+\s*[—–-]\s*/, '');
      const bq    = lines.find(l => l.startsWith('>')) || '';
      const desc  = bq.replace(/^>\s*/, '').replace(/\*\*[^*]+\*\*\s*:\s*/, '').replace(/\*([^*]+)\*/g, '$1').trim();
      const words = raw.split(/\s+/).filter(Boolean).length;
      return { slug, title: title || slug, desc, duration: Math.max(1, Math.round(words / 200)) + ' min' };
    });
}

const COURSES = loadCourses();

const EXERCISES = [
  { id: 'ticket-001', title: 'App injoignable',             level: 'Facile',    concept: 'Selector typo',        ns: 'exo-001' },
  { id: 'ticket-002', title: 'Déploiement bloqué',          level: 'Facile',    concept: 'ImagePullBackOff',     ns: 'exo-002' },
  { id: 'ticket-003', title: 'Connection refused',          level: 'Moyen',     concept: 'targetPort mismatch',  ns: 'exo-003' },
  { id: 'ticket-004', title: 'Pods en crash loop',          level: 'Moyen',     concept: 'ConfigMap manquant',   ns: 'exo-004' },
  { id: 'ticket-005', title: 'Mise en prod catastrophique', level: 'Difficile', concept: 'Stack multi-services', ns: 'exo-005' },
  { id: 'ticket-006', title: 'Pods jamais Ready',           level: 'Moyen',     concept: 'Probe mal configurée', ns: 'exo-006' },
  { id: 'ticket-007', title: 'Cache qui meurt en boucle',   level: 'Moyen',     concept: 'OOMKilled',            ns: 'exo-007' },
  { id: 'ticket-008', title: 'Service paiement HS',         level: 'Moyen',     concept: 'Secret manquant',      ns: 'exo-008' },
  { id: 'ticket-009', title: 'Worker qui ne démarre pas',   level: 'Facile',    concept: 'Mauvais args/command', ns: 'exo-009' },
  { id: 'ticket-010', title: 'Application bloquée (Init)',  level: 'Moyen',     concept: 'Init container',       ns: 'exo-010' },
];

// ─── SSE stream ───────────────────────────────────────────────────────────────

function sseStream(res, script, cwd, timeout) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send  = obj => res.write('data: ' + JSON.stringify(obj) + '\n\n');
  const child = spawn('bash', [script], { cwd });
  const timer = setTimeout(() => child.kill(), timeout);
  child.on('error', err => {
    clearTimeout(timer);
    send({ type: 'err', text: 'Erreur: ' + err.message + '\n' });
    send({ type: 'done', ok: false });
    res.end();
  });
  child.stdout.on('data', d => send({ type: 'out', text: d.toString() }));
  child.stderr.on('data', d => send({ type: 'err', text: d.toString() }));
  child.on('close', code => {
    clearTimeout(timer);
    send({ type: 'done', ok: code === 0 });
    res.end();
  });
}

// ─── Serveur ──────────────────────────────────────────────────────────────────

http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // API JSON
  if (url === '/api/courses') return json(res, COURSES);

  if (url.startsWith('/api/courses/')) {
    const slug = url.slice(13);
    const file = path.join(COURSES_DIR, slug + '.md');
    if (!fs.existsSync(file)) return json(res, { error: 'not found' }, 404);
    return json(res, { markdown: fs.readFileSync(file, 'utf8') });
  }

  if (url === '/api/exercises') return json(res, EXERCISES);

  if (req.method === 'GET' && url.startsWith('/api/exercises/')) {
    const id   = url.slice(15);
    const ex   = EXERCISES.find(e => e.id === id);
    if (!ex) return json(res, { error: 'not found' }, 404);
    const file = path.join(EXERCICES_DIR, id, 'mission.md');
    if (!fs.existsSync(file)) return json(res, { error: 'mission.md introuvable' }, 404);
    return json(res, { ...ex, markdown: fs.readFileSync(file, 'utf8') });
  }

  // API SSE
  if (req.method === 'POST' && url.startsWith('/api/deploy/')) {
    const id     = url.slice(12);
    const ex     = EXERCISES.find(e => e.id === id);
    if (!ex) return json(res, { error: 'not found' }, 404);
    const script = path.join(EXERCICES_DIR, id, 'deploy.sh');
    if (!fs.existsSync(script)) return json(res, { error: 'deploy.sh introuvable' }, 404);
    return sseStream(res, script, EXERCICES_DIR, 30000);
  }

  if (req.method === 'POST' && url === '/api/reset') {
    if (!fs.existsSync(RESET_SCRIPT)) return json(res, { error: 'reset.sh introuvable' }, 404);
    return sseStream(res, RESET_SCRIPT, EXERCICES_DIR, 60000);
  }

  // Crash demo (liveness probe)
  if (url === '/error') {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error\n');
    process.exit(1);
  }

  // Fichiers statiques
  const ext = path.extname(url);
  if (ext) return serveFile(res, path.join(PUBLIC_DIR, url));

  // SPA fallback
  serveIndex(res);

}).listen(process.env.PORT || 3000, () => {
  console.log(`K8s Learn — http://localhost:${process.env.PORT || 3000}`);
});
