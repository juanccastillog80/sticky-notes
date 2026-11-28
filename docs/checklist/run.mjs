// Runs docs/cross-browser-checklist.md against the live app with Playwright, and
// prints one PASS, FAIL or SKIP line per row. It drives the real app through the
// mouse and keyboard, the way a person would, and reads the result off the DOM.
//
//   node docs/checklist/run.mjs chrome    # the installed Google Chrome
//   node docs/checklist/run.mjs firefox   # Playwright's Firefox
//   node docs/checklist/run.mjs msedge    # the installed Microsoft Edge
//
// Screenshots for the rows judged by eye, and a JSON of the results, go to
// `docs/checklist/out/` (git-ignored) or the folder given as the second argument.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, firefox } from 'playwright';

const which = process.argv[2] ?? 'chrome';
const OUT = process.argv[3] ?? new URL('out', import.meta.url).pathname;
const APP_URL = 'https://juanccastillog80.github.io/sticky-notes/';
const KEY = 'sticky-notes:local-copy';
const SMALL = { width: 1024, height: 768 };
const LARGE = { width: 1920, height: 1080 };
mkdirSync(OUT, { recursive: true });

const browser =
  which === 'firefox' ? await firefox.launch() : await chromium.launch({ channel: which });
const version = browser.version();
const mod = 'ControlOrMeta';

let n = 0;
function note(o = {}) {
  n += 1;
  return {
    id: `n${n}`,
    x: 100,
    y: 100,
    width: 220,
    height: 170,
    text: '',
    colour: 'yellow',
    z: n,
    ...o,
  };
}

async function open(notes = [], viewport = SMALL) {
  const context = await browser.newContext({ viewport });
  if (notes.length)
    await context.addInitScript(
      ([k, v]) => {
        if (!sessionStorage.getItem('seeded')) {
          localStorage.setItem(k, v);
          sessionStorage.setItem('seeded', '1');
        }
      },
      [KEY, JSON.stringify({ v: 1, notes })],
    );
  const page = await context.newPage();
  await page.goto(APP_URL);
  await page.waitForSelector('section[aria-label=Board]');
  await page.waitForTimeout(300);
  const board = page.locator('section[aria-label=Board]');
  const notesL = page.locator('article[aria-label=Note]');
  const h = {
    page,
    board,
    notes: notesL,
    async origin() {
      const b = await board.boundingBox();
      return { x: b.x, y: b.y };
    },
    async at(x, y) {
      const o = await h.origin();
      return { x: o.x + x, y: o.y + y };
    },
    /** Stored rect, from the article's inline style. */
    async stored(i = 0) {
      return notesL.nth(i).evaluate((el) => ({
        x: parseFloat(el.style.left),
        y: parseFloat(el.style.top),
        width: parseFloat(el.style.width),
        height: parseFloat(el.style.height),
        z: Number(el.style.zIndex),
      }));
    },
    /** On-screen rect in Board coordinates. */
    async shown(i = 0) {
      const o = await h.origin();
      const b = await notesL.nth(i).boundingBox();
      return { x: b.x - o.x, y: b.y - o.y, width: b.width, height: b.height };
    },
    scroller() {
      return board.evaluate((el) => {
        const s = el.parentElement;
        return {
          sw: s.scrollWidth,
          cw: s.clientWidth,
          sh: s.scrollHeight,
          ch: s.clientHeight,
          ow: s.offsetWidth,
          oh: s.offsetHeight,
          top: s.scrollTop,
          left: s.scrollLeft,
          bw: el.offsetWidth,
          bh: el.offsetHeight,
        };
      });
    },
    async drag(from, by, { steps = 8, beforeUp } = {}) {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      // Kept inside the window: Playwright's Firefox reports a pointer outside it as (0, -85).
      const vp = page.viewportSize();
      const to = {
        x: Math.min(Math.max(from.x + by.x, 1), vp.width - 2),
        y: Math.min(Math.max(from.y + by.y, 1), vp.height - 2),
      };
      await page.mouse.move(to.x, to.y, { steps });
      if (beforeUp) await beforeUp();
      await page.mouse.up();
      await page.waitForTimeout(50);
    },
    async bodyPoint(i = 0) {
      // Middle of the Note, below the strip: the text area.
      const b = await notesL.nth(i).boundingBox();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    },
    async stripPoint(i = 0) {
      const b = await notesL.nth(i).locator('[data-grip-strip]').boundingBox();
      return { x: b.x + b.width / 3, y: b.y + b.height / 2 };
    },
    async handlePoint(handle, i = 0) {
      const b = await notesL.nth(i).locator(`[data-handle="${handle}"]`).boundingBox();
      // The × covers most of the ne corner: only its outer 2 px stay a handle.
      if (handle === 'ne') return { x: b.x + b.width - 2, y: b.y + 2 };
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    },
    shot(name) {
      return page.screenshot({ path: `${OUT}/${which}-${name}.png` });
    },
    close() {
      return context.close();
    },
  };
  return h;
}

