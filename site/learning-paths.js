(function () {
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function savedTheme() {
    try {
      var value = localStorage.getItem('theme');
      return value === 'light' || value === 'dark' ? value : null;
    } catch (error) {
      return null;
    }
  }

  function systemTheme() {
    return media && media.matches ? 'dark' : 'light';
  }

  function updateThemeIcon() {
    var icon = document.getElementById('themeIcon');
    var button = document.getElementById('themeToggle');
    var theme = root.getAttribute('data-theme');
    if (icon) icon.textContent = theme === 'light' ? 'N' : 'D';
    if (button) button.setAttribute('aria-label', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    updateThemeIcon();
  }

  function storeTheme(theme) {
    try {
      localStorage.setItem('theme', theme);
    } catch (error) {}
  }

  function careerGuideFromHash(hash) {
    if (!hash || hash.indexOf('#career-route-') !== 0) return null;
    var id = '';
    try {
      id = decodeURIComponent(hash.slice(1));
    } catch (error) {
      return null;
    }
    var guide = document.getElementById(id);
    return guide && guide.matches('details.career-guide') ? guide : null;
  }

  function syncCareerChoice(guide) {
    document.querySelectorAll('[data-career-choice]').forEach(function (link) {
      if (guide && link.getAttribute('href') === '#' + guide.id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  function careerScrollBehavior() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  }

  function closeOtherCareerGuides(activeGuide) {
    document.querySelectorAll('details.career-guide').forEach(function (guide) {
      if (guide !== activeGuide) guide.open = false;
    });
  }

  function revealCareerGuide(hash, moveFocus) {
    var guide = careerGuideFromHash(hash);
    if (!guide) return false;
    closeOtherCareerGuides(guide);
    guide.open = true;
    syncCareerChoice(guide);
    window.requestAnimationFrame(function () {
      var summary = guide.querySelector('summary');
      if (moveFocus && summary) {
        try {
          summary.focus({ preventScroll: true });
        } catch (error) {
          summary.focus();
        }
      }
      guide.scrollIntoView({
        behavior: careerScrollBehavior(),
        block: 'start'
      });
    });
    return true;
  }

  applyTheme(savedTheme() || systemTheme());

  document.addEventListener('DOMContentLoaded', function () {
    var button = document.getElementById('themeToggle');
    if (button) {
      updateThemeIcon();
      button.addEventListener('click', function () {
        var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        applyTheme(next);
        storeTheme(next);
      });
    }

    document.querySelectorAll('[data-career-choice]').forEach(function (link) {
      link.addEventListener('click', function (event) {
        var hash = link.getAttribute('href');
        if (!careerGuideFromHash(hash)) return;
        event.preventDefault();
        if (window.location.hash === hash) revealCareerGuide(hash, true);
        else window.location.hash = hash;
      });
    });

    if (!revealCareerGuide(window.location.hash, false)) syncCareerChoice(null);
  });

  window.addEventListener('hashchange', function () {
    if (!revealCareerGuide(window.location.hash, true)) syncCareerChoice(null);
  });

  window.addEventListener('storage', function (event) {
    if (event.key === 'theme') applyTheme(savedTheme() || systemTheme());
  });

  if (media) {
    var syncSystemTheme = function () {
      if (!savedTheme()) applyTheme(systemTheme());
    };
    if (typeof media.addEventListener === 'function') media.addEventListener('change', syncSystemTheme);
    else if (typeof media.addListener === 'function') media.addListener(syncSystemTheme);
  }
})();
