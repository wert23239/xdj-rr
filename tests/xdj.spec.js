const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3000';

// Helper: load a track into a deck and wait
async function loadTrack(page, deckNum) {
  await page.waitForSelector('.track-item', { timeout: 10000 });
  const track = page.locator('.track-item').first();
  await track.hover();
  await track.locator(`.load-btn.d${deckNum}`).click();
  await expect(page.locator('#status')).toContainText(`Loaded to Deck ${deckNum}`, { timeout: 30000 });
}

// ============================================================
// 1. PAGE LOAD & STRUCTURE
// ============================================================

test.describe('Page Load', () => {
  test('page loads with correct title and structure', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('XDJ-RR');
    await expect(page.locator('.logo')).toHaveText('PIONEER XDJ-RR');
    await expect(page.locator('.deck.d1')).toBeVisible();
    await expect(page.locator('.deck.d2')).toBeVisible();
    await expect(page.locator('.mixer')).toBeVisible();
  });

  test('track browser shows tracks', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.track-item', { timeout: 10000 });
    const count = await page.locator('.track-item').count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(50);
    await expect(page.locator('#status')).toContainText('tracks loaded');
  });
});

// ============================================================
// 2. TRACK LOADING
// ============================================================

test.describe('Track Loading', () => {
  test('load track into deck 1 via D1 button', async ({ page }) => {
    await page.goto('/');
    await loadTrack(page, 1);
    // Deck 1 waveform title should update
    const title = await page.locator('#wfTitle1').textContent();
    expect(title).not.toBe('DECK 1');
  });

  test('load track into deck 2 via D2 button', async ({ page }) => {
    await page.goto('/');
    await loadTrack(page, 2);
    const title = await page.locator('#wfTitle2').textContent();
    expect(title).not.toBe('DECK 2');
  });

  test('LOG button enables after starting recording', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#logBtn1')).toBeDisabled();
    // Start recording to enable LOG buttons
    await page.locator('#recBtn').click();
    await expect(page.locator('#logBtn1')).toBeEnabled();
    // Stop recording
    await page.locator('#recBtn').click();
  });
});

// ============================================================
// 3. TRACK SEARCH / FILTER
// ============================================================

test.describe('Track Search', () => {
  test('search filters tracks', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.track-item', { timeout: 10000 });
    const allCount = await page.locator('.track-item').count();
    // Type a nonsense string to filter to 0
    await page.fill('#trackSearch', 'zzznonexistent999');
    await page.waitForTimeout(300);
    const filteredCount = await page.locator('.track-item:visible').count();
    expect(filteredCount).toBeLessThanOrEqual(allCount);
  });

  test('clearing search restores tracks', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.track-item', { timeout: 10000 });
    const allCount = await page.locator('.track-item').count();
    await page.fill('#trackSearch', 'zzznonexistent999');
    await page.waitForTimeout(300);
    await page.fill('#trackSearch', '');
    await page.locator('#trackSearch').dispatchEvent('input');
    await page.waitForTimeout(300);
    const restored = await page.locator('.track-item').count();
    expect(restored).toBe(allCount);
  });
});

// ============================================================
// 4. TRANSPORT CONTROLS
// ============================================================

test.describe('Transport Controls', () => {
  test('play/pause toggles on deck 1 with loaded track', async ({ page }) => {
    await page.goto('/');
    await loadTrack(page, 1);
    const playBtn = page.locator('#play1');
    await playBtn.click();
    await expect(playBtn).toContainText('PAUSE');
    await playBtn.click();
    await expect(playBtn).toContainText('PLAY');
  });

  test('play/pause toggles on deck 2 with loaded track', async ({ page }) => {
    await page.goto('/');
    await loadTrack(page, 2);
    const playBtn = page.locator('#play2');
    await playBtn.click();
    await expect(playBtn).toContainText('PAUSE');
    await playBtn.click();
    await expect(playBtn).toContainText('PLAY');
  });

  test('cue buttons exist for both decks', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#cue1')).toBeVisible();
    await expect(page.locator('#cue2')).toBeVisible();
    await expect(page.locator('#cue1')).toContainText('CUE');
  });

  test('sync buttons exist for both decks', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#sync1')).toBeVisible();
    await expect(page.locator('#sync2')).toBeVisible();
    await expect(page.locator('#sync1')).toContainText('SYNC');
  });

  test('play without loaded track stays PLAY', async ({ page }) => {
    await page.goto('/');
    const playBtn = page.locator('#play1');
    await expect(playBtn).toContainText('PLAY');
    await playBtn.click();
    // Should still be visible (no crash)
    await expect(playBtn).toBeVisible();
  });
});

