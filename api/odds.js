/**
 * GET /api/odds?id=1 — live betting odds for a match
 * Returns: { win, overUnder, handicap, correctScore, source, timestamp }
 *
 * Query: ?id=1 (match ID, required)
 *        ?tick=true (advance one step of live movement, for polling)
 */

const { getLiveOdds, tickLiveOdds, getCorrectScoreOdds } = require('../lib/odds-fetcher');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const matchId = parseInt(req.query?.id || '0');
  if (!matchId) return res.status(400).json({ error: '需要指定比赛ID' });

  const tick = req.query?.tick === 'true';

  try {
    let odds;
    if (tick) {
      odds = tickLiveOdds(matchId);
      if (!odds) odds = await getLiveOdds(matchId);
    } else {
      odds = await getLiveOdds(matchId);
    }

    if (!odds) return res.status(404).json({ error: '比赛不存在' });

    // Add correct score odds
    const { MATCH_DATA } = require('../lib/data-fetcher');
    const match = MATCH_DATA.matches.find(m => m.id === matchId);
    if (match) {
      odds.correctScore = getCorrectScoreOdds(match);
    }

    // Add source info
    odds._note = odds.source === 'the-odds-api'
      ? '博彩公司实时赔率 (The Odds API)'
      : '基于FIFA排名差 + 真实赔率模式模拟（配置ODDS_API_KEY环境变量获取真实博彩数据：https://the-odds-api.com）';

    res.status(200).json(odds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
