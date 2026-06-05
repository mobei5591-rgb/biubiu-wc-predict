/**
 * biubiu陪我看球 — Frontend App v4
 * v4: JWT鉴权、时间比例撤销、自动结算、去注数上限、VIP签到x2
 */

const API_BASE = '/api';
const WC_START = new Date('2026-06-11T00:00:00Z');

// ============ State ============
let userPoints = parseFloat(localStorage.getItem('biubiu_points') || '50');
let userGuesses = JSON.parse(localStorage.getItem('biubiu_guesses') || '{}');
let userVip = false; // Set by /api/me — never trust localStorage
let userToken = localStorage.getItem('biubiu_token') || '';
let userName = localStorage.getItem('biubiu_username') || '阿白';
let userAvatar = localStorage.getItem('biubiu_avatar') || '';
let guessTimers = {};


// ============ Match Status Engine ============
// Returns { status, minute, homeScore, awayScore, display }
// Status: 'upcoming' | 'first_half' | 'halftime' | 'second_half' | 'finished'
function getMatchStatus(match) {
  const koStr = match.kickoff || (match.date + 'T00:00:00Z');
  const kickoff = new Date(koStr);
  const now = new Date();
  const elapsed = (now - kickoff) / 60000; // minutes since kickoff

  if (elapsed < 0) return { status: 'upcoming', minute: 0, homeScore: 0, awayScore: 0, display: '未开赛' };
  if (elapsed > 120) return { status: 'finished', minute: 90, homeScore: match.home_score != null ? match.home_score : seedScore(match, 'home'), awayScore: match.away_score != null ? match.away_score : seedScore(match, 'away'), display: '已结束' };

  let status, minute, display;
  if (elapsed < 45) {
    status = 'first_half';
    minute = Math.floor(elapsed);
    display = minute + "'";
  } else if (elapsed < 60) {
    status = 'halftime';
    minute = 45;
    display = 'HT';
  } else {
    status = 'second_half';
    minute = Math.min(90, Math.floor(elapsed - 15));
    display = minute + "'";
  }

  const hs = match.home_score != null ? match.home_score : seedScore(match, 'home');
  const as = match.away_score != null ? match.away_score : seedScore(match, 'away');
  return { status, minute, homeScore: hs, awayScore: as, display };
}

// Deterministic score simulation seeded by match ID
function seedScore(match, side) {
  const hs = match.home_score;
  const as = match.away_score;
  if (side === 'home' && hs != null) return hs;
  if (side === 'away' && as != null) return as;
  const mid = match.id || 1;
  const seed = mid * 7 + (side === 'home' ? 3 : 11);
  const p = match.prediction || { home: 35, draw: 30, away: 35 };
  const homeAdv = Math.round((p.home - p.away) / 15);
  if (side === 'home') return Math.max(0, (seed % 3) + homeAdv);
  return Math.max(0, seed % 2 + (homeAdv > 0 ? 0 : 1));
}

