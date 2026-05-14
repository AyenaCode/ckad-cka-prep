import renderHome      from './views/home.js';
import renderCourses   from './views/courses.js';
import renderCourse    from './views/course.js';
import renderExercises from './views/exercises.js';
import renderExercise  from './views/exercise.js';

const app = () => document.getElementById('app');

const ROUTES = [
  { pattern: /^\/$/,                fn: () => renderHome() },
  { pattern: /^\/cours$/,           fn: () => renderCourses() },
  { pattern: /^\/cours\/(.+)$/,     fn: m  => renderCourse(m[1]) },
  { pattern: /^\/exercices$/,       fn: () => renderExercises() },
  { pattern: /^\/exercices\/(.+)$/, fn: m  => renderExercise(m[1]) },
];

async function render(path) {
  // Cleanup previous scroll listener if any
  if (window.__cleanupScroll) { window.__cleanupScroll(); delete window.__cleanupScroll; }

  // Update nav active state
  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', path.startsWith(a.getAttribute('href')));
  });

  for (const route of ROUTES) {
    const m = path.match(route.pattern);
    if (m) {
      try {
        const html = await route.fn(m);
        app().innerHTML = html;
        window.scrollTo(0, 0);
        return;
      } catch (err) {
        app().innerHTML = `<div class="not-found"><div class="code">500</div><h1>Erreur</h1><p>${err.message}</p></div>`;
        return;
      }
    }
  }

  app().innerHTML = `<div class="not-found"><div class="code">404</div><h1>Page introuvable</h1><p>${path}</p><a href="/" data-link>← Accueil</a></div>`;
}

export function navigate(path) {
  history.pushState({}, '', path);
  render(path);
}

export function init() {
  // Intercept all [data-link] clicks
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-link]');
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute('href');
    if (href && href !== location.pathname) navigate(href);
  });

  // Browser back/forward
  window.addEventListener('popstate', () => render(location.pathname));

  // Initial render
  render(location.pathname);
}
