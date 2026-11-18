# Algoritmos Genéticos: presentación interactiva

Presentación de 15 diapositivas (diseño claro con la identidad verde UdeA, animaciones por etapa) con dos demos en vivo: la evolución de una palabra y el problema del viajero (un repartidor en un plano de ciudad). UdeA. Juan Pablo Valencia, Samuel Puerta, Guillermo Mejía.

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
- **Slide 11, el repartidor:** la mejor ruta (verde) y parte de la población (gris), la curva
  de la mejor distancia y del promedio, con récords y tramos estancados.
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
| `js/plano.js` | plano ilustrativo de ciudad y nombres de barrios |
| `js/ejemplo-viajero.js` | ejemplo 2: el repartidor |
| `js/ejemplo-ruta.js` | slide 12: galería y recorrido de la ruta ganadora |
