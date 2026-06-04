/**
 * biubiu IP角色 SVG 组件
 * 泡泡玛特小精灵风 | 暖黄奶油色 | 闪电角 | 大圆眼 | 手指发射
 */

// ============ SVG 定义（页面head里放一次）============
window.__BIUBIU_SVG_DEFS__ = `
<svg style="display:none" xmlns="http://www.w3.org/2000/svg" id="biubiu-defs">
  <defs>
    <radialGradient id="bb-body" cx="50%" cy="35%" r="55%">
      <stop offset="0%" stop-color="#FFFEF8"/>
      <stop offset="55%" stop-color="#FFF8E7"/>
      <stop offset="100%" stop-color="#F0E6CC"/>
    </radialGradient>
    <radialGradient id="bb-bolt" cx="50%" cy="0%" r="100%">
      <stop offset="0%" stop-color="#FFF9C4"/>
      <stop offset="100%" stop-color="#FFD700"/>
    </radialGradient>
    <radialGradient id="bb-cheek" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFC8C8"/>
      <stop offset="100%" stop-color="#FFA8A8"/>
    </radialGradient>
    <linearGradient id="bb-beam" x1="0%" x2="100%">
      <stop offset="0%" stop-color="#FFD700"/>
      <stop offset="70%" stop-color="#FFE566" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#FFE566" stop-opacity="0"/>
    </linearGradient>
    <filter id="bb-shadow">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#1a1a2e" flood-opacity="0.15"/>
    </filter>
    <filter id="bb-glow">
      <feGaussianBlur stdDeviation="2.5"/>
    </filter>
  </defs>
</svg>`;

// ============ 基础biubiu身体（所有表情共用）============
function biubiuBody(faceGroup, extras) {
  return `
  <svg viewBox="0 0 200 240" width="${extras?.size || 200}" height="${extras?.size ? extras.size * 1.2 : 240}" style="display:block" class="biubiu-sprite">
    <!-- 阴影 -->
    <ellipse cx="100" cy="230" rx="45" ry="8" fill="#1a1a2e" opacity="0.08"/>

    <!-- 小短腿 -->
    <ellipse cx="75" cy="208" rx="18" ry="12" fill="url(#bb-body)" stroke="#E8DCC8" stroke-width="1"/>
    <ellipse cx="125" cy="208" rx="18" ry="12" fill="url(#bb-body)" stroke="#E8DCC8" stroke-width="1"/>

    <!-- 身体（梨形） -->
    <path d="M60,90 Q60,220 100,220 Q140,220 140,90 Z" fill="url(#bb-body)" stroke="#E8DCC8" stroke-width="1.5" filter="url(#bb-shadow)"/>

    <!-- 肚子上的足球图案 -->
    <circle cx="100" cy="155" r="22" fill="white" stroke="#D4C8B0" stroke-width="1"/>
    <path d="M100,133 A22,22 0,0,1 100,177" fill="none" stroke="#D4C8B0" stroke-width="0.8"/>
    <path d="M100,133 A22,22 0,0,0 100,177" fill="none" stroke="#D4C8B0" stroke-width="0.8"/>
    <circle cx="88" cy="143" r="3" fill="#D4C8B0"/>
    <circle cx="112" cy="155" r="3" fill="#D4C8B0"/>
    <circle cx="99" cy="172" r="3" fill="#D4C8B0"/>

    <!-- 小短手 -->
    <g>${extras?.leftArm || biubiuArm('left', extras)}</g>
    <g>${extras?.rightArm || biubiuArm('right', extras)}</g>

    <!-- 头部（大头娃娃比例） -->
    <circle cx="100" cy="65" r="55" fill="url(#bb-body)" stroke="#E8DCC8" stroke-width="1.5"/>

    <!-- 闪电角 -->
    <g>${extras?.bolt || biubiuBolt(extras)}</g>

    <!-- 五官 -->
    ${faceGroup}

    <!-- 腮红 -->
    <ellipse cx="60" cy="75" rx="14" ry="9" fill="url(#bb-cheek)" opacity="0.6"/>
    <ellipse cx="140" cy="75" rx="14" ry="9" fill="url(#bb-cheek)" opacity="0.6"/>

    <!-- 嘴 -->
    ${extras?.mouth || biubiuMouth('smile', extras)}
  </svg>`;
}