const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
const results = [];
async function row(id, name, fn) {
  let ok = false,
    detail = '';
  try {
    const r = await fn();
    ok = r === true || r?.ok === true;
    detail = typeof r === 'object' && r ? (r.detail ?? JSON.stringify(r)) : '';
  } catch (e) {
    detail = `error: ${e.message.split('\n')[0]}`;
  }
  if (detail.startsWith('not checked')) ok = null;
  results.push({ id, name, ok, detail });
  console.log(
    `${ok === null ? 'SKIP' : ok ? 'PASS' : 'FAIL'} ${id} ${name}${detail ? ' — ' + detail : ''}`,
  );
}

await row('1,4', 'Board edges clear; backdrop strip right and bottom', async () => {
  const h = await open([note({ x: 200, y: 150, text: 'Board edges' })]);
  const s = await h.scroller();
  await h.shot('board-edges');
  await h.close();
  return {
    ok: s.bw < s.cw && s.bh < s.ch,
    detail: `board ${s.bw}×${s.bh} in scroller ${s.cw}×${s.ch} (screenshot)`,
  };
});

await row('2', 'Empty Board: no scrollbars at 1024×768 or large', async () => {
  const out = [];
  for (const vp of [SMALL, LARGE]) {
    const h = await open([], vp);
    const s = await h.scroller();
    await h.close();
    out.push(s.sw <= s.cw && s.sh <= s.ch && s.ow === s.cw && s.oh === s.ch);
  }
  return { ok: out.every(Boolean), detail: `1024×768 ${out[0]}, 1920×1080 ${out[1]}` };
});

await row('2', 'Growing the window grows the Board at once', async () => {
  const h = await open([], SMALL);
  const a = await h.scroller();
  await h.page.setViewportSize(LARGE);
  await h.page.waitForTimeout(100);
  const b = await h.scroller();
  await h.close();
  return {
    ok: b.bw > a.bw && b.bh > a.bh && b.sw <= b.cw && b.sh <= b.ch,
    detail: `${a.bw}×${a.bh} → ${b.bw}×${b.bh}`,
  };
});

await row('3', 'Shrinking the window never moves a Note; the Board scrolls to it', async () => {
  const h = await open([note({ x: 1500, y: 750 })], LARGE);
  await h.page.setViewportSize(SMALL);
  await h.page.waitForTimeout(100);
  const st = await h.stored();
  const s = await h.scroller();
  await h.board.evaluate((el) => el.parentElement.scrollTo(99999, 99999));
  await h.page.waitForTimeout(50);
  const visible = await h.notes.first().isVisible();
  await h.close();
  return {
    ok: st.x === 1500 && st.y === 750 && s.sw > s.cw && s.sh > s.ch && visible,
    detail: `stored ${st.x},${st.y}; scroll ${s.sw}>${s.cw}`,
  };
});

await row('3', 'With Notes past the window, the Board scrolls; the toolbar stays put', async () => {
  const h = await open([note({ x: 1500, y: 900 })], SMALL);
  const bar = h.page.locator('header');
  const before = await bar.boundingBox();
  await h.board.evaluate((el) => el.parentElement.scrollTo(400, 300));
  await h.page.waitForTimeout(50);
  const after = await bar.boundingBox();
  const s = await h.scroller();
  await h.close();
  return {
    ok: s.top > 0 && s.left > 0 && before.y === after.y && before.x === after.x,
    detail: `scrolled ${s.left},${s.top}; toolbar y ${before.y}→${after.y}`,
  };
});

await row('5–7', 'Dot grid, empty-Board hint, opens at top-left', async () => {
  const h = await open([], SMALL);
  const bg = await h.board.evaluate((el) => getComputedStyle(el).backgroundImage);
  const hint = await h.page.getByText('Your board is empty').isVisible();
  await h.shot('empty-board');
  await h.close();
  const h2 = await open([note({ x: 1500, y: 900 })], SMALL);
  const s = await h2.scroller();
  await h2.close();
  return {
    ok: bg.includes('radial-gradient') && hint && s.top === 0 && s.left === 0,
    detail: `grid ${bg.includes('radial-gradient')}, hint ${hint}, scroll ${s.left},${s.top}`,
  };
});

