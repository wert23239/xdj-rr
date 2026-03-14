/**
 * @fileoverview Waveform drawing and analysis for the XDJ-RR controller.
 * Clean, Rekordbox-style gradient waveforms with beat alignment markers.
 */

/** @type {Array<ImageData|null>} Cached waveform image data per deck */
const wfCache = [null, null];

/** @type {number[]} Zoom level per deck (1 = full track) */
let wfZoomLevel = [1, 1];

/** @type {string[]} Available waveform color modes */
const WF_COLOR_MODES = ['frequency', 'solid', 'grayscale'];

/** @type {number[]} Current color mode index per deck */
let wfColorMode = [0, 0];

// Deck color schemes
const DECK_COLORS = [
  { bright: '#00aaff', dark: '#003366', r: 0, g: 170, b: 255 },   // Deck 1: Blue
  { bright: '#ff8800', dark: '#4d2900', r: 255, g: 136, b: 0 }    // Deck 2: Orange
];

function getWfColor(deckId, freq, amplitude) {
  const mode = WF_COLOR_MODES[wfColorMode[deckId]];
  if (mode === 'frequency' && freq) {
    return { r: Math.floor(60 + freq.lo * 195), g: Math.floor(60 + freq.mid * 195), b: Math.floor(60 + freq.hi * 195) };
  } else if (mode === 'solid') {
    return { r: DECK_COLORS[deckId].r, g: DECK_COLORS[deckId].g, b: DECK_COLORS[deckId].b };
  } else {
    const v = Math.floor(120 + amplitude * 135);
    return { r: v, g: v, b: v };
  }
}

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

function wfZoom(deckId, dir) {
  wfZoomLevel[deckId] = Math.max(1, Math.min(16, wfZoomLevel[deckId] * (dir > 0 ? 2 : 0.5)));
}

/**
 * Smooth audio data by averaging neighboring samples into bins.
 * Returns array of {min, max} for each pixel column.
 */
function computeSmoothedBins(data, startSample, endSample, numBins) {
  const sampleRange = endSample - startSample;
  const samplesPerBin = sampleRange / numBins;
  const bins = new Array(numBins);
  // Smoothing window: average across multiple sub-windows
  for (let i = 0; i < numBins; i++) {
    const binStart = startSample + Math.floor(i * samplesPerBin);
    const binEnd = Math.min(startSample + Math.floor((i + 1) * samplesPerBin), endSample);
    let rmsSum = 0, count = 0, peak = 0;
    for (let j = binStart; j < binEnd; j++) {
      const v = data[j] || 0;
      rmsSum += v * v;
      count++;
      const absV = Math.abs(v);
      if (absV > peak) peak = absV;
    }
    const rms = count > 0 ? Math.sqrt(rmsSum / count) : 0;
    // Blend RMS with peak for smooth but punchy look
    const amp = rms * 0.6 + peak * 0.4;
    bins[i] = { amp: Math.min(amp, 1), peak };
  }
  // Apply 3-point moving average for extra smoothness
  const smoothed = new Array(numBins);
  for (let i = 0; i < numBins; i++) {
    const prev = i > 0 ? bins[i - 1].amp : bins[i].amp;
    const next = i < numBins - 1 ? bins[i + 1].amp : bins[i].amp;
    smoothed[i] = {
      amp: (prev + bins[i].amp * 2 + next) / 4,
      peak: bins[i].peak
    };
  }
  return smoothed;
}

/**
 * Creates a vertical gradient for waveform fill.
 */
function createWaveformGradient(ctx, mid, height, deckId, alpha) {
  const dc = DECK_COLORS[deckId];
  const grad = ctx.createLinearGradient(0, mid - height, 0, mid);
  grad.addColorStop(0, `rgba(${dc.r},${dc.g},${dc.b},${alpha})`);
  grad.addColorStop(0.4, `rgba(${dc.r},${dc.g},${dc.b},${alpha * 0.7})`);
  grad.addColorStop(1, `rgba(${Math.floor(dc.r * 0.3)},${Math.floor(dc.g * 0.3)},${Math.floor(dc.b * 0.3)},${alpha * 0.4})`);
  return grad;
}

/**
 * Draws a smooth, gradient-filled waveform on a canvas region.
 */
