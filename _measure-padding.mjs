import { chromium } from "playwright";

const EXEC = "/home/felixontv/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome";
const URL = "http://localhost:1420/#/overlay-gallery";

const browser = await chromium.launch({ executablePath: EXEC, args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1320, height: 1500 } });
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

const measurements = await page.evaluate(() => {
  const pills = Array.from(document.querySelectorAll(".pill"));
  const targetPills = pills.filter((p) =>
    p.classList.contains("pill--result-actions") ||
    p.classList.contains("pill--preview-actions")
  );

  return targetPills.map((pill) => {
    const pillRect = pill.getBoundingClientRect();
    const pillStyle = getComputedStyle(pill);
    const children = Array.from(pill.children);

    const childDetails = children.map((child) => {
      const rect = child.getBoundingClientRect();
      return {
        tag: child.tagName,
        className: child.className,
        left: Math.round(rect.left - pillRect.left),
        right: Math.round(rect.right - pillRect.left),
        width: Math.round(rect.width),
      };
    });

    const firstChild = children[0];
    const lastChild = children[children.length - 1];
    const firstRect = firstChild.getBoundingClientRect();
    const lastRect = lastChild.getBoundingClientRect();

    const leftInset = Math.round(firstRect.left - pillRect.left);
    const rightInset = Math.round(pillRect.right - lastRect.right);

    return {
      cls: pill.className.replace("pill pill", "pill…").slice(0, 50),
      pillWidth: Math.round(pillRect.width),
      paddingLeft: pillStyle.paddingLeft,
      paddingRight: pillStyle.paddingRight,
      leftInset,
      rightInset,
      symmetric: Math.abs(leftInset - rightInset) <= 1,
      children: childDetails,
    };
  });
});

console.log("DETAILED PADDING MEASUREMENTS:");
console.log(JSON.stringify(measurements, null, 2));

await browser.close();
