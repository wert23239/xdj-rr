/**
 * @fileoverview Web MIDI API support for the XDJ-RR controller.
 * Supports MIDI learn mode, persistent mappings, and common DJ controller mappings.
 */

// ==================== MIDI ENGINE ====================
let midiAccess = null;
let midiConnected = false;
let midiLearnMode = false;
let midiLearnTarget = null; // {controlId, element}
let midiMappings = {}; // { "ch:cc": controlId } or { "ch:note": controlId }

// Default MIDI CC mappings (common DJ controller layout)
const DEFAULT_MIDI_MAP = {
  // Crossfader
  '0:cc:0': 'crossfader',
  // Channel volumes
  '0:cc:1': 'vol1',
  '0:cc:2': 'vol2',
  // EQ knobs CH1
  '0:cc:3': 'eq-hi-0',
  '0:cc:4': 'eq-mid-0',
  '0:cc:5': 'eq-lo-0',
  // EQ knobs CH2
  '0:cc:6': 'eq-hi-1',
  '0:cc:7': 'eq-mid-1',
  '0:cc:8': 'eq-lo-1',
  // Tempo
  '0:cc:9': 'tempo1',
  '0:cc:10': 'tempo2',
  // Master volume
  '0:cc:11': 'masterVol',
  // Play buttons (note on)
  '0:note:36': 'play1',
  '0:note:37': 'play2',
  // Cue buttons
  '0:note:38': 'cue1',
  '0:note:39': 'cue2',
  // Sync
  '0:note:40': 'sync1',
  '0:note:41': 'sync2',
  // Hot cues deck 1
  '0:note:48': 'hotcue-0-0',
  '0:note:49': 'hotcue-0-1',
  '0:note:50': 'hotcue-0-2',
  '0:note:51': 'hotcue-0-3',
  // Hot cues deck 2
  '0:note:52': 'hotcue-1-0',
  '0:note:53': 'hotcue-1-1',
  '0:note:54': 'hotcue-1-2',
  '0:note:55': 'hotcue-1-3',
};

// Control definitions: maps controlId to handler
const MIDI_CONTROLS = {
  crossfader: {
    type: 'cc',
    apply: (val) => {
      const v = val / 127;
      document.getElementById('crossfader').value = v;
      document.getElementById('crossfader').dispatchEvent(new Event('input'));
    }
  },
  vol1: {
    type: 'cc',
    apply: (val) => {
      const v = val / 127;
      document.getElementById('vol1').value = v;
      decks[0].gainNode.gain.value = v;
    }
  },
  vol2: {
    type: 'cc',
    apply: (val) => {
      const v = val / 127;
      document.getElementById('vol2').value = v;
      decks[1].gainNode.gain.value = v;
    }
  },
  masterVol: {
    type: 'cc',
    apply: (val) => {
      const v = val / 127;
      document.getElementById('masterVol').value = v;
      masterGain.gain.value = v;
      document.getElementById('masterVal').textContent = Math.round(v * 100) + '%';
    }
  },
  tempo1: {
    type: 'cc',
    apply: (val) => {
      const pct = ((val / 127) * 16) - 8; // -8 to +8
      document.getElementById('tempo1').value = pct;
      decks[0].setTempo(pct);
      document.getElementById('tempoVal1').textContent = pct.toFixed(1) + '%';
    }
  },
  tempo2: {
    type: 'cc',
    apply: (val) => {
      const pct = ((val / 127) * 16) - 8;
      document.getElementById('tempo2').value = pct;
      decks[1].setTempo(pct);
      document.getElementById('tempoVal2').textContent = pct.toFixed(1) + '%';
    }
  },
  play1: { type: 'note', apply: () => decks[0].togglePlay() },
  play2: { type: 'note', apply: () => decks[1].togglePlay() },
  cue1: { type: 'note', apply: () => decks[0].cue() },
  cue2: { type: 'note', apply: () => decks[1].cue() },
  sync1: { type: 'note', apply: () => { decks[0].sync(decks[1]); document.getElementById('sync1').classList.add('active'); setTimeout(() => document.getElementById('sync1').classList.remove('active'), 500); } },
  sync2: { type: 'note', apply: () => { decks[1].sync(decks[0]); document.getElementById('sync2').classList.add('active'); setTimeout(() => document.getElementById('sync2').classList.remove('active'), 500); } },
};