await row('8', 'Double-click empty Board creates a Note centred on the pointer', async () => {
  const h = await open();
  const p = await h.at(400, 300);
  await h.page.mouse.dblclick(p.x, p.y);
  await h.page.waitForTimeout(100);
  const r = await h.shown();
  await h.close();
  return {
    ok: near(r.x + r.width / 2, 400) && near(r.y + r.height / 2, 300) && r.width === 220,
    detail: JSON.stringify(r),
  };
});

await row('9–11', 'S/M/L only pick the size; the next double-click uses it', async () => {
  const h = await open();
  await h.page.getByRole('button', { name: 'Small notes' }).click();
  const count = await h.notes.count();
  const pressed = await h.page
    .getByRole('button', { name: 'Small notes' })
    .getAttribute('aria-pressed');
  const p = await h.at(400, 300);
  await h.page.mouse.dblclick(p.x, p.y);
  await h.page.waitForTimeout(100);
  const s = await h.stored();
  await h.page.getByRole('button', { name: 'Large notes' }).click();
  const p2 = await h.at(700, 400);
  await h.page.mouse.dblclick(p2.x, p2.y);
  await h.page.waitForTimeout(100);
  const l = await h.stored(1);
  await h.close();
  return {
    ok:
      count === 0 &&
      pressed === 'true' &&
      s.width === 160 &&
      s.height === 120 &&
      l.width === 300 &&
      l.height === 230,
    detail: `notes after S ${count}; S ${s.width}×${s.height}; L ${l.width}×${l.height}`,
  };
});

await row('12', 'A new Note opens in Editing, ready to type', async () => {
  const h = await open();
  const p = await h.at(400, 300);
  await h.page.mouse.dblclick(p.x, p.y);
  await h.page.waitForTimeout(100);
  await h.page.keyboard.type('ready');
  const v = await h.page.evaluate(
    () => document.activeElement?.tagName + ':' + document.activeElement?.value,
  );
  await h.close();
  return { ok: v === 'TEXTAREA:ready', detail: v };
});

await row(
  '14–15',
  'A Note near the edge is pushed inside; double-click on a Note does nothing',
  async () => {
    const h = await open();
    const p = await h.at(5, 5);
    await h.page.mouse.dblclick(p.x, p.y);
    await h.page.waitForTimeout(100);
    const r = await h.stored();
    await h.page.keyboard.press('Escape');
    const c = await h.bodyPoint();
    await h.page.mouse.dblclick(c.x, c.y);
    await h.page.waitForTimeout(100);
    const count = await h.notes.count();
    await h.close();
    return {
      ok: r.x === 0 && r.y === 0 && count === 1,
      detail: `placed ${r.x},${r.y}; notes after dblclick on Note ${count}`,
    };
  },
);

await row(
  '16–18',
  'Drag from anywhere on the Note; a click in the Dead zone doesn’t move',
  async () => {
    const h = await open([note({ text: 'drag me' })]);
    await h.drag(await h.bodyPoint(), { x: 150, y: 80 });
    const a = await h.stored();
    await h.page.keyboard.press('Escape');
    await h.drag(await h.stripPoint(), { x: -50, y: 20 });
    const b = await h.stored();
    await h.drag(await h.bodyPoint(), { x: 2, y: 1 }, { steps: 2 });
    const c = await h.stored();
    await h.close();
    return {
      ok: a.x === 250 && a.y === 180 && b.x === 200 && b.y === 200 && c.x === 200 && c.y === 200,
      detail: `body drag → ${a.x},${a.y}; strip drag → ${b.x},${b.y}; 2px press → ${c.x},${c.y}`,
    };
  },
);

await row('19–20', 'Stops at the visible Board edge; drops exactly where shown', async () => {
  const h = await open([note()]);
  let shownBefore;
  await h.drag(
    await h.bodyPoint(),
    { x: 2000, y: 0 },
    {
      beforeUp: async () => {
        shownBefore = await h.shown();
      },
    },
  );
  const a = await h.stored();
  await h.drag(await h.bodyPoint(), { x: -2000, y: 2000 });
  const b = await h.stored();
  const s = await h.scroller();
  await h.close();
  return {
    ok:
      a.x + a.width === s.bw &&
      b.y + b.height === s.bh &&
      b.x === 0 &&
      near(shownBefore.x, a.x) &&
      near(shownBefore.y, a.y),
    detail: `right edge ${a.x + a.width}, bottom edge ${b.y + b.height}, left ${b.x}, on Board ${s.bw}×${s.bh}; Preview at release ${Math.round(shownBefore.x)},${Math.round(shownBefore.y)} = stored ${a.x},${a.y}`,
  };
});