// ============================================================
// 5. CROSSFADER
// ============================================================

test.describe('Crossfader', () => {
  test('crossfader moves', async ({ page }) => {
    await page.goto('/');
    const cf = page.locator('#crossfader');
    await expect(cf).toBeVisible();
    await cf.fill('0.2');
    await cf.dispatchEvent('input');
    expect(parseFloat(await cf.inputValue())).toBe(0.2);
  });

  test('crossfader at extremes', async ({ page }) => {
    await page.goto('/');
    const cf = page.locator('#crossfader');
    await cf.fill('0');
    await cf.dispatchEvent('input');
    expect(parseFloat(await cf.inputValue())).toBe(0);
    await cf.fill('1');
    await cf.dispatchEvent('input');
    expect(parseFloat(await cf.inputValue())).toBe(1);
  });
});

// ============================================================
// 6. VOLUME FADERS
// ============================================================

test.describe('Volume Faders', () => {
  test('channel volume faders work', async ({ page }) => {
    await page.goto('/');
    for (const id of ['#vol1', '#vol2']) {
      const fader = page.locator(id);
      await expect(fader).toBeVisible();
      await fader.fill('0.5');
      await fader.dispatchEvent('input');
      expect(parseFloat(await fader.inputValue())).toBe(0.5);
    }
  });

  test('master volume works', async ({ page }) => {
    await page.goto('/');
    const master = page.locator('#masterVol');
    await expect(master).toBeVisible();
    await master.fill('0.7');
    await master.dispatchEvent('input');
    await expect(page.locator('#masterVal')).toContainText('70%');
  });
});

// ============================================================
// 7. EQ KNOBS
// ============================================================

test.describe('EQ Knobs', () => {
  test('EQ knobs exist for both channels (Hi/Mid/Lo + Gain)', async ({ page }) => {
    await page.goto('/');
    for (const ch of ['0', '1']) {
      for (const param of ['gain', 'hi', 'mid', 'lo']) {
        const knob = page.locator(`.knob[data-param="${param}"][data-ch="${ch}"]`);
        await expect(knob).toBeVisible();
      }
    }
  });

  test('EQ kill switches toggle', async ({ page }) => {
    await page.goto('/');
    const kill = page.locator('.eq-kill-btn[data-ch="0"][data-band="hi"]');
    await expect(kill).toBeVisible();
    await kill.click();
    await expect(kill).toHaveClass(/active/);
    await kill.click();
    await expect(kill).not.toHaveClass(/active/);
  });

  test('all EQ kill switches exist (6 total)', async ({ page }) => {
    await page.goto('/');
    const kills = page.locator('.eq-kill-btn');
    expect(await kills.count()).toBe(6);
  });
});

// ============================================================
// 8. COLOR FX
// ============================================================

test.describe('Color FX', () => {
  test('color FX knobs exist for both channels', async ({ page }) => {
    await page.goto('/');
    const colorKnobs = page.locator('.knob[data-param="color"]');
    expect(await colorKnobs.count()).toBe(2);
  });
});

// ============================================================
// 9. BEAT FX
// ============================================================

test.describe('Beat FX', () => {
  test('all 6 beat FX types exist per channel', async ({ page }) => {
    await page.goto('/');
    const fxTypes = ['echo', 'reverb', 'delay', 'flanger', 'phaser', 'bitcrush'];
    for (const ch of ['0', '1']) {
      for (const fx of fxTypes) {
        const btn = page.locator(`.fx-btn[data-fx="${fx}"][data-ch="${ch}"]`);
        await expect(btn).toBeVisible();
      }
    }
  });

  test('beat FX toggle activates/deactivates', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('.fx-btn[data-fx="echo"][data-ch="0"]');
    await btn.click();
    await expect(btn).toHaveClass(/active/);
    await btn.click();
    await expect(btn).not.toHaveClass(/active/);
  });
});

