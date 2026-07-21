(function() {
  var navbar = document.getElementById("navbar");
  var block  = document.getElementById("logo-block");
  var line1  = document.getElementById("line1");
  var line2  = document.getElementById("line2");

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

    block.style.left = "clamp(1.5rem, 5vw, 6rem)";
    var blockH   = block.offsetHeight || curPx * 2.3;
    var blockTop = (navH - blockH) / 2;
    block.style.top = blockTop + "px";
    document.documentElement.style.setProperty('--nav-links-top', Math.round(blockTop) + 'px');

    burger.style.top = Math.round((navH - 18) / 2) + "px";
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
})();
