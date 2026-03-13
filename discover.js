/**
 * @fileoverview Song Discovery & Download module for XDJ-RR.
 * Provides YouTube + SoundCloud search and direct download to DJ library.
 */

// ==================== DISCOVER PANEL ====================
let discoverOpen = false;

function toggleDiscover() {
  discoverOpen = !discoverOpen;
  const panel = document.getElementById('discoverPanel');
  panel.style.display = discoverOpen ? 'flex' : 'none';
  document.getElementById('discoverBtn').classList.toggle('active', discoverOpen);
  if (discoverOpen) {
    document.getElementById('discoverSearch').focus();
    refreshDownloads();
  }
}

async function searchSongs() {
  const q = document.getElementById('discoverSearch').value.trim();
  if (!q) return;
  const resultsEl = document.getElementById('discoverResults');
  resultsEl.innerHTML = '<div class="discover-loading">🔍 Searching YouTube & SoundCloud...</div>';

  try {
    const resp = await fetch('/api/search?q=' + encodeURIComponent(q));
    const results = await resp.json();
    if (!results.length) {
      resultsEl.innerHTML = '<div class="discover-empty">No results found</div>';
      return;
    }
    resultsEl.innerHTML = results.map((r, i) => {
      const dur = r.duration ? formatDiscoverDuration(r.duration) : '';
      const src = r.source === 'youtube' ? '🔴 YT' : '🟠 SC';
      return `<div class="discover-result">
        <div class="discover-result-info">
          <span class="discover-source">${src}</span>
          <span class="discover-title" title="${escHtml(r.title)}">${escHtml(r.title)}</span>
          ${r.uploader ? `<span class="discover-uploader">${escHtml(r.uploader)}</span>` : ''}
          ${dur ? `<span class="discover-dur">${dur}</span>` : ''}
        </div>
        <button class="discover-dl-btn" onclick="downloadSong(${i})" data-idx="${i}">⬇️ Download</button>
      </div>`;
    }).join('');
    // Store results for download reference
    window._discoverResults = results;
  } catch (e) {
    resultsEl.innerHTML = '<div class="discover-empty">Search failed: ' + e.message + '</div>';
  }
}

async function downloadSong(idx) {
  const r = window._discoverResults?.[idx];
  if (!r) return;
  const btn = document.querySelector(`.discover-dl-btn[data-idx="${idx}"]`);
  if (btn) { btn.textContent = '⏳ Queued'; btn.disabled = true; }

  try {
    await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: r.url, title: r.title })
    });
    refreshDownloads();
  } catch (e) {
    if (btn) { btn.textContent = '❌ Failed'; }
  }
}

async function refreshDownloads() {
  try {
    const resp = await fetch('/api/downloads');
    const downloads = await resp.json();
    const el = document.getElementById('downloadQueue');
    if (!downloads.length) {
      el.innerHTML = '<div class="discover-empty">No downloads yet</div>';
      return;
    }
    el.innerHTML = downloads.map(d => {
      const icon = d.status === 'complete' ? '✅' : d.status === 'failed' ? '❌' : '⏳';
      const progress = d.status === 'downloading' ? (d.progress || 'starting...') : d.status;
      return `<div class="download-entry ${d.status}">
        <span class="dl-icon">${icon}</span>
        <span class="dl-title">${escHtml(d.title)}</span>
        <span class="dl-progress">${progress}</span>
      </div>`;
    }).join('');

    // If any are still downloading, poll again
    if (downloads.some(d => d.status === 'downloading')) {
      setTimeout(refreshDownloads, 2000);
    }

    // If a download just completed, refresh the track list
    if (downloads.some(d => d.status === 'complete')) {
      loadTracks();
    }
  } catch {}
}

function formatDiscoverDuration(s) {
  if (!s || !isFinite(s)) return '';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

function escHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Poll downloads periodically when panel is open
setInterval(() => { if (discoverOpen) refreshDownloads(); }, 5000);
