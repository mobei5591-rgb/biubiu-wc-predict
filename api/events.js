/**
 * GET /api/events?matchId=N — Live match events (VIP)
 *
 * Simulated match events: goals, yellow/red cards, subs, VAR
 * Uses match ID as seed for deterministic event sequences.
 * Same match always returns same events for the same minute.
 */
const { MATCH_DATA } = require('../lib/data-fetcher');

const EVENTS_TEMPLATE = [
  // minute, type, player, team side, message
  { t: 'kickoff', msg: '比赛开始' },
  { t: 'corner', side: 'random', msg: '角球' },
  { t: 'shot', side: 'random', msg: '射门偏出' },
  { t: 'yellow', side: 'random', msg: '黄牌' },
  { t: 'foul', side: 'random', msg: '犯规' },
  { t: 'corner', side: 'random', msg: '角球' },
  { t: 'save', side: 'random', msg: '门将扑救' },
  { t: 'goal', side: 'home', msg: '进球！' },
  { t: 'shot', side: 'random', msg: '射门被挡' },
  { t: 'sub', side: 'random', msg: '换人' },
  { t: 'yellow', side: 'random', msg: '黄牌' },
  { t: 'offside', side: 'random', msg: '越位' },
  { t: 'goal', side: 'random', msg: '进球！' },
  { t: 'var', side: 'random', msg: 'VAR检查' },
  { t: 'corner', side: 'random', msg: '角球' },
  { t: 'red', side: 'random', msg: '红牌！' },
  { t: 'penalty', side: 'random', msg: '点球！' },
  { t: 'goal', side: 'random', msg: '进球！' },
  { t: 'sub', side: 'random', msg: '换人' },
  { t: 'injury', side: 'random', msg: '伤停补时' },
  { t: 'final', msg: '比赛结束' },
];

const PLAYER_NAMES = {
  home: ['前锋', '边锋', '中场', '后卫', '门将', '中锋', '边卫', '后腰'],
  away: ['前锋', '边锋', '中场', '后卫', '门将', '中锋', '边卫', '后腰'],
};

const MESSAGES = {
  goal: (side) => `${side === 'home' ? '主队' : '客队'}进球！⚽`,
  yellow: (side) => `${side === 'home' ? '主队' : '客队'}球员黄牌 🟨`,
  red: (side) => `${side === 'home' ? '主队' : '客队'}球员红牌 🟥`,
  sub: (side) => `${side === 'home' ? '主队' : '客队'}换人调整`,
  corner: () => '角球',
  shot: () => '射门！',
  save: () => '门将精彩扑救！',
  foul: () => '犯规',
  offside: () => '越位',
  var: () => 'VAR视频回放检查',
  penalty: () => '点球！',
  injury: () => '伤停补时',
  kickoff: () => '上半场开球',
  final: () => '全场比赛结束',
};

function seededRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

module.exports = async function handler(req, res) {
  const matchId = parseInt(req.query.id) || 1;
  const minute = parseInt(req.query.minute) || 0;

  // Generate events from template, seeded by match ID
  const rand = seededRandom(matchId * 9973 + 1);
  const events = [];

  for (const template of EVENTS_TEMPLATE) {
    const eventMinute = Math.max(1, template.t === 'kickoff' ? 0 :
      template.t === 'final' ? 94 : Math.min(90, Math.round(template.t * 4.5 + rand() * 10)));

    if (eventMinute > minute) continue;

    const side = template.side === 'random' ? (rand() > 0.5 ? 'home' : 'away') : (template.side || 'neutral');
    const msg = MESSAGES[template.t] ? MESSAGES[template.t](side) : template.msg;

    events.push({
      minute: eventMinute,
      type: template.t,
      side,
      message: msg,
      icon: template.t === 'goal' ? '⚽' :
            template.t === 'yellow' ? '🟨' :
            template.t === 'red' ? '🟥' :
            template.t === 'sub' ? '🔄' :
            template.t === 'var' ? '📺' :
            template.t === 'penalty' ? '🎯' :
            template.t === 'injury' ? '⏱️' :
            template.t === 'corner' ? '🏳️' :
            template.t === 'save' ? '🧤' :
            template.t === 'shot' ? '💥' :
            template.t === 'final' ? '⏹️' : '📋'
    });
  }

  res.status(200).json({
    matchId,
    currentMinute: minute,
    events: events.slice(0, 30)
  });
};
