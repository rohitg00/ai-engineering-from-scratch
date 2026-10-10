(function () {
  'use strict';
  const text = (key, label, value) => ({ key, label, type: 'text', value });
  const span = (start, end) => ({ start, end });
  function union(intervals) {
    const result = [];
    for (const entry of intervals.slice().sort((a, b) => a.start - b.start)) {
      const last = result[result.length - 1];
      if (last && entry.start < last.end) last.end = Math.max(last.end, entry.end);
      else result.push({ ...entry });
    }
    return result;
  }
  function literalMatches(value, literal) {
    const chars = Array.from(value), needle = Array.from(literal), result = [];
    if (!needle.length) return result;
    for (let i = 0; i <= chars.length - needle.length; i += 1) {
      if (needle.every((character, j) => chars[i + j] === character)) result.push(span(i, i + needle.length));
    }
    return result;
  }
  window.AIFSProjectFigures.register('pj-sensitive-text-redaction-gate-1', {
    title: 'Locate every exact literal, including overlaps',
    steps: [{ label: 'Read', detail: 'Index Unicode characters.' }, { label: 'Match', detail: 'Compare each candidate start.' }, { label: 'Record', detail: 'Retain offsets without the source substring.' }],
    caption: 'This control illustrates the literal detector. Python also supplies the separately tested email and IPv4 detectors.',
    lab: { controls: [text('text', 'Input text', 'banana'), text('literal', 'Exact literal', 'ana')], calculate(values) {
      const matches = literalMatches(values.text, values.literal);
      return { summary: matches.length + ' exact matches; end offsets are exclusive.', metrics: [{ label: 'Characters', value: Array.from(values.text).length }, { label: 'Matches', value: matches.length }], columns: ['Start', 'End'], rows: matches.map(item => [item.start, item.end]) };
    } },
  });
  window.AIFSProjectFigures.register('pj-sensitive-text-redaction-gate-2', {
    title: 'Count overlapping characters once',
    steps: [{ label: 'Sort', detail: 'Read intervals by start offset.' }, { label: 'Merge', detail: 'Extend the current end for intersecting spans.' }, { label: 'Count', detail: 'Sum disjoint interval lengths.' }],
    caption: 'Adjacent intervals stay separate; intersecting intervals become their complete union.',
    lab: { controls: [{ key: 'start', label: 'Second start', type: 'range', min: 0, max: 8, value: 3, step: 1 }, { key: 'length', label: 'Second length', type: 'range', min: 1, max: 5, value: 3, step: 1 }], calculate(values) {
      const original = [span(1, 4), span(values.start, values.start + values.length)], merged = union(original);
      return { summary: original.length + ' detector spans become ' + merged.length + ' disjoint spans.', columns: ['Start', 'End'], rows: merged.map(item => [item.start, item.end]), metrics: [{ label: 'Characters removed', value: merged.reduce((total, item) => total + item.end - item.start, 0) }] };
    } },
  });
  window.AIFSProjectFigures.register('pj-sensitive-text-redaction-gate-3', {
    title: 'Advance through original offsets',
    steps: [{ label: 'Detect', detail: 'Find exact literal spans.' }, { label: 'Replace', detail: 'Append untouched gaps and replacement markers.' }, { label: 'Finish', detail: 'Append the suffix after the final original offset.' }],
    caption: 'Replacement length never changes the original coordinates.',
    lab: { controls: [text('text', 'Input text', '🌳 banana basket'), text('literal', 'Exact literal', 'ana')], calculate(values) {
      const chars = Array.from(values.text), merged = union(literalMatches(values.text, values.literal));
      let cursor = 0, output = '';
      for (const item of merged) { output += chars.slice(cursor, item.start).join('') + '[REDACTED]'; cursor = item.end; }
      output += chars.slice(cursor).join('');
      return { summary: output, metrics: [{ label: 'Replacement spans', value: merged.length }, { label: 'Original characters', value: chars.length }, { label: 'Output characters', value: Array.from(output).length }] };
    } },
  });
  window.AIFSProjectFigures.register('pj-sensitive-text-redaction-gate-4', {
    title: 'Distinguish coverage from a detector pass',
    steps: [{ label: 'Scan', detail: 'Run supported detectors.' }, { label: 'Export', detail: 'Write redacted records and offset receipts.' }, { label: 'Review', detail: 'Unsupported entity types can remain.' }],
    caption: 'Synthetic labeled counts measure this fixture only. A zero residual count is not proof of anonymization.',
    lab: { controls: [{ key: 'supported', label: 'Labeled supported entities', type: 'range', min: 0, max: 10, value: 4, step: 1 }, { key: 'unsupported', label: 'Labeled unsupported entities', type: 'range', min: 0, max: 10, value: 2, step: 1 }], calculate(values) {
      const total = values.supported + values.unsupported;
      return { summary: values.unsupported + ' unsupported entities remain for review.', metrics: [{ label: 'Removed', value: values.supported }, { label: 'Remaining', value: values.unsupported }, { label: 'Fixture coverage', value: total ? Math.round(values.supported / total * 100) + '%' : 'No labeled entities' }], bars: [{ label: 'Removed among labeled fixture entities', value: values.supported, max: Math.max(1, total) }] };
    } },
  });
})();
