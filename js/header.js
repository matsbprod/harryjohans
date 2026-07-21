(function() {
  var navbar = document.getElementById("navbar");
  var block  = document.getElementById("logo-block");
  var line0  = document.getElementById("line0");
  var line1  = document.getElementById("line1");
  var line2  = document.getElementById("line2");
  var plane  = document.getElementById("plane-img");

  if (!block) return;

  // ── Hamburger menu ──────────────────────────────────────────
  var navLinks = navbar ? navbar.querySelector('.nav-links') : null;
  var burger = document.createElement('button');
  burger.className = 'hamburger';
  burger.setAttribute('aria-label', 'Meny');
  burger.innerHTML = '<span></span><span></span><span></span>';
  document.body.appendChild(burger);

  var drawer = document.createElement('div');
  drawer.className = 'nav-drawer';
  if (navLinks) {
    navLinks.querySelectorAll('a').forEach(function(a) {
      var link = document.createElement('a');
      link.href = a.href;
      link.textContent = a.textContent;
      drawer.appendChild(link);
    });
  }
  document.body.appendChild(drawer);

  burger.addEventListener('click', function() {
    var isOpen = burger.classList.toggle('open');
    drawer.classList.toggle('open', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });
  drawer.addEventListener('click', function(e) {
    if (e.target.tagName === 'A') {
      burger.classList.remove('open');
      drawer.classList.remove('open');
      document.body.style.overflow = '';
    }
  });

  // ── Scroll-driven logo/nav animation ────────────────────────
  var isMobile = window.innerWidth <= 860;
  var isTablet = window.innerWidth <= 1100 && window.innerWidth > 860;
  var SCROLL_END = isMobile ? 200 : 250;
  var NAV_SMALL  = isMobile ? 100 : (isTablet ? 120 : 180);
  var NAV_LARGE  = 64;
  var SMALL_PX   = isMobile ? 24 : (isTablet ? 30 : 44);
  var LARGE_PX   = 14;
  var PLANE_AR   = 1095 / 477;  // hyvelbild bredd/höjd

  function clamp(v,a,b){ return Math.min(Math.max(v,a),b); }
  function lerp(a,b,t) { return a+(b-a)*clamp(t,0,1); }
  function easeIO(t)   { return t<.5 ? 2*t*t : -1+(4-2*t)*t; }

  function update() {
    var sy = window.scrollY;
    var t  = easeIO(clamp(sy / SCROLL_END, 0, 1));

    var navH = Math.round(lerp(NAV_SMALL, NAV_LARGE, t));
    navbar.style.height = navH + "px";
    document.documentElement.style.setProperty('--nav-h', navH + 'px');

    var curPx   = lerp(SMALL_PX, LARGE_PX, t);
    var spacing = lerp(0.14, 0.2, t);

    line1.style.fontSize      = curPx + "px";
    line1.style.letterSpacing = spacing + "em";
    line2.style.fontSize      = curPx + "px";
    line2.style.letterSpacing = spacing + "em";

    if (line0) {
      line0.style.fontSize      = (curPx * 0.4) + "px";
      line0.style.letterSpacing = (spacing + 0.06) + "em";
    }

    block.style.left = "clamp(1.5rem, 5vw, 6rem)";
    var blockH   = block.offsetHeight || curPx * 2.3;
    var blockTop = (navH - blockH) / 2;
    block.style.top = blockTop + "px";
    document.documentElement.style.setProperty('--nav-links-top', Math.round(blockTop) + 'px');

    burger.style.top = Math.round((navH - 18) / 2) + "px";

    // Positionera hyveln till vänster om logotypen
    if (plane) {
      var line2W    = line2.offsetWidth  || curPx * 8;
      var line1W    = line1.offsetWidth  || curPx * 6;
      var blockLeft = parseFloat(getComputedStyle(block).left) || 48;
      var line1Left = blockLeft + (line2W - line1W) / 2;
      // Hyveln lika hög som logo-blocket
      var planeH    = blockH * 0.72;
      var planeW    = Math.round(planeH * PLANE_AR);
      plane.style.height  = planeH + "px";
      plane.style.width   = planeW + "px";
      plane.style.left    = clamp(line1Left - planeW - 14, 4, window.innerWidth - planeW - 4) + "px";
      plane.style.top     = (blockTop + (blockH - planeH) / 2) + "px";
      plane.style.opacity = "1";
    }
  }

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", function() {
    isMobile = window.innerWidth <= 860;
    isTablet = window.innerWidth <= 1100 && window.innerWidth > 860;
    SCROLL_END = isMobile ? 200 : 250;
    NAV_SMALL  = isMobile ? 100 : (isTablet ? 120 : 180);
    SMALL_PX   = isMobile ? 24 : (isTablet ? 30 : 44);
    update();
  });
  update();

  // ── Scroll reveal ───────────────────────────────────────────
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); }
      });
    }, { threshold: 0.1 });
    reveals.forEach(function(el) { io.observe(el); });
  } else {
    reveals.forEach(function(el) { el.classList.add("visible"); });
  }

  // ── Bildproportioner: visa hel bild om den redan matchar
  //    rutans form, annars croppa för att fylla rutan ──────────
  function fitImages() {
    document.querySelectorAll('.f-img img').forEach(function(img) {
      function check() {
        var box = img.closest('.f-img');
        if (!box || !img.naturalWidth) return;
        var boxRatio = box.clientWidth / box.clientHeight;
        var imgRatio = img.naturalWidth / img.naturalHeight;
        // Tolerans: om bildens proportion ligger nära rutans (inom ~12%),
        // visa den i sin helhet. Annars croppa (cover, default).
        var diff = Math.abs(imgRatio - boxRatio) / boxRatio;
        img.classList.toggle('fit-contain', diff < 0.12);
      }
      if (img.complete) check();
      else img.addEventListener('load', check);
      window.addEventListener('resize', check);
    });
  }
  fitImages();
})();
