/**
 * SportScore API client — free live football data
 * Base: https://sportscore.com | ~10k req/24h free
 * Attribution: "Powered by SportScore" badge required
 */
window.__BIUBIU_SPORTSCORE__ = (function() {
  const BASE = 'https://sportscore.com/api/widget';
  const SRC = 'biubiu-wc-predict';
  const CACHE_MS = 60000; // 60s cache (matches API cache)
  let cache = {};

  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`SportScore ${res.status}`);
    return res.json();
  }

  function cached(key, fetcher) {
    const now = Date.now();
    if (cache[key] && (now - cache[key].ts) < CACHE_MS) {
      return Promise.resolve(cache[key].data);
    }
    return fetcher().then(data => {
      cache[key] = { data, ts: now };
      return data;
    });
  }

  // Get live + recent World Cup matches
  function getWorldCupMatches(limit = 20) {
    return cached('wc_matches_' + limit, () =>
      fetchJSON(`${BASE}/matches/?sport=football&limit=${limit}&src=${SRC}`)
        .then(d => ({
          matches: (d.matches || []).filter(m =>
            m.competition_slug === 'fifa-world-cup' ||
            (m.competition_name || '').toLowerCase().includes('world cup')
          )
        }))
    );
  }

  // Get single match detail
  function getMatchDetail(slug) {
    return cached('match_' + slug, () =>
      fetchJSON(`${BASE}/match/?sport=football&slug=${encodeURIComponent(slug)}&src=${SRC}`)
    );
  }

  // Get World Cup standings
  function getStandings() {
    return cached('wc_standings', () =>
      fetchJSON(`${BASE}/standings/?sport=football&slug=fifa-world-cup&src=${SRC}`)
    );
  }

  // Get top scorers
  function getTopScorers(limit = 20) {
    return cached('wc_scorers_' + limit, () =>
      fetchJSON(`${BASE}/topscorers/?sport=football&slug=fifa-world-cup&limit=${limit}&src=${SRC}`)
    );
  }

  // Map external team names to our internal names
  function matchTeamName(external, ourTeams) {
    if (!ourTeams) return external;
    // Try direct match first
    if (ourTeams[external]) return external;
    // Try fuzzy match on zh name
    for (const [key, val] of Object.entries(ourTeams)) {
      if (val.zh === external || val.en.toLowerCase() === external.toLowerCase()) return key;
      if (external.toLowerCase().includes(val.en.toLowerCase())) return key;
    }
    return external;
  }

  return {
    getWorldCupMatches,
    getMatchDetail,
    getStandings,
    getTopScorers,
    matchTeamName,
    BASE,
    SRC
  };
})();
