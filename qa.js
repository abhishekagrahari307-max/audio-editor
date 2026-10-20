const { chromium } = require('playwright');

(async () => {
  const errors = [];
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'] });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { window.__QA = true; });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  const base = 'http://127.0.0.1:8080/';
  const T = require('path').join(__dirname, 'test') + '/';
  const downloads = [];
  page.on('download', d => downloads.push(d.suggestedFilename()));
  const step = async (name, fn) => {
    try { await fn(); console.log('PASS', name); }
    catch (e) { console.log('FAIL', name, '->', e.message.split('\n')[0]); }
  };

  await page.goto(base + '#home', { waitUntil: 'load' });
  await step('home renders', async () => {
    const cards = await page.locator('.tool').count();
    if (cards < 12) throw new Error('only ' + cards + ' tool cards');
    await page.screenshot({ path: 'shot_home.png', fullPage: true });
  });

  await step('studio: full feature pass', async () => {
    await page.click('.hero-cta [data-go="studio"]');
    await page.waitForSelector('#stFile',{state:'attached'});
    await page.setInputFiles('#stFile', [T + 'a.wav', T + 'b.wav']);
    await page.waitForTimeout(500);
    if (!(await page.locator('#tl').isVisible())) throw new Error('timeline not visible');
    const box = await page.locator('#tl').boundingBox();
    // select clip (lane 0, x=margin+ ~1s)
    await page.mouse.click(box.x + 132 + 60, box.y + 78);
    // SPLIT
    await page.mouse.click(box.x + 132 + box.width * 0.12, box.y + 10);
    await page.click('#stSplit');
    await page.waitForTimeout(150);
    // UNDO split
    await page.click('#stUndo');
    await page.waitForTimeout(150);
    // REDO split
    await page.click('#stRedo');
    await page.waitForTimeout(150);
    // MUTE track 1 via margin button (M at x=14..40 center 27, lane0 y ~ RULER+22..48 center 35 -> y=30+35=65)
    await page.mouse.click(box.x + 27, box.y + 65);
    await page.waitForTimeout(150);
    // SOLO track 2 (x=48..74 center 61, lane1 y=30+78+35=143)
    await page.mouse.click(box.x + 61, box.y + 143);
    await page.waitForTimeout(150);
    await page.screenshot({ path: 'shot_studio.png' });
    // SPEED popover
    await page.mouse.click(box.x + 132 + 60, box.y + 78); // select clip again (track1 clip)
    await page.click('#stSpeed');
    await page.waitForSelector('#popR');
    await page.fill('#popR', '1.5');
    await page.dispatchEvent('#popR', 'input');
    await page.dispatchEvent('#popR', 'change');
    await page.waitForTimeout(200);
    // REVERSE
    await page.click('#stRev');
    await page.waitForTimeout(150);
    // AI CLEAN (small clip, fast)
    await page.click('#stClean');
    await page.waitForTimeout(4000);
    // VOLUME dB
    await page.click('#stVol');
    await page.waitForSelector('#popR');
    await page.fill('#popR', '3');
    await page.dispatchEvent('#popR', 'input');
    await page.dispatchEvent('#popR', 'change');
    await page.waitForTimeout(100);
    await page.keyboard.press('Escape');
    // FADe with curve
    await page.click('#stFi');
    await page.waitForSelector('#popR');
    await page.fill('#popR', '1');
    await page.dispatchEvent('#popR', 'input');
    await page.click('#stPop [data-fc="exp"]');
    await page.waitForTimeout(100);
    await page.keyboard.press('Escape');
    // TIME JUMP
    await page.click('#stTime');
    await page.waitForSelector('#jumpInp');
    await page.fill('#jumpInp', '0:1');
    await page.press('#jumpInp', 'Enter');
    await page.waitForTimeout(150);
    const timeText = await page.textContent('#stTime');
    if (!/00:01/.test(timeText)) throw new Error('time jump failed: ' + timeText);
    // PLAY briefly
    await page.click('#stPlayBtn');
    await page.waitForTimeout(900);
    // EXPORT MP3 320
    await page.click('#stSave');
    await page.waitForSelector('#exGo');
    await page.click('#exMp3b');
    await page.click('#exGo');
    await page.waitForTimeout(3000);
  });

  await step('trim: load + export mp3', async () => {
    await page.goto(base + '#trim');
    await page.waitForSelector('#dz input',{state:'attached'});
    await page.setInputFiles('#dz input', [T + 'a.wav']);
    await page.waitForTimeout(500);
    await page.click('#exM');
    await page.waitForTimeout(1800);
  });

  await step('merge: two files + export', async () => {
    await page.goto(base + '#merge');
    await page.waitForSelector('#dz input',{state:'attached'});
    await page.setInputFiles('#dz input', [T + 'a.wav', T + 'b.wav']);
    await page.waitForTimeout(600);
    const rows = await page.locator('.file-row').count();
    if (rows !== 2) throw new Error('rows=' + rows);
    await page.click('#exM');
    await page.waitForTimeout(1800);
  });

  await step('mix: two tracks + export', async () => {
    await page.goto(base + '#mix');
    await page.waitForSelector('#dropA input',{state:'attached'});
    await page.setInputFiles('#dropA input', [T + 'a.wav']);
    await page.waitForTimeout(300);
    await page.setInputFiles('#dropB input', [T + 'b.wav']);
    await page.waitForTimeout(300);
    if (await page.locator('#mixP').isHidden()) throw new Error('mix panel hidden');
    await page.click('#exM');
    await page.waitForTimeout(1800);
  });

  await step('split: add cut + export segment', async () => {
    await page.goto(base + '#split');
    await page.waitForSelector('#dz input',{state:'attached'});
    await page.setInputFiles('#dz input', [T + 'a.wav']);
    await page.waitForTimeout(500);
    const wb = await page.locator('#wc').boundingBox();
    await page.mouse.click(wb.x + wb.width * 0.3, wb.y + 50);
    await page.waitForTimeout(200);
    const segs = await page.locator('#segs .file-row').count();
    if (segs !== 2) throw new Error('segments=' + segs);
    await page.click('[data-sw="0"]');
    await page.waitForTimeout(1000);
  });

  await step('insert: splice + export', async () => {
    await page.goto(base + '#insert');
    await page.waitForSelector('#dzb input',{state:'attached'});
    await page.setInputFiles('#dzb input', [T + 'a.wav']);
    await page.waitForTimeout(300);
    await page.setInputFiles('#dzi input', [T + 'b.wav']);
    await page.waitForTimeout(300);
    if (await page.locator('#work').isHidden()) throw new Error('insert work hidden');
    await page.click('#exM');
    await page.waitForTimeout(1800);
  });

  await step('boost: process + export', async () => {
    await page.goto(base + '#boost');
    await page.waitForSelector('#dz input',{state:'attached'});
    await page.setInputFiles('#dz input', [T + 'a.wav']);
    await page.waitForTimeout(900);
    await page.click('#exM');
    await page.waitForTimeout(1800);
  });

  await step('ringtone: export', async () => {
    await page.goto(base + '#ringtone');
    await page.waitForSelector('#dz input',{state:'attached'});
    await page.setInputFiles('#dz input', [T + 'long.wav']);
    await page.waitForTimeout(700);
    await page.click('#exM');
    await page.waitForTimeout(1800);
  });

  await step('v2a: load + export', async () => {
    await page.goto(base + '#v2a');
    await page.waitForSelector('#dz input',{state:'attached'});
    await page.setInputFiles('#dz input', [T + 'a.wav']);
    await page.waitForTimeout(500);
    await page.click('#exM');
    await page.waitForTimeout(1800);
  });

  await step('denoise: run + export', async () => {
    await page.goto(base + '#denoise');
    await page.waitForSelector('#dz input',{state:'attached'});
    await page.setInputFiles('#dz input', [T + 'noisy.wav']);
    await page.waitForTimeout(500);
    await page.click('#run');
    await page.waitForTimeout(5000);
    await page.click('#exM');
    await page.waitForTimeout(1800);
  });

  await step('voice: real DSP effects + export', async () => {
    await page.goto(base + '#voice');
    await page.waitForSelector('#dz input', { state: 'attached' });
    await page.setInputFiles('#dz input', [T + 'a.wav']);
    await page.waitForTimeout(500);
    if (!(await page.locator('#work').isVisible())) throw new Error('work panel not shown');
    await page.click('#fxRow [data-fx="robot"]');
    await page.waitForTimeout(1200);
    await page.click('#exM');
    await page.waitForTimeout(800);
    if (!downloads.some(d => d.includes('robot'))) throw new Error('robot mp3 not downloaded');
  });

  await step('rec: mic record + export', async () => {
    await page.goto(base + '#rec');
    await page.waitForTimeout(700);
    await page.locator('#recBtn').click({ timeout: 5000 });
    await page.waitForTimeout(1400);
    if (!(await page.evaluate(() => document.getElementById('ring').classList.contains('rec')))) throw new Error('recording did not start');
    await page.locator('#recBtn').click({ force: true, timeout: 5000 }); // button pulses while recording
    await page.waitForTimeout(1600);
    if (!(await page.locator('#work').isVisible())) throw new Error('recording panel not shown');
    await page.click('#exM');
    await page.waitForTimeout(900);
    if (!downloads.some(d => d.startsWith('voice-note'))) throw new Error('voice-note mp3 not downloaded');
  });

  await step('comp: real compressor + export', async () => {
    await page.goto(base + '#comp');
    await page.waitForSelector('#dz input', { state: 'attached' });
    await page.setInputFiles('#dz input', [T + 'a.wav']);
    await page.waitForTimeout(500);
    await page.click('#run');
    await page.waitForTimeout(1600);
    const stats = await page.locator('#statChip').textContent().catch(() => '');
    if (!/dB/.test(stats)) throw new Error('no compression stats: ' + stats);
    await page.click('#exM');
    await page.waitForTimeout(900);
    if (!downloads.some(d => d.includes('compressed'))) throw new Error('compressed mp3 not downloaded');
  });

  await step('a2v: generate video', async () => {
    await page.goto(base + '#a2v');
    await page.waitForSelector('#dz input',{state:'attached'});
    await page.setInputFiles('#dz input', [T + 'short.wav']);
    await page.waitForTimeout(400);
    await page.click('#avBtn');
    await page.waitForTimeout(4200);
  });

  await step('outputs: list + zip-all + delete', async () => {
    await page.goto(base + '#outputs');
    await page.waitForTimeout(300);
    const rows = await page.locator('.out-row').count();
    if (rows < 10) throw new Error('outputs rows=' + rows);
    // download-all zip
    await page.click('#outZip');
    await page.waitForTimeout(1500);
    if (!downloads.some(d => d.endsWith('.zip'))) throw new Error('zip download missing');
    // per-row delete
    await page.click('[data-del="0"]');
    await page.waitForTimeout(300);
    const after = await page.locator('.out-row').count();
    if (after !== rows - 1) throw new Error('delete failed: ' + rows + ' -> ' + after);
    await page.screenshot({ path: 'shot_outputs.png' });
  });

  await step('fx: 2-effect chain + export', async () => {
    await page.goto(base + '#fx');
    await page.waitForSelector('#dz input', { state: 'attached' });
    await page.setInputFiles('#dz input', [T + 'a.wav']);
    await page.waitForTimeout(500);
    if (!(await page.locator('#work').isVisible())) throw new Error('fx work panel not shown');
    // enable EQ + bass boost
    await page.click('[data-sw="eq"]');
    await page.click('[data-sw="bass"]');
    await page.waitForTimeout(150);
    const rows = await page.locator('.fx-eff.on').count();
    if (rows !== 2) throw new Error('enabled fx rows=' + rows);
    // tweak EQ band 2 (+6 dB) and bass (+10)
    const eqSlider = page.locator('#chain [data-b="2"]');
    await eqSlider.evaluate(el => { el.value = 6; el.dispatchEvent(new Event('input', { bubbles: true })); });
    const bassSlider = page.locator('#chain [data-k="amt"]');
    await bassSlider.evaluate(el => { el.value = 10; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click('#run');
    await page.waitForTimeout(2500);
    const proc = await page.evaluate(() => (window.__fxProc || {}).duration || 0);
    if (proc < 3.5) throw new Error('fx render duration=' + proc);
    await page.screenshot({ path: 'shot_fx.png' });
    await page.click('#exM');
    await page.waitForTimeout(1500);
    if (!downloads.some(d => d.includes('-fx'))) throw new Error('fx mp3 not downloaded');
  });

  await step('batch: two files -> zip', async () => {
    await page.goto(base + '#batch');
    await page.waitForSelector('#dz input', { state: 'attached' });
    await page.setInputFiles('#dz input', [T + 'a.wav', T + 'b.wav']);
    await page.waitForTimeout(600);
    const rows = await page.locator('.batch-row').count();
    if (rows !== 2) throw new Error('batch rows=' + rows);
    // use WAV format (fast, no encoder)
    await page.click('.batch-fmt [data-f="wav"]');
    const n0 = downloads.length;
    await page.click('#go');
    await page.waitForTimeout(3500);
    if (!downloads.slice(n0).some(d => d.startsWith('audio-batch') && d.endsWith('.zip'))) throw new Error('batch zip not downloaded');
    const status = await page.textContent('#bst0').catch(() => '');
    if (!/KB|MB|B/.test(status) && !/failed/.test(status)) throw new Error('batch status=' + status);
    await page.screenshot({ path: 'shot_batch.png' });
  });

  await step('viz: load + play + meters', async () => {
    await page.goto(base + '#viz');
    await page.waitForSelector('#dz input', { state: 'attached' });
    await page.setInputFiles('#dz input', [T + 'a.wav']);
    await page.waitForTimeout(500);
    if (!(await page.locator('#work').isVisible())) throw new Error('viz work panel not shown');
    await page.click('#pp');
    await page.waitForTimeout(900);
    const vu = await page.textContent('#vu');
    const pk = await page.textContent('#pk');
    if (vu === '-∞ dB') throw new Error('RMS meter dead: ' + vu);
    if (pk === '-∞ dB') throw new Error('peak meter dead: ' + pk);
    const cl = await page.textContent('#cl');
    if (!/clean|hot|CLIP/.test(cl)) throw new Error('clip flag=' + cl);
    await page.screenshot({ path: 'shot_viz.png' });
    await page.click('#pp'); // stop
    await page.waitForTimeout(200);
  });

  await step('projects: save -> reload -> load -> delete', async () => {
    await page.goto(base + '#studio');
    await page.waitForSelector('#stFile', { state: 'attached' });
    // clear any studio state left from earlier steps
    await page.evaluate(() => { st.tracks.length = 0; st.buffers = {}; st.sel = null; st.playhead = 0; stDirty(); });
    await page.setInputFiles('#stFile', [T + 'a.wav', T + 'b.wav']);
    await page.waitForTimeout(400);
    await page.click('#stProj');
    await page.waitForSelector('#prjList');
    await page.fill('#prjName', 'QA session');
    await page.click('#prjSave');
    await page.waitForTimeout(600);
    const saved = await page.locator('#prjList [data-pl]').count();
    if (saved < 1) throw new Error('project not saved');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    // reload the page — IndexedDB must persist
    await page.reload({ waitUntil: 'load' });
    await page.goto(base + '#studio');
    await page.waitForSelector('#stProj');
    await page.click('#stProj');
    await page.waitForSelector('#prjList [data-pl]');
    await page.click('#prjList [data-pl]');
    await page.waitForTimeout(500);
    const tracks = await page.evaluate(() => st.tracks.length);
    if (tracks !== 2) throw new Error('loaded tracks=' + tracks);
    // delete it
    await page.click('#stProj');
    await page.waitForSelector('#prjList [data-pd]');
    await page.click('#prjList [data-pd]');
    await page.waitForTimeout(400);
    const left = await page.locator('#prjList [data-pl]').count();
    if (left !== 0) throw new Error('project delete failed: ' + left);
    await page.keyboard.press('Escape');
  });

  await step('theme: light/dark toggle + persist', async () => {
    await page.goto(base + '#home');
    await page.waitForTimeout(250);
    await page.click('#themeBtn');
    await page.waitForTimeout(200);
    const light = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    if (light !== 'light') throw new Error('light theme not applied: ' + light);
    await page.screenshot({ path: 'shot_light.png', fullPage: true });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);
    const kept = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    if (kept !== 'light') throw new Error('theme not persisted after reload: ' + kept);
    await page.click('#themeBtn');
    await page.waitForTimeout(150);
    const dark = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    if (dark === 'light') throw new Error('switch back to dark failed');
  });

  await step('shortcuts: zoom / Delete / Home / End', async () => {
    await page.goto(base + '#studio');
    await page.waitForSelector('#stFile', { state: 'attached' });
    await page.setInputFiles('#stFile', [T + 'a.wav']);
    await page.waitForTimeout(400);
    if (!(await page.locator('#tl').isVisible())) throw new Error('timeline not visible');
    // drop focus from any leftover button/input (e.g. themeBtn) — app correctly ignores shortcuts while a control is focused
    await page.click('.studio-title');
    await page.evaluate(() => { const a = document.activeElement; if (a && a.tagName !== 'BODY') a.blur(); });
    const p0 = await page.evaluate(() => st.p);
    await page.keyboard.press('-');
    await page.waitForTimeout(150);
    const p1 = await page.evaluate(() => st.p);
    if (Math.abs(p1 - p0 / 1.45) > 0.01) throw new Error('zoom out failed: ' + p0 + '->' + p1);
    await page.keyboard.press('+');
    await page.waitForTimeout(150);
    const p2 = await page.evaluate(() => st.p);
    if (Math.abs(p2 - p0) > 0.01) throw new Error('zoom back failed: ' + p2);
    // select clip, press Delete
    const box = await page.locator('#tl').boundingBox();
    await page.mouse.click(box.x + 132 + 60, box.y + 78);
    await page.waitForTimeout(150);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(200);
    const clips = await page.evaluate(() => st.tracks.reduce((n, t) => n + t.clips.length, 0));
    if (clips !== 0) throw new Error('delete shortcut failed: clips=' + clips);
    // re-add file, Home/End
    await page.setInputFiles('#stFile', [T + 'a.wav']);
    await page.waitForTimeout(400);
    await page.keyboard.press('End');
    await page.waitForTimeout(150);
    const e1 = await page.evaluate(() => ({ ph: st.playhead, tot: stTotal() }));
    if (e1.tot > 0 && Math.abs(e1.ph - e1.tot) > 0.01) throw new Error('End failed: ' + JSON.stringify(e1));
    await page.keyboard.press('Home');
    await page.waitForTimeout(150);
    const ph0 = await page.evaluate(() => st.playhead);
    if (ph0 !== 0) throw new Error('Home failed: ' + ph0);
  });

  await step('mobile touch: pan + auto-follow', async () => {
    const tctx = await browser.newContext({
      acceptDownloads: true, viewport: { width: 390, height: 844 },
      hasTouch: true, isMobile: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
    });
    await tctx.addInitScript(() => { window.__QA = true; });
    const tp = await tctx.newPage();
    tp.on('pageerror', e => errors.push('pageerror(touch): ' + e.message));
    await tp.goto(base + '#studio');
    await tp.waitForSelector('#stFile', { state: 'attached' });
    // a.wav=4s (lane0), b.wav=3s (lane1) -> lane1 has an empty tail (pan grab zone)
    await tp.setInputFiles('#stFile', [T + 'a.wav', T + 'b.wav']);
    await tp.waitForTimeout(500);
    const box = await tp.locator('#tl').boundingBox();
    const scrollEl = '#studio-scroll';
    // touch-action must be none for unified pointer dragging
    const ta = await tp.locator(scrollEl).evaluate(el => getComputedStyle(el).touchAction);
    if (ta !== 'none') throw new Error('touch-action=' + ta + ' (expected none)');
    // Pick a zoom (p) where: lane1 empty tail is visible at scrollLeft=0 AND content overflows viewport
    const geo = await tp.evaluate(() => {
      const wrap = document.getElementById('studio-scroll');
      const cw = wrap.clientWidth;
      for (let p = 90; p >= 48; p -= 4) {
        const grabX = MARGIN + 3 * p + 14;      // 14px past clip-b end (clears 9px trim zone)
        const scrollable = MARGIN + 4 * p - cw; // canvas(a=4s) - viewport
        if (grabX < cw - 10 && scrollable >= 10) { st.p = p; stDirty(); return { p, grabX, cw, scrollable, M: MARGIN }; }
      }
      throw new Error('no suitable zoom for pan test (cw=' + cw + ')');
    });
    await tp.waitForTimeout(200);
    // 2-FINGER PINCH-PAN (synthetic touch pointers; coords in SCREEN space like real fingers,
    // because the canvas rect shifts as scrollLeft changes under the app's live-rect math)
    const pinch = await tp.evaluate(() => {
      const cv = document.getElementById('tl');
      const r0 = cv.getBoundingClientRect();
      const wrap = document.getElementById('studio-scroll');
      const s7 = r0.left + 160, s8 = r0.left + 240, sy = r0.top + 60;
      const mk = (type, cx, id) => cv.dispatchEvent(new PointerEvent(type, {
        pointerId: id, clientX: cx, clientY: sy,
        pointerType: 'touch', bubbles: true, cancelable: true,
      }));
      mk('pointerdown', s7, 7); mk('pointerdown', s8, 8);
      for (let i = 1; i <= 6; i++) { mk('pointermove', s7 - i * 10, 7); mk('pointermove', s8 - i * 10, 8); }
      mk('pointerup', s7 - 60, 7); mk('pointerup', s8 - 60, 8);
      return wrap.scrollLeft;
    });
    if (pinch < 5) throw new Error('2-finger pan did not scroll (scrollLeft=' + pinch + ')');
    // 1-FINGER PAN on empty lane tail (lane1, x past clip-b end)
    await tp.locator(scrollEl).evaluate(el => el.scrollLeft = 0);
    await tp.waitForTimeout(100);
    const before = await tp.locator(scrollEl).evaluate(el => el.scrollLeft);
    await tp.mouse.move(box.x + geo.grabX, box.y + 147);
    await tp.mouse.down();
    for (let i = 1; i <= 6; i++) await tp.mouse.move(box.x + geo.grabX - i * 2, box.y + 147);
    await tp.mouse.up();
    await tp.waitForTimeout(150);
    const after = await tp.locator(scrollEl).evaluate(el => el.scrollLeft);
    if (after - before < 5) throw new Error('1-finger pan did not scroll (before=' + before + ' after=' + after + ')');
    // AUTO-FOLLOW: play from 0; playhead must keep timeline scrolling at right edge
    await tp.locator(scrollEl).evaluate(el => el.scrollLeft = 0);
    await tp.click('#stPlayBtn');
    const followWait = Math.min(Math.round((geo.cw - 80 - geo.M) / geo.p * 1000) + 400, 3900);
    await tp.waitForTimeout(followWait);
    const mid = await tp.locator(scrollEl).evaluate(el => el.scrollLeft);
    await tp.click('#stPlayBtn'); // pause
    if (mid < 1) throw new Error('playhead auto-follow did not scroll (scrollLeft=' + mid + ')');
    await tctx.close();
  });

  await step('mobile views', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + '#home');
    await page.waitForTimeout(400);
    const nav = await page.locator('.bnav').isVisible();
    if (!nav) throw new Error('bottom nav not visible');
    await page.screenshot({ path: 'shot_home_mobile.png', fullPage: true });
    await page.goto(base + '#studio');
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'shot_studio_mobile.png' });
  });

  console.log('\nDOWNLOADS (' + downloads.length + '):');
  downloads.forEach(d => console.log('  -', d));
  console.log('\nERRORS:', errors.length ? '\n' + errors.join('\n') : 'none');
  await browser.close();
  process.exit(errors.length ? 2 : 0);
})().catch(e => { console.error('QA CRASH', e); process.exit(1); });
