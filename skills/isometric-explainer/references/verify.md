# Verification loop

Do not trust the code. Look at the pixels. Run this loop after each build, and fix every finding before the next run.

## What to check

1. **Model tests.** `node --test` passes, including the config sweep.
2. **Build is the source.** Rebuild and compare. The published page has no diff.
3. **Screens.** Desktop at 1440 by 900 and phone at 390 by 844, each in light and dark, at device scale 2. Stop the run at a mid event with `seek(n)` so movers are away from home.
4. **No sideways scroll.** `document.documentElement.scrollWidth - innerWidth` is 0 at every size.
5. **Close-ups at 4x.** Crop each station at device scale 4. Look for gaps between parts, text off its plate and lines that stop short.
6. **Line ends.** Every open line end without `data-free` sits on a painted part.
7. **Scenario sweep.** Load every config, seek to every event and finish the run. Collect `console.error` and `pageerror` messages. The count must be 0.
8. **Contact sheet.** Put one frame per event of a run in a grid and read it as a strip. A reader must be able to follow the steps without captions.
9. **Exploded pose.** Explode, wait 1.5 s and check that no part leaves the stage.
10. **Labels.** In every sweep frame, no pill covers another pill or a moving part. Check `?labels=0` once.
11. **Wrapping.** Readouts and labels wrap only at spaces, commas or parentheses. A flag such as `-O0` never splits at its hyphen.

## Findings from real runs

This loop found the defects below. A code review did not find them.

- A card resting on a station top had a smaller depth key than the station and never showed. Fix: a positive depth bias.
- Nameplates on station faces were hidden each time the carriage parked in front of them. Fix: move plates where no mover passes.
- Exploded parts left the top of the stage. Fix: add the exploded high points to `fitProjection`.

## Script

This script uses Playwright. Install it in a scratch folder, then run `node verify.mjs out.html shots`.

```js
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";

const [page, out] = process.argv.slice(2);
const url = pathToFileURL(page).href;
const browser = await chromium.launch();
const errors = [];
const watch = (tab, tag) => {
  tab.on("console", (m) => m.type() === "error" && errors.push(`${tag}: ${m.text()}`));
  tab.on("pageerror", (e) => errors.push(`${tag}: ${e.message}`));
};

for (const [name, viewport] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
  for (const theme of ["light", "dark"]) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
    const tab = await ctx.newPage();
    watch(tab, `${name}/${theme}`);
    await tab.goto(`${url}?still&theme=${theme}`);
    await tab.evaluate(() => window.__machine.seek(5));
    await tab.screenshot({ path: `${out}/${name}-${theme}.png` });
    const scroll = await tab.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (scroll > 0) errors.push(`${name}/${theme}: ${scroll}px sideways scroll`);
    await ctx.close();
  }
}

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 4 });
const tab = await ctx.newPage();
watch(tab, "sweep");
await tab.goto(`${url}?still`);
for (const config of [{ cache: true }, { cache: false }]) {
  const n = await tab.evaluate((c) => (window.__machine.load(c), window.__machine.state.sim.events.length), config);
  for (let i = 0; i < n; i++) {
    await tab.evaluate((i) => window.__machine.seek(i), i);
    await (await tab.$("svg[viewBox]")).screenshot({ path: `${out}/sweep-${JSON.stringify(config).replace(/\W/g, "")}-${String(i).padStart(2, "0")}.png` });
  }
  await tab.evaluate(() => window.__machine.finish());
}

const loose = await tab.evaluate(() => {
  const out = [];
  for (const line of document.querySelectorAll(".iso-line:not(.iso-edge):not(.iso-crease):not(.iso-bevel)")) {
    if (line.closest('[style*="display: none"], [style*="display:none"]')) continue;
    const free = line.getAttribute("data-free");
    if (free === "") continue;
    const m = line.getScreenCTM();
    for (const sub of (line.getAttribute("d") || "").split("M").filter(Boolean)) {
      if (/Z\s*$/.test(sub)) continue;
      const n = sub.match(/-?[\d.]+/g).map(Number);
      for (const [end, x, y] of [["start", n[0], n[1]], ["end", n.at(-2), n.at(-1)]]) {
        if (free === end) continue;
        const p = new DOMPoint(x, y).matrixTransform(m);
        const hits = document.elementsFromPoint(p.x, p.y).filter((el) => el !== line && el.closest("[data-i]"));
        if (!hits.length) out.push(`${line.closest("[data-i]").dataset.i} ${end}`);
      }
    }
  }
  return out;
});
errors.push(...loose.map((id) => `loose line end: ${id}`));

await tab.evaluate(() => window.__machine.toggleExplode());
await tab.waitForTimeout(1500);
await (await tab.$("svg[viewBox]")).screenshot({ path: `${out}/exploded.png` });
await browser.close();
console.log(errors.length ? errors.join("\n") : "0 errors");
```

The line-end check finds ends that float over empty paper. It does not find a rod that ends in the air in front of a solid. Check those in the 4x close-ups.

## Contact sheet

Write a small HTML file with a 4-column CSS grid of the sweep frames. Screenshot it with `fullPage: true`. One image then shows the whole run.

## Close-ups

Crop with `page.screenshot({ clip })` at device scale 4. Take the clip from the SVG bounding box, for example 30% of its width around one station. Look at each station once per build.
