/**
 * Juhe (聚合数据) 2026 World Cup API client
 * Endpoint: /fapigw/worldcup2026/schedule
 * Free tier: ~50 calls/day — cached 5min client-side
 *
 * Data mapping:
 *   match_status: 1=未开赛 2=进行中 3=已结束
 *   host_team_score/guest_team_score: "-" = no score, "1" "2" = actual
 */

const JUHE_BASE = 'https://apis.juhe.cn';
const JUHE_KEY = process.env.JUHE_APPKEY || '';

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function isReady() { return !!JUHE_KEY; }

async function juheGet(path, params = {}) {
  if (!JUHE_KEY) throw new Error('JUHE_APPKEY not configured');
  const url = new URL(JUHE_BASE + path);
  url.searchParams.set('key', JUHE_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const cacheKey = url.toString();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Juhe HTTP ${res.status}`);
  const data = await res.json();
  if (data.error_code !== 0 && data.reason) throw new Error(data.reason);

  const result = data.result?.data || data.result || data;
  cache.set(cacheKey, { data: result, ts: Date.now() });
  return result;
}

/**
 * Get all matches from schedule — maps to our internal format
 * Returns { matches: [...], standings: {...} }
 */
async function getAllMatches() {
  const days = await juheGet('/fapigw/worldcup2026/schedule');
  const matches = [];
  const groupStandings = {};

  for (const day of days) {
    for (const m of (day.schedule_list || [])) {
      const hs = parseScore(m.host_team_score);
      const as = parseScore(m.guest_team_score);
      const status = m.match_status === '1' ? 'upcoming' :
                     m.match_status === '2' ? 'live' :
                     m.match_status === '3' ? 'finished' : 'upcoming';

      const match = {
        id: parseInt(m.team_id),
        date: m.date,
        time: (m.date_time || '').split(' ')[1] || '00:00',
        group: m.group_name,
        stage: m.match_type_name === '小组赛' ? 'group' :
               m.match_type_name.includes('决赛') ? 'final' :
               m.match_type_name.includes('半决赛') ? 'semi' :
               m.match_type_name.includes('1/4') ? 'quarter' :
               m.match_type_name.includes('1/8') ? 'r16' :
               m.match_type_name.includes('1/16') ? 'r32' : 'group',
        home: m.host_team_name,
        away: m.guest_team_name,
        home_logo: m.host_team_logo_url,
        away_logo: m.guest_team_logo_url,
        home_score: hs,
        away_score: as,
        status,
        status_text: m.match_des
      };
      matches.push(match);

      // Build group standings from match results
      const g = m.group_name;
      if (status === 'finished' && g) {
        if (!groupStandings[g]) groupStandings[g] = {};
        const key = (t) => t;
        const home = key(m.host_team_name);
        const away = key(m.guest_team_name);
        if (!groupStandings[g][home]) groupStandings[g][home] = { name: m.host_team_name, pts: 0, gf: 0, ga: 0, logo: m.host_team_logo_url };
        if (!groupStandings[g][away]) groupStandings[g][away] = { name: m.guest_team_name, pts: 0, gf: 0, ga: 0, logo: m.guest_team_logo_url };
        groupStandings[g][home].gf += hs;
        groupStandings[g][home].ga += as;
        groupStandings[g][away].gf += as;
        groupStandings[g][away].ga += hs;
        if (hs > as) groupStandings[g][home].pts += 3;
        else if (as > hs) groupStandings[g][away].pts += 3;
        else { groupStandings[g][home].pts += 1; groupStandings[g][away].pts += 1; }
      }
    }
  }

  return { matches, standings: groupStandings };
}

function parseScore(val) {
  if (val == null || val === '-' || val === '') return null;
  const n = parseInt(val);
  return isNaN(n) ? null : n;
}

module.exports = { isReady, getAllMatches };
