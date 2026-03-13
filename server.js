const express = require('express');
const compression = require('compression');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(compression());
app.use(express.json());

// ==================== CORS HEADERS ====================
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ==================== RATE LIMITING ====================
const rateLimitMap = new Map();
function rateLimit(windowMs, maxRequests) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const key = ip + ':' + req.route.path;
    const now = Date.now();
    let entry = rateLimitMap.get(key);
    if (!entry || now - entry.start > windowMs) {
      entry = { start: now, count: 0 };
      rateLimitMap.set(key, entry);
    }
    entry.count++;
    if (entry.count > maxRequests) {
      return res.status(429).json({ error: 'Too many requests. Try again later.' });
    }
    next();
  };
}
// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now - entry.start > 300000) rateLimitMap.delete(key);
  }
}, 300000);

const PORT = 3000;
const MUSIC_DIR = '/Users/clawman/Music/DJ';
const CACHE_DIR = path.join(__dirname, 'cache');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// Supabase config — service role key is server-side only, never exposed to client
const SUPABASE_URL = 'https://aihworyfcgstwbpzkzoy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpaHdvcnlmY2dzdHdicHprem95Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTEyMTQ3MSwiZXhwIjoyMDg2Njk3NDcxfQ.jy9tS4IaDXbu__Kw_vELMXBYGBFY5fjtHRTAxqwsEqg';
const sbHeaders = { 'Content-Type': 'application/json', 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Prefer': 'return=representation' };

const startTime = Date.now();

// ==================== WAVEFORM PRE-COMPUTATION ====================
const waveformPrecompute = { total: 0, done: 0, running: false, errors: 0 };

function precomputeAllWaveforms() {
  const exts = new Set(['.mp3', '.wav', '.aac', '.m4a', '.ogg', '.flac', '.aif', '.aiff']);
  let files;
  try {
    files = fs.readdirSync(MUSIC_DIR).filter(f => exts.has(path.extname(f).toLowerCase()));
  } catch { return; }
  
  waveformPrecompute.total = files.length;
  waveformPrecompute.done = 0;
  waveformPrecompute.running = true;
  waveformPrecompute.errors = 0;
  
  console.log(`[Precompute] Starting waveform pre-computation for ${files.length} tracks...`);
  
  let idx = 0;
  function processNext() {
    if (idx >= files.length) {
      waveformPrecompute.running = false;
      console.log(`[Precompute] Complete! ${waveformPrecompute.done}/${waveformPrecompute.total} tracks (${waveformPrecompute.errors} errors)`);
      return;
    }
    const filename = files[idx++];
    const cached = readCache(filename);
    if (cached && cached.peaks && cached.peaks.length > 0) {
      waveformPrecompute.done++;
      setImmediate(processNext);
      return;
    }
    try {
      const filePath = path.join(MUSIC_DIR, filename);
      const peaks = extractPeaks(filePath);
      const stat = fs.statSync(filePath);
      const existing = cached || {};
      const info = { ...existing, filename, size: stat.size, peaks: peaks || [], cachedAt: Date.now() };
      writeCache(filename, info);
      waveformPrecompute.done++;
    } catch(e) {
      waveformPrecompute.errors++;
      waveformPrecompute.done++;
    }
    // Use setImmediate to not block the event loop
    setImmediate(processNext);
  }
  processNext();
}

// Start pre-computation after server starts (with small delay)
setTimeout(precomputeAllWaveforms, 2000);

// ==================== CACHE HELPERS ====================
function fileHash(filename) {
  return crypto.createHash('md5').update(filename).digest('hex');
}

function getCachePath(filename) {
  return path.join(CACHE_DIR, fileHash(filename) + '.json');
}

function readCache(filename) {
  const cp = getCachePath(filename);
  if (!fs.existsSync(cp)) return null;
  try { return JSON.parse(fs.readFileSync(cp, 'utf8')); } catch { return null; }
}

function writeCache(filename, data) {
  try { fs.writeFileSync(getCachePath(filename), JSON.stringify(data)); } catch(e) { console.error('Cache write error:', e.message); }
}

// ==================== WAVEFORM PEAK EXTRACTION ====================
function extractPeaks(filePath, numPeaks = 800) {
  try {
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    let samples;

    if (ext === '.wav') {
      // Parse WAV header to find data
      const dataOffset = buf.indexOf(Buffer.from('data'));
      if (dataOffset === -1) return null;
      const dataSize = buf.readUInt32LE(dataOffset + 4);
      const bitsPerSample = buf.readUInt16LE(34);
      const numChannels = buf.readUInt16LE(22);
      const audioStart = dataOffset + 8;
      const bytesPerSample = bitsPerSample / 8;
      const totalSamples = Math.floor(dataSize / (bytesPerSample * numChannels));
      samples = new Float32Array(totalSamples);
      
      for (let i = 0; i < totalSamples && (audioStart + i * bytesPerSample * numChannels) < buf.length; i++) {
        const offset = audioStart + i * bytesPerSample * numChannels;
        if (bitsPerSample === 16) {
          samples[i] = buf.readInt16LE(offset) / 32768;
        } else if (bitsPerSample === 24) {
          const val = (buf[offset] | (buf[offset+1] << 8) | (buf[offset+2] << 16));
          samples[i] = (val > 0x7FFFFF ? val - 0x1000000 : val) / 8388608;
        } else if (bitsPerSample === 32) {
          samples[i] = buf.readFloatLE(offset);
        } else {
          samples[i] = buf.readInt16LE(offset) / 32768;
        }
      }
    } else {
      // For non-WAV files, do raw byte amplitude analysis as fallback
      // This gives a rough waveform shape
      const chunkSize = Math.max(1, Math.floor(buf.length / numPeaks));
      const peaks = [];
      for (let i = 0; i < numPeaks && i * chunkSize < buf.length; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, buf.length);
        let max = 0;
        for (let j = start; j < end; j++) {
          const val = Math.abs((buf[j] - 128) / 128);
          if (val > max) max = val;
        }
        peaks.push(Math.round(max * 1000) / 1000);
      }
      return peaks;
    }

    if (!samples || samples.length === 0) return null;

    // Downsample to peaks
    const samplesPerPeak = Math.floor(samples.length / numPeaks);
    const peaks = [];
    for (let i = 0; i < numPeaks; i++) {
      const start = i * samplesPerPeak;
      let max = 0;
      for (let j = start; j < start + samplesPerPeak && j < samples.length; j++) {
        const abs = Math.abs(samples[j]);
        if (abs > max) max = abs;
      }
      peaks.push(Math.round(max * 1000) / 1000);
    }
    return peaks;
  } catch(e) {
    console.error('Peak extraction error:', e.message);
    return null;
  }
}

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
  let trackCount = 0;
  try {
    const exts = new Set(['.mp3', '.wav', '.aac', '.m4a', '.ogg', '.flac', '.aif', '.aiff']);
    trackCount = fs.readdirSync(MUSIC_DIR).filter(f => exts.has(path.extname(f).toLowerCase())).length;
  } catch {}
  res.json({
    status: 'ok',
    version: 'v27',
    tracks: trackCount,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    cacheDir: CACHE_DIR,
    waveformPrecompute: {
      total: waveformPrecompute.total,
      done: waveformPrecompute.done,
      running: waveformPrecompute.running,
      errors: waveformPrecompute.errors,
      progress: waveformPrecompute.total > 0 ? Math.round((waveformPrecompute.done / waveformPrecompute.total) * 100) : 0
    }
  });
});

