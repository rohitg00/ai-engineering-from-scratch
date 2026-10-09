(function () {
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hoverable = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var MODES = ['noise field', 'ripple', 'wave', 'sweep'];
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

  function hash(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function rgb(value) {
    var match = String(value).match(/rgba?\(([^)]+)\)/);
    if (!match) return [0.21, 0.33, 1];
    var parts = match[1].split(',').map(parseFloat);
    return [parts[0] / 255, parts[1] / 255, parts[2] / 255];
  }

  function palette(el) {
    var style = getComputedStyle(el);
    return { bg: rgb(style.backgroundColor), fg: rgb(style.color), ink: rgb(style.borderTopColor) };
  }

  function mount(el) {
    var seed = hash(el.getAttribute('data-seed') || location.pathname);
    var mode = el.hasAttribute('data-mode') ? parseInt(el.getAttribute('data-mode'), 10) % 4 : seed % 4;
    var tag = document.createElement('span');
    tag.className = 'm-dither-mode';
    tag.textContent = MODES[mode] + ' · bayer 8x8 · seed ' + (seed % 1000);
    el.appendChild(tag);

    var canvas = null;
    var gl = null;
    var uniforms = {};
    var colors = null;
    var mouse = [0.62, 0.5];
    var ripple = 0;
    var t0 = performance.now() + (seed % 977) * 20;
    var running = false;
    var visible = false;
    var last = 0;
    var raf = 0;

    function compile(type, source) {
      var shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    }

    function setup() {
      canvas = document.createElement('canvas');
      el.insertBefore(canvas, el.firstChild);
      gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false });
      if (!gl) {
        el.classList.add('is-static');
        return false;
      }
      var program = gl.createProgram();
      gl.attachShader(program, compile(gl.VERTEX_SHADER, VS));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(program);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      var position = gl.getAttribLocation(program, 'p');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      ['r', 't', 'seed', 'mode', 'bg', 'fg', 'ink', 'm', 'ripple'].forEach(function (name) { uniforms[name] = gl.getUniformLocation(program, name); });
      colors = palette(el);
      return true;
    }

    function size() {
      var scale = window.innerWidth < 600 ? 3 : 2;
      var w = Math.max(64, Math.floor(el.clientWidth / scale));
      var h = Math.max(20, Math.floor(el.clientHeight / scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }

    function draw(now) {
      if (!gl) return;
      size();
      gl.uniform2f(uniforms.r, canvas.width, canvas.height);
      gl.uniform1f(uniforms.t, (now - t0) / 1000);
      gl.uniform1f(uniforms.seed, (seed % 1000) / 1000);
      gl.uniform1i(uniforms.mode, mode);
      gl.uniform3fv(uniforms.bg, colors.bg);
      gl.uniform3fv(uniforms.fg, colors.fg);
      gl.uniform3fv(uniforms.ink, colors.ink);
      gl.uniform2f(uniforms.m, mouse[0], mouse[1]);
      gl.uniform1f(uniforms.ripple, ripple);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function paint() { draw(performance.now()); }

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

    function start() {
      if (!gl) return;
      if (reduced) { paint(); return; }
      if (!running) {
        running = true;
        if (!raf) raf = requestAnimationFrame(frame);
      }
    }

    function stop() { running = false; }

    function still() { if (reduced || !running) paint(); }

    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        visible = entry.isIntersecting;
        if (visible && !canvas && setup()) paint();
        if (visible && !document.hidden) start();
        else stop();
      });
    }, { threshold: 0.05 }).observe(el);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
      else if (visible) start();
    });
    if (hoverable) {
      el.addEventListener('pointermove', function (event) {
        var box = el.getBoundingClientRect();
        mouse = [(event.clientX - box.left) / box.width, 1 - (event.clientY - box.top) / box.height];
        if (reduced) paint();
      });
      el.addEventListener('pointerleave', function () {
        mouse = [0.62, 0.5];
        if (reduced) paint();
      });
    }
    el.addEventListener('click', function () {
      ripple = 1;
      if (reduced) paint();
    });
    new MutationObserver(function () {
      if (!gl) return;
      colors = palette(el);
      still();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('resize', still);
  }

  function boot() {
    if (typeof IntersectionObserver !== 'function') return;
    var bands = document.querySelectorAll('.m-dither');
    for (var i = 0; i < bands.length; i++) {
      try { mount(bands[i]); } catch (_) { bands[i].classList.add('is-static'); }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