// AI score prediction for live matches (VIP)
function predictLiveScores(match) {
  const st = getMatchStatus(match);
  if (st.status === 'upcoming' || st.status === 'finished') return [];
  const p = match.prediction || { home: 35, draw: 30, away: 35 };
  const timeLeft = Math.max(5, 90 - st.minute);
  const currentTotal = st.homeScore + st.awayScore;
  const scoreDiff = st.homeScore - st.awayScore;
  const homeFavored = p.home > p.away;

  // Generate score predictions weighted by AI probability
  const scores = [];
  const baseGoalsPerMin = (currentTotal + (p.home + p.away) / 100 * 2.5) / Math.max(1, st.minute) * 90;
  const remainingGoalRate = baseGoalsPerMin * timeLeft / 90;
  const avgMoreGoals = Math.max(0.3, remainingGoalRate);

  // Home win scores (most likely if home favored)
  for (let hg = 0; hg <= 4; hg++) {
    for (let ag = 0; ag <= 3; ag++) {
      const finalHome = st.homeScore + hg;
      const finalAway = st.awayScore + ag;
      const goalDiff = finalHome - finalAway;

      let prob = 0;
      const poissonHome = Math.exp(-avgMoreGoals * p.home / 100) * Math.pow(avgMoreGoals * p.home / 100, hg) / factorial(Math.max(0, hg));
      const poissonAway = Math.exp(-avgMoreGoals * p.away / 100) * Math.pow(avgMoreGoals * p.away / 100, ag) / factorial(Math.max(0, ag));
      prob = poissonHome * poissonAway;

      // Boost home-favored scores
      if (goalDiff > 0 && homeFavored) prob *= 1.5;
      if (goalDiff === 0) prob *= 0.7;
      if (goalDiff < 0 && homeFavored) prob *= 0.4;

      // Boost based on current trend
      if (goalDiff > 0 && scoreDiff > 0) prob *= 1.3;
      if (goalDiff < 0 && scoreDiff < 0) prob *= 1.3;

      scores.push({
        home: finalHome, away: finalAway,
        score: finalHome + ':' + finalAway,
        prob: parseFloat((prob * 100).toFixed(1))
      });
    }
  }

  // Sort by probability desc, dedupe, take top 5
  scores.sort((a, b) => b.prob - a.prob);
  const seen = new Set();
  return scores.filter(s => {
    const key = s.score;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);
}

function factorial(n) {
  if (n <= 1) return 1;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

// Check if betting is open for current user
function canBet(match) {
  const st = getMatchStatus(match);
  if (st.status === 'finished') return false;
  if (st.status === 'upcoming') return true; // everyone can bet pre-match
  return userVip; // only VIP can bet during live
}

function betLockReason(match) {
  const st = getMatchStatus(match);
  if (st.status === 'finished') return '比赛已结束';
  if (st.status !== 'upcoming' && !userVip) return '比赛已开始，VIP可继续滚球投注';
  return '';
}

// ============ Init ============
document.addEventListener('DOMContentLoaded', async () => {
  handleAuthCallback();
  await loadUserIdentity();

  injectBiubiuDefs();
  initBbfxEffects();
  initBiubiuCharacters();
  updateUserAvatarInHeader();
  updatePointsDisplay();
  startCountdown();
  initCheckinButton();
  initUserButton();
  loadPage();

  // Auto-settle any finished matches on page load
  setTimeout(autoSettleAll, 1000);
});

// ============ Auth ============
function handleAuthCallback() {
  const hash = window.location.hash;
  if (hash && hash.includes('token=')) {
    const params = new URLSearchParams(hash.slice(1));
    const token = params.get('token');
    const name = params.get('name');
    const avatar = params.get('avatar');
    if (token) {
      localStorage.setItem('biubiu_token', token);
      userToken = token;
      if (name) { localStorage.setItem('biubiu_token_name', decodeURIComponent(name)); userName = decodeURIComponent(name); }
      if (avatar) { localStorage.setItem('biubiu_avatar', decodeURIComponent(avatar)); userAvatar = decodeURIComponent(avatar); }
      window.location.hash = '';
      showToast('✅ 微信登录成功！');
    }
  }
  const storedName = localStorage.getItem('biubiu_token_name');
  const storedAvatar = localStorage.getItem('biubiu_avatar');
  if (storedName) userName = storedName;
  if (storedAvatar) userAvatar = storedAvatar;
}

async function loadUserIdentity() {
  if (!userToken) return;
  try {
    const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${userToken}` } });
    if (!res.ok) return;
    const data = await res.json();
    userVip = !!(data.vip && (!data.vipExpiry || new Date(data.vipExpiry) > new Date()));
  } catch (e) {
    // Silent — keep free status
  }
}

// ============ bbfx effects ============
function initBbfxEffects() {
  if (!window.bbfx) return;
  const heroText = document.getElementById('hero-biubiu-text');
  if (heroText) bbfx.shinyText(heroText, { speed: 4 });
  setTimeout(() => {
    document.querySelectorAll('.match-card').forEach(card => bbfx.tiltCard(card, { maxTilt: 4, glare: false }));
  }, 100);
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-gold');
    if (btn) bbfx.clickSparks(e.clientX, e.clientY, 15);
  });
  const vipBtn = document.querySelector('#subscribe-btn');
  if (vipBtn) vipBtn.style.animation = 'scaleBreathe 2s ease-in-out infinite';
  const biubiuComment = document.getElementById('biubiu-comment');
  if (biubiuComment && biubiuComment.dataset.revealed !== 'true') {
    biubiuComment.dataset.revealed = 'true';
    setTimeout(() => {
      const txt = biubiuComment.textContent?.replace('💬 biubiu说：', '') || '';
      if (txt && bbfx.decryptedText) {
        biubiuComment.textContent = '💬 biubiu说：';
        const span = document.createElement('span');
        biubiuComment.appendChild(span);
        bbfx.decryptedText(span, txt, { duration: 1000 });
      }
    }, 400);
  }
}

function initBiubiuCharacters() {
  const logoEl = document.getElementById('logo-biubiu');
  if (logoEl && window.biubiu) logoEl.innerHTML = window.biubiu.biubiuMini();
  const heroEl = document.getElementById('hero-biubiu');
  if (heroEl && window.biubiu) heroEl.innerHTML = window.biubiu.biubiuConfident(48);
  const predEl = document.getElementById('prediction-biubiu');
  if (predEl && window.biubiu) predEl.innerHTML = window.biubiu.biubiuWink(80);
}

function loadPage() {
  const path = window.location.pathname;
  if (path.includes('match')) initMatchPage();
  else if (path.includes('subscribe')) initSubscribePage();
  else if (path.includes('standings') || path.includes('login') || path.includes('admin')) { /* standalone pages — only init header + checkin */ }
  else initHomePage();
}

// ============ Data Fetching ============
async function fetchMatches() {
  try {
    const res = await fetch(`${API_BASE}/matches`);
    if (res.ok) return (await res.json()).matches;
  } catch (e) { /* fall back */ }
  if (window.__BIUBIU_DATA__ && window.__BIUBIU_DATA__.matches) return window.__BIUBIU_DATA__.matches;
  return [];
}

function getMatchById(id) {
  const data = window.__BIUBIU_DATA__;
  return data ? data.matches.find(m => m.id === id) : null;
}

function showPageLoading(msg) {
  const overlay = document.createElement('div');
  overlay.className = 'page-loading';
  overlay.id = 'page-loading';
  overlay.innerHTML = `<div style="text-align:center">
    <div style="width:60px;height:60px;margin:0 auto 8px">${window.biubiu ? window.biubiu.biubiuWink(60) : '⚡'}</div>
    <p>${msg || 'biubiu正在分析...'}</p>
  </div>`;
  document.body.appendChild(overlay);
}

function hidePageLoading() {
  const el = document.getElementById('page-loading');
  if (el) { el.style.opacity = '0'; setTimeout(() => el.remove(), 200); }
}

// ============ Home Page ============
async function initHomePage() {
  const matches = await fetchMatches();
  if (matches.length > 0) {
    window.__BIUBIU_DATA__ = { matches };
    renderMatchList(matches);
    renderLeaderboard();

    // Auto-refresh match list for VIP (live scores)
    const hasLiveMatch = matches.some(m => {
      const st = getMatchStatus(m);
      return st.status === 'first_half' || st.status === 'second_half' || st.status === 'halftime';
    });
    if (hasLiveMatch && userVip) {
      window._biubiuHomeRefresh = setInterval(() => {
        renderMatchList(matches);
      }, 30000);
    }
  } else {
    document.getElementById('today-matches').innerHTML =
      '<div class="match-card" style="text-align:center;padding:40px;color:var(--text-dim)">😵 biubiu连不上服务器了，刷新试试</div>';
  }
}

function renderMatchList(matches) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const todayMatches = matches.filter(m => m.date === today);
  const upcoming = matches.filter(m => m.date > today).sort((a,b) => a.date.localeCompare(b.date));

  // Section title
  const todayTitleEl = document.querySelector('#today-title');
  if (todayTitleEl) {
    const hasLive = todayMatches.length > 0;
    if (hasLive && userVip) {
      todayTitleEl.innerHTML = '<span class="icon">🔴</span> 今日滚球 · VIP实时赔率';
      todayTitleEl.style.color = 'var(--gold)';
    } else if (hasLive) {
      todayTitleEl.innerHTML = '<span class="icon">📅</span> 今日比赛';
      todayTitleEl.style.color = '';
    } else {
      todayTitleEl.innerHTML = '<span class="icon">🔥</span> 赛事预告';
      todayTitleEl.style.color = '';
    }
  }

  const todayEl = document.getElementById('today-matches');
  if (todayMatches.length === 0) {
    const nextMatch = upcoming[0];
    if (nextMatch) {
      const h = teamDisplay(nextMatch.home), a = teamDisplay(nextMatch.away);
      const p = nextMatch.prediction || {};
      todayEl.innerHTML = `
        <div class="match-card hero-upcoming" data-match-id="${nextMatch.id}" style="background:linear-gradient(135deg,rgba(255,215,0,0.08),rgba(46,204,113,0.04));border-color:var(--gold);">
          <div class="match-card-header">
            <span class="match-date">🔥 下一场比赛</span>
            <span class="match-group">${nextMatch.group}组</span>
            <span class="live-dot"></span>
            <span style="font-size:12px;color:var(--gold);margin-left:auto;font-weight:600">${daysUntil(nextMatch.date)}天后开赛</span>
          </div>
          <div class="match-teams">
            <div class="team">
              <img class="team-flag" src="${h.flag}" alt="${h.zh}" loading="lazy" onerror="this.style.display='none'">
              <div class="team-name">${h.zh}</div>
              <div class="team-rank">FIFA #${nextMatch.home_rank}</div>
            </div>
            <div class="vs" style="font-size:18px;color:var(--gold)">VS</div>
            <div class="team">
              <img class="team-flag" src="${a.flag}" alt="${a.zh}" loading="lazy" onerror="this.style.display='none'">
              <div class="team-name">${a.zh}</div>
              <div class="team-rank">FIFA #${nextMatch.away_rank}</div>
            </div>
          </div>
          <div class="prob-bar-wrap">
            <div class="prob-bar">
              <div class="prob-home" style="width:${p.home}%"></div>
              <div class="prob-draw" style="width:${p.draw}%"></div>
              <div class="prob-away" style="width:${p.away}%"></div>
            </div>
            <div class="prob-labels"><span>主胜 ${p.home}%</span><span>平 ${p.draw}%</span><span>客胜 ${p.away}%</span></div>
          </div>
          <div class="biubiu-tag">🤖 ${p.ai?.reason || 'biubiu正在看...'}</div>
        </div>`;
    } else {
      todayEl.innerHTML = `<div class="match-card" style="text-align:center;padding:24px;color:var(--text-dim)">⚽ 全部赛程加载完成，坐等开赛！</div>`;
    }
  } else {
    todayEl.innerHTML = todayMatches.map(m => matchCardHTML(m)).join('');
  }

  const upcomingEl = document.getElementById('upcoming-matches');
  const show = upcoming.filter(m => m.date !== (upcoming[0]?.date)).slice(0, 6);
  upcomingEl.innerHTML = show.map(m => matchCardHTML(m)).join('');
}

function daysUntil(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const now = new Date();
  return Math.max(0, Math.ceil((d - now) / 86400000));
}

function flagURL(cc) { return `https://flagcdn.com/w160/${cc}.png`; }

function teamDisplay(name) {
  const t = window.__BIUBIU_TEAMS__ && window.__BIUBIU_TEAMS__[name];
  if (t) return { flag: flagURL(t.cc), zh: t.zh, en: t.en };
  return { flag: '', zh: name, en: name };
}

function matchCardHTML(m) {
  const p = m.prediction || { home: 33, draw: 34, away: 33, ai: { reason: 'biubiu还没分析这场比赛' } };
  const h = teamDisplay(m.home), a = teamDisplay(m.away);
  const st = getMatchStatus(m);
  const isLive = st.status === 'first_half' || st.status === 'second_half' || st.status === 'halftime';
  const isFinished = st.status === 'finished';
  const isToday = new Date().toISOString().split('T')[0] === m.date;
  const showLive = isLive && userVip;

  // Live score bar — visible to everyone
  let scoreBar = '';
  if (isLive || isFinished) {
    scoreBar = `<div class="live-score-bar${isLive ? ' live-pulse' : ''}${isFinished ? ' score-final' : ''}">
      <span class="live-time${st.status === 'halftime' ? ' ht-label' : ''}">${st.display}</span>
      <span class="live-score">${st.homeScore} : ${st.awayScore}</span>
    </div>`;
  }

  // Lock state
  const locked = isLive && !userVip;
  const cardClass = showLive ? ' match-card-live' : isFinished ? ' match-card-finished' : '';
  const badgeHTML = showLive
    ? '<div class="live-ribbon">⚡ 滚球中</div>'
    : locked
      ? '<div class="vip-lock-badge" title="VIP可滚球投注">🔒 比赛中</div>'
      : '';

  return `
  <div class="match-card${cardClass}" data-match-id="${m.id}">
    ${badgeHTML}
    ${scoreBar}
    <div class="match-card-header">
      <span class="match-date">${m.date}</span>
      <span class="match-group">${m.group}组</span>
      <span class="match-venue">${m.venue}</span>
      ${showLive ? '<span class="live-dot" style="margin-left:auto"></span>' : ''}
    </div>
    <div class="match-teams">
      <div class="team">
        <img class="team-flag" src="${h.flag}" alt="${h.zh}" loading="lazy" onerror="this.style.display='none'">
        <div class="team-name">${h.zh}</div>
        <div class="team-en">${h.en}</div>
        <div class="team-rank">FIFA #${m.home_rank}</div>
      </div>
      <div class="vs">VS</div>
      <div class="team">
        <img class="team-flag" src="${a.flag}" alt="${a.zh}" loading="lazy" onerror="this.style.display='none'">
        <div class="team-name">${a.zh}</div>
        <div class="team-en">${a.en}</div>
        <div class="team-rank">FIFA #${m.away_rank}</div>
      </div>
    </div>
    ${showLive ? '<div class="live-odds-hint">赔率实时跳动中 — 点击进入滚球盘</div>' : ''}
  </div>`;
}

// ============ Match Detail Page ============
async function initMatchPage() {
  setTimeout(hidePageLoading, 100);
  const params = new URLSearchParams(window.location.search);
  const matchId = parseInt(params.get('id'));
  if (!matchId) { window.location.href = '/'; return; }

  let match = getMatchById(matchId);
  if (!match) {
    const matches = await fetchMatches();
    if (window.__BIUBIU_DATA__) window.__BIUBIU_DATA__.matches = matches;
    match = matches.find(m => m.id === matchId);
  }

  if (match) {
    renderMatchDetail(match);
    renderPrediction(match);
    initGuessPanel(match);
    renderBetHistory(match);
    renderMatchReport(match);

    // Auto-refresh for VIP live matches (score + prediction + events every 30s)
    const st = getMatchStatus(match);
    const isLive = st.status === 'first_half' || st.status === 'second_half' || st.status === 'halftime';
    if (isLive && userVip) {
      // Initial fetch
      fetchAndRenderEvents(matchId, st);
      window._biubiuLiveRefresh = setInterval(() => {
        renderMatchDetail(match);
        renderPrediction(match);
        fetchAndRenderEvents(matchId, getMatchStatus(match));
        // Re-attach live odds badge
        const lb = document.getElementById('live-badge-win');
        if (lb) { lb.style.display = 'inline-flex'; lb.classList.add('live-active'); }
      }, 30000);
    } else if (window._biubiuLiveRefresh) {
      clearInterval(window._biubiuLiveRefresh);
      window._biubiuLiveRefresh = null;
    }

    const preBet = params.get('bet');
    if (preBet) {
      setTimeout(() => {
        let tabType = 'win';
        if (preBet.startsWith('ou_')) tabType = 'overunder';
        else if (preBet.startsWith('hc_')) tabType = 'handicap';
        else if (preBet.startsWith('cs_')) tabType = 'correctscore';
        const tab = document.querySelector(`.bet-tab[data-type="${tabType}"]`);
        if (tab) tab.click();
        const betBtn = document.querySelector(`[data-bet="${preBet}"]`);
        if (betBtn) { betBtn.click(); betBtn.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      }, 300);
    }
    if (!userVip) document.getElementById('vip-upsell').style.display = 'block';
  } else {
    document.getElementById('match-detail').innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--text-dim)">😵 biubiu找不到这场比赛</div>';
  }
}

function renderMatchDetail(m) {
  const el = document.getElementById('match-detail');
  const h = teamDisplay(m.home), a = teamDisplay(m.away);
  const st = getMatchStatus(m);
  const isLive = st.status === 'first_half' || st.status === 'second_half' || st.status === 'halftime';
  const isFinished = st.status === 'finished';

  // Live score display
  let liveInfo = '';
  if (isLive) {
    liveInfo = `<div class="detail-live-bar${st.status === 'halftime' ? ' detail-ht' : ''}">
      <span class="detail-live-time">${st.status === 'halftime' ? '⏸️ 中场休息' : '🔴 LIVE ' + st.display}</span>
      <span class="detail-live-score">${st.homeScore} : ${st.awayScore}</span>
    </div>`;
  } else if (isFinished) {
    liveInfo = `<div class="detail-live-bar detail-finished">
      <span class="detail-live-time">⏹️ 已结束</span>
      <span class="detail-live-score">${st.homeScore} : ${st.awayScore}</span>
    </div>`;
  }

  el.innerHTML = `
    ${liveInfo}
    <div class="match-card-header">
      <span class="match-date">${m.date}</span>
      <span class="match-group">${m.group}组</span>
      <span class="match-venue">📍 ${m.venue}</span>
      <span style="margin-left:auto;font-size:12px;color:var(--text-dim)">${m.stage === 'group' ? '小组赛' : m.stage}</span>
    </div>
    <div class="detail-teams">
      <div class="detail-vs">
        <div class="detail-team">
          <img class="detail-flag" src="${h.flag}" alt="${h.zh}" onerror="this.style.display='none'">
          <div class="name">${h.zh}</div>
          <div class="team-en">${h.en}</div>
          <div style="font-size:12px;color:var(--text-dim)">FIFA #${m.home_rank}</div>
        </div>
        <div class="detail-vs-text">VS</div>
        <div class="detail-team">
          <img class="detail-flag" src="${a.flag}" alt="${a.zh}" onerror="this.style.display='none'">
          <div class="name">${a.zh}</div>
          <div class="team-en">${a.en}</div>
          <div style="font-size:12px;color:var(--text-dim)">FIFA #${m.away_rank}</div>
        </div>
      </div>
    </div>
    <div style="text-align:center;margin-top:12px">
      <span class="points-badge">${m.stage === 'group' ? '小组赛' : '淘汰赛'} · ${m.group}组</span>
    </div>
  `;
}

function renderPrediction(m) {
  const p = m.prediction || {};
  const box = document.getElementById('prediction-box');
  box.style.display = 'block';

  const st = getMatchStatus(m);
  const isLive = st.status === 'first_half' || st.status === 'second_half' || st.status === 'halftime';
  const frozen = isLive && !userVip;

  // VIP live badge
  const liveBadge = document.getElementById('live-badge-win');
  if (liveBadge && isLive && userVip) {
    liveBadge.style.display = 'inline-flex';
    liveBadge.classList.add('live-active');
    liveBadge.innerHTML = '<span class="live-dot"></span>AI实时分析中';
  }

  // Freeze notice for free users
  if (frozen) {
    document.getElementById('prob-bars').innerHTML = `
      <div class="prediction-frozen">
        <div class="frozen-badge">🔒 预测已锁定</div>
        <div style="font-size:12px;color:var(--text-dim);margin:8px 0">比赛开始后预测固定，VIP可查看实时动态预测</div>
      </div>
    `;
    document.getElementById('biubiu-comment').textContent =
      `💬 biubiu说：${p.ai?.reason || '这场不好说，biubiu再看看...'}`;
    document.getElementById('prediction-source').textContent =
      `📡 预测引擎：${p.ai?.source === 'deepseek' ? 'DeepSeek AI' : '统计模型'} · 信心指数：${'⭐'.repeat(p.ai?.confidence || 3)} · 已锁定`;
    return;
  }

  // VIP live: adjust probabilities based on current score/time
  let adj = { home: p.home, draw: p.draw, away: p.away };
  let scorePredictionsHTML = '';
  if (isLive && userVip) {
    const scoreDiff = st.homeScore - st.awayScore;
    const timeLeft = Math.max(0, 90 - st.minute) / 90;
    const swing = scoreDiff * 15 * timeLeft;
    adj.home = Math.min(98, Math.max(1, p.home + swing));
    adj.away = Math.min(98, Math.max(1, p.away - swing));
    adj.draw = Math.max(1, 100 - adj.home - adj.away);

    // Score predictions
    const predictions = predictLiveScores(m);
    if (predictions.length > 0) {
      const top = predictions[0];
      const bars = predictions.map((sc, i) => {
        const width = Math.max(5, sc.prob);
        const highlight = i === 0 ? ' style="color:var(--gold);font-weight:700"' : '';
        return `<div class="score-pred-row"${i === 0 ? ' style="background:rgba(255,215,0,0.06)"' : ''}>
          <span class="score-pred-score"${highlight}>${sc.score}</span>
          <span class="score-pred-bar-wrap"><span class="score-pred-bar" style="width:${width}%;${i===0?'background:var(--gold)':''}"></span></span>
          <span class="score-pred-pct"${highlight}>${sc.prob}%</span>
        </div>`;
      }).join('');

      scorePredictionsHTML = `<div class="live-score-predictions">
        <div class="score-pred-title">🎯 biubiu推荐比分 <span style="font-size:10px;color:var(--green-light)">| 滚球实时</span></div>
        ${bars}
      </div>`;
    }
  }

  document.getElementById('prob-bars').innerHTML = `
    <div class="prob-col">
      <div class="bar-wrap"><div class="bar-fill bar-home-fill" style="height:${adj.home}%"></div></div>
      <div class="pct" style="color:var(--green-light)">${adj.home.toFixed(0)}%</div>
      <div class="label">${m.home} 胜</div>
    </div>
    <div class="prob-col">
      <div class="bar-wrap"><div class="bar-fill bar-draw-fill" style="height:${adj.draw}%"></div></div>
      <div class="pct" style="color:var(--gold)">${adj.draw.toFixed(0)}%</div>
      <div class="label">平局</div>
    </div>
    <div class="prob-col">
      <div class="bar-wrap"><div class="bar-fill bar-away-fill" style="height:${adj.away}%"></div></div>
      <div class="pct" style="color:var(--red)">${adj.away.toFixed(0)}%</div>
      <div class="label">${m.away} 胜</div>
    </div>
  `;
  if (isLive && userVip) {
    const sourceEl = document.getElementById('prediction-source');
    if (sourceEl) sourceEl.innerHTML += ' 🔴 实时调整中';
  }

  // VIP score predictions — insert into DOM after prob bars
  if (scorePredictionsHTML) {
    const spContainer = document.getElementById('score-predictions');
    if (spContainer) {
      spContainer.innerHTML = scorePredictionsHTML;
      spContainer.style.display = 'block';
    }
  } else {
    const spContainer = document.getElementById('score-predictions');
    if (spContainer) spContainer.style.display = 'none';
  }

  const ai = p.ai || {};
  document.getElementById('biubiu-comment').textContent =
    `💬 biubiu说：${ai.reason || '这场不好说，biubiu再看看...'}`;
  document.getElementById('prediction-source').textContent =
    `📡 预测引擎：${ai.source === 'deepseek' ? 'DeepSeek AI' : '统计模型'} · 信心指数：${'⭐'.repeat(ai.confidence || 3)}`;
}

// ============ Bet Panel ============
function initGuessPanel(match) {
  const panel = document.getElementById('guess-panel');
  if (!panel) return;
  panel.style.display = 'block';

  const slipState = { items: [] };

  // Lock check: free users can't bet once match starts
  if (!canBet(match)) {
    const reason = betLockReason(match);
    const st = getMatchStatus(match);
    const scoreInfo = (st.status !== 'upcoming' && st.status !== 'finished')
      ? `<div class="guess-lock-score">${st.homeScore} : ${st.awayScore} ${st.display}</div>`
      : '';
    panel.innerHTML = `<div class="guess-locked">
      <div class="guess-lock-icon">🔒</div>
      <p>${reason}</p>
      ${scoreInfo}
      ${!userVip ? '<a href="/subscribe.html" class="btn btn-gold" style="margin-top:10px;display:inline-block;font-size:13px;padding:8px 20px;text-decoration:none">⚡ 开通VIP 解锁滚球</a>' : ''}
    </div>`;
    return;
  }

  // If already settled, show result — no more bets allowed
  if (userGuesses[match.id] && userGuesses[match.id].final) {
    const g = userGuesses[match.id];
    const resultText = g.bets.map(b => `${betDescription(b.bet, match)}: ${b.result === 'win' ? '✅中奖' : '❌未中'}`).join('<br>');
    panel.innerHTML = `<span class="guess-label">📋 已结算</span>
      <div class="biubiu-comment">${resultText}<br>投入<strong>${g.totalStake || 0}</strong>分</div>`;
    return;
  }

  // Show existing bets if any, allow adding more
  const existingBetsNow = (userGuesses[match.id] && userGuesses[match.id].bets) ? userGuesses[match.id].bets : [];
  const EXIST = userGuesses[match.id];
  const undoWindow = userVip ? 60 : 30;
  const canUndo = EXIST && EXIST.time && (Date.now() - new Date(EXIST.time).getTime() < undoWindow * 1000);

  const existingDiv = document.getElementById('existing-bets');
  if (existingDiv && existingBetsNow.length > 0) {
    const existingHTML = existingBetsNow.map(b => `<span style="display:inline-block;background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.2);border-radius:6px;padding:3px 8px;margin:2px;font-size:12px">${betDescription(b.bet, match)} @${b.odds}×${b.stake}=${b.payout}</span>`).join('');
    existingDiv.innerHTML = `<span class="guess-label">✅ 已有 ${existingBetsNow.length}/20 注</span>
      <div style="margin:6px 0">${existingHTML}</div>
      ${canUndo ? `<button class="btn btn-outline" style="font-size:11px;padding:3px 10px;margin-top:4px" onclick="undoGuess(${match.id})">↩️ 撤销（${Math.ceil(undoWindow - (Date.now() - new Date(EXIST.time).getTime())/1000)}秒内可撤）</button>` : ''}`;
    existingDiv.style.display = 'block';
  } else if (existingDiv) {
    existingDiv.style.display = 'none';
  }

  // Odds from prediction
  const p = match.prediction || {};
  const homeProb = Math.max(5, p.home || 33);
  const drawProb = Math.max(5, p.draw || 34);
  const awayProb = Math.max(5, p.away || 33);

  function calcOdds(prob) { return (100 / prob).toFixed(2); }

  document.getElementById('odds-home').textContent = '@' + calcOdds(homeProb);
  document.getElementById('odds-draw').textContent = '@' + calcOdds(drawProb);
  document.getElementById('odds-away').textContent = '@' + calcOdds(awayProb);

  document.querySelector('[data-bet="win_home"]').dataset.odds = calcOdds(homeProb);
  document.querySelector('[data-bet="win_draw"]').dataset.odds = calcOdds(drawProb);
  document.querySelector('[data-bet="win_away"]').dataset.odds = calcOdds(awayProb);

  const hName = (window.__BIUBIU_TEAMS__ && window.__BIUBIU_TEAMS__[match.home]) ? window.__BIUBIU_TEAMS__[match.home].zh : match.home;
  const aName = (window.__BIUBIU_TEAMS__ && window.__BIUBIU_TEAMS__[match.away]) ? window.__BIUBIU_TEAMS__[match.away].zh : match.away;
  document.getElementById('hcap-home').textContent = hName;
  document.getElementById('hcap-away').textContent = aName;
  document.getElementById('hcap-home-m1').textContent = hName;
  document.getElementById('hcap-away-p1').textContent = aName;

  // Fetch odds
  fetchAndUpdateOdds(match, panel);

  // VIP live polling
  const liveBadge = document.getElementById('live-badge-win');
  if (userVip && liveBadge) {
    liveBadge.classList.add('live-active');
    startLiveOdds(match, panel);
  }

  // Bet Type Tabs
  document.querySelectorAll('#bet-tabs .bet-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#bet-tabs .bet-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.bet-panel').forEach(p => p.style.display = 'none');
      const map = { win: 'bet-win', overunder: 'bet-overunder', handicap: 'bet-handicap', correctscore: 'bet-correctscore' };
      const el = document.getElementById(map[tab.dataset.type]);
      if (el) el.style.display = 'block';
    });
  });

  // Stake input
  const stakeInput = document.getElementById('bet-stake');
  const getStakeAmount = () => Math.max(10, Math.min(9999999, parseInt(stakeInput.value) || 10));

  document.querySelectorAll('.stake-presets button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.stake-presets button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      stakeInput.value = btn.dataset.amt;
      updateBetSlipDisplay(slipState, match, panel, getStakeAmount());
    });
  });

  stakeInput.addEventListener('input', () => {
    document.querySelectorAll('.stake-presets button').forEach(b => b.classList.remove('active'));
    updateBetSlipDisplay(slipState, match, panel, getStakeAmount());
  });

  // Stepper buttons -/+ around input
  const minusBtn = document.getElementById('stake-minus');
  const plusBtn = document.getElementById('stake-plus');
  if (minusBtn) minusBtn.addEventListener('click', () => {
    let v = getStakeAmount();
    v = Math.max(10, v - 1);
    stakeInput.value = v;
    document.querySelectorAll('.stake-presets button').forEach(b => b.classList.remove('active'));
    updateBetSlipDisplay(slipState, match, panel, v);
  });
  if (plusBtn) plusBtn.addEventListener('click', () => {
    let v = getStakeAmount();
    v = Math.min(9999999, v + 1);
    stakeInput.value = v;
    document.querySelectorAll('.stake-presets button').forEach(b => b.classList.remove('active'));
    updateBetSlipDisplay(slipState, match, panel, v);
  });

  // Bet button clicks — NO LIMIT
  const allBetBtns = document.querySelectorAll('#guess-panel .odds-btn, #guess-panel .ou-card, #guess-panel .handicap-btn, #guess-panel .cs-btn');
  allBetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (!btn.dataset.bet) return;
      btn.classList.toggle('selected');
      updateBetSlipDisplay(slipState, match, panel, getStakeAmount());
    });
  });

  // Submit — accumulate bets, VIP unlimited, free max 20
  const MAX_BETS = userVip ? 9999 : 20;

  document.getElementById('submit-guess').addEventListener('click', () => {
    if (slipState.items.length === 0) { showToast('先选投注项'); return; }

    // Already have bets? Check total after adding
    const existingBetsLocal = (userGuesses[match.id] && userGuesses[match.id].bets) ? userGuesses[match.id].bets : [];
    if (!userVip && existingBetsLocal.length + slipState.items.length > MAX_BETS) {
      showToast(`免费每场最多${MAX_BETS}注，已有${existingBetsLocal.length}注。VIP不限制`);
      return;
    }

    const stakeAmt = getStakeAmount();
    const totalStake = slipState.items.length * stakeAmt;
    if (userPoints < totalStake) { showToast(`积分不够！需要${totalStake}分，你只有${userPoints}分`); return; }

    let maxWin = 0;
    const newBets = slipState.items.map(item => {
      const odds = parseFloat(item.odds);
      const payout = parseFloat((stakeAmt * odds).toFixed(2));
      if (payout > maxPayout) maxPayout = payout;
      return { bet: item.bet, odds: item.odds, stake: stakeAmt, payout };
    });

    // Accumulate — append to existing bets instead of overwriting
    const allBets = [...existingBetsLocal, ...newBets];
    const totalAllStake = allBets.reduce((s, b) => s + b.stake, 0);
    const maxAllWin = Math.max(...allBets.map(b => b.payout));

    userPoints -= totalStake;
    userGuesses[match.id] = {
      bets: allBets, totalStake: totalAllStake, maxWin: maxAllWin,
      time: new Date().toISOString(), final: false
    };
    saveState();
    updatePointsDisplay();

    if (window.bbfx) {
      const btn = document.getElementById('submit-guess');
      const rect = btn.getBoundingClientRect();
      bbfx.clickSparks(rect.left + rect.width/2, rect.top + rect.height/2, 20);
    }
    showToast(`🚀 投入${totalStake}分，最高赢${maxWin}分！`);

    // Reset for next bet — don't reload page
    panel.querySelectorAll('.odds-btn.selected, .ou-card.selected, .handicap-btn.selected, .cs-btn.selected').forEach(b => b.classList.remove('selected'));
    slipState.items.length = 0;
    updateBetSlipDisplay(slipState, match, panel, getStakeAmount());
    document.querySelectorAll('.stake-presets button').forEach(b => b.classList.remove('active'));
    const firstPreset = document.querySelector('.stake-presets button[data-amt="10"]');
    if (firstPreset) firstPreset.classList.add('active');
    stakeInput.value = 10;

    // Update existing bets display
    const g = userGuesses[match.id];
    const undoWindow = userVip ? 60 : 30;
    const canUndo = g && g.time && (Date.now() - new Date(g.time).getTime() < undoWindow * 1000);
    const existingDiv = document.getElementById('existing-bets');
    if (existingDiv && g && g.bets) {
      const existingHTML = g.bets.map(b => `<span style="display:inline-block;background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.2);border-radius:6px;padding:3px 8px;margin:2px;font-size:12px">${betDescription(b.bet, match)} @${b.odds}×${b.stake}=${b.payout}</span>`).join('');
      existingDiv.innerHTML = `<span class="guess-label">✅ 已有 ${g.bets.length}/20 注</span>
        <div style="margin:6px 0">${existingHTML}</div>
        ${canUndo ? `<button class="btn btn-outline" style="font-size:11px;padding:3px 10px;margin-top:4px" onclick="undoGuess(${match.id})">↩️ 撤销（${Math.ceil(undoWindow - (Date.now() - new Date(g.time).getTime())/1000)}秒内可撤）</button>` : ''}`;
      existingDiv.style.display = 'block';
    }
  });

}