function biubiuArm(side, extras) {
  const baseX = side === 'left' ? 48 : 152;
  const angle = extras?.armAngle || (side === 'left' ? 30 : -30);
  const x2 = baseX + Math.cos(angle * Math.PI / 180) * 40;
  const y2 = 100 + Math.sin(angle * Math.PI / 180) * 40;
  const handX = x2 + (side === 'left' ? -8 : 8);
  const handY = y2 + 2;
  return `
    <path d="M${baseX},100 Q${(baseX+x2)/2},${100-15} ${x2},${y2}" fill="none" stroke="#E8DCC8" stroke-width="6" stroke-linecap="round"/>
    <circle cx="${handX}" cy="${handY}" r="8" fill="url(#bb-body)" stroke="#E8DCC8" stroke-width="1"/>
    ${extras?.fingerBeam && side === extras.fingerBeam ?
      `<path d="M${handX},${handY-6} L${side==='left'?handX-25:handX+25},${handY-20}" stroke="url(#bb-beam)" stroke-width="3" stroke-linecap="round" opacity="0.8">
        <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1.2s" repeatCount="indefinite"/>
       </path>`
      : ''}
  `;
}

function biubiuBolt(extras) {
  const color = extras?.boltColor || 'url(#bb-bolt)';
  const glow = extras?.boltGlow ? `filter="url(#bb-glow)"` : '';
  return `
    <polygon points="100,8 95,26 103,26 97,48 108,26 100,26 106,8" fill="${color}" ${glow}>
      ${extras?.boltPulse !== false ? '<animate attributeName="opacity" values="1;0.6;1" dur="2s" repeatCount="indefinite"/>' : ''}
    </polygon>
  `;
}

function biubiuMouth(type, extras) {
  switch (type) {
    case 'smile': return '<path d="M88,85 Q100,98 112,85" fill="none" stroke="#5a4a3a" stroke-width="2" stroke-linecap="round"/>';
    case 'bigsmile': return '<path d="M88,85 Q100,102 112,85" fill="#FF9999" stroke="#5a4a3a" stroke-width="1.5"/>';
    case 'wavy': return '<path d="M88,83 Q94,79 100,85 Q106,91 112,83" fill="none" stroke="#5a4a3a" stroke-width="2" stroke-linecap="round"/>';
    case 'open': return '<ellipse cx="100" cy="87" rx="10" ry="8" fill="#4a3a2a" stroke="none"/>';
    case 'surprise': return '<ellipse cx="100" cy="86" rx="8" ry="10" fill="#4a3a2a" stroke="none"/>';
    default: return '<path d="M88,85 Q100,98 112,85" fill="none" stroke="#5a4a3a" stroke-width="2" stroke-linecap="round"/>';
  }
}

// ============ 6个标准表情 ============

// 1. 自信预测 — 歪嘴笑，闪电角发光
function biubiuConfident(size) {
  const face = `
    <circle cx="82" cy="62" r="14" fill="#2a2a2a"/>
    <circle cx="118" cy="62" r="14" fill="#2a2a2a"/>
    <circle cx="87" cy="57" r="5" fill="white"/>
    <circle cx="123" cy="57" r="5" fill="white"/>
    <circle cx="83" cy="64" r="2" fill="white"/>
    <circle cx="119" cy="64" r="2" fill="white"/>
  `;
  return biubiuBody(face, { size, mouth: biubiuMouth('smile'), boltPulse: true, boltGlow: true, fingerBeam: 'right' });
}

// 2. 翻车 — 泪滴，闪电角变灰
function biubiuSad(size) {
  const face = `
    <circle cx="82" cy="62" r="14" fill="#2a2a2a"/>
    <circle cx="118" cy="62" r="14" fill="#2a2a2a"/>
    <circle cx="87" cy="57" r="5" fill="white"/>
    <circle cx="123" cy="57" r="5" fill="white"/>
    <circle cx="83" cy="64" r="2" fill="white"/>
    <circle cx="119" cy="64" r="2" fill="white"/>
    <!-- 泪滴 -->
    <path d="M82,76 Q78,84 82,88 Q86,84 82,76" fill="#88CCFF" opacity="0.7"/>
    <path d="M118,78 L118,85" stroke="#88CCFF" stroke-width="1.5" opacity="0.5"/>
  `;
  return biubiuBody(face, { size, mouth: biubiuMouth('wavy'), boltColor: '#B0B8C0', boltPulse: false });
}