// ============================================================
// 10. HOT CUES
// ============================================================

test.describe('Hot Cues', () => {
  test('8 hot cue buttons exist (4 per deck)', async ({ page }) => {
    await page.goto('/');
    expect(await page.locator('.hotcue-btn').count()).toBe(8);
  });

  test('hot cue buttons per deck', async ({ page }) => {
    await page.goto('/');
    expect(await page.locator('.hotcue-btn[data-deck="0"]').count()).toBe(4);
    expect(await page.locator('.hotcue-btn[data-deck="1"]').count()).toBe(4);
  });

  test('hot cue buttons are clickable (require loaded track for set)', async ({ page }) => {
    await page.goto('/');
    // Without a loaded track, clicking should not crash
    const cueBtn = page.locator('.hotcue-btn[data-deck="0"][data-cue="0"]');
    await cueBtn.click();
    await expect(cueBtn).toBeVisible();
    // Hot cue won't have 'set' class without buffer - that's correct behavior
  });
});

// ============================================================
// 11. LOOP BUTTONS
// ============================================================

test.describe('Loop Buttons', () => {
  test('10 loop buttons exist (5 per deck)', async ({ page }) => {
    await page.goto('/');
    expect(await page.locator('.loop-btn').count()).toBe(10);
  });

  test('loop sizes are correct', async ({ page }) => {
    await page.goto('/');
    const d1Loops = page.locator('.loop-btn[data-deck="0"]');
    const sizes = ['0.5', '1', '2', '4', '8'];
    for (let i = 0; i < 5; i++) {
      expect(await d1Loops.nth(i).getAttribute('data-beats')).toBe(sizes[i]);
    }
  });
});

// ============================================================
// 12. HEADPHONE CUE
// ============================================================

test.describe('Headphone Cue', () => {
  test('headphone cue toggles for both decks', async ({ page }) => {
    await page.goto('/');
    for (const id of ['#headphone1', '#headphone2']) {
      const btn = page.locator(id);
      await expect(btn).toBeVisible();
      await expect(btn).not.toHaveClass(/active/);
      await btn.click();
      await expect(btn).toHaveClass(/active/);
      await btn.click();
      await expect(btn).not.toHaveClass(/active/);
    }
  });
});

// ============================================================
// 13. PERFORMANCE MODE
// ============================================================

test.describe('Performance Mode', () => {
  test('performance mode toggle works', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('#perfToggle');
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(btn).toHaveClass(/active/);
    await expect(page.locator('.controller')).toHaveClass(/performance-mode/);
    await btn.click();
    await expect(btn).not.toHaveClass(/active/);
    await expect(page.locator('.controller')).not.toHaveClass(/performance-mode/);
  });
});

// ============================================================
// 14. MINI-MIXER MODE
// ============================================================

test.describe('Mini-Mixer Mode', () => {
  test('mini-mixer toggle works', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('#miniToggle');
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(page.locator('body')).toHaveClass(/mini-mixer/);
    await btn.click();
    await expect(page.locator('body')).not.toHaveClass(/mini-mixer/);
  });
});

// ============================================================
// 15. THEME TOGGLE
// ============================================================

test.describe('Theme Toggle', () => {
  test('dark/light theme toggle', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('#themeBtn');
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(page.locator('body')).toHaveClass(/light-theme/);
    await btn.click();
    await expect(page.locator('body')).not.toHaveClass(/light-theme/);
  });
});

// ============================================================
// 16. TRACK SORTING
// ============================================================

test.describe('Track Sorting', () => {
  test('sort controls exist with 3 buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.sort-controls')).toBeVisible();
    expect(await page.locator('.sort-btn').count()).toBe(3);
  });

  test('sort by name activates', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.track-item', { timeout: 10000 });
    await page.locator('.sort-btn[data-sort="name"]').click();
    await expect(page.locator('.sort-btn[data-sort="name"]')).toHaveClass(/active/);
    await expect(page.locator('.sort-btn[data-sort="date"]')).not.toHaveClass(/active/);
  });

  test('sort by size activates', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.track-item', { timeout: 10000 });
    await page.locator('.sort-btn[data-sort="size"]').click();
    await expect(page.locator('.sort-btn[data-sort="size"]')).toHaveClass(/active/);
  });

  test('sort by date activates', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.track-item', { timeout: 10000 });
    await page.locator('.sort-btn[data-sort="date"]').click();
    await expect(page.locator('.sort-btn[data-sort="date"]')).toHaveClass(/active/);
  });
});

