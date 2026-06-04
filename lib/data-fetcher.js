/**
 * Data fetcher — aggregates match data from multiple free sources:
 * - openfootball/worldcup.json (static schedule + team data)
 * - SportScore MCP (real-time scores, standings)
 * - 聚合数据 API (domestic backup)
 */

const MATCH_DATA = require('../data/worldcup-2026.json');

// FIFA-ish ranking points for strength calculation
const RANKING_POINTS = {
  1: 100, 2: 95, 3: 92, 4: 90, 5: 88, 6: 85, 7: 83, 8: 80,
  9: 78, 10: 76, 11: 74, 12: 72, 13: 70, 14: 68, 15: 66,
  16: 64, 17: 62, 18: 60, 19: 58, 20: 56, 21: 54, 22: 52,
  23: 50, 24: 48, 25: 46, 26: 44, 27: 42, 28: 40, 29: 38,
  30: 36, 31: 34, 32: 32, 33: 30, 34: 28, 35: 26, 36: 24,
  37: 22, 38: 20, 39: 18, 40: 16, 41: 14, 42: 12, 43: 10,
  44: 8, 45: 6, 46: 4, 47: 2, 48: 1
};

/**
 * Get all World Cup matches with team data
 */
function getAllMatches() {
  const { teams, groups, matches, team_rankings } = MATCH_DATA;
  return matches.map(m => ({
    ...m,
    home_rank: team_rankings[m.home] || 99,
    away_rank: team_rankings[m.away] || 99,
    home_points: RANKING_POINTS[team_rankings[m.home]] || 0,
    away_points: RANKING_POINTS[team_rankings[m.away]] || 0,
    group_name: m.group
  }));
}

/**
 * Get matches for a specific date
 */
function getMatchesByDate(date) {
  return getAllMatches().filter(m => m.date === date);
}

/**
 * Get all groups
 */
function getAllGroups() {
  const { groups, team_rankings } = MATCH_DATA;
  return Object.entries(groups).map(([name, teams]) => ({
    name,
    teams: teams.map(t => ({
      name: t,
      rank: team_rankings[t] || 99,
      points: RANKING_POINTS[team_rankings[t]] || 0
    }))
  }));
}

/**
 * Calculate base win probability from ranking points (no AI yet)
 * Returns probability for home_win, draw, away_win
 */
function calculateBaseProbability(homeTeam, awayTeam) {
  const homePts = RANKING_POINTS[MATCH_DATA.team_rankings[homeTeam]] || 30;
  const awayPts = RANKING_POINTS[MATCH_DATA.team_rankings[awayTeam]] || 30;
  const total = homePts + awayPts;

  // Home advantage ~8% boost
  const rawHome = (homePts / total) * 0.92 + 0.08;

  // Draw probability peaks when teams are close
  const gap = Math.abs(homePts - awayPts);
  const drawRaw = Math.max(0.12, 0.35 - gap / 200);

  const home = Math.round((rawHome * (1 - drawRaw)) * 100);
  const draw = Math.round(drawRaw * 100);
  const away = 100 - home - draw;

  return { home, draw, away };
}

/**
 * Get simulated live match data
 * In production: replace with SportScore MCP real-time API
 */
async function getLiveMatchData(matchId) {
  const matches = getAllMatches();
  const match = matches.find(m => m.id === matchId);
  if (!match) return null;

  // Simulated live data — replace with real API in production
  const now = new Date();
  const matchDate = new Date(match.date + 'T00:00:00Z');
  const isLive = Math.abs(now - matchDate) < 4 * 60 * 60 * 1000; // Within 4h window

  if (!isLive) {
    return { ...match, live: false, score: null, minute: null, events: [] };
  }

  return {
    ...match,
    live: true,
    score: { home: 0, away: 0 },
    minute: Math.floor(Math.random() * 90),
    events: [],
    win_probability: calculateBaseProbability(match.home, match.away)
  };
}

module.exports = {
  getAllMatches,
  getMatchesByDate,
  getAllGroups,
  calculateBaseProbability,
  getLiveMatchData,
  MATCH_DATA
};