function drawSmoothWaveform(ctx, bins, mid, maxHeight, deckId, canvasWidth) {
  const dc = DECK_COLORS[deckId];
  
  // Draw filled waveform with gradient
  // Upper half
  ctx.beginPath();
  ctx.moveTo(0, mid);
  for (let i = 0; i < bins.length; i++) {
    const x = (i / bins.length) * canvasWidth;
    const h = bins[i].amp * maxHeight;
    ctx.lineTo(x, mid - h);
  }
  ctx.lineTo(canvasWidth, mid);
  ctx.closePath();
  
  const gradUp = ctx.createLinearGradient(0, mid - maxHeight, 0, mid);
  gradUp.addColorStop(0, `rgba(${dc.r},${dc.g},${dc.b},0.95)`);
  gradUp.addColorStop(0.5, `rgba(${dc.r},${dc.g},${dc.b},0.6)`);
  gradUp.addColorStop(1, `rgba(${Math.floor(dc.r*0.2)},${Math.floor(dc.g*0.2)},${Math.floor(dc.b*0.2)},0.15)`);
  ctx.fillStyle = gradUp;
  ctx.fill();
  
  // Lower half (mirror)
  ctx.beginPath();
  ctx.moveTo(0, mid);
  for (let i = 0; i < bins.length; i++) {
    const x = (i / bins.length) * canvasWidth;
    const h = bins[i].amp * maxHeight;
    ctx.lineTo(x, mid + h);
  }
  ctx.lineTo(canvasWidth, mid);
  ctx.closePath();
  
  const gradDown = ctx.createLinearGradient(0, mid, 0, mid + maxHeight);
  gradDown.addColorStop(0, `rgba(${Math.floor(dc.r*0.2)},${Math.floor(dc.g*0.2)},${Math.floor(dc.b*0.2)},0.15)`);
  gradDown.addColorStop(0.5, `rgba(${dc.r},${dc.g},${dc.b},0.6)`);
  gradDown.addColorStop(1, `rgba(${dc.r},${dc.g},${dc.b},0.95)`);
  ctx.fillStyle = gradDown;
  ctx.fill();
  
  // Subtle glow on peaks - draw bright edge line
  ctx.beginPath();
  ctx.moveTo(0, mid);
  for (let i = 0; i < bins.length; i++) {
    const x = (i / bins.length) * canvasWidth;
    const h = bins[i].amp * maxHeight;
    ctx.lineTo(x, mid - h);
  }
  ctx.strokeStyle = `rgba(${Math.min(255, dc.r + 80)},${Math.min(255, dc.g + 80)},${Math.min(255, dc.b + 80)},0.4)`;
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Lower edge glow
  ctx.beginPath();
  ctx.moveTo(0, mid);
  for (let i = 0; i < bins.length; i++) {
    const x = (i / bins.length) * canvasWidth;
    const h = bins[i].amp * maxHeight;
    ctx.lineTo(x, mid + h);
  }
  ctx.strokeStyle = `rgba(${Math.min(255, dc.r + 80)},${Math.min(255, dc.g + 80)},${Math.min(255, dc.b + 80)},0.4)`;
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Clean center line
  ctx.strokeStyle = `rgba(${dc.r},${dc.g},${dc.b},0.3)`;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(canvasWidth, mid);
  ctx.stroke();
}

/**
 * Draws beat grid lines and beat alignment markers.
 */
function drawBeatGrid(ctx, deck, canvasWidth, canvasHeight, startTime, endTime) {
  if (deck.bpm <= 0) return;
  const beatDuration = 60 / deck.bpm;
  const duration = endTime - startTime;
  const firstBeat = Math.ceil(startTime / beatDuration);
  const lastBeat = Math.floor(endTime / beatDuration);
  
  for (let bt = firstBeat; bt <= lastBeat; bt++) {
    const btTime = bt * beatDuration;
    const bx = ((btTime - startTime) / duration) * canvasWidth;
    
    if (bt % 4 === 0) {
      // Downbeat: RED beat alignment marker
      ctx.strokeStyle = 'rgba(255, 40, 40, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx, canvasHeight); ctx.stroke();
      // Small triangle at top
      ctx.fillStyle = 'rgba(255, 40, 40, 0.5)';
      ctx.beginPath(); ctx.moveTo(bx - 3, 0); ctx.lineTo(bx + 3, 0); ctx.lineTo(bx, 5); ctx.fill();
    } else {
      // Regular beat: subtle tick
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx, canvasHeight); ctx.stroke();
    }
  }
}

// ======================== OVERVIEW WAVEFORM ========================

