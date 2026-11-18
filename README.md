# Convocatoria CGR · CPM N° 06-2026-CG

Sitio estático para consultar el **Concurso Público de Méritos N° 06-2026-CG** “Fortalecimiento de los Órganos y Unidades Orgánicas de la Contraloría General de la República” (397 perfiles, 1,049 posiciones).

- **`index.html` — Bases:** resumen de las bases con cronograma, etapas y pesos, requisitos, documentos, evaluación curricular, puntaje adicional, bonificaciones, desempate e impugnación.
- **`dashboard.html` — Perfiles:** filtros por lugar de prestación, región, órgano, escala remunerativa (con monto), carrera, nivel educativo y experiencia; gráficos, resultados paginados y detalle de cada perfil (carreras, cursos, experiencia, requisitos adicionales, lugares y funciones).
- **`resultados.html` — Inscripción:** resultados de la inscripción virtual con filtros por perfil, nombre o DNI, condición, sede, local y aula de evaluación; al filtrar un local muestra su dirección de ingreso, fecha y horario.
- **`evaluaciones.html` — Evaluaciones:** puntajes y condición en conocimientos (PT), aptitud (PA) y curricular (EC), con puntaje acumulado, filtros por etapa y los postulantes que van ganando según las plazas de cada perfil.
- **`cambios.html` — Cambios:** compara la publicación curricular del 12 de noviembre (reemplazada) con la del 17: transiciones de condición, perfiles con más impacto, favorecidos y perjudicados (incluidos quienes entran o salen de los puestos ganadores por cambios de otros) y el ranking antes y ahora de cada perfil. Acepta `?vista=favorecidos|perjudicados`, `?perfil=` y `?puestos=1`.

## Uso

Abre `index.html` en el navegador (no requiere instalación). Opcionalmente, con un servidor local:

```bash
node tools/servidor.js
```

y entra a http://localhost:5500.

Los filtros y el perfil abierto quedan en la URL, por ejemplo `dashboard.html?perfil=403`. La página de inscripción acepta `?perfil=`, `?sede=`, `?local=` y `?aula=` (sede y local por su número de orden en la publicación oficial), por ejemplo `resultados.html?sede=4`.

## Estructura

```
index.html            Bases del concurso
dashboard.html        Dashboard de perfiles
css/styles.css        Estilos compartidos (tema claro/oscuro)
js/data.js            Datos de los perfiles (generado)
js/dashboard.js       Lógica del dashboard
js/bases.js           Cuenta regresiva, cronograma e índice
js/merito.js          Acumulado, desempate y puestos ganadores (evaluaciones y cambios)
js/cambios.js         Reporte de cambios de la evaluación curricular
js/tema.js            Selector de tema
tools/generar-datos.js  Genera js/data.js a partir de los anexos
tools/generar-resultados.js  Genera js/resultados-data.js (inscripción y sedes)
tools/servidor.js     Servidor estático mínimo
CPM_06_2026_*.md      Texto de las bases y anexos
```

## Regenerar los datos

`js/data.js` se genera a partir del Anexo N° 02 (`.md`) y del Anexo N° 03 (`.md` y `.pdf`). Los PDF no se incluyen en el repositorio: descárgalos del portal de la Contraloría y colócalos en la raíz con sus nombres originales (`CPM_06_2026_Anexo3.pdf`, etc.).

Requiere Node.js y `pdftotext` (incluido en Git para Windows o en Poppler):

```bash
node tools/generar-datos.js        # usa el CPM N° 06-2026-CG (por defecto)
node tools/generar-datos.js 05     # o una convocatoria anterior
```

El script cruza ambas fuentes, valida que los lugares sumen las posiciones de cada perfil y muestra los avisos encontrados.

`js/resultados-data.js` se genera a partir de los resultados de inscripción virtual y de la publicación de sedes de evaluación (`archivos/02 AptosFichaInscripcion` y `archivos/03 SedesEvaluacion`):

```bash
node tools/generar-resultados.js
```

Cruza ambos archivos por N° de documento y código de perfil, y falla si algún postulante que CALIFICA queda sin local y aula.

`js/evaluaciones-data.js` se genera a partir de los resultados de las evaluaciones de conocimientos y de aptitud (`archivos/04 Evaluaciones`):

```bash
node tools/generar-evaluaciones.js
```

Lee las tablas de los `.md` (conversión de los PDF oficiales, con todas las condiciones, incluida NO SE PRESENTÓ) y verifica cada CALIFICA contra el Excel `CPM_06_2026_Califica_Conocimientos_Aptitud.xlsx`. Falla si hay diferencias de perfil, puntaje o condición, saltos en la numeración o puntajes incoherentes con la condición.

También incorpora la evaluación curricular (`archivos/05 Curricular`): lee `CPM_06_2026_Resultados_Eva_Curricular.md` (publicación del 17 de noviembre, que reemplaza a la del 12), verifica todas sus filas contra el `.xlsx` del mismo nombre y exige que cada evaluado haya calificado en aptitud, con el mismo perfil. En curricular solo CALIFICA tiene puntaje. Quienes calificaron en aptitud y no figuran en la publicación curricular (3, en los perfiles 797 y 799) se informan como aviso y la página los muestra como SIN RESULTADO EC.

El mismo script lee la publicación curricular anterior (`CPM_06_2026_Resultados_Evaluacion_Curricular.md` y `.xlsx`, del 12 de noviembre), la valida igual y escribe en `js/cambios-ec-data.js` solo el resultado anterior de quienes cambiaron; `cambios.html` reconstruye con eso la publicación anterior.

En las páginas, el puntaje acumulado suma las etapas publicadas con sus pesos (redondeado a dos decimales) y, en empate, ordena por conocimientos y luego por curricular, según los criterios de desempate de las bases.

> Resumen informativo. Ante cualquier diferencia, prevalecen los documentos oficiales publicados por la Contraloría General de la República.
