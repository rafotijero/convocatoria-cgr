/*
 * Genera js/evaluaciones-data.js a partir de los resultados de evaluaciones.
 * Fuentes (archivos/04 Evaluaciones):
 *   - CPM_06_2026_Resultados_Evaluacion_Conocimientos.md  (PT, peso 30%) — todos los postulantes
 *   - CPM_06_2026_Resultados_Evaluación_Aptitud.md        (PA, peso 20%) — todos los evaluados
 *   - CPM_06_2026_Califica_Conocimientos_Aptitud.xlsx     solo CALIFICA; se usa para validar
 * Fuentes (archivos/05 Curricular/Corregido: incluyen la última página, escaneada, de cada PDF):
 *   - CPM_06_2026_Resultados_Eva_Curricular_CORREGIDO.md         (EC, peso 30%) — todos los evaluados (versión del 17/11)
 *   - CPM_06_2026_Resultados_Eva_Curricular_CORREGIDO.xlsx       todas las filas; se usa para validar
 *   - CPM_06_2026_Resultados_Evaluacion_Curricular_CORREGIDO.md/.xlsx  publicación del 12/11, reemplazada;
 *     solo para js/cambios-ec-data.js (reporte de cambios)
 * Fuentes (archivos/06 Entrevistas):
 *   - CPM_06_2026_Programacion_Entrevista_Personal.md     panel, fecha y hora de cada finalista
 *   - CPM_06_2026_Programacion_Entrevista_Personal.xlsx   todas las filas; se usa para validar
 *   - CPM_06_2026_Resultados_Etapa_Entrevista_Personal.md   (EP, peso 20%) — todos los entrevistados
 *   - CPM_06_2026_Resultados_Etapa_Entrevista_Personal.xlsx todas las filas; se usa para validar
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
const DIR_05  = path.join(ROOT, 'archivos', '05 Curricular', 'Corregido');
const OUT_CAMBIOS = path.join(ROOT, 'js', 'cambios-ec-data.js');
const DIR_06  = path.join(ROOT, 'archivos', '06 Entrevistas');
const PROG = {
  file: path.join(DIR_06, 'CPM_06_2026_Programacion_Entrevista_Personal.md'),
  xlsx: path.join(DIR_06, 'CPM_06_2026_Programacion_Entrevista_Personal.xlsx'),
  pub: '17 de noviembre de 2026',
  minutos: 15, // duración de cada entrevista
};
// Comunicado del 24/11: rectifica la curricular de algunos postulantes ("Dice" / "Debe decir")
// y programa la entrevista de quien pasó a CALIFICA. Transcripción del PDF escaneado.
const RECT = {
  file: path.join(ROOT, 'archivos', '05 Curricular', 'Comunicado261124.md'),
  pub: '24 de noviembre',
};
const EP = {
  file: path.join(DIR_06, 'CPM_06_2026_Resultados_Etapa_Entrevista_Personal.md'),
  xlsx: path.join(DIR_06, 'CPM_06_2026_Resultados_Etapa_Entrevista_Personal.xlsx'),
  pub: '25 de noviembre de 2026',
};

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
  ec: {
    file: path.join(DIR_05, 'CPM_06_2026_Resultados_Eva_Curricular_CORREGIDO.md'),
    xlsx: path.join(DIR_05, 'CPM_06_2026_Resultados_Eva_Curricular_CORREGIDO.xlsx'),
    curricular: true,
    label: 'EC – Curricular',
    pub: '17 de noviembre de 2026, rectificada el 24 de noviembre',
  },
  // Publicación anterior, reemplazada por la del 17/11. Solo se usa para el reporte de cambios.
  ecPrev: {
    file: path.join(DIR_05, 'CPM_06_2026_Resultados_Evaluacion_Curricular_CORREGIDO.md'),
    xlsx: path.join(DIR_05, 'CPM_06_2026_Resultados_Evaluacion_Curricular_CORREGIDO.xlsx'),
    curricular: true,
    label: 'EC – Curricular (12/11, reemplazada)',
    pub: '12 de noviembre de 2026',
  },
};

// 0 = CALIFICA, 1 = NO CALIFICA, 2 = DESCALIFICA, 3 = NO SE PRESENTÓ
const CONDS = ['CALIFICA', 'NO CALIFICA', 'DESCALIFICA', 'NO SE PRESENTÓ'];
const NOTA_MINIMA = 12;

const errores = [];
const avisos  = [];

// Clave de cruce sin ceros a la izquierda: un mismo carné de extranjería figura como
// 001721841 en conocimientos y 01721841 en curricular.
const docKey = (d) => String(d).replace(/^0+/, '');

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

/* ---------- Fila de curricular ---------- */
// | 1 | DNI | 46678978 | ALVA CUBAS, ROCIO | 403 | 16 | CALIFICA |   (la versión del 12/11 traía además "Página PDF")
// | 4915 | DNI | 76202661 |  | 544 |  | NO CALIFICA | 85 |   (sin nombre ni puntaje)
function parseRowEC(line) {
  const c = line.trim().replace(/^\||\|$/g, '').split('|').map((s) => s.trim());
  if (!/^\d+$/.test(c[0])) return null;
  if (c.length !== 7 && c.length !== 8) return { error: 'columnas inesperadas' };
  let [n, tipo, doc, nombre, perfil, puntaje, cond] = c;

  // Error OCR: | 4083 | DNI | 47277879 |  | ALTAMIRANO ..., JENNIFFER MARIA DEL MILAGRO 767 | 15 | CALIFICA |
  // el nombre quedó en la columna del perfil, seguido del número de perfil
  const corrido = !nombre && perfil.match(/^(\D.*?)\s+(\d+)$/);
  if (corrido) { nombre = corrido[1]; perfil = corrido[2]; }

  const condIdx = CONDS.indexOf(cond);
  if (!/^(DNI|CE)$/.test(tipo))                        return { error: `tipo de documento "${tipo}"` };
  if (!/^\d{8,9}$/.test(doc))                          return { error: `documento "${doc}"` };
  if (!/^\d+$/.test(perfil))                           return { error: `perfil "${perfil}"` };
  if (condIdx < 0)                                     return { error: `condición "${cond}"` };
  if (puntaje !== '' && !/^\d+(\.\d+)?$/.test(puntaje)) return { error: `puntaje "${puntaje}"` };

  return {
    n:       parseInt(n, 10),
    tipo,
    dni:     doc,
    perfil:  parseInt(perfil, 10),
    nombre:  nombre ? nombre.replace(/\s+/g, ' ') : null,
    puntaje: puntaje === '' ? null : parseFloat(puntaje),
    cond:    condIdx,
  };
}