function drawOverviewWaveformFromPeaks(deck, peaks) {
  const canvas = document.getElementById('ovCanvas' + (deck.id + 1));
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth * 2;
  canvas.height = canvas.offsetHeight * 2;
  const mid = canvas.height / 2;
  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Smooth peaks into bins
  const numBins = canvas.width;
  const bins = [];
  for (let i = 0; i < numBins; i++) {
    const peakIdx = Math.floor((i / numBins) * peaks.length);
    const amp = peaks[Math.min(peakIdx, peaks.length - 1)] || 0;
    bins.push({ amp, peak: amp });
  }
  // 3-point smooth
  const smoothed = [];
  for (let i = 0; i < numBins; i++) {
    const prev = i > 0 ? bins[i - 1].amp : bins[i].amp;
    const next = i < numBins - 1 ? bins[i + 1].amp : bins[i].amp;
    smoothed.push({ amp: (prev + bins[i].amp * 2 + next) / 4, peak: bins[i].peak });
  }
  
  drawSmoothWaveform(ctx, smoothed, mid, mid * 0.9, deck.id, canvas.width);
  deck._ovCache = ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function drawStaticWaveformFromPeaks(deck, peaks) {
  const canvas = document.getElementById('wfCanvas' + (deck.id + 1));
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth * 2;
  canvas.height = canvas.offsetHeight * 2;
  const mid = canvas.height / 2;
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  const numBins = canvas.width;
  const bins = [];
  for (let i = 0; i < numBins; i++) {
    const peakIdx = Math.floor((i / numBins) * peaks.length);
    const amp = peaks[Math.min(peakIdx, peaks.length - 1)] || 0;
    bins.push({ amp, peak: amp });
  }
  const smoothed = [];
  for (let i = 0; i < numBins; i++) {
    const prev = i > 0 ? bins[i - 1].amp : bins[i].amp;
    const next = i < numBins - 1 ? bins[i + 1].amp : bins[i].amp;
    smoothed.push({ amp: (prev + bins[i].amp * 2 + next) / 4, peak: bins[i].peak });
  }
  
  drawSmoothWaveform(ctx, smoothed, mid, mid * 0.9, deck.id, canvas.width);
  
  // Beat grid
  if (deck.bpm > 0 && deck.buffer) {
    drawBeatGrid(ctx, deck, canvas.width, canvas.height, 0, deck.buffer.duration);
  }
  
  wfCache[deck.id] = ctx.getImageData(0, 0, canvas.width, canvas.height);
  deck._wfDrawn = true;
}

function drawOverviewWaveform(deck) {
  const canvas = document.getElementById('ovCanvas' + (deck.id + 1));
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth * 2;
  canvas.height = canvas.offsetHeight * 2;
  if (!deck.buffer) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
  const data = deck.buffer.getChannelData(0);
  const mid = canvas.height / 2;
  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  const bins = computeSmoothedBins(data, 0, data.length, canvas.width);
  drawSmoothWaveform(ctx, bins, mid, mid * 0.9, deck.id, canvas.width);
  
  deck._ovCache = ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function drawOverviewPlayhead() {
  for (const deck of decks) {
    const canvas = document.getElementById('ovCanvas' + (deck.id + 1));
    const ctx = canvas.getContext('2d');
    if (!deck.buffer || !deck._ovCache) continue;
    ctx.putImageData(deck._ovCache, 0, 0);
    const progress = deck.getCurrentTime() / deck.buffer.duration;
    const x = progress * canvas.width;
    
    // Played portion: darker overlay
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, x, canvas.height);
    
    // Playhead: white with glow
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 1, 0, 3, canvas.height);
    ctx.shadowBlur = 0;
    
    // 16-bar beat jump markers
    if (deck.bpm > 0) {
      const beatDur = 60 / deck.bpm;
      const barDur = beatDur * 4;
      const sixteenBarDur = barDur * 16;
      const totalSections = Math.floor(deck.buffer.duration / sixteenBarDur);
      for (let s = 1; s <= totalSections; s++) {
        const mx = (s * sixteenBarDur / deck.buffer.duration) * canvas.width;
        ctx.fillStyle = 'rgba(255,255,0,0.35)';
        ctx.fillRect(mx, 0, 1, canvas.height);
        ctx.fillStyle = 'rgba(255,255,0,0.5)';
        ctx.beginPath(); ctx.moveTo(mx - 3, 0); ctx.lineTo(mx + 3, 0); ctx.lineTo(mx, 5); ctx.fill();
      }
    }
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

// ======================== STATIC (ZOOMED) WAVEFORM ========================

function drawStaticWaveform(deck) {
  const canvas = document.getElementById('wfCanvas' + (deck.id + 1));
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth * 2;
  canvas.height = canvas.offsetHeight * 2;
  if (!deck.buffer) { ctx.clearRect(0, 0, canvas.width, canvas.height); wfCache[deck.id] = null; return; }
  const data = deck.buffer.getChannelData(0);
  const mid = canvas.height / 2;
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  const bins = computeSmoothedBins(data, 0, data.length, canvas.width);
  drawSmoothWaveform(ctx, bins, mid, mid * 0.9, deck.id, canvas.width);
  
  // Beat grid with alignment markers
  if (deck.bpm > 0) {
    drawBeatGrid(ctx, deck, canvas.width, canvas.height, 0, deck.buffer.duration);
  }
  
  wfCache[deck.id] = ctx.getImageData(0, 0, canvas.width, canvas.height);
  deck._wfDrawn = true;
}

// ======================== PLAYHEAD + ZOOMED VIEW ========================

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
      
      // Played portion overlay
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, 0, x, canvas.height);
      
      // Playhead: bright white 3px with glow
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 1, 0, 3, canvas.height);
      ctx.shadowBlur = 0;
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
      const mid = canvas.height / 2;
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const bins = computeSmoothedBins(data, startSample, endSample, canvas.width);
      drawSmoothWaveform(ctx, bins, mid, mid * 0.9, deck.id, canvas.width);
      
      // Beat grid in zoomed view
      if (deck.bpm > 0) {
        const startTime = startFrac * deck.buffer.duration;
        const endTime = endFrac * deck.buffer.duration;
        drawBeatGrid(ctx, deck, canvas.width, canvas.height, startTime, endTime);
      }
      
      const playheadX = ((progress - startFrac) / visibleFraction) * canvas.width;
      
      // Played portion overlay
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, 0, playheadX, canvas.height);
      
      // Playhead with glow
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(playheadX - 1, 0, 3, canvas.height);
      ctx.shadowBlur = 0;
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
