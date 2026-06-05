/**
 * GET /api/juhe/matches — Juhe real data merged with local predictions
 * Priority: Juhe scores > SportScore > local simulation
 */
const { isReady, getAllMatches } = require('../lib/juhe-client');
const { getAllMatches: getLocalMatches, calculateBaseProbability } = require('../lib/data-fetcher');

// Team name mapping: local English → Juhe Chinese (for merging)
const TEAM_MAP = {
  'Canada': '加拿大', 'Mexico': '墨西哥', 'Iran': '伊朗', 'Morocco': '摩洛哥',
  'France': '法国', 'Ukraine': '乌克兰', 'New Zealand': '新西兰', 'Burkina Faso': '布基纳法索',
  'Brazil': '巴西', 'South Africa': '南非', 'Sweden': '瑞典', 'South Korea': '韩国',
  'England': '英格兰', 'United Arab Emirates': '阿联酋', 'UAE': '阿联酋',
  'Senegal': '塞内加尔', 'USA': '美国', 'Spain': '西班牙', 'Costa Rica': '哥斯达黎加',
  'Netherlands': '荷兰', 'Egypt': '埃及', 'Portugal': '葡萄牙', 'Honduras': '洪都拉斯',
  'Croatia': '克罗地亚', 'Qatar': '卡塔尔', 'Germany': '德国', 'Iraq': '伊拉克',
  'Serbia': '塞尔维亚', 'Chile': '智利', 'Argentina': '阿根廷', 'Jamaica': '牙买加',
  'Japan': '日本', 'Poland': '波兰', 'Italy': '意大利', 'Saudi Arabia': '沙特阿拉伯',
  'Uruguay': '乌拉圭', 'Australia': '澳大利亚', 'Belgium': '比利时', 'Mali': '马里',
  'Denmark': '丹麦', 'Peru': '秘鲁', 'Colombia': '哥伦比亚', 'Panama': '巴拿马',
  'Switzerland': '瑞士', 'Nigeria': '尼日利亚', 'Austria': '奥地利',
  'New Caledonia': '新喀里多尼亚', 'Ecuador': '厄瓜多尔', 'Senegal B': '塞内加尔B'
};

const REV_MAP = {};
for (const [en, zh] of Object.entries(TEAM_MAP)) REV_MAP[zh] = en;

module.exports = async function handler(req, res) {
  try {
    // Get local data for predictions
    const localMatches = getLocalMatches();
    const localById = {};
    for (const m of localMatches) {
      localById[m.home + '|' + m.away] = m;
      localById[m.home + '|' + m.home] = m; // fallback
    }

    let matches;

    if (isReady()) {
      // Fetch real data from Juhe
      const juheData = await getAllMatches();
      const juheMatches = juheData.matches || [];
      const juheStandings = juheData.standings || {};

      // Merge Juhe scores with local predictions
      matches = juheMatches.map(jm => {
        // Map Chinese team names back to English
        const homeEn = REV_MAP[jm.home] || jm.home;
        const awayEn = REV_MAP[jm.away] || jm.away;

        // Find local match for prediction data
        const local = localMatches.find(m =>
          (REV_MAP[m.home] || m.home) === homeEn &&
          (REV_MAP[m.away] || m.away) === awayEn
        );

        // Build prediction from local data
        const prediction = local?.prediction || {
          ...calculateBaseProbability(homeEn, awayEn),
          ai: { source: 'statistical', reason: '等比赛开始...', confidence: 3 }
        };

        return {
          id: jm.id,
          date: jm.date,
          time: jm.time,
          group: jm.group,
          stage: jm.stage,
          home: homeEn,
          away: awayEn,
          home_zh: jm.home,
          away_zh: jm.away,
          home_logo: jm.home_logo,
          away_logo: jm.away_logo,
          home_score: jm.status === 'upcoming' ? null : jm.home_score,
          away_score: jm.status === 'upcoming' ? null : jm.away_score,
          status: jm.status,
          status_text: jm.status_text,
          prediction,
          source: 'juhe'
        };
      });

      res.json({ matches, count: matches.length, standings: juheStandings, source: 'juhe' });
    } else {
      // Fallback to local data
      matches = localMatches;
      res.json({ matches, count: matches.length, source: 'local' });
    }
  } catch (e) {
    // Fallback to local on error
    try {
      const matches = getLocalMatches();
      res.json({ matches, count: matches.length, source: 'local_fallback' });
    } catch (e2) {
      res.status(500).json({ error: e.message });
    }
  }
};
