/* ==========================================================================
   Hero background: a WebGL field of code glyphs drifting with simplex noise.
   The pointer acts as a violet lens and a click sends a ripple through it.
   One full-screen triangle, one texture (the glyph atlas), one draw call.
   ========================================================================== */
(() => {
  'use strict';

  const VERT = `
    attribute vec2 aPos;
    void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
  `;

  const FRAG = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
    #else
      precision mediump float;
    #endif

    uniform vec2 uRes;
    uniform vec2 uCell;
    uniform float uTime;
    uniform vec3 uPointer;   // xy in px (top-left origin), z = strength
    uniform vec3 uRipple;    // xy in px, z = start time
    uniform float uReveal;
    uniform float uCount;
    uniform sampler2D uAtlas;

    vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
      m = m * m;
      m = m * m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
      vec3 g;
      g.x = a0.x * x0.x + h.x * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
      vec2 cell = floor(frag / uCell);
      vec2 local = fract(frag / uCell);
      vec2 center = (cell + 0.5) * uCell;
      vec2 uv = center / uRes.y;
      float t = uTime;

      float n = snoise(uv * 1.7 + vec2(t * 0.045, -t * 0.03));
      n += 0.5 * snoise(uv * 3.6 + vec2(-t * 0.07, t * 0.05));
      n = n / 1.5 * 0.5 + 0.5;
      float field = smoothstep(0.45, 0.96, n);

      float d = distance(center, uPointer.xy) / uRes.y;
      float lens = (1.0 - smoothstep(0.0, 0.26, d)) * uPointer.z;

      float rt = t - uRipple.z;
      float rd = distance(center, uRipple.xy) / uRes.y;
      float ring = rt > 0.0 ? exp(-pow((rd - rt * 0.62) * 13.0, 2.0)) * exp(-rt * 1.3) : 0.0;

      float h = hash(cell);
      float tw = step(0.993, hash(cell + floor(t * 1.4 + h * 9.0)));

      float level = clamp(field * 0.72 + lens * 0.8 + ring + tw * 0.55, 0.0, 1.0);

      float order = (center.x / uRes.x) * 0.3 + (center.y / uRes.y) * 0.5 + h * 0.2;
      float vis = smoothstep(order, order + 0.1, uReveal * 1.12);

      float idx = floor(level * (uCount - 1.0) + 0.5);
      vec2 auv = vec2((idx + local.x) / uCount, local.y);
      float glyph = texture2D(uAtlas, auv).a;

      float alpha = glyph * (0.16 + 0.84 * level) * vis * 0.8;
      vec3 base = vec3(0.60, 0.58, 0.67);
      vec3 violet = vec3(0.68, 0.55, 1.0);
      vec3 col = mix(base, violet, clamp(lens * 1.35 + ring * 1.6 + tw, 0.0, 1.0));
      gl_FragColor = vec4(col * alpha, alpha);
    }
  `;

  const GLYPHS = ' .·:-~=+*/\\<>()[]{};01#%';

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error(log || 'shader compile error');
    }
    return sh;
  }

  // Draws every glyph, sorts them by ink coverage and packs them in a strip.
  function buildAtlas(cw, ch) {
    const chars = Array.from(GLYPHS);
    const canvas = document.createElement('canvas');
    canvas.width = cw * chars.length;
    canvas.height = ch;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const font = `500 ${Math.round(ch * .6)}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    const scored = chars.map(g => {
      ctx.clearRect(0, 0, cw, ch);
      ctx.fillText(g, cw / 2, ch / 2);
      const data = ctx.getImageData(0, 0, cw, ch).data;
      let ink = 0;
      for (let k = 3; k < data.length; k += 4) ink += data[k];
      return { g, ink };
    });
    scored.sort((a, b) => a.ink - b.ink);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = font;
    scored.forEach((o, i) => ctx.fillText(o.g, i * cw + cw / 2, ch / 2 + ch * .02));
    return { canvas, count: chars.length };
  }

  function create(canvas, { reduced = false } = {}) {
    let gl = null;
    try {
      gl = canvas.getContext('webgl', {
        alpha: true, premultipliedAlpha: true, antialias: false, depth: false,
        stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false
      });
    } catch (e) { gl = null; }
    if (!gl) return null;

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link error');
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const U = {};
    ['uRes', 'uCell', 'uTime', 'uPointer', 'uRipple', 'uReveal', 'uCount', 'uAtlas'].forEach(n => { U[n] = gl.getUniformLocation(prog, n); });

    const tex = gl.createTexture();
    let count = GLYPHS.length;
    const uploadAtlas = () => {
      const atlas = buildAtlas(40, 64);
      count = atlas.count;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    uploadAtlas();
    // redraw the atlas once JetBrains Mono is really there
    if (document.fonts && document.fonts.load) {
      document.fonts.load('500 40px "JetBrains Mono"').then(uploadAtlas).catch(() => {});
    }

    gl.uniform1i(U.uAtlas, 0);
    gl.clearColor(0, 0, 0, 0);

    let dpr = 1;
    let reveal = reduced ? 1 : 0;
    let revealStart = -1;
    let ripple = [-9999, -9999, -100];
    let lost = false;
    let now = 0;

    canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      lost = true;
      canvas.classList.add('is-fallback');
    });

    const api = {
      resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
        const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        gl.viewport(0, 0, w, h);
        const small = canvas.clientWidth < 700;
        gl.uniform2f(U.uRes, w, h);
        gl.uniform2f(U.uCell, (small ? 12 : 15) * dpr, (small ? 19 : 23) * dpr);
      },
      reveal() {
        revealStart = now;
      },
      ripple(x, y) {
        ripple = [x * dpr, y * dpr, now];
      },
      render(time, px, py, strength) {
        if (lost) return;
        now = time;
        if (revealStart >= 0 && reveal < 1) reveal = Math.min(1, (time - revealStart) / 2.2);
        gl.uniform1f(U.uTime, reduced ? 12 : time);
        gl.uniform3f(U.uPointer, px * dpr, py * dpr, strength);
        gl.uniform3f(U.uRipple, ripple[0], ripple[1], ripple[2]);
        gl.uniform1f(U.uReveal, reveal);
        gl.uniform1f(U.uCount, count);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    };
    api.resize();
    return api;
  }

  window.AsciiField = { create };
})();
