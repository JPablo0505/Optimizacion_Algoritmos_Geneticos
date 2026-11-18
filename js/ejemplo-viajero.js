/* =========================================================
   ejemplo-viajero.js — Ejemplo 2: el problema del viajero
   (TSP) evolucionando en vivo, como un repartidor que sale
   de la Bodega, visita todos los barrios y vuelve.
   Editable mientras corre:
   · sliders: barrios, población, mutación, velocidad
   · mapa interactivo: clic en el mapa = agrega el barrio real
     libre más cercano; clic sobre un barrio = lo quita
     (la Bodega no se quita). Los barrios están en su ubicación
     REAL, así que ya no se arrastran.
   El mapa es REAL (js/mapa.js + js/datos-mapa.js, de OpenStreetMap):
   las vías principales del Valle de Aburrá se dibujan una sola vez
   en un canvas de fondo; encima va otro canvas con las rutas.
   La distancia entre dos barrios es la distancia POR CALLE por las
   vías principales (sin sentidos viales), en km reales, y cada
   tramo de una ruta se dibuja siguiendo esas calles.
   Antes de pulsar "Empezar" solo se ven los barrios: todavía no hay
   rutas. Al correr, la mejor ruta HASTA AHORA se dibuja en fucsia
   (aún puede mejorar) y, detrás, 24 rutas de la población en azul
   marino tenue: al principio van en todas direcciones y, con las
   generaciones, se parecen cada vez más a la mejor (la población
   converge). Solo cuando el algoritmo se detiene (200 generaciones
   sin mejorar) la ruta se pinta de verde: es la ruta FINAL. Un
   algoritmo genético no garantiza la óptima: es la mejor que encontró.
   "⛶ Ampliar" muestra el mapa a casi toda la pantalla.
   NO arranca solo: hay que presionar "Empezar".

   Instantáneas para la slide 12 ("Así evolucionó la ruta"):
   se guarda la mejor ruta en la generación 0, en cada nuevo
   récord y en los hitos 10, 50, 100, 200 y 500. Si el mapa
   cambia durante la corrida (agregar o quitar un barrio)
   no se borra todo: las instantáneas empiezan de nuevo desde ese
   momento (su nueva "generación 0") y se recuerda en qué
   generación cambió, para avisarlo en la slide 12.
   window.Repartidor expone esos datos (lo usa js/ejemplo-ruta.js).

   Condiciones de parada (como en todo algoritmo genético):
   · 200 generaciones sin mejora → se detiene (estancado)
   · pausa manual                → el usuario lo para
   ========================================================= */
