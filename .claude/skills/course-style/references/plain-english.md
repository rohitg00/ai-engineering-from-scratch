# Plain technical English

Course prose follows a short set of rules taken from Simplified Technical English. Each rule is a test that a reviewer or a script can run on the text. The manual audit and the skill file test apply the same rules.

## What the rules cover

The rules apply to every prose line: paragraphs, list items, headings, table cells, captions, figure titles, figure descriptions, and text inside figures.

These parts are exempt:

- inline code spans and fenced code blocks
- quoted text in straight or curly double quotes
- citations such as `{{spec §4.1}}`

## Limits

| Unit | Limit |
|---|---|
| sentence | at most 25 words |
| instruction, takeaway, or step | at most 20 words, imperative mood |
| thesis | one sentence, at most 30 words |
| figure claim | one sentence, at most 28 words, ends with a period |
| paragraph | one topic, at most six sentences |

A word is any run of letters, digits, and the characters `$ % . ' / -`. The splitter does not end a sentence after `e.g.`, `i.e.`, `vs.`, `etc.`, `approx.`, `Fig.`, `No.`, `U.S.`, `Inc.`, `Dr.`, `Mr.`, `Ms.`, or `p.`.

## Punctuation and grammar

1. Use no em dash and no en dash. Use a colon, a comma, or a period.
2. Use no semicolon. Split the sentence.
3. Use no contractions. Write "do not", "it is", "you are".
4. Never write "may". Write "can", or state the condition.
5. Write instructions in the imperative: "Run the audit", not a description of a person who runs it.
6. Prefer the active voice and the simple present tense.
7. Use one word for one meaning. Define a term once and use it the same way everywhere.
8. Write to one reader in the second person.

## Banned words

Each row lists the banned forms and the plain word to use. The forms are in code spans, so this file passes its own check.

### Figurative words

| Banned | Use instead |
|---|---|
| `wire`, `wires`, `wired`, `wiring` | the request, the response, the stream, the network, connect |
| `stick`, `sticks`, `sticky`, `sticking`, `stuck` | stay, remain, keep |
| `glue`, `plumbing` | name the code |
| `knob`, `knobs` | the setting, the option |
| `gotcha`, `gotchas`, `footgun`, `footguns` | the defect, the trap, the error |
| `under the hood` | inside, internally |
| `escape hatch` | the override, the option |
| `sharp edge`, `sharp edges` | the limit, the defect |
| `first-class`, `first class` | built in, supported |
| `out of the box` | by default |
| `heavy lifting` | the main work |
| `moving parts` | parts, components |
| `sweet spot` | the best value, the range |
| `deep dive`, `deep-dive` | a detailed look |

### Verb phrases

| Banned | Use instead |
|---|---|
| `boil down`, `boils down` | reduce to, is |
| `spin up`, `spins up`, `spinning up`, `spun up` | start, create |
| `kick off`, `kicks off`, `kicked off`, `kicking off` | start |
| `bake in`, `baked in`, `baked` | include, build in |
| `fall back`, `falls back`, `falling back`, `fallback`, `fallbacks` | use instead, the default, the second choice |

### Nouns used as verbs

| Banned | Use instead |
|---|---|
| `gate`, `gates`, `gated`, `gating` | allow, block, require, check |
| `surface`, `surfaces`, `surfaced`, `surfacing` | show, return, report. As a noun, write "panel" or "area" |
| `fronts`, `fronted`, `fronting` | put before, serve |
| `land`, `lands`, `landed`, `landing` | arrive, merge, appear |
| `ship`, `ships`, `shipped`, `shipping` | release, publish, include |
| `fan out`, `fan-out`, `fans out`, `fanned out` | send to many, start in parallel |
| `catch`, `catches`, `catching` | find, detect, handle |
| `in flight`, `in-flight` | running, not finished |
| `out of band`, `out-of-band` | outside the protocol, separate |
| `bare` | plain |
| `hand off`, `hands off`, `handed off`, `hand over`, `hand to`, `handoff`, `handoffs` | send, give, pass |

### Stock AI words

| Banned | Use instead |
|---|---|
| `delve`, `delves`, `delving` | look at, read |
| `robust`, `robustly`, `robustness` | reliable, tested, strong |
| `seamless`, `seamlessly` | direct, without a break |
| `crucial`, `crucially` | necessary, required |
| `comprehensive`, `comprehensively` | full, complete |
| `landscape` | the field, the options |
| `tapestry` | delete it |
| `testament` | proof |
| `furthermore`, `moreover`, `additionally` | also, or start a new sentence |
| `leverage`, `leverages`, `leveraged`, `leveraging` | use |
| `actually` | delete it |
| `foster`, `fosters`, `fostered`, `fostering` | help, support |
| `garner`, `garners`, `garnered`, `garnering` | get, receive |
| `intricate`, `intricacies` | detailed, the details |
| `meticulous`, `meticulously` | careful, carefully |
| `quietly` | delete it, or say what happens |
| `showcase`, `showcases`, `showcased`, `showcasing` | show |
| `underscore`, `underscores`, `underscored`, `underscoring` | show, prove |
| `vibrant` | delete it |
| `enhance`, `enhances`, `enhanced`, `enhancing` | improve, add |
| `interplay` | the relation between |
| `align with`, `aligns with`, `aligned with` | match, follow |
| `enduring` | lasting, permanent |
| `bolster`, `bolsters`, `bolstered`, `bolstering` | support, add to |
| `highlight`, `highlights`, `highlighted`, `highlighting` | show, mark, point to |
| `valuable` | useful, or say what it gives |
| `journey` | the path, the steps |
| `unlock`, `unlocks`, `unlocked`, `unlocking` | allow, make possible |
| `supercharge` and its forms | delete it |

