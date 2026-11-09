/* =========================================================
   navegacion.js — motor de la presentación
   · crea los puntos laterales, progreso y contador
   · teclado (← → espacio Home End F), swipe táctil
   · pantalla completa (botón de la portada / tecla F)
   · ciclo de vida de los demos: cada uno se registra con
     Presentacion.registrar("id-de-su-slide", demo)
   ========================================================= */
(function () {
  "use strict";

  var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
  var dotsEl = document.getElementById("dots");
  var counter = document.getElementById("counter");
  var progress = document.getElementById("progress");
  var idx = 0;
  var demos = [];

  /* ---------- puntos laterales ---------- */
  slides.forEach(function (s, i) {
    var b = document.createElement("button");
    b.className = "dot" + (i === 0 ? " active" : "");
    b.title = s.dataset.title || "Diapositiva " + (i + 1);
    b.addEventListener("click", function () { goTo(i); });
    dotsEl.appendChild(b);
  });

  function slideOf(el) {
    return slides.indexOf(el.closest(".slide"));
  }

  /* ---------- ir a una diapositiva ---------- */
  function goTo(i) {
    idx = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach(function (s, k) { s.classList.toggle("active", k === idx); });
    Array.prototype.forEach.call(dotsEl.children, function (d, k) {
      d.classList.toggle("active", k === idx);
    });
    counter.textContent = (idx + 1) + " / " + slides.length;
    progress.style.width = ((idx + 1) / slides.length * 100) + "%";
    slides[idx].scrollTop = 0;
    arrancarDemos();
  }

  function arrancarDemos() {
    demos.forEach(function (d) {
      if (slideOf(d.el) === idx) d.demo.start();
      else d.demo.stop();
    });
  }

  /* ---------- API pública para los demos ---------- */
  window.Presentacion = {
    registrar: function (idSlide, demo) {
      var el = document.getElementById(idSlide);
      if (!el || !demo) return;
      demos.push({ el: el, demo: demo });
      if (slideOf(el) === idx) demo.start();
    },
    irA: goTo
  };

  /* ---------- scroll de la diapositiva activa (flechas ↑ ↓) ---------- */
  function desplazarSlide(dir) {
    var s = slides[idx];
    if (s.scrollHeight <= s.clientHeight + 1) return;   // no tiene scroll
    s.scrollTop += dir * Math.round(s.clientHeight * 0.85);
  }

  /* ---------- teclado ---------- */
  document.addEventListener("keydown", function (e) {
    if (e.target && /^(SELECT|INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    switch (e.key) {
      case "ArrowRight":
      case "PageDown":
      case " ":
        e.preventDefault();
        goTo(idx + 1);
        break;
      case "ArrowLeft":
      case "PageUp":
        e.preventDefault();
        goTo(idx - 1);
        break;
      case "ArrowDown":
        e.preventDefault();
        desplazarSlide(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        desplazarSlide(-1);
        break;
      case "Home":
        goTo(0);
        break;
      case "End":
        goTo(slides.length - 1);
        break;
      case "f":
      case "F":
        alternarPantallaCompleta();
        break;
    }
  });

  /* ---------- swipe táctil ---------- */
  var touchX = null;
  document.addEventListener("touchstart", function (e) {
    touchX = e.touches[0].clientX;
  }, { passive: true });
  document.addEventListener("touchend", function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 60) goTo(dx < 0 ? idx + 1 : idx - 1);
  }, { passive: true });

  /* ---------- pantalla completa ---------- */
  function alternarPantallaCompleta() {
    if (document.fullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen();
    } else if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  }

  function empezar() {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      try {
        var p = document.documentElement.requestFullscreen();
        if (p && p.catch) p.catch(function () { /* sin permiso: seguimos igual */ });
      } catch (err) { /* sin soporte: seguimos igual */ }
    }
    goTo(1);
  }

  var btnEmpezar = document.getElementById("btn-empezar");
  if (btnEmpezar) btnEmpezar.addEventListener("click", function () { this.blur(); empezar(); });

  /* ---------- flechas de la barra inferior ---------- */
  var prev = document.getElementById("prev");
  var next = document.getElementById("next");
  if (prev) prev.addEventListener("click", function () { this.blur(); goTo(idx - 1); });
  if (next) next.addEventListener("click", function () { this.blur(); goTo(idx + 1); });

  /* ---------- arranque ---------- */
  goTo(0);
})();