// ============ Live Odds Polling (VIP) ============
let liveOddsTimer = null;

async function startLiveOdds(match, panel) {
  if (liveOddsTimer) clearInterval(liveOddsTimer);
  await fetchAndUpdateOdds(match, panel);
  liveOddsTimer = setInterval(async () => { await fetchAndUpdateOdds(match, panel); }, 10000);
}

async function fetchAndUpdateOdds(match, panel) {
  try {
    const res = await fetch(`${API_BASE}/odds?id=${match.id}&tick=true`);
    if (!res.ok) return;
    const odds = await res.json();

    const liveBadge = document.getElementById('live-badge-win');
    if (liveBadge) {
      liveBadge.style.display = 'inline-flex';
      if (odds.source === 'the-odds-api') {
        liveBadge.innerHTML = '<span class="live-dot"></span>实时赔率';
        liveBadge.style.borderColor = 'rgba(46,204,113,0.5)';
        liveBadge.style.color = 'var(--green-light)';
      } else {
        liveBadge.innerHTML = '🤖AI赔率';
        liveBadge.style.borderColor = 'rgba(255,215,0,0.3)';
        liveBadge.style.color = 'var(--gold)';
        liveBadge.style.background = 'rgba(255,215,0,0.08)';
      }
    }

    if (odds.win) {
      updateOddsEl('#odds-home', odds.win.home);
      updateOddsEl('#odds-draw', odds.win.draw);
      updateOddsEl('#odds-away', odds.win.away);
      if (odds.win.home) updateBetBtn(panel, 'win_home', odds.win.home);
      if (odds.win.draw) updateBetBtn(panel, 'win_draw', odds.win.draw);
      if (odds.win.away) updateBetBtn(panel, 'win_away', odds.win.away);
    }

    if (odds.overUnder) {
      if (odds.overUnder.over) updateBetBtn(panel, 'ou_over25', odds.overUnder.over);
      if (odds.overUnder.under) updateBetBtn(panel, 'ou_under25', odds.overUnder.under);
    }

    if (odds.handicap) {
      if (odds.handicap.home) updateBetBtn(panel, 'hc_home_0', odds.handicap.home);
      if (odds.handicap.away) updateBetBtn(panel, 'hc_away_0', odds.handicap.away);
    }

    if (odds.correctScore) {
      for (const [score, val] of Object.entries(odds.correctScore)) {
        updateBetBtn(panel, 'cs_' + score.replace(':', '_'), val);
      }
    }

    const stakeAmt = parseInt(document.getElementById('bet-stake')?.value) || 1;
    const slipState = { items: [] };
    panel.querySelectorAll('.odds-btn.selected, .ou-card.selected, .handicap-btn.selected, .cs-btn.selected').forEach(btn => {
      slipState.items.push({ bet: btn.dataset.bet, odds: parseFloat(btn.dataset.odds || '2.0') });
    });
    if (typeof updateBetSlipDisplay === 'function' && slipState.items.length > 0) {
      updateBetSlipDisplay(slipState, match, panel, stakeAmt);
    }
  } catch (e) { /* silent */ }
}

