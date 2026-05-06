/**
 * render.js — Motor de renderizado de slides para estiubarTEK
 * ─────────────────────────────────────────────────────────────
 * Uso directo:   node render.js
 * Desde n8n:     node render.js --data '{"slides":[...]}'
 * Como módulo:   const { renderSlide } = require('./render')
 *
 * FIXES sobre el borrador inicial:
 *  1. replaceAll(regex) en lugar de .replace() — evita que el primer
 *     {{title}} deje los demás sin reemplazar (title tag + h1).
 *  2. page.goto('file://') en vez de setContent() → los assets locales
 *     (logo PNG) resuelven correctamente desde el filesystem.
 *  3. Escribe HTML temporal → navega → borra. No requiere servidor.
 *  4. headless: true  (headless:"new" fue deprecado en Puppeteer v21+).
 *  5. Crea carpeta output/ automáticamente si no existe.
 *  6. Reemplaza TODOS los placeholders del template, no solo title/subtitle.
 *  7. Expone renderSlide() como función reutilizable (para carousel.js y n8n).
 */

"use strict";

const fs   = require("fs");
const path = require("path");
const os   = require("os");
const puppeteer = require("puppeteer");

// ── Rutas base ────────────────────────────────────────────────
const TEMPLATE_PATH = path.join(__dirname, "../templates/slide-template.html");
const OUTPUT_DIR    = path.join(__dirname, "../output");

// ── Ruta al logo (dentro del microservicio automation/) ───────
// El logo se copia en automation/assets/img/ para que el contenedor
// Docker sea autónomo. render.js lo inyecta como base64 antes de
// escribir el HTML temporal → Puppeteer no depende de rutas relativas.
const LOGO_PATH = path.join(
  __dirname,
  "../assets/img/logo_estiubarTEK_t.png"
);

// ── Dimensiones por plataforma ────────────────────────────────
const VIEWPORTS = {
  instagram: { width: 1080, height: 1350 }, // 4:5  carrusel
  tiktok:    { width: 1080, height: 1920 }, // 9:16 story / TikTok
  facebook:  { width: 1200, height: 630  }, // 1.91:1 link preview / post
  square:    { width: 1080, height: 1080 }, // 1:1  post cuadrado
};

/**
 * renderSlide(data, options) → Promise<string>
 *
 * @param {object} data     — Variables de plantilla (title, subtitle, …)
 * @param {object} options
 *   @param {string} options.templatePath  — Ruta al .html (default: slide-template.html)
 *   @param {string} options.outputPath    — Ruta de salida del PNG
 *   @param {string} options.platform      — 'instagram' | 'tiktok' | 'facebook' | 'square'
 *   @param {number} options.scaleFactor   — deviceScaleFactor (default: 2 → 2x = alta calidad)
 * @returns {string} — Ruta absoluta al PNG generado
 */
async function renderSlide(data = {}, options = {}) {
  const {
    templatePath = TEMPLATE_PATH,
    outputPath   = path.join(OUTPUT_DIR, `slide-${Date.now()}.png`),
    platform     = "instagram",
    scaleFactor  = 2,
  } = options;

  // 1. Leer plantilla
  let html = fs.readFileSync(templatePath, "utf-8");

  // 1b. Incrustar logo como base64 para que funcione desde OS tmpdir.
  //     El src original '../../assets/img/logo_estiubarTEK_t.png' se
  //     reemplaza por 'data:image/png;base64,...' antes de guardar el
  //     HTML temporal — sin depender de rutas relativas en producción.
  if (fs.existsSync(LOGO_PATH)) {
    const logoB64 = fs.readFileSync(LOGO_PATH).toString("base64");
    const logoDataUri = `data:image/png;base64,${logoB64}`;
    html = html.replace(
      /src="[^"]*logo_estiubarTEK_t\.png"/g,
      `src="${logoDataUri}"`
    );
  }

  // 2. Reemplazar TODOS los {{placeholders}} con regex global (/g)
  //    — .replace("{{x}}", val) solo cambia la PRIMERA ocurrencia
  //      (el template tiene {{title}} en <title> Y en <h1>)
  const defaults = {
    eyebrow:      "Automatización IA",
    title:        "Título del slide",
    subtitle:     "Subtítulo descriptivo del contenido principal.",
    stat_1:       "Stat 1",
    stat_2:       "Stat 2",
    slide_number: "01",
  };
  const vars = { ...defaults, ...data };

  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    html = html.replace(regex, value ?? "");
  }

  // 3. Crear carpeta output/ si no existe
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  // 4. Escribir HTML temporal para que page.goto('file://') resuelva
  //    assets locales (logo PNG, etc.) correctamente
  //    setContent() no tiene base URL → las rutas relativas se rompen
  const tmpFile = path.join(os.tmpdir(), `slide-${Date.now()}.html`);
  fs.writeFileSync(tmpFile, html, "utf-8");

  // 5. Lanzar Puppeteer
  const browser = await puppeteer.launch({
    headless: true, // headless:"new" deprecado en Puppeteer v21+
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage", // estabilidad en Docker / n8n server
      "--font-render-hinting=none", // tipografía más nítida en headless
    ],
  });

  const page = await browser.newPage();

  // 6. Viewport por plataforma (+ deviceScaleFactor para 2x calidad)
  const vp = VIEWPORTS[platform] ?? VIEWPORTS.instagram;
  await page.setViewport({ ...vp, deviceScaleFactor: scaleFactor });

  // 7. Navegar al archivo temporal (resuelve assets locales)
  await page.goto(`file://${tmpFile}`, { waitUntil: "networkidle0" });

  // 8. Esperar que Google Fonts termine de cargar
  //    (crítico para el design system Montserrat + Inter)
  await page.evaluateHandle("document.fonts.ready");

  // 9. Screenshot
  await page.screenshot({ path: outputPath, type: "png" });

  await browser.close();

  // 10. Limpiar HTML temporal
  fs.unlinkSync(tmpFile);

  console.log(`✅  Slide generado: ${outputPath}`);
  return outputPath;
}

// ── CLI: node render.js --data '{"title":"Hola","subtitle":"Mundo"}' ─
if (require.main === module) {
  (async () => {
    // Parsear --data desde argv
    const argv  = process.argv.slice(2);
    const dIdx  = argv.indexOf("--data");
    let   cliData = {};

    if (dIdx !== -1 && argv[dIdx + 1]) {
      try { cliData = JSON.parse(argv[dIdx + 1]); }
      catch { console.error("❌  --data debe ser un JSON válido"); process.exit(1); }
    } else {
      // Demo sin argumentos
      cliData = {
        eyebrow:      "Automatización IA",
        title:        "Automatiza tu contenido",
        subtitle:     "Carruseles on-brand generados con <strong>IA + Puppeteer</strong> — sin Bannerbear.",
        stat_1:       "100% self-hosted",
        stat_2:       "estiubarTEK",
        slide_number: "01 / 01",
      };
    }

    const platform   = argv[argv.indexOf("--platform") + 1] || "instagram";
    const outputName = argv[argv.indexOf("--out") + 1]      || `slide-${Date.now()}.png`;
    const outputPath = path.join(OUTPUT_DIR, outputName);

    await renderSlide(cliData, { outputPath, platform });
  })();
}

module.exports = { renderSlide, VIEWPORTS };