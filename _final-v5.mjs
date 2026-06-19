import { chromium } from "playwright";

const EXEC = "/home/felixontv/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome";
const URL = "http://localhost:1420/#/overlay-gallery";

const browser = await chromium.launch({ executablePath: EXEC, args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1320, height: 1500 } });
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

const report = await page.evaluate(() => {
  const issues = [];
  const pills = Array.from(document.querySelectorAll(".pill"));
  const actions = Array.from(document.querySelectorAll(".pill__action"));
  const targetPills = pills.filter((p) =>
    p.classList.contains("pill--result-actions") || p.classList.contains("pill--preview-actions")
  );

  // 1. Padding symmetry for all result/preview pills
  const paddingResults = targetPills.map((pill) => {
    const pillRect = pill.getBoundingClientRect();
    const firstChild = pill.firstElementChild;
    const lastChild = pill.lastElementChild;
    if (!firstChild || !lastChild) return null;
    const firstRect = firstChild.getBoundingClientRect();
    const lastRect = lastChild.getBoundingClientRect();
    const leftInset = Math.round(firstRect.left - pillRect.left);
    const rightInset = Math.round(pillRect.right - lastRect.right);
    return {
      cls: pill.className.replace("pill pill", "pill…").slice(0, 40),
      leftInset,
      rightInset,
      symmetric: Math.abs(leftInset - rightInset) <= 1,
    };
  }).filter(Boolean);

  // 2. Scale check: pills should be ~87% of original size
  // Original recording width was ~271px, scaled should be ~236px
  const recordingPill = pills.find((p) => p.classList.contains("pill--recording") && !p.classList.contains("pill--muted") && !p.classList.contains("pill--paused"));
  const recordingWidth = recordingPill ? Math.round(recordingPill.getBoundingClientRect().width) : 0;
  const scaleFactor = recordingWidth / 271; // 271 was original

  // 3. Icon buttons have title + aria-label
  for (const a of actions) {
    const title = a.getAttribute("title");
    const aria = a.getAttribute("aria-label");
    if (!title) issues.push(`missing title on ${a.className}`);
    if (!aria) issues.push(`missing aria-label on ${a.className}`);
  }

  // 4. All pill widths
  const widths = pills.map((p) => ({
    cls: p.className.replace("pill pill", "pill…").slice(0, 40),
    w: Math.round(p.getBoundingClientRect().width),
    clip: p.scrollWidth > p.clientWidth + 1 ? "CLIP" : "ok",
  }));

  return { issues, paddingResults, scaleFactor, recordingWidth, widths };
});

console.log("ISSUES:", report.issues.length ? JSON.stringify(report.issues, null, 2) : "none ✓");
console.log("PADDING SYMMETRY (all result/preview pills):");
console.log(JSON.stringify(report.paddingResults, null, 2));
console.log(`SCALE FACTOR: ${report.scaleFactor.toFixed(3)} (target: 0.87)`);
console.log(`RECORDING PILL WIDTH: ${report.recordingWidth}px (was 271px)`);
console.log("ALL WIDTHS:");
console.log(JSON.stringify(report.widths, null, 2));

await browser.close();
