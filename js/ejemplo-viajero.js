/* =========================================================
   ejemplo-viajero.js — Ejemplo 2: el problema del viajero
   (TSP) evolucionando en vivo, como un repartidor que sale
   de la Bodega, visita todos los barrios y vuelve.
   Editable mientras corre:
   · sliders: barrios, población, mutación, velocidad
   · mapa interactivo: click = agregar barrio,
     click sobre un barrio = quitarlo, arrastrar = moverlo
     (la Bodega se puede mover pero no quitar)
   El mapa es un plano ILUSTRATIVO (js/plano.js) dibujado una
   sola vez por "Barrios nuevos" en un canvas de fondo; encima
   va otro canvas con las rutas y los barrios.
   Distancias en línea recta; 1 px = 0,02 km (escala ilustrativa).
   Detrás de la mejor ruta (verde) se dibujan 24 rutas de la
   población en gris tenue: al principio van en todas direcciones
   y, con las generaciones, se parecen cada vez más a la verde
   (la población converge). Interruptor "Mostrar la población".
   NO arranca solo: hay que presionar "Empezar".
   Condiciones de parada (como en todo algoritmo genético):
   · 200 generaciones sin mejora → se detiene (estancado)
   · pausa manual                → el usuario lo para
   ========================================================= */
(function () {
  "use strict";

  var W = 760, H = 400;           // tamaño lógico del mapa
  var CW = 760, CH = 290;         // tamaño lógico de la curva
  var K = 5, ELITE = 2;           // presión de selección y élites
  var LIMITE_SIN_MEJORA = 200;    // generaciones sin mejorar antes de detenerse
  var ZONA_LEYENDA = [{ x: 0, y: 0, w: 360, h: 34 }];   // la leyenda HTML tapa esta esquina
  var MUESTRA_POB = 24;           // rutas grises dibujadas (no las 120: satura y es lento)
  var KM_POR_PX = 0.02;           // escala ilustrativa: el mapa mide ≈ 15 km de ancho

  var ciudades = [];              // [{x, y, nombre, bodega}] en coordenadas lógicas; la 0 es la Bodega
  var semilla = 1;                // semilla del plano y del orden de los nombres
  var nombresLibres = [];         // nombres disponibles, en el orden de esta semilla
  var etiquetas = [];             // posición de cada nombre (se recalcula al cambiar los barrios)
  var dist = [];                  // matriz de distancias
  var poblacion = [];             // rutas (permutaciones de índices)
  var historial = [];             // mejor distancia por generación
  var mejorRuta = [];
  var mejorD = Infinity;
  var inicialD = null;
  var generacion = 0;
  var ultimaMejora = 0;           // generación en que hubo la última mejora

  var mutacion = 0.35;
  var poblacionMeta = 120;

  // máquina de estados
  var arrancado = false;          // el usuario presionó Empezar
  var pausado = false;
  var estancado = false;          // sin mejora en LIMITE_SIN_MEJORA → condición de parada

  var visible = false;
  var reloj = null;

  var arrastrando = null;         // índice de la ciudad que se arrastra
  var dondeApreto = null;         // {x,y} del pointerdown
  var movio = false;
  var cursor = null;              // índice del barrio bajo el cursor (muestra su nombre)
  var verPob = true;              // interruptor "Mostrar la población"

  /* ---------- referencias ---------- */
  var elPlano = document.getElementById("plano");
  var elMapa = document.getElementById("ciudades");
  var elCurva = document.getElementById("curva");
  var elBarrios = document.getElementById("via-ciudades");
  var elPob = document.getElementById("via-pob");
  var elMut = document.getElementById("via-mut");
  var elVel = document.getElementById("via-vel");
  var elValBarrios = document.getElementById("val-ciudades");
  var elValPob = document.getElementById("val-viapob");
  var elValMut = document.getElementById("val-viamut");
  var elPlay = document.getElementById("via-play");
  var elGen = document.getElementById("via-gen");
  var elMejor = document.getElementById("via-mejor");
  var elInicial = document.getElementById("via-inicial");
  var elMejora = document.getElementById("via-mejora");
  var elEstado = document.getElementById("via-estado");
  var elVerPob = document.getElementById("via-verpob");
  var ciclo = window.Ciclo.crear(document.getElementById("via-ciclo"));

  /* ---------- canvas con nitidez (retina) ---------- */
  function prepararCanvas(c, w, h) {
    var dpr = window.devicePixelRatio || 1;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    var g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return g;
  }
  var pctx = prepararCanvas(elPlano, W, H);
  var ctx = prepararCanvas(elMapa, W, H);
  var cctx = prepararCanvas(elCurva, CW, CH);

  function ri(n) { return Math.floor(Math.random() * n); }
  function km(px) { return (px * KM_POR_PX).toFixed(1).replace(".", ",") + " km"; }

  function corriendo() {
    return arrancado && !pausado && !estancado;
  }

  /* ---------- plano, barrios y distancias ---------- */
  function nuevaCiudad() {
    return { x: 44 + Math.random() * (W - 88), y: 36 + Math.random() * (H - 90) };
  }

  /* nuevo plano: nueva semilla, nombres en otro orden */
  function nuevoPlano() {
    semilla = (Math.random() * 1e9) >>> 0;
    var r = window.Plano.azar(semilla ^ 0x5bd1e995);
    nombresLibres = window.Plano.NOMBRES.slice();
    for (var i = nombresLibres.length - 1; i > 0; i--) {
      var k = Math.floor(r() * (i + 1)), t = nombresLibres[i];
      nombresLibres[i] = nombresLibres[k]; nombresLibres[k] = t;
    }
    window.Plano.dibujar(pctx, W, H, semilla);
  }

  /* el siguiente nombre que no esté en uso */
  function nombreLibre() {
    var usados = {};
    ciudades.forEach(function (c) { usados[c.nombre] = 1; });
    for (var i = 0; i < nombresLibres.length; i++) if (!usados[nombresLibres[i]]) return nombresLibres[i];
    return "Barrio " + (ciudades.length + 1);
  }

  function agregarCiudad(p) {
    p.nombre = nombreLibre();
    p.bodega = ciudades.length === 0;               // el primer punto es la Bodega
    ciudades.push(p);
  }

  function calcularDistancias() {
    dist = [];
    for (var i = 0; i < ciudades.length; i++) {
      dist[i] = [];
      for (var j = 0; j < ciudades.length; j++) {
        var dx = ciudades[i].x - ciudades[j].x;
        var dy = ciudades[i].y - ciudades[j].y;
        dist[i][j] = Math.sqrt(dx * dx + dy * dy);
      }
    }
    etiquetas = window.Plano.ubicarEtiquetas(ctx, ciudades, W, H, ZONA_LEYENDA);
  }

  function largoRuta(r) {
    var d = 0, n = r.length;
    for (var i = 0; i < n; i++) d += dist[r[i]][r[(i + 1) % n]];
    return d;
  }

  /* la ruta es un ciclo: se puede leer empezando en la Bodega sin cambiar su largo */
  function desdeBodega(r) {
    var k = r.indexOf(0);
    return k <= 0 ? r.slice() : r.slice(k).concat(r.slice(0, k));
  }

  /* ---------- población ---------- */
  function rutaAlAzar() {
    var a = [];
    for (var i = 0; i < ciudades.length; i++) a.push(i);
    for (var j = a.length - 1; j > 0; j--) {
      var k = ri(j + 1), t = a[j]; a[j] = a[k]; a[k] = t;
    }
    return a;
  }

  function distanciasActuales() { return poblacion.map(largoRuta); }

  function reiniciarPoblacion() {
    poblacion = [];
    for (var i = 0; i < poblacionMeta; i++) poblacion.push(rutaAlAzar());
    mejorRuta = [];
    mejorD = Infinity;
    generacion = 0;
    ultimaMejora = 0;
    estancado = false;             // mapa/población nuevos → nueva oportunidad
    tomarMedidaInicial();
  }

  function tomarMedidaInicial() {
    var d = distanciasActuales(), mejor = 0;
    for (var i = 1; i < d.length; i++) if (d[i] < d[mejor]) mejor = i;
    mejorD = d[mejor];
    mejorRuta = poblacion[mejor].slice();
    inicialD = mejorD;
    historial = [mejorD];
    ultimaMejora = generacion;
    estancado = false;
    pintar();
  }

  function ajustarPoblacion() {
    var meta = poblacionMeta;
    if (poblacion.length === meta) return;
    if (poblacion.length > meta) {
      var d = distanciasActuales();
      var orden = d.map(function (_, i) { return i; })
        .sort(function (a, b) { return d[a] - d[b]; });
      poblacion = orden.slice(0, meta).map(function (i) { return poblacion[i]; });
    } else {
      while (poblacion.length < meta) poblacion.push(rutaAlAzar());
    }
    elValPob.textContent = meta;
    pintar();
  }

  /* ---------- operadores ---------- */
  function torneo(d) {                  // gana el más corto de un grupo de K
    var gane = ri(d.length);
    for (var t = 1; t < K; t++) {
      var otro = ri(d.length);
      if (d[otro] < d[gane]) gane = otro;
    }
    return gane;
  }

  function cruceOrden(p1, p2) {          // "cruce por orden": sin repetir barrios
    var n = p1.length;
    var a = ri(n), b = ri(n);
    if (a > b) { var t = a; a = b; b = t; }
    var hijo = new Array(n), usados = {};
    for (var i = a; i <= b; i++) { hijo[i] = p1[i]; usados[p1[i]] = 1; }
    var j = (b + 1) % n;
    for (var k = 0; k < n; k++) {
      var c = p2[(b + 1 + k) % n];
      if (!usados[c]) { hijo[j] = c; usados[c] = 1; j = (j + 1) % n; }
    }
    return hijo;
  }

  function girarTramo(r) {              // mutación: gira un tramo (como desenredar)
    var a = ri(r.length), b = ri(r.length);
    if (a > b) { var t = a; a = b; b = t; }
    return r.slice(0, a).concat(r.slice(a, b + 1).reverse(), r.slice(b + 1));
  }

  function paso() {
    var d = distanciasActuales();

    // ¿apareció algo mejor?
    var quien = 0;
    for (var i = 1; i < d.length; i++) if (d[i] < d[quien]) quien = i;
    if (d[quien] < mejorD) {
      mejorD = d[quien];
      mejorRuta = poblacion[quien].slice();
      ultimaMejora = generacion;                      // hubo mejora: se reinicia el plazo
    }
    historial.push(mejorD);
    if (historial.length > 4000) {      // no dejar crecer el gráfico sin límite
      var corto = [];
      for (var h = 0; h < historial.length; h += 2) corto.push(historial[h]);
      historial = corto;
    }

    // nueva generación
    var orden = d.map(function (_, i) { return i; })
      .sort(function (a, b) { return d[a] - d[b]; });
    var nueva = [];
    for (var e = 0; e < ELITE; e++) nueva.push(poblacion[orden[e]].slice());
    while (nueva.length < poblacion.length) {
      var hijo = cruceOrden(poblacion[torneo(d)], poblacion[torneo(d)]);
      if (Math.random() < mutacion) hijo = girarTramo(hijo);
      nueva.push(hijo);
    }
    poblacion = nueva;
    generacion++;

    // ---- condición de parada: demasiadas generaciones sin mejora ----
    if (generacion - ultimaMejora >= LIMITE_SIN_MEJORA) {
      estancado = true;
      pararReloj();
    }
  }

  /* ---------- estado visible (botón + cartel) ---------- */
  function textoBoton() {
    if (!arrancado) return "▶ Empezar";
    if (pausado || estancado) return "▶ Seguir";
    return "⏸ Pausar";
  }

  function textoEstado() {
    if (estancado) return "detenido: sin mejora";
    if (!arrancado) return "Listo para iniciar";
    if (pausado) return "pausado";
    return "corriendo…";
  }

  function actualizarEstado() {
    ciclo.modo(corriendo() ? "continuo" : "quieto");   // panel del ciclo: ¿está girando?
    elPlay.textContent = textoBoton();
    elEstado.textContent = textoEstado();
  }

  /* ---------- dibujo (el plano de fondo NO se redibuja aquí) ---------- */
  function trazarRuta(g, r) {
    g.beginPath();
    for (var i = 0; i < r.length; i++) {
      var p = ciudades[r[i]];
      if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
    }
    g.closePath();
  }

  /* rutas de la población en gris tenue, todas en un solo trazo.
     Se saltan las élites (son copias de las mejores) y se toma una muestra
     repartida por toda la población: los hijos ocupan posiciones al azar. */
  function dibujarPoblacion() {
    var n = poblacion.length - ELITE;
    if (n <= 0 || !ciudades.length) return;
    var cuantas = Math.min(MUESTRA_POB, n), salto = n / cuantas;
    ctx.beginPath();
    for (var k = 0; k < cuantas; k++) {
      var r = poblacion[ELITE + Math.floor(k * salto)];
      if (!r || r.length !== ciudades.length) continue;   // ruta de un mapa anterior
      for (var i = 0; i < r.length; i++) {
        var p = ciudades[r[i]];
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
    }
    ctx.strokeStyle = "rgba(70,86,78,.22)";
    ctx.lineWidth = 1.2;
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  function dibujarRuta() {
    ctx.clearRect(0, 0, W, H);
    if (verPob) dibujarPoblacion();
    if (mejorRuta.length && ciudades.length) {
      trazarRuta(ctx, mejorRuta);
      ctx.strokeStyle = "rgba(255,255,255,.9)";        // borde blanco: se lee sobre el plano
      ctx.lineWidth = 6.5;
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.strokeStyle = "#026937";
      ctx.lineWidth = 3.4;
      ctx.stroke();
    }
    window.Plano.pines(ctx, ciudades, { resaltar: arrastrando });
    window.Plano.etiquetas(ctx, ciudades, etiquetas, cursor, W);
  }

  function dibujarCurva() {
    cctx.clearRect(0, 0, CW, CH);
    if (historial.length < 2) {
      cctx.fillStyle = "#6a7d71";
      cctx.font = '16px "Plus Jakarta Sans", "Segoe UI", sans-serif';
      cctx.fillText(arrancado ? "La primera mejora aparece en un segundo…"
                              : "Presione Empezar para ver la evolución…", 14, CH / 2);
      return;
    }
    var mn = Infinity, mx = -Infinity, i;
    for (i = 0; i < historial.length; i++) {
      if (historial[i] < mn) mn = historial[i];
      if (historial[i] > mx) mx = historial[i];
    }
    var rango = (mx - mn) || 1;
    var izq = 70, der = 14, arr = 12, aba = 14;
    function X(k) { return izq + (k / (historial.length - 1)) * (CW - izq - der); }
    function Y(v) { return arr + (1 - (v - mn) / rango) * (CH - arr - aba); }

    cctx.strokeStyle = "#cddbd0";
    cctx.lineWidth = 1;
    cctx.beginPath();
    cctx.moveTo(izq, arr);
    cctx.lineTo(izq, CH - aba);
    cctx.lineTo(CW - der, CH - aba);
    cctx.stroke();

    cctx.beginPath();
    cctx.moveTo(X(0), Y(historial[0]));
    for (i = 1; i < historial.length; i++) cctx.lineTo(X(i), Y(historial[i]));
    cctx.strokeStyle = "#026937";
    cctx.lineWidth = 2.6;
    cctx.lineJoin = "round";
    cctx.stroke();

    var degradado = cctx.createLinearGradient(0, arr, 0, CH - aba);
    degradado.addColorStop(0, "rgba(67,182,73,.30)");
    degradado.addColorStop(1, "rgba(67,182,73,0)");
    cctx.lineTo(X(historial.length - 1), CH - aba);
    cctx.lineTo(X(0), CH - aba);
    cctx.closePath();
    cctx.fillStyle = degradado;
    cctx.fill();

    cctx.font = '14px "Plus Jakarta Sans", "Segoe UI", sans-serif';
    cctx.fillStyle = "#6a7d71";
    cctx.textAlign = "right";
    cctx.fillText(km(mx), izq - 6, arr + 10);
    cctx.fillText(km(mn), izq - 6, CH - aba);
    cctx.textAlign = "left";
    cctx.fillStyle = "#026937";
    cctx.font = "700 16px 'Plus Jakarta Sans', 'Segoe UI', sans-serif";
    cctx.fillText("mejor: " + km(historial[historial.length - 1]),
      Math.min(X(historial.length - 1) + 6, CW - 140),
      Math.max(Y(historial[historial.length - 1]) - 7, 15));
  }

  function pintar() {
    dibujarRuta();
    dibujarCurva();
    elGen.textContent = generacion;
    elMejor.textContent = mejorD === Infinity ? "-" : km(mejorD);
    elInicial.textContent = inicialD == null ? "-" : km(inicialD);
    elMejora.textContent = (inicialD && mejorD < Infinity)
      ? ((inicialD - mejorD) / inicialD * 100).toFixed(0) + "%" : "-";
    actualizarEstado();
  }

  /* ---------- reloj ---------- */
  function pararReloj() {
    if (reloj) { clearInterval(reloj); reloj = null; }
  }
  function correr() {
    pararReloj();
    if (!corriendo() || !visible) return;
    reloj = setInterval(function () { paso(); pintar(); }, +elVel.value);
  }

  /* ---------- cambios en vivo ---------- */
  function ajustarBarrios() {
    var meta = +elBarrios.value;
    while (ciudades.length < meta) agregarCiudad(nuevaCiudad());
    while (ciudades.length > meta && ciudades.length > 1) ciudades.pop();   // la Bodega no se quita
    elValBarrios.textContent = ciudades.length;
    calcularDistancias();
    reiniciarPoblacion();
    if (!reloj && corriendo()) correr();              // problema nuevo: si estaba en marcha, seguimos
  }

  function medirOtraVez() {              // el mapa cambió sin cambiar la cantidad
    calcularDistancias();
    tomarMedidaInicial();
    if (!reloj && corriendo()) correr();
  }

  elBarrios.addEventListener("input", ajustarBarrios);
  elPob.addEventListener("input", function () {
    poblacionMeta = +this.value;
    ajustarPoblacion();
  });
  elMut.addEventListener("input", function () {
    mutacion = +this.value / 100;
    elValMut.textContent = this.value + "%";
    // subir la mutación es la salida típica de un estancamiento
    if (estancado) {
      estancado = false;
      ultimaMejora = generacion;                      // nuevo plazo para mejorar
      pintar();
      correr();
    }
  });
  elVel.addEventListener("change", function () { if (reloj) correr(); });
  elVerPob.addEventListener("change", function () {
    verPob = this.checked;
    document.getElementById("via-leyenda").hidden = !verPob;   // sin grises, la leyenda sobra
    dibujarRuta();
  });

  elPlay.addEventListener("click", function () {
    this.blur();
    if (!arrancado) {
      arrancado = true; pausado = false;              // primer arranque
    } else if (estancado) {
      estancado = false; ultimaMejora = generacion;   // darle otra oportunidad
      pausado = false;
    } else if (pausado) {
      pausado = false;
    } else {
      pausado = true;                                 // estaba corriendo → pausar
    }
    if (corriendo()) correr(); else pararReloj();
    actualizarEstado();
  });

  document.getElementById("via-reset").addEventListener("click", function () {
    this.blur();
    var n = ciudades.length;
    nuevoPlano();                                     // plano nuevo, nombres nuevos
    ciudades = [];
    for (var i = 0; i < n; i++) agregarCiudad(nuevaCiudad());
    calcularDistancias();
    reiniciarPoblacion();
    if (corriendo() && visible) correr();
  });

  /* ---------- mapa interactivo ---------- */
  function aCoordenadas(e) {
    var r = elMapa.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (W / r.width),
      y: (e.clientY - r.top) * (H / r.height)
    };
  }
  function ciudadCerca(x, y) {
    for (var i = 0; i < ciudades.length; i++) {
      var dx = ciudades[i].x - x, dy = ciudades[i].y - y;
      if (dx * dx + dy * dy < 14 * 14) return i;
    }
    return -1;
  }

  elMapa.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    var p = aCoordenadas(e);
    var cerca = ciudadCerca(p.x, p.y);
    dondeApreto = p;
    movio = false;
    if (cerca !== -1) {
      arrastrando = cerca;
      pararReloj();                      // pauso mientras se edita el mapa
      try { elMapa.setPointerCapture(e.pointerId); } catch (err) { /* sin puntero activo */ }
    }
    dibujarRuta();
  });

  elMapa.addEventListener("pointermove", function (e) {
    var p = aCoordenadas(e);
    if (arrastrando === null) {
      // sin arrastrar: el nombre del barrio bajo el cursor
      var c = ciudadCerca(p.x, p.y);
      if (c === -1) c = null;
      if (c !== cursor) { cursor = c; dibujarRuta(); }
      return;
    }
    if (dondeApreto && Math.abs(p.x - dondeApreto.x) + Math.abs(p.y - dondeApreto.y) > 8) movio = true;
    if (movio) {
      ciudades[arrastrando].x = Math.max(20, Math.min(W - 20, p.x));
      ciudades[arrastrando].y = Math.max(20, Math.min(H - 20, p.y));
      cursor = arrastrando;
      dibujarRuta();
    }
  });

  elMapa.addEventListener("pointerleave", function () {
    if (cursor !== null && arrastrando === null) { cursor = null; dibujarRuta(); }
  });

  elMapa.addEventListener("pointerup", function (e) {
    var p = aCoordenadas(e);
    var estaba = arrastrando;
    arrastrando = null;

    if (estaba !== -1 && estaba !== null && movio) {
      // movió un barrio: remedimos todo y seguimos
      medirOtraVez();
    } else {
      var cerca = ciudadCerca(p.x, p.y);
      if (cerca !== -1 && estaba === cerca && !movio) {
        // click sin mover sobre un barrio → quitarlo (la Bodega no se quita)
        if (ciudades.length > 6 && !ciudades[cerca].bodega) {
          ciudades.splice(cerca, 1);
          cursor = null;
          elBarrios.value = ciudades.length;
          elValBarrios.textContent = ciudades.length;
          calcularDistancias();
          reiniciarPoblacion();
          if (!reloj && corriendo()) correr();
        }
      } else if (cerca === -1 && !movio) {
        // click en vacío → agregar barrio (con el siguiente nombre libre)
        if (ciudades.length < +elBarrios.max) {
          agregarCiudad({ x: p.x, y: p.y });
          elBarrios.value = ciudades.length;
          elValBarrios.textContent = ciudades.length;
          calcularDistancias();
          reiniciarPoblacion();
          if (!reloj && corriendo()) correr();
        }
      }
    }
    dondeApreto = null;
    movio = false;
    if (!reloj && corriendo()) correr();
    pintar();
  });

  elMapa.addEventListener("pointercancel", function () {
    arrastrando = null;
    dondeApreto = null;
    movio = false;
    if (!reloj && corriendo()) correr();
  });

  /* ---------- registro con la presentación ---------- */
  window.Presentacion.registrar("slide-demo-viajero", {
    start: function () {
      visible = true;
      if (!poblacion.length) { nuevoPlano(); ciudades = []; ajustarBarrios(); }  // estado inicial, sin correr
      if (corriendo()) correr();
      actualizarEstado();
    },
    stop: function () { visible = false; pararReloj(); }
  });

  // las letras del plano y de las etiquetas usan la tipografía web: al terminar de
  // cargar, se vuelven a medir y dibujar (una sola vez)
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      if (!ciudades.length) return;
      window.Plano.dibujar(pctx, W, H, semilla);
      etiquetas = window.Plano.ubicarEtiquetas(ctx, ciudades, W, H, ZONA_LEYENDA);
      dibujarRuta();
    });
  }
})();