await row('21', 'Wheel-scroll mid-drag keeps the Note under the pointer', async () => {
  const h = await open([note(), note({ x: 1500, y: 1200 })], SMALL);
  const p = await h.bodyPoint();
  const r0 = await h.notes.first().boundingBox();
  const off = { x: p.x - r0.x, y: p.y - r0.y };
  await h.page.mouse.move(p.x, p.y);
  await h.page.mouse.down();
  await h.page.mouse.move(p.x + 20, p.y + 20, { steps: 4 });
  await h.page.mouse.wheel(0, 200);
  await h.page.waitForTimeout(150);
  await h.page.mouse.move(p.x + 22, p.y + 22, { steps: 2 });
  const r1 = await h.notes.first().boundingBox();
  const s = await h.scroller();
  await h.page.mouse.up();
  await h.page.waitForTimeout(50);
  const st = await h.stored();
  await h.close();
  const under = near(p.x + 22 - r1.x, off.x, 1.5) && near(p.y + 22 - r1.y, off.y, 1.5);
  return {
    ok: s.top > 0 && under && near(st.y, 100 + 22 + s.top, 1.5),
    detail: `scrolled ${s.top}; offset ${Math.round(p.x + 22 - r1.x)},${Math.round(p.y + 22 - r1.y)} vs ${Math.round(off.x)},${Math.round(off.y)}; stored y ${st.y}`,
  };
});

await row('22', 'Escape mid-drag puts the Note back', async () => {
  const h = await open([note()]);
  await h.drag(
    await h.bodyPoint(),
    { x: 120, y: 90 },
    { beforeUp: () => h.page.keyboard.press('Escape') },
  );
  const st = await h.stored();
  const sh = await h.shown();
  await h.close();
  return {
    ok: st.x === 100 && st.y === 100 && near(sh.x, 100) && near(sh.y, 100),
    detail: `stored ${st.x},${st.y}; shown ${sh.x},${sh.y}`,
  };
});

await row('24–25', 'Deeper shadow while dragging; no text selection or native drag', async () => {
  const h = await open([note({ text: 'some text to not select' })]);
  await h.page.evaluate(() => {
    window.__dragstarts = 0;
    document.addEventListener('dragstart', () => window.__dragstarts++, true);
  });
  const idle = await h.notes.first().evaluate((el) => getComputedStyle(el).boxShadow);
  let lifted, flag;
  await h.drag(
    await h.bodyPoint(),
    { x: 100, y: 60 },
    {
      beforeUp: async () => {
        await h.page.waitForTimeout(200);
        lifted = await h.notes.first().evaluate((el) => getComputedStyle(el).boxShadow);
        flag = await h.notes.first().evaluate((el) => el.hasAttribute('data-dragging'));
      },
    },
  );
  const sel = await h.page.evaluate(() => getSelection().toString());
  const ds = await h.page.evaluate(() => window.__dragstarts);
  await h.close();
  return {
    ok: flag && lifted !== idle && sel === '' && ds === 0,
    detail: `data-dragging ${flag}, shadow changed ${lifted !== idle}, selection "${sel}", dragstart ${ds}`,
  };
});

await row('26', 'Releasing outside the window ends the drag where it was', async () => {
  if (which === 'firefox')
    return {
      ok: null,
      detail: "not checked: Playwright's Firefox reports a pointer outside the window as (0, -85)",
    };
  const h = await open([note()]);
  const p = await h.bodyPoint();
  await h.page.mouse.move(p.x, p.y);
  await h.page.mouse.down();
  await h.page.mouse.move(p.x + 50, p.y + 40, { steps: 4 });
  await h.page.mouse.move(-30, p.y + 40, { steps: 4 });
  await h.page.mouse.up();
  await h.page.waitForTimeout(50);
  const st = await h.stored();
  const dragging = await h.notes.first().evaluate((el) => el.hasAttribute('data-dragging'));
  await h.page.mouse.move(600, 600, { steps: 3 });
  const after = await h.stored();
  await h.close();
  return {
    ok: !dragging && st.x === 0 && st.y === 140 && after.x === st.x,
    detail: `stored ${st.x},${st.y}; still dragging ${dragging}; moved after ${after.x !== st.x}. Pointer leaves on the left only (Playwright can't leave the window for real).`,
  };
});

