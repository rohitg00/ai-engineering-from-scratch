'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const agent = load(path.join(__dirname, '../../capture/lab/summary/demos-x86.json')).stateful_agent;
const after = kind => agent[kind].turns.find(turn => turn.phase === 'resumed');
const memory = after('memory');
const volumes = after('volumes');
const rows = [
  ['conversation', `${memory.memory_turns} of ${memory.db_turns} messages`, true, `${volumes.memory_turns} of ${volumes.db_turns} messages`, true],
  ['loaded from SQLite at start', `${memory.rehydrated_from_db} messages`, true, `${volumes.rehydrated_from_db} messages`, true],
  ['note in a variable', memory.note ? 'kept' : 'lost', Boolean(memory.note), volumes.note ? 'kept' : 'lost', Boolean(volumes.note)],
  ['file under /tmp', memory.scratch_file ? 'kept' : 'lost', memory.scratch_file, volumes.scratch_file ? 'kept' : 'lost', volumes.scratch_file],
  ['age of the process', `${memory.process_age_s} s, same process`, true, `${volumes.process_age_s} s, new process`, false],
  ['time of this turn', `${memory.seconds.toFixed(2)} s`, true, `${volumes.seconds.toFixed(2)} s`, false],
];

module.exports = figure('fig-9-2', {
  height: 318,
  title: 'What the agent holds on the first turn after a suspend, under each fidelity',
  desc: `Two columns for the same agent on its first turn after a suspend, on the second x86 server guest. Under memory fidelity it holds ${memory.memory_turns} messages, its note, its file under /tmp, and the same process at ${memory.process_age_s} seconds of age, and the turn took ${memory.seconds.toFixed(2)} seconds. Under volumes fidelity it holds ${volumes.memory_turns} messages because it loaded ${volumes.rehydrated_from_db} from SQLite, it lost the note and the file, the process is ${volumes.process_age_s} seconds old, and the turn took ${volumes.seconds.toFixed(2)} seconds.`,
}, f => {
  const left = 214;
  const right = 430;
  f.box({ x: left, y: 16, w: 196, h: 40, hue: 'green', title: 'memory fidelity', sub: 'SNAPSHOT_FIDELITY_MEMORY' });
  f.box({ x: right, y: 16, w: 196, h: 40, hue: 'teal', title: 'volumes fidelity', sub: 'SNAPSHOT_FIDELITY_VOLUMES' });
  rows.forEach(([name, a, aOk, b, bOk], index) => {
    const y = 72 + index * 40;
    f.rule(16, y - 6, 626, y - 6, { hue: 'ink-mute', opacity: 0.25 });
    f.text(16, y + 16, name, { size: 12, weight: 700 });
    f.dot(left + 10, y + 12, { hue: aOk ? 'green' : 'rose', r: 4 });
    f.text(left + 22, y + 16, a, { size: 11.5, hue: aOk ? 'green' : 'rose' });
    f.dot(right + 10, y + 12, { hue: bOk ? 'green' : 'rose', r: 4 });
    f.text(right + 22, y + 16, b, { size: 11.5, hue: bOk ? 'green' : 'rose' });
  });
});
