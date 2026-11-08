# SMIL rules for animated lesson figures

This file holds the twelve rules in full, then one note for each rule, then a validator. The rules are facts that real figures on the course site proved. A figure that breaks one of them can mount with no console error and still show the wrong motion.

## The rules, in full

```text
Animated lesson figures are declarative SVG. Facts proven on this site:
1. Use SMIL only: `<animate>`, `<animateTransform>`, `<animateMotion>`. No JavaScript animation loops (no setInterval, no requestAnimationFrame) in an animated figure. At most about 55 SVG nodes per figure, so long lesson pages never stall.
2. Motion brief: entries fade and grow from opacity 0 at about 95% scale, never from scale 0. Use `calcMode="spline"` with `keySplines="0.23 1 0.32 1"` (strong ease out). Stagger begins by 0.05 to 0.4 s. Exits are faster than entries. Loops are calm, 2.5 to 6 s, `repeatCount="indefinite"`.
3. `keyTimes`: the count equals the `values` count, the first is 0, the last is 1, and the list never decreases. Browsers silently ignore a wrong list and fall back to even spacing, so a figure can mount with zero console errors while its timing is broken. Check the markup, not only the mount.
4. `keySplines`: the count equals the keyTimes count minus 1, and only with `calcMode="spline"`.
5. `animateMotion` with `keyPoints` needs `calcMode="linear"` and a keyPoints count equal to the keyTimes count. Never leave a stray two-entry `values` on a path motion.
6. SMIL cannot interpolate CSS `var()` inside animated `fill` or `stroke` values. Keep the static attribute as `var()`, put a second element over it filled with the target `var()` colour, and animate that element's `fill-opacity` or `stroke-opacity`. Use literal hex only as a last resort.
7. The site runtime forces any animation of x, y, width, height, r, cx, cy, rx or ry to play once and freeze, and adds a Replay button. For loops, animate only opacity, transform, stroke-dashoffset, or animateMotion.
8. The static frame (reduced motion and previews) reads the host's `data-static-time`, default 1.5 s. Make that moment a complete, readable picture.
9. After a slider re-render the runtime reconciles nodes and strips attributes absent from the new node, including ids set at runtime. Give your own `<desc>` a stable id. Reconciled nodes get `transform-box: fill-box; transform-origin: center`, so scale growth starts from the centre. Grow bars with stroke-dash instead of scale.
10. Width: `.lesson-figure.lf-animated svg` is capped at 760 px. A 560-unit diagram on a 375 px phone renders 11 px labels at about 5 px, so keep labels at 12 units or more or let the figure scroll sideways at a minimum width of 500.
11. Colours come from CSS variables only, so both themes work.
12. Widget code is ES5: var and function expressions, no arrow functions, no let or const, no template literals. viewBox `0 0 520 H`. Redraw in `state._render` by clearing and re-adding SVG children.
```

## Notes on each rule

**Rule 1.** Count elements, not text nodes. The 55 limit includes the `<svg>`, groups, shapes, text elements, and every animation element. A long lesson can hold ten or more figures, so each figure must stay small.

**Rule 2.** These are the entry values that the course modules use:

```js
var SPL = '0.23 1 0.32 1';
node.appendChild(svgEl('animate', { attributeName: 'opacity', values: '0;1', keyTimes: '0;1', dur: '0.5s', begin: begin, fill: 'freeze', calcMode: 'spline', keySplines: SPL }));
node.appendChild(svgEl('animateTransform', { attributeName: 'transform', type: 'scale', additive: 'sum', values: '0.95;1', keyTimes: '0;1', dur: '0.5s', begin: begin, fill: 'freeze', calcMode: 'spline', keySplines: SPL }));
```

The `additive: 'sum'` keeps the group's `translate`. Without it, the scale replaces the translate and the group jumps to the origin. Draw the group's content around (0, 0) so that the scale grows from the group's centre.

**Rule 3.** The browser does not report a bad `keyTimes` list. It ignores the list and spaces the values evenly. So the figure mounts, the console stays empty, and the timing is wrong. Check the attribute text with the validator below.

**Rule 4.** Two values give one spline. Four values give three splines, separated by `;`. A `keySplines` attribute without `calcMode="spline"` has no effect, so it hides a mistake.

**Rule 5.** A motion with `keyPoints="0;0;1;1"` and `keyTimes="0;0.1;0.8;1"` waits, moves, then waits. If a `values` attribute stays on the element, it replaces the path and the motion is wrong.

**Rule 6.** To change a box from grey to blue, draw the grey box. Put a blue box with `fill-opacity="0"` on top of it. Animate the blue box's `fill-opacity`. Both colours stay as `var()`, so both themes work.

**Rule 7.** The runtime also includes x1, y1, x2, and y2 in the list of geometry attributes that play once. Treat those four as geometry too. An animation with no `repeatCount` also plays once and freezes, because the runtime adds `repeatCount="1"` and `fill="freeze"`. A loop with `fill="freeze"` also changes to play once.

