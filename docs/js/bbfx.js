/**
 * biubiu animations — vanilla JS, inspired by ReactBits (reactbits.dev)
 *
 * Effects ported: ShinyText, CountUp, ClickSparks, TiltCard, GlowBorder,
 *   DecryptedText, SkeletonShimmer, SplitText
 *
 * All zero-dependency, GPU-accelerated, reduced-motion aware.
 */

// ============ 1. ShinyText — 金色流光文字 ============
function shinyText(el, options = {}) {
  const speed = options.speed || 3;
  const color = options.color || 'rgba(255,255,255,0.5)';
  el.style.background = `linear-gradient(120deg, var(--gold) 0%, #fff 40%, var(--gold) 80%)`;
  el.style.backgroundSize = '200% 100%';
  el.style.backgroundClip = 'text';
  el.style.webkitBackgroundClip = 'text';
  el.style.color = 'transparent';
  el.style.animation = `shinySlide ${speed}s linear infinite`;
}
// CSS keyframe injected on init
const shinyKeyframe = `
@keyframes shinySlide { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
`;

// ============ 2. CountUp — 数字滚动动画 ============
class CountUp {
  constructor(el, options = {}) {
    this.el = el;
    this.start = options.start || 0;
    this.end = options.end || 0;
    this.duration = options.duration || 1500;
    this.decimals = options.decimals || 0;
    this.prefix = options.prefix || '';
    this.suffix = options.suffix || '';
    this.easing = options.easing || 'cubic-bezier(0.16,1,0.3,1)';
  }

  update(newEnd) {
    this.end = newEnd;
    this.animate();
  }

  animate() {
    const startTime = performance.now();
    const startVal = this.start;
    const diff = this.end - this.start;

    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / this.duration, 1);
      // easeOutExpo-ish
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = startVal + diff * eased;

      this.el.textContent = this.prefix + current.toFixed(this.decimals) + this.suffix;
      if (progress < 1) requestAnimationFrame(tick);
      else this.start = this.end; // mark completion
    };
    requestAnimationFrame(tick);
  }
}

// ============ 3. ClickSparks — 点击粒子爆发 ============
function clickSparks(x, y, count = 12) {
  const container = document.body;
  const colors = ['#FFD700', '#FFE566', '#FFCC00', '#fff', '#2ecc71'];

  for (let i = 0; i < count; i++) {
    const spark = document.createElement('div');
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const velocity = 40 + Math.random() * 60;
    const size = 3 + Math.random() * 5;
    const color = colors[Math.floor(Math.random() * colors.length)];

    spark.style.cssText = `
      position:fixed; left:${x}px; top:${y}px; width:${size}px; height:${size}px;
      background:${color}; border-radius:50%; pointer-events:none; z-index:9999;
      box-shadow: 0 0 ${size*2}px ${color};
    `;
    container.appendChild(spark);

    const startTime = performance.now();
    const duration = 400 + Math.random() * 300;

    const anim = (now) => {
      const t = (now - startTime) / duration;
      if (t >= 1) { spark.remove(); return; }
      const dist = velocity * t;
      const fade = 1 - t;
      spark.style.transform = `translate(${Math.cos(angle)*dist}px,${Math.sin(angle)*dist}px) scale(${fade})`;
      spark.style.opacity = fade;
      requestAnimationFrame(anim);
    };
    requestAnimationFrame(anim);
  }
}

