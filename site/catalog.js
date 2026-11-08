(function () {
  'use strict';

  var LESSON_PATH = /(phases\/[^/?#]+\/[^/?#]+)\/?$/;
  var LESSON_DIR = /phases\/[^/?#]+\/(\d+)-[^/?#]+\/?$/;

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function lessonPathFromUrl(url) {
    var match = String(url || '').match(LESSON_PATH);
    return match ? match[1] : '';
  }

  function lessonNumber(phaseId, url, position) {
    var match = String(url || '').match(LESSON_DIR);
    var lesson = match ? Number(match[1]) : Number(position) || 0;
    var phase = Number(phaseId) || 0;
    return { phase: phase, lesson: lesson, label: pad(phase) + '.' + pad(lesson) };
  }

  function compareLessonNumbers(a, b) {
    if (a.phase !== b.phase) return a.phase - b.phase;
    return a.lesson - b.lesson;
  }

  function completedPaths(state) {
    var done = Object.create(null);
    var lessons = state && state.lessons && typeof state.lessons === 'object' ? state.lessons : {};
    for (var path in lessons) {
      if (Object.prototype.hasOwnProperty.call(lessons, path) && lessons[path] && lessons[path].completedAt) {
        done[path] = true;
      }
    }
    return done;
  }

  function readCompletedPaths(progress) {
    var done = Object.create(null);
    var paths = progress ? progress.completedLessonPaths() : [];
    for (var i = 0; i < paths.length; i++) done[paths[i]] = true;
    return done;
  }

  function setLessonDone(progress, path, done) {
    if (!progress || !path) return;
    if (done) progress.markLessonComplete(path, 'learner');
    else progress.unmarkLessonComplete(path);
  }

  var api = {
    lessonPathFromUrl: lessonPathFromUrl,
    lessonNumber: lessonNumber,
    compareLessonNumbers: compareLessonNumbers,
    completedPaths: completedPaths,
    readCompletedPaths: readCompletedPaths,
    setLessonDone: setLessonDone
  };

  if (typeof window !== 'undefined') window.AIFSCatalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}());
