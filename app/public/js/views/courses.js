import { fetchCourses } from '../api.js';
import { load } from '../gamification.js';

export default async function renderCourses() {
  const courses = await fetchCourses();
  const state   = load();

  const cards = courses.map((c, i) => {
    const done = state.courses.includes(c.slug);
    return `
    <a href="/cours/${c.slug}" class="card${done ? ' done' : ''}" data-link>
      ${done ? '<div class="done-check">✓</div>' : ''}
      <div class="card-meta">
        <span class="badge badge-dur">⏱ ${c.duration}</span>
        <span class="card-number">${String(i+1).padStart(2,'0')}</span>
      </div>
      <h2>${c.title}</h2>
      <p>${c.desc || 'Chapitre ' + (i+1)}</p>
    </a>`;
  }).join('');

  return `
<div class="page page-enter">
  <div class="section-header">
    <h1>Cours</h1>
    <p>Lire dans l'ordre. ${courses.length} chapitres — environ 1h45 au total.</p>
  </div>
  <div class="cards-grid">${cards}</div>
</div>`;
}
