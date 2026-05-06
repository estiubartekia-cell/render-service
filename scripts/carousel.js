/**
 * carousel.js — Orquestador multi-slide para estiubarTEK
 * ──────────────────────────────────────────────────────
 * Uso:   node carousel.js --data '[{"title":"Slide 1",...},{"title":"Slide 2",...}]'
 *        node carousel.js   (usa datos de demo)
 *
 * Genera un PNG por cada slide en output/<carousel-id>/slide-01.png, slide-02.png …
 * Devuelve un JSON con las rutas → n8n lo lee y sube a Drive / Telegram / etc.
 */

"use strict";

const path = require("path");
const fs = require("fs");
const { renderSlide } = require("./render");

const OUTPUT_DIR = path.join(__dirname, "../output");

/**
 * renderCarousel(slides, options) → Promise<string[]>
 *
 * @param {object[]} slides   — Array de objetos con variables de plantilla
 * @param {object}   options
 *   @param {string} options.platform      — 'instagram' | 'tiktok' | 'facebook' | 'square'
 *   @param {string} options.carouselId    — Nombre de carpeta de salida (default: timestamp)
 *   @param {string} options.templatePath  — Plantilla HTML a usar
 * @returns {string[]}  — Array de rutas absolutas a los PNGs generados
 */
async function renderCarousel(slides = [], options = {}) {
  const {
    platform = "instagram",
    carouselId = `carousel-${Date.now()}`,
    templatePath,
  } = options;

  const carouselDir = path.join(OUTPUT_DIR, carouselId);
  fs.mkdirSync(carouselDir, { recursive: true });

  const results = [];

  for (let i = 0; i < slides.length; i++) {
    const slideData = {
      slide_number: `${String(i + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`,
      ...slides[i],
    };

    const outputPath = path.join(carouselDir, `slide-${String(i + 1).padStart(2, "0")}.png`);

    await renderSlide(slideData, { outputPath, platform, templatePath });
    results.push(outputPath);
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`\n🎠  Carrusel completo: ${carouselDir}`);
    console.log(`📦  ${results.length} slides generados\n`);
  }

  // Salida JSON para n8n (stdout)
  console.log(JSON.stringify({ carouselDir, slides: results }));

  return results;
}

// ── CLI Demo ──────────────────────────────────────────────────
if (require.main === module) {
  (async () => {
    const argv = process.argv.slice(2);
    const dIdx = argv.indexOf("--data");

    let slides;

    if (dIdx !== -1 && argv[dIdx + 1]) {
      try { slides = JSON.parse(argv[dIdx + 1]); }
      catch { console.error("❌  --data debe ser un JSON array válido"); process.exit(1); }
    } else {
      // Carrusel de demo — 5 slides alineados a estiubarTEK
      slides = [
        {
          eyebrow: "Automatización IA",
          title: "¿Tu negocio trabaja mientras tú duermes?",
          subtitle: "Los agentes de IA de <strong>estiubarTEK</strong> gestionan citas, leads y propuestas — 24/7, sin nómina.",
          stat_1: "24/7 sin pausas",
          stat_2: "ROI desde el día 1",
        },
        {
          eyebrow: "El problema",
          title: "Pierdes oportunidades cada día",
          subtitle: "Cada lead que no contestas a tiempo es una venta que se va a la competencia. La velocidad lo es todo.",
          stat_1: "+40% leads perdidos",
          stat_2: "Costo oportunidad real",
        },
        {
          eyebrow: "La solución",
          title: "Recepción inteligente 24/7",
          subtitle: "Chatbots con RAG que califican prospectos con tono humano — sin perder contexto ni calidad de atención.",
          stat_1: "RAG + LLM nativo",
          stat_2: "Zero código para ti",
        },
        {
          eyebrow: "Cómo funciona",
          title: "De lead a propuesta en 5 minutos",
          subtitle: "El agente recibe, califica y genera la propuesta en PDF automáticamente tras el diagnóstico inicial.",
          stat_1: "5 min vs. 2 días",
          stat_2: "Cierre profesional",
        },
        {
          eyebrow: "Siguiente paso",
          title: "Diagnóstico gratuito para tu negocio",
          subtitle: "Analizamos tu operación y te mostramos exactamente qué automatizar primero para mayor impacto.",
          stat_1: "estiubartek.com",
          stat_2: "Agenda hoy",
        },
      ];
    }

    const platform = argv[argv.indexOf("--platform") + 1] || "instagram";
    const carouselId = argv[argv.indexOf("--id") + 1] || `demo-${Date.now()}`;

    await renderCarousel(slides, { platform, carouselId });
  })();
}

module.exports = { renderCarousel };
