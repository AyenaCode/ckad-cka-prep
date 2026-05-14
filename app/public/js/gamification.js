const KEY = 'k8s-learn-v2';

export const LEVELS = [
  { name: 'Apprenti',    min: 0,    color: '#5a7898' },
  { name: 'Padawan',     min: 200,  color: '#326ce5' },
  { name: 'SRE Junior',  min: 500,  color: '#00c9a7' },
  { name: 'DevOps Pro',  min: 1000, color: '#f59e0b' },
  { name: 'K8s Master',  min: 1800, color: '#a78bfa' },
];

export const ACHIEVEMENTS = [
  { id: 'first_deploy',  icon: '🚀', label: 'Premier Contact',   desc: 'Premier exercice lancé',        xp: 50  },
  { id: 'bug_hunter',    icon: '🔍', label: 'Chasseur de Bugs',  desc: '5 exercices résolus',            xp: 100 },
  { id: 'completionist', icon: '🏆', label: 'Completionniste',   desc: 'Tous les exercices terminés',    xp: 250 },
  { id: 'bookworm',      icon: '📚', label: 'Bibliothécaire',    desc: 'Tous les cours lus',             xp: 150 },
  { id: 'k8s_full',      icon: '⎈',  label: 'Full Kubernetes',   desc: 'Cours + exercices complétés',    xp: 300 },
];

function blank() {
  return { xp: 0, streak: 0, lastDate: null, courses: [], exercises: [], achievements: [] };
}

export function load() {
  try {
    const s = localStorage.getItem(KEY);
    return s ? { ...blank(), ...JSON.parse(s) } : blank();
  } catch { return blank(); }
}

function save(s) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function getLevel(xp) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].min) return { index: i, ...LEVELS[i] };
  }
  return { index: 0, ...LEVELS[0] };
}

export function getProgress(xp) {
  const cur  = getLevel(xp);
  const next = LEVELS[cur.index + 1];
  if (!next) return 1;
  return (xp - cur.min) / (next.min - cur.min);
}

function updateStreak(s) {
  const today = new Date().toISOString().slice(0, 10);
  if (s.lastDate === today) return;
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  s.streak = s.lastDate === yesterday ? s.streak + 1 : 1;
  s.lastDate = today;
}

export function addXP(amount, s) {
  const state   = s || load();
  const prevLvl = getLevel(state.xp).index;
  state.xp += amount;
  updateStreak(state);
  save(state);

  emit('xp-gained', { amount, total: state.xp });

  const newLvl = getLevel(state.xp).index;
  if (newLvl > prevLvl) emit('level-up', { level: newLvl, name: LEVELS[newLvl].name });

  return state;
}

export function markCourseRead(slug, totalCourses, totalExercises) {
  const s = load();
  if (s.courses.includes(slug)) return s;
  s.courses.push(slug);
  const state = addXP(50, s);
  _checkAllCourses(state, totalCourses);
  _checkAllDone(state, totalCourses, totalExercises);
  return load();
}

export function markExerciseLaunched(id) {
  const s = load();
  if (!s.achievements.includes('first_deploy')) {
    _grantAchievement('first_deploy', s);
  }
}

export function markExerciseComplete(id, totalExercises, totalCourses) {
  const s = load();
  if (s.exercises.includes(id)) return s;
  s.exercises.push(id);
  const state = addXP(100, s);
  _checkBugHunter(state);
  _checkAllExercises(state, totalExercises);
  _checkAllDone(state, totalCourses, totalExercises);
  return load();
}

function _checkBugHunter(s) {
  if (s.exercises.length >= 5 && !s.achievements.includes('bug_hunter')) {
    _grantAchievement('bug_hunter', s);
  }
}

function _checkAllExercises(s, total) {
  if (s.exercises.length >= total && !s.achievements.includes('completionist')) {
    _grantAchievement('completionist', s);
  }
}

function _checkAllCourses(s, total) {
  if (s.courses.length >= total && !s.achievements.includes('bookworm')) {
    _grantAchievement('bookworm', s);
  }
}

function _checkAllDone(s, totalCourses, totalExercises) {
  if (
    s.courses.length >= totalCourses &&
    s.exercises.length >= totalExercises &&
    !s.achievements.includes('k8s_full')
  ) {
    _grantAchievement('k8s_full', s);
  }
}

function _grantAchievement(id, s) {
  if (s.achievements.includes(id)) return;
  const ach = ACHIEVEMENTS.find(a => a.id === id);
  if (!ach) return;
  s.achievements.push(id);
  save(s);
  addXP(ach.xp, s);
  emit('achievement', ach);
}

export function refreshNav() {
  const s    = load();
  const lvl  = getLevel(s.xp);
  const pct  = getProgress(s.xp) * 100;

  const el = id => document.getElementById(id);
  if (el('xp-label')) el('xp-label').textContent = lvl.name;
  if (el('xp-fill'))  el('xp-fill').style.width  = pct + '%';
  if (el('xp-num'))   el('xp-num').textContent    = s.xp + ' XP';
  if (el('streak-num')) el('streak-num').textContent = s.streak || 0;
}

function emit(name, detail) {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}