function updateOddsEl(selector, value) {
  if (!value) return;
  const el = document.querySelector(selector);
  if (!el) return;
  const oldVal = parseFloat(el.textContent.replace('@',''));
  const newVal = parseFloat(value);
  el.textContent = '@' + value.toFixed(2);
  if (!isNaN(oldVal)) {
    if (newVal > oldVal) { el.classList.add('flash-up'); setTimeout(() => el.classList.remove('flash-up'), 600); }
    else if (newVal < oldVal) { el.classList.add('flash-down'); setTimeout(() => el.classList.remove('flash-down'), 600); }
  }
}

function updateBetBtn(panel, betId, odds) {
  const btn = panel.querySelector(`[data-bet="${betId}"]`);
  if (btn) btn.dataset.odds = odds;
}

// ============ Bet Description ============
function betDescription(bet, match) {
  const h = (window.__BIUBIU_TEAMS__ && window.__BIUBIU_TEAMS__[match.home]) ? window.__BIUBIU_TEAMS__[match.home].zh : match.home;
  const a = (window.__BIUBIU_TEAMS__ && window.__BIUBIU_TEAMS__[match.away]) ? window.__BIUBIU_TEAMS__[match.away].zh : match.away;
  const map = {
    'win_home': h+'胜', 'win_draw': '平局', 'win_away': a+'胜',
    'ou_over25': '大2.5球', 'ou_under25': '小2.5球',
    'hc_home_0': h+'(0)', 'hc_away_0': a+'(0)',
    'hc_home_m1': h+'(-1)', 'hc_away_p1': a+'(+1)',
    'cs_1_0':'1:0','cs_2_0':'2:0','cs_2_1':'2:1','cs_0_0':'0:0',
    'cs_1_1':'1:1','cs_0_1':'0:1','cs_3_0':'3:0','cs_3_1':'3:1',
    'cs_0_2':'0:2','cs_2_2':'2:2','cs_3_2':'3:2','cs_other':'其他比分',
  };
  return map[bet] || bet;
}

