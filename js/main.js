/* ==========================================================================
   Haytam Ayadin — Portfolio · main.js
   One requestAnimationFrame loop drives everything that depends on scroll or
   pointer; layout is measured on resize only, never inside the loop.
   ========================================================================== */
(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
  const easeOutExpo = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
  const easeInOutCubic = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeInOutExpo = t => (t === 0 ? 0 : t === 1 ? 1 : t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const escapeHTML = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const desktop = matchMedia('(min-width: 1024px)');

  const EMAIL = 'haytam25contact@gmail.com';

  const App = (window.App = {
    lang: 'es',
    reduced,
    finePointer,
    scrollY: window.scrollY,
    velocity: 0,
    vw: innerWidth,
    vh: innerHeight,
    pointer: { x: innerWidth / 2, y: innerHeight / 2, has: false },
    lenis: null,
    EMAIL
  });

  const ticks = [];
  const measures = [];
  const langHooks = [];
  App.onTick = fn => ticks.push(fn);
  App.onMeasure = fn => measures.push(fn);
  App.onLang = fn => langHooks.push(fn);

  const safe = (name, fn) => {
    try { return fn(); } catch (err) { console.error(`[${name}]`, err); }
  };

  const inViewport = el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < App.vh && r.right > 0 && r.left < App.vw;
  };

  /* ------------------------------------------------------------------------
     Text helpers: scramble, word split, char split, swap
     ------------------------------------------------------------------------ */
  const GLYPHS = '!<>-_\\/[]{}=+*^?#01ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  function scramble(el, to, frames = 30) {
    const from = el.textContent;
    const len = Math.max(from.length, to.length);
    const queue = [];
    for (let i = 0; i < len; i++) {
      const start = Math.floor(Math.random() * frames * .4);
      const end = start + Math.floor(frames * .3 + Math.random() * frames * .5);
      queue.push({ from: from[i] || '', to: to[i] || '', start, end, ch: '' });
    }
    cancelAnimationFrame(el._scr);
    let frame = 0;
    const step = () => {
      let out = '';
      let done = 0;
      for (const q of queue) {
        if (frame >= q.end) {
          done++;
          out += escapeHTML(q.to);
        } else if (frame >= q.start) {
          if (!q.ch || Math.random() < .3) q.ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
          out += `<span class="scr">${escapeHTML(q.ch)}</span>`;
        } else {
          out += escapeHTML(q.from);
        }
      }
      el.innerHTML = out;
      if (done === queue.length) {
        el.textContent = to;
        el._scr = 0;
        return;
      }
      frame++;
      el._scr = requestAnimationFrame(step);
    };
    step();
  }

  // Wraps every word in a span while keeping inline markup (<em>, <strong>…).
  function wrapWords(el, mode) {
    let i = 0;
    const walk = node => {
      Array.from(node.childNodes).forEach(child => {
        if (child.nodeType === 3) {
          const parts = child.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(' '));
              return;
            }
            const span = document.createElement('span');
            if (mode === 'mask') {
              span.className = 'w';
              const inner = document.createElement('span');
              inner.className = 'w__i';
              inner.style.setProperty('--i', i++);
              inner.textContent = part;
              span.appendChild(inner);
            } else {
              span.className = 'sw';
              span.textContent = part;
              i++;
            }
            frag.appendChild(span);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    walk(el);
  }

  function splitChars(el) {
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    el.textContent = '';
    const frag = document.createDocumentFragment();
    Array.from(text).forEach((ch, i) => {
      const span = document.createElement('span');
      span.className = 'c';
      span.style.setProperty('--i', i);
      span.textContent = ch;
      frag.appendChild(span);
    });
    el.appendChild(frag);
    return $$('.c', el);
  }

  function splitHeading(el) {
    wrapWords(el, 'mask');
    el._split = true;
  }

  function fadeSwap(el, html) {
    const out = el.animate(
      [{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(8px)' }],
      { duration: 170, easing: 'ease-in', fill: 'forwards' }
    );
    out.onfinish = () => {
      el.innerHTML = html;
      el.animate(
        [{ opacity: 0, filter: 'blur(8px)' }, { opacity: 1, filter: 'blur(0px)' }],
        { duration: 520, easing: 'cubic-bezier(.16,1,.3,1)' }
      );
      out.cancel();
    };
  }

  // Swaps one alternative in for another (rotating words, greetings).
  function cycleSwap(cur, next) {
    next.style.transition = 'none';
    next.classList.remove('is-out', 'is-on');
    void next.offsetWidth;
    next.style.transition = '';
    cur.classList.remove('is-on');
    cur.classList.add('is-out');
    next.classList.add('is-on');
  }

  /* ------------------------------------------------------------------------
     i18n
     ------------------------------------------------------------------------ */
  const dict = window.I18N || { es: {}, en: {} };
  const attrPairs = el => el.dataset.i18nAttr.split(',').map(p => p.split(':').map(s => s.trim()));

  // The Spanish copy is the markup itself: harvest it so we can switch back.
  $$('[data-i18n]').forEach(el => {
    const k = el.dataset.i18n;
    if (!(k in dict.es)) dict.es[k] = el.innerHTML.trim();
  });
  $$('[data-i18n-attr]').forEach(el => attrPairs(el).forEach(([attr, key]) => {
    if (!(key in dict.es)) dict.es[key] = el.getAttribute(attr);
  }));

  App.t = (key, lang = App.lang) => {
    const table = dict[lang] || {};
    if (key in table) return table[key];
    if (key in dict.es) return dict.es[key];
    return key;
  };

  function swapSplit(el, html, replay) {
    if (el._split && el.innerHTML === html) return;
    el.innerHTML = html;
    splitHeading(el);
    if (replay && el.classList.contains('is-in') && inViewport(el) && !reduced) {
      el.classList.remove('is-in');
      void el.offsetWidth;
      requestAnimationFrame(() => el.classList.add('is-in'));
    }
  }

  function setLang(lang, { animate = true } = {}) {
    if (!dict[lang]) return;
    const changed = lang !== App.lang;
    App.lang = lang;
    root.lang = lang;
    root.dataset.lang = lang;
    try { localStorage.setItem('ha-lang', lang); } catch (e) { /* private mode */ }
    try {
      const url = new URL(location.href);
      if (url.searchParams.has('lang')) {
        url.searchParams.set('lang', lang);
        history.replaceState(history.state, '', url);
      }
    } catch (e) { /* file:// */ }

    const fx = animate && changed && !reduced;
    $$('[data-i18n]').forEach(el => {
      const html = App.t(el.dataset.i18n);
      if (typeof html !== 'string') return;
      if (el.hasAttribute('data-split')) return swapSplit(el, html, fx);
      if (el.hasAttribute('data-scrub') || el.hasAttribute('data-chars')) {
        el.innerHTML = html; // their owners re-split in an onLang hook
        return;
      }
      if (el.innerHTML === html) return;
      if (fx && inViewport(el)) {
        if (el.dataset.fx === 'scramble') scramble(el, html);
        else fadeSwap(el, html);
      } else {
        el.innerHTML = html;
      }
    });
    $$('[data-i18n-attr]').forEach(el => attrPairs(el).forEach(([attr, key]) => el.setAttribute(attr, App.t(key))));
    $$('.lang__btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));

    langHooks.forEach(fn => safe('lang hook', () => fn(lang, changed)));
    if (changed && App.measureAll) requestAnimationFrame(App.measureAll);
  }
  App.setLang = setLang;

  /* ------------------------------------------------------------------------
     Measuring
     ------------------------------------------------------------------------ */
  let docH = root.scrollHeight;
  App.measureAll = () => {
    App.vw = innerWidth;
    App.vh = innerHeight;
    measures.forEach(fn => safe('measure', fn));
    docH = root.scrollHeight;
  };
  let measureTimer = 0;
  const queueMeasure = () => {
    clearTimeout(measureTimer);
    measureTimer = setTimeout(App.measureAll, 120);
  };

  /* ------------------------------------------------------------------------
     Scroll (Lenis) + anchors
     ------------------------------------------------------------------------ */
  function initScroll() {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    if (window.Lenis && !reduced) {
      App.lenis = new window.Lenis({ lerp: .085, smoothWheel: true, wheelMultiplier: 1, autoRaf: false });
      App.lenis.stop();
    }
  }

  function scrollToTarget(target) {
    const top = target === 'top' || target === document.body;
    if (App.lenis) {
      App.lenis.scrollTo(top ? 0 : target, { duration: 1.7, easing: easeInOutExpo, force: true });
    } else if (top) {
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    } else {
      target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    }
  }
  App.scrollTo = scrollToTarget;

  function initAnchors() {
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = id === '#top' ? 'top' : $(id);
      if (!target) return;
      e.preventDefault();
      if (root.classList.contains('menu-open') && App.closeMenu) App.closeMenu();
      scrollToTarget(target);
      if (id === '#main') {
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    });
  }

  /* ------------------------------------------------------------------------
     Preloader
     ------------------------------------------------------------------------ */
  function runLoader() {
    const el = $('.loader');
    if (!el) return Promise.resolve();
    root.classList.add('is-loading');
    const count = $('.js-count', el);
    const num = $('.loader__count', el);
    const bar = $('.loader__bar i', el);
    const msg = $('.js-loader-msg', el);
    const msgs = App.t('loader.msgs');

    let seen = false;
    try {
      seen = !!sessionStorage.getItem('ha-seen');
      sessionStorage.setItem('ha-seen', '1');
    } catch (e) { /* ignore */ }
    const minTime = reduced ? 250 : seen ? 800 : 2000;

    let fontsDone = false;
    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fonts, wait(3200)]).then(() => { fontsDone = true; });

    const t0 = performance.now();
    let shown = 0;
    let lastMsg = -1;

    return new Promise(resolve => {
      const step = now => {
        const tp = clamp((now - t0) / minTime, 0, 1);
        shown = Math.max(shown, fontsDone ? tp : Math.min(tp, .88));
        const e = easeInOutCubic(shown);
        count.textContent = String(Math.round(e * 100)).padStart(3, '0');
        num.style.setProperty('--w', String(Math.round(200 + 600 * e)));
        bar.style.transform = `scaleX(${e})`;
        const mi = Math.min(msgs.length - 1, Math.floor(e * msgs.length));
        if (mi !== lastMsg) {
          lastMsg = mi;
          msg.textContent = msgs[mi];
        }
        if (shown < 1) {
          requestAnimationFrame(step);
          return;
        }
        setTimeout(() => {
          el.classList.add('is-leaving');
          root.classList.remove('is-loading');
          setTimeout(resolve, reduced ? 0 : 280);
          setTimeout(() => el.remove(), 1500);
        }, reduced ? 0 : 180);
      };
      requestAnimationFrame(step);
    });
  }

  /* ------------------------------------------------------------------------
     Navigation, menu, language switch
     ------------------------------------------------------------------------ */
  function initNav() {
    const nav = $('.nav');
    const links = $$('.nav__link');
    const burger = $('.burger');
    const menu = $('#menu');
    const targets = links.map(a => $(a.getAttribute('href')));
    let lastY = 0;
    let ranges = [];
    let active = -1;

    App.onMeasure(() => {
      ranges = targets.map(t => {
        if (!t) return null;
        const r = t.getBoundingClientRect();
        return { top: r.top + App.scrollY, bottom: r.bottom + App.scrollY };
      });
    });

    App.onTick(() => {
      const y = App.scrollY;
      nav.classList.toggle('is-scrolled', y > 30);
      root.classList.toggle('past-hero', y > App.vh * .55);
      if (Math.abs(y - lastY) > 8) {
        nav.classList.toggle('is-hidden', y > lastY && y > App.vh * .7 && !root.classList.contains('menu-open'));
        lastY = y;
      }
      const mid = y + App.vh * .45;
      let a = -1;
      ranges.forEach((r, i) => { if (r && mid >= r.top && mid < r.bottom) a = i; });
      if (a !== active) {
        active = a;
        links.forEach((l, i) => l.classList.toggle('is-active', i === a));
      }
    });

    if (!reduced) {
      links.forEach(l => l.addEventListener('mouseenter', () => {
        const s = $('[data-i18n]', l);
        if (s) scramble(s, s.textContent, 22);
      }));
    }

    const setMenu = open => {
      root.classList.toggle('menu-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', App.t(open ? 'nav.menuClose' : 'nav.menuOpen'));
      menu.setAttribute('aria-hidden', String(!open));
      menu.inert = !open;
      if (App.lenis) open ? App.lenis.stop() : App.lenis.start();
      nav.classList.remove('is-hidden');
    };
    menu.inert = true;
    burger.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
    addEventListener('keydown', e => {
      if (e.key === 'Escape' && root.classList.contains('menu-open')) {
        setMenu(false);
        burger.focus();
      }
    });
    desktop.addEventListener('change', e => { if (e.matches) setMenu(false); });
    App.closeMenu = () => setMenu(false);
    App.onLang(() => burger.setAttribute('aria-label', App.t(root.classList.contains('menu-open') ? 'nav.menuClose' : 'nav.menuOpen')));

    $$('.lang__btn').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
  }

  /* ------------------------------------------------------------------------
     Pointer, cursor, magnetic
     ------------------------------------------------------------------------ */
  function initPointer() {
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      App.pointer.x = e.clientX;
      App.pointer.y = e.clientY;
      App.pointer.has = true;
    }, { passive: true });
    document.addEventListener('mouseout', e => { if (!e.relatedTarget) App.pointer.has = false; });
  }

  function initCursor() {
    if (!finePointer || reduced) return;
    const cur = $('.cursor');
    const dot = $('.cursor__dot');
    const ring = $('.cursor__ring');
    const badge = $('.cursor-badge');
    const label = $('.cursor-badge__label');
    root.classList.add('has-cursor');

    let rx = -100, ry = -100, bx = -100, by = -100;
    let shown = false;

    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      if (!shown) {
        shown = true;
        rx = bx = e.clientX;
        ry = by = e.clientY;
        cur.classList.add('is-visible');
      }
    }, { passive: true });
    document.addEventListener('mouseout', e => {
      if (e.relatedTarget) return;
      shown = false;
      cur.classList.remove('is-visible');
      badge.classList.remove('is-on');
    });
    addEventListener('pointerdown', () => cur.classList.add('is-down'));
    addEventListener('pointerup', () => cur.classList.remove('is-down'));

    let badgeKey = '';
    const setBadge = (key, dark = false) => {
      badgeKey = key;
      if (key) label.textContent = App.t(`cursor.${key}`);
      badge.classList.toggle('is-on', !!key);
      badge.classList.toggle('is-dark', !!key && dark);
      cur.classList.toggle('is-badge', !!key);
    };
    App.onLang(() => { if (badgeKey) label.textContent = App.t(`cursor.${badgeKey}`); });

    document.addEventListener('pointerover', e => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const interactive = t.closest('a, button, input, label, [role="button"]');
      const badgeEl = t.closest('[data-cursor]');
      if (badgeEl && (!interactive || interactive === badgeEl || interactive.contains(badgeEl))) {
        setBadge(badgeEl.dataset.cursor, badgeEl.hasAttribute('data-cursor-dark'));
        cur.classList.remove('is-link', 'is-text');
        return;
      }
      setBadge('');
      cur.classList.toggle('is-text', !!t.closest('input, textarea'));
      cur.classList.toggle('is-link', !!interactive && !t.closest('input, textarea'));
    });

    App.onTick(dt => {
      const { x, y } = App.pointer;
      rx = damp(rx, x, 16, dt);
      ry = damp(ry, y, 16, dt);
      bx = damp(bx, x, 11, dt);
      by = damp(by, y, 11, dt);
      dot.style.transform = `translate3d(${x}px,${y}px,0)`;
      ring.style.transform = `translate3d(${rx.toFixed(1)}px,${ry.toFixed(1)}px,0)`;
      badge.style.transform = `translate3d(${bx.toFixed(1)}px,${by.toFixed(1)}px,0)`;
    });
  }

  function initMagnetic() {
    if (!finePointer || reduced) return;
    $$('[data-magnetic]').forEach(el => {
      const k = parseFloat(el.dataset.magnetic) || .32;
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * k;
        const y = (e.clientY - r.top - r.height / 2) * k;
        el.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
      });
      el.addEventListener('pointerleave', () => { el.style.translate = ''; });
    });
  }

  /* ------------------------------------------------------------------------
     Variable-font lens: letters change weight/width near the pointer
     ------------------------------------------------------------------------ */
  function createLens(chars, { from, to, radius }) {
    const pts = chars.map(() => ({ x: 0, y: 0, v: 0, last: -1 }));
    let enabled = false;
    const api = {
      chars,
      measure() {
        chars.forEach((c, i) => {
          const r = c.getBoundingClientRect();
          pts[i].x = r.left + r.width / 2;
          pts[i].y = r.top + r.height / 2 + App.scrollY;
        });
      },
      enable() { enabled = true; api.measure(); },
      update(dt) {
        if (!enabled) return;
        const R = radius();
        const { x, y, has } = App.pointer;
        const py = y + App.scrollY;
        for (let i = 0; i < chars.length; i++) {
          const p = pts[i];
          let target = 0;
          if (has) {
            const f = clamp(1 - Math.hypot(x - p.x, py - p.y) / R, 0, 1);
            target = f * f * (3 - 2 * f);
          }
          p.v = damp(p.v, target, 7, dt);
          if (Math.abs(p.v - p.last) < .004) continue;
          p.last = p.v;
          const w = lerp(from[0], to[0], p.v);
          const wd = lerp(from[1], to[1], p.v);
          chars[i].style.fontVariationSettings = `"wght" ${w.toFixed(0)}, "wdth" ${wd.toFixed(1)}`;
        }
      }
    };
    return api;
  }

  /* ------------------------------------------------------------------------
     Hero
     ------------------------------------------------------------------------ */
  function initHero() {
    const hero = $('.hero');
    if (!hero) return {};
    const chars = splitChars($('.hero__row--1 .hero__word'));
    splitChars($('.hero__word--serif'));
    const glow = $('.hero__glow');
    const lens = createLens(chars, { from: [800, 75], to: [200, 100], radius: () => Math.max(240, App.vw * .21) });

    const canvas = $('.hero__field');
    const field = window.AsciiField ? safe('ascii field', () => window.AsciiField.create(canvas, { reduced })) : null;
    if (!field) canvas.classList.add('is-fallback');

    let visible = true;
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(hero);

    let gx = App.vw * .7, gy = App.vh * .3;
    let fx = App.vw * .6, fy = App.vh * .45, hover = 0;
    let rendered = false;

    App.onMeasure(() => {
      lens.measure();
      if (field) field.resize();
      rendered = false;
    });

    hero.addEventListener('pointerdown', e => {
      if (!field || e.target.closest('a, button')) return;
      const r = canvas.getBoundingClientRect();
      field.ripple(e.clientX - r.left, e.clientY - r.top);
    });

    App.onTick((dt, t) => {
      if (!visible) return;
      lens.update(dt);

      const has = App.pointer.has;
      const tx = has ? App.pointer.x : App.vw * (.6 + Math.sin(t / 2600) * .22);
      const ty = (has ? App.pointer.y : App.vh * (.42 + Math.cos(t / 3300) * .18)) + App.scrollY;
      gx = damp(gx, tx, 2.4, dt);
      gy = damp(gy, ty, 2.4, dt);
      glow.style.transform = `translate3d(${gx.toFixed(1)}px,${gy.toFixed(1)}px,0)`;

      if (field) {
        fx = damp(fx, tx, 6, dt);
        fy = damp(fy, ty, 6, dt);
        hover = damp(hover, has ? 1 : .55, 3, dt);
        if (!reduced || !rendered) {
          field.render(t / 1000, fx, fy, hover);
          rendered = true;
        }
      }
    });

    return {
      reveal() { if (field) field.reveal(); },
      introDone() {
        lens.enable();
        if (!finePointer && !reduced) {
          root.classList.add('is-touch');
          chars.forEach(c => c.classList.add('is-waving'));
        }
      }
    };
  }

  function initRotator() {
    const el = $('.rotator');
    if (!el) return { start() {} };
    let words = [];
    let idx = 0;
    let timer = 0;
    const fit = () => {
      const w = words[idx];
      if (w) el.style.width = `${w.offsetWidth}px`;
    };
    const build = () => {
      const list = App.t('hero.rotator');
      el.innerHTML = list.map((w, i) => `<span class="rotator__w${i === 0 ? ' is-on' : ''}">${escapeHTML(w)}</span>`).join('');
      words = $$('.rotator__w', el);
      idx = 0;
      fit();
    };
    const next = () => {
      if (document.hidden || words.length < 2) return;
      const cur = words[idx];
      idx = (idx + 1) % words.length;
      cycleSwap(cur, words[idx]);
      fit();
    };
    build();
    App.onLang(build);
    App.onMeasure(fit);
    return {
      start() {
        if (reduced) return;
        clearInterval(timer);
        timer = setInterval(next, 2600);
      }
    };
  }

  /* ------------------------------------------------------------------------
     Warp: fly through the words towards a </>, whose slash wipes the screen to
     the light section. Depth comes from the scroll position, so it plays both
     ways; only the slow roll of the tunnel keeps moving when you stop.
     ------------------------------------------------------------------------ */
  function initWarp() {
    const sec = $('.warp');
    if (!sec) return;
    const field = $('.warp__field', sec);
    const stage = $('.warp__stage', sec);
    const code = $('.warp__code path', sec);
    const tech = sec.dataset.list.split('|');

    const DEPTH = 12;         // how far away things start (1 / (1 + DEPTH) of their closest size)
    const LIFE = .28;         // share of the journey a word takes to reach the camera
    const LAST_WORD = .76;    // progress at which the last word goes past
    const WIPE = .72;         // progress at which the </> starts to grow
    const GOLDEN = 2.39996;   // golden angle: consecutive words never share a side
    const DUST_COUNT = App.vw < 768 ? 9 : 16;
    const DUST_LIFE = .38;
    const STROKE = 2.6;       // of the </>, in path units; half of it is the slash reach that has to clear the corners
    const NEAR = .25;         // from this scale on a word gets its own layer (see .warp__word.is-near)

    const smooth = (a, b, v) => {
      const x = clamp((v - a) / (b - a), 0, 1);
      return x * x * (3 - 2 * x);
    };
    const toggle = (it, on) => {
      if (it.on === on) return;
      it.on = on;
      it.el.style.visibility = on ? 'visible' : 'hidden';
    };

    let words = [], dust = [];
    const build = () => {
      // One idea, then two tools, so both lists stay present the whole way.
      const said = App.t('warp.words');
      const seq = [];
      for (let i = 0, j = 0; i < said.length || j < tech.length; i++) {
        if (said[i]) seq.push({ text: said[i], serif: true });
        for (let n = 0; n < 2 && j < tech.length; n++) seq.push({ text: tech[j++], serif: false });
      }
      const dustHTML = `<svg class="warp__dust" viewBox="0 0 24 24" stroke-width="${STROKE}"><path d="${code.getAttribute('d')}"/></svg>`;
      // Earlier words are always closer, so they stack on top.
      field.innerHTML = dustHTML.repeat(DUST_COUNT) + seq.map((w, i) =>
        `<span class="warp__word${w.serif ? ' warp__word--serif' : ''}" style="z-index:${seq.length - i}">${escapeHTML(w.text)}</span>`
      ).join('');
      const span = LAST_WORD - LIFE;
      words = $$('.warp__word', field).map((el, i, all) => ({
        el, on: false, near: false, at: all.length > 1 ? (i / (all.length - 1)) * span : 0, angle: i * GOLDEN - .6
      }));
      // Depth and angle from two unrelated sequences (R2), or the dust lines up in arms.
      dust = $$('.warp__dust', field).map((el, i) => ({
        el, on: false, phase: (i * .7549) % 1, angle: ((i * .5698) % 1) * 6.2832, reach: .8 + (i % 3) * .3
      }));
    };
    build();
    App.onLang(build);
    if (reduced) return;

    const glow = $('.warp__glow', sec);
    let start = 0, end = 1, w = 1, h = 1, rx = 1, ry = 1, kRest = 1, kFull = 1;
    App.onMeasure(() => {
      const r = sec.getBoundingClientRect();
      w = stage.offsetWidth;
      h = stage.offsetHeight;
      // Already underway as the stage rises into view, so there is no dead scroll.
      start = r.top + App.scrollY - h * .65;
      end = r.top + App.scrollY + sec.offsetHeight - h;
      const wide = w >= h;
      // Words are wide: on a tall screen there is only room to spread them vertically.
      rx = w * (wide ? .85 : .3);
      ry = h * (wide ? .85 : .95);
      kRest = Math.max(16, Math.min(w, h) * .03) / 12;
      kFull = (Math.hypot(w, h) / 2 / (STROKE / 2)) * 1.08;
    });

    let visible = false;
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { rootMargin: '10% 0px' }).observe(sec);

    code.setAttribute('stroke-width', STROKE);
    let t = 0, roll = 0, tilt = 0, dir = 1, vx = 0, vy = 0;
    App.onTick(dt => {
      const target = clamp((App.scrollY - start) / Math.max(1, end - start), 0, 1);
      if (!visible) {
        t = target;
        return;
      }
      t = damp(t, target, 14, dt);
      if (App.velocity > .3) dir = 1;
      else if (App.velocity < -.3) dir = -1;
      const speed = Math.abs(App.velocity);
      roll += dt * (.04 + Math.min(speed * .008, .6)) * dir;

      // The vanishing point leans towards the pointer, and recentres for the wipe.
      const wipe = clamp((t - WIPE) / (1 - WIPE), 0, 1);
      const lean = finePointer && App.pointer.has ? (1 - wipe) * .05 : 0;
      vx = damp(vx, lean * (App.pointer.x - App.vw / 2), 4, dt);
      vy = damp(vy, lean * (App.pointer.y - App.vh / 2), 4, dt);

      for (let i = 0; i < words.length; i++) {
        const it = words[i];
        const p = (t - it.at) / LIFE;
        toggle(it, p > 0 && p < 1);
        const s = 1 / (1 + (1 - p) * DEPTH);
        const near = it.on && s >= NEAR;
        if (near !== it.near) {
          it.near = near;
          it.el.classList.toggle('is-near', near);
        }
        if (!it.on) continue;
        const a = it.angle + roll + p * 1.1;
        const x = vx * (1 - s) + Math.cos(a) * rx * s;
        const y = vy * (1 - s) + Math.sin(a) * ry * s;
        it.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-50%) scale(${s.toFixed(4)})`;
        it.el.style.opacity = (smooth(0, .4, p) * (1 - smooth(.8, .98, p))).toFixed(3);
      }

      const dustOn = t > 0 && t < WIPE + .1;
      for (let i = 0; i < dust.length; i++) {
        const it = dust[i];
        toggle(it, dustOn);
        if (!it.on) continue;
        const p = (t / DUST_LIFE + it.phase) % 1;
        const s = 1 / (1 + (1 - p) * DEPTH);
        const a = it.angle + roll * 1.5 + p * 1.1;
        const x = vx * (1 - s) + Math.cos(a) * rx * it.reach * s;
        const y = vy * (1 - s) + Math.sin(a) * ry * it.reach * s;
        it.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-50%) scale(${s.toFixed(4)}) rotate(${(Math.sin(a) * 10).toFixed(1)}deg)`;
        it.el.style.opacity = (smooth(0, .3, p) * (1 - smooth(.8, .98, p)) * smooth(0, .04, t) * .85).toFixed(3);
      }

      // Exponential growth reads as constant speed. Upright so it stays legible: only
      // speed tips it. The < > leave by the sides and the slash widens to cover the screen.
      tilt = damp(tilt, clamp(App.velocity * .25, -12, 12) * (1 - wipe), 6, dt);
      const rest = kRest * (1 + Math.min(t, WIPE) / WIPE * .8);
      const k = rest * Math.pow(kFull / rest, Math.pow(wipe, 1.4));
      const cx = w / 2 + vx;
      const cy = h / 2 + vy;
      code.setAttribute('transform', `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${tilt.toFixed(2)}) scale(${k.toFixed(3)}) translate(-12 -12)`);
      code.style.opacity = smooth(.02, .14, t).toFixed(3);

      glow.style.transform = `translate3d(${vx.toFixed(1)}px,${vy.toFixed(1)}px,0) scale(${(.55 + t * .9).toFixed(3)})`;
      glow.style.opacity = smooth(0, .3, t).toFixed(3);
    });
  }

  /* ------------------------------------------------------------------------
     About: scroll-scrubbed statement + counters
     ------------------------------------------------------------------------ */
  function initStatement() {
    const el = $('[data-scrub]');
    if (!el) return;
    let words = [];
    let top = 0, h = 0, last = -1;
    const split = () => {
      wrapWords(el, 'plain');
      words = $$('.sw', el);
      last = -1;
    };
    split();
    App.onLang(split);
    App.onMeasure(() => {
      const r = el.getBoundingClientRect();
      top = r.top + App.scrollY;
      h = r.height;
      last = -1;
    });
    App.onTick(() => {
      let lit;
      if (reduced) {
        lit = words.length + 1;
      } else {
        const y = top - App.scrollY;
        const start = App.vh * .82;
        const p = clamp((start - y) / (App.vh * .27 + h), 0, 1);
        lit = p * (words.length + 1);
      }
      if (Math.abs(lit - last) < .01) return;
      last = lit;
      for (let i = 0; i < words.length; i++) {
        words[i].style.opacity = (.13 + .87 * clamp(lit - i, 0, 1)).toFixed(3);
      }
    });
  }

  function renderCount(el, v) {
    const pad = +(el.dataset.pad || 0);
    const suffix = el.dataset.suffix || '';
    el.innerHTML = String(v).padStart(pad, '0') + (suffix ? `<span class="suf">${escapeHTML(suffix)}</span>` : '');
  }

  function countUp(el) {
    const to = +el.dataset.count;
    const from = +(el.dataset.from || 0);
    if (reduced) return renderCount(el, to);
    const t0 = performance.now();
    const dur = 1900;
    const step = now => {
      const t = clamp((now - t0) / dur, 0, 1);
      renderCount(el, Math.round(from + (to - from) * easeOutExpo(t)));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ------------------------------------------------------------------------
     Journey: git graph drawn with the scroll
     ------------------------------------------------------------------------ */
  function initGitGraph() {
    const wrap = $('.gitlog');
    if (!wrap) return;
    const svg = $('.gitlog__svg', wrap);
    const [trackMain, trackBranch, drawMain, drawBranch] =
      ['.gitlog__track--main', '.gitlog__track--branch', '.gitlog__draw--main', '.gitlog__draw--branch'].map(s => $(s, svg));
    const commits = $$('.commit', wrap);
    let top = 0;
    let nodes = [];
    let main = { from: 0, to: 1, len: 1 };
    let branch = { from: 0, to: 1, len: 0 };
    let last = -1;

    App.onMeasure(() => {
      const wr = wrap.getBoundingClientRect();
      top = wr.top + App.scrollY;
      svg.setAttribute('viewBox', `0 0 ${Math.max(1, svg.clientWidth)} ${Math.max(1, wr.height)}`);
      nodes = commits.map(c => {
        const n = $('.commit__node', c).getBoundingClientRect();
        return { x: n.left + n.width / 2 - wr.left, y: n.top + n.height / 2 - wr.top, lane: +c.dataset.lane, el: c, on: null };
      });
      const lane0 = nodes.filter(n => n.lane === 0);
      if (lane0.length < 2) return;
      const x0 = lane0[0].x;
      const y0 = lane0[0].y;
      const y1 = lane0[lane0.length - 1].y;
      const dMain = `M${x0} ${y0} V${y1}`;
      trackMain.setAttribute('d', dMain);
      drawMain.setAttribute('d', dMain);
      main = { from: y0, to: y1, len: drawMain.getTotalLength() };

      const bi = nodes.findIndex(n => n.lane === 1);
      let dBranch = '';
      if (bi > 0 && bi < nodes.length - 1) {
        const b = nodes[bi];
        const ya = nodes[bi - 1].y + 24;
        const yb = nodes[bi + 1].y - 24;
        const k = Math.max(10, Math.min(80, (b.y - ya) * .85, (yb - b.y) * .85));
        dBranch = `M${x0} ${ya} C${x0} ${ya + k * .6} ${b.x} ${ya + k * .4} ${b.x} ${ya + k} ` +
                  `V${yb - k} C${b.x} ${yb - k * .4} ${x0} ${yb - k * .6} ${x0} ${yb}`;
        branch = { from: ya, to: yb };
      }
      trackBranch.setAttribute('d', dBranch);
      drawBranch.setAttribute('d', dBranch);
      branch.len = dBranch ? drawBranch.getTotalLength() : 0;
      [[drawMain, main.len], [drawBranch, branch.len]].forEach(([p, len]) => {
        p.style.strokeDasharray = `${len} ${len}`;
        p.style.strokeDashoffset = `${len}`;
      });
      last = -1;
    });

    App.onTick(() => {
      const head = App.scrollY + App.vh * .62 - top;
      if (Math.abs(head - last) < .5) return;
      last = head;
      const pm = clamp((head - main.from) / Math.max(1, main.to - main.from), 0, 1);
      drawMain.style.strokeDashoffset = `${main.len * (1 - pm)}`;
      if (branch.len) {
        const pb = clamp((head - branch.from) / Math.max(1, branch.to - branch.from), 0, 1);
        drawBranch.style.strokeDashoffset = `${branch.len * (1 - pb)}`;
      }
      nodes.forEach(n => {
        const on = head >= n.y - 2;
        if (on !== n.on) {
          n.on = on;
          n.el.classList.toggle('is-on', on);
        }
      });
    });
  }

  function degreeIn(el) {
    const start = new Date(el.dataset.start).getTime();
    const end = new Date(el.dataset.end).getTime();
    const p = clamp((Date.now() - start) / (end - start), 0, 1);
    el.style.setProperty('--p', p.toFixed(4));
    const pct = $('.js-degree-pct', el);
    const target = Math.round(p * 100);
    if (reduced) {
      pct.textContent = `${target}%`;
      return;
    }
    const t0 = performance.now() + 300;
    const step = now => {
      const t = clamp((now - t0) / 1800, 0, 1);
      pct.textContent = `${Math.round(target * easeOutExpo(t))}%`;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ------------------------------------------------------------------------
     Work: horizontal gallery driven by vertical scroll (desktop)
     ------------------------------------------------------------------------ */
  function initWork() {
    const sec = $('.work');
    const track = $('.work__track');
    if (!sec || !track) return;
    const bar = $('.work__bar i');
    const idxEl = $('.js-work-idx');
    const cards = $$('.project', track);
    const pars = cards.map(c => $('.project__parallax', c));
    let on = false, top = 0, dist = 0, centers = [];
    let skew = 0, lastP = -1, lastIdx = -1;

    App.onMeasure(() => {
      on = desktop.matches;
      if (!on) {
        sec.style.height = '';
        track.style.transform = '';
        pars.forEach(p => { if (p) p.style.transform = ''; });
        return;
      }
      dist = Math.max(0, track.offsetWidth - App.vw);
      sec.style.height = `${dist + App.vh}px`;
      top = sec.getBoundingClientRect().top + App.scrollY;
      centers = cards.map(c => c.offsetLeft + c.offsetWidth / 2);
      lastP = -1;
    });

    App.onTick(dt => {
      if (!on) return;
      const p = clamp((App.scrollY - top) / Math.max(1, dist), 0, 1);
      const moving = p > 0 && p < 1 && !reduced;
      skew = damp(skew, moving ? clamp(-App.velocity * .1, -2.5, 2.5) : 0, 7, dt);
      if (Math.abs(p - lastP) < 1e-5 && Math.abs(skew) < .005) return;
      lastP = p;
      const x = -p * dist;
      track.style.transform = `translate3d(${x.toFixed(1)}px,0,0) skewX(${skew.toFixed(3)}deg)`;
      bar.style.transform = `scaleX(${p.toFixed(4)})`;
      let best = 0, bestD = Infinity;
      centers.forEach((cx, i) => {
        const off = cx + x - App.vw / 2;
        if (pars[i] && !reduced) pars[i].style.transform = `translate3d(${(off * -.06).toFixed(1)}px,0,0)`;
        if (Math.abs(off) < bestD) {
          bestD = Math.abs(off);
          best = i;
        }
      });
      if (best !== lastIdx) {
        lastIdx = best;
        idxEl.textContent = String(best + 1).padStart(2, '0');
      }
    });
  }

  function initVisuals() {
    if (!window.Visuals) return;
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      const v = en.target._visual;
      if (!v) return;
      en.isIntersecting ? v.start() : v.stop();
    }), { threshold: .15 });
    $$('[data-mock]').forEach(el => {
      const v = safe('visual', () => window.Visuals.mount(el, App));
      if (!v) return;
      el._visual = v;
      io.observe(el);
      App.onLang(() => v.lang());
    });
  }

  /* ------------------------------------------------------------------------
     Stack: physics playground (lazy) + spotlight cards + greetings
     ------------------------------------------------------------------------ */
  function initStack() {
    const box = $('.playground');
    if (box) {
      if (!finePointer) {
        const hint = $('.js-play-hint', box);
        hint.dataset.i18n = 'stack.hintTouch';
        hint.innerHTML = App.t('stack.hintTouch');
      }
      let pg = null;
      let started = false;
      new IntersectionObserver(([en]) => {
        if (en.isIntersecting && !started) {
          started = true;
          pg = window.StackPlayground ? safe('playground', () => window.StackPlayground.create(box, App)) : null;
          if (!pg) box.classList.add('is-static');
        }
        if (pg) en.isIntersecting ? pg.start() : pg.stop();
      }, { rootMargin: '0px 0px -15% 0px' }).observe(box);
      $('.playground__shake', box).addEventListener('click', () => { if (pg) pg.shake(); });
    }

    if (finePointer) {
      $$('.card').forEach(card => card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${(e.clientX - r.left).toFixed(0)}px`);
        card.style.setProperty('--my', `${(e.clientY - r.top).toFixed(0)}px`);
      }));
    }

    const hello = $$('.hello__w');
    if (hello.length > 1 && !reduced) {
      let i = 0;
      setInterval(() => {
        if (document.hidden) return;
        const cur = hello[i];
        i = (i + 1) % hello.length;
        cycleSwap(cur, hello[i]);
      }, 2300);
    }
  }

  /* ------------------------------------------------------------------------
     Contact
     ------------------------------------------------------------------------ */
  function initContact() {
    const big = $('.contact__big');
    if (big) {
      const span = $('[data-chars]', big);
      let lens = null;
      let visible = false;
      const build = () => {
        lens = createLens(splitChars(span), { from: [300, 85], to: [800, 75], radius: () => Math.max(200, App.vw * .17) });
        if (finePointer && !reduced) lens.enable();
      };
      build();
      App.onLang(() => {
        build();
        if (big.classList.contains('is-in') && !reduced) {
          big.classList.remove('is-in');
          void big.offsetWidth;
          requestAnimationFrame(() => big.classList.add('is-in'));
        }
      });
      App.onMeasure(() => lens && lens.measure());
      let remeasured = false;
      new IntersectionObserver(([en]) => {
        visible = en.isIntersecting;
        // the letters rise into place when revealed: measure them once they've landed
        if (visible && !remeasured) {
          remeasured = true;
          setTimeout(() => lens && lens.measure(), 1800);
        }
      }).observe(big);
      App.onTick(dt => { if (visible && lens) lens.update(dt); });
    }

    $$('[data-copy]').forEach(btn => btn.addEventListener('click', async e => {
      e.preventDefault();
      const text = btn.dataset.copy;
      let ok = false;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch (err) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
        document.body.appendChild(ta);
        ta.select();
        try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
        ta.remove();
      }
      App.toast(App.t(ok ? 'toast.copied' : 'toast.copyFail'));
      if (ok) {
        btn.classList.add('is-done');
        setTimeout(() => btn.classList.remove('is-done'), 1800);
      }
    }));
  }

  function initToast() {
    const el = $('.toast');
    let timer = 0;
    App.toast = msg => {
      el.textContent = msg;
      el.classList.add('is-on');
      clearTimeout(timer);
      timer = setTimeout(() => el.classList.remove('is-on'), 2400);
    };
  }

  /* ------------------------------------------------------------------------
     Reveals, theme, progress, clock
     ------------------------------------------------------------------------ */
  function initReveal() {
    $$('[data-split]').forEach(el => { if (!el._split) splitHeading(el); });
    $$('[data-count]').forEach(el => renderCount(el, +(el.dataset.from || 0)));

    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target;
      io.unobserve(el);
      if (el.matches('.commit')) {
        el.classList.add('is-seen');
        return;
      }
      el.classList.add('is-in');
      if (el.matches('.sec-label') && !reduced) {
        const s = $('[data-fx="scramble"]', el);
        if (s) scramble(s, s.textContent);
      }
      $$('[data-count]', el).forEach(countUp);
      if (el.matches('[data-degree]')) degreeIn(el);
    }), { rootMargin: '0px 0px -10% 0px' });

    $$('[data-reveal], [data-split], .sec-label, .contact__big, [data-degree], .commit').forEach(el => io.observe(el));
  }

  function initTheme() {
    const sections = $$('main [data-theme], footer[data-theme]');
    const meta = $('meta[name="theme-color"]');
    let ranges = [];
    let current = root.dataset.theme || 'dark';
    App.onMeasure(() => {
      ranges = sections.map(s => {
        const r = s.getBoundingClientRect();
        return { top: r.top + App.scrollY, bottom: r.bottom + App.scrollY, theme: s.dataset.theme };
      });
    });
    App.onTick(() => {
      const y = App.scrollY + App.vh * .5;
      let theme = current;
      for (const r of ranges) {
        if (y >= r.top && y < r.bottom) {
          theme = r.theme;
          break;
        }
      }
      if (theme !== current) {
        current = theme;
        root.dataset.theme = theme;
        if (meta) meta.setAttribute('content', theme === 'light' ? '#eeebe4' : '#0b0b0e');
      }
    });
  }

  function initProgress() {
    const bar = $('.progress i');
    let last = -1;
    App.onTick(() => {
      const max = docH - App.vh;
      const p = max > 0 ? clamp(App.scrollY / max, 0, 1) : 0;
      if (Math.abs(p - last) < 1e-4) return;
      last = p;
      bar.style.transform = `scaleX(${p.toFixed(4)})`;
    });
  }

  function initClock() {
    const els = $$('.js-clock');
    if (!els.length) return;
    let fmt;
    try {
      fmt = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    } catch (e) {
      fmt = { format: d => d.toTimeString().slice(0, 8) };
    }
    const tick = () => {
      const s = fmt.format(new Date());
      els.forEach(el => { el.textContent = s; });
    };
    tick();
    setInterval(tick, 1000);
  }

  function hello() {
    console.log(
      '%c HA %c Hola, dev 👋  ¿Buscas talento? → ' + EMAIL + '  ·  Pulsa Ctrl + K para abrir la terminal.',
      'background:#8b5cf6;color:#fff;font-weight:700;padding:3px 7px;border-radius:4px',
      'color:#a78bfa;font-weight:600'
    );
  }

  /* ------------------------------------------------------------------------
     Main loop + boot
     ------------------------------------------------------------------------ */
  function startLoop() {
    let lastT = performance.now();
    let lastY = window.scrollY;
    const loop = t => {
      requestAnimationFrame(loop);
      const dt = clamp((t - lastT) / 1000, .001, .064);
      lastT = t;
      if (App.lenis) App.lenis.raf(t);
      const y = window.scrollY;
      App.velocity = damp(App.velocity, (y - lastY) / (dt * 60), 12, dt);
      lastY = y;
      App.scrollY = y;
      for (let i = 0; i < ticks.length; i++) {
        try {
          ticks[i](dt, t);
        } catch (err) {
          console.error('[tick]', err);
          ticks.splice(i--, 1);
        }
      }
    };
    requestAnimationFrame(loop);
  }

  async function boot() {
    initToast();
    safe('scroll', initScroll);

    // Language first, so every module builds itself in the right one.
    setLang(root.dataset.lang === 'en' ? 'en' : 'es', { animate: false });

    // Work goes first: it changes the document height, the rest measure after it.
    safe('work', initWork);
    const hero = safe('hero', initHero) || {};
    const rotator = safe('rotator', initRotator) || { start() {} };
    safe('pointer', initPointer);
    safe('nav', initNav);
    safe('anchors', initAnchors);
    safe('cursor', initCursor);
    safe('magnetic', initMagnetic);
    safe('warp', initWarp);
    safe('statement', initStatement);
    safe('git graph', initGitGraph);
    safe('visuals', initVisuals);
    safe('stack', initStack);
    safe('contact', initContact);
    safe('reveal', initReveal);
    safe('theme', initTheme);
    safe('progress', initProgress);
    safe('clock', initClock);
    safe('terminal', () => window.Terminal && window.Terminal.init(App));
    hello();

    App.measureAll();
    addEventListener('resize', queueMeasure);
    if ('ResizeObserver' in window) new ResizeObserver(queueMeasure).observe(document.body);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => App.measureAll());
    startLoop();
    root.classList.add('is-ready');

    await runLoader();

    root.classList.add('is-loaded');
    if (App.lenis) App.lenis.start();
    if (hero.reveal) hero.reveal();
    setTimeout(() => rotator.start(), 1400);
    setTimeout(() => {
      App.measureAll();
      if (hero.introDone) hero.introDone();
    }, reduced ? 50 : 2300);

    if (location.hash.length > 1) {
      const target = $(location.hash);
      if (target) setTimeout(() => scrollToTarget(target), 500);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
