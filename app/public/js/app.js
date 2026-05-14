import { init as initRouter, navigate }   from './router.js';
import { refreshNav, load, ACHIEVEMENTS } from './gamification.js';

// ── Boot ──────────────────────────────────────────────────────────────────────
refreshNav();
initRouter();
_initCanvas();

// ── Gamification events ───────────────────────────────────────────────────────
document.addEventListener('xp-gained', e => {
  refreshNav();
  const fill = document.getElementById('xp-fill');
  fill?.classList.remove('gained');
  requestAnimationFrame(() => fill?.classList.add('gained'));
  setTimeout(() => fill?.classList.remove('gained'), 700);
});

document.addEventListener('level-up', e => {
  toast({
    icon: '⬆',
    title: 'Level up !',
    desc: `Tu es maintenant ${e.detail.name}`,
    xp: '',
  }, 5000);
});

document.addEventListener('achievement', e => {
  const a = e.detail;
  toast({ icon: a.icon, title: a.label, desc: a.desc, xp: '+' + a.xp + ' XP' }, 5000);
  // animate chip if visible
  const chip = document.querySelector(`[data-ach="${a.id}"]`);
  chip?.classList.add('unlocked', 'just-unlocked');
  setTimeout(() => chip?.classList.remove('just-unlocked'), 600);
});

// ── Toast helper ──────────────────────────────────────────────────────────────
function toast({ icon, title, desc, xp }, duration = 3500) {
  const container = document.getElementById('toasts');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${desc ? `<div class="toast-desc">${desc}</div>` : ''}
      ${xp   ? `<div class="toast-xp">${xp}</div>` : ''}
    </div>`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove());
  }, duration);
}

// ── Particle canvas background ────────────────────────────────────────────────
function _initCanvas() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    particles = Array.from({ length: 60 }, () => _mkParticle(W, H));
  }

  function _mkParticle(w, h) {
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.5 + .3,
      vx: (Math.random() - .5) * .25,
      vy: (Math.random() - .5) * .25,
      alpha: Math.random() * .5 + .1,
    };
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(50,108,229,${p.alpha})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  draw();
}
