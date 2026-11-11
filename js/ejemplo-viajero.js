/* =========================================================
   ejemplo-viajero.js — Ejemplo 2: el problema del viajero
   (TSP) evolucionando en vivo. Editable mientras corre:
   · sliders: barrios, población, mutación, velocidad
   · mapa interactivo: click = agregar barrio,
     click sobre un barrio = quitarlo, arrastrar = moverlo
   NO arranca solo: hay que presionar "Empezar".
   Condiciones de parada (como en todo algoritmo genético):
   · 200 generaciones sin mejora → se detiene (estancado)
   · pausa manual                → el usuario lo para
   ========================================================= */
(function () {
  "use strict";

  var W = 760, H = 400;           // tamaño lógico del mapa
  var CW = 760, CH = 320;         // tamaño lógico de la curva
  var K = 5, ELITE = 2;           // presión de selección y élites
  var LIMITE_SIN_MEJORA = 200;    // generaciones sin mejorar antes de detenerse

  var ciudades = [];              // [{x,y}] en coordenadas lógicas
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

  /* ---------- referencias ---------- */
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

  /* ---------- canvas con nitidez (retina) ---------- */
  function prepararCanvas(c, w, h) {
    var dpr = window.devicePixelRatio || 1;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    var g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return g;
  }
  var ctx = prepararCanvas(elMapa, W, H);
  var cctx = prepararCanvas(elCurva, CW, CH);

  function ri(n) { return Math.floor(Math.random() * n); }

  function corriendo() {
    return arrancado && !pausado && !estancado;
  }

  /* ---------- mapa y distancias ---------- */
  function nuevaCiudad() {
    return { x: 44 + Math.random() * (W - 88), y: 36 + Math.random() * (H - 72) };
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
  }

  function largoRuta(r) {
    var d = 0, n = r.length;
    for (var i = 0; i < n; i++) d += dist[r[i]][r[(i + 1) % n]];
    return d;
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
    ultimaMejora = 0;
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
    elPlay.textContent = textoBoton();
    elEstado.textContent = textoEstado();
  }

  /* ---------- dibujo ---------- */
  function dibujarRuta() {
    ctx.clearRect(0, 0, W, H);
    if (mejorRuta.length && ciudades.length) {
      ctx.strokeStyle = "rgba(2,105,55,.9)";
      ctx.lineWidth = 2.6;
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (var i = 0; i < mejorRuta.length; i++) {
        var p = ciudades[mejorRuta[i]];
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.stroke();
    }
    for (var c = 0; c < ciudades.length; c++) {
      var q = ciudades[c];
      var inicio = mejorRuta.length > 0 && mejorRuta[0] === c;
      ctx.beginPath();
      ctx.arc(q.x, q.y, inicio ? 7.5 : 5, 0, Math.PI * 2);
      ctx.fillStyle = inicio ? "#026937" : "#0e8c7f";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      if (arrastrando === c) {
        ctx.strokeStyle = "#f9a12c";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(q.x, q.y, 11, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (mejorRuta.length) {
      ctx.fillStyle = "#026937";
      ctx.font = '700 16px "Plus Jakarta Sans", "Segoe UI", sans-serif';
      ctx.fillText("Inicio", ciudades[mejorRuta[0]].x + 10, ciudades[mejorRuta[0]].y - 8);
      ctx.fillStyle = "#5d7266";
      ctx.font = '14px "Plus Jakarta Sans", "Segoe UI", sans-serif';
      ctx.fillText(ciudades.length + " barrios: el camino cierra solo, empieza y termina en el mismo punto", 14, H - 14);
    }
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
    var izq = 54, der = 14, arr = 12, aba = 14;
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
    cctx.fillText(mx.toFixed(0), izq - 6, arr + 10);
    cctx.fillText(mn.toFixed(0), izq - 6, CH - aba);
    cctx.textAlign = "left";
    cctx.fillStyle = "#026937";
    cctx.font = "700 16px 'Plus Jakarta Sans', 'Segoe UI', sans-serif";
    cctx.fillText("mejor: " + historial[historial.length - 1].toFixed(1),
      Math.min(X(historial.length - 1) + 6, CW - 120),
      Math.max(Y(historial[historial.length - 1]) - 7, 15));
  }

  function pintar() {
    dibujarRuta();
    dibujarCurva();
    elGen.textContent = generacion;
    elMejor.textContent = mejorD === Infinity ? "-" : mejorD.toFixed(1);
    elInicial.textContent = inicialD == null ? "-" : inicialD.toFixed(1);
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
    while (ciudades.length < meta) ciudades.push(nuevaCiudad());
    while (ciudades.length > meta) ciudades.pop();
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
    ciudades = ciudades.map(nuevaCiudad);
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
    if (arrastrando === null) return;
    var p = aCoordenadas(e);
    if (dondeApreto && Math.abs(p.x - dondeApreto.x) + Math.abs(p.y - dondeApreto.y) > 8) movio = true;
    if (movio) {
      ciudades[arrastrando].x = Math.max(20, Math.min(W - 20, p.x));
      ciudades[arrastrando].y = Math.max(20, Math.min(H - 20, p.y));
      dibujarRuta();
    }
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
        // click sin mover sobre un barrio → quitarlo
        if (ciudades.length > 6) {
          ciudades.splice(cerca, 1);
          elBarrios.value = ciudades.length;
          elValBarrios.textContent = ciudades.length;
          calcularDistancias();
          reiniciarPoblacion();
          if (!reloj && corriendo()) correr();
        }
      } else if (cerca === -1 && !movio) {
        // click en vacío → agregar barrio
        if (ciudades.length < +elBarrios.max) {
          ciudades.push({ x: p.x, y: p.y });
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
      if (!poblacion.length) { ciudades = []; ajustarBarrios(); }  // estado inicial, sin correr
      if (corriendo()) correr();
      actualizarEstado();
    },
    stop: function () { visible = false; pararReloj(); }
  });
})();