// ============ 4. TiltCard — 3D倾斜卡片 ============
function tiltCard(el, options = {}) {
  const maxTilt = options.maxTilt || 8;
  const scale = options.scale || 1.02;
  const speed = options.speed || 400;
  const glare = options.glare !== false;

  el.style.transition = `transform ${speed}ms ease-out`;
  el.style.transformStyle = 'preserve-3d';
  el.style.perspective = '800px';

  if (glare) {
    const glareEl = document.createElement('div');
    glareEl.className = 'tilt-glare';
    glareEl.style.cssText = `
      position:absolute; inset:0; pointer-events:none; z-index:2; border-radius:inherit;
      background:radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 0%, transparent 70%);
      opacity:0; transition: opacity ${speed}ms;
    `;
    el.style.position = el.style.position || 'relative';
    el.style.overflow = 'hidden';
    el.appendChild(glareEl);
  }

  el.addEventListener('mousemove', (e) => {
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${x * maxTilt}deg) rotateX(${-y * maxTilt}deg) scale(${scale})`;
    const glareEl = el.querySelector('.tilt-glare');
    if (glareEl) {
      glareEl.style.opacity = '0.6';
      glareEl.style.background = `radial-gradient(circle at ${50 + x * 60}% ${50 + y * 60}%, rgba(255,255,255,0.15) 0%, transparent 70%)`;
    }
  });

  el.addEventListener('mouseleave', () => {
    el.style.transform = 'perspective(800px) rotateY(0) rotateX(0) scale(1)';
    const glareEl = el.querySelector('.tilt-glare');
    if (glareEl) glareEl.style.opacity = '0';
  });
}

// ============ 5. GlowBorder — 发光边框 ============
function glowBorder(el, options = {}) {
  const color1 = options.color1 || 'var(--gold)';
  const color2 = options.color2 || 'var(--green-light)';
  const speed = options.speed || 3;

  el.style.position = el.style.position || 'relative';
  el.style.borderRadius = el.style.borderRadius || 'var(--radius)';
  el.style.overflow = 'hidden';

  // Pseudo-element approach via a wrapper div
  const wrapper = document.createElement('div');
  wrapper.className = 'glow-border-wrap';
  wrapper.style.cssText = `
    position:relative; border-radius:inherit; padding:2px;
    background: linear-gradient(${360 / speed * 3}deg, ${color1}, ${color2}, ${color1}, ${color2});
    background-size: 300% 300%;
    animation: glowRotate ${speed}s linear infinite;
  `;
  el.parentNode.insertBefore(wrapper, el);
  wrapper.appendChild(el);
}
// CSS: @keyframes glowRotate { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }

// ============ 6. DecryptedText — 文字解谜效果 ============
function decryptedText(el, finalText, options = {}) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?/';
  const duration = options.duration || 1200;
  const fps = options.fps || 20;
  const startTime = performance.now();
  const length = finalText.length;

  const interval = setInterval(() => {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    let result = '';
    for (let i = 0; i < length; i++) {
      if (progress === 1 || progress > i / length * options.revealRatio || 1) {
        const charProgress = Math.min(1, (progress - i / length) / (1 / length) * 2);
        if (charProgress >= 1) {
          result += finalText[i];
        } else if (Math.random() < charProgress) {
          result += finalText[i];
        } else {
          result += chars[Math.floor(Math.random() * chars.length)];
        }
      } else {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
    }
    el.textContent = result;
    if (progress >= 1) clearInterval(interval);
  }, 1000 / fps);
}

// ============ 7. SkeletonShimmer — 骨架屏 ============
function skeletonShimmer(container, count = 3) {
  for (let i = 0; i < count; i++) {
    const sk = document.createElement('div');
    sk.className = 'skeleton-shimmer';
    sk.style.cssText = `
      height:${40 + Math.random() * 60}px; margin-bottom:10px; border-radius:var(--radius);
      background: linear-gradient(90deg, var(--bg-card) 25%, var(--bg-card-hover) 50%, var(--bg-card) 75%);
      background-size: 200% 100%;
      animation: shimmerSlide 1.5s ease-in-out infinite;
    `;
    container.appendChild(sk);
  }
  // CSS: @keyframes shimmerSlide { 0%{ background-position:200%0 } 100%{ background-position:-200%0 } }
}

// ============ 8. SplitText — 字符逐个入场 ============
function splitText(el, options = {}) {
  const text = el.textContent.trim();
  const delay = options.delay || 30;
  const stagger = options.stagger || 30;
  el.textContent = '';
  el.style.display = 'inline-block';

  const chars = [];
  for (let i = 0; i < text.length; i++) {
    const span = document.createElement('span');
    span.textContent = text[i] === ' ' ? ' ' : text[i];
    span.style.cssText = `
      display:inline-block; opacity:0; transform:translateY(20px);
      animation: splitIn 0.5s var(--ease-out, cubic-bezier(0.16,1,0.3,1)) forwards;
      animation-delay: ${delay + i * stagger}ms;
    `;
    el.appendChild(span);
    chars.push(span);
  }
  return chars;
}
// CSS: @keyframes splitIn { to { opacity:1; transform:translateY(0); } }

// ============ Init — inject CSS keyframes ============
function injectAnimationCSS() {
  const css = `
    @keyframes shinySlide { 0%{background-position:200% 0}100%{background-position:-200% 0} }
    @keyframes glowRotate { 0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%} }
    @keyframes shimmerSlide { 0%{background-position:200% 0}100%{background-position:-200% 0} }
    @keyframes splitIn { to { opacity:1; transform:translateY(0); } }
    @keyframes borderGlow { 0%,100%{box-shadow:0 0 8px rgba(255,215,0,0.2)}50%{box-shadow:0 0 20px rgba(255,215,0,0.5)} }
    @keyframes scaleBreathe { 0%,100%{transform:scale(1)}50%{transform:scale(1.03)} }
    @keyframes scoreBounce { 0%{transform:scale(1)}30%{transform:scale(1.3)}100%{transform:scale(1)} }
    @keyframes rankFlow1 { 0%{background-position:-200% 0}100%{background-position:200% 0} }
    @keyframes rankFlow2 { 0%{background-position:-200% 0}100%{background-position:200% 0} }
    @keyframes rankFlow3 { 0%{background-position:-200% 0}100%{background-position:200% 0} }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

// ============ Bind to window ============
window.bbfx = {
  shinyText, CountUp, clickSparks, tiltCard, glowBorder,
  decryptedText, skeletonShimmer, splitText,
  injectAnimationCSS
};

// Auto-inject CSS
document.addEventListener('DOMContentLoaded', injectAnimationCSS);
