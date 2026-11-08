---
id: embodied-computer-use
title: Embodied VLAs and Computer-Use Agents
code: EC
subtitle: Action formats for robots, GUI action schemas, safety gates and bounded agent loops for browsers and desktops.
hue: 28
sources: phases/12-multimodal-ai/21-embodied-vlas-openvla-pi0-groot, phases/12-multimodal-ai/25-multimodal-agents-computer-use, phases/14-agent-engineering/21-computer-use-agents, phases/15-autonomous-systems/11-browser-agents, projects/browser-agent, projects/desktop-control
source_hash: ed62e605dc94b3cc
---

## Key terms
type: concepts
from: phases/12-multimodal-ai/21-embodied-vlas-openvla-pi0-groot/docs/en.md, phases/12-multimodal-ai/25-multimodal-agents-computer-use/docs/en.md, phases/14-agent-engineering/21-computer-use-agents/docs/en.md, phases/15-autonomous-systems/11-browser-agents/docs/en.md

- **VLA**: one model takes image and instruction and outputs action commands.
- **Action tokenization**: quantize each joint target into 256 bins. Each bin is a vocab ID.
- **FAST**: DCT plus quantize. A 30-step trajectory becomes ~10 tokens.
- **Flow-matching head**: small transformer outputs a 50-step action sequence via rectified flow.
- **System 1 / System 2**: large VLM plans slowly. Small action head acts quickly.
- **GUI grounding**: model outputs (x, y) for the target of an instruction on a screenshot.
- **Hybrid agent**: uses screenshot and accessibility tree together.
- **Read/write boundary**: reading is never consequential. A write needs fresh approval.

## VLA action formats
type: comparison
from: phases/12-multimodal-ai/21-embodied-vlas-openvla-pi0-groot/docs/en.md, phases/12-multimodal-ai/21-embodied-vlas-openvla-pi0-groot/code/main.py
span: 2

| Factor | RT-2 | OpenVLA | π0 | GR00T N1 |
|---|---|---|---|---|
| Pattern | PaLM-X + discrete bin | Llama 7B + discrete bin | flow-matching head | dual-system humanoid |
| Action output | 10 tokens per step | 256 bins per dim | continuous 50-step sequence | subgoals, then joint commands |
| Rate | 3-5 Hz | 4-5 Hz on an A100 | effectively 50 Hz | ~1 Hz plan, 50-100 Hz act |
| Web to robot mix | ~1:1 | ~0.5:1 | similar | sim-to-real data |
| Weights | closed | open | open | open |

## Action tokenizers in code
type: annotated-code
lang: python
from: phases/12-multimodal-ai/21-embodied-vlas-openvla-pi0-groot/code/main.py

```python
tokens = discretize(action, bins=256)          # [-1,1]^D to D integer bins
idx = int((a + 1) / 2 * (bins - 1))            # then clamp to 0..bins-1
recovered = undiscretize(tokens, bins=256)     # bin width = 2/255 ~ 0.0078
fast_tokens = fast_compress(trajectory, keep_coeff=4)  # per-dim DCT, bins=32
coeffs = dct(series)[:keep_coeff]              # keep low-frequency terms
continuous_flow_count = 1                      # single head output
```

## Multimodal agent loop
type: flow
from: phases/12-multimodal-ai/25-multimodal-agents-computer-use/docs/en.md, phases/12-multimodal-ai/25-multimodal-agents-computer-use/code/main.py, phases/14-agent-engineering/21-computer-use-agents/docs/en.md

1. **Agent**: take a screenshot of the browser.
2. **VLM**: parse screenshot, URL and goal into a plan.
3. **VLM**: emit one structured JSON action per step.
4. **Safety**: assess each action before execution. Reject unsafe actions.
5. **Wrapper**: `apply_action(state, action)` returns the new state.
6. **Agent**: observe the next screenshot. Repeat until `done`.

## GUI action schema
type: task-table
from: phases/12-multimodal-ai/25-multimodal-agents-computer-use/code/main.py, phases/12-multimodal-ai/25-multimodal-agents-computer-use/docs/en.md

| Task | Code |
|---|---|
| Click a target | `"click": ["x", "y", "element_desc"]` |
| Type text | `"type":  ["text", "x", "y"]` |
| Scroll | `"scroll": ["direction", "amount"]` |
| Drag | `"drag": ["x0", "y0", "x1", "y1"]` |
| Pick an option | `"select": ["option_index"]` |
| Go to a URL | `"navigate": ["url"]` |
| Crop and zoom | `"screenshot_region": ["x0", "y0", "x1", "y1"]` |
| End the task | `"done": ["success", "explanation"]` |

## Browser agent receipt
type: architecture
from: projects/browser-agent/solution/main.ts, projects/browser-agent/solution/pixels.py, projects/browser-agent/API.md

```arch
node | task | 1,1 | Task | name, email, allowedOrigin | client
node | loop | 2,1 | runAgent | maxSteps = 5 | process
node | choose | 3,1 | choose | fill, click, done, blocked | process
node | driver | 1,2 | Driver | observe, act, capture | client
node | png | 2,2 | inspectPNG | pixels.py greenFraction | process
node | out | 3,2 | Receipt | status, trace, visual | store
edge | task | loop |
edge | loop | choose | Observation
edge | driver | loop | observe
edge | loop | png | capture
edge | png | out | > 0.0005
edge | choose | out | blocked
```

