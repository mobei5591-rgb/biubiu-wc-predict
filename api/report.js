/**
 * POST /api/report — AI post-match review (VIP)
 * Body: { home, away, homeScore, awayScore, prediction, events }
 *
 * Sends match data to DeepSeek → returns structured review.
 * Falls back to statistical template if no API key.
 */
const { predictMatch } = require('../lib/ai-engine');
const { verifyToken } = require('../lib/auth');

module.exports = async function handler(req, res) {
  // VIP check
  const auth = verifyToken(req);
  if (!auth || !auth.vip) {
    return res.status(200).json({
      vip: false,
      summary: '升级VIP查看AI赛后复盘报告',
      full: null
    });
  }

  const { home, away, homeScore, awayScore, prediction, events = [] } = req.body || {};

  if (!home || !away || homeScore == null || awayScore == null) {
    return res.status(400).json({ error: 'Missing match data' });
  }

  // Build report
  const report = await generateReport({ home, away, homeScore, awayScore, prediction, events });

  res.status(200).json({
    vip: true,
    ...report
  });
};

async function generateReport(ctx) {
  const { home, away, homeScore, awayScore, prediction, events } = ctx;

  // Try DeepSeek first
  try {
    const client = getDeepSeekClient();
    if (client) {
      return await generateWithAI(client, ctx);
    }
  } catch (e) {
    // Fall through to template
  }

  // Statistical template fallback
  return generateTemplate(ctx);
}

function getDeepSeekClient() {
  try {
    const { OpenAI } = require('openai');
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) return null;
    return new OpenAI({ apiKey: key, baseURL: process.env.DEEPSEEK_BASE || 'https://api.deepseek.com' });
  } catch { return null; }
}

async function generateWithAI(client, ctx) {
  const { home, away, homeScore, awayScore, prediction } = ctx;
  const winner = homeScore > awayScore ? home : awayScore < awayScore ? away : '平局';
  const predHome = prediction?.ai?.home_win || prediction?.home || 33;
  const predAway = prediction?.ai?.away_win || prediction?.away || 33;
  const correct = (homeScore > awayScore && predHome > predAway) ||
                  (homeScore < awayScore && predAway > predHome) ||
                  (homeScore === awayScore && Math.abs(predHome - predAway) < 10);

  const prompt = `你是biubiu，一个AI足球预测助手。请对以下比赛进行赛后复盘分析（中文，300字左右）：

比赛：${home} vs ${away}
最终比分：${homeScore}:${awayScore}
赛前AI预测：${home}胜${predHome}% / 平局${prediction?.draw || 34}% / ${away}胜${predAway}%
预测结果：${correct ? '✅ 预测正确' : '❌ 预测翻车'}

请用Markdown格式输出：
## 📊 比赛回顾
(2-3句话总结比赛过程)

## 🎯 biubiu预测复盘
(对比预测和实际，分析为什么预测对了/错了)

## ⭐ 关键因素
(决定比赛走向的关键点)

## 📈 小组形势
(这场比赛对出线形势的影响)

## 🤖 biubiu的教训
(biubiu从这场比赛学到了什么)

风格：00后，用网络热梗，幽默自嘲，像朋友聊天。`;

  const res = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: '你是biubiu，一个00后AI球搭子，不懂球但爱瞎猜。输出纯Markdown，不输出代码块包裹。' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 800,
    temperature: 0.8
  });

  return {
    summary: `${homeScore}:${awayScore} ${correct ? '✅ biubiu猜对了' : '😱 biubiu翻车了'}`,
    full: res.choices[0].message.content,
    source: 'deepseek',
    correct
  };
}

function generateTemplate(ctx) {
  const { home, away, homeScore, awayScore, prediction } = ctx;
  const totalGoals = homeScore + awayScore;
  const winner = homeScore > awayScore ? home : awayScore < awayScore ? away : null;
  const diff = Math.abs(homeScore - awayScore);

  const predHome = prediction?.ai?.home_win || prediction?.home || 33;
  const predAway = prediction?.ai?.away_win || prediction?.away || 33;
  const correct = (homeScore > awayScore && predHome > predAway) ||
                  (homeScore < awayScore && predAway > predHome) ||
                  (homeScore === awayScore && Math.abs(predHome - predAway) < 10);

  const scorePredicted = prediction?.ai?.predicted_score || '?';
  const confidence = prediction?.ai?.confidence || 3;

  const resultEmoji = correct ? '✅' : '😱';
  const resultText = correct
    ? `biubiu赛前预测${home}胜率更高，结果${home}果然赢了！`
    : `biubiu赛前还以为${predHome > predAway ? home : away}会赢，结果完全打脸...`;

  const analysis = totalGoals > 3 ? '一场进球大战'
    : totalGoals === 0 ? '双方互交白卷'
    : diff >= 3 ? '一方碾压式胜利'
    : '比赛打得十分胶着';

  const turningPoint = diff >= 2
    ? `${winner}抓住关键机会拉开比分差距`
    : winner
      ? `${winner}在关键时刻的进球改变了比赛走向`
      : '双方势均力敌，谁也奈何不了谁';

  const report = `## 📊 比赛回顾

${home} ${homeScore}:${awayScore} ${away} — ${analysis}！

${homeScore}比${awayScore}的比分${diff >= 2 ? '超出很多人预期' : '和赛前预测比较接近'}。赛前biubiu预测比分是 ${scorePredicted}，信心指数 ${'⭐'.repeat(confidence)}。

## 🎯 biubiu预测复盘

${resultEmoji} ${resultText}

赛前AI预测胜率：${home}胜 ${predHome}% / 平局 ${prediction?.draw || 34}% / ${away}胜 ${predAway}%。${correct ? '这次biubiu蒙对了！' : 'biubiu被打脸了，但没关系，下次再来！'}

## ⭐ 关键因素

- ${turningPoint}
- 总进球${totalGoals}个，${totalGoals > 2.5 ? '大于2.5球盘口' : '小于2.5球盘口'}
- ${winner ? winner + '取得宝贵3分' : '双方各取1分'}

## 📈 小组形势

这场比赛对小组出线形势${diff >= 2 ? '影响较大' : '影响有限'}，${winner || '两队'}需要继续在后续比赛中拿分。

## 🤖 biubiu的教训

${correct ? '这次蒙对了不代表下次也对，biubiu还要继续学习！' : '翻车了！果然不懂球的人配AI也会翻车。不过下次biubiu会变得更聪明！'}

阿白说：biubiu，你${correct ? '这次还行' : '又翻车了'}。`;

  return {
    summary: `${homeScore}:${awayScore} ${resultEmoji} ${correct ? 'biubiu猜对了' : 'biubiu翻车了'}`,
    full: report,
    source: 'statistical',
    correct
  };
}