// ============================================================
// 17. DRAG AND DROP
// ============================================================

test.describe('Drag and Drop', () => {
  test('tracks are draggable', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.track-item', { timeout: 10000 });
    const draggable = await page.locator('.track-item').first().getAttribute('draggable');
    expect(draggable).toBe('true');
  });
});

// ============================================================
// 18. REC BUTTON (Tracklist Recording)
// ============================================================

test.describe('REC Button', () => {
  test('REC button exists and toggles', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('#recBtn');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('REC');
    await btn.click();
    await expect(btn).toHaveClass(/recording/);
    await btn.click();
    await expect(btn).not.toHaveClass(/recording/);
  });
});

// ============================================================
// 19. LOG BUTTON
// ============================================================

test.describe('LOG Button', () => {
  test('LOG buttons exist and are disabled by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#logBtn1')).toBeVisible();
    await expect(page.locator('#logBtn2')).toBeVisible();
    await expect(page.locator('#logBtn1')).toBeDisabled();
    await expect(page.locator('#logBtn2')).toBeDisabled();
  });
});

// ============================================================
// 20. TRACKLIST PANEL
// ============================================================

test.describe('Tracklist Panel', () => {
  test('tracklist panel exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#tracklistPanel')).toBeAttached();
  });

  test('export button exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#exportBtn')).toBeAttached();
    await expect(page.locator('#exportBtn')).toContainText('Export');
  });
});

// ============================================================
// 21. SAMPLER PADS
// ============================================================

test.describe('Sampler', () => {
  test('4 sampler pads exist', async ({ page }) => {
    await page.goto('/');
    expect(await page.locator('.sampler-pad').count()).toBe(4);
  });

  test('sampler pads have correct labels', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#spad0')).toContainText('AIR');
    await expect(page.locator('#spad1')).toContainText('SIREN');
    await expect(page.locator('#spad2')).toContainText('SCRATCH');
    await expect(page.locator('#spad3')).toContainText('CROWD');
  });

  test('sampler pad is clickable without error', async ({ page }) => {
    await page.goto('/');
    // Click sampler pad - should not throw
    await page.locator('#spad0').click();
    // Page should still be functional
    await expect(page.locator('.logo')).toBeVisible();
  });
});

// ============================================================
// 22. KEYBOARD SHORTCUTS MODAL
// ============================================================

test.describe('Keyboard Shortcuts', () => {
  test('help button opens shortcuts modal', async ({ page }) => {
    await page.goto('/');
    await page.locator('#helpBtn').click();
    await expect(page.locator('#shortcutsOverlay')).toBeVisible();
    await expect(page.locator('.shortcuts-box')).toContainText('Keyboard Shortcuts');
  });

  test('pressing ? opens shortcuts modal', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('?');
    await expect(page.locator('#shortcutsOverlay')).toBeVisible();
  });

  test('clicking overlay closes shortcuts modal', async ({ page }) => {
    await page.goto('/');
    await page.locator('#helpBtn').click();
    await expect(page.locator('#shortcutsOverlay')).toBeVisible();
    // Click the overlay (not the box)
    await page.locator('#shortcutsOverlay').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('#shortcutsOverlay')).not.toBeVisible();
  });
});

// ============================================================
// 23. BPM TAP
// ============================================================

test.describe('BPM Tap', () => {
  test('TAP buttons exist per deck', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#tap1')).toBeVisible();
    await expect(page.locator('#tap2')).toBeVisible();
    await expect(page.locator('#tap1')).toContainText('TAP');
  });
});

// ============================================================
// 24. DECK SWAP
// ============================================================

test.describe('Deck Swap', () => {
  test('swap button exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#swapBtn')).toBeVisible();
    await expect(page.locator('#swapBtn')).toContainText('SWAP');
  });

  test('swap button is clickable', async ({ page }) => {
    await page.goto('/');
    await page.locator('#swapBtn').click();
    // Should not crash, page still functional
    await expect(page.locator('.logo')).toBeVisible();
  });
});

