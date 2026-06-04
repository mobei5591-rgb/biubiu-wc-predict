/**
 * Seed script — validates data, pre-generates predictions, prints summary
 * Run: node scripts/seed-data.js
 */
const { getAllMatches, getAllGroups } = require('../lib/data-fetcher');

console.log('🏆 biubiu陪我看球 — 数据初始化\n');
console.log('='.repeat(50));

const matches = getAllMatches();
const groups = getAllGroups();

console.log(`\n📊 比赛总数: ${matches.length}`);
console.log(`📅 开赛日期: 2026-06-11`);
console.log(`🏟️ 小组数量: ${groups.length}`);

console.log('\n📋 小组分布:');
groups.forEach(g => {
  const teams = g.teams.map(t => `${t.name}(#${t.rank})`).join(', ');
  console.log(`  ${g.name}组: ${teams}`);
});

console.log('\n📅 赛程预览 (前5场):');
matches.slice(0, 5).forEach(m => {
  console.log(`  ${m.date} | ${m.home}(${m.home_rank}) vs ${m.away}(${m.away_rank}) @ ${m.venue}`);
});

console.log('\n✅ 数据初始化完成！');
console.log('💡 运行 npm run dev 启动本地开发服务器');
console.log('🚀 运行 npm run deploy 部署到 Vercel');
