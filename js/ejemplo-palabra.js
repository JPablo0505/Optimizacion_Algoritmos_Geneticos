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

   Modo paso a paso (con la demo en pausa):
   · "Siguiente generación" avanza exactamente una generación
     mientras el panel del ciclo ilumina cada etapa.
   · "Ver un cruce en cámara lenta" toma la población REAL, hace
     dos torneos reales, un cruce y una mutación reales, y los
     muestra en 6 pasos. Ese hijo es un ejemplo: no se agrega a
     la población (así la corrida no cambia por mirarla).

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
  var modoPaso = false;           // el presentador está avanzando a mano
  var barrido = null;             // temporizador de "Siguiente generación"
  var cam = null;                 // estado de la cámara lenta (null = cerrada)

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
  var elFrase = document.getElementById("obj-frase");
  var ciclo = window.Ciclo.crear(document.getElementById("obj-ciclo"), { frase: elFrase });
  var elMain = document.getElementById("obj-main");
  var elFilas = document.getElementById("obj-filas");
  var elPasos = document.getElementById("obj-pasos");
  var elSigGen = document.getElementById("obj-siggen");
  var elVerCruce = document.getElementById("obj-vercruce");
  var elCam = document.getElementById("obj-camara");

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

  /* torneo de 3: se sortean 3 palabras (con reposición) y gana la de más
     letras correctas; si empatan, se queda la primera sorteada */
  function torneo(puntajes) {
    var grupo = [Math.floor(Math.random() * puntajes.length)], gane = grupo[0];
    for (var t = 0; t < 2; t++) {
      var otro = Math.floor(Math.random() * puntajes.length);
      grupo.push(otro);
      if (puntajes[otro] > puntajes[gane]) gane = otro;
    }
    return { grupo: grupo, gane: gane };
  }
  function sorteo(puntajes) { return torneo(puntajes).gane; }

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
    var letras = hijo.txt.split(""), cambios = [];
    for (var i = 0; i < letras.length; i++) {
      if (Math.random() < mutacion) {
        var antes = letras[i];
        letras[i] = letraAlAzar();          // puede salir la misma letra: igual cuenta como mutación
        hijo.org[i] = "mut";
        cambios.push({ i: i, de: antes, a: letras[i] });
      }
    }
    hijo.txt = letras.join("");
    return cambios;
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
    // panel del ciclo: girando, a mano (paso a paso) o quieto
    ciclo.modo(corriendo() ? "continuo" : modoPaso ? "paso" : "quieto");
    elPlay.textContent = textoBoton();
    elPlay.disabled = ganado;
    elEstado.textContent = textoEstado();
    // los botones de paso a paso solo tienen sentido con la demo detenida
    elPasos.hidden = corriendo() || ganado;
    elSigGen.disabled = !!barrido;
    elVerCruce.disabled = !!barrido;
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
    elMain.style.setProperty("--n", objetivo.length);    // las fichas se achican con el largo
    elMain.dataset.largo = objetivo.length > 14 ? "l" : objetivo.length > 10 ? "m" : "s";
    elFilas.innerHTML = html;
    actualizarEstado();
  }

  /* =========================================================
     MODO PASO A PASO
     ========================================================= */
  function entrarModoPaso() {
    if (!modoPaso) { modoPaso = true; ponerOrigen(true); }   // en paso a paso, el origen se ve
    elMain.classList.add("en-paso");                        // la frase reemplaza la nota de abajo
  }

  function salirModoPaso() {
    modoPaso = false;
    elMain.classList.remove("en-paso");
    cerrarCamara();
    pararBarrido();
    ciclo.frase("");
    if (verOrigen) ponerOrigen(false);                   // en continuo no se recarga la pantalla
  }

  /* ---------- ⏭ Siguiente generación: el ciclo ilumina cada etapa ---------- */
  function pararBarrido() {
    if (barrido) { clearInterval(barrido); barrido = null; }
  }

  function siguienteGeneracion() {
    if (barrido || corriendo() || ganado) return;
    cerrarCamara();
    entrarModoPaso();
    var etapas = [
      ["medir", "Medir: se cuenta cuántas letras de cada palabra ya están en su lugar."],
      ["elegir", "Elegir: en sorteos de 3 palabras gana la de más letras correctas."],
      ["cruzar", "Cruzar: cada hijo toma el comienzo de un padre y el final del otro."],
      ["mutar", "Mutar: a veces una letra del hijo cambia al azar."],
      ["repetir", ""]
    ];
    var k = 0;
    function tic() {
      var e = etapas[k];
      if (e[0] === "repetir") {
        paso();                                       // la generación se calcula de verdad aquí
        e[1] = "Repetir: lista la generación " + generacion + ". Las 2 mejores (élite) pasaron intactas.";
        pararBarrido();
        pintar();
      }
      ciclo.marcar(e[0], e[1]);
      k++;
    }
    barrido = setInterval(tic, 420);
    actualizarEstado();                               // primero el modo "paso", luego se marca
    tic();
  }

  /* ---------- 🔍 un cruce en cámara lenta, con datos reales ---------- */
  var PASOS_CAM = 6;

  function abrirCamara() {
    if (corriendo() || ganado) return;
    pararBarrido();
    entrarModoPaso();
    var puntos = poblacion.map(puntaje);
    var t1 = torneo(puntos), t2 = torneo(puntos);
    var p1 = poblacion[t1.gane], p2 = poblacion[t2.gane];
    var corte = 1 + Math.floor(Math.random() * (objetivo.length - 1));
    var hijo = cruzar(p1, p2, corte);
    var cruzado = { txt: hijo.txt, org: hijo.org.slice() };   // el hijo antes de mutar
    var cambios = mutar(hijo);

    // para "Medir": 5 palabras distintas de la población, al azar
    var idx = poblacion.map(function (_, i) { return i; });
    for (var j = idx.length - 1; j > 0; j--) {
      var r = Math.floor(Math.random() * (j + 1)), t = idx[j]; idx[j] = idx[r]; idx[r] = t;
    }

    cam = {
      k: 0, t1: t1, t2: t2, p1: p1, p2: p2, corte: corte,
      cruzado: cruzado, hijo: hijo, cambios: cambios, muestra: idx.slice(0, 5)
    };
    elFilas.hidden = true;
    elCam.hidden = false;
    actualizarEstado();
    pintarCamara();
  }

  function cerrarCamara() {
    if (!cam) return;
    cam = null;
    elCam.hidden = true;
    elCam.innerHTML = "";
    elFilas.hidden = false;
    ciclo.marcar(null, "");
  }

  /* una fila de la cámara: etiqueta + fichas + puntaje.
     modo: "ok" (verde = correcta), "origen" (azul/naranja/morado por origen),
     "p1"/"p2" (resalta la parte que hereda ese padre) */
  function filaCam(etq, ind, modo, extra) {
    extra = extra || {};
    var p = ind.txt, celdas = "";
    for (var c = 0; c < p.length; c++) {
      var cls = "";
      if (modo === "ok") cls = p[c] === objetivo[c] ? "ok" : "";
      else if (modo === "p1") cls = c < cam.corte ? "t-p1" : "t-off";
      else if (modo === "p2") cls = c >= cam.corte ? "t-p2" : "t-off";
      else if (modo === "origen") cls = ind.org[c] === "mut" ? "t-mut" : ind.org[c] === "p1" ? "t-p1" : "t-p2";
      if (extra.corte && c === cam.corte) cls += " corte";
      if (p[c] === " ") cls += " esp";
      celdas += '<span class="' + cls + '">' + (p[c] === " " ? "␣" : p[c]) + "</span>";
    }
    return '<div class="cam-fila' + (extra.clase ? " " + extra.clase : "") + '">' +
      '<div class="cam-etq">' + etq + "</div>" +
      '<div class="str">' + celdas + "</div>" +
      '<div class="cam-pts">' + (extra.pts === false ? "" : puntaje(ind) + "/" + objetivo.length) + "</div></div>";
  }

  function filasTorneo(t, cual) {
    var html = "";
    t.grupo.forEach(function (i, k) {
      var gana = i === t.gane && t.grupo.indexOf(i) === k;   // la primera aparición del ganador
      html += filaCam(gana ? "Gana: padre " + cual : "Sorteada", poblacion[i], "ok",
        { clase: gana ? "gana gana-p" + cual : "pierde" });
    });
    return html;
  }

  function verLetra(l) { return l === " " ? "espacio" : l; }

  function pintarCamara() {
    if (!cam) return;
    var L = objetivo.length, html = "", etapa, frase;
    var pts1 = puntaje(cam.p1), pts2 = puntaje(cam.p2), ptsH = puntaje(cam.hijo);
    switch (cam.k) {
      case 0:
        etapa = "medir";
        frase = "Medir: a cada palabra se le cuentan las letras que ya están en su lugar.";
        cam.muestra.forEach(function (i) { html += filaCam("Palabra", poblacion[i], "ok"); });
        break;
      case 1:
        etapa = "elegir";
        frase = "Elegir: se sortean 3 palabras y gana la que tiene más letras correctas. Será el padre 1.";
        html = filasTorneo(cam.t1, 1);
        break;
      case 2:
        etapa = "elegir";
        frase = "Se repite el sorteo con otras 3 palabras para elegir al padre 2.";
        html = filasTorneo(cam.t2, 2);
        break;
      case 3:
        etapa = "cruzar";
        frase = "Cruzar: se corta después de la letra " + cam.corte + ". El hijo toma el comienzo " +
          "del padre 1 (azul) y el final del padre 2 (naranja).";
        html = filaCam("Padre 1", cam.p1, "p1", { corte: true }) +
          filaCam("Padre 2", cam.p2, "p2", { corte: true }) +
          filaCam("Hijo", cam.cruzado, "origen", { corte: true, clase: "hijo", pts: false });
        break;
      case 4:
        etapa = "mutar";
        if (cam.cambios.length) {
          frase = "Mutar: " + cam.cambios.map(function (m) {
            return m.de === m.a
              ? "la letra " + (m.i + 1) + " se sorteó de nuevo y le volvió a salir " + verLetra(m.a)
              : "la letra " + (m.i + 1) + " cambió al azar de " + verLetra(m.de) + " a " + verLetra(m.a);
          }).join("; ") + ".";
        } else {
          frase = "Mutar: esta vez no hubo mutación (cada letra tenía " +
            elValMut.textContent + " de probabilidad de cambiar).";
        }
        html = filaCam("Antes", cam.cruzado, "origen", { pts: false }) +
          filaCam("Después", cam.hijo, "origen", { clase: "hijo", pts: false });
        break;
      default:
        etapa = "repetir";
        var veredicto = ptsH > Math.max(pts1, pts2) ? "¡supera a sus dos padres!"
          : ptsH >= Math.min(pts1, pts2) ? "queda a la altura de sus padres."
          : "salió peor que sus padres: la selección lo irá descartando.";
        frase = "Resultado: el hijo tiene " + ptsH + "/" + L + " y " + veredicto +
          " Así se arma cada uno de los " + (poblacion.length - ELITE) + " hijos de la generación.";
        html = filaCam("Padre 1", cam.p1, "ok", { clase: "gana-p1" }) +
          filaCam("Padre 2", cam.p2, "ok", { clase: "gana-p2" }) +
          filaCam("Hijo", cam.hijo, "ok", { clase: "hijo" });
    }
    ciclo.marcar(etapa, frase);
    var ultimo = cam.k >= PASOS_CAM - 1;
    elCam.innerHTML =
      '<div class="cam-cab"><b>Un cruce en cámara lenta</b>' +
      '<span class="cam-n">Paso ' + (cam.k + 1) + " de " + PASOS_CAM + "</span>" +
      '<span class="cam-btns">' +
      '<button class="btn primary" data-cam="sig">' + (ultimo ? "↻ Ver otro cruce" : "Siguiente ›") + "</button>" +
      '<button class="btn" data-cam="cerrar">✕ Cerrar</button></span></div>' +
      '<div class="cam-filas">' + html + "</div>";
  }

  elCam.addEventListener("click", function (e) {
    var b = e.target.closest("[data-cam]");
    if (!b || !cam) return;
    b.blur();
    if (b.dataset.cam === "cerrar") { cerrarCamara(); actualizarEstado(); return; }
    if (cam.k >= PASOS_CAM - 1) { abrirCamara(); return; }
    cam.k++;
    pintarCamara();
  });

  elSigGen.addEventListener("click", function () { this.blur(); siguienteGeneracion(); });
  elVerCruce.addEventListener("click", function () { this.blur(); abrirCamara(); });

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
      cerrarCamara();                                 // la cámara lenta mostraba otra meta
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
    if (corriendo()) { salirModoPaso(); correr(); } else pararReloj();
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
    pararBarrido();
    cerrarCamara();
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
    stop: function () {
      visible = false;
      pararReloj();
      if (barrido) { pararBarrido(); ciclo.marcar(null, ""); }   // un barrido a medias se cancela
    }
  });
})();