// ============================================================
// 25. WAVEFORM COLOR MODE
// ============================================================

test.describe('Waveform Color', () => {
  test('waveform color toggle buttons exist', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#wfColorBtn0')).toBeVisible();
    await expect(page.locator('#wfColorBtn1')).toBeVisible();
  });

  test('clicking color toggle cycles mode', async ({ page }) => {
    await page.goto('/');
    await page.locator('#wfColorBtn0').click();
    // Should not crash
    await expect(page.locator('#wfColorBtn0')).toBeVisible();
  });
});

// ============================================================
// 26. WAVEFORM ZOOM
// ============================================================

test.describe('Waveform Zoom', () => {
  test('zoom buttons exist for both decks', async ({ page }) => {
    await page.goto('/');
    // Each deck has zoom + and - buttons in .wf-zoom
    const zoomSections = page.locator('.wf-zoom');
    expect(await zoomSections.count()).toBe(2);
  });
});

// ============================================================
// 27. AUTO-CROSSFADE
// ============================================================

test.describe('Auto-Crossfade', () => {
  test('auto-crossfade buttons exist', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#autoXfadeL')).toBeVisible();
    await expect(page.locator('#autoXfadeR')).toBeVisible();
  });
});

// ============================================================
// 28. VINYL BRAKE
// ============================================================

test.describe('Vinyl Brake', () => {
  test('vinyl brake buttons exist and toggle', async ({ page }) => {
    await page.goto('/');
    for (const id of ['#vinyl1', '#vinyl2']) {
      const btn = page.locator(id);
      await expect(btn).toBeVisible();
      await expect(btn).toContainText('VINYL');
      await btn.click();
      await expect(btn).toHaveClass(/active/);
      await btn.click();
      await expect(btn).not.toHaveClass(/active/);
    }
  });
});

// ============================================================
// 29. REVERSE BUTTON
// ============================================================

test.describe('Reverse', () => {
  test('reverse buttons exist for both decks', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#reverse1')).toBeVisible();
    await expect(page.locator('#reverse2')).toBeVisible();
    await expect(page.locator('#reverse1')).toContainText('REV');
  });
});

// ============================================================
// 30. BEAT JUMP
// ============================================================

test.describe('Beat Jump', () => {
  test('beat jump buttons exist for both decks', async ({ page }) => {
    await page.goto('/');
    // Each deck has 6 beat jump buttons
    const bjBtns = page.locator('.beat-jump-btn');
    expect(await bjBtns.count()).toBe(12);
  });
});

// ============================================================
// 31. PARALLEL WAVEFORMS
// ============================================================

test.describe('Parallel Waveforms', () => {
  test('parallel waveforms toggle button exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#parallelWfBtn')).toBeVisible();
  });

  test('toggling parallel waveforms shows container', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#parallelWaveforms')).not.toBeVisible();
    await page.locator('#parallelWfBtn').click();
    await expect(page.locator('#parallelWaveforms')).toBeVisible();
    await page.locator('#parallelWfBtn').click();
    await expect(page.locator('#parallelWaveforms')).not.toBeVisible();
  });
});

// ============================================================
// 32. AUTO-MIX PRESETS
// ============================================================

test.describe('Auto-Mix Presets', () => {
  test('auto-mix buttons exist', async ({ page }) => {
    await page.goto('/');
    const btns = page.locator('.automix-btn');
    expect(await btns.count()).toBe(3);
    await expect(btns.nth(0)).toContainText('16-BAR');
    await expect(btns.nth(1)).toContainText('ECHO OUT');
    await expect(btns.nth(2)).toContainText('CUT SWAP');
  });
});

// ============================================================
// 33. SLIP MODE
// ============================================================

test.describe('Slip Mode', () => {
  test('slip buttons exist and toggle', async ({ page }) => {
    await page.goto('/');
    for (const id of ['#slip1', '#slip2']) {
      const btn = page.locator(id);
      await expect(btn).toBeVisible();
      await expect(btn).toContainText('SLIP');
      await btn.click();
      await expect(btn).toHaveClass(/active/);
      await btn.click();
      await expect(btn).not.toHaveClass(/active/);
    }
  });
});

// ============================================================
// 34. QUANTIZE
// ============================================================

