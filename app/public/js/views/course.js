import { fetchCourses, fetchCourse } from '../api.js';
import { mdToHtml, setupCopyButtons } from '../markdown.js';
import { markCourseRead, load, refreshNav } from '../gamification.js';

export default async function renderCourse(slug) {
  const [courses, data] = await Promise.all([fetchCourses(), fetchCourse(slug)]);
  if (data.error) return notFound(slug);

  const idx  = courses.findIndex(c => c.slug === slug);
  const prev = courses[idx - 1];
  const next = courses[idx + 1];
  const done = load().courses.includes(slug);

  const html = `
<div class="page-narrow page-enter">
  <div class="read-progress" id="read-progress"></div>
  <div class="breadcrumb">
    <a href="/cours" data-link>Cours</a> <span>›</span>
    <span>${courses[idx]?.title || slug}</span>
  </div>
  <div class="article" id="article-content">
    ${mdToHtml(data.markdown)}
  </div>
  <div class="article-nav">
    <div>${prev ? `<a href="/cours/${prev.slug}" data-link>← ${prev.title}</a>` : ''}</div>
    <div>${next ? `<a href="/cours/${next.slug}" data-link>${next.title} →</a>` : ''}</div>
  </div>
</div>`;

  // Post-render side effects
  requestAnimationFrame(() => {
    const article = document.getElementById('article-content');
    const bar     = document.getElementById('read-progress');
    if (article) setupCopyButtons(article);

    if (!done && bar) {
      let marked = false;
      const onScroll = () => {
        const rect = article.getBoundingClientRect();
        const pct  = Math.min(1, (window.innerHeight - rect.top) / (rect.height + window.innerHeight - rect.top));
        bar.style.width = Math.round(pct * 100) + '%';
        if (pct >= 0.9 && !marked) {
          marked = true;
          const total = _getCounts();
          markCourseRead(slug, total.courses, total.exercises);
          refreshNav();
          bar.style.background = 'var(--teal)';
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      window.__cleanupScroll = () => window.removeEventListener('scroll', onScroll);
    } else if (done && bar) {
      bar.style.width = '100%';
      bar.style.background = 'var(--teal)';
    }
  });

  return html;
}

async function _getCounts() {
  const [courses, exercises] = await Promise.all([
    fetch('/api/courses').then(r => r.json()),
    fetch('/api/exercises').then(r => r.json()),
  ]);
  return { courses: courses.length, exercises: exercises.length };
}

function notFound(slug) {
  return `<div class="not-found"><div class="code">404</div><h1>Cours introuvable</h1><p>${slug}</p><a href="/cours" data-link>← Retour aux cours</a></div>`;
}
