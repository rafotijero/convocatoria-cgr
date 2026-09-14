/*
 * Genera js/data.js a partir de los anexos del CPM N° 05-2026-CG.
 *  - Anexo 2 (.md): consolidado de puestos, remuneración.
 *  - Anexo 3 (.md): identificación, misión, funciones, ofimática/idiomas.
 *  - Anexo 3 (.pdf vía pdftotext -layout): formación, conocimientos, cursos,
 *    experiencia, habilidades, requisitos adicionales y lugares (en el .md
 *    esas tablas quedaron desordenadas).
 * Uso: node tools/generar-datos.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const MD2 = path.join(ROOT, 'CPM_05_2026_Anexo2.md');
const MD3 = path.join(ROOT, 'CPM_05_2026_Anexo3.md');
const PDF3 = path.join(ROOT, 'CPM_05_2026_Anexo3.pdf');
const OUT = path.join(ROOT, 'js', 'data.js');

const squash = (s) => (s || '').replace(/\s+/g, ' ').trim();

/* ---------- Texto legible (el origen está en MAYÚSCULAS) ---------- */
const KEEP_UPPER = new Set(('OECE SERUMS SAC SUNAFIL OCI OCIS BIM IA CMS UX UI SEO GA4 WCAG HTML CSS SQL TIC NET PDF SIAF SIGA SEACE MEF SUNAT OSCE PCM PMI ISO ITIL COBIT NIIF NICSP NIA SNC CGR BI ETL API REST AWS GIS SIG SST TUO DNI PNP SP-ES SP-AP SP-EJ SP-DS II III IV VI VII VIII IX XI XII A-IIB A-IIA A-IIIA A-IIIB A-IIIC ENC TSRA PAS PAD RNSSC REDAM REDERECI SECIGRA SUNEDU INEI MYPE RUC ONP AFP EPS IPRESS SIS MINSA ESSALUD SUSALUD OEFA SENACE SUNARP INDECOPI PROVIAS SEDAPAL APP OXI UGEL DRE GORE MML JNE ONPE RENIEC MIDIS MIMP MTC MVCS MINEDU MINAM MIDAGRI MINCETUR MINEM MININTER MINDEF MINJUSDH MRE MEF CEPLAN SNIP ERP NTP NTS RNE SGSI PMBOK SCRUM DEVOPS BPMN UML JSON XML PHP ITSM CRM KPI OKR PPR POI PEI PDP PDRC PMI SIGEP SIGA-MEF SAP LOPD LPAG CAS SNA SNPMGI BCP AIRHSP PLAME PDT CTS SCTR CAD GPS CCTV SOC SIEM NIST CISSP CISA CISM OSINERGMIN SUCAMEC CONADIS IGV ISC RUS RER EIA PAMA TDR EETT RCG FONCODES PRONIS PRONIED ARCC RCC ACFE CPA CIA CFE MOF ROF TUPA TUSNE MAPRO CAP PAP CPE').split(' '));
const LOWER_WORDS = new Set('de del la las los el y e o u a al en para por con sin sobre ante bajo entre hacia hasta desde según su sus un una unos unas que se lo le'.split(' '));
const ROMAN = /^(I|II|III|IV|V|VI|VII|VIII|IX|X)$/;

const isAcronym = (w) => {
  const u = w.toUpperCase();
  return KEEP_UPPER.has(u) || ROMAN.test(u) || /^[A-Z]{1,4}\d+$/i.test(w);
};

/** Restaura siglas, romanos y códigos dentro de un texto ya en minúsculas. */
function upperWords(text) {
  return text
    .replace(/[A-Za-zÁÉÍÓÚÑáéíóúñ0-9]+(?:-[A-Za-z0-9]+)*/g, (w) => (isAcronym(w) ? w.toUpperCase() : w))
    .replace(/\(([a-záéíóúñ]{3,8})\)/g, (m, w) => `(${w.toUpperCase()})`)
    .replace(/\b[a-z]\.[a-z]\.(?:[a-z]\.)?/g, (m) => m.toUpperCase());
}

