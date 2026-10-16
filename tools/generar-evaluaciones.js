/*
 * Genera js/evaluaciones-data.js a partir de los resultados de evaluaciones.
 * Fuentes (archivos/04 Evaluaciones):
 *   - CPM_06_2026_Resultados_Evaluacion_Conocimientos.md  (PT, peso 30%) — todos los postulantes
 *   - CPM_06_2026_Resultados_Evaluación_Aptitud.md        (PA, peso 20%) — todos los evaluados
 *   - CPM_06_2026_Califica_Conocimientos_Aptitud.xlsx     solo CALIFICA; se usa para validar
 * Uso: node tools/generar-evaluaciones.js
 *
 * Los .md son la conversión (OCR) de los PDF oficiales. Se toman como fuente principal porque
 * incluyen también NO CALIFICA, DESCALIFICA y NO SE PRESENTÓ; el Excel permite verificar que
 * cada CALIFICA coincida en documento, perfil, puntaje y condición. Cualquier diferencia
 * detiene la generación.
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT   = path.resolve(__dirname, '..');
const DIR_04 = path.join(ROOT, 'archivos', '04 Evaluaciones');
const OUT    = path.join(ROOT, 'js', 'evaluaciones-data.js');
const XLSX   = path.join(DIR_04, 'CPM_06_2026_Califica_Conocimientos_Aptitud.xlsx');

const ETAPAS = {
  pt: {
    file: path.join(DIR_04, 'CPM_06_2026_Resultados_Evaluacion_Conocimientos.md'),
    sheet: 'xl/worksheets/sheet1.xml', // 1_Conocimientos
    label: 'PT – Conocimientos',
    pub: '15 de octubre de 2026',
  },
  pa: {
    file: path.join(DIR_04, 'CPM_06_2026_Resultados_Evaluación_Aptitud.md'),
    sheet: 'xl/worksheets/sheet2.xml', // 2_Aptitud
    label: 'PA – Aptitud',
    pub: '15 de octubre de 2026',
  },
};

// 0 = CALIFICA, 1 = NO CALIFICA, 2 = DESCALIFICA, 3 = NO SE PRESENTÓ
const CONDS = ['CALIFICA', 'NO CALIFICA', 'DESCALIFICA', 'NO SE PRESENTÓ'];
const NOTA_MINIMA = 12;

const errores = [];

/* ---------- Parsear una fila de la tabla Markdown ---------- */
// Con nombre:  |1|DNI|73112361|518|ABAD CERNA, BRENDA NIKOL|13|CALIFICA|
// Sin nombre:  |8807|DNI|42545882|783|11|NO CALIFICA|   (NO CALIFICA, DESCALIFICA, NO SE PRESENTÓ)
// Error OCR:   |194|DNI|47277879|767|ALTAMIRANO ..., JENNIFFER MARIA DEL MILAGRO18||CALIFICA|
function parseRow(line) {
  const c = line.trim().replace(/^\||\|$/g, '').split('|').map((s) => s.trim());
  if (!/^\d+$/.test(c[0])) return null;

  let n, tipo, doc, perfil, nombre, puntaje, cond;
  if (c.length === 7) {
    [n, tipo, doc, perfil, nombre, puntaje, cond] = c;
    if (puntaje === '') {
      // el OCR pegó el puntaje al final del nombre
      const m = nombre.match(/^(.*?)\s*(\d+(?:\.\d+)?)$/);
      if (m) { nombre = m[1].trim(); puntaje = m[2]; }
    }
  } else if (c.length === 6) {
    [n, tipo, doc, perfil, puntaje, cond] = c;
    nombre = null;
  } else {
    return { error: 'columnas inesperadas' };
  }

  const condIdx = CONDS.indexOf(cond);
  if (!/^(DNI|CE)$/.test(tipo))                    return { error: `tipo de documento "${tipo}"` };
  if (!/^\d{8,9}$/.test(doc))                      return { error: `documento "${doc}"` };
  if (!/^\d+$/.test(perfil))                       return { error: `perfil "${perfil}"` };
  if (condIdx < 0)                                 return { error: `condición "${cond}"` };
  if (puntaje !== '-' && !/^\d+(\.\d+)?$/.test(puntaje)) return { error: `puntaje "${puntaje}"` };

  return {
    n:       parseInt(n, 10),
    tipo,
    dni:     doc,
    perfil:  parseInt(perfil, 10),
    nombre:  nombre && nombre !== '-' ? nombre.replace(/\s+/g, ' ') : null,
    puntaje: puntaje === '-' ? null : parseFloat(puntaje),
    cond:    condIdx,
  };
}

