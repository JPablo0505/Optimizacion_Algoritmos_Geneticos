/* =========================================================
   codigo.js — slide del código Python, por partes.
   El código completo vive UNA sola vez en el HTML (#codigo-completo,
   con su resaltado). Este archivo lo corta por funciones y arma:
   · "Resumen": todas las funciones a la vista (su línea def y su
     descripción, tomada del propio código), más los datos iniciales
     y el bucle principal.
     Pulsar una tarjeta abre esa función.
   · Una pestaña por función (distancia, mezclar, mutar, elegir) y
     otra para el bucle principal, en letra grande para el proyector,
     con la línea "def" resaltada.
   · "Ver todo": el archivo completo (con scroll vertical si hace falta).
   · "Copiar": copia el archivo completo para pegarlo en ruta.py.
   No cambia ni una línea del código: solo cómo se muestra.
   ========================================================= */
(function () {
  "use strict";

  var pre = document.getElementById("codigo-completo");
  var elTabs = document.getElementById("codigo-tabs");
  var elVista = document.getElementById("codigo-vista");
  var elCopiar = document.getElementById("codigo-copiar");
  if (!pre || !elTabs || !elVista) return;

  /* ---------- cortar el código en partes (cada línea conserva su resaltado) ---------- */
  var lineas = pre.innerHTML.split("\n");
  var texto = pre.textContent;
  function esDef(l) { return /<span class="k">def<\/span>/.test(l); }
  function nombreDef(l) { var m = l.match(/<span class="f">([^<]+)<\/span>\(/); return m ? m[1] : "?"; }

  var partes = [], inicio = [], bucle = null, actual = null;
  lineas.forEach(function (l, i) {
    if (esDef(l)) {
      actual = { id: nombreDef(l), titulo: nombreDef(l), lineas: [] };
      partes.push(actual);
    } else if (/<span class="c"># El bucle principal/.test(l)) {
      actual = bucle = { id: "bucle", titulo: "Bucle principal", lineas: [] };
    } else if (!actual) {
      inicio.push(l);
      return;
    }
    actual.lineas.push(l);
  });
  // quitar líneas vacías al final de cada parte
  partes.concat([bucle]).forEach(function (p) {
    if (!p) return;
    while (p.lineas.length && !p.lineas[p.lineas.length - 1].trim()) p.lineas.pop();
  });
  while (inicio.length && !inicio[inicio.length - 1].trim()) inicio.pop();

  function bloque(ls, clase) {
    return '<pre class="code ' + (clase || "") + '">' + ls.map(function (l) {
      return '<span class="ln' + (esDef(l) ? " def" : "") + '">' + (l || " ") + "</span>";
    }).join("\n") + "</pre>";
  }

  function descripcion(p) {                         // la línea del docstring, sin comillas
    for (var i = 0; i < p.lineas.length; i++) {
      var m = p.lineas[i].match(/<span class="s">"""([^<]*)"""<\/span>/);
      if (m) return m[1];
    }
    return "";
  }

  /* ---------- vistas ---------- */
  var vistas = {
    resumen: function () {
      var html = '<div class="cod-resumen">' +
        '<div class="cod-datos"><span class="cod-et">Los datos</span>' + bloque(inicio, "chico") + "</div>" +
        '<div class="cod-funciones">';
      partes.forEach(function (p) {
        html += '<button class="cod-tarjeta" data-ir="' + p.id + '">' +
          '<code class="cod-def">' + p.lineas[0].replace(/^\s+/, "") + "</code>" +
          '<span class="cod-desc">' + descripcion(p) + "</span></button>";
      });
      if (bucle) {
        html += '<button class="cod-tarjeta bucle" data-ir="bucle">' +
          '<code class="cod-def">' + bucle.lineas[0] + "</code>" +
          '<code class="cod-desc">' + (bucle.lineas.filter(function (l) { return /<span class="k">for<\/span> generacion/.test(l); })[0] || "") +
          "</code></button>";
      }
      return html + "</div></div>";
    },
    todo: function () { return bloque(lineas, "todo"); }
  };
  partes.concat(bucle ? [bucle] : []).forEach(function (p) {
    vistas[p.id] = function () { return bloque(p.lineas, "grande"); };
  });

  /* ---------- pestañas ---------- */
  var orden = [{ id: "resumen", txt: "Resumen" }].concat(
    partes.map(function (p) { return { id: p.id, txt: p.titulo + "()" }; }),
    bucle ? [{ id: "bucle", txt: "Bucle principal" }] : [],
    [{ id: "todo", txt: "Ver todo" }]);
  elTabs.innerHTML = orden.map(function (o) {
    return '<button data-tab="' + o.id + '"' + (o.id === "resumen" ? ' class="on"' : "") + ">" + o.txt + "</button>";
  }).join("");

  function mostrar(id) {
    elVista.innerHTML = vistas[id]();
    elVista.dataset.vista = id;
    Array.prototype.forEach.call(elTabs.children, function (b) { b.classList.toggle("on", b.dataset.tab === id); });
  }

  elTabs.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    b.blur();
    mostrar(b.dataset.tab);
  });
  elVista.addEventListener("click", function (e) {
    var b = e.target.closest("[data-ir]");
    if (!b) return;
    b.blur();
    mostrar(b.dataset.ir);
  });

  /* ---------- copiar el archivo completo ---------- */
  if (elCopiar) {
    elCopiar.addEventListener("click", function () {
      var btn = this;
      btn.blur();
      function listo(ok) {
        btn.textContent = ok ? "✓ Copiado" : "No se pudo copiar";
        setTimeout(function () { btn.textContent = "⧉ Copiar código"; }, 1800);
      }
      function clasico() {                          // método clásico (sirve también abriendo el archivo)
        var t = document.createElement("textarea");
        t.value = texto;
        t.setAttribute("readonly", "");
        t.style.position = "fixed"; t.style.opacity = "0";
        document.body.appendChild(t);
        t.select();
        var ok = false;
        try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
        document.body.removeChild(t);
        return ok;
      }
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(texto).then(function () { listo(true); }, function () { listo(clasico()); });
      } else {
        listo(clasico());
      }
    });
  }

  pre.hidden = true;                                // el original queda como fuente única
  mostrar("resumen");
})();
