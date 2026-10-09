(function () {
  var root = document.documentElement;

  function play(item) {
    var list = item.svg.querySelectorAll('animate, animateTransform, animateMotion');
    item.played = true;
    item.svg.unpauseAnimations();
    for (var i = 0; i < list.length; i++) list[i].beginElement();
  }

  function setup(figure) {
    var svg = figure.querySelector('.m-fig-art svg');
    if (!svg || !svg.querySelector('[data-beat]') || typeof svg.pauseAnimations !== 'function') return false;
    var item = { svg: svg, played: false };
    var head = figure.querySelector('.m-fig-head');
    if (head) {
      var number = figure.querySelector('.m-fig-num');
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'm-fig-replay';
      button.textContent = 'Replay';
      button.setAttribute('aria-label', 'Replay the animation of ' + (number ? number.textContent : 'this figure'));
      button.addEventListener('click', function () { play(item); });
      head.appendChild(button);
    }
    figure.mMotion = item;
    return true;
  }

  function boot() {
    if (!root.classList.contains('m-motion')) return;
    if (typeof IntersectionObserver !== 'function') {
      root.classList.remove('m-motion');
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var item = entry.target.mMotion;
        if (!entry.isIntersecting) {
          item.svg.pauseAnimations();
          return;
        }
        if (!item.played && entry.intersectionRatio >= 0.3) play(item);
        else item.svg.unpauseAnimations();
      });
    }, { threshold: [0, 0.3] });
    var figures = document.querySelectorAll('.m-fig');
    for (var i = 0; i < figures.length; i++) if (setup(figures[i])) observer.observe(figures[i]);
    root.setAttribute('data-motion-ready', '');
  }

  function start() {
    try { boot(); } catch (_) { root.classList.remove('m-motion'); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
