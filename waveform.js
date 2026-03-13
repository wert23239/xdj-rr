/**
 * @fileoverview Waveform drawing and analysis for the XDJ-RR controller.
 * Handles overview waveforms, zoomed waveforms, playheads, and beat grids.
 */

/** @type {Array<ImageData|null>} Cached waveform image data per deck */
const wfCache = [null, null];

/** @type {number[]} Zoom level per deck (1 = full track) */
let wfZoomLevel = [1, 1];

/** @type {string[]} Available waveform color modes */
const WF_COLOR_MODES = ['frequency', 'solid', 'grayscale'];

/** @type {number[]} Current color mode index per deck */
let wfColorMode = [0, 0];

/**
 * Gets the RGB color for a waveform sample based on the current color mode.
 * @param {number} deckId - Deck index (0 or 1)
 * @param {object|null} freq - Frequency data {lo, mid, hi} or null
 * @param {number} amplitude - Sample amplitude (0-1)
 * @returns {{r: number, g: number, b: number}} RGB color values
 */
function getWfColor(deckId, freq, amplitude) {
  const mode = WF_COLOR_MODES[wfColorMode[deckId]];
  if (mode === 'frequency' && freq) {
    return { r: Math.floor(60 + freq.lo * 195), g: Math.floor(60 + freq.mid * 195), b: Math.floor(60 + freq.hi * 195) };
  } else if (mode === 'solid') {
    return deckId === 0 ? { r: 0, g: 170, b: 255 } : { r: 255, g: 136, b: 0 };
  } else {
    const v = Math.floor(120 + amplitude * 135);
    return { r: v, g: v, b: v };
  }
}

/**
 * Cycles through waveform color modes for a deck.
 * @param {number} deckId - Deck index
 */
function cycleWfColor(deckId) {
  wfColorMode[deckId] = (wfColorMode[deckId] + 1) % WF_COLOR_MODES.length;
  const mode = WF_COLOR_MODES[wfColorMode[deckId]];
  const btn = document.getElementById('wfColorBtn' + deckId);
  btn.textContent = mode === 'frequency' ? '🎨' : mode === 'solid' ? '🔵' : '⬜';
  if (decks[deckId].buffer) {
    drawOverviewWaveform(decks[deckId]);
    drawStaticWaveform(decks[deckId]);
  }
}

/**
 * Adjusts waveform zoom level for a deck.
 * @param {number} deckId - Deck index
 * @param {number} dir - Direction: 1 for zoom in, -1 for zoom out
 */
function wfZoom(deckId, dir) {
  wfZoomLevel[deckId] = Math.max(1, Math.min(16, wfZoomLevel[deckId] * (dir > 0 ? 2 : 0.5)));
}

/**
 * Draws overview waveform from server-provided peaks (no buffer needed).
 * @param {object} deck - The deck object
 * @param {number[]} peaks - Array of peak amplitudes (0-1)
 */
function drawOverviewWaveformFromPeaks(deck, peaks) {
  const canvas = document.getElementById('ovCanvas' + (deck.id + 1));
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth * 2;
  canvas.height = canvas.offsetHeight * 2;
  const mid = canvas.height / 2;
  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const color = deck.id === 0 ? { r: 0, g: 170, b: 255 } : { r: 255, g: 136, b: 0 };
  for (let i = 0; i < canvas.width; i++) {
    const peakIdx = Math.floor((i / canvas.width) * peaks.length);
    const amp = peaks[Math.min(peakIdx, peaks.length - 1)] || 0;
    const h = amp * mid;
    const alpha = 0.4 + amp * 0.6;
    ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${alpha})`;
    ctx.fillRect(i, mid - h, 1, h * 2);
  }
  deck._ovCache = ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Draws static waveform from server-provided peaks (no buffer needed).
 * @param {object} deck - The deck object
 * @param {number[]} peaks - Array of peak amplitudes (0-1)
 */
function drawStaticWaveformFromPeaks(deck, peaks) {
  const canvas = document.getElementById('wfCanvas' + (deck.id + 1));
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth * 2;
  canvas.height = canvas.offsetHeight * 2;
  const mid = canvas.height / 2;
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const color = deck.id === 0 ? { r: 0, g: 170, b: 255 } : { r: 255, g: 136, b: 0 };
  for (let i = 0; i < canvas.width; i++) {
    const peakIdx = Math.floor((i / canvas.width) * peaks.length);
    const amp = peaks[Math.min(peakIdx, peaks.length - 1)] || 0;
    const h = amp * mid;
    const alpha = 0.3 + amp * 0.7;
    ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${alpha})`;
    ctx.fillRect(i, mid - h, 1, h * 2);
  }
  wfCache[deck.id] = ctx.getImageData(0, 0, canvas.width, canvas.height);
  deck._wfDrawn = true;
}

/**
 * Draws the overview waveform for a deck (full track, small display).
 * @param {object} deck - The deck object with buffer and wfFreqData
 */