// ==================== TRACK INFO API ====================
app.get('/api/tracks/:filename/info', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(MUSIC_DIR, filename);
  if (!filePath.startsWith(MUSIC_DIR)) return res.status(403).json({ error: 'forbidden' });
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'not found' });

  // Check cache first
  const cached = readCache(filename);
  if (cached) return res.json(cached);

  // Generate info
  const stat = fs.statSync(filePath);
  const peaks = extractPeaks(filePath);
  
  const info = {
    filename,
    size: stat.size,
    peaks: peaks || [],
    // BPM and key will be filled by frontend after analysis and cached back
    bpm: null,
    key: null,
    duration: null,
    cachedAt: Date.now()
  };

  writeCache(filename, info);
  res.json(info);
});

// ==================== CACHE UPDATE (frontend sends analyzed data) ====================
app.post('/api/tracks/:filename/info', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(MUSIC_DIR, filename);
  if (!filePath.startsWith(MUSIC_DIR)) return res.status(403).json({ error: 'forbidden' });

  const existing = readCache(filename) || {};
  const updated = { ...existing, ...req.body, filename, cachedAt: Date.now() };
  writeCache(filename, updated);
  res.json(updated);
});

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

// Serve static files (CSS, JS)
app.use(express.static(__dirname));

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
  
  // Determine content type
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.aac': 'audio/aac',
    '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.flac': 'audio/flac',
    '.aif': 'audio/aiff', '.aiff': 'audio/aiff'
  };
  const contentType = mimeTypes[ext] || 'audio/mpeg';
  
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': contentType,
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// ==================== PLAYLIST ENDPOINTS ====================
app.get('/api/playlists', async (req, res) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/dj_playlists?order=updated_at.desc`, { headers: sbHeaders });
    const data = await r.json();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/playlists', async (req, res) => {
  try {
    const { name, tracks } = req.body;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/dj_playlists`, { method: 'POST', headers: sbHeaders, body: JSON.stringify({ name, tracks: tracks || [] }) });
    const data = await r.json();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/playlists/:id', async (req, res) => {
  try {
    const body = { ...req.body, updated_at: new Date().toISOString() };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/dj_playlists?id=eq.${req.params.id}`, { method: 'PATCH', headers: sbHeaders, body: JSON.stringify(body) });
    const data = await r.json();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/playlists/:id', async (req, res) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/dj_playlists?id=eq.${req.params.id}`, { method: 'DELETE', headers: sbHeaders });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== SONG DISCOVERY ====================