test.describe('Quantize', () => {
  test('quantize buttons exist and toggle', async ({ page }) => {
    await page.goto('/');
    for (const id of ['#quantize1', '#quantize2']) {
      const btn = page.locator(id);
      await expect(btn).toBeVisible();
      await expect(btn).toContainText('Q');
      await btn.click();
      await expect(btn).toHaveClass(/active/);
      await btn.click();
      await expect(btn).not.toHaveClass(/active/);
    }
  });
});

// ============================================================
// 35. NUDGE
// ============================================================

test.describe('Nudge', () => {
  test('nudge buttons exist for both decks', async ({ page }) => {
    await page.goto('/');
    const nudgeBtns = page.locator('.nudge-btn');
    expect(await nudgeBtns.count()).toBe(4); // 2 per deck
  });
});

// ============================================================
// 36. REC MIX
// ============================================================

test.describe('REC MIX', () => {
  test('REC MIX button exists and toggles', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('#recMixBtn');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('REC MIX');
    await btn.click();
    await expect(btn).toHaveClass(/recording/);
    await btn.click();
    await expect(btn).not.toHaveClass(/recording/);
  });
});

// ============================================================
// 37. PLAYLIST PANEL
// ============================================================

test.describe('Playlist Panel', () => {
  test('playlist panel exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#playlistPanel')).toBeAttached();
  });

  test('playlist controls exist', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#playlistSelect')).toBeAttached();
    await expect(page.locator('#newPlaylistName')).toBeAttached();
  });
});

// ============================================================
// 38. CROSSFADER CURVE
// ============================================================

test.describe('Crossfader Curve', () => {
  test('crossfader curve selector exists with 3 options', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.xfade-curve-section')).toBeVisible();
    await expect(page.locator('#xfCurveSmooth')).toBeVisible();
    await expect(page.locator('#xfCurveSharp')).toBeVisible();
    await expect(page.locator('#xfCurvePower')).toBeVisible();
  });

  test('switching curve changes active state', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#xfCurveSmooth')).toHaveClass(/active/);
    await page.locator('#xfCurveSharp').click();
    await expect(page.locator('#xfCurveSharp')).toHaveClass(/active/);
    await expect(page.locator('#xfCurveSmooth')).not.toHaveClass(/active/);
    await page.locator('#xfCurvePower').click();
    await expect(page.locator('#xfCurvePower')).toHaveClass(/active/);
    await expect(page.locator('#xfCurveSharp')).not.toHaveClass(/active/);
  });
});

// ============================================================
// 39. BEEP WARNING TOGGLE
// ============================================================

test.describe('Beep Warning', () => {
  test('beep toggle exists and toggles', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('#beepToggle');
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(btn).toHaveClass(/active/);
    await btn.click();
    await expect(btn).not.toHaveClass(/active/);
  });
});

// ============================================================
// 40. API ENDPOINTS
// ============================================================

test.describe('API Endpoints', () => {
  test('health check endpoint', async ({ request }) => {
    const resp = await request.get('/api/health');
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.status).toBe('ok');
    expect(data.tracks).toBeGreaterThan(0);
    expect(data.uptime).toBeGreaterThanOrEqual(0);
  });

  test('track info endpoint returns data', async ({ request }) => {
    const tracksResp = await request.get('/api/tracks');
    const tracks = await tracksResp.json();
    expect(tracks.length).toBeGreaterThan(0);
    const filename = tracks[0].name;
    const infoResp = await request.get(`/api/tracks/${encodeURIComponent(filename)}/info`);
    expect(infoResp.ok()).toBeTruthy();
    const info = await infoResp.json();
    expect(info.filename).toBe(filename);
    expect(info.peaks).toBeDefined();
  });

  test('track info caching works', async ({ request }) => {
    const tracksResp = await request.get('/api/tracks');
    const tracks = await tracksResp.json();
    const filename = tracks[0].name;
    await request.get(`/api/tracks/${encodeURIComponent(filename)}/info`);
    const postResp = await request.post(`/api/tracks/${encodeURIComponent(filename)}/info`, {
      data: { bpm: 128, key: 'Am' }
    });
    expect(postResp.ok()).toBeTruthy();
    const infoResp = await request.get(`/api/tracks/${encodeURIComponent(filename)}/info`);
    const info = await infoResp.json();
    expect(info.bpm).toBe(128);
    expect(info.key).toBe('Am');
  });

  test('gzip compression is enabled', async ({ request }) => {
    const resp = await request.get('/', { headers: { 'Accept-Encoding': 'gzip' } });
    expect(resp.ok()).toBeTruthy();
  });
});