function drawOverviewWaveform(deck) {
  const canvas = document.getElementById('ovCanvas' + (deck.id + 1));
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth * 2;
  canvas.height = canvas.offsetHeight * 2;
  if (!deck.buffer) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
  const data = deck.buffer.getChannelData(0);
  const step = Math.ceil(data.length / canvas.width);
  const mid = canvas.height / 2;
  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < canvas.width; i++) {
    let min = 1, max = -1;
    for (let j = 0; j < step; j++) {
      const d = data[(i * step) + j] || 0;
      if (d < min) min = d;
      if (d > max) max = d;
    }
    const sliceIdx = Math.floor((i / canvas.width) * (deck.wfFreqData ? deck.wfFreqData.length : 1));
    const freq = deck.wfFreqData ? deck.wfFreqData[Math.min(sliceIdx, deck.wfFreqData.length - 1)] : null;
    const amplitude = Math.abs(max - min);
    const c = getWfColor(deck.id, freq, amplitude);
    const alpha = 0.4 + amplitude * 0.6;
    ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${alpha})`;
    ctx.fillRect(i, mid + min * mid, 1, Math.max(1, (max - min) * mid));
  }
  deck._ovCache = ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Draws overview playheads, dim played portion, and intro/outro markers.
 */
function drawOverviewPlayhead() {
  for (const deck of decks) {
    const canvas = document.getElementById('ovCanvas' + (deck.id + 1));
    const ctx = canvas.getContext('2d');
    if (!deck.buffer || !deck._ovCache) continue;
    ctx.putImageData(deck._ovCache, 0, 0);
    const progress = deck.getCurrentTime() / deck.buffer.duration;
    const x = progress * canvas.width;
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, 0, 2, canvas.height);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, x, canvas.height);
    // Intro/outro markers
    if (deck.introMarker > 0.1) {
      const ix = (deck.introMarker / deck.buffer.duration) * canvas.width;
      ctx.fillStyle = 'rgba(0,255,0,0.7)';
      ctx.fillRect(ix, 0, 2, canvas.height);
      ctx.beginPath(); ctx.moveTo(ix, 0); ctx.lineTo(ix+6, 0); ctx.lineTo(ix, 6); ctx.fill();
    }
    if (deck.outroMarker < deck.buffer.duration - 0.1) {
      const ox = (deck.outroMarker / deck.buffer.duration) * canvas.width;
      ctx.fillStyle = 'rgba(255,0,0,0.7)';
      ctx.fillRect(ox, 0, 2, canvas.height);
      ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox-6, 0); ctx.lineTo(ox, 6); ctx.fill();
    }
  }
}

/**
 * Draws the static (full) waveform for a deck with beat grid.
 * @param {object} deck - The deck object
 */
function drawStaticWaveform(deck) {
  const canvas = document.getElementById('wfCanvas' + (deck.id + 1));
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth * 2;
  canvas.height = canvas.offsetHeight * 2;
  if (!deck.buffer) { ctx.clearRect(0, 0, canvas.width, canvas.height); wfCache[deck.id] = null; return; }
  const data = deck.buffer.getChannelData(0);
  const step = Math.ceil(data.length / canvas.width);
  const mid = canvas.height / 2;
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < canvas.width; i++) {
    let min = 1, max = -1;
    for (let j = 0; j < step; j++) {
      const d = data[(i * step) + j] || 0;
      if (d < min) min = d;
      if (d > max) max = d;
    }
    const sliceIdx = Math.floor((i / canvas.width) * (deck.wfFreqData ? deck.wfFreqData.length : 1));
    const freq = deck.wfFreqData ? deck.wfFreqData[Math.min(sliceIdx, deck.wfFreqData.length - 1)] : null;
    const amplitude = Math.abs(max - min);
    const c = getWfColor(deck.id, freq, amplitude);
    const alpha = 0.3 + amplitude * 0.7;
    ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${alpha})`;
    ctx.fillRect(i, mid + min * mid, 1, Math.max(1, (max - min) * mid));
  }
  // Beat grid
  if (deck.bpm > 0) {
    const beatDuration = 60 / deck.bpm;
    const totalBeats = deck.buffer.duration / beatDuration;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let b = 0; b < totalBeats; b++) {
      const bx = (b * beatDuration / deck.buffer.duration) * canvas.width;
      if (b % 4 === 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx, canvas.height); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      } else {
        ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx, canvas.height); ctx.stroke();
      }
    }
  }
  wfCache[deck.id] = ctx.getImageData(0, 0, canvas.width, canvas.height);
  deck._wfDrawn = true;
}

/**
 * Draws playheads, hot cues, and loop overlays on the zoomed waveform.
 * Supports zoom levels for scrolling view.
 */