await row('27–29', 'Resize from all 8 handles; correct cursors; se tick shown', async () => {
  const cursors = {
    n: 'ns-resize',
    s: 'ns-resize',
    e: 'ew-resize',
    w: 'ew-resize',
    nw: 'nwse-resize',
    se: 'nwse-resize',
    ne: 'nesw-resize',
    sw: 'nesw-resize',
  };
  const bad = [];
  for (const [hd, cur] of Object.entries(cursors)) {
    const h = await open([note({ x: 300, y: 250 })]);
    const c = await h.notes
      .first()
      .locator(`[data-handle="${hd}"]`)
      .evaluate((el) => getComputedStyle(el).cursor);
    const dx = hd.includes('e') ? 30 : hd.includes('w') ? -30 : 0;
    const dy = hd.includes('s') ? 30 : hd.includes('n') ? -30 : 0;
    await h.drag(await h.handlePoint(hd), { x: dx, y: dy });
    const r = await h.stored();
    const exp = {
      x: 300 + Math.min(dx, 0),
      y: 250 + Math.min(dy, 0),
      width: 220 + Math.abs(dx),
      height: 170 + Math.abs(dy),
    };
    if (
      c !== cur ||
      r.x !== exp.x ||
      r.y !== exp.y ||
      r.width !== exp.width ||
      r.height !== exp.height
    )
      bad.push(`${hd}: cursor ${c}, rect ${JSON.stringify(r)}`);
    if (hd === 'se') await h.notes.first().screenshot({ path: `${OUT}/${which}-se-tick.png` });
    await h.close();
  }
  return {
    ok: bad.length === 0,
    detail: bad.join('; ') || 'all 8 resize by 30 px with the right cursor (se tick: screenshot)',
  };
});

await row(
  '30–31',
  'Stops at 140×100 with the opposite edge fixed; stops at the Board edge',
  async () => {
    const h = await open([note({ x: 300, y: 250 })]);
    await h.drag(await h.handlePoint('nw'), { x: 400, y: 400 });
    const a = await h.stored();
    await h.drag(await h.handlePoint('se'), { x: 3000, y: 3000 });
    const b = await h.stored();
    const s = await h.scroller();
    await h.close();
    return {
      ok:
        a.width === 140 &&
        a.height === 100 &&
        a.x + a.width === 520 &&
        a.y + a.height === 420 &&
        b.x + b.width === s.bw &&
        b.y + b.height === s.bh,
      detail: `nw inward → ${a.width}×${a.height}, far edge ${a.x + a.width},${a.y + a.height}; se outward → right/bottom ${b.x + b.width}/${b.y + b.height} on Board ${s.bw}×${s.bh}`,
    };
  },
);

await row('32–33', 'Text reflows live and never distorts', async () => {
  const text =
    'A longer line of text that has to wrap when the Note gets narrower, and wrap again.';
  const h = await open([note({ x: 300, y: 250, text })]);
  const t = h.notes.first().locator('[data-note-text]');
  const textHeight = (el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    return Math.round(r.getBoundingClientRect().height);
  };
  const lines0 = await t.evaluate(textHeight);
  const p = await h.handlePoint('e');
  let mid;
  await h.drag(
    p,
    { x: -70, y: 0 },
    {
      beforeUp: async () => {
        mid = await t.evaluate((el) => {
          const r = document.createRange();
          r.selectNodeContents(el);
          return {
            h: Math.round(r.getBoundingClientRect().height),
            font: getComputedStyle(el).fontSize,
            tf: getComputedStyle(el.closest('article')).transform,
          };
        });
      },
    },
  );
  await h.notes.first().screenshot({ path: `${OUT}/${which}-reflow.png` });
  await h.close();
  return {
    ok: mid.h > lines0 && !/matrix\((?!1, 0, 0, 1)/.test(mid.tf),
    detail: `text height ${lines0} → ${mid.h} mid-resize; font ${mid.font}; transform ${mid.tf}`,
  };
});

await row('45', 'A click on an idle Note starts Editing, caret where clicked', async () => {
  const h = await open([note({ x: 300, y: 250, text: 'hello world' })]);
  const pt = await h.notes
    .first()
    .locator('[data-note-text]')
    .evaluate((el) => {
      const r = document.createRange();
      r.setStart(el.firstChild, 6);
      r.setEnd(el.firstChild, 7);
      const b = r.getBoundingClientRect();
      return { x: b.left + 1, y: b.top + b.height / 2 };
    });
  await h.page.mouse.click(pt.x, pt.y);
  await h.page.waitForTimeout(100);
  const caret = await h.page.evaluate(() => document.activeElement?.selectionStart);
  await h.close();
  return { ok: caret === 6, detail: `caret ${caret}, expected 6` };
});

await row('46', 'Drag-select, double-click a word, text shortcuts while Editing', async () => {
  const h = await open([note({ x: 300, y: 250, text: 'alpha beta gamma' })]);
  await h.notes.first().locator('[data-note-text]').click();
  await h.page.waitForTimeout(100);
  const ta = h.notes.first().locator('textarea');
  const word = await ta.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + 14, y: r.top + 10, right: r.right - 10 };
  });
  await h.page.mouse.dblclick(word.x + 4, word.y);
  const w = await ta.evaluate((el) => el.value.slice(el.selectionStart, el.selectionEnd));
  await ta.evaluate((el) => el.setSelectionRange(0, 0));
  await h.drag({ x: word.x, y: word.y }, { x: 80, y: 0 });
  const dragSel = await ta.evaluate((el) => el.selectionEnd - el.selectionStart);
  const st = await h.stored();
  await h.page.keyboard.press(`${mod}+a`);
  const all = await ta.evaluate((el) => el.selectionEnd - el.selectionStart);
  await h.close();
  return {
    ok: w.trim() === 'alpha' && dragSel > 0 && st.x === 300 && all === 16,
    detail: `dblclick "${w}", drag selects ${dragSel}, Note at ${st.x}, select-all ${all}`,
  };
});

