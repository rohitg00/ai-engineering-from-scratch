'use strict';

function phaseSlug(directory) {
  return String(directory || '').replace(/^\d+-/, '');
}

function phasePath(slug) {
  return `/phase/${slug}`;
}

function phaseHubPath(lessonPath) {
  const match = /^phases\/([a-z0-9][a-z0-9-]*)\//.exec(lessonPath || '');
  return match ? phasePath(phaseSlug(match[1])) : '';
}

function phaseLabel(id, name) {
  return `Phase ${String(id).padStart(2, '0')}: ${name}`;
}

function termPath(slug) {
  return `/glossary/${slug}`;
}

function glossaryLookupKey(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .trim()
    .replace(/\s+/g, ' ');
}

module.exports = { phaseSlug, phasePath, phaseHubPath, phaseLabel, termPath, glossaryLookupKey };