function updateBetSlipDisplay(slipState, match, panel, stakeAmt) {
  slipState.items = [];
  panel.querySelectorAll('.odds-btn.selected, .ou-card.selected, .handicap-btn.selected, .cs-btn.selected').forEach(btn => {
    slipState.items.push({ bet: btn.dataset.bet, odds: parseFloat(btn.dataset.odds || '2.0') });
  });

  const slip = document.getElementById('bet-slip-inline');
  const slipItems = document.getElementById('bet-slip-items');
  const slipStake = document.getElementById('bet-slip-stake');
  const slipPayout = document.getElementById('bet-slip-payout');
  const slipCount = document.getElementById('slip-count');

  const n = slipState.items.length;
  const totalStake = n * stakeAmt;
  let maxPayout = 0;

  if (n > 0) {
    slip.classList.add('has-bets');
    if (slipCount) slipCount.textContent = `${n}注`;

    slipItems.innerHTML = slipState.items.map(item => {
      const desc = betDescription(item.bet, match);
      const odds = item.odds.toFixed(2);
      const payout = parseFloat((stakeAmt * item.odds).toFixed(2));
      if (payout > maxPayout) maxPayout = payout;
      return `<div class="bet-slip-row">
        <span style="flex:1">${desc}</span>
        <span style="color:var(--text-dim);font-size:11px">@${odds}</span>
        <span style="color:var(--gold);font-size:13px;font-weight:700">×${stakeAmt}</span>
        <span style="color:var(--green-light);font-size:12px">= ${payout.toFixed(2)}</span>
        <button class="bet-slip-remove" data-bet="${item.bet}">✕</button>
      </div>`;
    }).join('');

    slipStake.textContent = `${totalStake.toFixed(0)}`;
    slipPayout.textContent = `${maxPayout.toFixed(2)}`;

    slipItems.querySelectorAll('.bet-slip-remove').forEach(rm => {
      rm.addEventListener('click', () => {
        const bet = rm.dataset.bet;
        const btn = panel.querySelector(`[data-bet="${bet}"]`);
        if (btn) btn.classList.remove('selected');
        updateBetSlipDisplay(slipState, match, panel, parseInt(document.getElementById('bet-stake').value) || 1);
      });
    });
  } else {
    slip.classList.remove('has-bets');
    if (slipCount) slipCount.textContent = '0注';
  }
}

