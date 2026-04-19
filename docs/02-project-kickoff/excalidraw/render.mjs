// Render all .excalidraw files in this directory to export/*.png using
// @excalidraw/utils exportToBlob inside headless Chrome (puppeteer-core + system Chrome).
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "export");
await mkdir(outDir, { recursive: true });

const files = (await readdir(__dirname)).filter((f) => f.endsWith(".excalidraw"));
if (!files.length) {
  console.error("No .excalidraw files found");
  process.exit(1);
}

const html = `<!doctype html><html><head><meta charset="utf-8"><title>render</title></head>
<body><script type="module">
  import { exportToBlob } from "https://esm.sh/@excalidraw/utils@0.1.3-test32";
  window.__exportToBlob = exportToBlob;
  window.__ready = true;
</script></body></html>`;

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const page = await browser.newPage();
  page.on("console", (m) => {
    const t = m.type();
    if (t === "error" || t === "warning") console.log(`[page ${t}]`, m.text());
  });
  await page.setContent(html, { waitUntil: "load" });
  await page.waitForFunction("window.__ready === true", { timeout: 60000 });

  for (const f of files) {
    const name = basename(f, ".excalidraw");
    const raw = await readFile(join(__dirname, f), "utf8");
    const scene = JSON.parse(raw);

    const dataUrl = await page.evaluate(async (scene) => {
      const blob = await window.__exportToBlob({
        elements: scene.elements,
        appState: {
          ...(scene.appState || {}),
          exportBackground: true,
          exportWithDarkMode: false,
          exportPadding: 24,
          viewBackgroundColor: (scene.appState && scene.appState.viewBackgroundColor) || "#0f172a",
        },
        files: scene.files || {},
        mimeType: "image/png",
        exportPadding: 24,
        getDimensions: (w, h) => ({ width: w * 2, height: h * 2, scale: 2 }),
      });
      const buf = await blob.arrayBuffer();
      let bin = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
      return "data:image/png;base64," + btoa(bin);
    }, scene);

    const base64 = dataUrl.split(",")[1];
    const outPath = join(outDir, `${name}.png`);
    await writeFile(outPath, Buffer.from(base64, "base64"));
    console.log(`✓ ${name}.png`);
  }
} finally {
  await browser.close();
}