const { execFile, spawn } = require('child_process');

// In-memory download queue
const downloadQueue = [];

// POST /api/search — search YouTube + SoundCloud via yt-dlp
app.get('/api/search', rateLimit(60000, 15), async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);

  const runSearch = (prefix) => new Promise((resolve) => {
    const proc = spawn('yt-dlp', [`${prefix}${q}`, '--dump-json', '--flat-playlist', '--no-download'], {
      timeout: 15000, env: { ...process.env }
    });
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => stdout += d);
    proc.stderr.on('data', d => stderr += d);
    proc.on('close', () => {
      const results = [];
      for (const line of stdout.split('\n')) {
        if (!line.trim()) continue;
        try {
          const j = JSON.parse(line);
          results.push({
            title: j.title || j.fulltitle || 'Unknown',
            duration: j.duration || 0,
            url: j.url || j.webpage_url || j.original_url || '',
            thumbnail: j.thumbnail || j.thumbnails?.[0]?.url || '',
            source: prefix.startsWith('yt') ? 'youtube' : 'soundcloud',
            uploader: j.uploader || j.channel || ''
          });
        } catch {}
      }
      resolve(results);
    });
    proc.on('error', () => resolve([]));
  });

  try {
    const [yt, sc] = await Promise.all([
      runSearch('ytsearch5:'),
      runSearch('scsearch5:')
    ]);
    res.json([...yt, ...sc]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/download — download a track to the DJ library
app.post('/api/download', rateLimit(60000, 10), async (req, res) => {
  const { url, title } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const entry = { id, title: title || 'Unknown', url, status: 'downloading', progress: '', error: null, startedAt: Date.now() };
  downloadQueue.push(entry);

  // Also insert into Supabase dj table as backup
  try {
    // Parse artist/song from title
    const parts = (title || '').split(' - ');
    const artist = parts.length > 1 ? parts[0].trim() : '';
    const song = parts.length > 1 ? parts.slice(1).join(' - ').trim() : (title || '');
    await fetch(`${SUPABASE_URL}/rest/v1/dj`, {
      method: 'POST', headers: sbHeaders,
      body: JSON.stringify({ song, artist, status: 'queued', source: url })
    });
  } catch (e) { console.error('Supabase insert error:', e.message); }

  res.json({ id, status: 'downloading' });

  // Start download in background
  const proc = spawn('yt-dlp', [
    '-x', '--audio-format', 'wav',
    '-o', path.join(MUSIC_DIR, '%(title)s.%(ext)s'),
    '--no-playlist',
    '--newline',
    url
  ]);

  proc.stdout.on('data', d => {
    const line = d.toString().trim();
    const m = line.match(/(\d+\.?\d*)%/);
    if (m) entry.progress = m[1] + '%';
  });
  proc.stderr.on('data', d => {
    const line = d.toString().trim();
    const m = line.match(/(\d+\.?\d*)%/);
    if (m) entry.progress = m[1] + '%';
  });
  proc.on('close', code => {
    if (code === 0) {
      entry.status = 'complete';
      entry.progress = '100%';
    } else {
      entry.status = 'failed';
      entry.error = 'yt-dlp exited with code ' + code;
    }
  });
  proc.on('error', err => {
    entry.status = 'failed';
    entry.error = err.message;
  });
});

// GET /api/downloads — get download queue status
app.get('/api/downloads', (req, res) => {
  res.json(downloadQueue.slice(-20).reverse());
});

app.listen(PORT, () => console.log(`XDJ-RR server running on http://localhost:${PORT}`));
