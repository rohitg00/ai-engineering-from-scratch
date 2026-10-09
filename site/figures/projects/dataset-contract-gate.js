(function () {
  'use strict';
  const range = (key, label, value, max) => ({ key, label, type: 'range', min: 0, max, step: 1, value });
  window.AIFSProjectFigures.register('pj-dataset-contract-gate-1', {
    title: 'Reject contradictory contracts before reading rows',
    steps: [{ label: 'Declare', detail: 'Name a field and its permitted numeric interval.' }, { label: 'Validate', detail: 'Require minimum no greater than maximum.' }, { label: 'Continue', detail: 'Only a valid contract can evaluate records.' }],
    caption: 'A bad policy is an input error, separate from a dataset quality failure.',
    lab: { controls: [range('min', 'Minimum tokens', 0, 20), range('max', 'Maximum tokens', 10, 20)], calculate(values) {
      return { summary: values.min <= values.max ? 'Valid contract interval.' : 'Invalid contract: minimum exceeds maximum.', metrics: [{ label: 'Minimum', value: values.min }, { label: 'Maximum', value: values.max }, { label: 'Interval width', value: Math.max(0, values.max - values.min) }] };
    } },
  });
  window.AIFSProjectFigures.register('pj-dataset-contract-gate-2', {
    title: 'Check types before comparing bounds',
    steps: [{ label: 'Read', detail: 'Parse the supplied JSON scalar.' }, { label: 'Type', detail: 'Require an integer without coercing strings or Booleans.' }, { label: 'Bound', detail: 'Accept integers from zero through ten.' }],
    caption: 'This stage models an integer field with min=0 and max=10.',
    lab: { controls: [{ key: 'value', label: 'JSON value', type: 'text', value: 'true' }], calculate(values) {
      let value;
      try { value = JSON.parse(values.value); } catch (_) { return { summary: 'Invalid JSON input.', metrics: [] }; }
      let rule = 'pass';
      if (typeof value !== 'number' || !Number.isSafeInteger(value)) rule = 'type';
      else if (value < 0) rule = 'min';
      else if (value > 10) rule = 'max';
      return { summary: 'Rule result: ' + rule, columns: ['Input', 'Runtime type', 'Result'], rows: [[values.value, typeof value, rule]] };
    } },
  });
  window.AIFSProjectFigures.register('pj-dataset-contract-gate-3', {
    title: 'Quarantine every duplicate member',
    steps: [{ label: 'Index', detail: 'Map keys to one-based row numbers.' }, { label: 'Group', detail: 'Keep groups with two or more rows.' }, { label: 'Mark', detail: 'Mark every member, including the first.' }],
    caption: 'Enter a JSON array of string IDs. Case remains significant.',
    lab: { controls: [{ key: 'ids', label: 'Record IDs', type: 'text', value: '["a","b","a","c"]' }], calculate(values) {
      let ids;
      try { ids = JSON.parse(values.ids); } catch (_) { return { summary: 'Enter a JSON array.', metrics: [] }; }
      if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) return { summary: 'Every ID must be a string.', metrics: [] };
      const index = new Map();
      ids.forEach((id, i) => { if (!index.has(id)) index.set(id, []); index.get(id).push(i + 1); });
      const groups = Array.from(index.values()).filter(rows => rows.length > 1);
      return { summary: groups.length + ' duplicate groups.', metrics: [{ label: 'Rows quarantined', value: groups.reduce((sum, rows) => sum + rows.length, 0) }], columns: ['Source rows'], rows: groups.map(rows => [rows.join(', ')]) };
    } },
  });
  window.AIFSProjectFigures.register('pj-dataset-contract-gate-4', {
    title: 'A clean partition can still fail the dataset gate',
    steps: [{ label: 'Partition', detail: 'Separate invalid rows from accepted rows.' }, { label: 'Dataset', detail: 'Check the original batch size.' }, { label: 'Gate', detail: 'Require no row issues and no dataset issues.' }],
    caption: 'The gate concerns the supplied batch. Exporting accepted rows does not erase its failures.',
    lab: { controls: [range('rows', 'Input rows', 4, 12), range('bad', 'Rows with issues', 3, 12), range('minimum', 'Minimum batch size', 1, 12)], calculate(values) {
      const bad = Math.min(values.bad, values.rows), accepted = values.rows - bad, failedSize = values.rows < values.minimum;
      return { summary: !bad && !failedSize ? 'PASS: the input batch satisfies both rules.' : 'FAIL: inspect row and dataset evidence.', metrics: [{ label: 'Accepted', value: accepted }, { label: 'Quarantined', value: bad }, { label: 'Minimum-size check', value: failedSize ? 'fail' : 'pass' }], bars: [{ label: 'Accepted rows', value: accepted, max: Math.max(1, values.rows) }, { label: 'Quarantined rows', value: bad, max: Math.max(1, values.rows) }] };
    } },
  });
})();