// 3. 紧张 — 眼睛瞪大，腮红深
function biubiuShocked(size) {
  const face = `
    <circle cx="82" cy="62" r="16" fill="#2a2a2a"/>
    <circle cx="118" cy="62" r="16" fill="#2a2a2a"/>
    <circle cx="88" cy="57" r="7" fill="white"/>
    <circle cx="124" cy="57" r="7" fill="white"/>
    <circle cx="83" cy="64" r="2.5" fill="white"/>
    <circle cx="119" cy="64" r="2.5" fill="white"/>
  `;
  return biubiuBody(face, { size, mouth: biubiuMouth('surprise'), boltPulse: true, boltGlow: false });
}

// 4. 兴奋 — 跳起来，眼睛笑眯
function biubiuHappy(size) {
  const face = `
    <path d="M68,58 Q75,48 82,58" fill="none" stroke="#2a2a2a" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M118,58 Q125,48 132,58" fill="none" stroke="#2a2a2a" stroke-width="2.5" stroke-linecap="round"/>
  `;
  return biubiuBody(face, { size, mouth: biubiuMouth('bigsmile'), boltGlow: true, fingerBeam: 'right', fingerBeamL: 'left', armAngle: -60 });
}

// 5. 眨眼 — 单眼眨，手指比枪
function biubiuWink(size) {
  const face = `
    <path d="M69,58 Q75.5,50 82,58" fill="none" stroke="#2a2a2a" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="118" cy="62" r="14" fill="#2a2a2a"/>
    <circle cx="123" cy="57" r="5" fill="white"/>
    <circle cx="119" cy="64" r="2" fill="white"/>
  `;
  return biubiuBody(face, { size, mouth: biubiuMouth('smile'), boltPulse: true });
}

// 6. 迷你版 — 小logo用
function biubiuMini() {
  return `
  <svg viewBox="0 0 60 60" width="32" height="32" style="display:block">
    <circle cx="30" cy="28" r="22" fill="url(#bb-body)" stroke="#E8DCC8" stroke-width="1"/>
    <polygon points="30,2 27,12 31,12 29,24 32,12 28,12 31,2" fill="url(#bb-bolt)"/>
    <circle cx="22" cy="26" r="6" fill="#2a2a2a"/>
    <circle cx="38" cy="26" r="6" fill="#2a2a2a"/>
    <circle cx="24" cy="24" r="2" fill="white"/>
    <circle cx="40" cy="24" r="2" fill="white"/>
    <ellipse cx="22" cy="36" rx="5" ry="3" fill="url(#bb-cheek)" opacity="0.5"/>
    <ellipse cx="38" cy="36" rx="5" ry="3" fill="url(#bb-cheek)" opacity="0.5"/>
    <path d="M26,36 Q30,42 34,36" fill="none" stroke="#5a4a3a" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="30" cy="50" r="8" fill="white" stroke="#D4C8B0" stroke-width="0.5">
      <circle cx="28" cy="48" r="1" fill="#D4C8B0"/>
      <circle cx="30" cy="51" r="1" fill="#D4C8B0"/>
    </circle>
  </svg>`;
}

// ============ 全局注入SVG定义 ============
function injectBiubiuDefs() {
  if (document.getElementById('biubiu-defs')) return;
  const div = document.createElement('div');
  div.innerHTML = window.__BIUBIU_SVG_DEFS__;
  document.body.insertBefore(div.firstChild, document.body.firstChild);
}

// 页面加载时注入
document.addEventListener('DOMContentLoaded', injectBiubiuDefs);

// 导出
window.biubiu = { biubiuConfident, biubiuSad, biubiuShocked, biubiuHappy, biubiuWink, biubiuMini, biubiuBody, biubiuMouth };