/* ---------- Leer un .md completo → Map<dni, record> ---------- */
function parseStage(key) {
  const cfg = ETAPAS[key];
  const byDni = new Map();
  const conteo = CONDS.map(() => 0);
  let esperado = 1;

  fs.readFileSync(cfg.file, 'utf8').split(/\r?\n/).forEach((line, i) => {
    if (!/^\|\s*\d/.test(line)) return;
    const row = parseRow(line);
    if (!row) return;
    const donde = `${key} línea ${i + 1}`;
    if (row.error) { errores.push(`${donde}: ${row.error} → ${line.trim()}`); return; }

    if (row.n !== esperado) errores.push(`${donde}: N° ${row.n}, se esperaba ${esperado}`);
    esperado = row.n + 1;

    if (byDni.has(row.dni)) errores.push(`${donde}: documento duplicado ${row.dni}`);

    // Coherencia puntaje ↔ condición
    const conPuntaje = row.cond <= 1;
    if (conPuntaje !== (row.puntaje !== null)) {
      errores.push(`${donde}: ${CONDS[row.cond]} con puntaje "${row.puntaje ?? '-'}"`);
    } else if (conPuntaje && (row.puntaje >= NOTA_MINIMA) !== (row.cond === 0)) {
      errores.push(`${donde}: puntaje ${row.puntaje} con condición ${CONDS[row.cond]}`);
    }

    byDni.set(row.dni, row);
    conteo[row.cond]++;
  });

  const resumen = CONDS.map((c, i) => conteo[i] && `${c}: ${conteo[i]}`).filter(Boolean).join(' · ');
  console.log(`  ${cfg.label}: ${byDni.size} filas (${resumen})`);
  return byDni;
}

/* ---------- Lector mínimo de .xlsx (zip + XML con celdas en línea) ---------- */
function readZip(file) {
  const buf = fs.readFileSync(file);
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error(`No es un zip válido: ${file}`);

  const entries = new Map();
  let p = buf.readUInt32LE(eocd + 16);
  const total = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < total; i++) {
    const method  = buf.readUInt16LE(p + 10);
    const size    = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extra   = buf.readUInt16LE(p + 30);
    const comment = buf.readUInt16LE(p + 32);
    const local   = buf.readUInt32LE(p + 42);
    const name    = buf.toString('utf8', p + 46, p + 46 + nameLen);
    entries.set(name, { method, size, local });
    p += 46 + nameLen + extra + comment;
  }

  return (name) => {
    const e = entries.get(name);
    if (!e) throw new Error(`No existe ${name} en ${path.basename(file)}`);
    const start = e.local + 30 + buf.readUInt16LE(e.local + 26) + buf.readUInt16LE(e.local + 28);
    const raw = buf.subarray(start, start + e.size);
    return (e.method === 8 ? zlib.inflateRawSync(raw) : raw).toString('utf8');
  };
}

const unxml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&amp;/g, '&');

