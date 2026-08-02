/*
 * Rasterizes public/icons/icon.svg into the PNG sizes the manifest needs,
 * using headless Chromium. Run with: npm run icons
 * Set CHROMIUM_BIN if Chromium is not on PATH as `chromium`.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const chromium = process.env.CHROMIUM_BIN || "chromium";
const iconsDir = resolve(import.meta.dirname, "../public/icons");
const svg = readFileSync(join(iconsDir, "icon.svg"), "utf8");

// Maskable variant: full-bleed background, artwork shrunk into the safe zone.
const maskable = svg
  .replace('rx="112"', 'rx="0"')
  .replace(
    "</defs>",
    "</defs><style>#art{transform:translate(51.2px,51.2px) scale(0.8)}</style>",
  )
  .replace(/<path d="M186/, '<g id="art"><path d="M186')
  .replace("</svg>", "</g></svg>");
// Wrap the plane group inside #art too.
const maskableFixed = maskable.replace("</g>\n</g></svg>", "</g></g></svg>");

const work = mkdtempSync(join(tmpdir(), "valet-icons-"));

function render(svgText, size, out) {
  const page = join(work, `page-${size}.html`);
  writeFileSync(
    page,
    `<!doctype html><html><head><style>html,body{margin:0;padding:0;overflow:hidden}svg{display:block;width:100vw;height:100vh}</style></head><body>${svgText}</body></html>`,
  );
  const shot = join(work, `shot-${size}.png`);
  execFileSync(chromium, [
    "--headless",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--default-background-color=00000000",
    `--screenshot=${shot}`,
    `--window-size=${size},${size}`,
    `file://${page}`,
  ]);
  copyFileSync(shot, join(iconsDir, out));
  console.log(`wrote public/icons/${out}`);
}

render(svg, 512, "icon-512.png");
render(svg, 192, "icon-192.png");
render(maskableFixed, 512, "maskable-512.png");
rmSync(work, { recursive: true, force: true });
