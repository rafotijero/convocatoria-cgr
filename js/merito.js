/* Reglas de mérito compartidas (evaluaciones) — CPM N° 06-2026-CG */
(function () {
  'use strict';

  /* ---------- Ponderaciones según las bases ---------- */
  const W = { pt: 0.30, pa: 0.20, ec: 0.30, ep: 0.20 };

  /* ---------- Acumulado ponderado de las etapas disponibles ---------- */
  // Redondeado a dos decimales, como el puntaje final de las bases; además evita que
  // errores de coma flotante rompan los empates.
  function calcAcumulado(ptScore, paScore, ecScore, epScore) {
    let acc = null;
    if (ptScore !== null) acc = (acc ?? 0) + ptScore * W.pt;
    if (paScore !== null) acc = (acc ?? 0) + paScore * W.pa;
    if (ecScore !== null) acc = (acc ?? 0) + ecScore * W.ec;
    if (epScore !== null) acc = (acc ?? 0) + epScore * W.ep;
    return acc === null ? null : Math.round(acc * 100) / 100;
  }

  /* ---------- Orden de mérito ---------- */
  // Mayor acumulado; en empate, mayor puntaje en conocimientos, luego en curricular y luego
  // en la entrevista (criterios 1 a 3 de desempate de las bases). Los registros sin acumulado
  // van al final.
  const sc = (v) => (v == null ? -1 : v);
  function cmpMerito(a, b) {
    if (a.acumulado === null || b.acumulado === null) {
      return (a.acumulado === null) - (b.acumulado === null);
    }
    return (b.acumulado - a.acumulado) || (sc(b.ptScore) - sc(a.ptScore)) || (sc(b.ecScore) - sc(a.ecScore)) ||
      (sc(b.epScore) - sc(a.epScore));
  }

  /* ---------- Puestos y "va ganando" por perfil ---------- */
  // Ordena a los CALIFICA (cond 0 con acumulado) de cada perfil y asigna:
  //   r.puesto  → posición en el orden de mérito (empates comparten puesto), o null
  //   r.ganando → está entre los N primeros, N = plazas del perfil; los empates que
  //               persisten tras los desempates disponibles en el límite entran todos.
  // plazasDe(perfil) devuelve el número de plazas del perfil.
  function rankear(records, plazasDe) {
    const porPerfil = new Map();
    records.forEach((r) => {
      r.puesto = null;
      r.ganando = false;
      if (r.cond !== 0 || r.acumulado === null) return;
      if (!porPerfil.has(r.perfil)) porPerfil.set(r.perfil, []);
      porPerfil.get(r.perfil).push(r);
    });

    porPerfil.forEach((grupo, perfil) => {
      grupo.sort(cmpMerito);
      grupo.forEach((r, i) => {
        r.puesto = i > 0 && cmpMerito(grupo[i - 1], r) === 0 ? grupo[i - 1].puesto : i + 1;
      });
      const plazas = plazasDe(perfil) || 0;
      if (!plazas) return;
      const limite = grupo[Math.min(plazas, grupo.length) - 1];
      grupo.forEach((r) => { if (cmpMerito(r, limite) <= 0) r.ganando = true; });
    });
    return porPerfil;
  }

  window.CPM_MERITO = { W, calcAcumulado, cmpMerito, rankear };
})();