// EQ knobs
['hi', 'mid', 'lo'].forEach(band => {
  [0, 1].forEach(ch => {
    MIDI_CONTROLS[`eq-${band}-${ch}`] = {
      type: 'cc',
      apply: (val) => {
        const knob = document.querySelector(`.knob[data-param="${band}"][data-ch="${ch}"]`);
        if (!knob) return;
        const angle = ((val / 127) * 270) - 135; // -135 to 135
        knobAngles.set(knob, angle);
        knob.querySelector('.knob-indicator').style.transform = `translateX(-50%) rotate(${angle}deg)`;
        applyKnob(knob, angle);
      }
    };
  });
});

// Hot cues
for (let d = 0; d < 2; d++) {
  for (let c = 0; c < 4; c++) {
    MIDI_CONTROLS[`hotcue-${d}-${c}`] = {
      type: 'note',
      apply: () => handleHotCue(d, c, {})
    };
  }
}

// ==================== MIDI INITIALIZATION ====================
async function initMIDI() {
  if (!navigator.requestMIDIAccess) {
    console.log('Web MIDI API not supported');
    return;
  }
  try {
    midiAccess = await navigator.requestMIDIAccess({ sysex: false });
    midiAccess.addEventListener('statechange', onMIDIStateChange);
    connectMIDIInputs();
    loadMIDIMappings();
  } catch (e) {
    console.log('MIDI access denied:', e);
  }
}

function connectMIDIInputs() {
  if (!midiAccess) return;
  let hasInput = false;
  for (const input of midiAccess.inputs.values()) {
    input.onmidimessage = onMIDIMessage;
    hasInput = true;
  }
  updateMIDIIndicator(hasInput);
}

function onMIDIStateChange(e) {
  connectMIDIInputs();
}

function onMIDIMessage(event) {
  const [status, data1, data2] = event.data;
  const channel = status & 0x0F;
  const msgType = status & 0xF0;

  let key = null;
  let value = data2;

  if (msgType === 0xB0) {
    // Control Change
    key = `${channel}:cc:${data1}`;
  } else if (msgType === 0x90 && data2 > 0) {
    // Note On
    key = `${channel}:note:${data1}`;
    value = data2;
  } else if (msgType === 0x80 || (msgType === 0x90 && data2 === 0)) {
    // Note Off - ignore for now
    return;
  } else {
    return;
  }

  // MIDI Learn mode
  if (midiLearnMode && midiLearnTarget) {
    midiMappings[key] = midiLearnTarget.controlId;
    saveMIDIMappings();
    showMIDILearnFeedback(midiLearnTarget.controlId, key);
    midiLearnTarget = null;
    return;
  }

  // Check user mappings first, then defaults
  const controlId = midiMappings[key] || DEFAULT_MIDI_MAP[key];
  if (controlId && MIDI_CONTROLS[controlId]) {
    MIDI_CONTROLS[controlId].apply(value);
    flashMIDIActivity();
  }
}

// ==================== MIDI INDICATOR ====================
function updateMIDIIndicator(connected) {
  midiConnected = connected;
  const indicator = document.getElementById('midiIndicator');
  if (indicator) {
    indicator.classList.toggle('connected', connected);
    indicator.title = connected ? 'MIDI controller connected' : 'No MIDI controller';
  }
}

function flashMIDIActivity() {
  const indicator = document.getElementById('midiIndicator');
  if (!indicator) return;
  indicator.classList.add('activity');
  setTimeout(() => indicator.classList.remove('activity'), 100);
}

