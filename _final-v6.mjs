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
  const timers = Array.from(document.querySelectorAll(".pill__timer"));

  // 1. Check pause/play side-button is gone (should be 0 in recording pills)
  const recordingPills = pills.filter((p) => p.classList.contains("pill--recording"));
  for (const pill of recordingPills) {
    const sideButtons = pill.querySelectorAll(".pill__action");
    // Recording pills should have 0 action buttons (pause button removed)
    if (sideButtons.length > 0) {
      issues.push(`Recording pill still has ${sideButtons.length} action button(s)`);
    }
  }

  // 2. Timer buttons in recording pills should have title + aria-label
  for (const pill of recordingPills) {
    const timer = pill.querySelector(".pill__timer");
    if (timer) {
      const title = timer.getAttribute("title");
      const aria = timer.getAttribute("aria-label");
      const isButton = timer.tagName === "BUTTON";
      if (!title) issues.push(`Timer missing title in ${pill.className}`);
      if (!aria) issues.push(`Timer missing aria-label in ${pill.className}`);
      if (!isButton) issues.push(`Timer is not a button in ${pill.className}`);
    }
  }

  // 3. Padding symmetry for all pills (canonical: 6px)
  const paddingResults = pills.map((pill) => {
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
      matchesCanonical: leftInset === 6 && rightInset === 6,
    };
  }).filter(Boolean);

  // 4. All icon buttons have title + aria-label
  for (const a of actions) {
    const title = a.getAttribute("title");
    const aria = a.getAttribute("aria-label");
    if (!title) issues.push(`missing title on ${a.className}`);
    if (!aria) issues.push(`missing aria-label on ${a.className}`);
  }

  // 5. Widths
  const widths = pills.map((p) => ({
    cls: p.className.replace("pill pill", "pill…").slice(0, 40),
    w: Math.round(p.getBoundingClientRect().width),
    clip: p.scrollWidth > p.clientWidth + 1 ? "CLIP" : "ok",
  }));

  return { issues, paddingResults, widths, timerCount: timers.length };
});

console.log("ISSUES:", report.issues.length ? JSON.stringify(report.issues, null, 2) : "none ✓");
console.log("TIMERS:", report.timerCount);
console.log("PADDING (canonical: 6px):");
console.log(JSON.stringify(report.paddingResults, null, 2));
console.log("WIDTHS:");
console.log(JSON.stringify(report.widths, null, 2));

await browser.close();