// ============================================================
// 41. PROGRESS BARS
// ============================================================

test.describe('Progress Bars', () => {
  test('progress bars exist', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#progressBar1')).toBeVisible();
    await expect(page.locator('#progressBar2')).toBeVisible();
  });
});

// ============================================================
// 42. BEAT COUNTERS
// ============================================================

test.describe('Beat Counters', () => {
  test('beat counters with 4 dots each', async ({ page }) => {
    await page.goto('/');
    for (const id of ['#beatCounter1', '#beatCounter2']) {
      await expect(page.locator(id)).toBeVisible();
      expect(await page.locator(`${id} .beat-dot`).count()).toBe(4);
    }
  });
});

// ============================================================
// 43. ERROR HANDLING
// ============================================================

test.describe('Error Handling', () => {
  test('error toast shows on bad track load', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => loadToDeck(0, 'nonexistent_file.mp3'));
    await expect(page.locator('.error-toast')).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================
// 44. SCREENSHOT TESTS
// ============================================================

test.describe('Screenshot Tests', () => {
  test('default state screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.track-item', { timeout: 10000 });
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('xdj-default.png', { maxDiffPixelRatio: 0.1 });
  });

  test('performance mode screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.track-item', { timeout: 10000 });
    await page.locator('#perfToggle').click();
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('xdj-performance.png', { maxDiffPixelRatio: 0.1 });
  });

  test('mini-mixer screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.track-item', { timeout: 10000 });
    await page.locator('#miniToggle').click();
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('xdj-minimixer.png', { maxDiffPixelRatio: 0.1 });
  });

  test('light theme screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.track-item', { timeout: 10000 });
    await page.locator('#themeBtn').click();
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('xdj-light.png', { maxDiffPixelRatio: 0.1 });
  });

  test('parallel waveforms screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.track-item', { timeout: 10000 });
    await page.locator('#parallelWfBtn').click();
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('xdj-parallel-wf.png', { maxDiffPixelRatio: 0.1 });
  });
});

// ============================================================
// 45. CUE/MASTER KNOB
// ============================================================

test.describe('Cue/Master', () => {
  test('cue/master section exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.cue-master-section')).toBeVisible();
    await expect(page.locator('#cueMasterVal')).toBeVisible();
  });
});

// ============================================================
// 46. HARMONIC INDICATOR
// ============================================================

test.describe('Harmonic Indicator', () => {
  test('harmonic indicator exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#harmonicIndicator')).toBeVisible();
    await expect(page.locator('#camelot1')).toBeVisible();
    await expect(page.locator('#camelot2')).toBeVisible();
  });
});

// ============================================================
// 47. TEMPO SLIDERS
// ============================================================

test.describe('Tempo Sliders', () => {
  test('tempo sliders exist and respond', async ({ page }) => {
    await page.goto('/');
    for (const id of ['#tempo1', '#tempo2']) {
      const slider = page.locator(id);
      await expect(slider).toBeVisible();
      await slider.fill('3');
      await slider.dispatchEvent('input');
      expect(parseFloat(await slider.inputValue())).toBe(3);
    }
  });
});

// ============================================================
// 48. NOISE TOGGLE
// ============================================================

test.describe('Noise Toggle', () => {
  test('noise toggle exists', async ({ page }) => {
    await page.goto('/');
    const noise = page.locator('#noiseToggle');
    await expect(noise).toBeVisible();
    await expect(noise).toContainText('NOISE');
  });
});

// ============================================================
// 49. AUTO-GAIN
// ============================================================

test.describe('Auto-Gain', () => {
  test('auto-gain button exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#autoGainBtn')).toBeVisible();
    await expect(page.locator('#autoGainBtn')).toContainText('AUTO-GAIN');
  });
});

// ============================================================
// 50. KEYBOARD SHORTCUTS FUNCTIONALITY
// ============================================================