await row(
  '47–48',
  'Grip strip moves the edited Note, keeps focus and caret; text never jumps',
  async () => {
    const h = await open([note({ x: 300, y: 250, text: 'keep my caret' })]);
    const idle = await h.notes.first().locator('[data-note-text]').boundingBox();
    await h.notes.first().locator('[data-note-text]').click();
    await h.page.waitForTimeout(100);
    const ta = h.notes.first().locator('textarea');
    const edit = await ta.boundingBox();
    await ta.evaluate((el) => el.setSelectionRange(4, 4));
    await h.drag(await h.stripPoint(), { x: 60, y: 40 });
    const st = await h.stored();
    const f = await h.page.evaluate(() => [
      document.activeElement?.tagName,
      document.activeElement?.selectionStart,
    ]);
    await h.close();
    return {
      ok:
        st.x === 360 &&
        st.y === 290 &&
        f[0] === 'TEXTAREA' &&
        f[1] === 4 &&
        near(idle.x, edit.x, 0.5) &&
        near(idle.y, edit.y, 0.5),
      detail: `moved to ${st.x},${st.y}; focus ${f[0]} caret ${f[1]}; text box ${idle.x},${idle.y} vs ${edit.x},${edit.y}`,
    };
  },
);

await row(
  '49–51',
  'Accent outline, darker strip; one Note at most; Escape or a press ends',
  async () => {
    const h = await open([
      note({ x: 100, y: 100, text: 'a' }),
      note({ x: 500, y: 100, text: 'b' }),
    ]);
    const stripIdle = await h.notes
      .first()
      .locator('[data-grip-strip]')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    await h.notes.first().locator('[data-note-text]').click();
    await h.page.waitForTimeout(100);
    const look = await h.notes.first().evaluate((el) => getComputedStyle(el).outlineStyle);
    const stripEdit = await h.notes
      .first()
      .locator('[data-grip-strip]')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    await h.notes.nth(1).locator('[data-note-text]').click();
    await h.page.waitForTimeout(100);
    const one = await h.page.locator('article[data-editing]').count();
    const which2 = await h.notes.nth(1).evaluate((el) => el.hasAttribute('data-editing'));
    await h.page.keyboard.press('Escape');
    const afterEsc = await h.page.locator('article[data-editing]').count();
    await h.notes.first().locator('[data-note-text]').click();
    const p = await h.at(600, 500);
    await h.page.mouse.click(p.x, p.y);
    await h.page.waitForTimeout(100);
    const afterPress = await h.page.locator('article[data-editing]').count();
    await h.close();
    return {
      ok:
        look === 'solid' &&
        stripIdle !== stripEdit &&
        one === 1 &&
        which2 &&
        afterEsc === 0 &&
        afterPress === 0,
      detail: `outline ${look}, strip ${stripIdle}→${stripEdit}, editing count ${one}, after Escape ${afterEsc}, after Board press ${afterPress}`,
    };
  },
);

await row('52', 'Text kept exactly as typed, line breaks included', async () => {
  const h = await open([note({ x: 300, y: 250 })]);
  await h.notes.first().click();
  await h.page.waitForTimeout(100);
  await h.page.keyboard.type('a  b');
  await h.page.keyboard.press('Enter');
  await h.page.keyboard.press('Enter');
  await h.page.keyboard.type('  c ');
  await h.page.keyboard.press('Escape');
  const t = await h.notes
    .first()
    .locator('[data-note-text]')
    .evaluate((el) => [el.textContent, getComputedStyle(el).whiteSpace]);
  await h.page.reload();
  await h.page.waitForTimeout(300);
  const r = await h.notes.first().locator('[data-note-text]').textContent();
  await h.close();
  return {
    ok: t[0] === 'a  b\n\n  c ' && r === t[0] && t[1].startsWith('pre'),
    detail: `${JSON.stringify(t[0])} white-space ${t[1]}; after reload ${JSON.stringify(r)}`,
  };
});

