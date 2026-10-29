const ID_RE = /^[a-z][a-z0-9-]{0,31}$/;
const LESSON_RE = /^(phases|certifications)\/[a-z0-9][a-z0-9/_.-]*$/;

const SHAPES = {
  box: 3,
  slab: 3,
  cylinder: 2,
  disc: 2,
  sphere: 1,
  capsule: 2,
  cone: 2,
  torus: 2,
};

const MATERIALS = new Set(['metal', 'brushed', 'plastic', 'glass', 'ceramic', 'rubber', 'glow']);
const TONES = new Set(['accent', 'ink', 'paper', 'steel', 'warn', 'copper', 'gold']);
const VIEWS = new Set(['iso', 'front', 'side', 'top']);

const DEFAULT_TONE = {
  metal: 'steel',
  brushed: 'steel',
  plastic: 'ink',
  glass: 'paper',
  ceramic: 'paper',
  rubber: 'ink',
  glow: 'accent',
};

const SPEC_KEYS = new Set(['title', 'fig', 'lesson', 'question', 'bigIdea', 'note', 'parts', 'flows', 'readouts', 'steps']);
const PART_KEYS = new Set(['id', 'label', 'explain', 'shape', 'size', 'at', 'rotate', 'material', 'tone', 'explode', 'group']);
const FLOW_KEYS = new Set(['id', 'from', 'to', 'label']);
const READOUT_KEYS = new Set(['id', 'label', 'value']);
const STEP_KEYS = new Set(['title', 'say', 'focus', 'flows', 'explode', 'view', 'readouts']);

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v) => typeof v === 'string';

function strField(obj, key, path, { req, min = 0, max = Infinity }, errors) {
  const p = path ? `${path}.${key}` : key;
  const v = obj[key];
  if (v === undefined) {
    if (req) errors.push(`${p}: missing`);
    return undefined;
  }
  if (!isStr(v)) {
    errors.push(`${p}: must be a string`);
    return undefined;
  }
  const t = v.trim();
  if (t.length < min || t.length > max) {
    errors.push(`${p}: must be ${min} to ${max} characters`);
    return undefined;
  }
  return t;
}

function numField(obj, key, path, { req, min = -Infinity, max = Infinity }, errors) {
  const p = path ? `${path}.${key}` : key;
  const v = obj[key];
  if (v === undefined) {
    if (req) errors.push(`${p}: missing`);
    return undefined;
  }
  if (!isNum(v)) {
    errors.push(`${p}: must be a number`);
    return undefined;
  }
  if (v < min || v > max) {
    errors.push(`${p}: must be between ${min} and ${max}`);
    return undefined;
  }
  return v;
}

function vecField(obj, key, path, { req, min, max }, errors) {
  const p = path ? `${path}.${key}` : key;
  const v = obj[key];
  if (v === undefined) {
    if (req) errors.push(`${p}: missing`);
    return undefined;
  }
  if (!Array.isArray(v) || v.length !== 3 || v.some((n) => !isNum(n))) {
    errors.push(`${p}: needs 3 numbers`);
    return undefined;
  }
  let ok = true;
  v.forEach((n, i) => {
    if (n < min || n > max) {
      errors.push(`${p}[${i}]: must be between ${min} and ${max}`);
      ok = false;
    }
  });
  return ok ? v : undefined;
}

function unknownKeys(obj, allowed, path, errors) {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) errors.push(`${path ? `${path}.` : ''}${key}: unknown key`);
  }
}

function idField(obj, path, used, errors) {
  const v = obj.id;
  if (v === undefined) {
    errors.push(`${path}.id: missing`);
    return undefined;
  }
  if (!isStr(v) || !ID_RE.test(v.trim())) {
    errors.push(`${path}.id: "${v}" is not a valid id`);
    return undefined;
  }
  const id = v.trim();
  if (used.has(id)) {
    errors.push(`${path}.id: "${id}" is already used by ${used.get(id)}`);
    return undefined;
  }
  used.set(id, path);
  return id;
}

const hasId = (map, id) => map.has(id);