// ============ Live Events Polling ============
async function fetchAndRenderEvents(matchId, st) {
  const container = document.getElementById('live-events');
  const timeline = document.getElementById('events-timeline');
  if (!container || !timeline || !userVip) return;

  container.style.display = 'block';

  try {
    const res = await fetch(`${API_BASE}/events?id=${matchId}&minute=${st.minute}`);
    if (!res.ok) return;
    const data = await res.json();
    const events = data.events || [];

    if (events.length === 0) {
      timeline.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:20px;font-size:13px">比赛即将开始，等待事件...</div>';
      return;
    }

    timeline.innerHTML = events.map((ev, i) => {
      const isLatest = i === events.length - 1;
      return `<div class="event-row${isLatest ? ' event-latest' : ''}">
        <span class="event-minute">${ev.minute}'</span>
        <span class="event-icon">${ev.icon}</span>
        <span class="event-msg">${ev.message}</span>
        ${isLatest ? '<span class="event-new">NEW</span>' : ''}
      </div>`;
    }).join('');

    // Scroll to bottom
    timeline.scrollTop = timeline.scrollHeight;
  } catch(e) { /* silent */ }
}
// ============ Post-Match AI Report ============
function renderMatchReport(match) {
  const container = document.getElementById('match-report');
  if (!container) return;

  const st = getMatchStatus(match);
  if (st.status !== 'finished') { container.style.display = 'none'; return; }

  container.style.display = 'block';

  // Free users: summary only
  if (!userVip) {
    container.innerHTML = `<div class="report-summary">
      <h3 style="color:var(--gold);margin-bottom:8px">📝 AI赛后复盘</h3>
      <p style="color:var(--text-dim);font-size:13px">${match.home} ${st.homeScore}:${st.awayScore} ${match.away}</p>
      <a href="/subscribe.html" class="btn btn-gold" style="margin-top:10px;display:inline-block;font-size:13px;padding:8px 20px;text-decoration:none">⚡ 开通VIP查看AI复盘报告</a>
    </div>`;
    return;
  }

  // VIP: fetch full report
  const cachedKey = 'report_' + match.id;
  const cached = sessionStorage.getItem(cachedKey);
  if (cached) {
    container.innerHTML = cached;
    return;
  }

  container.innerHTML = `<div class="report-loading">
    <h3 style="color:var(--gold);margin-bottom:8px">📝 AI赛后复盘</h3>
    <p style="color:var(--text-dim)">🤖 biubiu正在撰写复盘报告...</p>
  </div>`;

  // Fetch from API
  const prediction = match.prediction || {};
  const events = window._lastEvents || [];

  fetch('/api/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      home: match.home, away: match.away,
      homeScore: st.homeScore, awayScore: st.awayScore,
      prediction, events
    })
  })
  .then(r => r.json())
  .then(data => {
    if (data.full) {
      const html = `<div class="report-body">
        <h3 style="color:var(--gold);margin-bottom:12px">📝 AI赛后复盘</h3>
        <div class="report-markdown">${markdownToHTML(data.full)}</div>
        <div style="font-size:11px;color:var(--text-dim);margin-top:12px;text-align:center">🤖 由${data.source === 'deepseek' ? 'DeepSeek AI' : 'biubiu统计模型'}生成</div>
      </div>`;
      container.innerHTML = html;
      sessionStorage.setItem(cachedKey, html);
    }
  })
  .catch(() => {
    container.innerHTML = `<div class="report-summary">
      <h3 style="color:var(--gold);margin-bottom:8px">📝 AI赛后复盘</h3>
      <p style="color:var(--text-dim)">${match.home} ${st.homeScore}:${st.awayScore} ${match.away} — 复盘报告生成中...</p>
    </div>`;
  });
}