await row('53', 'Pressing a Note Raises it at once, for the whole Drag', async () => {
  const h = await open([note({ x: 100, y: 100 }), note({ x: 200, y: 150 })]);
  const p = await h.notes.first().boundingBox();
  await h.page.mouse.move(p.x + 20, p.y + 80);
  await h.page.mouse.down();
  await h.page.waitForTimeout(50);
  const atPress = [await h.stored(0), await h.stored(1)].map((r) => r.z);
  await h.page.mouse.move(p.x + 200, p.y + 120, { steps: 6 });
  const top = await h.page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.closest('article')?.style.left,
    [p.x + 200, p.y + 120],
  );
  await h.page.mouse.up();
  await h.close();
  return {
    ok: atPress[0] > atPress[1] && top === '100px',
    detail: `z at press ${atPress}; Note under pointer mid-drag left=${top}`,
  };
});

await row(
  '34–36',
  'Overlapping Note deletes, pointer anywhere; pinned; beside it: moved',
  async () => {
    const h = await open([note({ x: 300, y: 200, width: 300, height: 230 })], SMALL);
    const zone = await h.page.locator('[data-state]').boundingBox();
    const n0 = await h.notes.first().boundingBox();
    // Grab the far (top-left) corner area, so the pointer ends well outside the zone.
    const grab = { x: n0.x + 20, y: n0.y + 40 };
    const by = { x: zone.x - (n0.x + n0.width) + 10, y: zone.y - (n0.y + n0.height) + 10 };
    await h.drag(grab, by);
    const ptrOutside = grab.x + by.x < zone.x;
    const deleted = (await h.notes.count()) === 0;
    await h.close();
    const h2 = await open([note({ x: 300, y: 200 }), note({ x: 1500, y: 1200 })], SMALL);
    const z0 = await h2.page.locator('[data-state]').boundingBox();
    await h2.board.evaluate((el) => el.parentElement.scrollTo(500, 400));
    await h2.page.waitForTimeout(50);
    const z1 = await h2.page.locator('[data-state]').boundingBox();
    await h2.board.evaluate((el) => el.parentElement.scrollTo(0, 0));
    await h2.page.waitForTimeout(50);
    const b0 = await h2.notes.first().boundingBox();
    await h2.drag(
      { x: b0.x + 20, y: b0.y + 40 },
      { x: z0.x - (b0.x + b0.width) - 6, y: z0.y - (b0.y + b0.height) + 20 },
    );
    const kept = await h2.notes.count();
    const moved = await h2.stored();
    await h2.close();
    return {
      ok: deleted && ptrOutside && z0.x === z1.x && z0.y === z1.y && kept === 2 && moved.x !== 300,
      detail: `deleted ${deleted} (pointer outside zone ${ptrOutside}); zone fixed on scroll ${z0.x === z1.x && z0.y === z1.y}; beside it kept, moved to ${moved.x},${moved.y}`,
    };
  },
);

await row(
  '37–39',
  'Zone hints during a move, red with Note dimmed when over; resize: never',
  async () => {
    const h = await open([note({ x: 300, y: 200 })], SMALL);
    const zone = h.page.locator('[data-state]');
    const zb = await zone.boundingBox();
    const s0 = await zone.getAttribute('data-state');
    const p = await h.bodyPoint();
    const nb = await h.notes.first().boundingBox();
    let armed, over, dim, overBg, quietBg;
    quietBg = await zone.evaluate((el) => getComputedStyle(el).backgroundColor);
    await h.page.mouse.move(p.x, p.y);
    await h.page.mouse.down();
    await h.page.mouse.move(p.x + 20, p.y + 10, { steps: 3 });
    armed = await zone.getAttribute('data-state');
    await h.page.mouse.move(
      p.x + (zb.x - nb.x - nb.width) + 20,
      p.y + (zb.y - nb.y - nb.height) + 20,
      { steps: 6 },
    );
    await h.page.waitForTimeout(200);
    over = await zone.getAttribute('data-state');
    overBg = await zone.evaluate((el) => getComputedStyle(el).backgroundColor);
    dim = await h.notes
      .first()
      .evaluate((el) => [el.hasAttribute('data-over-trash'), getComputedStyle(el).opacity]);
    await h.page.keyboard.press('Escape');
    await h.page.mouse.up();
    await h.shot('trash-cancelled');
    let resizeState = [];
    const hp = await h.handlePoint('se');
    await h.page.mouse.move(hp.x, hp.y);
    await h.page.mouse.down();
    await h.page.mouse.move(zb.x + 20, zb.y + 20, { steps: 6 });
    resizeState.push(await zone.getAttribute('data-state'));
    await h.page.mouse.up();
    const count = await h.notes.count();
    await h.close();
    return {
      ok:
        s0 === 'quiet' &&
        armed === 'armed' &&
        over === 'over' &&
        dim[0] &&
        Number(dim[1]) < 1 &&
        overBg !== quietBg &&
        resizeState[0] === 'quiet' &&
        count === 1,
      detail: `${s0} → ${armed} → ${over}; Note dimmed ${dim}; zone colour ${quietBg} → ${overBg}; resize over zone: ${resizeState[0]}, Note kept ${count === 1}`,
    };
  },
);

