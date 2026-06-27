/* Shared deck runtime for all proposal decks.
 * External file (NOT inline) because public/_headers sets a CSP of
 * script-src 'self', which blocks inline <script>. Keep all deck JS here.
 *
 * Controls: ← / → (or click the arrows / dots) to move between slides,
 * P to export as PDF (opens the browser print dialog; print CSS stacks all
 * slides). Works for every deck — it just operates on .slide elements. */
(function () {
  "use strict";

  function init() {
    var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
    if (!slides.length) return;
    var current = 0;

    // Build navigation chrome (arrows + counter + dots).
    var nav = document.createElement("div");
    nav.className = "deck-nav";
    nav.innerHTML =
      '<button class="deck-btn" data-dir="-1" aria-label="Föregående">&#8592;</button>' +
      '<span class="deck-counter"></span>' +
      '<button class="deck-btn" data-dir="1" aria-label="Nästa">&#8594;</button>' +
      '<button class="deck-btn deck-pdf" data-pdf="1" aria-label="Ladda ner PDF">PDF</button>';
    document.body.appendChild(nav);

    var dots = document.createElement("div");
    dots.className = "deck-dots";
    slides.forEach(function (_, i) {
      var d = document.createElement("button");
      d.className = "deck-dot";
      d.setAttribute("aria-label", "Slide " + (i + 1));
      d.addEventListener("click", function () { go(i); });
      dots.appendChild(d);
    });
    document.body.appendChild(dots);

    var counter = nav.querySelector(".deck-counter");
    var dotEls = Array.prototype.slice.call(dots.children);

    function render() {
      slides.forEach(function (s, i) { s.classList.toggle("is-active", i === current); });
      dotEls.forEach(function (d, i) { d.classList.toggle("is-active", i === current); });
      counter.textContent = (current + 1) + " / " + slides.length;
    }

    function go(i) {
      current = Math.max(0, Math.min(slides.length - 1, i));
      render();
      window.scrollTo(0, 0);
    }

    nav.addEventListener("click", function (e) {
      var dir = e.target.getAttribute("data-dir");
      if (dir) go(current + parseInt(dir, 10));
      if (e.target.getAttribute("data-pdf")) window.print();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight" || e.key === "PageDown") go(current + 1);
      else if (e.key === "ArrowLeft" || e.key === "PageUp") go(current - 1);
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(slides.length - 1);
      else if (e.key === "p" || e.key === "P") { e.preventDefault(); window.print(); }
    });

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
