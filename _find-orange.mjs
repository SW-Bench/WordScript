import { chromium } from "playwright";

const EXEC = "/home/felixontv/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome";
const URL = "http://localhost:1420/#/overlay-gallery";

const browser = await chromium.launch({ executablePath: EXEC, args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1320, height: 1500 } });
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

// Find the orange bar by inspecting ALL elements in the first recording pill
const orangeSources = await page.evaluate(() => {
  const pill = document.querySelector(".pill--recording");
  if (!pill) return { error: "no recording pill" };

  const pillRect = pill.getBoundingClientRect();
  const results = [];

  // Check all elements inside the pill
  const allElements = [pill, ...Array.from(pill.querySelectorAll("*"))];

  for (const el of allElements) {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    // Check for orange in border-left, border-right, background, box-shadow
    const checks = {
      borderLeftColor: cs.borderLeftColor,
      borderRightColor: cs.borderRightColor,
      borderTopColor: cs.borderTopColor,
      borderBottomColor: cs.borderBottomColor,
      background: cs.background,
      boxShadow: cs.boxShadow,
      outlineColor: cs.outlineColor,
    };

    const orangeHits = [];
    for (const [prop, value] of Object.entries(checks)) {
      if (value && (value.includes("232, 145") || value.includes("e8912a") || value.includes("230, 137"))) {
        orangeHits.push({ prop, value });
      }
    }

    if (orangeHits.length > 0) {
      results.push({
        tag: el.tagName,
        className: el.className,
        rect: { x: Math.round(rect.x - pillRect.x), y: Math.round(rect.y - pillRect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
        orangeHits,
      });
    }

    // Also check pseudo-elements
    for (const pseudo of ["::before", "::after"]) {
      try {
        const pseudoStyle = getComputedStyle(el, pseudo);
        const pseudoRect = { width: parseFloat(pseudoStyle.width), height: parseFloat(pseudoStyle.height) };
        if (pseudoRect.width > 0 && pseudoRect.height > 0) {
          const pseudoChecks = {
            background: pseudoStyle.background,
            borderLeftColor: pseudoStyle.borderLeftColor,
            borderRightColor: pseudoStyle.borderRightColor,
            boxShadow: pseudoStyle.boxShadow,
          };
          for (const [prop, value] of Object.entries(pseudoChecks)) {
            if (value && (value.includes("232, 145") || value.includes("e8912a") || value.includes("230, 137"))) {
              results.push({
                tag: el.tagName,
                className: el.className,
                pseudo,
                rect: { x: Math.round(rect.x - pillRect.x), y: Math.round(rect.y - pillRect.y), w: Math.round(pseudoRect.width), h: Math.round(pseudoRect.height) },
                orangeHits: [{ prop, value }],
              });
            }
          }
        }
      } catch (e) {
        // pseudo-element doesn't exist
      }
    }
  }

  return { results, pillWidth: Math.round(pillRect.width) };
});

console.log("ORANGE SOURCES:");
console.log(JSON.stringify(orangeSources, null, 2));

// Also check all dividers
const dividerCheck = await page.evaluate(() => {
  const dividers = Array.from(document.querySelectorAll(".pill__divider"));
  return dividers.map((d, i) => ({
    index: i,
    parent: d.parentElement?.className,
    bg: getComputedStyle(d).backgroundColor,
    width: getComputedStyle(d).width,
    height: getComputedStyle(d).height,
  }));
});

console.log("\nALL DIVIDERS:");
console.log(JSON.stringify(dividerCheck, null, 2));

await browser.close();