/** Sentence case conservando siglas y romanos. */
function sentence(s) {
  s = squash(s);
  if (!s) return s;
  if (/[a-záéíóúñ]/.test(s)) return s; // ya tiene minúsculas
  let out = upperWords(s.toLowerCase());
  out = out.replace(/(^-?\s*|[.:]\s+|\s-\s+)([a-záéíóúñ¿¡"“])/g, (m, p, c) => p + c.toUpperCase());
  out = out
    .replace(/contraloría general de la república/gi, 'Contraloría General de la República')
    .replace(/sistema nacional de control/gi, 'Sistema Nacional de Control')
    .replace(/\bley n° /gi, 'Ley N° ')
    .replace(/\bn° /g, 'N° ')
    // "del Estado" / "al Estado" (gobierno), pero no "estado de los procesos", "adecuado estado", "su estado"…
    .replace(/\b(del|al) estado\b(?! (de (los|las|la|el|su|sus|conservación)|situacional|actual|operativo))/g, '$1 Estado')
    .replace(/\bestado peruano\b/g, 'Estado peruano')
    .replace(/decreto legislativo/gi, 'Decreto Legislativo')
    .replace(/\bperú\b/g, 'Perú')
    .replace(/\blima\b/g, 'Lima');
  return out;
}

/** Title case para nombres (órganos, puestos, lugares). */
function title(s) {
  s = squash(s);
  if (!s || /[a-záéíóúñ]/.test(s)) return s;
  return s
    .split(' ')
    .map((w, i) => {
      const lw = w.toLowerCase();
      if (/^\([A-ZÁÉÍÓÚÑ0-9&.\-]+\)[.,;:]?$/.test(w)) return w; // sigla entre paréntesis
      if (/^[A-Z](\.[A-Z])+\.?$/.test(w)) return w; // S.A.
      if (isAcronym(w.replace(/^[("'“]+|[)"'”.,;:]+$/g, ''))) return w;
      if (i > 0 && LOWER_WORDS.has(lw)) return lw;
      return lw.replace(/(^|[-("'“])([a-záéíóúñ])/g, (m, p, c) => p + c.toUpperCase());
    })
    .join(' ');
}

const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function toYears(s) {
  if (!s || /NO APLICA/.test(s)) return 0;
  const y = s.match(/(\d+(?:[.,]\d+)?)\s*AÑO/);
  const m = s.match(/(\d+)\s*MES/);
  let v = 0;
  if (y) v += parseFloat(y[1].replace(',', '.'));
  if (m) v += parseInt(m[1], 10) / 12;
  return Math.round(v * 100) / 100;
}

/* ---------- Anexo 2 ---------- */
function parseAnexo2() {
  const map = {};
  for (const line of fs.readFileSync(MD2, 'utf8').split(/\r?\n/)) {
    if (!/^\|\d{3} - 2026\|/.test(line)) continue;
    const c = line.split('|').slice(1, -1).map((x) => x.trim()).filter(Boolean);
    const [cod, tipo, categoria, unidad, puesto, n, lugar, rem] = c;
    let code = cod.slice(0, 3);
    if (map[code]) {
      // El Anexo 2 repite el código 341 (el segundo corresponde al perfil 342).
      const next = String(+code + 1).padStart(3, '0');
      console.log(`Anexo 2: código ${code} duplicado, se reasigna a ${next} (${lugar})`);
      code = next;
    }
    map[code] = {
      tipo, categoria, unidad, puesto,
      posiciones: parseInt(n, 10),
      lugarResumen: lugar,
      remuneracion: parseFloat(rem.replace(/S\/\.?\s*/, '').replace(/[^\d.]/g, '')),
    };
  }
  return map;
}

/* ---------- Anexo 3 (.md) ---------- */
const OFI_HEADER = '||NO APLICA|BÁSICO||INTERMEDIO|AVANZADO||NO APLICA|BÁSICO||INTERMEDIO|AVANZADO|';
const LEVELS = { 1: null, 2: 'Básico', 4: 'Intermedio', 5: 'Avanzado' };

function parseAnexo3Md() {
  const src = fs.readFileSync(MD3, 'utf8');
  const parts = src.split(/^## N° (\d{3})-2026\s*$/m);
  const map = {};
  for (let i = 1; i < parts.length; i += 2) {
    const code = parts[i];
    const body = parts[i + 1];
    const head = squash(body.slice(0, body.indexOf('|FUNCIONES DEL PUESTO|')));
    const m = head.match(/ÓRGANO:\s*(.*?)\s+UNIDAD ORGÁNICA:\s*(.*?)\s+NOMBRE DEL CARGO:\s*(.*?)\s+CLASIFICACIÓN:\s*(.*?)\s+NOMBRE DEL PUESTO:\s*(.*?)\s+DEPENDENCIA JERÁRQUICA:\s*(.*?)\s+N° DE POSICIONES:\s*(\d+)\s+CATEGORÍA REMUNERATIVA:\s*(.*?)\s+\*\*MISIÓN DEL PUESTO\*\*\s*(.*)$/);
    const rec = { code };
    if (m) {
      Object.assign(rec, {
        organo: m[1], unidadOrganica: m[2], cargo: m[3], clasificacion: m[4],
        puesto: m[5], dependencia: m[6], posiciones: +m[7], categoria: m[8], mision: m[9],
      });
    }
    const endFn = body.indexOf('CONDICIONES ATÍPICAS');
    const fnZone = endFn > 0 ? body.slice(0, endFn) : body;
    rec.funciones = [...fnZone.matchAll(/^\|(\d{1,2})\|(.+?)\|\s*$/gm)].map((x) => x[2].trim());

    const ofimatica = [];
    const idiomas = [];
    const lines = body.split(/\r?\n/);
    const hi = lines.findIndex((l) => l.trim() === OFI_HEADER);
    if (hi > 0) {
      for (let k = hi + 1; k < hi + 8 && k < lines.length; k++) {
        const c = lines[k].split('|').slice(1, -1).map((x) => x.trim());
        if (c.length < 12) continue;
        const lvl = (from) => { for (const j of [1, 2, 4, 5]) if (c[from + j] === 'X') return j; return -1; };
        const off = lvl(0);
        if (/^(PROCESADOR|HOJAS|PROGRAMA DE PRES)/.test(c[0]) && LEVELS[off]) ofimatica.push({ n: title(c[0]), v: LEVELS[off] });
        const lang = lvl(6);
        if (/^(INGLÉS|QUECHUA|AIMARA|PORTUGUÉS)/.test(c[6]) && LEVELS[lang]) idiomas.push({ n: title(c[6]), v: LEVELS[lang] });
      }
    }
    rec.ofimatica = hi > 0 ? ofimatica : null;
    rec.idiomas = hi > 0 ? idiomas : null;

    // Respaldos cuando el PDF viene dañado por firmas superpuestas.
    const flatMd = squash(body.replace(/\*\*/g, '').replace(/\|/g, ' '));
    rec.nivel = /UNIVERSITAR\S*\s+UNIVERSITARIA\s+X\b/.test(flatMd) ? 'Universitaria'
      : /TÉCNICA SUPERIOR\s+CA\s+\(3 O 4 AÑOS\)\s+X\b/.test(flatMd) ? 'Técnica superior'
      : /SECUNDA\S*\s*SECUNDARIA\s+X\b/.test(flatMd) ? 'Secundaria' : null;
    rec.habilidades = (flatMd.match(/HABILIDADES O COMPETENCIAS\s+(.*?)\s+REQUISITOS ADICIONALES/) || [])[1] || '';
    const li = body.indexOf('|LUGAR DE PRESTACIÓN|');
    if (li >= 0) {
      let seg = body.slice(li + '|LUGAR DE PRESTACIÓN|'.length);
      const f = seg.search(/Firmado digitalmente|^## /m);
      if (f >= 0) seg = seg.slice(0, f);
      rec.lugares = parseLugares(seg.replace(/\|/g, ' '));
    }
    map[code] = rec;
  }
  return map;
}

/* ---------- Anexo 3 (.pdf) ---------- */
function pdfText() {
  if (!fs.existsSync(PDF3)) {
    console.error(`Falta ${path.basename(PDF3)} en la raíz del proyecto (los PDF no se versionan; descárgalo del portal de la Contraloría).`);
    process.exit(1);
  }
  const tmp = path.join(os.tmpdir(), 'cpm05_anexo3_layout.txt');
  if (!fs.existsSync(tmp) || fs.statSync(tmp).mtimeMs < fs.statSync(PDF3).mtimeMs) {
    execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', PDF3, tmp]);
  }
  return fs.readFileSync(tmp, 'utf8');
}

/** Quita restos de firma digital superpuestos a una línea de contenido. */
function sanitizeLine(l) {
  if (!/\bFAU\b|Motivo:|Fecha:\s*\d|\b(soft|hard)\b/.test(l)) return l;
  const RUC = '20131378972';
  return l
    .split(/(\s{2,})/)
    .map((ch) => {
      if (/^\s*$/.test(ch)) return ch;
      let t = ch.replace(/Motivo:\s*Doy Visto Bueno/g, ' ').replace(/Fecha:\s*\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2}\s*-05:00/g, ' ');
      if (/\bFAU\b/.test(t)) {
        // "BERMUDEZ TORRES Marco Antonio FAU 20131378H97A2BILIDADES" → "HABILIDADES"
        t = t.replace(/^.*?\bFAU\s*(\S*)/, (m, tok) => {
          let rest = '';
          let j = 0;
          for (const c of tok) { if (j < RUC.length && c === RUC[j]) { j++; continue; } rest += c; }
          return rest;
        });
      }
      t = t.replace(/\b(soft|hard)\b/g, ' ');
      if (/[a-z]/.test(t) && /^[\sA-Za-zÁÉÍÓÚÑáéíóúñ'’.]+$/.test(t) && !/[A-ZÁÉÍÓÚÑ]{4,}\s+[A-ZÁÉÍÓÚÑ]{4,}/.test(t)) return ' ';
      return t;
    })
    .join('')
    .replace(/L\s*U\s*G\s*A\s*R\s+DE PRESTACI/, 'LUGAR DE PRESTACI');
}

/** Segunda pasada sobre el texto aplanado: restos de firma partidos en varios fragmentos. */
function cleanFlat(t) {
  const RUC = '20131378972';
  return squash(
    t
      .replace(/\b20131378[0-9A-ZÁÉÍÓÚÑ]*/g, (tok) => {
        let out = '';
        let j = 0;
        for (const c of tok) { if (j < RUC.length && c === RUC[j]) { j++; continue; } out += c; }
        return ` ${out}`;
      })
      .replace(/Motivo:\s*\S*/g, ' ')
      .replace(/Fecha:\s*[\d\-: ]+/g, ' ')
      // Nombre del firmante: APELLIDOS (mayúsculas) + Nombres (mixtos). El contenido del perfil va en mayúsculas.
      .replace(/(?:[A-ZÁÉÍÓÚÑ]{2,}\s+){0,3}[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*/g, ' ')
      .replace(/\b(FAU|soft|hard)\b/g, ' ')
  )
    .replace(/L\s?U\s?G\s?A\s?R DE PRESTACIÓN/g, 'LUGAR DE PRESTACIÓN')
    .replace(/H\s?A\s?B\s?I\s?L\s?I\s?D\s?A\s?D\s?E\s?S O COMPETENCIAS/g, 'HABILIDADES O COMPETENCIAS');
}

/**
 * Quita fechas de firma entremezcladas con el texto ("-05O:0T0RAS" → "OTRAS") y
 * fragmentos que son solo el nombre del firmante ("BERMUDEZ TORRES Marco").
 */
function stripFirmaFragments(l) {
  let t = l;
  if (/Fecha:/.test(t)) {
    t = t.replace(/Fecha:\s*(.*)$/, (m, rest) => {
      const T = 'dd-dd-dddd dd:dd:dd -dd:dd';
      const fits = (tc, c) => (tc === 'd' ? /\d/.test(c) : c === tc);
      let j = 0;
      let kept = '';
      for (const c of rest) {
        if (j < T.length) {
          if (fits(T[j], c)) { j++; continue; }
          if (T[j] === ' ' && j + 1 < T.length && fits(T[j + 1], c)) { j += 2; continue; }
        }
        kept += c;
      }
      return kept.replace(/^[\s\d]+(?=[A-ZÁÉÍÓÚÑ])/, '');
    });
  }
  const NOMBRE = /^(?:[A-ZÁÉÍÓÚÑ]{2,}\s+){0,3}[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*$/;
  return t.split(/(\s{2,})/).map((ch) => (NOMBRE.test(ch.trim()) ? ' ' : ch)).join('');
}

function cleanPdfLines(txt) {
  const out = [];
  const lines = txt.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const l = stripFirmaFragments(sanitizeLine(lines[i]));
    if (!l.trim()) { out.push(''); continue; }
    if (/^\s*Firmado digitalmente p/.test(l)) {
      // Bloque de firma (≤ 5 líneas); a veces se superpone con el texto del perfil.
      if (/GAR DE PRESTACI/.test(l)) out.push('LUGAR DE PRESTACIÓN');
      // "Firmado digitalmente por 7 LA JEFATURA…": el contenido quedó en la misma línea.
      const pegado = (l.match(/^\s*Firmado digitalmente por\s+(.+)$/) || [])[1];
      if (pegado && /^[\dA-ZÁÉÍÓÚÑ(]/.test(pegado) && !/[a-z]/.test(pegado)) out.push(pegado);
      for (let k = 0; k < 5 && i + 1 < lines.length; k++) {
        const nx = lines[i + 1].trim();
        if (!nx) { i++; continue; }
        if (/^Fecha:/.test(nx)) {
          const resto = stripFirmaFragments(nx).trim();
          if (resto) out.push(resto);
          i++;
          break;
        }
        // "BERMUDEZ TORRES Marco    DE ORGANIZACIÓN.": nombre del firmante + contenido.
        const trozos = nx.split(/\s{2,}/);
        if (trozos.length > 1 && /[a-z]/.test(trozos[0]) && /^[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ'’ .-]*$/.test(trozos[0])) {
          out.push(trozos.slice(1).join('  '));
          i++;
          continue;
        }
        if (/^Motivo:/.test(nx)) {
          const rest = nx.replace(/^Motivo:\s*Doy Visto Bueno\s*/, '');
          if (rest) out.push(rest);
          i++;
          continue;
        }
        if (nx.length < 60 && (/FAU|soft|hard/.test(nx) || /^[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ'’ .-]*$/.test(nx))) { i++; continue; }
        break;
      }
      continue;
    }
    if (/[a-z][A-Z][a-z]|[A-Z][a-z][A-Z][a-z]/.test(l)) continue; // firma entremezclada ilegible
    if (/Concurso Público de Méritos N° 05-2026-CG\s*$/.test(l)) continue;
    if (/^\s*"Fortalecimiento de los Órganos/.test(l)) continue;
    if (/^\s*CÓDIGO DEL PERFIL\s*$/.test(l)) continue;
    if (/^\s*\d{4}\s*$/.test(l)) continue;
    if (/^\s*\f/.test(l)) { const r = l.replace(/\f/g, ''); if (r.trim()) out.push(r); continue; }
    out.push(l);
  }
  return out;
}

const FORM_LABELS = [
  /FORMACIÓN ACADÉMICA/g, /B\) GRADO\(S\)\/SITUACIÓN ACADÉMICA Y CARRERA\/ESPECIALIDAD REQUERIDOS/g,
  /C\) ¿COLEGIATURA\?/g, /A\) NIVEL EDUCATIVO/g, /\bINCOMPLETA\b/g, /\bCOMPLETA\b/g, /EGRESADO\(A\)/g,
  /\bBACHILLER\b/g, /TÍTULO\/LICENCIATURA/g, /D\) ¿HABILITACIÓN/g, /PROFESIONAL\?/g,
  /PRIMARIA PRIMARIA/g, /SECUNDA\S*SECUNDARIA/g, /^TÉCNI$/g, /^CA$/g, /TÉCNICA BÁSICA/g,
  /TÉCNICA SUPERIOR/g, /\(1 O 2 AÑOS\)/g, /\(3 O 4 AÑOS\)/g, /\bMAESTRÍA\b/g, /\bDOCTORADO\b/g,
  /\bEGRESADO\b/g, /\bGRADO\b/g, /UNIVERSITAR\S*/g, /^TÉCNI\b/g, /^CA\b/g,
];

// En el bloque de maestría no se borran estas palabras: forman parte del contenido.
const MAES_LABELS = FORM_LABELS.filter((re) => !/MAESTRÍA|DOCTORADO|EGRESADO|GRADO|BACHILLER|TÍTULO/.test(re.source));

function residual(lines, labels = FORM_LABELS) {
  const parts = [];
  for (const l of lines) {
    for (let chunk of l.trim().split(/\s{2,}/)) {
      for (const re of labels) chunk = chunk.replace(re, ' ');
      chunk = squash(chunk);
      if (!chunk || /^((X|SÍ|NO)\s*)+$/.test(chunk)) continue;
      parts.push(chunk);
    }
  }
  return squash(parts.join(' '));
}

function between(text, startRe, endRe) {
  const s = text.search(startRe);
  if (s < 0) return '';
  const after = text.slice(s).replace(startRe, '');
  const e = after.search(endRe);
  return squash(e < 0 ? after : after.slice(0, e));
}

function splitCarreras(s) {
  if (!s || /^(NO APLICA|SECUNDARIA)\s*\.?$/.test(s)) return { lista: [], afines: false, texto: s ? 'No aplica' : '' };
  const afines = /U OTRAS AFINES|O AFINES|AFINES POR LA FORMACIÓN/.test(s);
  const core = s
    .replace(/,?\s*(?:(?:U|O)\s+)?(?:OTRAS\s+)?AFINES POR LA FORMACIÓN\.?/, '')
    .replace(/,?\s*(?:U|O)\s+(?:OTRAS\s+)?AFINES\.?$/, '')
    .replace(/\.$/, '');
  const lista = core.split(/\s*,\s*/).map(squash).filter(Boolean);
  return { lista, afines, texto: s };
}

function splitCursos(s) {
  if (!s || /^NO APLICA\.?$/.test(s)) return [];
  const items = s.split(/(?:^|\s)-\s+(?=[A-ZÁÉÍÓÚ(])/).map(squash).filter(Boolean);
  return items.map((t) => {
    const h = t.match(/(\d+)\s*HORAS/);
    const tipo = /PROGRAMA|DIPLOMADO/.test(t) ? 'Programa / Diplomado' : /CURSO/.test(t) ? 'Curso' : 'Otro';
    return { tipo, horas: h ? +h[1] : null, texto: t };
  });
}

function parseLugares(s) {
  const out = [];
  for (const m of squash(s).matchAll(/((?:[^()]|\([^()\d]*\))+?)\s*\((\d+)\)\.?/g)) {
    const n = squash(m[1]).replace(/^[-•·,;.\s]+/, '').replace(/\s*-\s*/g, ' - ').replace(/^OCI -/, 'OCI -');
    if (n) out.push({ n, c: +m[2] });
  }
  return out;
}

/**
 * Funciones desde el PDF. Cada número va centrado verticalmente respecto a su texto
 * (con L líneas, quedan ~la mitad antes y la mitad después del número). Se reparten las
 * líneas entre números respetando ese centrado y prefiriendo que cada función termine en punto.
 */
function parseFuncionesPdf(lines) {
  const rows = [];
  const idx = [];
  let expected = 1;
  for (const l of lines) {
    const t = squash(l);
    if (!t) continue;
    const m = t.match(/^(\d{1,2})(?:\s+(.*))?$/);
    if (m && +m[1] === expected) {
      idx.push(rows.length);
      rows.push(m[2] || '');
      expected++;
    } else {
      rows.push(t);
    }
  }
  const N = idx.length;
  if (!N) return { count: 0, funciones: [] };
  const gaps = idx.slice(1).map((v, k) => v - idx[k] - 1);
  const lastAfter = rows.length - 1 - idx[N - 1];
  // Pistas: una función suele terminar en punto y empezar con un verbo en infinitivo.
  const endsOk = (r) => (/[.;:]$/.test(r) ? 10 : 0);
  const startsOk = (r) => (/^(OTRAS FUNCIONES|[A-ZÁÉÍÓÚÑ]{3,}(AR|ER|IR)\b)/.test(r) ? 6 : 0);
  const after = [];
  let best = null;
  (function dfs(k, before, score) {
    const s0 = score + startsOk(rows[idx[k] - before]);
    // Líneas después del número k: igual a las de antes, una menos o una más (penalizado).
    for (const [a, penalty] of [[before, 0], [before - 1, 0], [before + 1, 1]]) {
      if (a < 0) continue;
      if (k === N - 1) {
        if (a !== lastAfter) continue;
        after[k] = a;
        const s = s0 + endsOk(rows[idx[k] + a]) - penalty;
        if (!best || s > best.score) best = { score: s, after: after.slice() };
        continue;
      }
      if (a > gaps[k]) continue;
      after[k] = a;
      dfs(k + 1, gaps[k] - a, s0 + endsOk(rows[idx[k] + a]) - penalty);
    }
  })(0, idx[0], 0);
  if (!best) return { count: N, funciones: [] };
  const funciones = idx.map((pos, k) => {
    const before = k === 0 ? idx[0] : gaps[k - 1] - best.after[k - 1];
    return squash(rows.slice(pos - before, pos + best.after[k] + 1).join(' '));
  });
  return { count: N, funciones: funciones.every(Boolean) ? funciones : [] };
}

function parseAnexo3Pdf() {
  const lines = cleanPdfLines(pdfText());
  const text = lines.join('\n');
  const parts = text.split(/^\s*N° (\d{3})-2026\s*$/m);
  const map = {};
  for (let i = 1; i < parts.length; i += 2) {
    const code = parts[i];
    const bl = parts[i + 1].split('\n');
    const flat = cleanFlat(parts[i + 1]);
    const rec = {};

    const fa = bl.findIndex((l) => /A\) NIVEL EDUCATIVO/.test(l));
    const hdr = bl.findIndex((l) => /FORMACIÓN ACADÉMICA/.test(l));
    const start = hdr >= 0 ? hdr : fa;
    const ma = bl.findIndex((l, k) => k > start && /\bMAESTRÍA\b/.test(l));
    const doc = bl.findIndex((l, k) => k > ma && /\bDOCTORADO\b/.test(l));
    const con = bl.findIndex((l, k) => k > start && /^\s*CONOCIMIENTOS\s*$/.test(l));

    const formLines = bl.slice(start, ma);
    const gradoLine = formLines.find((l) => /BACHILLER/.test(l)) || '';
    const g = squash(gradoLine);
    rec.grado = /TÍTULO\/LICENCIATURA\s+X/.test(g) ? 'Título / Licenciatura'
      : /BACHILLER\s+X/.test(g) ? 'Bachiller'
      : /EGRESADO\(A\)\s+X/.test(g) ? 'Egresado(a)' : null;
    rec.colegiatura = /SÍ\s+X\s+NO/.test(g) ? true : /NO\s+X/.test(g) ? false : null;
    const hab = bl.slice(start, con).map(squash).find((l) => /^(X\s+)?SÍ(\s+X)?\s+NO(\s+X)?$/.test(l)) || '';
    rec.habilitacion = /SÍ\s+X\s+NO/.test(hab) ? true : /NO\s+X/.test(hab) ? false : null;

    rec.mision = between(flat, /MISIÓN DEL PUESTO/, /FUNCIONES DEL PUESTO/);

    // Identificación: en el PDF cada dato va en su línea ("NOMBRE DEL CARGO:   ANALISTA").
    const ident = (label) => {
      const line = bl.find((l) => new RegExp(`^\\s*${label}:\\s+\\S`).test(l));
      return line ? squash(line.replace(new RegExp(`^\\s*${label}:`), '')) : '';
    };
    rec.unidadOrganica = ident('UNIDAD ORGÁNICA');
    rec.cargo = ident('NOMBRE DEL CARGO');
    rec.clasificacion = ident('CLASIFICACIÓN');
    rec.dependencia = ident('DEPENDENCIA JERÁRQUICA');

    const fi = bl.findIndex((l) => /^\s*FUNCIONES DEL PUESTO\s*$/.test(l));
    const ci = bl.findIndex((l, k) => k > fi && /CONDICIONES ATÍPICAS/.test(l));
    if (fi >= 0 && ci > fi) {
      const r = parseFuncionesPdf(bl.slice(fi + 1, ci));
      rec.fnCount = r.count;
      rec.funciones = r.funciones;
    }

    const lvlLines = bl.slice(start, con);
    const has = (re) => lvlLines.some((l) => re.test(l) && /X/.test(l));
    rec.nivel = has(/^UNIVERSITAR/) ? 'Universitaria'
      : lvlLines.some((l) => /^TÉCNI/.test(l) && /TÉCNICA SUPERIOR/.test(l) && /X/.test(l)) ? 'Técnica superior'
      : lvlLines.some((l) => /^TÉCNI/.test(l) && /TÉCNICA BÁSICA/.test(l) && /X/.test(l)) ? 'Técnica básica'
      : has(/^SECUNDA/) ? 'Secundaria'
      : has(/^PRIMARIA/) ? 'Primaria' : null;

    // Si el bloque de funciones se coló (salto de página), se corta tras "PERIODICIDAD ... NO APLICA."
    const carrerasRaw = residual(formLines.slice(1).map((l) => l.replace(/^.*B\) GRADO.*$/, '')))
      .replace(/^.*PERIODICIDAD DE LA APLICACIÓN.*?NO APLICA\.\s*/, '');
    rec.carreras = splitCarreras(carrerasRaw);
    const maes = residual(bl.slice(ma + 1, doc), MAES_LABELS);
    rec.maestria = maes && !/^NO APLICA\.?$/.test(maes) ? maes : null;

    rec.conocimientos = between(flat, /A\) CONOCIMIENTOS TÉCNICOS PRINCIPALES REQUERIDOS PARA EL PUESTO \(NO SE REQUIERE SUSTENTAR CON DOCUMENTOS\):/, /B\) CURSOS Y\/O PROGRAMAS/);
    const cursos = between(flat, /B\) CURSOS Y\/O PROGRAMAS DE ESPECIALIZACIÓN REQUERIDOS Y SUSTENTADOS CON DOCUMENTOS:/, /C\) CONOCIMIENTOS DE OFIMÁTICA/);
    rec.cursos = splitCursos(cursos);

    rec.expGeneral = between(flat, /INDIQUE EL TIEMPO TOTAL DE EXPERIENCIA LABORAL; YA SEA EN EL SECTOR PÚBLICO O PRIVADO\./, /EXPERIENCIA ESPECÍFICA/);
    rec.expFuncion = between(flat, /EN LA FUNCIÓN O LA MATERIA:/, /B\. INDIQUE/);
    rec.expPuesto = between(flat, /REQUERIDA EN EL PUESTO O CARGO:/, /C\. INDIQUE/);
    rec.expPublico = between(flat, /EN EL SECTOR PÚBLICO:/, /OTROS ASPECTOS COMPLEMENTARIOS/);
    rec.expOtros = between(flat, /EN CASO EXISTIERA ALGO ADICIONAL PARA EL PUESTO O CARGO:/, /HABILIDADES O COMPETENCIAS/);
    rec.habilidades = between(flat, /HABILIDADES O COMPETENCIAS/, /REQUISITOS ADICIONALES/);
    rec.requisitos = between(flat, /REQUISITOS ADICIONALES/, /LUGAR DE PRESTACIÓN/).replace(/^NO APLICA\..*$/, 'NO APLICA.');
    rec.lugares = parseLugares(between(flat, /LUGAR DE PRESTACIÓN/, /$^/));
    map[code] = rec;
  }
  return map;
}

/* ---------- Unión y salida ---------- */
function main() {
  const a2 = parseAnexo2();
  const md = parseAnexo3Md();
  const pdf = parseAnexo3Pdf();
  const funcs = [];
  const funcIdx = new Map();
  const warn = [];
  const info = [];
  const perfiles = [];

  for (const code of Object.keys(a2).sort()) {
    const A = a2[code], M = md[code] || {}, P = pdf[code] || {};
    if (!md[code]) warn.push(`${code}: sin perfil en .md`);
    if (!pdf[code]) warn.push(`${code}: sin perfil en PDF`);
    if (M.puesto && squash(M.puesto) !== squash(A.puesto)) warn.push(`${code}: puesto difiere (${M.puesto} / ${A.puesto})`);
    // Funciones: el .md solo vale si está limpio y coincide en cantidad con el PDF validado.
    const mdFn = M.funciones || [];
    const pdfFn = P.funciones || [];
    // Algunas funciones no llevan punto final en el original: el .md vale si no tiene celdas partidas
    // y su cantidad coincide con la numeración detectada en el PDF.
    // Si el .md trae más funciones que los números detectados en el PDF, una firma se comió algún número.
    const mdOk = mdFn.length > 0 && mdFn.every((f) => !/\|/.test(f)) && (!P.fnCount || mdFn.length >= P.fnCount);
    const pdfOk = pdfFn.length > 0 && pdfFn.length === P.fnCount;
    let fnSrc = mdFn;
    if (!mdOk && pdfOk) fnSrc = pdfFn;
    else if (!mdOk) fnSrc = mdFn.length ? mdFn.map((f) => squash(f.replace(/\|+/g, ' '))) : pdfFn;
    if (!fnSrc.length) warn.push(`${code}: sin funciones`);
    else if (fnSrc === pdfFn) info.push(`${code}: funciones tomadas del PDF (${fnSrc.length})`);
    if (!mdOk && !pdfOk) warn.push(`${code}: funciones dudosas (.md ${mdFn.length}, PDF ${pdfFn.length}/${P.fnCount})`);
    const nivel = P.nivel || M.nivel;
    if (!nivel) warn.push(`${code}: nivel no detectado`);
    if (!P.carreras || !P.carreras.texto) warn.push(`${code}: carreras vacías`);
    const sum = (arr) => (arr || []).reduce((a, x) => a + x.c, 0);
    let lugaresSrc = P.lugares || [];
    const ilegible = lugaresSrc.some((l) => /[:\d]|[a-z]/.test(l.n));
    if ((ilegible || sum(lugaresSrc) !== A.posiciones) && sum(M.lugares) === A.posiciones) {
      lugaresSrc = M.lugares;
      info.push(`${code}: lugares tomados del .md`);
    }
    if (sum(lugaresSrc) !== A.posiciones) warn.push(`${code}: lugares suman ${sum(lugaresSrc)} ≠ ${A.posiciones} posiciones`);

    const fn = fnSrc.map((f) => {
      const t = sentence(f);
      if (!funcIdx.has(t)) { funcIdx.set(t, funcs.length); funcs.push(t); }
      return funcIdx.get(t);
    });

    const regional = (A.unidad.match(/^GERENCIA REGIONAL DE CONTROL DEL? (.+)$/) || [])[1];
    const lugares = lugaresSrc.map((l) => ({ n: title(l.n), c: l.c }));
    const tipoLugar = lugares.some((l) => /^OCI\b/.test(l.n)) ? 'Órgano de Control Institucional (OCI)' : 'Sede de la Contraloría';

    const rec = {
      id: code,
      tipo: A.tipo === 'PROGRAMA DE FORMACION' ? 'Programa de formación' : title(A.tipo),
      categoria: A.categoria,
      remuneracion: A.remuneracion,
      organo: title(A.unidad),
      unidadOrganica: title(M.unidadOrganica || P.unidadOrganica || A.unidad),
      ambito: regional ? title(regional) : 'Órganos de sede central',
      puesto: title(A.puesto),
      cargo: title(M.cargo || P.cargo || ''),
      clasificacion: M.clasificacion || P.clasificacion || '',
      dependencia: title(M.dependencia || P.dependencia || ''),
      posiciones: A.posiciones,
      mision: sentence(P.mision && !/\||\*\*/.test(P.mision) ? P.mision : M.mision || ''),
      fn,
      nivel,
      grado: P.grado,
      colegiatura: P.colegiatura,
      habilitacion: P.habilitacion,
      carreras: (P.carreras.lista || []).map(title),
      carrerasAfines: !!P.carreras.afines,
      carrerasTexto: sentence(P.carreras.texto || ''),
      maestria: P.maestria ? sentence(P.maestria) : null,
      conocimientos: sentence(P.conocimientos),
      cursos: (P.cursos || []).map((c) => ({ tipo: c.tipo, horas: c.horas, texto: sentence(c.texto) })),
      exp: {
        general: sentence(P.expGeneral), generalAnios: toYears(P.expGeneral),
        funcion: sentence(P.expFuncion), funcionAnios: toYears(P.expFuncion),
        puesto: sentence(P.expPuesto), puestoAnios: toYears(P.expPuesto),
        publico: sentence(P.expPublico), publicoAnios: toYears(P.expPublico),
        otros: sentence(P.expOtros),
      },
      habilidades: sentence(P.habilidades || M.habilidades || ''),
      requisitos: sentence(P.requisitos),
      ofimatica: M.ofimatica,
      idiomas: M.idiomas,
      lugares,
      tipoLugar,
    };
    perfiles.push(rec);
  }

  const header = `/* Generado por tools/generar-datos.js — ${new Date().toISOString().slice(0, 10)}. No editar a mano. */\n`;
  const body = `window.CPM_DATA = ${JSON.stringify({ funciones: funcs, perfiles })};\n`;
  fs.writeFileSync(OUT, header + body, 'utf8');
  console.log(`Perfiles: ${perfiles.length} · Posiciones: ${perfiles.reduce((a, p) => a + p.posiciones, 0)} · Funciones únicas: ${funcs.length} · ${(Buffer.byteLength(body) / 1024).toFixed(0)} KB`);
  console.log(`Respaldos (${info.length}):\n` + info.join('\n'));
  console.log(`Avisos (${warn.length}):\n` + warn.join('\n'));
}

main();
