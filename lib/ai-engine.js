/**
 * AI Prediction Engine — uses DeepSeek API to generate match predictions
 * Combines: team rankings, historical data, betting odds, expert consensus
 *
 * No API key? Falls back to statistical model (still looks good for demos)
 */

const { MATCH_DATA, calculateBaseProbability } = require('./data-fetcher');

// Try to init DeepSeek client
let openai;
try { openai = require('openai'); } catch(e) { /* optional */ }

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_BASE = 'https://api.deepseek.com';

function getClient() {
  if (!DEEPSEEK_API_KEY || !openai) return null;
  return new openai.OpenAI({ apiKey: DEEPSEEK_API_KEY, baseURL: DEEPSEEK_BASE });
}

/**
 * Generate AI prediction for a match
 * Falls back to statistical model if no API key
 */
async function predictMatch(homeTeam, awayTeam, context = {}) {
  const baseProbs = calculateBaseProbability(homeTeam, awayTeam);
  const client = getClient();

  // Statistical fallback (no DeepSeek key)
  if (!client) {
    return buildStatisticalPrediction(homeTeam, awayTeam, baseProbs, context);
  }

  try {
    const prompt = buildPrompt(homeTeam, awayTeam, baseProbs, context);
    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 600
    });

    const text = response.choices[0].message.content;
    return parseAIResponse(text, homeTeam, awayTeam, baseProbs);
  } catch (err) {
    console.error('DeepSeek API error:', err.message);
    return buildStatisticalPrediction(homeTeam, awayTeam, baseProbs, context);
  }
}

const SYSTEM_PROMPT = `你是一个世界杯足球预测AI，名叫biubiu。你是00后阿白的AI球搭子。
分析比赛时综合考虑：FIFA排名、近期状态、历史交锋、赔率走势、球队身价。
输出严格JSON格式，不要其他文字。
{
  "home_win": 数字(0-100),
  "draw": 数字(0-100),
  "away_win": 数字(0-100),
  "predicted_score": "主队进球-客队进球",
  "confidence": 数字(1-10),
  "reason": "一句带00后口吻的预测理由，30字以内",
  "key_factor": "本场最关键变量",
  "surprise_risk": "冷门风险描述"
}`;

function buildPrompt(home, away, base, ctx) {
  const homeRank = MATCH_DATA.team_rankings[home] || '?';
  const awayRank = MATCH_DATA.team_rankings[away] || '?';
  return `预测这场比赛：
主队：${home}（FIFA排名第${homeRank}）
客队：${away}（FIFA排名第${awayRank}）
基础概率模型：主胜${base.home}% 平局${base.draw}% 客胜${base.away}%
${ctx.odds ? `博彩赔率：${ctx.odds}` : ''}
${ctx.recent ? `近期战绩：${ctx.recent}` : ''}
${ctx.h2h ? `历史交锋：${ctx.h2h}` : ''}`;
}

function parseAIResponse(text, home, away, base) {
  try {
    const json = JSON.parse(text.trim().match(/\{[\s\S]*\}/)?.[0] || text);
    return {
      home_win: json.home_win || base.home,
      draw: json.draw || base.draw,
      away_win: json.away_win || base.away,
      predicted_score: json.predicted_score || `${Math.round(base.home/30)}-${Math.round(base.away/30)}`,
      confidence: json.confidence || 5,
      reason: json.reason || `biubiu觉得${home}能赢，但不保熟`,
      key_factor: json.key_factor || '双方实力差距',
      surprise_risk: json.surprise_risk || '暂无',
      source: 'deepseek'
    };
  } catch {
    return buildStatisticalPrediction(home, away, base);
  }
}

function buildStatisticalPrediction(home, away, base, ctx = {}) {
  const homeRank = MATCH_DATA.team_rankings[home] || 50;
  const awayRank = MATCH_DATA.team_rankings[away] || 50;
  const rankGap = awayRank - homeRank; // positive = home better

  // Blend ranking-based adjustment into base probs
  const rankBonus = Math.min(15, Math.max(-15, rankGap * 0.8));
  const homeWin = Math.min(95, Math.max(5, base.home + rankBonus));
  const awayWin = Math.min(95, Math.max(5, base.away - rankBonus));
  const draw = 100 - homeWin - awayWin;

  const homeGoals = Math.round(homeWin / 25);
  const awayGoals = Math.round(awayWin / 28);

  const reasons = [];
  if (rankGap > 10) reasons.push(`${home}排名碾压，稳稳的`);
  else if (rankGap > 0) reasons.push(`${home}纸面更强，但${away}有机会偷鸡`);
  else if (rankGap > -10) reasons.push(`${away}排名更高，${home}主场优势能补`);
  else reasons.push(`${away}实力明显强，biubiu不看好${home}`);

  return {
    home_win: homeWin,
    draw: draw,
    away_win: awayWin,
    predicted_score: `${homeGoals}-${awayGoals}`,
    confidence: Math.min(9, Math.max(2, Math.round(Math.abs(rankGap) / 3))),
    reason: reasons[0],
    key_factor: rankGap > 5 ? `${home}主场优势` : rankGap < -5 ? `${away}整体实力` : '临场发挥',
    surprise_risk: Math.abs(rankGap) < 5 ? '排名接近，任何结果都可能' : '强队碾压局',
    source: 'statistical'
  };
}

module.exports = { predictMatch };
