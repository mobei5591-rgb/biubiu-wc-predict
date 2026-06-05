// biubiu 本地开发服务器 — 零依赖，Express
const express = require('express');
const path = require('path');

const app = express();

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API routes
app.get('/api/matches', (req, res) => {
  try {
    const data = require('./data/worldcup-2026.json');
    const { getAllMatches } = require('./lib/data-fetcher');
    const matches = getAllMatches();
    res.json({ matches, count: matches.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/odds', (req, res) => {
  try {
    const { getLiveOdds, tickLiveOdds } = require('./lib/odds-fetcher');
    const matchId = parseInt(req.query.id) || 1;
    const tick = req.query.tick === 'true';
    const odds = tick ? tickLiveOdds(matchId) : getLiveOdds(matchId);
    res.json(odds);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/live', (req, res) => {
  try {
    const { getLiveMatchData } = require('./lib/data-fetcher');
    const matchId = parseInt(req.query.id) || 1;
    res.json(getLiveMatchData(matchId));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/predict', (req, res) => {
  try {
    const { predictMatch } = require('./lib/ai-engine');
    const { home, away, odds, recent, h2h } = req.body || {};
    const result = predictMatch(home || 'Home', away || 'Away', { odds, recent, h2h });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/me', (req, res) => {
  res.json({ vip: false, name: null, avatar: null });
});

// Events API (VIP live)
app.get('/api/events', (req, res) => {
  try {
    const handler = require('./api/events');
    handler(req, res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Post-match report API (VIP)
app.post('/api/report', (req, res) => {
  try {
    const handler = require('./api/report');
    handler(req, res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// SPA fallback (Express 5: use .use() not .get('*'))
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('⚽ biubiu陪我看球 → http://localhost:' + PORT);
});
