/*
 * Genera js/resultados-data.js a partir de las publicaciones del CPM N° {CPM}-2026-CG.
 *  - Resultados de inscripción virtual (.md): documento, nombres, perfil y condición.
 *  - Sedes de evaluación (.md): catálogo de locales (sede, local, dirección) y
 *    distribución de los postulantes que CALIFICAN (local y aula).
 * Ambos se cruzan por N° de documento + código de perfil; el script falla si
 * algún postulante que CALIFICA queda sin local o si sobra alguna fila.
 * Uso: node tools/generar-resultados.js [número de concurso, ej. 06] (por defecto 06)
 */
const fs = require('fs');
const path = require('path');

const CPM = (process.argv[2] || '06').padStart(2, '0');
const ROOT = path.resolve(__dirname, '..');
const MD_INS = path.join(ROOT, 'archivos', '02 AptosFichaInscripcion', `CPM_${CPM}_2026_resultados_de_inscripcion_virtual.md`);
const MD_SEDES = path.join(ROOT, 'archivos', '03 SedesEvaluacion', `CPM_${CPM}_2026_Sedes-Evaluacion.md`);
const OUT = path.join(ROOT, 'js', 'resultados-data.js');

const CONDS = ['CALIFICA', 'NO CALIFICA', 'DESCALIFICA', 'DESCALIFICA*'];

const squash = (s) => (s || '').replace(/\s+/g, ' ').trim();
const fail = (msg) => { console.error('ERROR: ' + msg); process.exit(1); };

/* Filas de tablas markdown: devuelve las celdas de cada línea que empieza con "|" */
function filas(file) {
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.startsWith('|'))
    .map((l) => l.split('|').slice(1, -1).map(squash));
}

const fechaDe = (texto) => {
  const m = texto.match(/Lima,\s*(\d{1,2} de \w+ de \d{4})/);
  return m ? m[1] : '';
};

const clave = (doc, perfil) => `${parseInt(doc, 10)}|${parseInt(perfil, 10)}`;

/* ---------- Sedes: catálogo de locales y distribución ---------- */
const txtSedes = fs.readFileSync(MD_SEDES, 'utf8');
const filasSedes = filas(MD_SEDES);

// El nombre de dos locales de Lima indica que atienden a postulantes con
// discapacidad; se omite esa etiqueta para no exponer ese dato por persona.
const nombreLocal = (s) => s.replace(/\s*-\s*POSTULANTES CON DISCAPACIDAD/i, '');
// Errata de la publicación, presente en nombres de local y en una dirección
const corregir = (s) => s.replace(/\bUNIVESIDAD\b/g, 'UNIVERSIDAD');

const sedes = [];
const locales = []; // [sedeIdx, nombre, dirección]
const localIdx = new Map(); // nombre original -> índice
filasSedes
  .filter((c) => c.length === 3 && c[0] !== 'SEDE' && !/^-+$/.test(c[0]))
  .forEach(([sede, local, direccion]) => {
    if (!sedes.includes(sede)) sedes.push(sede);
    if (localIdx.has(local)) fail(`local repetido en el catálogo: ${local}`);
    localIdx.set(local, locales.length);
    locales.push([sedes.indexOf(sede), corregir(nombreLocal(local)), corregir(direccion)]);
  });
if (!locales.length) fail('no se encontró el catálogo de locales');

// La sede de cada fila se deriva del local: en el detalle viene sin la ciudad
// y en algunas filas quedó pegada al nombre del postulante.
const asignacion = new Map(); // doc|perfil -> [localIdx, aula]
filasSedes
  .filter((c) => c.length === 8 && /^\d+$/.test(c[0]))
  .forEach((c) => {
    const k = clave(c[2], c[3]);
    const li = localIdx.get(c[6]);
    if (li === undefined) fail(`local fuera del catálogo: "${c[6]}" (fila ${c[0]})`);
    if (!/^\d+$/.test(c[7])) fail(`aula no numérica: "${c[7]}" (fila ${c[0]})`);
    if (asignacion.has(k)) fail(`postulante repetido en sedes: ${k}`);
    asignacion.set(k, [li, parseInt(c[7], 10)]);
  });

const mEval = txtSedes.match(/se llevarán a cabo el (\d{1,2} de \w+)/);
const mIngreso = txtSedes.match(/iniciará a las ([\d:]+ [ap]\.m\.) y culminará a las ([\d:]+ [ap]\.m\.)/);
const fechaSedes = fechaDe(txtSedes);
const anio = (fechaSedes.match(/\d{4}$/) || [''])[0];

/* ---------- Inscripción: postulantes y condición ---------- */
const stats = { total: 0, califica: 0, noCalifica: 0, descalifica: 0 };
const usados = new Set();
const data = filas(MD_INS)
  .filter((c) => c.length === 6 && /^\d+$/.test(c[0]))
  .map((c) => {
    const cond = CONDS.indexOf(c[5]);
    if (cond < 0) fail(`condición desconocida: "${c[5]}" (fila ${c[0]})`);
    const reg = [parseInt(c[2], 10), c[3], parseInt(c[4], 10), cond];
    stats.total++;
    if (cond === 0) stats.califica++;
    else if (cond === 1) stats.noCalifica++;
    else stats.descalifica++;

    const k = clave(c[2], c[4]);
    const asg = asignacion.get(k);
    if (cond === 0) {
      if (!asg) fail(`postulante que CALIFICA sin local asignado: ${c[2]} (perfil ${c[4]})`);
      reg.push(asg[0], asg[1]);
      usados.add(k);
    } else if (asg) {
      fail(`postulante con local asignado pero condición ${c[5]}: ${c[2]} (perfil ${c[4]})`);
    }
    return reg;
  });
if (usados.size !== asignacion.size) {
  fail(`${asignacion.size - usados.size} filas de sedes no corresponden a ningún postulante inscrito`);
}

const out = {
  fecha: fechaDe(fs.readFileSync(MD_INS, 'utf8')),
  fechaSedes,
  evaluacion: {
    fecha: mEval ? `${mEval[1]} de ${anio}` : '',
    ingreso: mIngreso ? `${mIngreso[1]} a ${mIngreso[2]}` : '',
  },
  conds: CONDS,
  stats,
  sedes,
  locales,
  data, // [doc, nombre, perfil, condIdx] + [localIdx, aula] si CALIFICA
};

fs.writeFileSync(OUT, `window.CPM_RESULTADOS = ${JSON.stringify(out)};\n`);
console.log(`${path.relative(ROOT, OUT)}: ${data.length} postulantes, ${asignacion.size} con local (${sedes.length} sedes, ${locales.length} locales)`);
