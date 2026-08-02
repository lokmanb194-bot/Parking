/*
 * Smoke test: serves the production build, seeds sample data, walks through
 * every tab and screenshots each one. Fails on any page error.
 *   npm run build && node scripts/smoke.mjs [output-dir]
 * Set CHROMIUM_BIN if Chromium is not on PATH.
 */
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const outDir = resolve(process.argv[2] ?? "smoke-shots");
mkdirSync(outDir, { recursive: true });

const PORT = 4173;
const preview = spawn(
  "node",
  ["node_modules/vite/bin/vite.js", "preview", "--port", String(PORT), "--strictPort"],
  { stdio: "pipe" },
);
await new Promise((resolveWait, reject) => {
  preview.stdout.on("data", (d) => {
    if (String(d).includes("Local:")) resolveWait();
  });
  preview.on("exit", (code) => reject(new Error(`preview exited ${code}`)));
  setTimeout(() => reject(new Error("preview server timeout")), 15000);
});

const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const hhmm = (d) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const at = (minutes) => new Date(today.getTime() + minutes * 60000);

const mkClient = (over) => ({
  id: crypto.randomUUID(),
  type: "incoming",
  name: "",
  plate: "",
  status: "pending",
  archived: false,
  date: iso(today),
  time: "12:00",
  createdAt: today.toISOString(),
  updatedAt: today.toISOString(),
  ...over,
});

const seed = {
  clients: [
    mkClient({
      name: "María González",
      plate: "4821 KLM",
      phone: "+34 600 111 222",
      airline: "Vueling",
      flightNumber: "VY1350",
      time: hhmm(at(40)),
      parking: "P2 · Row C",
      notes: "White Tesla Model 3, keys in glovebox",
    }),
    mkClient({
      name: "James Whitfield",
      plate: "GB22 XYZ",
      airline: "Ryanair",
      flightNumber: "FR8123",
      time: hhmm(at(95)),
      parking: "P4 · Level 2",
    }),
    mkClient({
      type: "outgoing",
      name: "Anke Bakker",
      plate: "9034 JTR",
      phone: "+34 611 333 444",
      airline: "KLM",
      flightNumber: "KL1685",
      time: hhmm(at(25)),
      parking: "P2 · Row F",
      notes: "Prefers WhatsApp",
    }),
    mkClient({
      type: "outgoing",
      name: "Pierre Dubois",
      plate: "7712 HGF",
      airline: "easyJet",
      flightNumber: "U24371",
      time: hhmm(at(-30)),
      status: "completed",
      completedAt: today.toISOString(),
    }),
  ],
  settings: { flightProvider: "demo", notificationsEnabled: false },
  notified: {},
};

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_BIN || "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});

const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

await page.goto(`http://localhost:${PORT}/`);
await page.evaluate((state) => {
  localStorage.setItem("alc-valet-state-v1", JSON.stringify(state));
}, seed);
await page.reload();
await page.waitForTimeout(2500); // let the demo provider poll once

const tabs = ["Pickups", "Returns", "Schedule", "Dashboard", "Settings"];
for (const tab of tabs) {
  await page.locator(".tab-btn", { hasText: tab }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/${tab.toLowerCase()}.png` });
  console.log(`captured ${tab}`);
}

// Timeline mode + the add-client form.
await page.locator(".tab-btn", { hasText: "Schedule" }).click();
await page.getByRole("button", { name: "Timeline" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${outDir}/timeline.png` });
await page.locator(".tab-btn", { hasText: "Pickups" }).click();
await page.getByRole("button", { name: "Add client" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${outDir}/form.png` });
console.log("captured timeline + form");

await browser.close();
preview.kill();

if (errors.length) {
  console.error("PAGE ERRORS:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("Smoke test passed with no page errors.");
