# Multimodal Agents and Computer-Use (Capstone)

> The 2026 frontier product is a multimodal agent that reads screenshots, clicks buttons, navigates web UIs, fills forms, and completes workflows end-to-end. SeeClick and CogAgent (2024) proved the GUI-grounding primitive. Ferret-UI added mobile. ChartAgent introduced visual tool-use for charts. VisualWebArena and AgentVista (2026) are the benchmarks the frontier chases — and even Gemini 3 Pro and Claude Opus 4.7 score ~30% on AgentVista's hard tasks. This capstone pulls together every thread of Phase 12: perception (high-res VLM), reasoning (LLM with tool use), grounding (coordinate output), long-horizon memory, and evaluation.

**Type:** Capstone
**Languages:** Python (stdlib, action schema + agent loop skeleton)
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 12 · 09 (Qwen-VL JSON), Phase 14 (Agent Engineering)
**Time:** ~240 minutes

## Learning Objectives

- Design a multimodal agent loop: perceive → reason → act → observe → repeat.
- Build a GUI grounding output schema (click coordinates, type text, scroll, drag) the VLM can emit as JSON.
- Compare screenshot-only agents vs accessibility-tree agents vs hybrid agents.
- Set up a multimodal agent benchmark evaluation on a small VisualWebArena slice.

## The Problem

A booking-site workflow: "find me a flight to Tokyo for April 15, aisle seat under $800, book it."

A multimodal agent needs to:

1. Take a screenshot of the browser.
2. Parse the screenshot + URL + goal into a plan.
3. Emit a structured action: click (at x,y), type "Tokyo" (at element E), scroll down, select (radio button).
4. Apply the action to the browser.
5. Observe the new state (next screenshot).
6. Repeat until the task is done.

Each step is a multimodal VLM call. The VLM output must be parseable JSON. Errors compound across steps, so recovery matters.

## The Concept

### GUI grounding — the primitive

GUI grounding is: given a screenshot and a natural language instruction, output the (x, y) coordinate to click (or other action).

SeeClick (arXiv:2401.10935) was the first open result at scale: fine-tune a VLM on synthetic + real GUI data, output coordinates as plain text tokens. Works.

CogAgent (arXiv:2312.08914) added 1120x1120 high-resolution encoding for dense UIs. Score: ~84% on web navigation.

Ferret-UI (arXiv:2404.05719) focuses on mobile UIs, integrates with iOS accessibility data.

Output format is usually JSON:

```json
{"action": "click", "x": 384, "y": 220, "element_desc": "Search button"}
```

The `element_desc` helps recovery: if coordinates drift between screenshots, the semantic hint lets the system re-ground.

### Action schemas

A typical action schema has 6-10 action types:

- `click`: (x, y)
- `type`: (text, x?, y?)
- `scroll`: (direction, amount)
- `drag`: (x0, y0, x1, y1)
- `select`: (option_index)
- `hover`: (x, y)
- `navigate`: (url)
- `wait`: (ms)
- `done`: (success, explanation)

The agent emits one action per step. The browser wrapper executes and returns the new state.

### Screenshot-only vs accessibility-tree

Two input modes:

- Screenshot-only: full image, no structural info. Most general; works on any app.
- Accessibility tree: structured DOM / iOS accessibility info. Much more reliable for grounding; works where the tree is available.
- Hybrid: both, with the tree as a reliable grounder for atomic actions and the screenshot for semantic context.

Production agents use hybrid when possible. Browser automation (Selenium + accessibility) always has the tree; desktop apps sometimes do.

### Long-horizon memory

A 20-step workflow generates 20 screenshots. The VLM's context fills up fast. Three compression strategies:

- Summary-chain: after every 5 steps, summarize what has happened, drop old screenshots.
- Skip-frame: keep the first, last, and every 3rd screenshot.
- Tool-recorded log: execute actions, keep a text log of what was done; don't re-look at old screenshots.

Claude's computer-use API uses the log pattern. Simpler, more reliable.

### Visual tool use

ChartAgent (arXiv:2510.04514) introduces visual tool use for chart understanding: crop, zoom, OCR, call external detection. The agent can output "crop to region (100, 200, 300, 400) then call OCR" as a tool call. The tool returns text; the VLM continues reasoning.

