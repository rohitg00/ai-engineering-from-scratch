/* Adapted from ascii.rest src/mount.ts at 2572c2612fee106858f47aec139e3657f79f3a63.
 * Copyright (c) 2026 bas3line, MIT. See LICENSE in this directory. */
(function () {
  'use strict';

  function create(canvas, meta) {
    var cols = meta.cols, rows = meta.rows, cell = meta.cell || 2;
    var palette = meta.palette;
    var ground = meta.ground || '#08090b';
    var ink = '#e4dfd4';
    var ctx = canvas.getContext('2d');
    var atlas = document.createElement('canvas');
    var actx = atlas.getContext('2d');
    if (!ctx || !actx) throw new Error('Canvas rendering is unavailable');
    var slots = new Map();
    var w = 0, h = 0, sw = 0, sh = 0, pw = 0, ph = 0, width = -1;
    var xs, ys, gx, gy;
    var last = '', current = '', colors = null;
    var lastColor = new Uint8Array(cols * rows);
    var full = true;
    var destroyed = false;
    canvas.style.aspectRatio = cols + ' / ' + (rows * cell);

    function size() {
      width = canvas.clientWidth || 720;
      w = width * (window.devicePixelRatio || 1) / cols;
      h = w * cell;
      sw = Math.ceil(w);
      sh = Math.ceil(h);
      pw = sw + 2;
      ph = sh + 2;
      canvas.width = Math.round(w * cols);
      canvas.height = Math.round(h * rows);
      atlas.width = pw * 32;
      atlas.height = ph * 32;
      xs = Int32Array.from({ length: cols + 1 }, function (_, x) { return Math.round(x * w); });
      ys = Int32Array.from({ length: rows + 1 }, function (_, y) { return Math.round(y * h); });
      gx = Int32Array.from({ length: cols }, function (_, x) { return Math.round(x * w + (w - sw) / 2); });
      gy = Int32Array.from({ length: rows }, function (_, y) { return Math.round(y * h + (h - sh) / 2); });
      slots.clear();
      full = true;
    }

    function glyph(code, color) {
      var key = code * 256 + color;
      if (slots.has(key)) return slots.get(key);
      if (slots.size === 1024) {
        actx.clearRect(0, 0, atlas.width, atlas.height);
        slots.clear();
      }
      var slot = slots.size;
      var x = (slot % 32) * pw + 1, y = Math.floor(slot / 32) * ph + 1;
      actx.font = (w / 0.6) + 'px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      actx.textAlign = 'center';
      actx.textBaseline = 'middle';
      actx.fillStyle = palette ? palette[color] || palette[0] : ink;
      actx.save();
      actx.beginPath();
      actx.rect(x - 1, y - 1, pw, ph);
      actx.clip();
      actx.fillText(String.fromCharCode(code), x + sw / 2, y + sh / 2);
      actx.restore();
      slots.set(key, slot);
      return slot;
    }

    function draw(text, color) {
      if (destroyed) return;
      current = text;
      colors = color;
      ctx.fillStyle = ground;
      if (full) ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (var k = 0, x = 0, y = 0; k < text.length; k++) {
        var code = text.charCodeAt(k);
        if (code === 10) { x = 0; y++; continue; }
        var index = y * cols + x;
        if (full || code !== last.charCodeAt(k) || (color && color[index] !== lastColor[index])) {
          var x0 = xs[x], y0 = ys[y], cw = xs[x + 1] - x0, ch = ys[y + 1] - y0;
          if (!full) ctx.fillRect(x0, y0, cw, ch);
          if (code !== 32) {
            var slot = glyph(code, color ? color[index] : 0);
            ctx.drawImage(atlas, (slot % 32) * pw + 1 + x0 - gx[x], Math.floor(slot / 32) * ph + 1 + y0 - gy[y], cw, ch, x0, y0, cw, ch);
          }
        }
        x++;
      }
      last = text;
      if (color) lastColor.set(color);
      full = false;
    }

    function resize() {
      if (destroyed || canvas.clientWidth === width) return;
      size();
      draw(current, colors);
    }
    size();
    var observer = window.ResizeObserver ? new window.ResizeObserver(resize) : null;
    if (observer) observer.observe(canvas);
    else window.addEventListener('resize', resize);
    return {
      draw: draw,
      destroy: function () {
        destroyed = true;
        if (observer) observer.disconnect();
        else window.removeEventListener('resize', resize);
        slots.clear();
      }
    };
  }

  window.AsciiRestCanvas = { create: create };
})();