**Rule 8.** The static frame is one moment of the timeline. At that moment, every entry must be complete and every label must be visible. With default timing, all entries must end before 1.5 s. A moving dot can be anywhere on its path, but it must be visible.

**Rule 9.** This rule applies to slider widgets. Create ids once, outside the render function, and give them to the new nodes on every render. The reconciled nodes also get a 220 ms transition on opacity and transform, and a 180 ms transition on fill and stroke.

**Rule 10.** The `.lf-out svg` element inside a widget card has a 560 px cap. The animated host cap is 760 px.

**Rule 11.** Write each colour with a default value: `var(--blueprint,#3553ff)`. The default is the light theme value. The dark theme redefines the variable, so the figure changes with the theme.

**Rule 12.** The course runtime itself is ES5. Some old modules use ES6 syntax. New code must use ES5.

## Validator

Paste this function into the browser console on a lesson page. Call `checkMotionFigure(document.querySelector('[data-figure^="request-path"]'))`. It returns a list of problems. An empty list means the markup passes.

```js
function checkMotionFigure(host) {
  var out = [];
  var GEOMETRY = ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'r', 'cx', 'cy', 'rx', 'ry'];
  function list(node, name) {
    var v = node.getAttribute(name);
    return v === null ? null : v.split(';').map(function (s) { return s.trim(); }).filter(function (s) { return s !== ''; });
  }
  function seconds(d) {
    if (!d) return NaN;
    if (/ms$/.test(d)) return parseFloat(d) / 1000;
    return parseFloat(d);
  }
  var svgs = host.querySelectorAll('svg');
  Array.prototype.forEach.call(svgs, function (svg, si) {
    var count = svg.querySelectorAll('*').length + 1;
    if (count > 55) out.push('svg ' + si + ': ' + count + ' elements, limit 55');
    Array.prototype.forEach.call(svg.querySelectorAll('text'), function (t) {
      var size = parseFloat(t.getAttribute('font-size'));
      if (size && size < 12) out.push('text "' + t.textContent.slice(0, 24) + '": font-size ' + size + ' below 12');
    });
  });
  var anims = host.querySelectorAll('animate, animateTransform, animateMotion');
  Array.prototype.forEach.call(anims, function (a, i) {
    var tag = a.tagName;
    var where = tag + ' #' + i + ' (' + (a.getAttribute('attributeName') || 'path') + ')';
    var kt = list(a, 'keyTimes');
    var vals = list(a, 'values');
    var kp = list(a, 'keyPoints');
    var ks = list(a, 'keySplines');
    var mode = a.getAttribute('calcMode') || (tag === 'animateMotion' ? 'paced' : 'linear');
    if (kt) {
      var n = kp ? kp.length : (vals ? vals.length : -1);
      if (n !== -1 && kt.length !== n) out.push(where + ': keyTimes count ' + kt.length + ' differs from ' + n);
      if (Number(kt[0]) !== 0) out.push(where + ': keyTimes does not start at 0');
      if (mode !== 'paced' && mode !== 'discrete' && Number(kt[kt.length - 1]) !== 1) out.push(where + ': keyTimes does not end at 1');
      for (var j = 1; j < kt.length; j++) if (Number(kt[j]) < Number(kt[j - 1])) out.push(where + ': keyTimes decreases at entry ' + j);
    }
    if (ks) {
      if (mode !== 'spline') out.push(where + ': keySplines without calcMode spline');
      if (kt && ks.length !== kt.length - 1) out.push(where + ': keySplines count ' + ks.length + ', need ' + (kt.length - 1));
      if (!kt && vals && ks.length !== vals.length - 1) out.push(where + ': keySplines count ' + ks.length + ', need ' + (vals.length - 1));
    }
    if (tag === 'animateMotion') {
      if (kp && mode !== 'linear') out.push(where + ': keyPoints needs calcMode linear');
      if (kp && !kt) out.push(where + ': keyPoints without keyTimes');
      if (vals) out.push(where + ': values attribute on a path motion');
    }
    var attr = a.getAttribute('attributeName');
    if ((attr === 'fill' || attr === 'stroke') && /var\(/.test(a.getAttribute('values') || a.getAttribute('to') || '')) {
      out.push(where + ': var() inside an animated ' + attr);
    }
    if (a.getAttribute('repeatCount') === 'indefinite') {
      if (GEOMETRY.indexOf(attr) !== -1) out.push(where + ': loop on geometry attribute ' + attr);
      var dur = seconds(a.getAttribute('dur'));
      if (!(dur >= 2.5 && dur <= 6)) out.push(where + ': loop duration ' + a.getAttribute('dur') + ' outside 2.5 to 6 s');
    }
    if (attr === 'transform' && a.getAttribute('type') === 'scale' && vals && Number(vals[0]) === 0) {
      out.push(where + ': scale starts at 0');
    }
  });
  return out;
}
```

The validator checks the markup after mount. It does not check the static frame, the dark theme, or the phone width. Check those by eye.
