const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
const PORT = 3000;
const MUSIC_DIR = '/Users/clawman/Music/DJ';

const SUPABASE_URL = 'https://aihworyfcgstwbpzkzoy.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpaHdvcnlmY2dzdHdicHprem95Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTEyMTQ3MSwiZXhwIjoyMDg2Njk3NDcxfQ.jy9tS4IaDXbu__Kw_vELMXBYGBFY5fjtHRTAxqwsEqg';
const sbHeaders = { 'Content-Type': 'application/json', 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Prefer': 'return=representation' };

// POST /api/tracklist — save a track entry
app.post('/api/tracklist', async (req, res) => {
  try {
    const { session_name, track_name, timestamp_offset, deck } = req.body;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/dj_tracklist`, { method: 'POST', headers: sbHeaders, body: JSON.stringify({ session_name, track_name, timestamp_offset, deck }) });
    const data = await r.json();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/tracklist/sessions — list all sessions
app.get('/api/tracklist/sessions', async (req, res) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/dj_tracklist?select=session_name&order=logged_at.desc`, { headers: sbHeaders });
    const data = await r.json();
    const unique = [...new Set(data.map(d => d.session_name))];
    res.json(unique);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/tracklist?session=xxx — get tracks for a session
app.get('/api/tracklist', async (req, res) => {
  try {
    const session = req.query.session;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/dj_tracklist?session_name=eq.${encodeURIComponent(session)}&order=logged_at.asc`, { headers: sbHeaders });
    const data = await r.json();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/tracklist/:id — update (for soft delete)
app.patch('/api/tracklist/:id', async (req, res) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/dj_tracklist?id=eq.${req.params.id}`, { method: 'PATCH', headers: sbHeaders, body: JSON.stringify(req.body) });
    const data = await r.json();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/api/tracks', (req, res) => {
  try {
    const exts = new Set(['.mp3', '.wav', '.aac', '.m4a', '.ogg', '.flac', '.aif', '.aiff']);
    const files = fs.readdirSync(MUSIC_DIR)
      .filter(f => exts.has(path.extname(f).toLowerCase()))
      .map(f => {
        try {
          const stat = fs.statSync(path.join(MUSIC_DIR, f));
          return { name: f, mtime: stat.mtimeMs, size: stat.size };
        } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 50);
    res.json(files);
  } catch (e) {
    res.json([]);
  }
});

app.get('/tracks/:filename', (req, res) => {
  const filePath = path.join(MUSIC_DIR, req.params.filename);
  if (!filePath.startsWith(MUSIC_DIR)) return res.status(403).end();
  if (!fs.existsSync(filePath)) return res.status(404).end();
  const stat = fs.statSync(filePath);
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': 'audio/mpeg',
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': 'audio/mpeg',
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// ==================== PLAYLIST ENDPOINTS ====================
// GET /api/playlists — list all playlists
app.get('/api/playlists', async (req, res) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/dj_playlists?order=updated_at.desc`, { headers: sbHeaders });
    const data = await r.json();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/playlists — create a playlist
app.post('/api/playlists', async (req, res) => {
  try {
    const { name, tracks } = req.body;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/dj_playlists`, { method: 'POST', headers: sbHeaders, body: JSON.stringify({ name, tracks: tracks || [] }) });
    const data = await r.json();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/playlists/:id — update a playlist
app.patch('/api/playlists/:id', async (req, res) => {
  try {
    const body = { ...req.body, updated_at: new Date().toISOString() };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/dj_playlists?id=eq.${req.params.id}`, { method: 'PATCH', headers: sbHeaders, body: JSON.stringify(body) });
    const data = await r.json();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/playlists/:id — delete a playlist
app.delete('/api/playlists/:id', async (req, res) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/dj_playlists?id=eq.${req.params.id}`, { method: 'DELETE', headers: sbHeaders });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => console.log(`XDJ-RR server running on http://localhost:${PORT}`));
