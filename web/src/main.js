/**
 * Boot + hash router.
 *
 * Routes:
 *   #/                          today
 *   #/library                   all phases
 *   #/phase/<phase-id>          one phase
 *   #/lesson/<phase-id>/<slug>  the player
 *   #/review                    spaced repetition queue
 *   #/progress                  stats
 */

import { h, clear, scrollTop, focusMain } from './lib/dom.js';
import * as store from './lib/store.js';
import { loadCatalog, loadLesson, nextLesson } from './lib/content.js';
import { header, footer } from './shell.js';
import { todayView } from './views/today.js';
import { libraryView } from './views/library.js';
import { phaseView } from './views/phase.js';
import { lessonView } from './views/lesson.js';
import { reviewView } from './views/review.js';
import { progressView } from './views/progress.js';
import { roadmapView } from './views/roadmap.js';

const app = document.getElementById('app');

let catalog = null;
let headerRef = null;
let renderToken = 0;

document.documentElement.dataset.theme = store.getState().theme;

store.subscribe(() => headerRef?.refresh());

function currentPath() {
  return (location.hash.replace(/^#/, '') || '/').replace(/\/+$/, '') || '/';
}

function loading() {
  return h(
    'main',
    { class: 'page' },
    h('div', { class: 'empty' }, h('h3', null, 'Loading'), h('p', null, 'Reading the curriculum.')),
  );
}

function errorView(error) {
  return h(
    'main',
    { class: 'page page--narrow' },
    h(
      'div',
      { class: 'empty' },
      h('h3', null, 'Content is missing'),
      h('p', null, String(error?.message ?? error)),
      h(
        'p',
        { class: 'meta' },
        'The app expects web/public/content/. Run “node scripts/build-content.mjs” from web/.',
      ),
      h('a', { class: 'btn', href: '#/' }, 'Try again'),
    ),
  );
}

async function render() {
  const token = ++renderToken;
  const path = currentPath();

  if (!catalog) {
    clear(app);
    app.appendChild(loading());
    try {
      catalog = await loadCatalog();
    } catch (error) {
      clear(app);
      app.appendChild(errorView(error));
      return;
    }
    if (token !== renderToken) return;
  }

  const isLesson = path.startsWith('/lesson/');
  let view;
  let title = 'Workbench';

  try {
    if (path === '/' || path === '') {
      view = todayView(catalog);
      title = 'Today · Workbench';
    } else if (path === '/library') {
      view = libraryView(catalog);
      title = 'Library · Workbench';
    } else if (path === '/roadmap') {
      view = roadmapView(catalog);
      title = 'Roadmap · Workbench';
    } else if (path.startsWith('/phase/')) {
      const phaseId = decodeURIComponent(path.slice('/phase/'.length));
      view = phaseView(catalog, phaseId);
      title = `${phaseId} · Workbench`;
    } else if (isLesson) {
      const id = decodeURIComponent(path.slice('/lesson/'.length));
      const lesson = await loadLesson(id);
      if (token !== renderToken) return;
      view = await lessonView(catalog, lesson, {
        nextLesson: (lessonId) => nextLesson(catalog, lessonId),
      });
      title = `${lesson.title} · Workbench`;
    } else if (path === '/review') {
      view = reviewView(catalog);
      title = 'Review · Workbench';
    } else if (path === '/progress') {
      view = progressView(catalog);
      title = 'Progress · Workbench';
    } else {
      view = h(
        'main',
        { class: 'page page--narrow' },
        h(
          'div',
          { class: 'empty' },
          h('h3', null, 'Page not found'),
          h('p', null, 'That route does not exist in the workbench.'),
          h('a', { class: 'btn btn--primary', href: '#/' }, 'Back to today'),
        ),
      );
      title = 'Not found · Workbench';
    }
  } catch (error) {
    clear(app);
    app.appendChild(errorView(error));
    return;
  }

  if (token !== renderToken) return;

  document.title = title;
  clear(app);

  const main = h('main', null, view);

  if (isLesson) {
    app.appendChild(main);
    focusMain();
    return;
  }

  const head = header(path);
  headerRef = head;
  app.appendChild(head.el);
  app.appendChild(main);
  app.appendChild(footer());
  focusMain();
}

window.addEventListener('hashchange', () => {
  render();
  scrollTop();
});

render();
