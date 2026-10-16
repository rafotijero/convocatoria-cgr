/*
 * Genera js/evaluaciones-data.js a partir de los PDFs de resultados de evaluaciones.
 * Fuentes:
 *   - archivos/03 Evaluaciones/CPM_06_2026_Resultados_Evaluacion_Conocimientos.pdf  (PT, peso 30%)
 *   - archivos/03 Evaluaciones/CPM_06_2026_Resultados_Evaluación_Aptitud.pdf         (PA, peso 20%)
 * Uso: node tools/generar-evaluaciones.js
 *
 * Usa pdftotext -tsv (Poppler) para obtener coordenadas x/y por palabra y reconstruir
 * las filas de la tabla agrupando por posición vertical exacta.
 */
'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT   = path.resolve(__dirname, '..');
const DIR_03 = path.join(ROOT, 'archivos', '03 Evaluaciones');
const OUT    = path.join(ROOT, 'js', 'evaluaciones-data.js');

// Poppler pdftotext (MiKTeX build) — soporta -tsv con coordenadas por palabra
const PDFTOTEXT = 'C:\\Users\\rafot\\AppData\\Local\\Programs\\MiKTeX\\miktex\\bin\\x64\\pdftotext.exe';

const PDFS = {
  pt: {
    file: path.join(DIR_03, 'CPM_06_2026_Resultados_Evaluacion_Conocimientos.pdf'),
    label: 'PT – Conocimientos',
    pub: '15 de octubre de 2026',
  },
  pa: {
    file: path.join(DIR_03, 'CPM_06_2026_Resultados_Evaluaci\u00f3n_Aptitud.pdf'),
    label: 'PA – Aptitud',
    pub: '15 de octubre de 2026',
  },
};

/* ---------- Extraer TSV del PDF (cacheado) ---------- */
function pdfToTsv(pdfPath) {
  const tmp = path.join(os.tmpdir(), `cpm06_tsv_${path.basename(pdfPath, '.pdf')}.tsv`);
  if (!fs.existsSync(tmp) || fs.statSync(tmp).mtimeMs < fs.statSync(pdfPath).mtimeMs) {
    console.log(`  pdftotext -tsv ${path.basename(pdfPath)} ...`);
    execFileSync(PDFTOTEXT, ['-enc', 'UTF-8', '-tsv', pdfPath, tmp]);
  }
  return fs.readFileSync(tmp, 'utf8');
}

/* ---------- Reconstruir líneas desde TSV agrupando por (página, top) ---------- */
// El TSV tiene: level, page_num, par_num, block_num, line_num, word_num, left, top, ...text
// Nivel 5 = word. Todas las palabras de una misma fila de la tabla tienen el mismo top exacto.
function tsvToLines(tsvText) {
  const words = [];

  for (const raw of tsvText.split(/\r?\n/)) {
    const cols = raw.split('\t');
    if (cols.length < 12) continue;
    if (cols[0] !== '5') continue;             // solo nivel word
    const text = cols[11];
    if (!text || text.startsWith('###')) continue;

    words.push({
      page: parseInt(cols[1], 10),
      top:  parseFloat(cols[7]),
      left: parseFloat(cols[6]),
      text,
    });
  }

  // Agrupar por (page, floor(top)) — "DNI" aparece 0.48 puntos más arriba que el resto de
  // su fila, así que floor() los unifica. Las filas adyacentes están ~27 unidades aparte.
  const map = new Map();
  for (const w of words) {
    const key = `${w.page}:${Math.floor(w.top)}`;
    if (!map.has(key)) map.set(key, { page: w.page, top: w.top, words: [] });
    map.get(key).words.push(w);
  }

  // Ordenar palabras dentro de cada línea por posición horizontal
  const lines = [];
  for (const entry of map.values()) {
    entry.words.sort((a, b) => a.left - b.left);
    lines.push({
      page: entry.page,
      top:  entry.top,
      text: entry.words.map(w => w.text).join(' '),
    });
  }

  // Ordenar líneas por página y luego por posición vertical
  lines.sort((a, b) => a.page !== b.page ? a.page - b.page : a.top - b.top);
  return lines.map(l => l.text);
}

