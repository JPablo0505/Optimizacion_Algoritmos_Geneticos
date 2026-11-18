/* =========================================================
   ciclo.js — panel del ciclo de un algoritmo genético.
   Una fila de 5 etapas: Medir → Elegir → Cruzar → Mutar → Repetir
   que conecta las demos con la diapositiva 4 ("El proceso").

   Uso:
     var ciclo = Ciclo.crear(contenedor);
     ciclo.modo("quieto")    → todas las etapas apagadas
     ciclo.modo("continuo")  → una onda suave y estable recorre las
                               etapas: "el ciclo está corriendo".
                               No se sincroniza con cada generación
                               a propósito: a 9 generaciones por
                               segundo eso sería un parpadeo molesto.
     ciclo.modo("paso")      → nada se mueve solo; cada etapa se
                               ilumina cuando el código la ejecuta:
     ciclo.marcar("cruzar", "El hijo toma el comienzo de un padre…")
   ========================================================= */
(function () {
  "use strict";

  var ETAPAS = [
    { id: "medir", txt: "Medir" },
    { id: "elegir", txt: "Elegir" },
    { id: "cruzar", txt: "Cruzar" },
    { id: "mutar", txt: "Mutar" },
    { id: "repetir", txt: "Repetir" }
  ];

  function crear(cont) {
    var raiz = document.createElement("div");
    raiz.className = "ciclo";
    raiz.setAttribute("aria-label", "Etapas del algoritmo genético");

    var fila = document.createElement("div");
    fila.className = "ciclo-chips";
    var chips = {};
    ETAPAS.forEach(function (e, k) {
      if (k > 0) {
        var f = document.createElement("span");
        f.className = "ciclo-flecha";
        f.textContent = "→";
        f.setAttribute("aria-hidden", "true");
        fila.appendChild(f);
      }
      var c = document.createElement("span");
      c.className = "chip chip-" + e.id;
      c.textContent = e.txt;
      c.style.setProperty("--k", k);
      fila.appendChild(c);
      chips[e.id] = c;
    });

    var frase = document.createElement("p");
    frase.className = "ciclo-frase";
    frase.setAttribute("aria-live", "polite");

    raiz.appendChild(fila);
    raiz.appendChild(frase);
    cont.appendChild(raiz);

    var modoActual = "";

    function apagar() {
      for (var id in chips) chips[id].classList.remove("on");
    }

    var api = {
      /* "quieto" | "continuo" | "paso" */
      modo: function (m) {
        if (m === modoActual) return api;
        modoActual = m;
        raiz.classList.toggle("continuo", m === "continuo");
        raiz.classList.toggle("paso", m === "paso");
        apagar();
        if (m !== "paso") frase.textContent = "";
        return api;
      },
      /* ilumina una sola etapa (o ninguna con null) y muestra su frase */
      marcar: function (etapa, texto) {
        apagar();
        if (etapa && chips[etapa]) chips[etapa].classList.add("on");
        if (texto !== undefined) frase.textContent = texto;
        return api;
      },
      frase: function (texto) { frase.textContent = texto || ""; return api; }
    };
    api.modo("quieto");
    return api;
  }

  window.Ciclo = { crear: crear };
})();
