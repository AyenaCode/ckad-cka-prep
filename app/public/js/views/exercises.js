import { fetchExercises } from '../api.js';
import { load } from '../gamification.js';

const LEVEL_CLASS = { Facile: 'badge-easy', Moyen: 'badge-med', Difficile: 'badge-hard' };

export default async function renderExercises() {
  const exercises = await fetchExercises();
  const state     = load();

  const cards = exercises.map((ex, i) => {
    const done = state.exercises.includes(ex.id);
    return `
    <a href="/exercices/${ex.id}" class="card${done ? ' done' : ''}" data-link>
      ${done ? '<div class="done-check">✓</div>' : ''}
      <div class="card-meta">
        <span class="badge ${LEVEL_CLASS[ex.level] || 'badge-tag'}">${ex.level}</span>
        <span class="badge badge-tag">${ex.concept}</span>
      </div>
      <h2>${ex.title}</h2>
      <p><span class="badge badge-ns">ns: ${ex.ns}</span></p>
    </a>`;
  }).join('');

  const done  = state.exercises.length;
  const total = exercises.length;

  return `
<div class="page page-enter">
  <div class="section-header">
    <h1>Exercices</h1>
    <p>Lance le déploiement dans le cluster, diagnostique avec kubectl, répare. ${done}/${total} résolus.</p>
  </div>
  <div class="cards-grid">${cards}</div>
</div>`;
}
