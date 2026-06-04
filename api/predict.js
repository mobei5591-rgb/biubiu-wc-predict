/**
 * POST /api/predict — get AI prediction for a specific match
 * Body: { home, away }
 */
const { predictMatch } = require('../lib/ai-engine');
const { calculateBaseProbability } = require('../lib/data-fetcher');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { home, away } = req.body || req.query || {};
  if (!home || !away) {
    return res.status(400).json({ error: 'biubiu需要知道主队和客队名字哦' });
  }

  const base = calculateBaseProbability(home, away);
  const ai = await predictMatch(home, away, {
    odds: req.body?.odds || '',
    recent: req.body?.recent || '',
    h2h: req.body?.h2h || ''
  });

  res.status(200).json({
    home,
    away,
    base_probability: base,
    ai_prediction: ai,
    biubiu_says: ai.reason
  });
};
