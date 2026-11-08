(function () {
  var css = ''
    + '.dither{display:block;width:100%;height:108px;border:1px solid var(--ink,#1a1a1a);box-shadow:3px 3px 0 var(--ink,#1a1a1a);background:var(--bg,#fafaf5);overflow:hidden;position:relative;cursor:crosshair;}'
    + '.dither.slim{height:60px;}'
    + '.dither canvas{display:block;width:100%;height:100%;image-rendering:pixelated;image-rendering:crisp-edges;}'
    + '.dither .dk,.dither .dl{position:absolute;bottom:7px;font-family:var(--font-mono,ui-monospace,monospace);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink,#1a1a1a);background:var(--bg,#fafaf5);padding:2px 7px;border:1px solid var(--ink,#1a1a1a);pointer-events:none;line-height:1.5;}'
    + '.dither .dk{left:8px;}'
    + '.dither .dl{right:8px;color:var(--ink-mute,#7a7a78);border-color:var(--rule-soft,rgba(26,26,26,.16));opacity:0;transition:opacity 200ms ease;}'
    + '@media (hover:hover) and (pointer:fine){.dither:hover .dl{opacity:1;}}'
    + '@media (max-width:600px){.dither{height:84px;}.dither.slim{height:50px;}.dither .dl{display:none;}}';
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hoverable = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var MODES = ['noise field', 'ripple', 'wave', 'sweep'];

  function hash(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function rgb(colour, preset) {
    var m = /^#([0-9a-f]{3,8})$/i.exec(colour || '');
    if (m) {
      var h = m[1];
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
    }
    m = /rgba?\(([^)]+)\)/.exec(colour || '');
    if (m) { var p = m[1].split(','); return [parseFloat(p[0]) / 255, parseFloat(p[1]) / 255, parseFloat(p[2]) / 255]; }
    return preset;
  }
  function palette() {
    return {
      bg: rgb(cssVar('--bg'), [0.98, 0.98, 0.96]),
      fg: rgb(cssVar('--blueprint'), [0.21, 0.33, 1]),
      ink: rgb(cssVar('--ink'), [0.1, 0.1, 0.1])
    };
  }

  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var FS = 'precision mediump float;uniform vec2 r;uniform float t;uniform float seed;uniform int mode;uniform vec3 bg;uniform vec3 fg;uniform vec3 ink;uniform vec2 m;uniform float ripple;'
    + 'float h21(vec2 p){p=fract(p*vec2(123.34,456.21)+seed);p+=dot(p,p+45.32);return fract(p.x*p.y);}'
    + 'float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float a=h21(i),b=h21(i+vec2(1.,0.)),c=h21(i+vec2(0.,1.)),d=h21(i+vec2(1.,1.));return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}'
    + 'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*vn(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}'
    + 'float bayer2(vec2 a){a=floor(a);return fract(a.x/2.+a.y*a.y*.75);}'
    + 'float bayer4(vec2 a){return bayer2(.5*a)*.25+bayer2(a);}'
    + 'float bayer8(vec2 a){return bayer4(.5*a)*.25+bayer2(a);}'
    + 'void main(){vec2 px=gl_FragCoord.xy;vec2 uv=px/r;vec2 q=vec2(uv.x*r.x/r.y,uv.y);float v;'
    + 'if(mode==0){v=fbm(q*2.2+vec2(t*.12,t*.05));v=smoothstep(.25,.8,v);}'
    + 'else if(mode==1){vec2 c=vec2(.62+.1*sin(seed),.5);float d=length((uv-c)*vec2(r.x/r.y,1.));v=.5+.5*sin(d*11.-t*1.4);v=v*.8+.2*fbm(q*3.);}'
    + 'else if(mode==2){float w=sin(q.x*3.1+q.y*2.2+t*.6)*.5+.5;float n=fbm(q*1.6+vec2(-t*.08,t*.04));v=w*.55+n*.55;}'
    + 'else{float s=fract(uv.x*.9-t*.06);float g=smoothstep(0.,1.,s);float n=fbm(q*2.6+vec2(t*.05,0.));v=g*.6+n*.5;}'
    + 'float md=length((uv-m)*vec2(r.x/r.y,1.));v+=ripple*.35*sin(md*22.-t*5.)*exp(-md*3.);'
    + 'v+=.16*exp(-md*4.);'
    + 'v=clamp(v,0.,1.);v=pow(v,1.7)*.92;'
    + 'float th=bayer8(px);'
    + 'vec3 col;if(v<.7){col=(v/.7>th)?fg:bg;}else{col=((v-.7)/.3>th)?ink:fg;}'
    + 'gl_FragColor=vec4(col,1.);}';

  function mount(el) {
    var seedText = el.getAttribute('data-seed') || location.pathname;
    var seed = hash(seedText);
    var mode = el.hasAttribute('data-mode') ? parseInt(el.getAttribute('data-mode'), 10) % 4 : seed % 4;
    var scale = parseFloat(el.getAttribute('data-px') || (window.innerWidth < 600 ? '3' : '2'));
    var canvas = document.createElement('canvas');
    el.appendChild(canvas);
    var kicker = el.getAttribute('data-label');
    if (kicker) {
      var chip = document.createElement('span');
      chip.className = 'dk';
      chip.textContent = kicker;
      el.appendChild(chip);
    }
    var tag = document.createElement('span');
    tag.className = 'dl';
    tag.textContent = MODES[mode] + ' · bayer 8x8 · seed ' + (seed % 1000);
    el.appendChild(tag);

    var gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false });
    if (!gl) {
      canvas.style.display = 'none';
      el.style.background = 'repeating-linear-gradient(45deg,var(--blueprint,#3553ff) 0 1px,var(--bg,#fafaf5) 1px 5px)';
      return;
    }
    function shader(type, source) {
      var s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VS));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(program);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var at = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
    var U = {};
    var names = ['r', 't', 'seed', 'mode', 'bg', 'fg', 'ink', 'm', 'ripple'];
    for (var i = 0; i < names.length; i++) U[names[i]] = gl.getUniformLocation(program, names[i]);

    var colours = palette();
    var pointer = [0.62, 0.5];
    var ripple = 0;
    var t0 = performance.now() + (seed % 977) * 20;
    var running = false;
    var visible = false;
    var last = 0;
    var raf = 0;

    function fit() {
      var w = Math.max(64, Math.floor(el.clientWidth / scale));
      var h = Math.max(20, Math.floor(el.clientHeight / scale));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
    }
    function draw(now) {
      el.setAttribute('data-frames', String(parseInt(el.getAttribute('data-frames') || '0', 10) + 1));
      fit();
      gl.uniform2f(U.r, canvas.width, canvas.height);
      gl.uniform1f(U.t, (now - t0) / 1000);
      gl.uniform1f(U.seed, (seed % 1000) / 1000);
      gl.uniform1i(U.mode, mode);
      gl.uniform3fv(U.bg, colours.bg);
      gl.uniform3fv(U.fg, colours.fg);
      gl.uniform3fv(U.ink, colours.ink);
      gl.uniform2f(U.m, pointer[0], pointer[1]);
      gl.uniform1f(U.ripple, ripple);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    function frame(now) {
      raf = 0;
      if (!running) return;
      if (now - last >= 33) {
        last = now;
        ripple *= 0.96;
        if (ripple < 0.01) ripple = 0;
        draw(now);
      }
      raf = requestAnimationFrame(frame);
    }
    function still() { if (reduced || !running) draw(performance.now()); }
    function start() {
      if (reduced) { draw(performance.now()); return; }
      if (!running) { running = true; if (!raf) raf = requestAnimationFrame(frame); }
    }
    function stop() { running = false; }

    new IntersectionObserver(function (entries) {
      for (var k = 0; k < entries.length; k++) {
        visible = entries[k].isIntersecting;
        if (visible && !document.hidden) start(); else stop();
      }
    }, { threshold: 0.05 }).observe(el);
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else if (visible) start(); });
    if (hoverable) {
      el.addEventListener('pointermove', function (event) {
        var box = el.getBoundingClientRect();
        pointer = [(event.clientX - box.left) / box.width, 1 - (event.clientY - box.top) / box.height];
        still();
      });
      el.addEventListener('pointerleave', function () { pointer = [0.62, 0.5]; still(); });
    }
    el.addEventListener('click', function () { ripple = 1; still(); });
    new MutationObserver(function () { colours = palette(); still(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('resize', still);
    draw(performance.now());
  }

  function boot() {
    var bands = document.querySelectorAll('.dither');
    for (var i = 0; i < bands.length; i++) {
      try { mount(bands[i]); } catch (error) { bands[i].style.display = 'none'; }
    }
  }
  if (document.readyState !== 'loading') boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