### Tells

The audit also flags these patterns in a sentence:

| Pattern | Example to avoid |
|---|---|
| "not X but Y" | `not just a cache but a store` |
| intensifiers | `crucially`, `importantly`, `notably`, `ultimately`, `essentially`, `fundamentally` |
| inflation | `game-changing`, `paradigm`, `pivotal`, `groundbreaking`, `revolutionary`, `unprecedented`, `cutting-edge` |
| avoiding "is" or "has" | `serves as`, `stands as`, `acts as a testament`, `underscores`, `highlights the` |
| staged run-up | `here is the thing`, `here is why`, `here is what` |

## Tone

- Write direct prose. Cut filler words and openers.
- Write no marketing claims and no superlatives.
- Use no emojis in headings or prose.
- Name the real system: the actual field, method, file, or number.

## Checker

Run this script on any Markdown file. It strips code spans, fenced code, and quotes, and then reports each hit with its line number. It reports zero lines when the file passes.

```javascript
#!/usr/bin/env node
'use strict';
const fs = require('fs');
const LEXICON = [
  /\bwir(e|es|ed|ing)\b/i,
  /\b(stick(s|y|ing)?|stuck)\b/i,
  /\b(glue|plumbing|knobs?|gotchas?|footguns?)\b/i,
  /\b(under the hood|escape hatch|sharp edges?|first[- ]class|out of the box|heavy lifting|moving parts|sweet spot|deep[- ]dive)\b/i,
  /\b(boils? down|spin(s|ning)? up|spun up|kick(s|ed|ing)? off|bak(e|es|ed|ing)[- ]in|baked|fall(s|ing)? back|fallbacks?)\b/i,
  /\b(gat(e|es|ed|ing)|surfac(e|es|ed|ing)|front(s|ed|ing)|land(s|ed|ing)?|ship(s|ped|ping)?|fan(s|ned|ning)?[- ]out|catch(es|ing)?)\b/i,
  /\b(in[- ]flight|out[- ]of[- ]band|bare|hand(s|ed|ing)? (off|over|to)|handoffs?)\b/i,
  /\b(delv(e|es|ing)|robust(ly|ness)?|seamless(ly)?|crucial(ly)?|comprehensive(ly)?|landscape|tapestry|testament|furthermore|moreover|leverag(e|es|ed|ing)|additionally|actually|foster(s|ed|ing)?|garner(s|ed|ing)?|intricate|intricacies|meticulous(ly)?|quietly|showcas(e|es|ed|ing)|underscor(e|es|ed|ing)|vibrant|enhanc(e|es|ed|ing)|interplay|align(s|ed)? with|enduring|bolster(s|ed|ing)?|highlight(s|ed|ing)?|valuable|journey|unlock(s|ed|ing)?|supercharg\w*)\b/i,
];
const CONTRACTION = /\b(\w+n['’]t|it['’]s|that['’]s|there['’]s|here['’]s|what['’]s|who['’]s|let['’]s|\w+['’]re|\w+['’]ve|\w+['’]ll|\w+['’]d|I['’]m)\b/i;
const text = fs.readFileSync(process.argv[2], 'utf8').replace(/^---\n[\s\S]*?\n---\n/, m => m.replace(/[^\n]/g, ''));
let fence = false;
text.split('\n').forEach((raw, i) => {
  if (/^\s*```/.test(raw)) { fence = !fence; return; }
  if (fence) return;
  const line = raw.replace(/`[^`]*`/g, '').replace(/[“"][^”"]*[”"]/g, '');
  const hit = rule => console.log(`${i + 1}: ${rule}: ${raw.trim().slice(0, 90)}`);
  if (/[—–]/.test(line)) hit('dash');
  if (line.includes(';')) hit('semicolon');
  if (/\bmay\b/i.test(line)) hit('may');
  if (CONTRACTION.test(line)) hit('contraction');
  for (const pattern of LEXICON) { const m = pattern.exec(line); if (m) hit(`word "${m[0]}"`); }
  for (const s of line.split(/(?<=[.!?])\s+(?=[A-Z0-9])/)) {
    const words = (s.match(/[\w$%.'/-]+/g) || []).length;
    if (words > 25) hit(`${words} words`);
  }
});
```

The script checks the 25-word limit only. Count instruction and paragraph limits by hand, or extend the script for your file type.