/* ---------- Parsear una línea de tabla reconstruida ---------- */
// Formato con nombre:     42 DNI 72868004 509 ACUÑA RICCE, EDWUAR 20 CALIFICA
// Formato sin nombre:     7231 DNI 40025885 529 11 NO CALIFICA
// (los NO CALIFICA no tienen nombre en el PDF)
const RE_WITH_NAME    = /^(\d+)\s+DNI\s+(\d+)\s+(\d+)\s+(.+?)\s+(\d+(?:\.\d+)?)\s+(CALIFICA|NO CALIFICA|DESCALIFICA(?:\*)?)\s*$/;
const RE_WITHOUT_NAME = /^(\d+)\s+DNI\s+(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(CALIFICA|NO CALIFICA|DESCALIFICA(?:\*)?)\s*$/;

function parseRow(line) {
  const t = line.trim();
  if (!t || !/^\d/.test(t)) return null;
  if (!/\bDNI\b/.test(t)) return null;

  let m = t.match(RE_WITH_NAME);
  if (m) {
    return {
      n:       parseInt(m[1], 10),
      dni:     m[2].padStart(8, '0'),
      perfil:  parseInt(m[3], 10),
      nombre:  m[4].replace(/\s+/g, ' ').trim(),
      puntaje: parseFloat(m[5]),
      cond:    m[6] === 'CALIFICA' ? 0 : m[6].startsWith('NO') ? 1 : 2,
    };
  }

  m = t.match(RE_WITHOUT_NAME);
  if (m) {
    return {
      n:       parseInt(m[1], 10),
      dni:     m[2].padStart(8, '0'),
      perfil:  parseInt(m[3], 10),
      nombre:  null,
      puntaje: parseFloat(m[4]),
      cond:    m[5] === 'CALIFICA' ? 0 : m[5].startsWith('NO') ? 1 : 2,
    };
  }

  return null;
}

/* ---------- Parsear un PDF completo → Map<dni, record> ---------- */
function parseStage(key) {
  const cfg = PDFS[key];
  if (!fs.existsSync(cfg.file)) {
    console.warn(`  [AVISO] No se encontró: ${path.basename(cfg.file)}`);
    return new Map();
  }

  const tsv   = pdfToTsv(cfg.file);
  const lines = tsvToLines(tsv);
  const byDni = new Map();
  let matched = 0, skipped = 0;

  for (const line of lines) {
    const row = parseRow(line);
    if (!row) { skipped++; continue; }
    if (byDni.has(row.dni)) {
      console.warn(`  [AVISO] DNI duplicado en ${key}: ${row.dni}`);
    }
    byDni.set(row.dni, row);
    matched++;
  }

  console.log(`  ${cfg.label}: ${matched} filas parseadas (${skipped} líneas saltadas)`);
  return byDni;
}

/* ---------- Combinar ambas etapas ---------- */
function combine(ptMap, paMap) {
  const allDnis = new Set([...ptMap.keys(), ...paMap.keys()]);
  const data = [];

  for (const dni of allDnis) {
    const pt = ptMap.get(dni) || null;
    const pa = paMap.get(dni) || null;
    const base = pt || pa;

    // [dni, nombre, perfil, pt_score, pt_cond, pa_score, pa_cond]
    data.push([
      dni,
      base.nombre,
      base.perfil,
      pt ? pt.puntaje : null,
      pt ? pt.cond    : null,
      pa ? pa.puntaje : null,
      pa ? pa.cond    : null,
    ]);
  }

  data.sort((a, b) => a[0].localeCompare(b[0]));
  return data;
}

/* ---------- Main ---------- */
function main() {
  console.log('Generando js/evaluaciones-data.js…');

  const ptMap = parseStage('pt');
  const paMap = parseStage('pa');

  const data = combine(ptMap, paMap);
  console.log(`  Total combinado: ${data.length} postulantes`);

  // Estadísticas globales
  let califica = 0, noCalifica = 0, descalifica = 0;
  for (const r of data) {
    const ptC = r[4], paC = r[6];
    const cond = Math.max(ptC ?? 0, paC ?? 0);
    if (cond === 2) descalifica++;
    else if (cond === 1) noCalifica++;
    else califica++;
  }
  console.log(`  CALIFICA: ${califica} · NO CALIFICA: ${noCalifica} · DESCALIFICA: ${descalifica}`);

  const payload = {
    pub: {
      pt: PDFS.pt.pub,
      pa: PDFS.pa.pub,
      ec: null,
      ep: null,
    },
    data,
  };

  const header = `/* Generado por tools/generar-evaluaciones.js — ${new Date().toISOString().slice(0, 10)}. No editar a mano. */\n`;
  const body   = `window.CPM_EVAL = ${JSON.stringify(payload)};\n`;
  fs.writeFileSync(OUT, header + body, 'utf8');

  const kb = (Buffer.byteLength(body) / 1024).toFixed(0);
  console.log(`Escrito: js/evaluaciones-data.js (${kb} KB, ${data.length} registros)`);
}

main();
