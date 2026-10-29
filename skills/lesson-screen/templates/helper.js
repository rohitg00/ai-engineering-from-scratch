(function () {
  var screen = location.pathname.split('/').filter(Boolean).pop() || 'screen';

  function send(evt) {
    try {
      return fetch('/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ screen: screen }, evt)),
      }).then(function (res) { return res.ok; }, function () { return false; });
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  window.lessonScreen = { screen: screen, send: send };

  document.addEventListener('click', function (e) {
    var choice = e.target && e.target.closest ? e.target.closest('[data-question] [data-choice]') : null;
    if (choice) {
      var q = choice.closest('[data-question]');
      var siblings = q.querySelectorAll('.ls-choice.is-picked, [data-choice].is-picked');
      Array.prototype.forEach.call(siblings, function (el) {
        el.classList.remove('is-picked');
      });
      choice.classList.add('is-picked');
      var sent = q.querySelector('.ls-sent');
      if (!sent) {
        sent = document.createElement('p');
        sent.className = 'ls-sent';
        sent.setAttribute('role', 'status');
        sent.setAttribute('aria-live', 'polite');
        q.appendChild(sent);
      }
      var ticket = (q._lsTicket || 0) + 1;
      q._lsTicket = ticket;
      sent.textContent = 'Sending to your tutor.';
      send({
        type: 'choice',
        question: q.getAttribute('data-question') || '',
        choice: choice.getAttribute('data-choice') || '',
        text: (choice.textContent || '').trim().slice(0, 500),
      }).then(function (ok) {
        if (q._lsTicket !== ticket) return;
        sent.textContent = ok ? 'Sent to your tutor. You can also answer in the terminal.' : 'Not sent. Give your answer in the terminal.';
      });
      return;
    }
    var part = e.target && e.target.closest ? e.target.closest('[data-part]') : null;
    if (part) {
      send({
        type: 'part',
        part: part.getAttribute('data-part') || '',
        label: part.getAttribute('data-label') || (part.textContent || '').trim().slice(0, 500),
      });
    }
  });

  window.addEventListener('storage', function (e) {
    if (e.key !== 'theme' && e.key !== null) return;
    var t = localStorage.getItem('theme');
    if (t !== 'light' && t !== 'dark') {
      t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', t);
  });
})();