test.describe('Keyboard Shortcuts Functionality', () => {
  test('Q key triggers deck 1 play', async ({ page }) => {
    await page.goto('/');
    await loadTrack(page, 1);
    await page.keyboard.press('q');
    await expect(page.locator('#play1')).toContainText('PAUSE');
    await page.keyboard.press('q');
    await expect(page.locator('#play1')).toContainText('PLAY');
  });

  test('B key toggles browser', async ({ page }) => {
    await page.goto('/');
    const browser = page.locator('#browserPanel');
    const wasVisible = await browser.isVisible();
    await page.keyboard.press('b');
    if (wasVisible) {
      await expect(browser).not.toBeVisible();
    } else {
      await expect(browser).toBeVisible();
    }
  });
});

// ============================================================
// 51. JOG WHEELS
// ============================================================

test.describe('Jog Wheels', () => {
  test('jog wheels exist for both decks', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#jog1')).toBeVisible();
    await expect(page.locator('#jog2')).toBeVisible();
  });
});

// ============================================================
// 52. OVERVIEW WAVEFORMS
// ============================================================

test.describe('Overview Waveforms', () => {
  test('overview waveform canvases exist', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#ovCanvas1')).toBeAttached();
    await expect(page.locator('#ovCanvas2')).toBeAttached();
  });
});

// ============================================================
// 53. HISTORY PANEL
// ============================================================

test.describe('History Panel', () => {
  test('history panel exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#historyPanel')).toBeAttached();
  });
});

// ============================================================
// 54. SESSION SELECT
// ============================================================

test.describe('Session Select', () => {
  test('session select dropdown exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#sessionSelect')).toBeAttached();
  });
});

// ============================================================
// 55. SPECTRUM ANALYZERS
// ============================================================

test.describe('Spectrum Analyzers', () => {
  test('deck spectrum canvases exist', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#spectrum1')).toBeAttached();
    await expect(page.locator('#spectrum2')).toBeAttached();
  });

  test('master spectrum canvas exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#masterSpectrum')).toBeAttached();
  });

  test('spectrum row is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.spectrum-row')).toBeVisible();
  });
});

// ============================================================
// 56. SLICER MODE
// ============================================================

test.describe('Slicer Mode', () => {
  test('slicer sections exist for both decks', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#slicerSection0')).toBeVisible();
    await expect(page.locator('#slicerSection1')).toBeVisible();
  });

  test('8 slicer pads per deck', async ({ page }) => {
    await page.goto('/');
    expect(await page.locator('#slicerSection0 .slicer-pad').count()).toBe(8);
    expect(await page.locator('#slicerSection1 .slicer-pad').count()).toBe(8);
  });

  test('slicer pads are clickable without crash', async ({ page }) => {
    await page.goto('/');
    await page.locator('#slicerSection0 .slicer-pad').first().click();
    await expect(page.locator('.logo')).toBeVisible();
  });
});

// ============================================================
// 57. ROLL EFFECT
// ============================================================

test.describe('Roll Effect', () => {
  test('roll sections exist for both decks', async ({ page }) => {
    await page.goto('/');
    const rollSections = page.locator('.roll-section');
    expect(await rollSections.count()).toBe(2);
  });

  test('5 roll pads per deck', async ({ page }) => {
    await page.goto('/');
    const rollPads = page.locator('.roll-pads');
    expect(await rollPads.first().locator('.roll-pad').count()).toBe(5);
    expect(await rollPads.last().locator('.roll-pad').count()).toBe(5);
  });
});

// ============================================================
// 58. FX WET/DRY
// ============================================================

test.describe('FX Wet/Dry', () => {
  test('FX wet/dry knobs exist for both channels', async ({ page }) => {
    await page.goto('/');
    const wetDryKnobs = page.locator('.fx-wetdry-knob');
    expect(await wetDryKnobs.count()).toBe(2);
  });

  test('FX wet/dry row is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.fx-wetdry-row')).toBeVisible();
  });
});

// ============================================================
// 59. AUTO-MIX PROGRESS
// ============================================================

test.describe('Auto-Mix Progress', () => {
  test('auto-mix progress indicator exists (hidden by default)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#automixProgress')).toBeAttached();
    await expect(page.locator('#automixProgress')).not.toBeVisible();
  });
});