await row(
  '40–42',
  '"Note deleted" toast with Undo after a drop; Undo restores it exactly',
  async () => {
    const orig = note({
      x: 300,
      y: 200,
      width: 250,
      height: 180,
      text: 'bring me back',
      colour: 'blue',
    });
    const h = await open([orig], SMALL);
    const zb = await h.page.locator('[data-state]').boundingBox();
    const nb = await h.notes.first().boundingBox();
    const p = await h.bodyPoint();
    await h.drag(p, { x: zb.x - nb.x - nb.width + 30, y: zb.y - nb.y - nb.height + 30 });
    const toast = await h.page.getByText('Note deleted').isVisible();
    await h.page.getByRole('button', { name: 'Undo' }).click();
    await h.page.waitForTimeout(100);
    const r = await h.stored();
    const meta = await h.notes
      .first()
      .evaluate((el) => [
        el.dataset.colour,
        el.querySelector('[data-note-text]').textContent,
        el.dataset.noteId,
      ]);
    await h.close();
    return {
      ok:
        toast &&
        r.x === 300 &&
        r.y === 200 &&
        r.width === 250 &&
        r.height === 180 &&
        meta[0] === 'blue' &&
        meta[1] === 'bring me back' &&
        meta[2] === orig.id,
      detail: `toast ${toast}; restored ${JSON.stringify(r)} ${meta}`,
    };
  },
);

await row(
  '#33',
  'Tab: Note, ×, next Note; dashed ring and Raise; Enter, Escape, Delete',
  async () => {
    const h = await open([
      note({ x: 100, y: 100, text: 'one', z: 5 }),
      note({ x: 200, y: 150, text: 'two', z: 9 }),
    ]);
    await h.notes.first().focus();
    await h.page.keyboard.press('Shift+Tab'); // the last toolbar control
    const seq = [];
    for (let i = 0; i < 4; i++) {
      await h.page.keyboard.press('Tab');
      seq.push(
        await h.page.evaluate(() => {
          const a = document.activeElement;
          return a.tagName === 'ARTICLE'
            ? `Note:${a.textContent.replace('×', '')}`
            : a.getAttribute('aria-label');
        }),
      );
    }
    await h.notes.first().focus();
    await h.page.keyboard.press('Shift+Tab');
    await h.page.keyboard.press('Tab');
    const ring = await h.notes.first().evaluate((el) => getComputedStyle(el).outlineStyle);
    const raised = (await h.stored(0)).z > (await h.stored(1)).z;
    await h.page.keyboard.press('Enter');
    const ed = await h.page.evaluate(() => [
      document.activeElement.tagName,
      document.activeElement.selectionStart,
    ]);
    await h.page.keyboard.press('Escape');
    const back = await h.page.evaluate(() => document.activeElement.tagName);
    await h.page.keyboard.press('Delete');
    await h.page.waitForTimeout(100);
    const left = await h.notes.count();
    const next = await h.page.evaluate(() => document.activeElement.textContent.replace('×', ''));
    await h.close();
    const order = seq.join(' > ');
    return {
      ok:
        order === 'Note:one > Delete note > Note:two > Delete note' &&
        ring === 'dashed' &&
        raised &&
        ed[0] === 'TEXTAREA' &&
        ed[1] === 3 &&
        back === 'ARTICLE' &&
        left === 1 &&
        next === 'two',
      detail: `${order}; ring ${ring}; raised ${raised}; Enter → ${ed}; Escape → ${back}; Delete → ${left} left, focus on "${next}"`,
    };
  },
);

await browser.close();
writeFileSync(
  `${OUT}/${which}.json`,
  JSON.stringify({ browser: which, version, results }, null, 2),
);
console.log(
  `${which} ${version}: ${results.filter((r) => r.ok).length} passed, ${results.filter((r) => r.ok === false).length} failed, ${results.filter((r) => r.ok === null).length} not checked`,
);
