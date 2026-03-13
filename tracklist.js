/**
 * @fileoverview Tracklist recording and Supabase integration for XDJ-RR.
 * Handles session recording, auto-logging, transition detection, and export.
 */

/** @type {boolean} Whether tracklist recording is active */
let isRecording = false;

/** @type {number} Timestamp when recording started */
let recordingStart = 0;

/** @type {string} Current session name */
let currentSessionName = '';

/** @type {Array<string|null>} Last auto-logged track per deck to prevent duplicates */
let lastAutoLoggedTrack = [null, null];

/** @type {string} Last detected crossfader side for transition detection */
let lastCrossfaderSide = 'center';

/**
 * Toggles tracklist recording on/off.
 */
function toggleRecording() {
  isRecording = !isRecording;
  const btn = document.getElementById('recBtn');
  if (isRecording) {
    recordingStart = Date.now();
    currentSessionName = 'Set ' + new Date().toLocaleString('en-US', {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
    btn.classList.add('recording');
    btn.innerHTML = '<span class="rec-dot"></span> STOP';
    document.getElementById('logBtn1').disabled = false;
    document.getElementById('logBtn2').disabled = false;
    document.getElementById('tracklistEntries').innerHTML = '';
    const sel = document.getElementById('sessionSelect');
    const opt = document.createElement('option');
    opt.value = currentSessionName; opt.textContent = currentSessionName; opt.selected = true;
    sel.prepend(opt);
  } else {
    btn.classList.remove('recording');
    btn.innerHTML = '<span class="rec-dot"></span> REC';
    document.getElementById('logBtn1').disabled = true;
    document.getElementById('logBtn2').disabled = true;
    loadSessions();
  }
}

/**
 * Formats a millisecond offset as H:MM:SS.
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted time string
 */
function formatOffset(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${m<10?'0':''}${m}:${s<10?'0':''}${s}`;
}

/**
 * Manually logs the current track on a deck to the tracklist.
 * @param {number} deckIdx - Deck index (0 or 1)
 */
async function logTrack(deckIdx) {
  if (!isRecording) return;
  const deck = decks[deckIdx];
  if (!deck.trackName) return;
  const offset = formatOffset(Date.now() - recordingStart);
  const entry = { session_name: currentSessionName, track_name: deck.trackName, timestamp_offset: offset, deck: deckIdx + 1 };
  const btn = document.getElementById('logBtn' + (deckIdx + 1));
  btn.classList.add('flash');
  setTimeout(() => btn.classList.remove('flash'), 400);
  try {
    const r = await fetch('/api/tracklist', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(entry) });
    const data = await r.json();
    appendTrackEntry(Array.isArray(data) ? data[0] : data);
  } catch(e) { console.error(e); }
}

/**
 * Appends a track entry to the tracklist UI.
 * @param {object} e - Track entry data
 */
function appendTrackEntry(e) {
  const div = document.createElement('div');
  div.className = 'tl-entry' + (e.removed ? ' removed' : '') + (e._transition ? ' transition' : '') + (e._auto ? ' auto-logged' : '');
  div.id = 'tl-' + e.id;
  div.innerHTML = `<span class="tl-time">${e.timestamp_offset}</span><span class="tl-deck ${e.deck===1?'d1':'d2'}">D${e.deck}</span><span class="tl-name">${e.track_name}</span>${!e.removed ? `<button class="tl-remove" onclick="removeEntry(${e.id})">✕</button>` : ''}`;
  document.getElementById('tracklistEntries').appendChild(div);
  div.scrollIntoView({behavior:'smooth'});
}

/**
 * Soft-deletes a tracklist entry.
 * @param {number} id - Entry ID
 */
async function removeEntry(id) {
  try {
    await fetch('/api/tracklist/' + id, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({removed: true}) });
    const el = document.getElementById('tl-' + id);
    if (el) { el.classList.add('removed'); el.querySelector('.tl-remove')?.remove(); }
  } catch(e) { console.error(e); }
}

/**
 * Loads a session's tracklist from the server.
 * @param {string} name - Session name
 */
async function loadSession(name) {
  if (!name) return;
  try {
    const r = await fetch('/api/tracklist?session=' + encodeURIComponent(name));
    const data = await r.json();
    document.getElementById('tracklistEntries').innerHTML = '';
    data.forEach(e => appendTrackEntry(e));
  } catch(e) { console.error(e); }
}

/**
 * Loads the list of available sessions into the dropdown.
 */
async function loadSessions() {
  try {
    const r = await fetch('/api/tracklist/sessions');
    const sessions = await r.json();
    const sel = document.getElementById('sessionSelect');
    sel.innerHTML = '<option value="">— select session —</option>';
    sessions.forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; sel.appendChild(o); });
  } catch(e) {}
}

/**
 * Auto-logs a track when playback starts (if recording).
 * @param {number} deckIdx - Deck index
 */
function autoLogTrack(deckIdx) {
  if (!isRecording) return;
  const deck = decks[deckIdx];
  if (!deck.trackName) return;
  if (lastAutoLoggedTrack[deckIdx] === deck.trackName) return;
  lastAutoLoggedTrack[deckIdx] = deck.trackName;
  const offset = formatOffset(Date.now() - recordingStart);
  const entry = { session_name: currentSessionName, track_name: deck.trackName, timestamp_offset: offset, deck: deckIdx + 1 };
  fetch('/api/tracklist', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(entry) })
    .then(r => r.json())
    .then(data => { const e = Array.isArray(data) ? data[0] : data; e._auto = true; appendTrackEntry(e); })
    .catch(console.error);
}

/**
 * Detects crossfader transitions and logs them.
 */
function detectTransition() {
  if (!isRecording) return;
  const val = parseFloat(document.getElementById('crossfader').value);
  let side = 'center';
  if (val < 0.25) side = 'left';
  else if (val > 0.75) side = 'right';
  if (side !== lastCrossfaderSide && side !== 'center' && lastCrossfaderSide !== 'center') {
    const offset = formatOffset(Date.now() - recordingStart);
    const fromDeck = lastCrossfaderSide === 'left' ? 1 : 2;
    const toDeck = side === 'left' ? 1 : 2;
    const entry = { session_name: currentSessionName, track_name: `⟶ Transition D${fromDeck} → D${toDeck}`, timestamp_offset: offset, deck: toDeck };
    fetch('/api/tracklist', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(entry) })
      .then(r => r.json())
      .then(data => { const e = Array.isArray(data) ? data[0] : data; e._transition = true; appendTrackEntry(e); })
      .catch(console.error);
  }
  lastCrossfaderSide = side;
}

/**
 * Exports the current tracklist as a text file download.
 */
function exportTracklist() {
  const entries = document.querySelectorAll('#tracklistEntries .tl-entry:not(.removed)');
  if (!entries.length) { alert('No tracklist entries to export.'); return; }
  let text = 'Tracklist\n' + '='.repeat(40) + '\n\n';
  entries.forEach(e => {
    const time = e.querySelector('.tl-time')?.textContent || '';
    const deck = e.querySelector('.tl-deck')?.textContent || '';
    const name = e.querySelector('.tl-name')?.textContent || '';
    text += `${time}  [${deck}]  ${name}\n`;
  });
  const blob = new Blob([text], {type: 'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'tracklist.txt';
  a.click();
  URL.revokeObjectURL(a.href);
}