// Simple markdown → HTML (handles ##, **, -, line breaks)
function markdownToHTML(md) {
  let html = md
    .replace(/^## (.*$)/gim, '<h4 style="color:var(--gold);margin:14px 0 6px;font-size:15px">$1</h4>')
    .replace(/^### (.*$)/gim, '<h5 style="color:var(--text);margin:10px 0 4px;font-size:14px">$1</h5>')
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--gold)">$1</strong>')
    .replace(/^- (.*$)/gim, '<div style="padding:2px 0 2px 12px;font-size:13px;color:var(--text-dim)">• $1</div>')
    .replace(/
/g, '<br>');
  return html;
}

// ============ Undo — time proportional refund, timeout=no refund ============
window.undoGuess = function(matchId) {
  const g = userGuesses[matchId];
  if (!g || g.final) return;

  const elapsed = (Date.now() - new Date(g.time).getTime()) / 1000;
  const undoWindow = userVip ? 60 : 30;

  if (elapsed <= undoWindow) {
    // Within window: proportional refund
    const ratio = Math.max(0, 1 - elapsed / undoWindow);
    const refund = parseFloat(((g.totalStake || 0) * ratio).toFixed(2));
    delete userGuesses[matchId];
    userPoints += refund;
    saveState();
    updatePointsDisplay();
    clearTimeout(guessTimers[matchId]);
    showToast(`↩️ 已撤销，返还 ${refund} 分（${Math.round(ratio * 100)}%）`);
  } else {
    // Timeout: cancel bet but no refund
    delete userGuesses[matchId];
    saveState();
    updatePointsDisplay();
    clearTimeout(guessTimers[matchId]);
    showToast('↩️ 已超时撤单，积分不返还');
  }

  // Reload to reset panel cleanly
  setTimeout(() => { location.reload(); }, 500);
};

// ============ Bet History Panel ============
function renderBetHistory(match) {
  const container = document.getElementById('bet-history');
  if (!container) return;

  const g = userGuesses[match.id];
  if (!g) { container.style.display = 'none'; return; }

  container.style.display = 'block';
  const rows = g.bets.map(b => {
    const desc = betDescription(b.bet, match);
    let statusHtml;
    if (g.final) {
      statusHtml = b.result === 'win'
        ? '<span style="color:var(--green-light)">✅ 中奖 +' + b.payout + '分</span>'
        : '<span style="color:var(--red)">❌ 未中</span>';
    } else {
      statusHtml = '<span style="color:var(--text-dim)">⏳ 待开奖</span>';
    }
    return `<tr>
      <td>${desc.split('(')[0] || desc}</td>
      <td>@${b.odds}</td>
      <td>${b.stake}</td>
      <td>${b.payout.toFixed(2)}</td>
      <td>${statusHtml}</td>
    </tr>`;
  }).join('');

  container.innerHTML = `
    <h3 style="color:var(--text-dim);font-size:14px;margin-bottom:12px">📋 我的投注记录</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="color:var(--text-dim);font-size:11px">
        <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)">选项</th>
        <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)">赔率</th>
        <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)">金额</th>
        <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)">预计赢</th>
        <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)">状态</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ============ Subscribe Page ============
function initSubscribePage() {
  const btn = document.getElementById('subscribe-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    showToast('📱 请扫描下方二维码，发送"biubiu订阅"给阿白。30秒内开通。');
  });
}

// ============ Points System ============
function updatePointsDisplay() {
  document.querySelectorAll('#points-badge, #points').forEach(el => {
    if (el) {
      const old = el.textContent;
      const nu = `⭐ ${Number.isInteger(userPoints) ? userPoints : userPoints.toFixed(1)}`;
      if (old !== nu && old !== '') {
        el.classList.add('points-flash');
        setTimeout(() => el.classList.remove('points-flash'), 400);
      }
      el.textContent = nu;
    }
  });
}

function saveState() {
  localStorage.setItem('biubiu_points', userPoints.toFixed(2));
  localStorage.setItem('biubiu_guesses', JSON.stringify(userGuesses));
  // NOTE: userVip NOT saved to localStorage — always from /api/me
}

// ============ Check-in (VIP x2) ============
function initCheckinButton() {
  const btn = document.getElementById('header-checkin');
  if (!btn) return;

  function updateBtnState() {
    const checked = localStorage.getItem('biubiu_last_checkin') === new Date().toDateString();
    if (checked) { btn.classList.add('done'); btn.textContent = '✅ 已签到'; }
    else { btn.classList.remove('done'); btn.textContent = '🎁 签到'; }
  }
  updateBtnState();

  btn.addEventListener('click', () => {
    const now = new Date().toDateString();
    if (localStorage.getItem('biubiu_last_checkin') === now) {
      showToast('✅ 今日已签到，明天再来吧~');
      return;
    }

    // VIP x2
    const dailyBonus = userVip ? 20 : 10;
    userPoints += dailyBonus;
    localStorage.setItem('biubiu_last_checkin', now);

    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const lastCheckin = localStorage.getItem('biubiu_last_checkin');
    const prevCheckin = localStorage.getItem('biubiu_last_checkin_before') || lastCheckin;
    const streak = prevCheckin === yesterday ? parseInt(localStorage.getItem('biubiu_streak') || '0') + 1 : 1;
    localStorage.setItem('biubiu_streak', streak);
    localStorage.setItem('biubiu_last_checkin_before', now);

    let extraMsg = '';
    if (streak === 7) {
      const streakBonus = userVip ? 100 : 50;
      userPoints += streakBonus;
      localStorage.setItem('biubiu_streak', '0');
      localStorage.setItem('biubiu_last_checkin_before', '');
      extraMsg = ` | 🔥 满7天！额外 +${streakBonus}积分！`;
    }

    saveState();
    updateBtnState();
    updatePointsDisplay();
    showSigninToast(streak, streak === 7, dailyBonus);
    if (window.bbfx) bbfx.clickSparks(
      btn.getBoundingClientRect().left + btn.offsetWidth/2,
      btn.getBoundingClientRect().top + btn.offsetHeight/2, 12
    );
  });
}

// ============ User Panel ============
function initUserButton() {
  const btn = document.getElementById('header-user');
  if (!btn) return;
  btn.addEventListener('click', () => showUserPanel());
}

function showUserPanel() {
  const existing = document.querySelector('.modal-overlay');
  if (existing) { existing.remove(); return; }

  const streak = parseInt(localStorage.getItem('biubiu_streak') || '0');
  const totalGuess = Object.keys(userGuesses).length;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" id="user-panel" style="max-width:380px">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px">
        <div class="avatar-upload-wrap" id="avatar-wrap" style="position:relative;cursor:pointer">
          ${userAvatar
            ? `<img src="${userAvatar}" class="avatar-img" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid var(--gold)">`
            : `<div style="width:56px;height:56px;background:linear-gradient(135deg,var(--gold),#b8942e);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px">👤</div>`
          }
          <div class="avatar-edit-badge">📷</div>
          <input type="file" accept="image/*" id="avatar-input" style="display:none">
        </div>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:6px">
            <span id="display-name" style="font-weight:700;font-size:16px">${userName}</span>
            <button class="edit-name-btn" id="edit-name-btn" style="background:none;border:none;font-size:14px;cursor:pointer;color:var(--text-dim)" title="修改昵称">✏️</button>
          </div>
          <div style="font-size:12px;color:var(--text-dim)">biubiu的球搭子</div>
          ${userVip ? '<div style="font-size:11px;color:var(--gold);margin-top:2px">👑 VIP会员</div>' : '<a href="/subscribe.html" style="font-size:11px;color:var(--gold)">开通VIP →</a>'}
        </div>
        <button style="align-self:flex-start;background:none;border:none;color:var(--text-dim);font-size:20px;cursor:pointer" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>

      <div id="login-section" style="margin-bottom:14px">
        <div style="font-size:12px;color:var(--text-dim);margin-bottom:8px">🔐 绑定账号（换设备数据不丢）</div>
        ${localStorage.getItem('biubiu_token')
          ? `<div style="font-size:12px;color:var(--green-light);margin-bottom:8px">✅ 已绑定微信 · 数据云端同步</div>`
          : `<a href="/login.html" class="btn btn-outline btn-block" style="font-size:13px;padding:10px;border-color:#07C160;color:#07C160;margin-bottom:6px;text-decoration:none;display:block;text-align:center;border-radius:10px;font-weight:600">💬 微信扫码登录</a>`
        }
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:18px">
        <div class="stat-box"><div class="stat-num">${userPoints}</div><div class="stat-label">总积分</div></div>
        <div class="stat-box"><div class="stat-num">🔥${streak}</div><div class="stat-label">连续签到</div></div>
        <div class="stat-box"><div class="stat-num">${totalGuess}</div><div class="stat-label">竞猜次数</div></div>
      </div>

      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px;margin-bottom:14px">
        <div style="font-size:12px;color:var(--text-dim);margin-bottom:8px">📋 签到周进度</div>
        <div style="display:flex;gap:6px">
          ${[1,2,3,4,5,6,7].map(d => {
            const done = d <= streak;
            return `<div style="width:32px;height:32px;border-radius:50%;border:2px solid ${done?'var(--gold)':'var(--border)'};background:${done?'rgba(255,215,0,0.2)':'transparent'};display:flex;align-items:center;justify-content:center;font-size:14px;color:${done?'var(--gold)':'var(--text-dim)'}">${done?'✓':d}</div>`;
          }).join('')}
        </div>
        <div style="font-size:11px;color:var(--text-dim);margin-top:6px">连续7天额外+${userVip ? '100' : '50'}积分</div>
      </div>

      <div style="font-size:12px;color:var(--text-dim);text-align:center">
        ⚠️ 积分免费获取，不可充值/提现/兑换现金
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  document.getElementById('avatar-wrap').addEventListener('click', () => document.getElementById('avatar-input').click());
  document.getElementById('avatar-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('头像不能超过2MB哦'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      userAvatar = ev.target.result;
      localStorage.setItem('biubiu_avatar', userAvatar);
      overlay.remove();
      showUserPanel();
      showToast('📷 头像更新成功！');
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('edit-name-btn').addEventListener('click', () => {
    const newName = prompt('输入新昵称（最多12字）：', userName);
    if (newName && newName.trim()) {
      userName = newName.trim().slice(0, 12);
      localStorage.setItem('biubiu_username', userName);
      document.getElementById('display-name').textContent = userName;
      showToast('✏️ 昵称已更新');
    }
  });

  updateUserAvatarInHeader();
}

function updateUserAvatarInHeader() {
  const btn = document.getElementById('header-user');
  if (!btn) return;
  if (userAvatar) {
    btn.innerHTML = `<img src="${userAvatar}" style="width:28px;height:28px;border-radius:50%;object-fit:cover">`;
  }
}

function showSigninToast(streak, bonus, dailyBonus) {
  const toast = document.createElement('div');
  toast.className = 'signin-toast';
  toast.innerHTML = `
    <span class="coin">🪙</span>
    <div class="title">🎁 每日签到 +${dailyBonus}积分${userVip ? ' (VIP双倍)' : ''}</div>
    <div class="sub">连续签到第 <strong style="color:var(--gold)">${streak}</strong> 天${bonus ? ` | 🔥 满7天！额外 +${userVip ? '100' : '50'}积分！` : ''}</div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ============ Countdown ============
function startCountdown() {
  function tick() {
    const now = new Date();
    const diff = WC_START - now;
    if (diff <= 0) {
      ['d','h','m','s'].forEach(u => { const el = document.getElementById('cd-'+u); if (el) el.textContent = '0'; });
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    ['d','h','m','s'].forEach((u,i) => {
      const el = document.getElementById('cd-'+u);
      if (el) el.textContent = String([d,h,m,s][i]).padStart(2,'0');
    });
  }
  tick();
  setInterval(tick, 1000);
}

// ============ Toast ============
function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ============ Global click: navigate to match detail ============
document.addEventListener('click', (e) => {
  const card = e.target.closest('.match-card');
  if (card && card.dataset.matchId) {
    showPageLoading('⚡ biubiu正在分析这场比赛...');
    setTimeout(() => {
      window.location.href = `/match.html?id=${card.dataset.matchId}`;
    }, 400);
  }
});

// ============ AUTO SETTLEMENT ============
function autoSettleAll() {
  const matches = window.__BIUBIU_DATA__?.matches || [];
  let settled = 0;

  for (const [matchIdStr, guess] of Object.entries(userGuesses)) {
    if (guess.final) continue;

    const matchId = parseInt(matchIdStr);
    const match = matches.find(m => m.id === matchId);
    if (!match) continue;

    // Check if match has scores
    const hs = match.home_score;
    const as = match.away_score;
    if (hs === undefined || hs === null || as === undefined || as === null) continue;

    // Match must be over (kickoff + 120min has passed) OR scores explicitly set
    const kickoff = new Date(match.date + 'T00:00:00Z');
    const matchEnd = new Date(kickoff.getTime() + 150 * 60000); // +2.5h buffer
    if (new Date() < matchEnd) continue;

    // Settle!
    guess.bets.forEach(bet => {
      const won = judgeBet(bet.bet, hs, as);
      bet.result = won ? 'win' : 'loss';
      if (won) userPoints += bet.payout;
    });
    guess.final = true;
    settled++;
  }

  if (settled > 0) {
    saveState();
    updatePointsDisplay();
    showToast(`🎉 ${settled} 场比赛已自动结算！`);
  }
}

/**
 * Judge if a bet wins based on final score
 */
function judgeBet(bet, homeScore, awayScore) {
  const totalGoals = homeScore + awayScore;

  switch (bet) {
    // 胜平负
    case 'win_home': return homeScore > awayScore;
    case 'win_draw': return homeScore === awayScore;
    case 'win_away': return homeScore < awayScore;

    // 大小球
    case 'ou_over25': return totalGoals > 2.5;
    case 'ou_under25': return totalGoals < 2.5;

    // 让球 (0)
    case 'hc_home_0': return homeScore > awayScore;
    case 'hc_away_0': return homeScore < awayScore;

    // 让球 (-1/+1)
    case 'hc_home_m1': return (homeScore - 1) > awayScore;
    case 'hc_away_p1': return homeScore < (awayScore + 1);

    // 猜比分
    case 'cs_1_0': return homeScore === 1 && awayScore === 0;
    case 'cs_2_0': return homeScore === 2 && awayScore === 0;
    case 'cs_2_1': return homeScore === 2 && awayScore === 1;
    case 'cs_0_0': return homeScore === 0 && awayScore === 0;
    case 'cs_1_1': return homeScore === 1 && awayScore === 1;
    case 'cs_0_1': return homeScore === 0 && awayScore === 1;
    case 'cs_3_0': return homeScore === 3 && awayScore === 0;
    case 'cs_3_1': return homeScore === 3 && awayScore === 1;
    case 'cs_0_2': return homeScore === 0 && awayScore === 2;
    case 'cs_2_2': return homeScore === 2 && awayScore === 2;
    case 'cs_3_2': return homeScore === 3 && awayScore === 2;
    case 'cs_other': {
      const scores = ['1_0','2_0','2_1','0_0','1_1','0_1','3_0','3_1','0_2','2_2','3_2'];
      const key = `${homeScore}_${awayScore}`;
      return !scores.includes(key);
    }

    default: return false;
  }
}

// ============ LEADERBOARD (dynamic) ============
function renderLeaderboard() {
  const el = document.getElementById('leaderboard');
  if (!el) return;

  // Get all users from localStorage
  const users = [];
  const seen = new Set();

  // Current user
  users.push({ name: userName, points: userPoints, vip: userVip, isMe: true });
  seen.add(userName);

  // VIP users from admin list
  try {
    const vipUsers = JSON.parse(localStorage.getItem('biubiu_vip_users') || '[]');
    vipUsers.forEach(u => {
      if (!seen.has(u.name)) {
        users.push({ name: u.name, points: 0, vip: true, isMe: false });
        seen.add(u.name);
      }
    });
  } catch (e) { /* ignore */ }

  // Sort by points desc
  users.sort((a, b) => b.points - a.points);

  const rankEmojis = ['🥇', '🥈', '🥉'];
  el.innerHTML = users.slice(0, 10).map((u, i) => {
    const rank = i + 1;
    const rc = rank <= 3 ? `r${rank}` : '';
    return `<li>
      <span class="rank ${rc}">${rank <= 3 ? rankEmojis[i] : rank}</span>
      <span class="user">${u.name}${u.vip ? ' 👑' : ''}${u.isMe ? ' (你)' : ''}</span>
      <span class="pts">⭐ ${u.points.toLocaleString()}</span>
    </li>`;
  }).join('');
}
