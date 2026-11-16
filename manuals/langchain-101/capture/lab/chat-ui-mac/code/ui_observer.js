(() => {
  window.__marks = [];
  document.addEventListener('keydown', e => { if (e.key === 'Enter') window.__marks.push({t: Date.now(), kind: 'enter'}); }, true);
  document.addEventListener('click', e => { const b = e.target.closest('button'); if (b) window.__marks.push({t: Date.now(), kind: 'click', text: (b.innerText || b.getAttribute('aria-label') || '').slice(0, 40)}); }, true);
  let last = '';
  new MutationObserver(() => {
    const ai = [...document.querySelectorAll('div.group.mr-auto')];
    const txt = ai.map(n => n.innerText).join('\n||\n');
    if (txt !== last) { last = txt; window.__marks.push({t: Date.now(), kind: 'ai_dom', n: ai.length, len: txt.length, tail: txt.slice(-80)}); }
  }).observe(document.body, {subtree: true, childList: true, characterData: true});
  return 'observer installed';
})()