## Run the projects
type: command-table
from: projects/browser-agent/README.md, projects/desktop-control/README.md
span: 2

| Command | What it does |
|---|---|
| `python3 scripts/project_test.py browser-agent --init learning-artifacts/browser-agent` | Make a starter workspace. It fails until you implement it |
| `python3 scripts/project_test.py browser-agent --all --path learning-artifacts/browser-agent --strict` | Grade all stages of your workspace |
| `node cli.ts --task samples/contact.json --output browser-run.json` | Run the offline form task and save the receipt |
| `node cli.ts --task samples/contact.json --live` | Drive real Chromium. Set BROWSE_BIN first |
| `rustc --edition 2021 cli.rs -o desktop-cli` | Build the desktop action runner |
| `./desktop-cli samples/actions.tsv desktop-frames` | Run six TSV actions. Writes PPM frames and trace.txt |

## Defaults and limits
type: defaults
from: projects/browser-agent/solution/main.ts, projects/browser-agent/solution/cli.ts, projects/desktop-control/solution/main.rs, projects/desktop-control/solution/cli.rs, projects/desktop-control/README.md

| Setting | Default | Note |
|---|---|---|
| `maxSteps` | 5 | Must be an integer from 1 to 100 |
| `max_steps` | 8 | CLI step budget from the task file |
| `greenFraction` | 0.0005 | Above it the status is complete |
| `submitLabel` | Save request | Button must be unique, enabled, not dangerous |
| `max_calls` | 32 | CLI cap. `Controller::new` refuses 0 or above 100 |
| Text length | 200 | Desktop type refuses empty or control characters |
| `scale` | 1.0 | Fixture frame. Valid range above 0 to 4.0 |
| Command timeout | 20000 | Milliseconds for each gstack browse call |

## Errors and fixes
type: troubleshooting
from: projects/browser-agent/solution/main.ts, projects/browser-agent/API.md, projects/desktop-control/solution/main.rs, projects/desktop-control/README.md

| Symptom | Cause | Fix |
|---|---|---|
| `origin changed` | Page URL left `allowedOrigin` | Keep the run on the allowed loopback origin |
| `missing or ambiguous field` | Label matches zero or two fields | Use exact unique labels |
| `completion values disagree` | done is true but a value differs | Do not trust the success banner |
| `unsafe or ambiguous submit` | Button is dangerous, disabled or not unique | Give one safe submit button |
| `stalled` | Observation repeats after an action | Check that the driver applies the action |
| `screenshot-error` | Capture or PNG check failed | CLI exits with status 2. Fix the image |
| `stale frame` | Click generation is not the last capture | Capture again and use its generation |
| `action budget exhausted` | Calls reached `max_calls` | Raise the budget or cut actions |

## Injection defenses
type: comparison
from: phases/15-autonomous-systems/11-browser-agents/code/main.py, phases/15-autonomous-systems/11-browser-agents/docs/en.md

| Page | naive | sanitizer | rw_boundary |
|---|---|---|---|
| Benign | posts ok | posts ok | posts ok |
| Visible-text injection | posts to /api/exfil | catches it | blocks the write |
| URL-fragment injection | posts to /api/exfil | misses it | blocks the write |
| Weak point | follows page text | does not inspect URLs | needs correct content origin |

## Numbers to know
type: concepts
from: phases/12-multimodal-ai/21-embodied-vlas-openvla-pi0-groot/docs/en.md, phases/14-agent-engineering/21-computer-use-agents/docs/en.md, phases/15-autonomous-systems/11-browser-agents/docs/en.md, phases/12-multimodal-ai/25-multimodal-agents-computer-use/docs/en.md

- **Control budget**: 30 Hz control loop means 33ms budget per action.
- **Open X-Embodiment**: 970k trajectories across 22 robots for OpenVLA.
- **Robot adaptation**: LoRA fine-tuning on 100-1000 task-specific demos.
- **OpenAI CUA at launch**: OSWorld 38.1%, WebArena 58.1%, WebVoyager 87%.
- **Gemini 2.5 Computer Use**: browser-only, 13 actions, ~70% Online-Mind2Web.
- **WebArena-Verified**: fixes ~11.3% false negatives. Hard subset has 258 tasks.
- **AgentVista**: frontier models 27-40%. Open models 10-20%.

## Questions
type: qa
from: phases/12-multimodal-ai/21-embodied-vlas-openvla-pi0-groot/docs/en.md, phases/14-agent-engineering/21-computer-use-agents/docs/en.md, phases/15-autonomous-systems/11-browser-agents/docs/en.md

- **Why co-fine-tune?** Robot-only models fail on out-of-distribution instructions.
- **What counts as permission?** Only direct user instructions. Screenshots and DOM text are untrusted.
- **Can a filter fix prompt injection?** No. Defenses raise the cost. They do not close the class.

## Safety tips
type: tips
from: phases/12-multimodal-ai/21-embodied-vlas-openvla-pi0-groot/docs/en.md, phases/14-agent-engineering/21-computer-use-agents/docs/en.md, phases/15-autonomous-systems/11-browser-agents/docs/en.md

- Put joint, velocity and workspace limits outside the VLA as control-layer checks.
- Run a per-step safety classifier before every action.
- Ask a human before login, purchase or file delete.
- Allow only the tools that the task needs.
- Run browser sessions with scoped credentials only.
