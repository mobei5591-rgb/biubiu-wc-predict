/**
 * GET /api/matches — list all matches with predictions
 * Query: ?date=2026-06-11 (optional filter)
 */
const { getAllMatches, getMatchesByDate, calculateBaseProbability } = require('../lib/data-fetcher');
const { predictMatch } = require('../lib/ai-engine');

// Cache predictions in memory (serverless — resets between calls, fine for MVP)
const predictionCache = {};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const date = req.query?.date;
  const matches = date ? getMatchesByDate(date) : getAllMatches();

  // Generate predictions (with light caching)
  const results = await Promise.all(matches.map(async (m) => {
    const cacheKey = `${m.home}-${m.away}`;
    if (!predictionCache[cacheKey]) {
      const base = calculateBaseProbability(m.home, m.away);
      const ai = await predictMatch(m.home, m.away);
      predictionCache[cacheKey] = { ...base, ai };
    }
    return {
      id: m.id,
      date: m.date,
      group: m.group,
      home: m.home,
      away: m.away,
      venue: m.venue,
      stage: m.stage,
      home_rank: m.home_rank,
      away_rank: m.away_rank,
      home_flag: getFlag(m.home),
      away_flag: getFlag(m.away),
      prediction: predictionCache[cacheKey]
    };
  }));

  res.status(200).json({ matches: results, count: results.length });
};

function getFlag(team) {
  const flags = {
    'Argentina': '🇦🇷','Brazil': '🇧🇷','France': '🇫🇷','England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'Spain': '🇪🇸','Portugal': '🇵🇹','Germany': '🇩🇪','Italy': '🇮🇹',
    'Netherlands': '🇳🇱','Belgium': '🇧🇪','Croatia': '🇭🇷','Colombia': '🇨🇴',
    'Uruguay': '🇺🇾','Denmark': '🇩🇰','Japan': '🇯🇵','Senegal': '🇸🇳',
    'Mexico': '🇲🇽','Switzerland': '🇨🇭','Morocco': '🇲🇦','USA': '🇺🇸',
    'Serbia': '🇷🇸','Austria': '🇦🇹','Sweden': '🇸🇪','South Korea': '🇰🇷',
    'Poland': '🇵🇱','Chile': '🇨🇱','Peru': '🇵🇪','Ecuador': '🇪🇨',
    'Egypt': '🇪🇬','Nigeria': '🇳🇬','Australia': '🇦🇺','Iran': '🇮🇷',
    'Canada': '🇨🇦','Ukraine': '🇺🇦','Costa Rica': '🇨🇷','Qatar': '🇶🇦',
    'South Africa': '🇿🇦','Jamaica': '🇯🇲','Panama': '🇵🇦','Burkina Faso': '🇧🇫',
    'Saudi Arabia': '🇸🇦','Mali': '🇲🇱','New Zealand': '🇳🇿','Honduras': '🇭🇳',
    'Iraq': '🇮🇶','United Arab Emirates': '🇦🇪','New Caledonia': '🇳🇨',
    'Senegal B': '🇸🇳'
  };
  return flags[team] || '⚽';
}
