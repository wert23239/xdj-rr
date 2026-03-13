/**
 * @fileoverview Audio effects for the XDJ-RR controller.
 * Includes flanger, phaser, bitcrusher, echo, reverb, and delay.
 */

/**
 * Creates a bitcrusher ScriptProcessor node.
 * @param {AudioContext} ctx - The audio context
 * @returns {ScriptProcessorNode} The bitcrusher node with .bits and .normFreq properties
 */
function createBitCrusher(ctx) {
  const bufSize = 4096;
  const node = ctx.createScriptProcessor(bufSize, 1, 1);
  node.bits = 8;
  node.normFreq = 0.3;
  let phaser = 0, last = 0;
  node.onaudioprocess = function(e) {
    const inp = e.inputBuffer.getChannelData(0);
    const out = e.outputBuffer.getChannelData(0);
    const step = Math.pow(0.5, node.bits);
    for (let i = 0; i < bufSize; i++) {
      phaser += node.normFreq;
      if (phaser >= 1.0) { phaser -= 1.0; last = step * Math.floor(inp[i] / step + 0.5); }
      out[i] = last;
    }
  };
  return node;
}

/**
 * Creates a reverb impulse response buffer.
 * @param {AudioContext} actx - The audio context
 * @returns {AudioBuffer} Reverb impulse response
 */
function createReverbBuffer(actx) {
  const len = actx.sampleRate * 2;
  const buf = actx.createBuffer(2, len, actx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
  }
  return buf;
}

/**
 * Sets up the complete effects chain for a deck.
 * @param {AudioContext} actx - The audio context
 * @param {object} deck - The deck object to attach effects to
 */
function setupEffectsChain(actx, deck) {
  // Echo
  deck.echoNode = actx.createDelay(1.0);
  deck.echoNode.delayTime.value = 0.375;
  deck.echoFeedback = actx.createGain();
  deck.echoFeedback.gain.value = 0;
  deck.echoWet = actx.createGain();
  deck.echoWet.gain.value = 0;

  // Reverb
  deck.reverbWet = actx.createGain();
  deck.reverbWet.gain.value = 0;
  deck.reverbConvolver = actx.createConvolver();
  deck.reverbConvolver.buffer = createReverbBuffer(actx);

  // Delay
  deck.delayNode = actx.createDelay(1.0);
  deck.delayNode.delayTime.value = 0.25;
  deck.delayWet = actx.createGain();
  deck.delayWet.gain.value = 0;

  // Flanger
  deck.flangerDelay = actx.createDelay(0.02);
  deck.flangerDelay.delayTime.value = 0.005;
  deck.flangerLFO = actx.createOscillator();
  deck.flangerLFO.type = 'sine';
  deck.flangerLFO.frequency.value = 0.5;
  deck.flangerLFOGain = actx.createGain();
  deck.flangerLFOGain.gain.value = 0;
  deck.flangerLFO.connect(deck.flangerLFOGain);
  deck.flangerLFOGain.connect(deck.flangerDelay.delayTime);
  deck.flangerLFO.start();
  deck.flangerWet = actx.createGain();
  deck.flangerWet.gain.value = 0;

  // Phaser (chain of allpass filters with LFO)
  deck.phaserFilters = [];
  deck.phaserWet = actx.createGain();
  deck.phaserWet.gain.value = 0;
  deck.phaserLFO = actx.createOscillator();
  deck.phaserLFO.type = 'sine';
  deck.phaserLFO.frequency.value = 0.4;
  deck.phaserLFO.start();
  for (let s = 0; s < 4; s++) {
    const ap = actx.createBiquadFilter();
    ap.type = 'allpass'; ap.frequency.value = 1000; ap.Q.value = 5;
    const lfoG = actx.createGain(); lfoG.gain.value = 500;
    deck.phaserLFO.connect(lfoG);
    lfoG.connect(ap.frequency);
    deck.phaserFilters.push(ap);
  }

  // Bitcrusher
  deck.bitcrusher = createBitCrusher(actx);
  deck.bitcrushWet = actx.createGain();
  deck.bitcrushWet.gain.value = 0;
  deck.bitcrushDry = actx.createGain();
  deck.bitcrushDry.gain.value = 1;

  deck.fx = { echo: false, reverb: false, delay: false, flanger: false, phaser: false, bitcrush: false };
}

/**
 * Connects the effects chain between colorFilter output and channelGain input.
 * @param {object} deck - The deck with effects nodes
 */
function connectEffectsChain(deck) {
  const src = deck.colorFilter;
  const dest = deck.channelGain;

  // Dry path
  src.connect(dest);

  // Echo
  src.connect(deck.echoNode);
  deck.echoNode.connect(deck.echoFeedback);
  deck.echoFeedback.connect(deck.echoNode);
  deck.echoNode.connect(deck.echoWet);
  deck.echoWet.connect(dest);

  // Reverb
  src.connect(deck.reverbConvolver);
  deck.reverbConvolver.connect(deck.reverbWet);
  deck.reverbWet.connect(dest);

  // Delay
  src.connect(deck.delayNode);
  deck.delayNode.connect(deck.delayWet);
  deck.delayWet.connect(dest);

  // Flanger
  src.connect(deck.flangerDelay);
  deck.flangerDelay.connect(deck.flangerWet);
  deck.flangerWet.connect(dest);

  // Phaser
  let pChain = src;
  for (const f of deck.phaserFilters) { pChain.connect(f); pChain = f; }
  pChain.connect(deck.phaserWet);
  deck.phaserWet.connect(dest);

  // Bitcrusher
  src.connect(deck.bitcrusher);
  deck.bitcrusher.connect(deck.bitcrushWet);
  deck.bitcrushWet.connect(dest);
}

/**
 * Toggles an effect on a deck.
 * @param {object} deck - The deck object
 * @param {string} type - Effect type: echo, reverb, delay, flanger, phaser, bitcrush
 */
function toggleDeckFX(deck, type) {
  deck.fx[type] = !deck.fx[type];
  // Use fxWetDry if available (from app.js), else default 0.5
  const wet = (typeof fxWetDry !== 'undefined') ? fxWetDry[deck.id] : 0.5;
  if (!deck.fx[type]) {
    // Turn off
    switch(type) {
      case 'echo': deck.echoWet.gain.value = 0; deck.echoFeedback.gain.value = 0; break;
      case 'reverb': deck.reverbWet.gain.value = 0; break;
      case 'delay': deck.delayWet.gain.value = 0; break;
      case 'flanger': deck.flangerWet.gain.value = 0; deck.flangerLFOGain.gain.value = 0; break;
      case 'phaser': deck.phaserWet.gain.value = 0; break;
      case 'bitcrush': deck.bitcrushWet.gain.value = 0; break;
    }
  } else {
    switch(type) {
      case 'echo': deck.echoWet.gain.value = wet; deck.echoFeedback.gain.value = wet * 0.8; break;
      case 'reverb': deck.reverbWet.gain.value = wet; break;
      case 'delay': deck.delayWet.gain.value = wet; break;
      case 'flanger': deck.flangerWet.gain.value = wet; deck.flangerLFOGain.gain.value = wet * 0.006; break;
      case 'phaser': deck.phaserWet.gain.value = wet; break;
      case 'bitcrush': deck.bitcrushWet.gain.value = wet; break;
    }
  }
}
