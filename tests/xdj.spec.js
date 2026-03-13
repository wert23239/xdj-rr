const { test, expect } = require('@playwright/test');

test.describe('XDJ-RR Controller', () => {

  test('page loads correctly', async ({ page }) => {
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
    expect(count).toBeLessThanOrEqual(50);
    expect(count).toBeGreaterThan(0);
    await expect(page.locator('#status')).toContainText('tracks loaded');
  });

  test('loading a track into deck 1', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.track-item', { timeout: 10000 });
    const firstTrack = page.locator('.track-item').first();
    await firstTrack.hover();
    await firstTrack.locator('.load-btn.d1').click();
    await expect(page.locator('#status')).toContainText('Loaded to Deck 1', { timeout: 30000 });
  });

  test('loading a track into deck 2', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.track-item', { timeout: 10000 });
    const firstTrack = page.locator('.track-item').first();
    await firstTrack.hover();
    await firstTrack.locator('.load-btn.d2').click();
    await expect(page.locator('#status')).toContainText('Loaded to Deck 2', { timeout: 30000 });
  });

  test('play/pause toggles work', async ({ page }) => {
    await page.goto('/');
    const playBtn = page.locator('#play1');
    await expect(playBtn).toContainText('PLAY');
    await playBtn.click();
    await expect(playBtn).toBeVisible();
  });

  test('play/pause toggles with loaded track', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.track-item', { timeout: 10000 });
    const firstTrack = page.locator('.track-item').first();
    await firstTrack.hover();
    await firstTrack.locator('.load-btn.d1').click();
    await expect(page.locator('#status')).toContainText('Loaded to Deck 1', { timeout: 30000 });
    const playBtn = page.locator('#play1');
    await playBtn.click();
    await expect(playBtn).toContainText('PAUSE');
    await playBtn.click();
    await expect(playBtn).toContainText('PLAY');
  });

  test('crossfader moves', async ({ page }) => {
    await page.goto('/');
    const crossfader = page.locator('#crossfader');
    await expect(crossfader).toBeVisible();
    await crossfader.fill('0.2');
    await crossfader.dispatchEvent('input');
    const newVal = await crossfader.inputValue();
    expect(parseFloat(newVal)).toBe(0.2);
  });

  test('volume faders work', async ({ page }) => {
    await page.goto('/');
    const vol1 = page.locator('#vol1');
    const vol2 = page.locator('#vol2');
    await expect(vol1).toBeVisible();
    await expect(vol2).toBeVisible();
    await vol1.fill('0.5');
    await vol1.dispatchEvent('input');
    expect(parseFloat(await vol1.inputValue())).toBe(0.5);
  });

  test('master volume exists and works', async ({ page }) => {
    await page.goto('/');
    const master = page.locator('#masterVol');
    await expect(master).toBeVisible();
    await master.fill('0.7');
    await master.dispatchEvent('input');
    await expect(page.locator('#masterVal')).toContainText('70%');
  });

  test('hot cue buttons exist', async ({ page }) => {
    await page.goto('/');
    const hotcues = page.locator('.hotcue-btn');
    expect(await hotcues.count()).toBe(8);
  });

  test('loop buttons exist', async ({ page }) => {
    await page.goto('/');
    const loops = page.locator('.loop-btn');
    expect(await loops.count()).toBe(10);
  });

  test('headphone cue buttons exist and toggle', async ({ page }) => {
    await page.goto('/');
    const hp1 = page.locator('#headphone1');
    await expect(hp1).toBeVisible();
    await expect(hp1).not.toHaveClass(/active/);
    await hp1.click();
    await expect(hp1).toHaveClass(/active/);
    await hp1.click();
    await expect(hp1).not.toHaveClass(/active/);
  });

  test('progress bars exist', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#progressBar1')).toBeVisible();
    await expect(page.locator('#progressBar2')).toBeVisible();
  });

  // V7 tests

  test('theme toggle works', async ({ page }) => {
    await page.goto('/');
    const themeBtn = page.locator('#themeBtn');
    await expect(themeBtn).toBeVisible();
    await themeBtn.click();
    await expect(page.locator('body')).toHaveClass(/light-theme/);
    await themeBtn.click();
    await expect(page.locator('body')).not.toHaveClass(/light-theme/);
  });

  test('sort controls exist', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.sort-controls')).toBeVisible();
    const sortBtns = page.locator('.sort-btn');
    expect(await sortBtns.count()).toBe(3);
  });

  test('sort by name works', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.track-item', { timeout: 10000 });
    await page.locator('.sort-btn[data-sort="name"]').click();
    await expect(page.locator('.sort-btn[data-sort="name"]')).toHaveClass(/active/);
  });

  test('beat counter exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#beatCounter1')).toBeVisible();
    await expect(page.locator('#beatCounter2')).toBeVisible();
    expect(await page.locator('#beatCounter1 .beat-dot').count()).toBe(4);
    expect(await page.locator('#beatCounter2 .beat-dot').count()).toBe(4);
  });

  test('tracks are draggable', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.track-item', { timeout: 10000 });
    const firstTrack = page.locator('.track-item').first();
    const draggable = await firstTrack.getAttribute('draggable');
    expect(draggable).toBe('true');
  });

  test('error toast shows on bad track load', async ({ page }) => {
    await page.goto('/');
    // Try loading a nonexistent track
    await page.evaluate(() => loadToDeck(0, 'nonexistent_file.mp3'));
    await expect(page.locator('.error-toast')).toBeVisible({ timeout: 5000 });
  });

  // V10 tests

  test('TAP buttons exist per deck', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#tap1')).toBeVisible();
    await expect(page.locator('#tap2')).toBeVisible();
    await expect(page.locator('#tap1')).toContainText('TAP');
  });

  test('crossfader curve selector exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.xfade-curve-section')).toBeVisible();
    await expect(page.locator('#xfCurveSmooth')).toHaveClass(/active/);
    await page.locator('#xfCurveSharp').click();
    await expect(page.locator('#xfCurveSharp')).toHaveClass(/active/);
    await expect(page.locator('#xfCurveSmooth')).not.toHaveClass(/active/);
  });

  test('cue/master mix knob exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.cue-master-section')).toBeVisible();
    await expect(page.locator('#cueMasterVal')).toBeVisible();
  });

  test('mini-mixer toggle works', async ({ page }) => {
    await page.goto('/');
    const miniBtn = page.locator('#miniToggle');
    await expect(miniBtn).toBeVisible();
    await miniBtn.click();
    await expect(page.locator('body')).toHaveClass(/mini-mixer/);
    await miniBtn.click();
    await expect(page.locator('body')).not.toHaveClass(/mini-mixer/);
  });

  test('swap button exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#swapBtn')).toBeVisible();
  });

  test('beep warning toggle exists', async ({ page }) => {
    await page.goto('/');
    const beepBtn = page.locator('#beepToggle');
    await expect(beepBtn).toBeVisible();
    await beepBtn.click();
    await expect(beepBtn).toHaveClass(/active/);
    await beepBtn.click();
    await expect(beepBtn).not.toHaveClass(/active/);
  });

  test('screenshot comparison', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.track-item', { timeout: 10000 });
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('xdj-main.png', { maxDiffPixelRatio: 0.1 });
  });

});
