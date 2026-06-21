/* ===========================================================================
   Gcourses — shared visual experience (vanilla JS, no dependencies)

   What it does, all self-injecting:
     1. gcIntro()        — "open from the centre" curtain on first load
     2. gcAnimatedLogo() — builds an animated loop logo lock-up you can drop in
     3. gcBuddy()        — the floating "Gigi" G-buddy helper with tips

   Configure (optional) BEFORE this script runs:
     window.GC_BUDDY_IMG   = '/gigi-buddy.png'
     window.GC_BUDDY_NAME  = 'Gigi'
     window.GC_BUDDY_TIPS  = ['First tip…', 'Second tip…']
     window.GC_INTRO_ONCE  = true   // only play the curtain once per session
   Opt a page into the intro curtain with: <body data-gc-intro>
   =========================================================================== */
(function () {
  'use strict';

  var REDUCED = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var LOGO_SRC = '/gcourses-logo.png';

  /* ---- 1. Intro curtain ------------------------------------------------- */
  function gcIntro() {
    var body = document.body;
    if (!body || !body.hasAttribute('data-gc-intro')) return;

    var once = window.GC_INTRO_ONCE !== false; // default: once per session
    try {
      if (once && sessionStorage.getItem('gc_intro_seen')) return;
      if (once) sessionStorage.setItem('gc_intro_seen', '1');
    } catch (e) { /* private mode — just play it */ }

    var overlay = document.createElement('div');
    overlay.className = 'gc-intro';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
      '<div class="gc-intro__panel gc-intro__panel--left"></div>' +
      '<div class="gc-intro__panel gc-intro__panel--right"></div>' +
      '<div class="gc-intro__center">' +
        gcAnimatedLogo({ height: 64, light: true }) +
        '<span class="gc-intro__tag">ACT &middot; EST Biology</span>' +
      '</div>';
    body.appendChild(overlay);
    document.documentElement.classList.add('gc-intro-lock');

    if (REDUCED) { finish(); return; }

    // reveal logo → hold → split panels → done
    requestAnimationFrame(function () {
      overlay.classList.add('is-revealing');
    });
    setTimeout(function () { overlay.classList.add('is-opening'); }, 1050);
    setTimeout(finish, 2050);

    function finish() {
      document.documentElement.classList.remove('gc-intro-lock');
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
  }

  /* ---- 2. Animated loop logo -------------------------------------------- */
  // Returns an HTML string. Use gcAnimatedLogo({height, light, src}).
  window.gcAnimatedLogo = gcAnimatedLogo;
  function gcAnimatedLogo(opts) {
    opts = opts || {};
    var h = opts.height || 48;
    var src = opts.src || LOGO_SRC;
    var alt = opts.alt || 'Gcourses';
    // a gentle infinity-ish loop path the dots travel along
    var path = 'M 20 60 C 20 20, 80 20, 100 60 C 120 100, 180 100, 180 60 ' +
               'C 180 20, 120 20, 100 60 C 80 100, 20 100, 20 60 Z';
    var dot = REDUCED ? '' :
      '<circle class="gc-logo__dot" r="5">' +
        '<animateMotion dur="6s" repeatCount="indefinite" rotate="auto" ' +
          'path="' + path + '"/></circle>' +
      '<circle class="gc-logo__dot gc-logo__dot--2" r="3.5">' +
        '<animateMotion dur="6s" begin="-3s" repeatCount="indefinite" ' +
          'path="' + path + '"/></circle>';
    return '' +
      '<span class="gc-logo' + (opts.light ? ' gc-logo--light' : '') + '">' +
        '<svg class="gc-logo__loop" viewBox="0 0 200 120" ' +
             'preserveAspectRatio="none" aria-hidden="true">' +
          '<path class="gc-logo__path" d="' + path + '"/>' + dot +
        '</svg>' +
        '<img class="gc-logo__img" src="' + src + '" alt="' + alt + '" ' +
             'style="height:' + h + 'px">' +
      '</span>';
  }

  /* ---- 3. The "G" buddy helper ------------------------------------------ */
  var DEFAULT_TIPS = [
    'Hi, I’m Gigi! 💜 Tap me any time you want a study nudge.',
    'Short, focused revision beats long cramming. Try 25-minute sprints.',
    'Stuck on a topic? Re-watch the recording, then redo the questions.',
    'Sleep before a mock test does more than one extra hour of studying.'
  ];

  function gcBuddy() {
    if (document.querySelector('.gc-buddy')) return;
    var img = window.GC_BUDDY_IMG || '/gigi-buddy.png';
    var name = window.GC_BUDDY_NAME || 'Gigi';
    var tips = (window.GC_BUDDY_TIPS && window.GC_BUDDY_TIPS.length)
      ? window.GC_BUDDY_TIPS : DEFAULT_TIPS;
    var i = 0;

    var wrap = document.createElement('div');
    wrap.className = 'gc-buddy';
    wrap.innerHTML =
      '<div class="gc-buddy__bubble" role="status">' +
        '<button class="gc-buddy__bubble-close" aria-label="Close">&times;</button>' +
        '<span class="gc-buddy__bubble-name">' + esc(name) + '</span>' +
        '<span class="gc-buddy__bubble-text"></span>' +
        '<button class="gc-buddy__next" type="button">Another tip &rarr;</button>' +
      '</div>' +
      '<button class="gc-buddy__char" aria-label="' + esc(name) + ', your study buddy">' +
        '<span class="gc-buddy__poke">!</span>' +
        '<img src="' + img + '" alt="' + esc(name) + '" />' +
      '</button>';
    document.body.appendChild(wrap);

    var bubbleText = wrap.querySelector('.gc-buddy__bubble-text');
    function render() { bubbleText.textContent = tips[i % tips.length]; }
    function open() { render(); wrap.classList.add('is-open'); }
    function close() { wrap.classList.remove('is-open'); }

    wrap.querySelector('.gc-buddy__char').addEventListener('click', function () {
      if (wrap.classList.contains('is-open')) { close(); }
      else { open(); }
    });
    wrap.querySelector('.gc-buddy__next').addEventListener('click', function () {
      i++; render();
    });
    wrap.querySelector('.gc-buddy__bubble-close').addEventListener('click', close);

    render();
    // gentle first hello after the curtain clears
    if (!REDUCED) setTimeout(open, body && body.hasAttribute('data-gc-intro') ? 2600 : 1200);
  }

  var body = document.body;
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function boot() {
    body = document.body;
    gcIntro();
    if (window.GC_BUDDY_OFF !== true) gcBuddy();
  }
  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
