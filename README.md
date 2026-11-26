# Convocatoria CGR · CPM N° 06-2026-CG

Sitio estático para consultar el **Concurso Público de Méritos N° 06-2026-CG** “Fortalecimiento de los Órganos y Unidades Orgánicas de la Contraloría General de la República” (397 perfiles, 1,049 posiciones).

- **`index.html` — Bases:** resumen de las bases con cronograma, etapas y pesos, requisitos, documentos, evaluación curricular, puntaje adicional, bonificaciones, desempate e impugnación.
- **`dashboard.html` — Perfiles:** filtros por lugar de prestación, región, órgano, escala remunerativa (con monto), carrera, nivel educativo y experiencia; gráficos, resultados paginados y detalle de cada perfil (carreras, cursos, experiencia, requisitos adicionales, lugares y funciones).
- **`resultados.html` — Inscripción:** resultados de la inscripción virtual con filtros por perfil, nombre o DNI, condición, sede, local y aula de evaluación; al filtrar un local muestra su dirección de ingreso, fecha y horario.
- **`evaluaciones.html` — Evaluaciones:** puntajes y condición en conocimientos (PT), aptitud (PA) y curricular (EC), con puntaje acumulado, filtros por etapa y los postulantes que van ganando según las plazas de cada perfil. Con los resultados finales del 26 de noviembre, la columna Final muestra el puntaje oficial (con bonificaciones de ley y la marca (*) de desempate) y la condición GANADOR/A o ACCESITARIO/A con su orden de mérito; la columna Bonif. muestra los puntos que sumó cada persona por bonificaciones de ley sobre la suma ponderada de sus etapas (el cuadro no publica de qué bonificación se trata y la página no lo deduce), con orden por bonificación (`sort=bono`); hay consultas rápidas de ganadores, accesitarios y con bonificación (`?ganando=1`, `?accesitario=1`, `?bono=1`) y orden por cuadro de méritos (`sort=merito`). Con la entrevista personal (EP) publicada el 25 de noviembre, la columna EP muestra su puntaje y condición, el acumulado pasa a ser el puntaje final sobre 20 (antes de bonificaciones, que no se publican) y se marca a quienes **ganan plaza** según las plazas del perfil; hay filtros por condición y puntaje en EP (`?ep=`, `?epmin=`, `?epmax=`), además de día y panel de la cita (`?epdia=`, `?eppanel=`). Mientras la entrevista no estaba publicada, cada finalista tenía un botón de **calculadora** (puesto, nota necesaria y probabilidad de ganar); se oculta al publicarse los resultados.
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
js/calculadora.js     Calculadora de posibilidades (panel en evaluaciones)
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

También incorpora la evaluación curricular (`archivos/05 Curricular/Corregido`): lee `CPM_06_2026_Resultados_Eva_Curricular_CORREGIDO.md` (publicación del 17 de noviembre, que reemplaza a la del 12; la versión corregida incluye la última página del PDF, que es una imagen escaneada sin texto), verifica todas sus filas contra el `.xlsx` del mismo nombre y exige que cada evaluado haya calificado en aptitud, con el mismo perfil. En curricular solo CALIFICA tiene puntaje. Luego aplica la rectificación del comunicado del 24 de noviembre (`archivos/05 Curricular/Comunicado261124.md`, transcripción del PDF escaneado): exige que cada fila de "Dice" coincida con la publicación (N°, documento, perfil, puntaje y condición), aplica "Debe decir" y agrega a la programación la cita de entrevista de quien pasó a CALIFICA. Si alguien que calificó en aptitud no figura en la publicación curricular, se informa como aviso y la página lo muestra como SIN RESULTADO EC; con los archivos corregidos figuran los 7,198.

También lee la programación de entrevistas (`archivos/06 Entrevistas/CPM_06_2026_Programacion_Entrevista_Personal.md`), la verifica fila por fila contra su `.xlsx` y exige que cada finalista (CALIFICA en PT, PA y EC) tenga exactamente una cita con su mismo perfil, que cada entrevista dure 15 minutos y que ningún panel tenga dos entrevistas que se crucen. Las citas se guardan en `CPM_EVAL.citas`.

Por último lee los resultados de la entrevista (`archivos/06 Entrevistas/CPM_06_2026_Resultados_Etapa_Entrevista_Personal.md`, del 25 de noviembre), los verifica fila por fila contra su `.xlsx` y exige que cada finalista tenga resultado con su mismo perfil y que puntaje y condición sean coherentes (CALIFICA de 12 a 20; DESCALIFICA y NO SE PRESENTÓ sin puntaje). Informa como aviso a quien figura sin ser finalista y a quien tiene NO CALIFICA sin puntaje.

Finalmente lee el cuadro de méritos (`archivos/07 Resultado final/CPM_06_2026_Resultados_Finales.md`, del 26 de noviembre), lo verifica fila por fila contra su `.xlsx` y exige que las notas de cada etapa sean las publicadas, que figuren todos los CALIFICA de la entrevista, que el puntaje final esté entre la suma ponderada y el máximo posible con bonificaciones, y que en cada perfil el orden sea correlativo y ganen los primeros según sus plazas. Se guarda en `CPM_EVAL.final`.

El mismo script lee la publicación curricular anterior (`CPM_06_2026_Resultados_Evaluacion_Curricular_CORREGIDO.md` y `.xlsx`, del 12 de noviembre), la valida igual y escribe en `js/cambios-ec-data.js` solo el resultado anterior de quienes cambiaron; `cambios.html` reconstruye con eso la publicación anterior.

En las páginas, el puntaje acumulado suma las etapas publicadas con sus pesos (redondeado a dos decimales) y, en empate, ordena por conocimientos, luego por curricular y luego por entrevista, según los criterios de desempate de las bases.

> Resumen informativo. Ante cualquier diferencia, prevalecen los documentos oficiales publicados por la Contraloría General de la República.
