/* =========================================================
   animaciones.js: entrada escalonada de cada diapositiva
   y panel de genes de la portada (cruce y mutación en bucle).
   No toca la lógica de los demos ni la navegación.
   ========================================================= */
(function () {
  "use strict";

  var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));

  /* ---------- 1. marcar qué entra y en qué orden ---------- */
  function marcar(el, clase, n) {
    el.classList.add("rv");
    if (clase) el.classList.add(clase);
    el.style.setProperty("--i", Math.min(n, 14));
  }

  slides.forEach(function (s) {
    var n = 0;

    (function recorrer(padre) {
      Array.prototype.forEach.call(padre.children, function (el) {
        if (el.classList.contains("seq")) {
          recorrer(el);
        } else if (el.classList.contains("tabla")) {
          el.classList.add("rv");
          el.style.setProperty("--i", n++);
          Array.prototype.forEach.call(el.querySelectorAll("tr"), function (tr) {
            marcar(tr, "rv-izq", n++);
          });
        } else if (el.classList.contains("flow")) {
          Array.prototype.forEach.call(el.children, function (st) { marcar(st, "rv-zoom", n++); });
        } else if (el.classList.contains("split") || el.classList.contains("grid")) {
          Array.prototype.forEach.call(el.children, function (c) { marcar(c, "", n++); });
        } else if (el.tagName === "H1") {
          Array.prototype.forEach.call(el.querySelectorAll(".l > i"), function (i, k) {
            i.style.setProperty("--i", k);
          });
          n += 2;
        } else if (el.id === "genes") {
          marcar(el, "rv-zoom", n++);
        } else {
          marcar(el, "", n++);
        }
      });
    })(s);

    /* piezas de los diagramas: aparecen una a una */
    Array.prototype.forEach.call(s.querySelectorAll(".cells"), function (fila) {
      Array.prototype.forEach.call(fila.children, function (c, k) { c.style.setProperty("--c", k); });
    });
    /* tarjetas de datos de las demos */
    Array.prototype.forEach.call(s.querySelectorAll(".demo .stat"), function (t, k) {
      t.style.setProperty("--i", k);
    });
  });

  /* ---------- 2. panel de genes de la portada ---------- */
  var cont = document.getElementById("genes");
  if (!cont) return;

  var N = 16;
  function fila(nombre) {
    var f = document.createElement("div");
    f.className = "g-fila";
    var l = document.createElement("span");
    l.className = "g-lab";
    l.textContent = nombre;
    var c = document.createElement("div");
    c.className = "g-cells";
    var celdas = [];
    for (var i = 0; i < N; i++) {
      var s = document.createElement("span");
      c.appendChild(s);
      celdas.push(s);
    }
    f.appendChild(l);
    f.appendChild(c);
    cont.appendChild(f);
    return celdas;
  }

  var padreA = fila("Padre A");
  var padreB = fila("Padre B");
  var flecha = document.createElement("div");
  flecha.className = "g-flecha";
  cont.appendChild(flecha);
  var hijo = fila("Hijo: mezcla de los dos, con un cambio raro");

  padreA.forEach(function (c) { c.className = "a"; c.textContent = "A"; });
  padreB.forEach(function (c) { c.className = "b"; c.textContent = "B"; });
  hijo.forEach(function (c) { c.className = "v"; });

  function nuevoHijo() {
    var corte = 3 + Math.floor(Math.random() * (N - 6));
    var mut = Math.floor(Math.random() * N);
    hijo.forEach(function (c, i) {
      var deA = i < corte;
      var cls = deA ? "a" : "b";
      var txt = deA ? "A" : "B";
      if (i === mut) { cls = "m"; txt = deA ? "B" : "A"; }
      c.style.transitionDelay = (i * 45) + "ms";
      c.className = cls;
      c.textContent = txt;
    });
  }

  function vaciar() {
    hijo.forEach(function (c) {
      c.style.transitionDelay = "0ms";
      c.className = "v";
    });
  }

  function ciclo() {
    if (!slides[0].classList.contains("active")) return;
    vaciar();
    setTimeout(nuevoHijo, 650);
  }

  setTimeout(ciclo, 1800);
  setInterval(ciclo, 5200);
})();
