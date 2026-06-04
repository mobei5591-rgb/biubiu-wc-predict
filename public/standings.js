/**
 * Group standings renderer — renders all 12 World Cup groups
 */

// Team info lookup
window.__BIUBIU_TEAMS__ = window.__BIUBIU_TEAMS__ || {};
window.__BIUBIU_STANDINGS__ = window.__BIUBIU_STANDINGS__ || {};

function getStandingsForGroup(groupName) {
  const group = window.__BIUBIU_STANDINGS__[groupName];
  if (!group) return [];

  // Build table rows from team list
  return group.teams.map(teamName => {
    const team = window.__BIUBIU_TEAMS__[teamName] || { cc: 'xx', zh: teamName, en: teamName };
    const matches = group.matches.filter(m => m.home === teamName || m.away === teamName);

    // Calculate stats from played matches
    let P = 0, W = 0, D = 0, L = 0, GF = 0, GA = 0;
    matches.forEach(m => {
      if (m.home_score === null || m.away_score === null) return; // not played
      P++;
      const isHome = m.home === teamName;
      const scored = isHome ? m.home_score : m.away_score;
      const conceded = isHome ? m.away_score : m.home_score;
      GF += scored;
      GA += conceded;
      if (scored > conceded) W++;
      else if (scored === conceded) D++;
      else L++;
    });

    const PTS = W * 3 + D;
    const GD = GF - GA;

    return {
      team: teamName,
      flag: `https://flagcdn.com/w160/${team.cc}.png`,
      zh: team.zh,
      P, W, D, L, GF, GA, GD, PTS,
      rank: 0 // computed below
    };
  }).sort((a, b) => {
    // Sort: PTS desc, GD desc, GF desc
    if (b.PTS !== a.PTS) return b.PTS - a.PTS;
    if (b.GD !== a.GD) return b.GD - a.GD;
    return b.GF - a.GF;
  }).map((row, i) => {
    row.rank = i + 1;
    return row;
  });
}

function renderStandingsHTML(groupName) {
  const rows = getStandingsForGroup(groupName);
  return `
  <div class="standings-group" id="group-${groupName}">
    <h2 class="section-title"><span class="icon">📊</span> ${groupName} 组</h2>
    <div class="standings-table-wrap">
      <table class="standings-table">
        <thead>
          <tr>
            <th class="st-rank">#</th>
            <th class="st-team">球队</th>
            <th>赛</th>
            <th>胜</th>
            <th>平</th>
            <th>负</th>
            <th>进/失</th>
            <th>净</th>
            <th>分</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => `
          <tr class="${i < 2 ? 'st-qualify' : ''}">
            <td class="st-rank">${r.rank}</td>
            <td class="st-team">
              <div style="display:flex;align-items:center;gap:8px">
                <img src="${r.flag}" alt="${r.zh}" class="st-flag" loading="lazy" onerror="this.style.display='none'">
                <div>
                  <div class="st-name">${r.zh}</div>
                  <div class="st-en">${r.team}</div>
                </div>
              </div>
            </td>
            <td>${r.P}</td>
            <td>${r.W}</td>
            <td>${r.D}</td>
            <td>${r.L}</td>
            <td>${r.GF}-${r.GA}</td>
            <td>${r.GD >= 0 ? '+' + r.GD : r.GD}</td>
            <td class="st-pts">${r.PTS}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;font-size:11px;color:var(--text-dim)">
      ${groupMatchesHTML(groupName)}
    </div>
  </div>`;
}

function groupMatchesHTML(groupName) {
  const group = window.__BIUBIU_STANDINGS__[groupName];
  if (!group) return '';
  return group.matches.map(m => {
    const statusIcon = m.status === 'finished' ? '✅' : m.status === 'live' ? '<span class="live-dot"></span>' : '⏳';
    const score = m.home_score !== null ? ` ${m.home_score}-${m.away_score}` : '';
    return `<span style="background:var(--bg-card);padding:3px 8px;border-radius:4px;border:1px solid var(--border)">${statusIcon} ${m.date.slice(5)} ${m.home} vs ${m.away}${score}</span>`;
  }).join('');
}

// Init on page load
document.addEventListener('DOMContentLoaded', () => {
  if (window.injectBiubiuDefs) window.injectBiubiuDefs();

  const logoEl = document.getElementById('logo-biubiu');
  if (logoEl && window.biubiu && window.biubiu.biubiuMini) {
    logoEl.innerHTML = window.biubiu.biubiuMini();
  }

  // Standings hero biubiu
  const sb = document.getElementById('standings-biubiu');
  if (sb && window.biubiu && window.biubiu.biubiuConfident) {
    sb.innerHTML = window.biubiu.biubiuConfident(60);
  }

  // Tilt effect on standings group cards
  if (window.bbfx && window.bbfx.tiltCard) {
    document.querySelectorAll('.standings-table').forEach(t => {
      t.closest('.standings-table-wrap').style.perspective = '800px';
      bbfx.tiltCard(t, { maxTilt: 3, glare: false });
    });
  }

  // Render all 12 groups
  const container = document.getElementById('standings-container');
  if (!container) return;
  const groups = 'ABCDEFGHIJKL'.split('');
  container.innerHTML = groups.map(g => renderStandingsHTML(g)).join('');
});
