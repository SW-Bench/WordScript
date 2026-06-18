import { chromium } from "playwright";

const EXEC = "/home/felixontv/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome";
const URL = "http://localhost:1420/#/overlay-gallery";

const browser = await chromium.launch({ executablePath: EXEC, args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1320, height: 1500 } });
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

const debug = await page.evaluate(() => {
  const modeButton = document.querySelector(".pill__mode");
  if (!modeButton) return { error: "no mode button" };

  const pill = modeButton.closest(".pill");
  const ovScope = modeButton.closest(".ov-scope");

  // Check computed style of ::before
  const beforeStyle = getComputedStyle(modeButton, "::before");
  const beforeDisplay = beforeStyle.display;
  const beforeBg = beforeStyle.background;
  const beforeWidth = beforeStyle.width;
  const beforeHeight = beforeStyle.height;

  // Check all stylesheets for pill__mode::before rules
  const rules = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.selectorText && rule.selectorText.includes("pill__mode::before")) {
          rules.push({
            selector: rule.selectorText,
            display: rule.style.display,
            background: rule.style.background,
            href: sheet.href || "(inline)",
          });
        }
      }
    } catch (e) {
      // cross-origin stylesheet
    }
  }

  return {
    hasOvScope: !!ovScope,
    pillClassName: pill?.className,
    beforeDisplay,
    beforeBg,
    beforeWidth,
    beforeHeight,
    rules,
  };
});

console.log(JSON.stringify(debug, null, 2));
await browser.close();