function drawPlayhead() {
  for (const deck of decks) {
    const canvas = document.getElementById('wfCanvas' + (deck.id + 1));
    const ctx = canvas.getContext('2d');
    if (!deck.buffer) continue;
    const zoom = wfZoomLevel[deck.id];
    const progress = deck.getCurrentTime() / deck.buffer.duration;

    if (zoom <= 1 && wfCache[deck.id]) {
      ctx.putImageData(wfCache[deck.id], 0, 0);
      const x = progress * canvas.width;
      ctx.fillStyle = '#fff';
      ctx.fillRect(x, 0, 2, canvas.height);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, 0, x, canvas.height);
    } else {
      // Zoomed view centered on playhead
      const data = deck.buffer.getChannelData(0);
      const visibleFraction = 1 / zoom;
      let startFrac = progress - visibleFraction / 2;
      let endFrac = progress + visibleFraction / 2;
      if (startFrac < 0) { endFrac -= startFrac; startFrac = 0; }
      if (endFrac > 1) { startFrac -= (endFrac - 1); endFrac = 1; startFrac = Math.max(0, startFrac); }
      const startSample = Math.floor(startFrac * data.length);
      const endSample = Math.floor(endFrac * data.length);
      const sampleRange = endSample - startSample;
      const step = Math.max(1, Math.ceil(sampleRange / canvas.width));
      const mid = canvas.height / 2;
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < canvas.width; i++) {
        const sampleStart = startSample + Math.floor(i * sampleRange / canvas.width);
        let min = 1, max = -1;
        for (let j = 0; j < step; j++) {
          const idx = sampleStart + j;
          if (idx >= data.length) break;
          if (data[idx] < min) min = data[idx];
          if (data[idx] > max) max = data[idx];
        }
        const sliceIdx = Math.floor((sampleStart / data.length) * (deck.wfFreqData ? deck.wfFreqData.length : 1));
        const freq = deck.wfFreqData ? deck.wfFreqData[Math.min(sliceIdx, deck.wfFreqData.length - 1)] : null;
        const amplitude = Math.abs(max - min);
        const c = getWfColor(deck.id, freq, amplitude);
        const alpha = 0.3 + amplitude * 0.7;
        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${alpha})`;
        ctx.fillRect(i, mid + min * mid, 1, Math.max(1, (max - min) * mid));
      }
      // Beat grid in zoomed view
      if (deck.bpm > 0) {
        const beatDuration = 60 / deck.bpm;
        const startTime = startFrac * deck.buffer.duration;
        const endTime = endFrac * deck.buffer.duration;
        const firstBeat = Math.ceil(startTime / beatDuration);
        const lastBeat = Math.floor(endTime / beatDuration);
        for (let bt = firstBeat; bt <= lastBeat; bt++) {
          const btTime = bt * beatDuration;
          const bx = ((btTime / deck.buffer.duration - startFrac) / visibleFraction) * canvas.width;
          ctx.strokeStyle = bt % 4 === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx, canvas.height); ctx.stroke();
        }
      }
      const playheadX = ((progress - startFrac) / visibleFraction) * canvas.width;
      ctx.fillStyle = '#fff';
      ctx.fillRect(playheadX, 0, 2, canvas.height);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, 0, playheadX, canvas.height);
    }

    // Hot cues overlay
    for (let i = 0; i < 4; i++) {
      if (deck.hotCues[i] !== null) {
        const z = wfZoomLevel[deck.id];
        let cx;
        if (z <= 1) {
          cx = (deck.hotCues[i] / deck.buffer.duration) * canvas.width;
        } else {
          const vf = 1 / z;
          let sf = progress - vf / 2;
          if (sf < 0) sf = 0;
          cx = ((deck.hotCues[i] / deck.buffer.duration - sf) / vf) * canvas.width;
        }
        if (cx >= 0 && cx <= canvas.width) {
          ctx.fillStyle = deck.id === 0 ? '#0f0' : '#ff0';
          ctx.fillRect(cx, 0, 2, canvas.height);
        }
      }
    }

    // Loop overlay
    if (deck.loopActive) {
      const z = wfZoomLevel[deck.id];
      let lx, lw;
      if (z <= 1) {
        lx = (deck.loopStart / deck.buffer.duration) * canvas.width;
        lw = ((deck.loopEnd - deck.loopStart) / deck.buffer.duration) * canvas.width;
      } else {
        const vf = 1 / z;
        let sf = progress - vf / 2;
        if (sf < 0) sf = 0;
        lx = ((deck.loopStart / deck.buffer.duration - sf) / vf) * canvas.width;
        const leX = ((deck.loopEnd / deck.buffer.duration - sf) / vf) * canvas.width;
        lw = leX - lx;
      }
      ctx.fillStyle = 'rgba(0,255,0,0.1)';
      ctx.fillRect(lx, 0, lw, canvas.height);
      ctx.strokeStyle = '#0f0'; ctx.lineWidth = 2;
      ctx.strokeRect(lx, 0, lw, canvas.height);
    }
  }
}
