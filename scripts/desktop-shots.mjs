import { chromium } from "playwright-core";
import { spawn } from "node:child_process";

const outDir = process.argv[2] || "desktop-shots";
const preview = spawn(
  "node",
  ["node_modules/vite/bin/vite.js", "preview", "--port", "4175", "--strictPort"],
  { stdio: "pipe" },
);
await new Promise((res, rej) => {
  preview.stdout.on("data", (d) => String(d).includes("Local:") && res());
  setTimeout(() => rej(new Error("timeout")), 15000);
});

const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const at = (m) => new Date(today.getTime() + m * 60000);
const hhmm = (d) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const mk = (o) => ({
  id: crypto.randomUUID(),
  type: "incoming",
  status: "pending",
  parkingStatus: "awaiting",
  archived: false,
  date: iso(today),
  time: "12:00",
  createdAt: today.toISOString(),
  updatedAt: today.toISOString(),
  ...o,
});
const seed = {
  clients: [
    mk({ name: "María González", plate: "4821 KLM", phone: "+34 600 111 222", airline: "Vueling", flightNumber: "VY1350", time: hhmm(at(45)), parking: "P2 · Row C", parkingStatus: "in_parking", notes: "White Tesla Model 3, keys in glovebox" }),
    mk({ name: "James Whitfield", plate: "GB22 XYZ", airline: "Ryanair", flightNumber: "FR8123", time: hhmm(at(120)), parking: "P4 · Level 2" }),
    mk({ type: "outgoing", name: "Anke Bakker", plate: "9034 JTR", phone: "+34 611 333 444", airline: "KLM", flightNumber: "KL1685", time: hhmm(at(30)), parking: "P2 · Row F", parkingStatus: "in_parking", notes: "Prefers WhatsApp" }),
    mk({ type: "outgoing", name: "Pierre Dubois", plate: "7712 HGF", airline: "easyJet", flightNumber: "U24371", time: hhmm(at(200)) }),
  ],
  settings: { flightProvider: "demo" },
  notified: {},
};

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://localhost:4175/");
await page.evaluate((s) => localStorage.setItem("alc-valet-state-v1", JSON.stringify(s)), seed);
await page.reload();
await page.waitForTimeout(2200);

for (const [label, name] of [["Dashboard", "dashboard"], ["Daily Program", "program"], ["Pickups", "pickups"]]) {
  await page.locator(".side-nav-btn", { hasText: label }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}/desktop-${name}.png` });
  console.log(`captured desktop-${name}`);
}

await browser.close();
preview.kill();
if (errors.length) {
  console.error("PAGE ERRORS:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("desktop shots done");
process.exit(0);
