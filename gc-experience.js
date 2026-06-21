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

  /* ---- 3. The "G" buddy — chat with Gigi -------------------------------- */
  var GREETING = window.GC_BUDDY_GREETING ||
    "Hi, I’m Gigi! Ask me anything about the course, the eBook, or booking a session — your message comes straight to me.";

  function gcBuddy() {
    if (document.querySelector('.gc-buddy')) return;
    var img = window.GC_BUDDY_IMG || '/gigi-buddy.png';
    var name = window.GC_BUDDY_NAME || 'Gigi';

    var wrap = document.createElement('div');
    wrap.className = 'gc-buddy';
    wrap.innerHTML =
      '<div class="gc-buddy__panel" role="dialog" aria-label="Chat with ' + esc(name) + '">' +
        '<div class="gc-buddy__head">' +
          '<img class="gc-buddy__avatar" src="' + img + '" alt="" />' +
          '<div class="gc-buddy__head-txt"><strong>Chat with ' + esc(name) + '</strong>' +
            '<span>Usually replies within a day</span></div>' +
          '<button class="gc-buddy__close" type="button" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="gc-buddy__msgs">' +
          '<div class="gc-buddy__msg gc-buddy__msg--in">' + esc(GREETING) + '</div>' +
        '</div>' +
        '<form class="gc-buddy__form">' +
          '<input class="gc-buddy__field" type="text" name="name" placeholder="Your name (optional)" autocomplete="name" />' +
          '<input class="gc-buddy__field" type="email" name="email" placeholder="Your email (so I can reply)" autocomplete="email" required />' +
          '<textarea class="gc-buddy__field gc-buddy__ta" name="message" placeholder="Type your message…" required></textarea>' +
          '<button class="gc-buddy__send" type="submit">Send message</button>' +
          '<div class="gc-buddy__status" role="status"></div>' +
        '</form>' +
      '</div>' +
      '<button class="gc-buddy__char" aria-label="Chat with ' + esc(name) + '">' +
        '<span class="gc-buddy__poke">!</span>' +
        '<img src="' + img + '" alt="' + esc(name) + '" />' +
      '</button>';
    document.body.appendChild(wrap);

    var msgs = wrap.querySelector('.gc-buddy__msgs');
    var form = wrap.querySelector('.gc-buddy__form');
    var statusEl = wrap.querySelector('.gc-buddy__status');

    function open() {
      wrap.classList.add('is-open');
      setTimeout(function () { var e = form.querySelector('[name=email]'); if (e) e.focus(); }, 250);
    }
    function close() { wrap.classList.remove('is-open'); }

    wrap.querySelector('.gc-buddy__char').addEventListener('click', function () {
      if (wrap.classList.contains('is-open')) close(); else open();
    });
    wrap.querySelector('.gc-buddy__close').addEventListener('click', close);

    function bubble(text, dir) {
      var b = document.createElement('div');
      b.className = 'gc-buddy__msg gc-buddy__msg--' + dir;
      b.textContent = text;
      msgs.appendChild(b);
      msgs.scrollTop = msgs.scrollHeight;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var payload = {
        name: (fd.get('name') || '').trim(),
        email: (fd.get('email') || '').trim(),
        message: (fd.get('message') || '').trim(),
        page: location.pathname
      };
      if (!payload.message) return;
      var btn = form.querySelector('.gc-buddy__send');
      btn.disabled = true; btn.textContent = 'Sending…'; statusEl.textContent = '';
      bubble(payload.message, 'out');
      fetch('/api/buddy-message', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          btn.disabled = false; btn.textContent = 'Send message';
          if (res.ok && res.d.success) {
            bubble('Thanks ' + (payload.name ? payload.name + ' ' : '') + '— your message reached ' +
                   name + '. You’ll get a reply by email soon.', 'in');
            form.querySelector('[name=message]').value = '';
          } else {
            statusEl.textContent = (res.d && res.d.error) || 'Could not send. Please try again.';
          }
        })
        .catch(function () {
          btn.disabled = false; btn.textContent = 'Send message';
          statusEl.textContent = 'Network error. Please try again.';
        });
    });
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