/* ---------- Leer un .md completo → Map<dni, record> ---------- */
function parseStage(key) {
  const cfg = ETAPAS[key];
  const ec = Boolean(cfg.curricular);
  const parse = ec ? parseRowEC : parseRow;
  const byDni = new Map();
  const conteo = CONDS.map(() => 0);
  let esperado = 1;

  fs.readFileSync(cfg.file, 'utf8').split(/\r?\n/).forEach((line, i) => {
    if (!/^\|\s*\d/.test(line)) return;
    const row = parse(line);
    if (!row) return;
    const donde = `${key} línea ${i + 1}`;
    if (row.error) { errores.push(`${donde}: ${row.error} → ${line.trim()}`); return; }

    if (row.n !== esperado) errores.push(`${donde}: N° ${row.n}, se esperaba ${esperado}`);
    esperado = row.n + 1;

    if (byDni.has(row.dni)) errores.push(`${donde}: documento duplicado ${row.dni}`);

    // Coherencia puntaje ↔ condición. En curricular solo CALIFICA lleva puntaje (12 a 20)
    // y no existe NO SE PRESENTÓ.
    const conPuntaje = ec ? row.cond === 0 : row.cond <= 1;
    if (ec && row.cond === 3) {
      errores.push(`${donde}: NO SE PRESENTÓ no aplica en curricular`);
    } else if (ec && row.cond === 0 && !row.nombre) {
      errores.push(`${donde}: CALIFICA sin nombre`);
    } else if (row.puntaje !== null && row.puntaje > 20) {
      errores.push(`${donde}: puntaje ${row.puntaje} mayor que 20`);
    } else if (conPuntaje !== (row.puntaje !== null)) {
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

const unxml = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
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

/* ---------- Validar curricular contra su Excel (todas las filas) ---------- */
function validarExcelEC(key, byDni) {
  const cfg  = ETAPAS[key];
  const rows = readSheet(readZip(cfg.xlsx)('xl/worksheets/sheet1.xml'));
  if (rows.length !== byDni.size) errores.push(`${key}: ${rows.length} filas en el Excel y ${byDni.size} en el .md`);

  for (const r of rows) {
    const dni = r.C;
    const md = byDni.get(dni);
    const donde = `${key} Excel N° ${r.A} (${dni})`;
    if (!md) { errores.push(`${donde}: no está en el .md`); continue; }
    const puntaje = r.F === undefined ? null : parseFloat(r.F);
    // El Excel sale de la misma conversión y repite el nombre corrido a la columna del perfil
    const corrido = !r.D && r.E && r.E.match(/^(\D.*?)\s+(\d+)$/);
    if (corrido) { r.D = corrido[1]; r.E = corrido[2]; }
    if (md.n !== parseInt(r.A, 10))      errores.push(`${donde}: N° ${md.n} en el .md`);
    if (md.tipo !== r.B)                 errores.push(`${donde}: tipo ${r.B} ≠ ${md.tipo}`);
    if (md.perfil !== parseInt(r.E, 10)) errores.push(`${donde}: perfil ${r.E} ≠ ${md.perfil}`);
    if (md.puntaje !== puntaje)          errores.push(`${donde}: puntaje ${r.F} ≠ ${md.puntaje}`);
    if (CONDS[md.cond] !== r.G)          errores.push(`${donde}: condición ${r.G} ≠ ${CONDS[md.cond]}`);
    if ((md.nombre || '') !== (r.D || '')) errores.push(`${donde}: nombre "${r.D}" ≠ "${md.nombre}"`);
  }
  console.log(`  ${cfg.label}: ${rows.length} filas verificadas contra el Excel`);
}

/* ---------- Diferencias con la publicación curricular anterior ---------- */
// Devuelve [dni, ec_score_anterior, ec_cond_anterior] solo de quienes cambiaron, con el
// documento tal como figura en data. null en la condición = no figuraba.
function diffCurricular(data, prevMap) {
  const prevPorKey = new Map([...prevMap.values()].map((r) => [docKey(r.dni), r]));
  const usados = new Set();
  const cambios = [];

  for (const r of data) {
    const key  = docKey(r[0]);
    const prev = prevPorKey.get(key) || null;
    if (prev) {
      usados.add(key);
      if (prev.perfil !== r[2]) errores.push(`ecPrev: ${prev.dni} perfil ${prev.perfil} ≠ ${r[2]}`);
    }
    const pScore = prev ? prev.puntaje : null;
    const pCond  = prev ? prev.cond    : null;
    if (pScore !== r[7] || pCond !== r[8]) cambios.push([r[0], pScore, pCond]);
  }
  for (const [key, prev] of prevPorKey) {
    if (!usados.has(key)) errores.push(`ecPrev: ${prev.dni} no figura en conocimientos ni aptitud`);
  }
  console.log(`  Cambios respecto de la publicación del ${ETAPAS.ecPrev.pub}: ${cambios.length}`);
  return cambios;
}

/* ---------- Combinar las etapas ---------- */
function combine(ptMap, paMap, ecMap) {
  const allDnis = new Set([...ptMap.keys(), ...paMap.keys()]);
  const data = [];

  // Curricular se cruza por docKey; se conserva el documento tal como figura en conocimientos
  const ecPorKey = new Map([...ecMap.values()].map((r) => [docKey(r.dni), r]));
  const ecUsados = new Set();

  for (const dni of allDnis) {
    const pt = ptMap.get(dni) || null;
    const pa = paMap.get(dni) || null;
    if (!pt) errores.push(`pa: ${dni} no figura en conocimientos`);
    else if (pt.cond !== 0 && pa) errores.push(`pa: ${dni} rindió aptitud sin calificar en conocimientos`);
    if (pt && pa && pt.perfil !== pa.perfil) errores.push(`${dni}: perfil ${pt.perfil} (PT) ≠ ${pa.perfil} (PA)`);
    if (pt && pt.cond === 0 && !pa) errores.push(`pt: CALIFICA ${dni} no figura en aptitud`);

    const base = pt || pa;
    const ec = ecPorKey.get(docKey(dni)) || null;
    if (ec) {
      ecUsados.add(docKey(dni));
      if (!pa || pa.cond !== 0) errores.push(`ec: ${ec.dni} figura en curricular sin calificar en aptitud`);
      if (ec.perfil !== base.perfil) errores.push(`${dni}: perfil ${base.perfil} (PT) ≠ ${ec.perfil} (EC)`);
    } else if (pa && pa.cond === 0) {
      // La publicación oficial omite a algunos CALIFICA de aptitud: no se les asigna condición
      avisos.push(`${dni} (perfil ${pa.perfil}, ${pa.nombre}) calificó en aptitud y no figura en curricular`);
    }

    // [dni, nombre, perfil, pt_score, pt_cond, pa_score, pa_cond, ec_score, ec_cond] (+ ep_score, ep_cond)
    data.push([
      dni,
      (pt && pt.nombre) || (pa && pa.nombre) || (ec && ec.nombre) || null,
      base.perfil,
      pt ? pt.puntaje : null,
      pt ? pt.cond    : null,
      pa ? pa.puntaje : null,
      pa ? pa.cond    : null,
      ec ? ec.puntaje : null,
      ec ? ec.cond    : null,
    ]);
  }

  for (const [key, ec] of ecPorKey) {
    if (!ecUsados.has(key)) errores.push(`ec: ${ec.dni} no figura en conocimientos ni aptitud`);
  }

  data.sort((a, b) => a[0].localeCompare(b[0]));
  return data;
}

/* ---------- Rectificación de la curricular (comunicado del 24/11) ---------- */
// Lee las tablas "Dice", "Debe decir" y la programación de entrevista del comunicado.
// Cada fila de "Dice" debe coincidir con la publicación curricular (N°, documento, perfil,
// puntaje y condición); luego se aplica "Debe decir" sobre ecMap. Devuelve las citas nuevas.
function rectificacion(ecMap) {
  const tablas = { dice: [], debe: [], cita: [] };
  let actual = null;
  fs.readFileSync(RECT.file, 'utf8').split(/\r?\n/).forEach((line) => {
    if (/^###\s+Dice/.test(line)) actual = 'dice';
    else if (/^###\s+Debe decir/.test(line)) actual = 'debe';
    else if (/^###\s+Etapa de Entrevista/.test(line)) actual = 'cita';
    else if (actual && /^\|\s*\d/.test(line)) tablas[actual].push(line.trim().replace(/^\||\|$/g, '').split('|').map((s) => s.trim()));
  });
  if (!tablas.dice.length || tablas.dice.length !== tablas.debe.length) {
    errores.push(`rectificación: ${tablas.dice.length} filas en "Dice" y ${tablas.debe.length} en "Debe decir"`);
    return [];
  }

  const leer = ([n, tipo, doc, , perfil, puntaje, cond]) =>
    ({ n: +n, tipo, doc, perfil: +perfil, puntaje: puntaje === '-' || puntaje === '' ? null : parseFloat(puntaje), cond: CONDS.indexOf(cond) });
  tablas.dice.forEach((c, i) => {
    const dice = leer(c), debe = leer(tablas.debe[i]);
    const donde = `rectificación N° ${dice.n} (${dice.doc})`;
    const ec = ecMap.get(dice.doc);
    if (!ec) { errores.push(`${donde}: no figura en la curricular`); return; }
    if (debe.doc !== dice.doc || debe.n !== dice.n || debe.perfil !== dice.perfil) errores.push(`${donde}: "Debe decir" no corresponde a la misma fila`);
    if (ec.n !== dice.n || ec.perfil !== dice.perfil || ec.puntaje !== dice.puntaje || ec.cond !== dice.cond) {
      errores.push(`${donde}: "Dice" no coincide con la publicación (${ec.puntaje ?? '-'} ${CONDS[ec.cond]})`);
    }
    if (debe.cond < 0 || (debe.cond === 0) !== (debe.puntaje !== null && debe.puntaje >= NOTA_MINIMA)) errores.push(`${donde}: "Debe decir" incoherente`);
    ec.puntaje = debe.puntaje;
    ec.cond = debe.cond;
    if (!ec.nombre && c[3]) ec.nombre = c[3];
  });
  console.log(`  Rectificación del ${RECT.pub}: ${tablas.dice.length} resultados curriculares corregidos, ${tablas.cita.length} cita(s) nueva(s)`);
  return tablas.cita;
}

/* ---------- Programación de entrevistas ---------- */
// | 1 | DNI | 70032027 | ACHANCARAY NINANTAY, CINDY KIABETH | 471 | PANEL 01 | 18/11/2026 | 10:00:00 | 10:15:00 |
// Devuelve { dias: ['2026-11-18', …], data: [[dni, panel, iDia, inicio, fin]] } con las horas
// en minutos desde la medianoche y el documento tal como figura en data.
function programacion(data, citasExtra = []) {
  const aMin = (h) => { const m = h.match(/^(\d{2}):(\d{2}):00$/); return m ? +m[1] * 60 + +m[2] : null; };
  const aIso = (f) => { const m = f.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };

  // Finalistas: CALIFICA en conocimientos, aptitud y curricular
  const finalistas = new Map(data.filter((r) => r[4] === 0 && r[6] === 0 && r[8] === 0).map((r) => [docKey(r[0]), r]));
  const filas = [];
  let esperado = 1;

  fs.readFileSync(PROG.file, 'utf8').split(/\r?\n/).forEach((line, i) => {
    if (!/^\|\s*\d/.test(line)) return;
    const c = line.trim().replace(/^\||\|$/g, '').split('|').map((s) => s.trim());
    const donde = `entrevista línea ${i + 1}`;
    if (c.length !== 9) { errores.push(`${donde}: columnas inesperadas → ${line.trim()}`); return; }
    const [n, tipo, doc, nombre, perfil, panel, fecha, ini, fin] = c;
    const p = panel.match(/^PANEL (\d{2})$/);
    const fila = { n: +n, tipo, doc, nombre, perfil: +perfil, panel: p ? +p[1] : null, dia: aIso(fecha), ini: aMin(ini), fin: aMin(fin) };
    if (fila.n !== esperado) errores.push(`${donde}: N° ${n}, se esperaba ${esperado}`);
    esperado = fila.n + 1;
    if (!/^(DNI|CE)$/.test(tipo) || !/^\d{8,9}$/.test(doc)) errores.push(`${donde}: documento "${tipo} ${doc}"`);
    if (fila.panel === null || !fila.dia || fila.ini === null || fila.fin === null) { errores.push(`${donde}: panel, fecha u hora inválidos → ${line.trim()}`); return; }
    if (fila.fin - fila.ini !== PROG.minutos) errores.push(`${donde}: dura ${fila.fin - fila.ini} min`);
    filas.push(fila);
  });

  // Validar contra el Excel (todas las filas)
  const rows = readSheet(readZip(PROG.xlsx)('xl/worksheets/sheet1.xml'));
  if (rows.length !== filas.length) errores.push(`entrevista: ${rows.length} filas en el Excel y ${filas.length} en el .md`);
  rows.forEach((r, i) => {
    const f = filas[i];
    const md = f ? [f.n, f.tipo, f.doc, f.nombre, f.perfil, `PANEL ${String(f.panel).padStart(2, '0')}`] : [];
    const xl = [+r.A, r.B, r.C, r.D, +r.E, r.F];
    if (!f || md.some((v, k) => v !== xl[k]) || aIso(r.G) !== f.dia || aMin(r.H) !== f.ini || aMin(r.I) !== f.fin) {
      errores.push(`entrevista Excel N° ${r.A}: no coincide con el .md`);
    }
  });

  // Citas programadas después, por comunicado (sin N° correlativo en la programación)
  citasExtra.forEach(([n, tipo, doc, nombre, perfil, panel, fecha, ini, fin]) => {
    const p = panel.match(/^PANEL (\d{2})$/);
    const fila = { n: `comunicado ${n}`, tipo, doc, nombre, perfil: +perfil, panel: p ? +p[1] : null, dia: aIso(fecha), ini: aMin(ini), fin: aMin(fin) };
    if (fila.panel === null || !fila.dia || fila.ini === null || fila.fin === null) { errores.push(`cita del comunicado ${doc}: panel, fecha u hora inválidos`); return; }
    if (fila.fin - fila.ini !== PROG.minutos) errores.push(`cita del comunicado ${doc}: dura ${fila.fin - fila.ini} min`);
    filas.push(fila);
  });

  // Cruce con los finalistas
  const vistos = new Set();
  for (const f of filas) {
    const key = docKey(f.doc);
    const r = finalistas.get(key);
    if (vistos.has(key)) errores.push(`entrevista N° ${f.n}: documento ${f.doc} repetido`);
    vistos.add(key);
    if (!r) errores.push(`entrevista N° ${f.n}: ${f.doc} no es finalista (CALIFICA en PT, PA y EC)`);
    else if (r[2] !== f.perfil) errores.push(`entrevista N° ${f.n}: ${f.doc} perfil ${f.perfil} ≠ ${r[2]}`);
  }
  for (const [key, r] of finalistas) if (!vistos.has(key)) errores.push(`entrevista: el finalista ${r[0]} no tiene cita`);

  // Un panel no puede tener dos entrevistas que se crucen
  const porPanel = new Map();
  filas.forEach((f) => { const k = `${f.panel}|${f.dia}`; if (!porPanel.has(k)) porPanel.set(k, []); porPanel.get(k).push(f); });
  porPanel.forEach((fs_, k) => {
    fs_.sort((a, b) => a.ini - b.ini);
    for (let i = 1; i < fs_.length; i++) {
      if (fs_[i].ini < fs_[i - 1].fin) errores.push(`entrevista: panel ${k} cruza N° ${fs_[i - 1].n} y N° ${fs_[i].n}`);
    }
  });

  const dias = [...new Set(filas.map((f) => f.dia))].sort();
  const paneles = new Set(filas.map((f) => f.panel)).size;
  console.log(`  Entrevistas: ${filas.length} citas en ${paneles} paneles y ${dias.length} días, verificadas contra el Excel y los finalistas`);
  return {
    pub: PROG.pub,
    dias,
    data: filas.map((f) => [finalistas.get(docKey(f.doc)) ? finalistas.get(docKey(f.doc))[0] : f.doc, f.panel, dias.indexOf(f.dia), f.ini, f.fin]),
  };
}

/* ---------- Resultados de la entrevista personal ---------- */
// | 1 | DNI | 41659364 | ACUÑA ROMAN, GUILER | 471 | 12.5 | CALIFICA |
// | 3968 | DNI | 71037209 |  | 471 | - | DESCALIFICA |   (sin nombre ni puntaje)
// Agrega a cada registro de data [.., ep_score, ep_cond]. Exige que cada finalista tenga resultado
// y que puntaje y condición sean coherentes; quien figura sin ser finalista se informa como aviso.
function entrevista(data) {
  const porKey = new Map(data.map((r) => [docKey(r[0]), r]));
  const finalista = (r) => r[4] === 0 && r[6] === 0 && r[8] === 0;
  const filas = [];
  const conteo = CONDS.map(() => 0);
  let esperado = 1;

  fs.readFileSync(EP.file, 'utf8').split(/\r?\n/).forEach((line, i) => {
    if (!/^\|\s*\d/.test(line)) return;
    const c = line.trim().replace(/^\||\|$/g, '').split('|').map((s) => s.trim());
    const donde = `ep línea ${i + 1}`;
    if (c.length !== 7) { errores.push(`${donde}: columnas inesperadas → ${line.trim()}`); return; }
    const [n, tipo, doc, nombre, perfil, puntaje, cond] = c;
    const condIdx = CONDS.indexOf(cond);
    if (+n !== esperado) errores.push(`${donde}: N° ${n}, se esperaba ${esperado}`);
    esperado = +n + 1;
    if (!/^(DNI|CE)$/.test(tipo) || !/^\d{8,9}$/.test(doc)) { errores.push(`${donde}: documento "${tipo} ${doc}"`); return; }
    if (!/^\d+$/.test(perfil)) { errores.push(`${donde}: perfil "${perfil}"`); return; }
    if (condIdx < 0) { errores.push(`${donde}: condición "${cond}"`); return; }
    if (puntaje !== '-' && !/^\d+(\.\d+)?$/.test(puntaje)) { errores.push(`${donde}: puntaje "${puntaje}"`); return; }
    const f = { n: +n, tipo, doc, nombre: nombre || null, perfil: +perfil, puntaje: puntaje === '-' ? null : parseFloat(puntaje), cond: condIdx };

    // CALIFICA con 12 a 20; NO CALIFICA con menos de 12 (sin puntaje se avisa);
    // DESCALIFICA y NO SE PRESENTÓ sin puntaje
    if (f.puntaje !== null && f.puntaje > 20) errores.push(`${donde}: puntaje ${f.puntaje} mayor que 20`);
    else if (f.cond === 0 && (f.puntaje === null || f.puntaje < NOTA_MINIMA)) errores.push(`${donde}: CALIFICA con puntaje "${puntaje}"`);
    else if (f.cond === 1 && f.puntaje !== null && f.puntaje >= NOTA_MINIMA) errores.push(`${donde}: NO CALIFICA con puntaje ${f.puntaje}`);
    else if (f.cond === 1 && f.puntaje === null) avisos.push(`entrevista N° ${f.n}: ${f.doc} (perfil ${f.perfil}) NO CALIFICA sin puntaje`);
    else if (f.cond >= 2 && f.puntaje !== null) errores.push(`${donde}: ${cond} con puntaje ${f.puntaje}`);
    if (f.cond === 0 && !f.nombre) errores.push(`${donde}: CALIFICA sin nombre`);

    filas.push(f);
    conteo[f.cond]++;
  });

  // Validar contra el Excel (todas las filas)
  const rows = readSheet(readZip(EP.xlsx)('xl/worksheets/sheet1.xml'));
  if (rows.length !== filas.length) errores.push(`ep: ${rows.length} filas en el Excel y ${filas.length} en el .md`);
  rows.forEach((r, i) => {
    const f = filas[i];
    const xlPuntaje = r.F === undefined || r.F === '-' ? null : parseFloat(r.F);
    if (!f || f.n !== +r.A || f.tipo !== r.B || f.doc !== r.C || (f.nombre || '') !== (r.D || '') ||
        f.perfil !== +r.E || f.puntaje !== xlPuntaje || CONDS[f.cond] !== r.G) {
      errores.push(`ep Excel N° ${r.A} (${r.C}): no coincide con el .md`);
    }
  });

  // Cruce con los registros: mismo perfil y una sola vez; cada finalista debe tener resultado
  const vistos = new Set();
  for (const f of filas) {
    const key = docKey(f.doc);
    const r = porKey.get(key);
    if (vistos.has(key)) { errores.push(`ep N° ${f.n}: documento ${f.doc} repetido`); continue; }
    vistos.add(key);
    if (!r) { errores.push(`ep N° ${f.n}: ${f.doc} no figura en conocimientos`); continue; }
    if (r[2] !== f.perfil) errores.push(`ep N° ${f.n}: ${f.doc} perfil ${f.perfil} ≠ ${r[2]}`);
    if (!finalista(r)) avisos.push(`entrevista N° ${f.n}: ${f.doc} (perfil ${f.perfil}) figura en la entrevista sin ser finalista (EC: ${r[8] === null ? 'sin resultado' : CONDS[r[8]]})`);
    if (f.nombre && r[1] && f.nombre !== r[1]) avisos.push(`entrevista N° ${f.n}: ${f.doc} nombre "${f.nombre}" ≠ "${r[1]}"`);
    r[9] = f.puntaje;
    r[10] = f.cond;
  }
  for (const [key, r] of porKey) if (finalista(r) && !vistos.has(key)) errores.push(`ep: el finalista ${r[0]} no tiene resultado de entrevista`);

  const resumen = CONDS.map((c, i) => conteo[i] && `${c}: ${conteo[i]}`).filter(Boolean).join(' · ');
  console.log(`  EP – Entrevista: ${filas.length} filas (${resumen}), verificadas contra el Excel y los finalistas`);
}

/* ---------- Main ---------- */
function main() {
  console.log('Generando js/evaluaciones-data.js…');

  const ptMap = parseStage('pt');
  const paMap = parseStage('pa');
  const ecMap = parseStage('ec');
  const ecPrevMap = parseStage('ecPrev');
  validarExcel('pt', ptMap);
  validarExcel('pa', paMap);
  validarExcelEC('ec', ecMap);
  const citasExtra = rectificacion(ecMap);
  validarExcelEC('ecPrev', ecPrevMap);

  const data = combine(ptMap, paMap, ecMap);
  const cambios = diffCurricular(data, ecPrevMap);
  const citas = programacion(data, citasExtra);
  entrevista(data);

  if (errores.length) {
    console.error(`\n${errores.length} error(es); no se escribió el archivo:`);
    errores.slice(0, 50).forEach((e) => console.error('  ' + e));
    if (errores.length > 50) console.error(`  … y ${errores.length - 50} más`);
    process.exit(1);
  }

  if (avisos.length) {
    console.warn(`\n${avisos.length} aviso(s):`);
    avisos.forEach((a) => console.warn('  ' + a));
    console.warn('');
  }

  console.log(`  Total combinado: ${data.length} postulantes`);

  const payload = {
    pub: {
      pt: ETAPAS.pt.pub,
      pa: ETAPAS.pa.pub,
      ec: ETAPAS.ec.pub,
      ep: EP.pub,
    },
    data,
    // Programación de la entrevista: [dni, panel, índice en dias, inicio, fin] (minutos)
    citas,
  };

  const header = `/* Generado por tools/generar-evaluaciones.js — ${new Date().toISOString().slice(0, 10)}. No editar a mano. */\n`;
  const body   = `window.CPM_EVAL = ${JSON.stringify(payload)};\n`;
  fs.writeFileSync(OUT, header + body, 'utf8');

  const kb = (Buffer.byteLength(body) / 1024).toFixed(0);
  console.log(`Escrito: js/evaluaciones-data.js (${kb} KB, ${data.length} registros)`);

  // Reporte de cambios: la página reconstruye la publicación anterior reemplazando
  // la curricular de estos registros en CPM_EVAL.
  const bodyCambios = `window.CPM_EC_PREV = ${JSON.stringify({ pub: ETAPAS.ecPrev.pub, cambios })};\n`;
  fs.writeFileSync(OUT_CAMBIOS, header + bodyCambios, 'utf8');
  console.log(`Escrito: js/cambios-ec-data.js (${cambios.length} cambios)`);
}

main();