This pattern generalizes: set-of-mark prompting, region annotation, and external detection tools all fit the same "output a tool call, receive a structured response" schema.

### The 2026 benchmarks

- ScreenSpot-Pro. GUI grounding on ~1k web screenshots. Open SOTA Qwen2.5-VL-72B ~85%. Frontier ~90%.
- VisualWebArena. End-to-end web tasks (shop, forum, classifieds). Open SOTA ~20%. Gemini 3 Pro ~27%.
- AgentVista (arXiv:2602.23166). The hardest 2026 benchmark. Realistic workflows across 12 domains. Frontier models score 27-40%; open models 10-20%.
- WebArena / WebShop. Older benchmarks; saturated by frontier.

### Why it's still hard

Agent performance bottlenecks:

1. Visual grounding at fine scale. "Click the small X" fails often at mobile resolution.
2. Long-horizon planning. After 10 actions, the agent drifts from the goal.
3. Error recovery. When a click fails (wrong button), detecting + recovering is rarely trained data.
4. Cross-page context. Jumping between tabs or long forms loses state.

Research directions: memory architectures, explicit replanning, multimodal verification (screenshot match for action success).

### The capstone build-it

The capstone task: build a computer-use agent that:

1. Reads the HTML + screenshot of a booking-site mock page.
2. Plans a multi-step sequence: search → select → fill form → submit.
3. Emits JSON actions matching the action schema.
4. Evaluates on a fixed 10-task slice.

The lesson provides scaffold code that is easy to extend into a real browser.

## Use It

`code/main.py` is the capstone scaffold:

- Action schema JSON definition (10 actions).
- Mock browser state as dict.
- Agent loop skeleton: receive state, emit action, apply, loop.
- 10-task mini-benchmark (synthetic pages) to measure end-to-end success rate.
- Error-recovery hook for when an action fails.

## Ship It

This lesson produces `outputs/skill-multimodal-agent-designer.md`. Given a computer-use product (domain, action set, evaluation target), designs the full agent loop, memory strategy, grounding mode, and expected benchmark score.

## Exercises

1. Extend the action schema with a `screenshot_region` tool (crop + zoom). What tasks benefit?

2. Read AgentVista (arXiv:2602.23166). Describe the hardest task category and why frontier models still fail.

3. Long-horizon memory compression: design a summary-chain with ≤4 screenshots kept live, any number logged.

4. Build an error-recovery hook: on action failure (button not found), what does the agent do next?

5. Compare screenshot-only Claude 4.7 to hybrid screenshot + accessibility-tree Qwen2.5-VL on 10 web tasks. Which wins on which tasks?

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| GUI grounding | "Click coordinates" | Model outputs (x,y) for the target of an instruction on a screenshot |
| Action schema | "Tool definitions" | JSON description of valid actions (click, type, scroll, drag) |
| Accessibility tree | "Structured DOM" | Machine-readable UI hierarchy from browser/iOS APIs |
| Hybrid agent | "Screenshot + tree" | Uses both image and structured info; more reliable than either alone |
| Visual tool use | "Zoom/crop/detect" | Agent calls external vision tools (OCR, detection) mid-plan |
| Summary-chain | "Memory compression" | Periodic text summaries replace long screenshot history |
| VisualWebArena | "E2E web bench" | 2024 benchmark for end-to-end web tasks |
| AgentVista | "2026 hard bench" | 12-domain realistic workflows; even Gemini 3 Pro scores ~30% |

## Further Reading

- [Cheng et al. — SeeClick (arXiv:2401.10935)](https://arxiv.org/abs/2401.10935)
- [Hong et al. — CogAgent (arXiv:2312.08914)](https://arxiv.org/abs/2312.08914)
- [You et al. — Ferret-UI (arXiv:2404.05719)](https://arxiv.org/abs/2404.05719)
- [ChartAgent (arXiv:2510.04514)](https://arxiv.org/abs/2510.04514)
- [Koh et al. — VisualWebArena (arXiv:2401.13649)](https://arxiv.org/abs/2401.13649)
- [AgentVista (arXiv:2602.23166)](https://arxiv.org/abs/2602.23166)
