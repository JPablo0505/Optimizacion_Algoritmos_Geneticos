/* =========================================================
   ejemplo-palabra.js — Ejemplo 1: la población quiere
   formar tu palabra. Todo es editable en vivo:
   palabra objetivo, tamaño, mutación y velocidad.
   NO arranca solo: hay que presionar "Empezar".
   Condiciones de parada (como en todo algoritmo genético):
   · encontró la palabra        → se detiene y lo avisa
   · 150 generaciones sin mejora → se detiene (estancado)
   · pausa manual                → el usuario lo para
   ========================================================= */
(function () {
  "use strict";

  var ALFABETO = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";
  var LIMITE_SIN_MEJORA = 150;    // generaciones sin mejorar antes de detenerse

  var objetivo = "GENETICA";
  var poblacion = [];
  var generacion = 0;
  var mutacion = 0.03;            // 3% por defecto

  // máquina de estados
  var arrancado = false;          // el usuario presionó Empezar
  var pausado = false;
  var ganado = false;             // encontró la palabra → condición de parada
  var estancado = false;          // sin mejora en LIMITE_SIN_MEJORA → condición de parada
  var mejorAnt = 0;
  var ultimaMejora = 0;

  var visible = false;
  var temporizador = null;

  /* ---------- referencias al DOM ---------- */
  var elPalabra = document.getElementById("obj-palabra");
  var elPob = document.getElementById("obj-pob");
  var elMut = document.getElementById("obj-mut");
  var elVel = document.getElementById("obj-vel");
  var elValPob = document.getElementById("val-pob");
  var elValMut = document.getElementById("val-mut");
  var elPlay = document.getElementById("obj-play");
  var elGen = document.getElementById("obj-gen");
  var elMejor = document.getElementById("obj-mejor");
  var elProm = document.getElementById("obj-prom");
  var elEstado = document.getElementById("obj-estado");
  var elFilas = document.getElementById("obj-filas");

  /* ---------- utilidades ---------- */
  function azar() {
    var s = "";
    for (var i = 0; i < objetivo.length; i++) s += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
    return s;
  }

  function puntaje(p) {
    var f = 0;
    for (var i = 0; i < p.length; i++) if (p[i] === objetivo[i]) f++;
    return f;
  }

  function mejorDe(pob) {
    var m = 0;
    for (var i = 0; i < pob.length; i++) {
      var f = puntaje(pob[i]);
      if (f > m) m = f;
    }
    return m;
  }

  function sorteo(puntajes) {           // torneo de 3: gana el mejor del grupo
    var gane = Math.floor(Math.random() * puntajes.length);
    for (var t = 0; t < 2; t++) {
      var otro = Math.floor(Math.random() * puntajes.length);
      if (puntajes[otro] > puntajes[gane]) gane = otro;
    }
    return gane;
  }

  function corriendo() {
    return arrancado && !pausado && !ganado && !estancado;
  }

  /* ---------- un turno de evolución ---------- */
  function paso() {
    var puntos = poblacion.map(puntaje);

    // ordenar índices de mejor a peor
    var orden = puntos.map(function (_, i) { return i; })
      .sort(function (a, b) { return puntos[b] - puntos[a]; });

    // elitismo: los 2 mejores siguen intactos
    var nueva = [poblacion[orden[0]], poblacion[orden[1]]];

    while (nueva.length < poblacion.length) {
      var p1 = poblacion[sorteo(puntos)];
      var p2 = poblacion[sorteo(puntos)];

      // cruce en un punto
      var corte = 1 + Math.floor(Math.random() * (objetivo.length - 1));
      var hijo = p1.slice(0, corte) + p2.slice(corte);

      // mutación letra por letra
      var letras = hijo.split("");
      for (var i = 0; i < letras.length; i++) {
        if (Math.random() < mutacion) letras[i] = ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
      }
      nueva.push(letras.join(""));
    }

    poblacion = nueva;
    generacion++;

    // ---- condiciones de parada ----
    var mejor = mejorDe(poblacion);
    if (mejor > mejorAnt) { mejorAnt = mejor; ultimaMejora = generacion; }
    if (mejor >= objetivo.length) {
      ganado = true;                                   // encontró la palabra
    } else if (generacion - ultimaMejora >= LIMITE_SIN_MEJORA) {
      estancado = true;                                // dejó de mejorar
    }
    if (ganado || estancado) pararReloj();
  }

  /* ---------- estado visible (botón + cartel) ---------- */
  function textoBoton() {
    if (!arrancado) return "▶ Empezar";
    if (ganado) return "✓ Terminado";
    if (pausado || estancado) return "▶ Seguir";
    return "⏸ Pausar";
  }

  function textoEstado() {
    if (ganado) return "¡Objetivo logrado!";
    if (estancado) return "detenido: sin mejora";
    if (!arrancado) return "Listo para iniciar";
    if (pausado) return "pausado";
    return "evolucionando…";
  }

  function actualizarEstado() {
    elPlay.textContent = textoBoton();
    elPlay.disabled = ganado;
    elEstado.textContent = textoEstado();
  }

  /* ---------- dibujar ---------- */
  function pintar() {
    var puntos = poblacion.map(puntaje);
    var orden = puntos.map(function (_, i) { return i; })
      .sort(function (a, b) { return puntos[b] - puntos[a]; });
    var mejor = puntos[orden[0]];
    var prom = puntos.reduce(function (s, v) { return s + v; }, 0) / poblacion.length;

    elGen.textContent = generacion;
    elMejor.textContent = mejor + "/" + objetivo.length;
    elProm.textContent = prom.toFixed(1);

    var html = "";
    for (var n = 0; n < Math.min(8, orden.length); n++) {
      var p = poblacion[orden[n]], f = puntos[orden[n]], celdas = "";
      for (var c = 0; c < p.length; c++) {
        celdas += '<span class="' + (p[c] === objetivo[c] ? "ok" : "") + '">' + p[c] + "</span>";
      }
      html += '<div class="srow"><div class="str">' + celdas + "</div>" +
        '<div class="bar"><i style="width:' + (f / objetivo.length * 100) + '%"></i></div>' +
        '<div class="f">' + f + "</div></div>";
    }
    elFilas.innerHTML = html;
    actualizarEstado();
  }

  /* ---------- reloj ---------- */
  function pararReloj() {
    if (temporizador) { clearInterval(temporizador); temporizador = null; }
  }

  function correr() {
    pararReloj();
    if (!corriendo() || !visible) return;
    temporizador = setInterval(function () { paso(); pintar(); }, +elVel.value);
  }

  /* ---------- cambios en vivo ---------- */
  function redimensionar() {
    var meta = +elPob.value;
    if (poblacion.length === meta) return;
    if (poblacion.length > meta) {
      // al achicar: conservo los mejores
      var pts = poblacion.map(puntaje);
      var orden = pts.map(function (_, i) { return i; })
        .sort(function (a, b) { return pts[b] - pts[a]; });
      poblacion = orden.slice(0, meta).map(function (i) { return poblacion[i]; });
    } else {
      while (poblacion.length < meta) poblacion.push(azar());
    }
    elValPob.textContent = meta;
    pintar();
  }

  elPalabra.addEventListener("input", function () {
    var limpio = this.value.toUpperCase().replace(/[^A-ZÑ]/g, "").slice(0, 10);
    if (!limpio) { this.value = objetivo; return; }   // no se permite vacío
    if (limpio !== this.value) this.value = limpio;
    if (limpio !== objetivo) {
      objetivo = limpio;
      // la meta cambió: se limpian las condiciones de parada
      ganado = false; estancado = false;
      mejorAnt = 0; ultimaMejora = generacion;
      pintar();
      if (!temporizador) correr();                    // seguimos si estaba en marcha
    }
  });
  // al salir del campo: si quedó corta, la completamos con el valor válido
  elPalabra.addEventListener("change", function () {
    if (this.value.toUpperCase().replace(/[^A-ZÑ]/g, "") !== objetivo) this.value = objetivo;
  });

  elPob.addEventListener("input", function () { redimensionar(); });

  elMut.addEventListener("input", function () {
    mutacion = +this.value / 100;
    elValMut.textContent = this.value + "%";
    // subir la mutación es la salida típica de un estancamiento
    if (estancado) {
      estancado = false; ultimaMejora = generacion;
      pintar();
      correr();
    }
  });

  elVel.addEventListener("change", function () { if (temporizador) correr(); });

  elPlay.addEventListener("click", function () {
    this.blur();
    if (ganado) return;                               // terminado: hay que reiniciar
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

  document.getElementById("obj-reset").addEventListener("click", function () {
    this.blur();
    reiniciar();
    if (corriendo() && visible) correr();
  });

  function reiniciar() {
    pararReloj();
    poblacion = [];
    for (var i = 0; i < +elPob.value; i++) poblacion.push(azar());
    generacion = 0;
    ganado = false; estancado = false;
    mejorAnt = 0; ultimaMejora = 0;
    pintar();
  }

  /* ---------- registro con la presentación ---------- */
  window.Presentacion.registrar("slide-demo-palabra", {
    start: function () {
      visible = true;
      if (!poblacion.length) reiniciar();             // estado inicial, sin correr
      if (corriendo()) correr();
      actualizarEstado();
    },
    stop: function () { visible = false; pararReloj(); }
  });
})();
