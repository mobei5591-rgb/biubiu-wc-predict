/**
 * GET /api/live — get live match data
 * In production: polls SportScore MCP or 聚合数据 for real-time scores
 * MVP: returns match data with live status simulation
 */
const { getLiveMatchData } = require('../lib/data-fetcher');
const { predictMatch } = require('../lib/ai-engine');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const matchId = parseInt(req.query?.id || '0');
  if (!matchId) {
    return res.status(400).json({ error: 'biubiu不知道要看哪场比赛' });
  }

  const match = await getLiveMatchData(matchId);
  if (!match) {
    return res.status(404).json({ error: '比赛不存在' });
  }

  // If live, recalculate win probability based on "live" data
  if (match.live && match.score) {
    const base = match.win_probability;
    // Adjust for current score
    const goalDiff = match.score.home - match.score.away;
    const timeLeft = (90 - match.minute) / 90;
    const adjustedHome = Math.min(98, base.home + goalDiff * 15 * timeLeft);
    const adjustedAway = Math.max(2, base.away - goalDiff * 15 * timeLeft);
    const adjustedDraw = 100 - adjustedHome - adjustedAway;

    match.live_probability = {
      home: Math.round(adjustedHome),
      draw: Math.round(adjustedDraw),
      away: Math.round(adjustedAway)
    };
  }

  res.status(200).json(match);
};
