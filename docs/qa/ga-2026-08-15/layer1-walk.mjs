import { mkdirSync } from "node:fs";
import playwright from "../../../node_modules/.pnpm/playwright-core@1.60.0/node_modules/playwright-core/index.js";

const { chromium } = playwright;

const web = process.env.PERISCAN_WEB_URL ?? "http://127.0.0.1:3010";
const out = "docs/qa/ga-2026-08-15";
mkdirSync(out, { recursive: true });

const notes = [];
function log(line) {
  notes.push(line);
  console.log(line);
}

const browser = await chromium.launch({
  channel: process.env.PERISCAN_E2E_BROWSER ?? "chrome",
  headless: true
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

page.on("pageerror", (err) => log(`PAGEERROR ${err.message}`));

const email = `ga-l1-${Date.now()}@periscan.test`;
await page.goto(`${web}/signup`, { waitUntil: "domcontentloaded" });
await page.getByLabel("Your name").fill("GA Layer1");
await page.getByLabel("Organization").fill("GA Layer1 Tenant");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill("periscan-layer1-ok");
await page.getByRole("button", { name: /create account/i }).click();
await page.waitForURL(/dashboard|welcome|\//, { timeout: 20_000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/01-first-run.png`, fullPage: true });
const heading = await page.locator("h1").first().innerText().catch(() => "");
const aurora = await page.locator(".onb-aurora").count();
const guide = await page.getByRole("link", { name: /full activation guide/i }).count();
const operate = await page.locator("[data-proof-os-spine]").innerText().catch(() => "");
log(`first-run url=${page.url()}`);
log(`h1=${JSON.stringify(heading)}`);
log(`auroraCount=${aurora}`);
log(`fullActivationGuideLinks=${guide}`);
log(`operateRail=${JSON.stringify(operate.slice(0, 400))}`);

await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: `${out}/02-first-run-mobile.png`, fullPage: true });
await page.setViewportSize({ width: 1280, height: 800 });

for (const path of ["/scopes", "/attack-paths", "/findings", "/executive"]) {
  await page.goto(`${web}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const name = path.replace("/", "") || "home";
  await page.screenshot({ path: `${out}/03-${name}.png`, fullPage: true });
  const h = await page.locator("h1").first().innerText().catch(() => "");
  log(`route ${path} h1=${JSON.stringify(h)} url=${page.url()}`);
}

await page.goto(`${web}/getting-started`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
log(`getting-started redirected? url=${page.url()}`);
await page.screenshot({ path: `${out}/04-getting-started-alias.png`, fullPage: true });

console.log("\n--- NOTES ---\n" + notes.join("\n"));
await browser.close();