export function checkMachine(input) {
  const errors = [];
  if (!isObj(input)) {
    return { ok: false, errors: ['spec: must be a JSON object'], spec: null };
  }
  unknownKeys(input, SPEC_KEYS, '', errors);

  const title = strField(input, 'title', '', { req: true, min: 1, max: 60 }, errors);
  const fig = strField(input, 'fig', '', { req: false, max: 16 }, errors);
  const lessonRaw = strField(input, 'lesson', '', { req: false, max: 120 }, errors);
  if (lessonRaw !== undefined && !LESSON_RE.test(lessonRaw)) {
    errors.push(`lesson: "${lessonRaw}" is not a lesson path`);
  }
  const question = strField(input, 'question', '', { req: true, min: 1, max: 200 }, errors);
  const bigIdea = strField(input, 'bigIdea', '', { req: true, min: 1, max: 320 }, errors);
  const note = strField(input, 'note', '', { req: false, max: 200 }, errors);

  const partIds = new Map();
  const flowIds = new Map();
  const readoutIds = new Map();

  const partsIn = input.parts;
  const parts = [];
  if (partsIn === undefined) {
    errors.push('parts: missing');
  } else if (!Array.isArray(partsIn)) {
    errors.push('parts: must be an array');
  } else {
    if (partsIn.length < 1 || partsIn.length > 48) {
      errors.push(`parts: must have 1 to 48 items`);
    }
    partsIn.forEach((p, i) => {
      const path = `parts[${i}]`;
      if (!isObj(p)) {
        errors.push(`${path}: must be an object`);
        return;
      }
      unknownKeys(p, PART_KEYS, path, errors);
      const id = idField(p, path, partIds, errors);
      if (id) partIds.set(id, path);
      const label = strField(p, 'label', path, { req: true, min: 1, max: 32 }, errors);
      const explain = strField(p, 'explain', path, { req: true, min: 1, max: 240 }, errors);
      const shape = strField(p, 'shape', path, { req: true }, errors);
      if (shape !== undefined && !SHAPES[shape]) {
        errors.push(`${path}.shape: "${shape}" is not a shape`);
      }
      const okShape = shape !== undefined && SHAPES[shape];
      const sizeIn = p.size;
      let size;
      if (sizeIn === undefined) {
        errors.push(`${path}.size: missing`);
      } else if (okShape) {
        const need = SHAPES[shape];
        if (!Array.isArray(sizeIn) || sizeIn.length !== need || sizeIn.some((n) => !isNum(n))) {
          errors.push(`${path}.size: a ${shape} needs ${need} number${need === 1 ? '' : 's'}`);
        } else {
          let ok = true;
          sizeIn.forEach((n, j) => {
            if (n < 0.02 || n > 20) {
              errors.push(`${path}.size[${j}]: must be between 0.02 and 20`);
              ok = false;
            }
          });
          if (shape === 'torus' && ok && sizeIn[1] >= sizeIn[0]) {
            errors.push(`${path}.size: tube must be smaller than radius`);
            ok = false;
          }
          if (ok) size = sizeIn;
        }
      } else if (!Array.isArray(sizeIn) || sizeIn.some((n) => !isNum(n))) {
        errors.push(`${path}.size: must be a list of numbers`);
      }
      const at = vecField(p, 'at', path, { req: true, min: -30, max: 30 }, errors);
      const rotate = vecField(p, 'rotate', path, { req: false, min: -360, max: 360 }, errors);
      const material = strField(p, 'material', path, { req: true }, errors);
      if (material !== undefined && !MATERIALS.has(material)) {
        errors.push(`${path}.material: "${material}" is not a material`);
      }
      const tone = strField(p, 'tone', path, { req: false }, errors);
      if (tone !== undefined && !TONES.has(tone)) {
        errors.push(`${path}.tone: "${tone}" is not a tone`);
      }
      const explode = vecField(p, 'explode', path, { req: false, min: -30, max: 30 }, errors);
      const group = strField(p, 'group', path, { req: false, max: 24 }, errors);
      parts.push({
        id,
        label,
        explain,
        shape: okShape ? shape : undefined,
        size,
        at,
        rotate: rotate || [0, 0, 0],
        material: material !== undefined && MATERIALS.has(material) ? material : undefined,
        tone: tone !== undefined && TONES.has(tone) ? tone : undefined,
        explode: explode || [0, 0, 0],
        group,
      });
    });
  }

  const flowsIn = input.flows;
  const flows = [];
  if (flowsIn !== undefined) {
    if (!Array.isArray(flowsIn)) {
      errors.push('flows: must be an array');
    } else {
      if (flowsIn.length > 24) errors.push('flows: must have at most 24 items');
      flowsIn.forEach((f, i) => {
        const path = `flows[${i}]`;
        if (!isObj(f)) {
          errors.push(`${path}: must be an object`);
          return;
        }
        unknownKeys(f, FLOW_KEYS, path, errors);
        const id = idField(f, path, flowIds, errors);
        if (id) flowIds.set(id, path);
        const from = strField(f, 'from', path, { req: true }, errors);
        if (from !== undefined && !partIds.has(from)) {
          errors.push(`${path}.from: "${from}" is not a part id`);
        }
        const to = strField(f, 'to', path, { req: true }, errors);
        if (to !== undefined) {
          if (!partIds.has(to)) {
            errors.push(`${path}.to: "${to}" is not a part id`);
          } else if (from !== undefined && from === to) {
            errors.push(`${path}.to: same part as from`);
          }
        }
        const label = strField(f, 'label', path, { req: false, max: 40 }, errors);
        flows.push({ id, from, to, label });
      });
    }
  }

  const readoutsIn = input.readouts;
  const readouts = [];
  if (readoutsIn !== undefined) {
    if (!Array.isArray(readoutsIn)) {
      errors.push('readouts: must be an array');
    } else {
      if (readoutsIn.length > 6) errors.push('readouts: must have at most 6 items');
      readoutsIn.forEach((r, i) => {
        const path = `readouts[${i}]`;
        if (!isObj(r)) {
          errors.push(`${path}: must be an object`);
          return;
        }
        unknownKeys(r, READOUT_KEYS, path, errors);
        const id = idField(r, path, readoutIds, errors);
        if (id) readoutIds.set(id, path);
        const label = strField(r, 'label', path, { req: true, min: 1, max: 24 }, errors);
        const value = strField(r, 'value', path, { req: true, min: 1, max: 24 }, errors);
        readouts.push({ id, label, value });
      });
    }
  }

  const stepsIn = input.steps;
  const steps = [];
  if (stepsIn === undefined) {
    errors.push('steps: missing');
  } else if (!Array.isArray(stepsIn)) {
    errors.push('steps: must be an array');
  } else {
    if (stepsIn.length < 1 || stepsIn.length > 10) {
      errors.push('steps: must have 1 to 10 items');
    }
    stepsIn.forEach((s, i) => {
      const path = `steps[${i}]`;
      if (!isObj(s)) {
        errors.push(`${path}: must be an object`);
        return;
      }
      unknownKeys(s, STEP_KEYS, path, errors);
      const stitle = strField(s, 'title', path, { req: true, min: 1, max: 32 }, errors);
      const say = strField(s, 'say', path, { req: true, min: 1, max: 280 }, errors);
      const focusIn = s.focus;
      const focus = [];
      if (focusIn !== undefined) {
        if (!Array.isArray(focusIn)) {
          errors.push(`${path}.focus: must be an array`);
        } else {
          if (focusIn.length > 12) errors.push(`${path}.focus: must have at most 12 items`);
          focusIn.forEach((fid, j) => {
            if (!isStr(fid) || !partIds.has(fid.trim())) {
              errors.push(`${path}.focus[${j}]: "${fid}" is not a part id`);
            } else {
              focus.push(fid.trim());
            }
          });
        }
      }
      const sFlowsIn = s.flows;
      const sFlows = [];
      if (sFlowsIn !== undefined) {
        if (!Array.isArray(sFlowsIn)) {
          errors.push(`${path}.flows: must be an array`);
        } else {
          sFlowsIn.forEach((fid, j) => {
            if (!isStr(fid) || !flowIds.has(fid.trim())) {
              errors.push(`${path}.flows[${j}]: "${fid}" is not a flow id`);
            } else {
              sFlows.push(fid.trim());
            }
          });
        }
      }
      const explode = numField(s, 'explode', path, { req: false, min: 0, max: 1 }, errors);
      const view = strField(s, 'view', path, { req: false }, errors);
      if (view !== undefined && !VIEWS.has(view)) {
        errors.push(`${path}.view: "${view}" is not a view`);
      }
      const sReadoutsIn = s.readouts;
      const sReadouts = {};
      if (sReadoutsIn !== undefined) {
        if (!isObj(sReadoutsIn)) {
          errors.push(`${path}.readouts: must be an object`);
        } else {
          for (const [rid, rv] of Object.entries(sReadoutsIn)) {
            if (!readoutIds.has(rid)) {
              errors.push(`${path}.readouts.${rid}: "${rid}" is not a readout id`);
            } else if (!isStr(rv) || rv.trim().length < 1 || rv.trim().length > 24) {
              errors.push(`${path}.readouts.${rid}: must be a string of 1 to 24 characters`);
            } else {
              sReadouts[rid] = rv.trim();
            }
          }
        }
      }
      steps.push({
        title: stitle,
        say,
        focus,
        flows: sFlows,
        explode: explode === undefined ? 0 : explode,
        view: view !== undefined && VIEWS.has(view) ? view : 'iso',
        readouts: sReadouts,
      });
    });
  }

  if (errors.length) return { ok: false, errors, spec: null };

  const spec = {
    title,
    question,
    bigIdea,
    parts: parts.map((p) => {
      const out = {
        id: p.id,
        label: p.label,
        explain: p.explain,
        shape: p.shape,
        size: p.size,
        at: p.at,
        rotate: p.rotate,
        material: p.material,
        tone: p.tone || DEFAULT_TONE[p.material],
        explode: p.explode,
      };
      if (p.group !== undefined) out.group = p.group;
      return out;
    }),
    flows: flows.map((f) => {
      const out = { id: f.id, from: f.from, to: f.to };
      if (f.label !== undefined) out.label = f.label;
      return out;
    }),
    readouts: readouts.map((r) => ({ id: r.id, label: r.label, value: r.value })),
    steps,
  };
  if (fig !== undefined) spec.fig = fig;
  if (lessonRaw !== undefined) spec.lesson = lessonRaw;
  if (note !== undefined) spec.note = note;
  return { ok: true, errors: [], spec };
}