(function () {
  "use strict";

  var M = window.Mapa;
  var W = M.W, H = M.H;           // tamaño lógico del mapa (proporción real del valle)
  var CW = 700, CH = 105;         // tamaño lógico de la curva (cerca de su tamaño en pantalla: letras legibles)
  var K = 5, ELITE = 2;           // presión de selección y élites
  var LIMITE_SIN_MEJORA = 200;    // generaciones sin mejorar antes de detenerse
  var ESTANCA = 30;               // desde aquí la curva marca el tramo como "estancado"
  var MUESTRA_POB = 24;           // rutas grises dibujadas (no las 120: satura y es lento)

  var ciudades = [];              // [{p, x, y, nombre, bodega}]: p = índice en Mapa.pool; la 0 es la Bodega
  var etiquetas = [];             // posición de cada nombre (se recalcula al cambiar los barrios)
  var dist = [];                  // matriz de distancias
  var poblacion = [];             // rutas (permutaciones de índices)
  var historial = [];             // mejor distancia por generación (para la curva)
  var promedios = [];             // distancia promedio de la población por generación
  var recordsGen = [];            // generaciones en que apareció un nuevo récord
  var curvaGen0 = 0;              // generación del primer punto de la curva
  var esc = 1;                    // generaciones por punto (crece si la curva se hace muy larga)
  var mejorRuta = [];
  var mejorD = Infinity;
  var inicialD = null;
  var generacion = 0;
  var ultimaMejora = 0;           // generación en que hubo la última mejora

  var fotos = [];                 // instantáneas: [{ gen, ruta (desde la Bodega), d }]
  var genBase = 0;                // generación que cuenta como "0" para las instantáneas
  var cambioMapa = null;          // { gen } si el mapa cambió en plena corrida
  var HITOS = [10, 50, 100, 200, 500];

  var mutacion = 0.35;
  var poblacionMeta = 120;

  // máquina de estados
  var arrancado = false;          // el usuario presionó Empezar
  var pausado = false;
  var estancado = false;          // sin mejora en LIMITE_SIN_MEJORA → condición de parada

  var visible = false;
  var reloj = null;

  var cursor = null;              // índice del barrio bajo el cursor (muestra su nombre)
  var verPob = true;              // interruptor "Mostrar la población"
  var firmaLeyenda = "";          // estado de la leyenda la última vez que se ubicaron los nombres

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
  var elLeyenda = document.getElementById("via-leyenda");
  var elLeyCand = document.getElementById("via-ley-cand");
  var elLeyFinal = document.getElementById("via-ley-final");
  var elLeyPob = document.getElementById("via-ley-pob");
  var elCurvaMejor = document.getElementById("via-curva-mejor");
  var elInfo = document.getElementById("via-info");
  var elPlay2 = document.getElementById("via-play2");
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
  var pctx = M.prepararCanvas(elPlano, W, H);
  var ctx = M.prepararCanvas(elMapa, W, H);
  var cctx = prepararCanvas(elCurva, CW, CH);

  function ri(n) { return Math.floor(Math.random() * n); }
  function km(m) { return (m / 1000).toFixed(1).replace(".", ",") + " km"; }   // las distancias van en metros

  function corriendo() {
    return arrancado && !pausado && !estancado;
  }

  /* fucsia mientras puede mejorar; verde cuando el algoritmo se detuvo */
  function colorMejor() { return estancado ? M.COLOR.final : M.COLOR.candidata; }

  /* ---------- barrios reales y distancias por calle ---------- */
  function nuevaCiudad(p) {
    var b = M.pool[p];
    return { p: p, x: b.x, y: b.y, nombre: b.nombre, bodega: ciudades.length === 0 };   // el primero es la Bodega
  }

  function libres() {
    var usados = {};
    ciudades.forEach(function (c) { usados[c.p] = 1; });
    var out = [];
    for (var i = 0; i < M.pool.length; i++) if (!usados[i]) out.push(i);
    return out;
  }

  function agregarAlAzar() {
    var l = libres();
    if (l.length) ciudades.push(nuevaCiudad(l[ri(l.length)]));
  }

  /* el barrio real libre más cercano a un punto del mapa */
  function libreMasCercano(x, y) {
    var l = libres(), mejor = -1, md = Infinity;
    for (var k = 0; k < l.length; k++) {
      var b = M.pool[l[k]], d = (b.x - x) * (b.x - x) + (b.y - y) * (b.y - y);
      if (d < md) { md = d; mejor = l[k]; }
    }
    return mejor;
  }

  function calcularDistancias() {
    dist = [];
    for (var i = 0; i < ciudades.length; i++) {
      dist[i] = [];
      for (var j = 0; j < ciudades.length; j++) {
        dist[i][j] = M.distancia(ciudades[i].p, ciudades[j].p);   // metros por calle
      }
    }
    etiquetas = M.ubicarEtiquetas(ctx, ciudades, W, H, zonaLeyenda(), M.tamEtiqueta(elMapa, W));
  }

  /* la leyenda HTML tapa una esquina del mapa: ahí no se ponen nombres */
  function zonaLeyenda() {
    var ley = document.getElementById("via-leyenda");
    var m = elMapa.getBoundingClientRect(), l = ley.getBoundingClientRect();
    if (ley.hidden) return [];                                          // sin leyenda: todo el mapa libre
    if (!m.width) return [{ x: 0, y: 0, w: 330, h: 80 }];              // aún sin medidas: un margen amplio
    var e = W / m.width;
    return [{ x: (l.left - m.left) * e - 4, y: (l.top - m.top) * e - 4, w: l.width * e + 8, h: l.height * e + 8 }];
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
    historial = []; promedios = []; recordsGen = [];   // la curva empieza de nuevo
    curvaGen0 = generacion; esc = 1;
    ultimaMejora = generacion;
    estancado = false;
    empezarFotos();
    pintar();
  }

  /* ---------- instantáneas de la mejor ruta ---------- */
  function empezarFotos() {
    genBase = generacion;
    fotos = [];
    tomarFoto();
  }

  function tomarFoto() {
    var ult = fotos[fotos.length - 1];
    if (ult && ult.gen === generacion) { ult.ruta = desdeBodega(mejorRuta); ult.d = mejorD; return; }
    fotos.push({ gen: generacion, ruta: desdeBodega(mejorRuta), d: mejorD });
  }

  /* el mapa cambió: si ya había una corrida en marcha, se recuerda en qué generación */
  function marcarCambioMapa() {
    if (arrancado && (generacion > genBase || fotos.length > 1)) cambioMapa = { gen: generacion };
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
    var quien = 0, suma = d[0];
    for (var i = 1; i < d.length; i++) { suma += d[i]; if (d[i] < d[quien]) quien = i; }
    if (d[quien] < mejorD) {
      mejorD = d[quien];
      mejorRuta = poblacion[quien].slice();
      ultimaMejora = generacion;                      // hubo mejora: se reinicia el plazo
      recordsGen.push(generacion);
      tomarFoto();                                    // nuevo récord → instantánea
    }
    if (HITOS.indexOf(generacion - genBase) >= 0) tomarFoto();   // hitos fijos
    anotarCurva(mejorD, suma / d.length);

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

  /* un punto por generación; si la curva se alarga demasiado, se guarda uno de cada dos */
  function anotarCurva(mejor, prom) {
    if ((generacion - curvaGen0) % esc !== 0) return;
    historial.push(mejor);
    promedios.push(prom);
    if (historial.length > 3000) {
      historial = historial.filter(function (_, k) { return k % 2 === 0; });
      promedios = promedios.filter(function (_, k) { return k % 2 === 0; });
      esc *= 2;
    }
  }

  /* ---------- estado visible (botón + cartel) ---------- */
  function textoBoton() {
    if (!arrancado) return "▶ Empezar";
    if (pausado || estancado) return "▶ Seguir";
    return "⏸ Pausar";
  }

  function textoEstado() {
    if (estancado) return "Se estancó en un valle: suba la mutación o pulse Seguir";
    if (!arrancado) return "Listo para iniciar";
    if (pausado) return "pausado";
    return "corriendo…";
  }

  function actualizarEstado() {
    // leyenda del mapa: qué significa cada color en este momento
    elLeyenda.hidden = !arrancado;
    elLeyCand.hidden = estancado;
    elLeyFinal.hidden = !estancado;
    elLeyPob.hidden = !verPob;
    elCurvaMejor.classList.toggle("final", estancado);
    document.getElementById("via-curva-record").classList.toggle("final", estancado);
    elInfo.textContent = "Generación " + generacion + " · " +
      (estancado ? "ruta final: " : "mejor hasta ahora: ") + (mejorD === Infinity ? "-" : km(mejorD));
    // si la leyenda cambió de tamaño, los nombres se reubican para no quedar tapados
    var firma = elLeyenda.hidden + "|" + estancado + "|" + verPob;
    if (firma !== firmaLeyenda) { firmaLeyenda = firma; reubicarEtiquetas(); }
    ciclo.modo(corriendo() ? "continuo" : "quieto");   // panel del ciclo: ¿está girando?
    elPlay.textContent = textoBoton();
    elPlay2.textContent = elPlay.textContent;          // el mismo botón dentro del mapa ampliado
    elEstado.textContent = textoEstado();
  }

  /* ---------- dibujo (el plano de fondo NO se redibuja aquí) ---------- */
  /* agrega al trazo una ruta completa siguiendo las calles (cada tramo con su polilínea real) */
  function trazarRuta(g, r) {
    for (var i = 0; i < r.length; i++) {
      M.trazarCamino(g, ciudades[r[i]].p, ciudades[r[(i + 1) % r.length]].p, i === 0);
    }
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
      trazarRuta(ctx, r);
    }
    ctx.strokeStyle = M.COLOR.poblacion;
    ctx.lineWidth = 1.7;
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  function dibujarRuta() {
    ctx.clearRect(0, 0, W, H);
    // antes de "Empezar" solo se ven los barrios: aún no hay rutas
    if (arrancado && verPob) dibujarPoblacion();
    if (arrancado && mejorRuta.length && ciudades.length) {
      ctx.beginPath();
      trazarRuta(ctx, mejorRuta);
      ctx.strokeStyle = "rgba(255,255,255,.9)";        // borde blanco: se lee sobre el plano
      ctx.lineWidth = 6.5;
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.strokeStyle = colorMejor();
      ctx.lineWidth = 3.6;
      ctx.stroke();
    }
    M.pines(ctx, ciudades, {});
    M.etiquetas(ctx, ciudades, etiquetas, cursor, W);
  }

  /* curva: mejor distancia (verde) y promedio de la población (gris).
     Un punto en cada nuevo récord y una franja "estancado" donde pasaron
     ESTANCA o más generaciones sin mejorar (el algoritmo está en un valle). */
  function dibujarCurva() {
    cctx.clearRect(0, 0, CW, CH);
    var n = historial.length;
    if (n < 2) {
      cctx.fillStyle = "#6a7d71";
      cctx.font = '16px "Plus Jakarta Sans", "Segoe UI", sans-serif';
      cctx.fillText(arrancado ? "La primera mejora aparece en un segundo…"
                              : "Presione Empezar para ver la evolución…", 14, CH / 2);
      return;
    }
    var mn = Infinity, mx = -Infinity, i;
    for (i = 0; i < n; i++) {
      if (historial[i] < mn) mn = historial[i];
      if (promedios[i] > mx) mx = promedios[i];
    }
    var rango = (mx - mn) || 1;
    var izq = 82, der = 10, arr = 10, aba = 12;
    var genFin = curvaGen0 + (n - 1) * esc;
    function XG(gen) { return izq + ((gen - curvaGen0) / ((genFin - curvaGen0) || 1)) * (CW - izq - der); }
    function X(k) { return XG(curvaGen0 + k * esc); }
    function Y(v) { return arr + (1 - (v - mn) / rango) * (CH - arr - aba); }

    // franjas "estancado": tramos de ESTANCA+ generaciones entre récords
    var hitos = [curvaGen0].concat(recordsGen, [generacion]);
    cctx.font = '700 15px "Plus Jakarta Sans", "Segoe UI", sans-serif';
    for (i = 0; i + 1 < hitos.length; i++) {
      if (hitos[i + 1] - hitos[i] < ESTANCA) continue;
      var x1 = XG(hitos[i] + ESTANCA), x2 = Math.min(XG(hitos[i + 1]), CW - der);
      if (x2 - x1 < 2) continue;
      cctx.fillStyle = "rgba(249,161,44,.16)";
      cctx.fillRect(x1, arr, x2 - x1, CH - arr - aba);
      if (x2 - x1 > 82) {
        cctx.fillStyle = "#a55f00";
        cctx.fillText("estancado", x1 + 6, arr + 16);
      }
    }

    // ejes
    cctx.strokeStyle = "#cddbd0";
    cctx.lineWidth = 1;
    cctx.beginPath();
    cctx.moveTo(izq, arr);
    cctx.lineTo(izq, CH - aba);
    cctx.lineTo(CW - der, CH - aba);
    cctx.stroke();

    // promedio de la población (gris): puede subir y bajar
    cctx.beginPath();
    cctx.moveTo(X(0), Y(promedios[0]));
    for (i = 1; i < n; i++) cctx.lineTo(X(i), Y(promedios[i]));
    cctx.strokeStyle = "#9aaaa0";
    cctx.lineWidth = 1.8;
    cctx.lineJoin = "round";
    cctx.stroke();

    // mejor distancia (verde): con elitismo nunca sube
    cctx.beginPath();
    cctx.moveTo(X(0), Y(historial[0]));
    for (i = 1; i < n; i++) cctx.lineTo(X(i), Y(historial[i]));
    cctx.strokeStyle = colorMejor();
    cctx.lineWidth = 2.8;
    cctx.stroke();

    // un punto por cada nuevo récord
    cctx.fillStyle = colorMejor();
    cctx.strokeStyle = "#fff";
    cctx.lineWidth = 1.5;
    for (i = 0; i < recordsGen.length; i++) {
      var k = Math.round((recordsGen[i] - curvaGen0) / esc);
      if (k < 0 || k >= n) continue;
      cctx.beginPath();
      cctx.arc(XG(recordsGen[i]), Y(historial[k]), 3.6, 0, Math.PI * 2);
      cctx.fill();
      cctx.stroke();
    }

    cctx.font = '15px "Plus Jakarta Sans", "Segoe UI", sans-serif';
    cctx.fillStyle = "#6a7d71";
    cctx.textAlign = "right";
    cctx.fillText(km(mx), izq - 6, arr + 12);
    cctx.fillText(km(mn), izq - 6, CH - aba);
    cctx.textAlign = "left";
    cctx.fillStyle = colorMejor();
    cctx.font = "700 16px 'Plus Jakarta Sans', 'Segoe UI', sans-serif";
    var ult = historial[n - 1];
    cctx.fillText((estancado ? "final: " : "mejor: ") + km(ult), Math.min(X(n - 1) + 6, CW - 140), Math.max(Y(ult) - 8, 30));
  }

  function pintar() {
    dibujarRuta();
    dibujarCurva();
    elGen.textContent = generacion;
    // antes de "Empezar" aún no hay rutas: no se muestran distancias
    elMejor.textContent = !arrancado || mejorD === Infinity ? "-" : km(mejorD);
    elInicial.textContent = !arrancado || inicialD == null ? "-" : km(inicialD);
    elMejora.textContent = (arrancado && inicialD && mejorD < Infinity)
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
    if (meta !== ciudades.length) marcarCambioMapa();
    while (ciudades.length < meta) agregarAlAzar();
    while (ciudades.length > meta && ciudades.length > 1) ciudades.pop();   // la Bodega no se quita
    elValBarrios.textContent = ciudades.length;
    calcularDistancias();
    reiniciarPoblacion();
    if (!reloj && corriendo()) correr();              // problema nuevo: si estaba en marcha, seguimos
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
    actualizarEstado();
    etiquetas = M.ubicarEtiquetas(ctx, ciudades, W, H, zonaLeyenda(), M.tamEtiqueta(elMapa, W));
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
    cambioMapa = null;                                // es otro problema: no hay "cambio" que avisar
    ciudades = [];
    for (var i = 0; i < n; i++) agregarAlAzar();     // otros barrios al azar, cada uno en su lugar real
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

  elMapa.addEventListener("pointermove", function (e) {
    // el nombre del barrio bajo el cursor
    var p = aCoordenadas(e);
    var c = ciudadCerca(p.x, p.y);
    if (c === -1) c = null;
    if (c !== cursor) { cursor = c; dibujarRuta(); }
  });

  elMapa.addEventListener("pointerleave", function () {
    if (cursor !== null) { cursor = null; dibujarRuta(); }
  });

  elMapa.addEventListener("click", function (e) {
    var p = aCoordenadas(e);
    var cerca = ciudadCerca(p.x, p.y);
    if (cerca !== -1) {
      // clic sobre un barrio → quitarlo (la Bodega no se quita)
      if (ciudades.length <= +elBarrios.min || ciudades[cerca].bodega) return;
      marcarCambioMapa();
      ciudades.splice(cerca, 1);
      cursor = null;
    } else {
      // clic en el mapa → el barrio real libre más cercano
      var nuevo = libreMasCercano(p.x, p.y);
      if (ciudades.length >= +elBarrios.max || nuevo < 0) return;
      marcarCambioMapa();
      ciudades.push(nuevaCiudad(nuevo));
    }
    elBarrios.value = ciudades.length;
    elValBarrios.textContent = ciudades.length;
    calcularDistancias();
    reiniciarPoblacion();
    if (!reloj && corriendo()) correr();
  });

  elPlay2.addEventListener("click", function () { this.blur(); elPlay.click(); });

  /* ---------- ampliar el mapa ---------- */
  var ampliar = M.ampliable(document.getElementById("via-mapa"), function () {
    // otro tamaño en pantalla: se rehacen los canvas con la resolución justa
    pctx = M.prepararCanvas(elPlano, W, H);
    ctx = M.prepararCanvas(elMapa, W, H);
    M.dibujarFondo(pctx);
    reubicarEtiquetas();
  });

  /* ---------- datos de la corrida para la slide 12 ---------- */
  window.Repartidor = {
    W: W, H: H,
    km: km,
    fondo: elPlano,                                   // canvas con las vías (se copia con drawImage)
    estado: function () {
      return {
        arrancado: arrancado,
        final: estancado,                             // ¿el algoritmo ya se detuvo?
        ciudades: ciudades,
        fotos: fotos,
        genBase: genBase,
        cambioMapa: cambioMapa,
        generacion: generacion
      };
    }
  };

  /* ---------- registro con la presentación ---------- */
  window.Presentacion.registrar("slide-demo-viajero", {
    start: function () {
      visible = true;
      if (!poblacion.length) { M.dibujarFondo(pctx); ciudades = []; ajustarBarrios(); }  // estado inicial, sin correr
      else reubicarEtiquetas();                       // la pantalla pudo cambiar de tamaño
      if (corriendo()) correr();
      actualizarEstado();
    },
    stop: function () { visible = false; pararReloj(); ampliar.cerrar(); }
  });

  function reubicarEtiquetas() {
    if (!ciudades.length) return;
    etiquetas = M.ubicarEtiquetas(ctx, ciudades, W, H, zonaLeyenda(), M.tamEtiqueta(elMapa, W));
    dibujarRuta();
  }
  window.addEventListener("resize", function () { if (visible) reubicarEtiquetas(); });

  // las etiquetas usan la tipografía web: al terminar de cargar, se vuelven a medir
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      if (!ciudades.length) return;
      etiquetas = M.ubicarEtiquetas(ctx, ciudades, W, H, zonaLeyenda(), M.tamEtiqueta(elMapa, W));
      dibujarRuta();
    });
  }
})();
