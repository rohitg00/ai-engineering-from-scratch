'use strict';

const fs = require('fs');
const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');

const text = fs.readFileSync(path.join(__dirname, '../../capture/out/33-store.txt'), 'utf8');
const after = (heading, from = 0) => {
  const at = text.indexOf('\n[', text.indexOf(heading, from)) + 1;
  return JSON.parse(text.slice(at, text.indexOf('\n]', at) + 2));
};
const namespaces = after('list_namespaces():');
const shallow = after('list_namespaces(max_depth=2):');
const found = after("search(('users', 'ada')):");
const filtered = after("search(('users',), filter=...):");
const items = [...found, ...filtered].map(([ns, key, value]) => ({ ns: ns.join('/'), key, value: value.text || value.value }));
const lab = JSON.parse(fs.readFileSync(path.join(__dirname, '../../capture/lab/summary/stores-mac.json'), 'utf8'));
const partial = Object.entries(lab.backends).filter(([, b]) => b.cases && "search(('users','ali')) partial label" in b.cases);
if (!partial.length || partial.some(([, b]) => b.cases["search(('users','ali')) partial label"].length)) throw new Error('fig-4-4: a partial label matched in the lab');

const users = [...new Set(namespaces.map(ns => ns[1]))];
const leaves = namespaces.map(ns => ({ user: ns[1], name: ns[2], path: ns.join('/') }));
const CX = { 'users/ada/memories': 112, 'users/ada/settings': 306, 'users/grace/memories': 520 };
const userX = user => {
  const xs = leaves.filter(l => l.user === user).map(l => CX[l.path]);
  return (Math.min(...xs) + Math.max(...xs)) / 2;
};

module.exports = figure('fig-4-4', {
  height: 388,
  title: 'The namespaces of the kit store',
  desc: `A tree of the namespace labels that list_namespaces returned: users, then ${users.join(' and ')}, then ${leaves.map(l => `${l.name} under ${l.user}`).join(', ')}. Under each namespace are its items with their key and value: ${items.map(i => `${i.key} "${i.value}" in ${i.ns}`).join(', ')}. A shaded area covers ada and its two namespaces: search with the prefix users, ada returned those ${found.length} items. A dashed line under the second row shows where list_namespaces with max_depth 2 stops, at ${shallow.length} namespaces. A note says that a partial label such as ali matched nothing in ${partial.length} store backends in the lab.`,
}, f => {
  const adaLeaves = leaves.filter(l => l.user === 'ada');
  const left = Math.min(...adaLeaves.map(l => CX[l.path])) - 100;
  const right = Math.max(...adaLeaves.map(l => CX[l.path])) + 100;
  f.rect(left, 82, right - left, 252, { fill: color('teal-fill'), stroke: color('teal-ink'), dash: 'dashed' });
  f.text(left + 10, 324, `search(('users', 'ada')): ${found.length} items`, { size: 11.5, hue: 'teal', weight: 700 });

  const root = f.box({ x: 320, y: 12, w: 120, h: 30, hue: 'grey', title: 'users', anchor: 'middle', titleSize: 12 });
  const join = (from, to) => f.path(`M${from.cx} ${from.y + from.h} V${to.y - 10} H${to.cx} V${to.y - 1}`, { style: 'call', head: false });
  const userBox = {};
  users.forEach(user => {
    userBox[user] = f.box({ x: userX(user), y: 96, w: 120, h: 30, hue: 'violet', title: user, anchor: 'middle', titleSize: 12 });
    join(root, userBox[user]);
  });
  f.rule(20, 140, 620, 140, { hue: 'ink-mute', dash: 'dashed' });
  f.text(30, 153, `max_depth=2: ${shallow.length} namespaces`, { size: 11, hue: 'ink-soft' });
  leaves.forEach(leaf => {
    const box = f.box({ x: CX[leaf.path], y: 168, w: 140, h: 30, hue: 'teal', title: leaf.name, anchor: 'middle', titleSize: 12 });
    join(userBox[leaf.user], box);
    items.filter(item => item.ns === leaf.path).forEach((item, k) => {
      const y = 216 + k * 36;
      if (!k) f.rule(CX[leaf.path], 198, CX[leaf.path], y, { hue: 'teal' });
      f.rect(CX[leaf.path] - 92, y, 184, 30, { fill: color('paper'), stroke: color('teal-ink') });
      f.text(CX[leaf.path] - 84, y + 13, `key ${item.key}`, { size: 11, weight: 700, hue: 'teal' });
      f.text(CX[leaf.path] - 84, y + 26, item.value, { size: 11, serif: true, hue: 'ink-soft' });
    });
  });
  f.text(20, 362, `The namespace is a tuple of full labels. A search for ('users', 'ali') returned nothing`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 378, `in each of the ${partial.length} backends of the lab, because a label never matches part of another.`, { size: 11, serif: true, hue: 'ink-soft' });
});
