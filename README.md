# Algoritmos Genéticos: presentación interactiva

Presentación de 15 diapositivas (diseño claro con la identidad verde UdeA, animaciones por etapa) con dos demos en vivo: la evolución de una palabra y el problema del viajero (un repartidor en el mapa real del Valle de Aburrá). UdeA. Juan Pablo Valencia, Samuel Puerta, Guillermo Mejía.

**Ver en línea:** https://jpablo0505.github.io/Optimizacion_Algoritmos_Geneticos/

## Uso

Abra `index.html` en el navegador (o sirva la carpeta con cualquier servidor estático).

- ← → navegar · ↑ ↓ desplazar · ESPACIO siguiente · F pantalla completa
- Los demos arrancan con **Empezar** y se detienen solos cuando dejan de mejorar

## Las demos

- **Slide 10, la palabra:** palabras o frases de hasta 20 símbolos. Con la demo en pausa:
  *Siguiente generación* y *Ver un cruce en cámara lenta*. El interruptor *Ver de dónde viene
  cada letra* colorea el origen (azul: padre 1, naranja: padre 2, morado: mutación). Al
  encontrar la palabra aparece *Ver la historia*.
- **Slide 11, el repartidor:** barrios reales de Medellín y del Valle de Aburrá; la mejor ruta (verde)
  y parte de la población (gris) siguen las vías principales; curva de la mejor distancia y del
  promedio, con récords y tramos estancados. Clic en el mapa: agrega el barrio libre más cercano;
  clic en un barrio: lo quita.
- **Slide 12, así evolucionó la ruta:** galería de rutas, recorrido animado de la ganadora y
  línea de tiempo. Usa la corrida de la slide 11.

## Archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | las 15 diapositivas |
| `css/estilos.css` | estilos y colores compartidos por las demos |
| `js/navegacion.js` | puntos laterales, contador, teclado, pantalla completa y ciclo de vida de las demos |
| `js/animaciones.js` | animaciones por etapa |
| `js/ciclo.js` | panel del ciclo Medir → Elegir → Cruzar → Mutar → Repetir |
| `js/ejemplo-palabra.js` | ejemplo 1: la palabra |
| `js/datos-mapa.js` | datos del mapa real (generado; no se edita a mano) |
| `js/mapa.js` | dibuja el mapa real y da distancias y caminos por calle |
| `js/ejemplo-viajero.js` | ejemplo 2: el repartidor |
| `js/ejemplo-ruta.js` | slide 12: galería y recorrido de la ruta ganadora |
| `herramientas/preparar_mapa.py` | script que genera `js/datos-mapa.js` (no forma parte de la página) |

## Fuente de los datos del mapa

Mapa y datos: **© colaboradores de OpenStreetMap**, licencia ODbL
(https://www.openstreetmap.org/copyright). Descargados con [osmnx](https://osmnx.readthedocs.io)
desde la API Overpass.

- **Barrios:** en OpenStreetMap los barrios de Medellín están mapeados como puntos
  (`place=neighbourhood`, `suburb`, `village`, `town`, `city`), no como polígonos. Se usa la
  ubicación de ese punto, que los mapeadores ponen en el centro del barrio. Para los municipios
  (Bello, Itagüí, Envigado, Sabaneta, La Estrella) y los corregimientos (San Antonio de Prado,
  Altavista, Santa Elena) se usa el punto de su centro urbano: el centroide del polígono municipal
  quedaría en zona rural. En `js/datos-mapa.js` cada barrio guarda su identificador de OSM
  (`node/…`). No hay coordenadas inventadas.
- **Vías:** solo `motorway`, `trunk`, `primary`, `secondary` y `tertiary` (con sus enlaces), en una
  red simplificada y **sin sentidos viales**.
- **Distancias:** Dijkstra sobre esas vías entre cada par de barrios, más el tramo del punto del
  barrio a la vía más cercana. Son km reales, pero solo por las vías principales: no es un
  navegador vial.
- Quedaron fuera Caldas, Girardota y Copacabana: están tan lejos que achicarían el resto del mapa.

Para regenerar los datos:

```bash
python -m venv .venv
.venv/Scripts/pip install -r herramientas/requirements.txt
.venv/Scripts/python herramientas/preparar_mapa.py
```

El script reintenta con otros servidores de Overpass si el principal está saturado, verifica la
orientación (Bello al norte, Envigado y Sabaneta al sur, El Poblado al oriente del río, Laureles
al occidente) y avisa si el archivo pasa de 2 MB.
