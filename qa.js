const { chromium } = require('playwright');

(async () => {
  const errors = [];
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'] });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
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

  await step('a2v: generate video', async () => {
    await page.goto(base + '#a2v');
    await page.waitForSelector('#dz input',{state:'attached'});
    await page.setInputFiles('#dz input', [T + 'short.wav']);
    await page.waitForTimeout(400);
    await page.click('#avBtn');
    await page.waitForTimeout(4200);
  });

  await step('outputs list', async () => {
    await page.goto(base + '#outputs');
    await page.waitForTimeout(300);
    const rows = await page.locator('.out-row').count();
    if (rows < 8) throw new Error('outputs rows=' + rows);
    await page.screenshot({ path: 'shot_outputs.png' });
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
