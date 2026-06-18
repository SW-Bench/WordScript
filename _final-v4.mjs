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
  const dividers = Array.from(document.querySelectorAll(".pill__divider"));

  // 1. Check for orange vertical bars (should be none except pill border + mode dot)
  const orangeBars = [];
  for (const pill of pills) {
    const modeButton = pill.querySelector(".pill__mode");
    if (modeButton) {
      const beforeStyle = getComputedStyle(modeButton, "::before");
      if (beforeStyle.display !== "none" && beforeStyle.background.includes("230, 137")) {
        orangeBars.push("pill__mode::before still visible");
      }
    }
  }
  if (orangeBars.length > 0) issues.push(...orangeBars);

  // 2. Divider colors (all should be neutral)
  const dividerColors = [...new Set(dividers.map((d) => getComputedStyle(d).backgroundColor))];
  const hasOrangeDivider = dividerColors.some((c) => c.includes("232, 145") || c.includes("230, 137"));
  if (hasOrangeDivider) issues.push("Found orange divider");

  // 3. Symmetric padding in result/preview pills
  const resultPills = pills.filter((p) =>
    p.classList.contains("pill--result-actions") || p.classList.contains("pill--preview-actions")
  );
  const paddingChecks = resultPills.map((p) => {
    const rect = p.getBoundingClientRect();
    const firstChild = p.firstElementChild;
    const lastChild = p.lastElementChild;
    if (!firstChild || !lastChild) return null;
    const firstRect = firstChild.getBoundingClientRect();
    const lastRect = lastChild.getBoundingClientRect();
    const leftPad = Math.round(firstRect.left - rect.left);
    const rightPad = Math.round(rect.right - lastRect.right);
    return {
      cls: p.className.replace("pill pill", "pill…").slice(0, 40),
      leftPad,
      rightPad,
      symmetric: Math.abs(leftPad - rightPad) <= 2,
    };
  }).filter(Boolean);

  // 4. Edit footer: buttons right-aligned to textarea, resize handle subtle
  const editPills = pills.filter((p) => p.classList.contains("pill--edit-mode"));
  const editChecks = editPills.map((p) => {
    const textarea = p.querySelector(".pill__edit-textarea");
    const footer = p.querySelector(".pill__edit-footer");
    const handle = p.querySelector(".pill__resize-handle");
    if (!textarea || !footer || !handle) return null;
    const textareaRect = textarea.getBoundingClientRect();
    const footerRect = footer.getBoundingClientRect();
    const handleRect = handle.getBoundingClientRect();
    const handleOpacity = parseFloat(getComputedStyle(handle).opacity);
    return {
      textareaRight: Math.round(textareaRect.right),
      footerRight: Math.round(footerRect.right),
      aligned: Math.abs(textareaRect.right - footerRect.right) <= 3,
      handleOpacity,
      handleSubtle: handleOpacity <= 0.5,
    };
  }).filter(Boolean);

  // 5. Icon buttons have title + aria-label
  for (const a of actions) {
    const title = a.getAttribute("title");
    const aria = a.getAttribute("aria-label");
    if (!title) issues.push(`missing title on ${a.className}`);
    if (!aria) issues.push(`missing aria-label on ${a.className}`);
  }

  // 6. Widths
  const widths = pills.map((p) => ({
    cls: p.className.replace("pill pill", "pill…").slice(0, 40),
    w: Math.round(p.getBoundingClientRect().width),
    clip: p.scrollWidth > p.clientWidth + 1 ? "CLIP" : "ok",
  }));

  return { issues, dividerColors, paddingChecks, editChecks, widths, actionCount: actions.length };
});

console.log("ISSUES:", report.issues.length ? JSON.stringify(report.issues, null, 2) : "none ✓");
console.log("DIVIDER COLORS:", report.dividerColors, report.dividerColors.length === 1 && report.dividerColors[0] === "rgba(255, 255, 255, 0.1)" ? "✓" : "");
console.log("PADDING SYMMETRY:");
console.log(JSON.stringify(report.paddingChecks, null, 2));
console.log("EDIT FOOTER:");
console.log(JSON.stringify(report.editChecks, null, 2));
console.log("WIDTHS:");
console.log(JSON.stringify(report.widths, null, 2));

await page.screenshot({ path: "/tmp/kilo/overlay-gallery-final-v4.png", fullPage: true });
await browser.close();
