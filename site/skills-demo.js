(function () {
  var BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  var STEP_MS = 280;

  function tile(density) {
    var rects = '';
    for (var y = 0; y < 4; y++) {
      for (var x = 0; x < 4; x++) {
        if (BAYER[y][x] / 16 < density) rects += '<rect x="' + (x * 2) + '" y="' + (y * 2) + '" width="2" height="2"/>';
      }
    }
    return 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" shape-rendering="crispEdges">' + rects + '</svg>') + '")';
  }

  function number(n) { return Number(n).toLocaleString('en-US'); }

  function mount(fig) {
    var data = JSON.parse(fig.querySelector('.sl-data').textContent);
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var asks = fig.querySelectorAll('.sl-ask');
    var always = fig.querySelectorAll('.sl-always li');
    var loaded = fig.querySelector('[data-loaded]');
    var loadedTotal = fig.querySelector('[data-loaded-total]');
    var meter = fig.querySelector('[data-meter]');
    var meterLabel = fig.querySelector('[data-meter-label]');
    var verdict = fig.querySelector('[data-verdict]');
    var base = 0;
    var biggest = 1;
    var current = 0;
    var timers = [];

    fig.style.setProperty('--sl-dots-hi', tile(0.8));
    fig.style.setProperty('--sl-dots-mid', tile(0.5));
    fig.style.setProperty('--sl-dots-lo', tile(0.22));
    fig.style.setProperty('--sl-dots-ghost', tile(0.28));

    for (var i = 0; i < data.skills.length; i++) base += data.skills[i].tokens;
    for (var r = 0; r < data.requests.length; r++) {
      for (var f = 0; f < data.requests[r].files.length; f++) biggest = Math.max(biggest, data.requests[r].files[f].tokens);
    }

    function clear() {
      for (var t = 0; t < timers.length; t++) clearTimeout(timers[t]);
      timers = [];
    }

    function report(sum, shown, request) {
      var used = base + sum;
      loadedTotal.textContent = shown ? shown + (shown === 1 ? ' file · ' : ' files · ') + number(sum) + ' tokens' : 'nothing yet';
      meterLabel.textContent = number(used) + ' of ' + number(data.full) + ' tokens';
      meter.style.transform = 'scaleX(' + Math.max(0.004, used / data.full) + ')';
      var share = (used / data.full * 100).toFixed(1);
      verdict.textContent = 'Loaded ' + number(used) + ' tokens of ' + number(data.full) + ' (' + share + '%) for "' + request.say + '". Loading every skill in full costs ' + number(data.full) + '.';
    }

    function row(file, isRef, animate) {
      var li = document.createElement('li');
      li.className = (isRef ? 'sl-ref' : 'sl-main') + (animate ? ' sl-enter' : '');
      var name = document.createElement('span');
      name.className = 'sl-path';
      name.textContent = file.path;
      var count = document.createElement('b');
      count.textContent = number(file.tokens);
      var track = document.createElement('span');
      track.className = 'sl-bar';
      var fill = document.createElement('i');
      fill.style.width = Math.max(4, file.tokens / biggest * 100) + '%';
      if (animate) {
        var veil = document.createElement('em');
        fill.appendChild(veil);
      }
      track.appendChild(fill);
      li.appendChild(name);
      li.appendChild(count);
      li.appendChild(track);
      return li;
    }

    function select(index) {
      current = index;
      for (var a = 0; a < asks.length; a++) asks[a].setAttribute('aria-pressed', String(a === index));
    }

    function run(index, animate) {
      clear();
      select(index);
      var request = data.requests[index];
      loaded.textContent = '';
      for (var s = 0; s < always.length; s++) always[s].className = always[s].getAttribute('data-skill') === request.skill ? 'sl-match' : '';
      var sum = 0;
      if (!animate) {
        for (var k = 0; k < request.files.length; k++) {
          loaded.appendChild(row(request.files[k], k > 0, false));
          sum += request.files[k].tokens;
        }
        report(sum, request.files.length, request);
        return;
      }
      report(0, 0, request);
      request.files.forEach(function (file, k) {
        timers.push(setTimeout(function () {
          var li = row(file, k > 0, true);
          loaded.appendChild(li);
          sum += file.tokens;
          report(sum, k + 1, request);
          requestAnimationFrame(function () { requestAnimationFrame(function () { li.className = li.className.replace(' sl-enter', ''); }); });
        }, 320 + k * STEP_MS));
      });
    }

    for (var b = 0; b < asks.length; b++) {
      asks[b].addEventListener('click', (function (index) {
        return function () { run(index, !reduced); };
      })(b));
    }
    fig.querySelector('.sl-replay').addEventListener('click', function () { run(current, !reduced); });

    run(0, false);
    if (reduced || !('IntersectionObserver' in window)) return;
    loaded.textContent = '';
    for (var c = 0; c < always.length; c++) always[c].className = '';
    report(0, 0, data.requests[0]);
    var observer = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      observer.disconnect();
      run(current, true);
    }, { threshold: 0.35 });
    observer.observe(fig);
  }

  function boot() {
    var figs = document.querySelectorAll('[data-skill-loader]');
    for (var i = 0; i < figs.length; i++) {
      try { mount(figs[i]); } catch (error) { figs[i].setAttribute('data-error', String(error && error.message)); }
    }
  }
  if (document.readyState !== 'loading') boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
