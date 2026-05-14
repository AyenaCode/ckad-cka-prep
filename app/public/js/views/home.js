import { fetchCourses, fetchExercises } from '../api.js';
import { load, ACHIEVEMENTS, getLevel, getProgress } from '../gamification.js';

export default async function renderHome() {
  const [courses, exercises] = await Promise.all([fetchCourses(), fetchExercises()]);
  const state = load();
  const lvl   = getLevel(state.xp);

  const courseDone = state.courses.length;
  const exDone     = state.exercises.length;
  const totalC     = courses.length;
  const totalE     = exercises.length;

  const next = _nextAction(state, courses, exercises);

  return `
<div class="page page-enter">
  <div class="home-hero">
    <h1>⎈ K8s<em style="font-style:normal;color:var(--k8s)">learn</em></h1>
    <p>Ta plateforme d'apprentissage Kubernetes.<br>Lis. Déploie. Diagnostique. Répare.</p>

    <div class="progress-ring-wrap">
      ${ring('courses',   courseDone, totalC, '#326ce5', 'Cours')}
      ${ring('exercises', exDone,     totalE, '#00c9a7', 'Exercices')}
    </div>

    ${next ? `<p style="font-size:.8rem;color:var(--teal);font-family:var(--mono);margin-bottom:2rem">→ ${next}</p>` : ''}
  </div>

  <div class="home-cta">
    <a href="/cours" class="cta-card" data-link>
      <div class="cta-icon">📚</div>
      <h2>Cours</h2>
      <p>${totalC} chapitres — architecture, kubectl, debug. Lire dans l'ordre.</p>
      <span class="cta-arrow">Commencer les cours →</span>
    </a>
    <a href="/exercices" class="cta-card teal" data-link>
      <div class="cta-icon">🎯</div>
      <h2>Exercices</h2>
      <p>${totalE} tickets d'incident. Vrais bugs, vraies commandes, pas de triche.</p>
      <span class="cta-arrow" style="color:var(--teal)">Voir les exercices →</span>
    </a>
  </div>

  <div class="achievements-section">
    <p class="section-title">Achievements</p>
    <div class="achievements-grid">
      ${ACHIEVEMENTS.map(a => {
        const unlocked = state.achievements.includes(a.id);
        return `
        <div class="achievement-chip${unlocked ? ' unlocked' : ''}" data-ach="${a.id}">
          <span class="ach-icon">${a.icon}</span>
          <div>
            <div class="ach-name">${a.label}</div>
            <div style="font-size:.65rem;color:var(--txt-dim)">${a.desc}</div>
          </div>
          <span class="ach-xp">+${a.xp} XP</span>
        </div>`;
      }).join('')}
    </div>
  </div>
</div>`;
}

function ring(cls, done, total, stroke, label) {
  const r    = 30;
  const circ = 2 * Math.PI * r;
  const pct  = total > 0 ? done / total : 0;
  const dash = circ * (1 - pct);
  return `
  <div class="progress-ring-item">
    <svg width="80" height="80" viewBox="0 0 80 80">
      <circle class="ring-bg" cx="40" cy="40" r="${r}"/>
      <circle class="ring-fill ${cls}"
        cx="40" cy="40" r="${r}"
        stroke="${stroke}"
        stroke-dasharray="${circ}"
        stroke-dashoffset="${dash}"
        style="transition:stroke-dashoffset .8s cubic-bezier(.34,1.56,.64,1)"
      />
    </svg>
    <span class="ring-count">${done}/${total}</span>
    <span class="ring-label">${label}</span>
  </div>`;
}

function _nextAction(state, courses, exercises) {
  const unreadCourse = courses.find(c => !state.courses.includes(c.slug));
  if (unreadCourse) return `Prochain cours : ${unreadCourse.title}`;
  const unsolvedEx = exercises.find(e => !state.exercises.includes(e.id));
  if (unsolvedEx) return `Prochain exercice : ${unsolvedEx.title}`;
  return 'Tout complété — tu es prêt pour la CKA.';
}
