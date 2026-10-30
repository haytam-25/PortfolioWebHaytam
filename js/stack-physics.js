/* ==========================================================================
   Stack playground — the tech pills fall into the box and can be thrown
   around (Matter.js for the physics, plain DOM elements for the rendering).
   ========================================================================== */
(() => {
  'use strict';

  function create(box, App) {
    const M = window.Matter;
    const world = box.querySelector('.playground__world');
    const pills = Array.from(world.querySelectorAll('.pill'));
    if (!M || App.reduced || !pills.length) {
      box.classList.add('is-static');
      return null;
    }

    const { Engine, Bodies, Body, Composite, Query, Constraint } = M;
    const engine = Engine.create({ positionIterations: 8, velocityIterations: 6 });
    engine.gravity.y = 1.1;

    const STEP = 1000 / 60;
    const WALL = 400;
    let W = world.clientWidth;
    let H = world.clientHeight;
    let walls = [];
    let items = [];
    let drag = null;
    let raf = 0;
    let acc = 0;
    let lastT = 0;
    let dropped = false;

    const rand = (a, b) => a + Math.random() * (b - a);
    const itemOf = body => items.find(it => it.body === body);

    function makeWalls() {
      if (walls.length) Composite.remove(engine.world, walls);
      const opts = { isStatic: true, friction: .4, restitution: .2 };
      walls = [
        Bodies.rectangle(W / 2, H + WALL / 2, W + WALL * 2, WALL, opts),
        Bodies.rectangle(-WALL / 2, H / 2 - H, WALL, H * 4, opts),
        Bodies.rectangle(W + WALL / 2, H / 2 - H, WALL, H * 4, opts)
      ];
      Composite.add(engine.world, walls);
    }

    function makeBody(el, x, y, angle) {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const body = Bodies.rectangle(x, y, w, h, {
        chamfer: { radius: h / 2 - 1 },
        restitution: .38,
        friction: .1,
        frictionAir: .014,
        density: .0018,
        angle
      });
      return { el, body, w, h };
    }

    function drop() {
      dropped = true;
      items = pills.map((el, i) => {
        const w = el.offsetWidth;
        const it = makeBody(el, rand(w / 2 + 8, Math.max(w / 2 + 9, W - w / 2 - 8)), -60 - i * 26 - rand(0, 140), rand(-.5, .5));
        it.added = false;
        return it;
      });
      items.forEach((it, i) => setTimeout(() => {
        Composite.add(engine.world, it.body);
        Body.setVelocity(it.body, { x: rand(-2, 2), y: rand(2, 6) });
        it.added = true;
        it.el.style.opacity = '1';
      }, i * 55));
    }

    function sync() {
      for (const it of items) {
        if (!it.added) continue;
        const { x, y } = it.body.position;
        if (y > H + 300 || x < -300 || x > W + 300) {
          Body.setPosition(it.body, { x: rand(it.w / 2, W - it.w / 2), y: -80 });
          Body.setVelocity(it.body, { x: 0, y: 0 });
        }
        it.el.style.transform =
          `translate3d(${(it.body.position.x - it.w / 2).toFixed(1)}px,${(it.body.position.y - it.h / 2).toFixed(1)}px,0) rotate(${it.body.angle.toFixed(3)}rad)`;
      }
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      acc += Math.min(64, now - (lastT || now));
      lastT = now;
      while (acc >= STEP) {
        Engine.update(engine, STEP);
        acc -= STEP;
      }
      sync();
    }

    function resize() {
      const nw = world.clientWidth;
      const nh = world.clientHeight;
      if (!nw || !nh || (nw === W && nh === H)) return;
      W = nw;
      H = nh;
      makeWalls();
      // pills scale with the viewport: rebuild bodies that changed size
      items = items.map(it => {
        if (Math.abs(it.el.offsetWidth - it.w) < 2 && Math.abs(it.el.offsetHeight - it.h) < 2) {
          Body.setPosition(it.body, { x: Math.min(Math.max(it.body.position.x, it.w / 2), W - it.w / 2), y: Math.min(it.body.position.y, H - it.h / 2) });
          return it;
        }
        const next = makeBody(it.el, Math.min(Math.max(it.body.position.x, 40), W - 40), Math.min(it.body.position.y, H - 40), it.body.angle);
        next.added = it.added;
        if (it.added) {
          Composite.remove(engine.world, it.body);
          Composite.add(engine.world, next.body);
        }
        return next;
      });
    }

    const local = e => {
      const r = world.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const flick = body => {
      Body.setVelocity(body, { x: rand(-7, 7), y: rand(-17, -12) });
      Body.setAngularVelocity(body, rand(-.3, .3));
    };

    box.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      const p = local(e);
      const hit = Query.point(items.filter(it => it.added).map(it => it.body), p)[0];
      if (!hit) return;
      if (e.pointerType === 'touch') {
        flick(hit);
        return;
      }
      e.preventDefault();
      box.setPointerCapture(e.pointerId);
      drag = Constraint.create({
        pointA: p,
        bodyB: hit,
        pointB: { x: p.x - hit.position.x, y: p.y - hit.position.y },
        stiffness: .18,
        damping: .08,
        length: 0
      });
      Composite.add(engine.world, drag);
      const it = itemOf(hit);
      if (it) it.el.classList.add('is-grabbed');
    });

    box.addEventListener('pointermove', e => {
      if (drag) drag.pointA = local(e);
    });

    const release = () => {
      if (!drag) return;
      const it = itemOf(drag.bodyB);
      if (it) it.el.classList.remove('is-grabbed');
      Composite.remove(engine.world, drag);
      drag = null;
    };
    box.addEventListener('pointerup', release);
    box.addEventListener('pointercancel', release);
    box.addEventListener('lostpointercapture', release);

    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(world);
    makeWalls();
    box.classList.add('is-live');

    return {
      start() {
        if (raf) return;
        if (!dropped) {
          // wait for the fonts so the pills are measured at their final size
          const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
          ready.then(() => { if (!dropped) drop(); });
        }
        lastT = 0;
        raf = requestAnimationFrame(frame);
      },
      stop() {
        cancelAnimationFrame(raf);
        raf = 0;
        release();
      },
      shake() {
        items.forEach(it => { if (it.added) flick(it.body); });
      }
    };
  }

  window.StackPlayground = { create };
})();