// ==================== MIDI LEARN ====================
function toggleMIDILearn() {
  midiLearnMode = !midiLearnMode;
  const btn = document.getElementById('midiLearnBtn');
  if (btn) {
    btn.classList.toggle('active', midiLearnMode);
    btn.textContent = midiLearnMode ? '🎹 LEARNING...' : '🎹 MIDI LEARN';
  }
  if (midiLearnMode) {
    document.body.classList.add('midi-learn-mode');
    addMIDILearnListeners();
  } else {
    document.body.classList.remove('midi-learn-mode');
    removeMIDILearnListeners();
    midiLearnTarget = null;
  }
}

function addMIDILearnListeners() {
  // Make clickable controls respond to learn mode
  const learnableElements = [
    { sel: '#crossfader', id: 'crossfader' },
    { sel: '#vol1', id: 'vol1' },
    { sel: '#vol2', id: 'vol2' },
    { sel: '#masterVol', id: 'masterVol' },
    { sel: '#tempo1', id: 'tempo1' },
    { sel: '#tempo2', id: 'tempo2' },
    { sel: '#play1', id: 'play1' },
    { sel: '#play2', id: 'play2' },
    { sel: '#cue1', id: 'cue1' },
    { sel: '#cue2', id: 'cue2' },
    { sel: '#sync1', id: 'sync1' },
    { sel: '#sync2', id: 'sync2' },
  ];

  // EQ knobs
  ['hi', 'mid', 'lo'].forEach(band => {
    [0, 1].forEach(ch => {
      learnableElements.push({
        sel: `.knob[data-param="${band}"][data-ch="${ch}"]`,
        id: `eq-${band}-${ch}`
      });
    });
  });

  // Hot cues
  for (let d = 0; d < 2; d++) {
    for (let c = 0; c < 4; c++) {
      learnableElements.push({
        sel: `.hotcue-btn[data-deck="${d}"][data-cue="${c}"]`,
        id: `hotcue-${d}-${c}`
      });
    }
  }

  learnableElements.forEach(({ sel, id }) => {
    const el = document.querySelector(sel);
    if (el) {
      el._midiLearnHandler = (e) => {
        if (!midiLearnMode) return;
        e.preventDefault();
        e.stopPropagation();
        midiLearnTarget = { controlId: id, element: el };
        // Visual feedback
        document.querySelectorAll('.midi-learn-waiting').forEach(e => e.classList.remove('midi-learn-waiting'));
        el.classList.add('midi-learn-waiting');
      };
      el.addEventListener('click', el._midiLearnHandler, true);
    }
  });
}

function removeMIDILearnListeners() {
  document.querySelectorAll('.midi-learn-waiting').forEach(e => e.classList.remove('midi-learn-waiting'));
  // Remove handlers
  document.querySelectorAll('[class]').forEach(el => {
    if (el._midiLearnHandler) {
      el.removeEventListener('click', el._midiLearnHandler, true);
      delete el._midiLearnHandler;
    }
  });
}

function showMIDILearnFeedback(controlId, midiKey) {
  document.querySelectorAll('.midi-learn-waiting').forEach(e => e.classList.remove('midi-learn-waiting'));
  // Show toast
  const toast = document.createElement('div');
  toast.className = 'midi-learn-toast';
  toast.textContent = `Mapped: ${midiKey} → ${controlId}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// ==================== PERSISTENCE ====================
function saveMIDIMappings() {
  try {
    localStorage.setItem('xdj-midi-mappings', JSON.stringify(midiMappings));
  } catch (e) {}
}

function loadMIDIMappings() {
  try {
    const raw = localStorage.getItem('xdj-midi-mappings');
    if (raw) midiMappings = JSON.parse(raw);
  } catch (e) {}
}

function clearMIDIMappings() {
  midiMappings = {};
  saveMIDIMappings();
}

// ==================== INIT ====================
initMIDI();
