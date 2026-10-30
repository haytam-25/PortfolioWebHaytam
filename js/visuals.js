/* ==========================================================================
   Project screenshots: each card shows its real screenshots in a browser
   frame that cycles through them (wipe + slow zoom), types the URL path of
   every screen and tilts in 3D under the pointer.
   Each factory returns { start, stop, lang } and only animates while visible.
   ========================================================================== */
(() => {
  'use strict';

  const DURATION = 4200;

  function shots(root, App) {
    const imgs = Array.from(root.querySelectorAll('.shots__img'));
    const dots = Array.from(root.querySelectorAll('.shots__dots i'));
    const path = root.querySelector('.mock__path');
    const load = root.querySelector('.shots__load i');
    const visual = root.closest('.project__visual');
    let idx = 0;
    let timer = 0;
    let typing = 0;
    let active = false;
    let paused = false;
    let bar = null;

    const typePath = text => {
      if (!path) return;
      clearInterval(typing);
      if (App.reduced) {
        path.textContent = text;
        return;
      }
      path.textContent = '';
      let i = 0;
      typing = setInterval(() => {
        path.textContent = text.slice(0, ++i);
        if (i >= text.length) clearInterval(typing);
      }, 45);
    };

    const runBar = () => {
      if (!load || App.reduced) return;
      if (bar) bar.cancel();
      bar = load.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: DURATION, easing: 'linear', fill: 'forwards' });
      if (paused) bar.pause();
    };

    const show = next => {
      if (next === idx || imgs.length < 2) return;
      const prev = imgs[idx];
      const cur = imgs[next];
      idx = next;
      cur.classList.remove('is-out');
      void cur.offsetWidth;
      prev.classList.remove('is-on');
      prev.classList.add('is-out');
      cur.classList.add('is-on');
      setTimeout(() => prev.classList.remove('is-out'), 1100);
      dots.forEach((d, i) => d.classList.toggle('is-on', i === idx));
      typePath(cur.dataset.path || '/');
    };

    const schedule = () => {
      clearTimeout(timer);
      if (!active || paused || App.reduced || imgs.length < 2) return;
      runBar();
      timer = setTimeout(async () => {
        const nextImg = imgs[(idx + 1) % imgs.length];
        // don't wipe in a screenshot that hasn't arrived yet
        if (nextImg.decode) await nextImg.decode().catch(() => {});
        if (!active || paused) return;
        show((idx + 1) % imgs.length);
        schedule();
      }, DURATION);
    };

    if (visual && App.finePointer && !App.reduced) {
      const mock = root;
      visual.addEventListener('pointermove', e => {
        const r = visual.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5;
        const y = (e.clientY - r.top) / r.height - .5;
        mock.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`);
        mock.style.setProperty('--rx', `${(-y * 8).toFixed(2)}deg`);
        mock.style.setProperty('--gx', `${((x + .5) * 100).toFixed(1)}%`);
        mock.style.setProperty('--gy', `${((y + .5) * 100).toFixed(1)}%`);
      });
      visual.addEventListener('pointerenter', () => {
        paused = true;
        clearTimeout(timer);
        if (bar) bar.pause();
      });
      visual.addEventListener('pointerleave', () => {
        mock.style.setProperty('--rx', '0deg');
        mock.style.setProperty('--ry', '0deg');
        paused = false;
        if (active) schedule();
      });
    }

    return {
      start() {
        if (active) return;
        active = true;
        // the card is about to be seen: fetch the rest of its screenshots now
        imgs.forEach(img => { img.loading = 'eager'; });
        root.classList.add('is-live');
        schedule();
      },
      stop() {
        active = false;
        clearTimeout(timer);
        if (bar) bar.pause();
      },
      lang() {}
    };
  }

  window.Visuals = {
    mount(el, App) {
      return el.dataset.mock === 'shots' ? shots(el, App) : null;
    }
  };
})();
