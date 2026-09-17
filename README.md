# Convocatoria CGR · CPM N° 06-2026-CG

Sitio estático para consultar el **Concurso Público de Méritos N° 06-2026-CG** “Fortalecimiento de los Órganos y Unidades Orgánicas de la Contraloría General de la República” (397 perfiles, 1,049 posiciones).

- **`index.html` — Bases:** resumen de las bases con cronograma, etapas y pesos, requisitos, documentos, evaluación curricular, puntaje adicional, bonificaciones, desempate e impugnación.
- **`dashboard.html` — Perfiles:** filtros por lugar de prestación, región, órgano, escala remunerativa (con monto), carrera, nivel educativo y experiencia; gráficos, resultados paginados y detalle de cada perfil (carreras, cursos, experiencia, requisitos adicionales, lugares y funciones).

## Uso

Abre `index.html` en el navegador (no requiere instalación). Opcionalmente, con un servidor local:

```bash
node tools/servidor.js
```

y entra a http://localhost:5500.

Los filtros y el perfil abierto quedan en la URL, por ejemplo `dashboard.html?perfil=403`.

## Estructura

```
index.html            Bases del concurso
dashboard.html        Dashboard de perfiles
css/styles.css        Estilos compartidos (tema claro/oscuro)
js/data.js            Datos de los perfiles (generado)
js/dashboard.js       Lógica del dashboard
js/bases.js           Cuenta regresiva, cronograma e índice
js/tema.js            Selector de tema
tools/generar-datos.js  Genera js/data.js a partir de los anexos
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

> Resumen informativo. Ante cualquier diferencia, prevalecen los documentos oficiales publicados por la Contraloría General de la República.