// Devuelve las filas de datos (desde el encabezado N°) como { A: valor, B: valor, ... }
function readSheet(xml) {
  const rows = [];
  for (const [, body] of xml.matchAll(/<(?:x:)?row\b[^>]*>(.*?)<\/(?:x:)?row>/gs)) {
    const row = {};
    for (const [, col, inner] of body.matchAll(/<(?:x:)?c r="([A-Z]+)\d+"[^>]*?(?:\/>|>(.*?)<\/(?:x:)?c>)/gs)) {
      const v = inner && inner.match(/<(?:x:)?(?:v|t)[^>]*>(.*?)<\/(?:x:)?(?:v|t)>/s);
      if (v) row[col] = unxml(v[1]);
    }
    if (/^\d+$/.test(row.A || '')) rows.push(row);
  }
  return rows;
}

/* ---------- Validar los CALIFICA contra el Excel ---------- */
function validarExcel(key, byDni) {
  const cfg  = ETAPAS[key];
  const rows = readSheet(readZip(XLSX)(cfg.sheet));
  const enExcel = new Set();

  for (const r of rows) {
    const dni = r.C;
    enExcel.add(dni);
    const md = byDni.get(dni);
    const donde = `${key} Excel N° ${r.A} (${dni})`;
    if (!md) { errores.push(`${donde}: no está en el .md`); continue; }
    if (md.n !== parseInt(r.A, 10))          errores.push(`${donde}: N° ${md.n} en el .md`);
    if (md.tipo !== r.B)                     errores.push(`${donde}: tipo ${r.B} ≠ ${md.tipo}`);
    if (md.perfil !== parseInt(r.D, 10))     errores.push(`${donde}: perfil ${r.D} ≠ ${md.perfil}`);
    if (md.puntaje !== parseFloat(r.F))      errores.push(`${donde}: puntaje ${r.F} ≠ ${md.puntaje}`);
    if (CONDS[md.cond] !== r.G)              errores.push(`${donde}: condición ${r.G} ≠ ${CONDS[md.cond]}`);
    // El Excel recorta algunos nombres largos: basta con que el del .md empiece igual
    if (!md.nombre || !md.nombre.startsWith(r.E)) errores.push(`${donde}: nombre "${r.E}" ≠ "${md.nombre}"`);
  }

  for (const [dni, md] of byDni) {
    if (md.cond === 0 && !enExcel.has(dni)) errores.push(`${key}: CALIFICA ${dni} no está en el Excel`);
  }
  console.log(`  ${cfg.label}: ${rows.length} CALIFICA verificados contra el Excel`);
}

/* ---------- Combinar ambas etapas ---------- */
function combine(ptMap, paMap) {
  const allDnis = new Set([...ptMap.keys(), ...paMap.keys()]);
  const data = [];

  for (const dni of allDnis) {
    const pt = ptMap.get(dni) || null;
    const pa = paMap.get(dni) || null;
    if (!pt) errores.push(`pa: ${dni} no figura en conocimientos`);
    else if (pt.cond !== 0 && pa) errores.push(`pa: ${dni} rindió aptitud sin calificar en conocimientos`);
    if (pt && pa && pt.perfil !== pa.perfil) errores.push(`${dni}: perfil ${pt.perfil} (PT) ≠ ${pa.perfil} (PA)`);
    if (pt && pt.cond === 0 && !pa) errores.push(`pt: CALIFICA ${dni} no figura en aptitud`);

    const base = pt || pa;
    // [dni, nombre, perfil, pt_score, pt_cond, pa_score, pa_cond]
    data.push([
      dni,
      (pt && pt.nombre) || (pa && pa.nombre) || null,
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
  validarExcel('pt', ptMap);
  validarExcel('pa', paMap);

  const data = combine(ptMap, paMap);

  if (errores.length) {
    console.error(`\n${errores.length} error(es); no se escribió el archivo:`);
    errores.slice(0, 50).forEach((e) => console.error('  ' + e));
    if (errores.length > 50) console.error(`  … y ${errores.length - 50} más`);
    process.exit(1);
  }

  console.log(`  Total combinado: ${data.length} postulantes`);

  const payload = {
    pub: {
      pt: ETAPAS.pt.pub,
      pa: ETAPAS.pa.pub,
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
