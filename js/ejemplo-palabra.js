/* =========================================================
   ejemplo-palabra.js — Ejemplo 1: la población quiere
   formar su palabra (o frase corta, hasta 20 símbolos).
   Todo es editable en vivo: objetivo, tamaño, mutación y
   velocidad. NO arranca solo: hay que presionar "Empezar".
   Alfabeto: 27 letras + el espacio = 28 símbolos. La entrada
   se normaliza (mayúsculas, sin tildes, conserva la Ñ).
   Mutación automática: 1 / largo (≈ 1 letra cambiada por hijo).

   Cada individuo es { txt, org } donde org[i] dice de dónde
   salió la letra i en esta generación:
     "ini"   → población inicial al azar
     "p1"    → copiada del padre 1 (el comienzo, antes del corte)
     "p2"    → copiada del padre 2 (el final, después del corte)
     "mut"   → cambiada al azar por la mutación
     "elite" → el individuo entero pasó intacto (elitismo)

   Condiciones de parada (como en todo algoritmo genético):
   · encontró la palabra                 → se detiene y lo avisa
   · max(150, 15 × largo) gen. sin mejora → se detiene (estancado)
   · pausa manual                         → el usuario lo para
   ========================================================= */
(function () {
  "use strict";

  var ALFABETO = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ ";   // 28 símbolos (el último es el espacio)
  var LARGO_MAX = 20;
  var ELITE = 2;
  var FILAS = 8;                  // palabras visibles (las mejores)

  // generaciones sin mejorar antes de detenerse: crece con el largo
  function limiteSinMejora() { return Math.max(150, 15 * objetivo.length); }

  var objetivo = "GENETICA";
  var poblacion = [];             // [{ txt, org }]
  var generacion = 0;
  var mutacion = 1 / 8;           // automática: 1 / largo (12,5 % con GENETICA)
  var mutAuto = true;             // el interruptor "Mutación automática"
  var verOrigen = false;          // el interruptor "Ver de dónde viene cada letra"

  // máquina de estados
  var arrancado = false;          // el usuario presionó Empezar
  var pausado = false;
  var ganado = false;             // encontró la palabra → condición de parada
  var estancado = false;          // sin mejora en el límite → condición de parada
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
  var elMutAuto = document.getElementById("obj-mutauto");
  var elOrigen = document.getElementById("obj-origen");
  var elLeyenda = document.getElementById("obj-leyenda");
  var elPlay = document.getElementById("obj-play");
  var elGen = document.getElementById("obj-gen");
  var elMejor = document.getElementById("obj-mejor");
  var elProm = document.getElementById("obj-prom");
  var elEstado = document.getElementById("obj-estado");
  var ciclo = window.Ciclo.crear(document.getElementById("obj-ciclo"));
  var elFilas = document.getElementById("obj-filas");

  /* ---------- utilidades ---------- */
  function letraAlAzar() { return ALFABETO[Math.floor(Math.random() * ALFABETO.length)]; }

  function azar() {
    var s = "", org = [];
    for (var i = 0; i < objetivo.length; i++) { s += letraAlAzar(); org.push("ini"); }
    return { txt: s, org: org };
  }

  function puntaje(ind) {
    var p = ind.txt, f = 0;
    for (var i = 0; i < p.length; i++) if (p[i] === objetivo[i]) f++;
    return f;
  }

  function ordenar(puntos) {            // índices de mejor a peor
    return puntos.map(function (_, i) { return i; })
      .sort(function (a, b) { return puntos[b] - puntos[a]; });
  }

  function sorteo(puntajes) {           // torneo de 3: gana el mejor del grupo
    var gane = Math.floor(Math.random() * puntajes.length);
    for (var t = 0; t < 2; t++) {
      var otro = Math.floor(Math.random() * puntajes.length);
      if (puntajes[otro] > puntajes[gane]) gane = otro;
    }
    return gane;
  }

  /* mayúsculas, sin tildes (Á→A, Ü→U), conserva la Ñ, solo letras y espacios */
  function normalizar(txt) {
    return txt.toUpperCase()
      .replace(/Ñ/g, "\u0001")                        // proteger la Ñ de la limpieza de tildes
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/\u0001/g, "Ñ")
      .replace(/[^A-ZÑ ]/g, "")
      .replace(/ {2,}/g, " ")
      .replace(/^ +/, "")
      .slice(0, LARGO_MAX);
  }

  function mostrarMutacion() {
    var pct = Math.round(mutacion * 1000) / 10;       // una cifra decimal: 12,5
    elMut.value = pct;
    elValMut.textContent = String(pct).replace(".", ",") + "%";
    elMutAuto.checked = mutAuto;
  }

  /* con la mutación automática, la tasa sigue al largo del objetivo */
  function ajustarMutacionAuto() {
    if (!mutAuto) return;
    mutacion = Math.min(0.15, 1 / objetivo.length);
    mostrarMutacion();
  }

  function ponerOrigen(v) {
    verOrigen = v;
    elOrigen.checked = v;
    elLeyenda.hidden = !v;
  }

  function corriendo() {
    return arrancado && !pausado && !ganado && !estancado;
  }

  /* ---------- operadores (los usa paso() y, más adelante, la cámara lenta) ---------- */
  function cruzar(p1, p2, corte) {       // cruce en un punto: comienzo de p1 + final de p2
    var org = [];
    for (var i = 0; i < objetivo.length; i++) org.push(i < corte ? "p1" : "p2");
    return { txt: p1.txt.slice(0, corte) + p2.txt.slice(corte), org: org };
  }

  function mutar(hijo) {                 // cada letra cambia con probabilidad "mutacion"
    var letras = hijo.txt.split(""), cambio = false;
    for (var i = 0; i < letras.length; i++) {
      if (Math.random() < mutacion) {
        letras[i] = letraAlAzar();
        hijo.org[i] = "mut";
        cambio = true;
      }
    }
    hijo.txt = letras.join("");
    return cambio;
  }

  function copiaElite(ind) {
    var org = [];
    for (var i = 0; i < ind.txt.length; i++) org.push("elite");
    return { txt: ind.txt, org: org, elite: true };
  }

  /* ---------- un turno de evolución ---------- */
  function paso() {
    var puntos = poblacion.map(puntaje);          // 1. medir
    var orden = ordenar(puntos);

    // elitismo: los 2 mejores siguen intactos
    var nueva = [];
    for (var e = 0; e < ELITE && e < orden.length; e++) nueva.push(copiaElite(poblacion[orden[e]]));

    while (nueva.length < poblacion.length) {
      var p1 = poblacion[sorteo(puntos)];         // 2. elegir (torneo)
      var p2 = poblacion[sorteo(puntos)];
      var corte = 1 + Math.floor(Math.random() * (objetivo.length - 1));
      var hijo = cruzar(p1, p2, corte);           // 3. cruzar
      mutar(hijo);                                // 4. mutar
      nueva.push(hijo);
    }

    poblacion = nueva;                            // 5. repetir con la nueva generación
    generacion++;

    // ---- condiciones de parada ----
    var mejor = 0;
    for (var k = 0; k < poblacion.length; k++) mejor = Math.max(mejor, puntaje(poblacion[k]));
    if (mejor > mejorAnt) { mejorAnt = mejor; ultimaMejora = generacion; }
    if (mejor >= objetivo.length) {
      ganado = true;                                   // encontró la palabra
    } else if (generacion - ultimaMejora >= limiteSinMejora()) {
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
    ciclo.modo(corriendo() ? "continuo" : "quieto");   // panel del ciclo: ¿está girando?
    elPlay.textContent = textoBoton();
    elPlay.disabled = ganado;
    elEstado.textContent = textoEstado();
  }

  /* ---------- dibujar ---------- */
  /* fichas de una palabra: verde = letra correcta; con "ver origen",
     franja azul/naranja = padre 1/2 y borde morado = mutación */
  function fichas(ind, conOrigen) {
    var p = ind.txt, html = "";
    for (var c = 0; c < p.length; c++) {
      var cls = p[c] === objetivo[c] ? "ok" : "";
      if (p[c] === " ") cls += " esp";
      if (conOrigen && ind.org[c] !== "ini" && ind.org[c] !== "elite") cls += " o-" + ind.org[c];
      html += '<span class="' + cls + '">' + (p[c] === " " ? "␣" : p[c]) + "</span>";
    }
    return html;
  }

  function pintar() {
    var puntos = poblacion.map(puntaje);
    var orden = ordenar(puntos);
    var mejor = puntos[orden[0]];
    var prom = puntos.reduce(function (s, v) { return s + v; }, 0) / poblacion.length;

    elGen.textContent = generacion;
    elMejor.textContent = mejor + "/" + objetivo.length;
    elProm.textContent = prom.toFixed(1).replace(".", ",");

    var html = "";
    for (var n = 0; n < Math.min(FILAS, orden.length); n++) {
      var ind = poblacion[orden[n]], f = puntos[orden[n]];
      html += '<div class="srow' + (verOrigen ? " con-origen" : "") + '">' +
        '<div class="str">' + fichas(ind, verOrigen) + "</div>" +
        '<div class="bar"><i style="width:' + (f / objetivo.length * 100) + '%"></i>' +
        (verOrigen && ind.elite ? '<em class="et-elite">élite</em>' : "") + "</div>" +
        '<div class="f">' + f + "</div></div>";
    }
    elFilas.style.setProperty("--n", objetivo.length);   // las fichas se achican con el largo
    elFilas.dataset.largo = objetivo.length > 14 ? "l" : objetivo.length > 10 ? "m" : "s";
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
      var orden = ordenar(poblacion.map(puntaje));
      poblacion = orden.slice(0, meta).map(function (i) { return poblacion[i]; });
    } else {
      while (poblacion.length < meta) poblacion.push(azar());
    }
    elValPob.textContent = meta;
    pintar();
  }

  elPalabra.addEventListener("input", function () {
    var limpio = normalizar(this.value);
    if (limpio !== this.value) this.value = limpio;   // el campo conserva el espacio que se está escribiendo
    limpio = limpio.trim();                           // pero el objetivo no termina en espacio
    if (!limpio) return;                              // vacío: se conserva el objetivo anterior
    if (limpio !== objetivo) {
      var largoCambio = limpio.length !== objetivo.length;
      objetivo = limpio;
      if (largoCambio) ajustarLargo();
      ajustarMutacionAuto();
      // la meta cambió: se limpian las condiciones de parada
      ganado = false; estancado = false;
      mejorAnt = 0; ultimaMejora = generacion;
      pintar();
      if (!temporizador) correr();                    // seguimos si estaba en marcha
    }
  });
  // al salir del campo: si quedó corta, la completamos con el valor válido
  elPalabra.addEventListener("change", function () {
    if (normalizar(this.value).trim() !== objetivo) this.value = objetivo;
  });

  elPob.addEventListener("input", function () { redimensionar(); });

  elMut.addEventListener("input", function () {
    mutAuto = false;                                  // el usuario manda: se apaga lo automático
    mutacion = +this.value / 100;
    mostrarMutacion();
    // subir la mutación es la salida típica de un estancamiento
    if (estancado) {
      estancado = false; ultimaMejora = generacion;
      pintar();
      correr();
    }
  });

  elMutAuto.addEventListener("change", function () {
    mutAuto = this.checked;
    if (mutAuto) ajustarMutacionAuto();
  });

  elOrigen.addEventListener("change", function () { ponerOrigen(this.checked); pintar(); });

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
    pintar();
  });

  document.getElementById("obj-reset").addEventListener("click", function () {
    this.blur();
    reiniciar();
    if (corriendo() && visible) correr();
  });

  /* el objetivo cambió de largo: cada palabra se recorta o se completa al azar */
  function ajustarLargo() {
    var L = objetivo.length;
    poblacion = poblacion.map(function (ind) {
      var txt = ind.txt.slice(0, L), org = ind.org.slice(0, L);
      while (txt.length < L) { txt += letraAlAzar(); org.push("ini"); }
      return { txt: txt, org: org };
    });
  }

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
      if (!poblacion.length) { mostrarMutacion(); ponerOrigen(false); reiniciar(); }   // estado inicial, sin correr
      if (corriendo()) correr();
      actualizarEstado();
    },
    stop: function () { visible = false; pararReloj(); }
  });
})();
