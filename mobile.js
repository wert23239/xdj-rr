/**
 * @fileoverview Mobile-specific logic for XDJ-RR.
 * Deck switching, swipe gestures, slide-up mixer, full-screen browser overlay.
 */

let currentMobileDeck = 0;
let mobileBrowserOpen = false;
let mobileMixerOpen = false;

function isMobile() {
  return window.innerWidth <= 700;
}

function switchMobileDeck(deckIdx) {
  currentMobileDeck = deckIdx;
  document.getElementById('mDeckTab1').classList.toggle('active', deckIdx === 0);
  document.getElementById('mDeckTab2').classList.toggle('active', deckIdx === 1);
  
  const deck1 = document.getElementById('deckEl1');
  const deck2 = document.getElementById('deckEl2');
  if (!isMobile()) return;
  
  deck1.classList.toggle('mobile-hidden', deckIdx !== 0);
  deck2.classList.toggle('mobile-hidden', deckIdx !== 1);
  
  updateMobilePlayBtn();
}

function updateMobilePlayBtn() {
  const btn = document.getElementById('mPlay');
  if (!btn) return;
  const deck = decks[currentMobileDeck];
  btn.textContent = deck.playing ? '⏸' : '▶';
  btn.classList.toggle('active', deck.playing);
}

function toggleMobileBrowser() {
  mobileBrowserOpen = !mobileBrowserOpen;
  const panel = document.getElementById('browserPanel');
  panel.classList.toggle('mobile-browser-overlay', mobileBrowserOpen);
  panel.classList.toggle('hidden', !mobileBrowserOpen && panel.classList.contains('hidden'));
  if (mobileBrowserOpen) {
    panel.classList.remove('hidden');
    panel.style.display = '';
  }
  document.getElementById('mBrowser').classList.toggle('active', mobileBrowserOpen);
  
  // Close with backdrop tap
  if (mobileBrowserOpen) {
    const backdrop = document.createElement('div');
    backdrop.className = 'mobile-backdrop';
    backdrop.id = 'mobileBrowserBackdrop';
    backdrop.onclick = () => { toggleMobileBrowser(); };
    document.body.appendChild(backdrop);
  } else {
    const bd = document.getElementById('mobileBrowserBackdrop');
    if (bd) bd.remove();
  }
}

function toggleMobileMixer() {
  mobileMixerOpen = !mobileMixerOpen;
  const mixer = document.querySelector('.mixer');
  mixer.classList.toggle('mobile-mixer-sheet', mobileMixerOpen);
  document.getElementById('mMixer').classList.toggle('active', mobileMixerOpen);
  
  if (mobileMixerOpen) {
    const backdrop = document.createElement('div');
    backdrop.className = 'mobile-backdrop';
    backdrop.id = 'mobileMixerBackdrop';
    backdrop.onclick = () => { toggleMobileMixer(); };
    document.body.appendChild(backdrop);
  } else {
    const bd = document.getElementById('mobileMixerBackdrop');
    if (bd) bd.remove();
  }
}

// Swipe gesture support for deck switching
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

document.addEventListener('touchstart', (e) => {
  if (!isMobile()) return;
  // Only track swipes on the decks area
  const decksArea = document.querySelector('.decks-area');
  if (!decksArea || !decksArea.contains(e.target)) return;
  // Don't interfere with jog wheels or sliders
  if (e.target.closest('.jog, .jog-container, input[type="range"], .knob')) return;
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  touchStartTime = Date.now();
}, { passive: true });

document.addEventListener('touchend', (e) => {
  if (!isMobile() || !touchStartTime) return;
  const elapsed = Date.now() - touchStartTime;
  if (elapsed > 500) { touchStartTime = 0; return; } // too slow
  
  const touch = e.changedTouches[0];
  const dx = touch.clientX - touchStartX;
  const dy = touch.clientY - touchStartY;
  
  if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    // Horizontal swipe
    if (dx < 0 && currentMobileDeck === 0) switchMobileDeck(1);
    else if (dx > 0 && currentMobileDeck === 1) switchMobileDeck(0);
  }
  
  touchStartTime = 0;
}, { passive: true });

// Update mobile play button in animation loop
// (using interval since animate is recursive and _origAnimate is in app.js)
setInterval(() => {
  if (isMobile()) updateMobilePlayBtn();
}, 200);

// On resize, fix visibility
window.addEventListener('resize', () => {
  if (isMobile()) {
    switchMobileDeck(currentMobileDeck);
  } else {
    // Desktop: show both decks
    document.getElementById('deckEl1').classList.remove('mobile-hidden');
    document.getElementById('deckEl2').classList.remove('mobile-hidden');
    // Clean up mobile overlays
    const mixer = document.querySelector('.mixer');
    mixer.classList.remove('mobile-mixer-sheet');
    const bp = document.getElementById('browserPanel');
    bp.classList.remove('mobile-browser-overlay');
    document.querySelectorAll('.mobile-backdrop').forEach(b => b.remove());
  }
});

// Initialize on load
if (isMobile()) {
  switchMobileDeck(0);
}
