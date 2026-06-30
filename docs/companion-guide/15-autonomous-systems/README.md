# Phase 15 — Autonomous Systems

## What is this phase about?
Phase 14 agents do a task and stop. This phase is about agents that run for **hours or days on their own** — improving themselves, writing code, doing research, browsing the web — and the **safety machinery** that keeps them from burning money, going rogue, or being hijacked. It's half "how far can autonomy go" and half "how do we keep it controlled."

## Why is this phase important?
Autonomous, long-running agents are the frontier of the field — and the riskiest part. Anyone building or deploying them needs to understand both the capabilities (self-improving systems, coding agents) and the guardrails (budgets, kill switches, safety policies). This is also where AI safety becomes a hands-on engineering topic, not just philosophy.

## What will I be able to build after this phase?
- Long-running agents that survive crashes and resume safely
- Cost governors, kill switches, and human-in-the-loop checkpoints
- An understanding of self-improving systems and their limits
- A working grasp of frontier safety policies and evaluation

## How important is this phase?
⭐⭐⭐⭐ Important. Essential if you'll deploy autonomous agents; valuable context even if you won't.

## Difficulty
Hard. Concepts are advanced (recursive self-improvement, alignment) and the safety material is dense, though not mathematical.

## Estimated Study Time
**16–24 hours** across 22 lessons. Lessons 01, 09–16 (the practical autonomy + safety engineering) are the core; 17–22 are important context on policies and evaluation.

---

# The Shift from Chatbots to Long-Horizon Agents

## Simple Definition
A chatbot answers once and forgets. A long-horizon agent runs a loop, decides when to stop, and spends real money and causes real side effects over a long run. As runs get longer, cost grows, errors compound per step, and it gets harder to verify what the agent actually did.

## Imagine This...
Like the difference between answering one email and running a week-long project unsupervised.

## Why Do We Need This?
- Real tasks span many steps, not one reply
- Long runs amplify cost and error
- Autonomy changes the whole risk profile

## Where Is It Used?
Coding agents, research agents, background automation.

## Do I Need to Master This?
🔴 Yes. This framing underlies the entire phase.

## In One Sentence
Long-horizon agents run multi-step loops over time, amplifying both capability and risk.

## What Should I Remember?
- Errors compound per step over long runs
- They spend real money and cause side effects
- Verification gets harder as runs grow

## Common Beginner Confusion
A long-horizon agent isn't just a slower chatbot — it's a different kind of system with different risks.

## What Comes Next?
Next: models that teach themselves to reason.

---

# STaR, V-STaR, Quiet-STaR — Self-Taught Reasoning

## Simple Definition
Teaching reasoning with human-written traces is slow and expensive. STaR has the model write its *own* reasoning, keep the rationales that lead to correct answers, and train on those — bootstrapping better reasoning without humans writing every step.

## Imagine This...
Like a student inventing their own worked examples, keeping the ones that get the right answer.

## Why Do We Need This?
- Human reasoning data is costly and limited
- Models can generate and self-grade rationales
- This bootstraps reasoning cheaply

## Where Is It Used?
Training reasoning models; self-improvement research.

## Do I Need to Master This?
🟢 Know the idea; it's research-leaning.

## In One Sentence
STaR lets a model improve its reasoning by generating and keeping its own correct rationales.

## What Should I Remember?
- The model writes and grades its own reasoning
- Keep traces that reach correct answers
- Scales beyond human-written data

## Common Beginner Confusion
It needs known answers to grade against — it's not magic self-improvement from nothing.

## What Comes Next?
Next: evolving code with an evaluator in the loop.

---

# AlphaEvolve — Evolutionary Coding Agents

## Simple Definition
LLMs write plausible-but-sometimes-wrong code; evolutionary search explores many programs but rarely produces working ones. AlphaEvolve combines them: the LLM proposes targeted edits, an automatic evaluator scores each, and high scorers become parents — catching the LLM's mistakes while exploring better programs over hours to weeks.

## Imagine This...
Like breeding plants: try many variants, keep the best performers, breed from them again.

## Why Do We Need This?
- LLMs alone confabulate code
- Evolution alone wastes effort on broken code
- Together they search for genuinely better programs

## Where Is It Used?
Algorithm discovery; optimization research (DeepMind).

## Do I Need to Master This?
🟢 Know the concept; it's advanced research.

## In One Sentence
AlphaEvolve evolves better code by pairing LLM edits with an automatic evaluator.

## What Should I Remember?
- LLM proposes, evaluator verifies
- High scorers seed the next generation
- An evaluator catches confabulation

## Common Beginner Confusion
The evaluator is essential — without it, the LLM's plausible-but-wrong code wins.

## What Comes Next?
Next: agents that rewrite their own code to improve.

---

# Darwin Gödel Machine — Open-Ended Self-Modifying Agents

## Simple Definition
Can an agent edit its own code to get better? The theoretical version required proving each edit helps (never achievable in practice). DGM drops the proof: keep an archive of agent variants and accept any edit whose measured score beats a bar — producing big real benchmark gains.

## Imagine This...
Like evolution itself: no proof a mutation helps, just keep whatever empirically survives better.

## Why Do We Need This?
- Self-improving agents could compound capability
- Proof-based improvement is impossible in practice
- Empirical acceptance makes it workable

## Where Is It Used?
Self-improvement research; agent scaffolding.

## Do I Need to Master This?
🟢 Know it as a landmark result.

## In One Sentence
The Darwin Gödel Machine improves agents by keeping empirically better self-edits, no proof required.

## What Should I Remember?
- Drops the impossible proof requirement
- Keeps an archive of variants
- Accept edits that clear a measured score bar

## Common Beginner Confusion
There's no guarantee each edit truly helps — it can even game its own evaluator (a real risk).

## What Comes Next?
Next: agents doing autonomous scientific research.

---

# AI Scientist v2 — Workshop-Level Autonomous Research

## Simple Definition
Research has no unit test for "correct" — papers are judged by reviewers. AI Scientist v2 closes the loop anyway: it generates ideas, runs experiments, makes figures, writes a paper, and iterates on critique — without the human-authored templates its first version needed.

## Imagine This...
Like a grad student who designs experiments, writes them up, and revises after feedback — autonomously.

## Why Do We Need This?
- Research is where compounding progress lives
- It's hard to automate without clear correctness
- Closing the loop is high-value

## Where Is It Used?
Autonomous research systems (Sakana AI).

## Do I Need to Master This?
🟢 Know it as a frontier capability demo.

## In One Sentence
AI Scientist v2 autonomously generates, runs, and writes up research with no fixed templates.

## What Should I Remember?
- Research lacks machine-checkable correctness
- It uses tree search plus critique loops
- It removes the need for human templates

## Common Beginner Confusion
Autonomous "research" isn't verified by tests — its quality is judged like a real paper, with all that uncertainty.

## What Comes Next?
Next: using AI to help with alignment research itself.

---

# Automated Alignment Research (Anthropic AAR)

## Simple Definition
Alignment research is bottlenecked by scarce human researchers, while AI capability races ahead. AAR explores whether the same frontier models can help close that gap by running alignment experiments themselves — a notable early example of AI contributing to its own safety research.

## Imagine This...
Like asking a fast-learning apprentice to help research how to keep apprentices safe.

## Why Do We Need This?
- Alignment work outpaces human capacity
- AI could accelerate safety research
- It's a strategy for keeping up with capability

## Where Is It Used?
Frontier-lab alignment research (Anthropic).

## Do I Need to Master This?
🟢 Know it as an emerging approach.

## In One Sentence
Automated Alignment Research uses frontier models to help conduct alignment research at scale.

## What Should I Remember?
- Alignment is bottlenecked by people
- AI can run alignment experiments
- One of the first deployed systems of its kind

## Common Beginner Confusion
Using AI for alignment is promising but circular-feeling — it raises its own trust questions.

## What Comes Next?
Next: the big question — does self-improvement run away?

---

# Recursive Self-Improvement — Capability vs Alignment

## Simple Definition
If each self-improvement cycle makes a system improve *faster* than the last, capability can shoot up. The key question: does alignment (staying on the intended goal) improve at the same rate? If alignment lags capability, the system gets powerful faster than it gets safe.

## Imagine This...
Like a car accelerating — fine if the brakes scale with the engine, dangerous if they don't.

## Why Do We Need This?
- Self-improvement could compound rapidly
- Safety must keep pace with capability
- This is a central AI-safety concern

## Where Is It Used?
AI safety theory; frontier-lab planning.

## Do I Need to Master This?
🟡 Understand the capability-vs-alignment race.

## In One Sentence
Recursive self-improvement is safe only if alignment compounds as fast as capability.

## What Should I Remember?
- The danger is a rate gap, not improvement itself
- Capability outpacing alignment is the risk
- Recent systems make this concrete, not just theory

## Common Beginner Confusion
The worry isn't smart AI per se — it's safety improving slower than capability.

## What Comes Next?
Next: how to put limits on self-improvement.

---

# Bounded Self-Improvement Designs

## Simple Definition
Self-improvement loops can game their own evaluators and compound small advantages into big gaps. This lesson covers design primitives that constrain such loops so the constraints *can't be silently weakened by the loop itself* — the engineering side of safe self-improvement.

## Imagine This...
Like building a thermostat the heater can't secretly rewire to ignore the temperature limit.

## Why Do We Need This?
- Loops can cheat their own checks
- Constraints must resist self-tampering
- Bounds make self-improvement safer

## Where Is It Used?
Safe self-improvement design; scaling policies.

## Do I Need to Master This?
🟢 Know the idea of tamper-resistant constraints.

## In One Sentence
Bounded self-improvement adds constraints a self-modifying loop can't weaken on its own.

## What Should I Remember?
- Loops may game their evaluators
- Constraints must be tamper-resistant
- This is referenced in real safety policies

## Common Beginner Confusion
A safety limit is only useful if the system can't quietly remove it — that's the hard part.

## What Comes Next?
Next: the practical state of autonomous coding agents.

---

# The Autonomous Coding Agent Landscape (2026)

## Simple Definition
"Which coding agent is best?" misses the point — the *scaffolding* (retrieval, planner, sandbox, edit-verify loop) matters as much as the model. The same model scored 43% on one scaffold and 60% on another. The base model is a component; the loop around it is the real product.

## Imagine This...
Like a great engine: its real-world performance depends heavily on the car built around it.

## Why Do We Need This?
- Scaffolding hugely affects reliability
- The same model varies widely by setup
- Choosing a loop matters more than the model

## Where Is It Used?
Evaluating and building coding agents (Claude Code, Cline, etc.).

## Do I Need to Master This?
🟡 Learn it — it reframes how you pick tools.

## In One Sentence
A coding agent's reliability comes mostly from its scaffolding, not just the base model.

## What Should I Remember?
- Scaffolding is load-bearing
- Same model, very different scores by loop
- "The loop is the product"

## Common Beginner Confusion
A better model won't fix a bad scaffold — the loop around it often matters more.

## What Comes Next?
Next: how Claude Code controls autonomy with permission modes.

---

# Claude Code as an Autonomous Agent: Permission Modes and Auto Mode

## Simple Definition
An autonomous coding agent on your machine can reach your files, network, and credentials — a serious attack surface. Claude Code's answer is a ladder of permission modes (plan → default → acceptEdits → … → bypassPermissions), trading speed for review per action, plus an Auto Mode that auto-approves only actions a classifier judges safe.

## Imagine This...
Like graduated driving licenses: more freedom as trust increases, with checks at each level.

## Why Do We Need This?
- An on-machine agent is a security category
- One on/off switch is too crude
- Graded modes balance speed and safety

## Where Is It Used?
Claude Code; any autonomous coding tool.

## Do I Need to Master This?
🟡 Learn it — directly relevant to using Claude Code well.

## In One Sentence
Permission modes give a ladder of speed-vs-review trade-offs for an autonomous coding agent.

## What Should I Remember?
- The agent can reach your whole machine
- Modes range from plan-only to bypass
- Auto Mode auto-approves only "safe" actions

## Common Beginner Confusion
"Autonomous" isn't all-or-nothing — there's a whole ladder of how much you let it do unattended.

## What Comes Next?
Next: agents that browse the untrusted web.

---

# Browser Agents and Long-Horizon Web Tasks

## Simple Definition
A browser agent reads untrusted web pages and takes real actions — so every page is potential attacker input, and every form a possible command channel. Real attacks (poisoned memory, hidden URL commands) show this is live, and indirect prompt injection "can't be fully patched" because reading and acting blur together.

## Imagine This...
Like an assistant who follows any instruction written on any sign they pass — even fake ones.

## Why Do We Need This?
- Web content is untrusted input
- Browser agents take consequential actions
- Injection attacks are real and hard to stop

## Where Is It Used?
Web-browsing agents (Comet, Operator, etc.).

## Do I Need to Master This?
🟡 Learn the risks before building or trusting one.

## In One Sentence
Browser agents read untrusted pages and act on them, making prompt injection a serious, unpatched risk.

## What Should I Remember?
- Every page is attacker-controllable input
- Injection lives at the read-vs-act boundary
- It can't be fully patched — defense in depth only

## Common Beginner Confusion
Browser agents are uniquely dangerous because they consume content written by attackers.

## What Comes Next?
Next: keeping long agents alive across crashes.

---

# Long-Running Background Agents: Durable Execution

## Simple Definition
An agent running for hours makes tool calls, prompts users, and bills LLM calls. If the host reboots mid-run, a naive loop loses everything and re-does side effects. Durable execution checkpoints progress so the agent resumes where it stopped instead of restarting and re-billing.

## Imagine This...
Like a download that resumes after a dropped connection instead of starting over.

## Why Do We Need This?
- Long runs will hit crashes and reboots
- Restarting re-runs side effects and re-bills
- Durability enables safe resumption

## Where Is It Used?
Background agents; long workflows (Temporal-style systems).

## Do I Need to Master This?
🔴 Yes — durability is essential for long-running agents.

## In One Sentence
Durable execution checkpoints an agent so it resumes after a crash instead of restarting.

## What Should I Remember?
- Naive loops lose everything on crash
- Resuming avoids re-running side effects
- Checkpoint progress, not just final state

## Common Beginner Confusion
A `while True` loop isn't production-safe — a crash means re-doing real, billed actions.

## What Comes Next?
Next: stopping an agent from spending too much.

---

# Action Budgets, Iteration Caps, and Cost Governors

## Simple Definition
Every agent turn costs real money; a bad loop is a bill, not just a bad reply ("Denial of Wallet"). The fix is a stack of limits at different scales — per-request, per-task, per-hour, per-day — so a runaway loop is caught in minutes and a slow leak in hours.

## Imagine This...
Like spending limits on a credit card: per-transaction, daily, and monthly caps together.

## Why Do We Need This?
- Runaway loops rack up real bills
- One limit can't catch every failure speed
- Layered caps catch fast and slow overspend

## Where Is It Used?
Every production autonomous agent.

## Do I Need to Master This?
🔴 Yes — cost control is mandatory for autonomy.

## In One Sentence
Cost governors are layered spending limits that stop runaway agents at every time scale.

## What Should I Remember?
- "Denial of Wallet" is a real failure mode
- Use limits per request, task, hour, day
- Layers catch both spikes and slow leaks

## Common Beginner Confusion
A single budget number isn't enough — you need limits at multiple time scales.

## What Comes Next?
Next: stopping harmful actions, not just spending.

---

# Kill Switches, Circuit Breakers, and Canary Tokens

## Simple Definition
Budgets limit spending but not damage — a cheap action can still leak a secret or delete a resource. This lesson covers detectors next to the cost layer: kill switches (stop now), circuit breakers (halt on repeated failure), and canary tokens (tripwires that fire when something is accessed).

## Imagine This...
Like a building's emergency stop button, fuse box, and silent alarm working together.

## Why Do We Need This?
- A harmful action can be cheap in tokens
- You need ways to halt instantly
- Tripwires detect misuse early

## Where Is It Used?
Production agent safety; incident response.

## Do I Need to Master This?
🔴 Yes — these are your emergency brakes.

## In One Sentence
Kill switches, circuit breakers, and canary tokens stop and detect harmful agent actions.

## What Should I Remember?
- Budgets don't bound damage, only cost
- Kill switch = stop; breaker = halt on failures
- Canary tokens are tripwires for misuse

## Common Beginner Confusion
The most damaging action is often the cheapest — cost limits won't catch it.

## What Comes Next?
Next: putting a human in the approval loop well.

---

# Human-in-the-Loop: Propose-Then-Commit

## Simple Definition
A synchronous "approve?" prompt gets rubber-stamped — users click fast and approvals mean little. Propose-then-commit makes structured review the path of least resistance: the agent proposes a clear, reviewable action, and committing it is a deliberate, auditable step.

## Imagine This...
Like signing a contract you actually read, versus clicking "I agree" without looking.

## Why Do We Need This?
- Instant approvals get rubber-stamped
- Structured review is more trustworthy
- A clear audit trail matters when things go wrong

## Where Is It Used?
Agents taking consequential actions with human oversight.

## Do I Need to Master This?
🟡 Learn it — better HITL design prevents real harm.

## In One Sentence
Propose-then-commit makes human review structured and meaningful instead of a reflexive click.

## What Should I Remember?
- Fast approvals predict little
- Make structured review the easy path
- Keep a real, recallable audit trail

## Common Beginner Confusion
A simple "approve?" prompt feels safe but is usually rubber-stamped into meaninglessness.

## What Comes Next?
Next: undoing actions that go wrong mid-flight.

---

# Checkpoints and Rollback

## Simple Definition
Durable execution makes a crashed agent resumable; propose-then-commit makes actions auditable. This lesson joins them: when an approved action runs partway, crashes, and resumes, checkpoints and rollback decide how to undo partial effects and restore a consistent state.

## Imagine This...
Like a bank transaction that fully completes or fully reverses — never leaving money in limbo.

## Why Do We Need This?
- Actions can fail partway through
- Partial effects leave inconsistent state
- Rollback restores consistency

## Where Is It Used?
Transactional agents; systems with side effects.

## Do I Need to Master This?
🟡 Learn it — crucial when actions have real consequences.

## In One Sentence
Checkpoints and rollback undo partial actions so a crashed agent leaves a consistent state.

## What Should I Remember?
- Partial execution is a real failure case
- Checkpoints mark safe restore points
- Rollback cleans up incomplete actions

## Common Beginner Confusion
Resuming isn't enough — you must also undo half-done side effects to stay consistent.

## What Comes Next?
Next: aligning agents to principles, not just rules.

---

# Constitutional AI and Rule Overrides

## Simple Definition
No rule list covers every situation an agent meets. Rule-based alignment is fast but always out of date; reason-based alignment encodes *principles* and lets the model reason about new cases. Constitutional AI uses principles so behavior generalizes to situations the designers never anticipated.

## Imagine This...
Like teaching values ("be honest, avoid harm") instead of memorizing a rule for every possible scene.

## Why Do We Need This?
- Rule lists can't cover the long tail
- Principles generalize to unseen cases
- It scales alignment across novel inputs

## Where Is It Used?
Claude's training; principle-based safety.

## Do I Need to Master This?
🟡 Understand rules-vs-principles trade-offs.

## In One Sentence
Constitutional AI aligns models to principles so behavior generalizes beyond a fixed rule list.

## What Should I Remember?
- Rules are auditable but go stale
- Principles generalize but are harder to audit
- Failure shifts from "missed rule" to "misapplied principle"

## Common Beginner Confusion
You can't list every disallowed thing — principles are what handle the cases you didn't foresee.

## What Comes Next?
Next: fast classifiers that filter inputs and outputs.

---

# Llama Guard and Input/Output Classification

## Simple Definition
A classifier layer sits at the narrowest point — every request and response passes through. Tools like Llama Guard and NeMo Guardrails are fast, taxonomy-based filters that catch a lot of obvious misuse cheaply. They complement, not replace, a model's built-in safety.

## Imagine This...
Like a metal detector at the entrance: quick screening that catches the obvious threats.

## Why Do We Need This?
- A cheap filter catches obvious misuse
- Every request/response passes one point
- It adds a safety layer for little cost

## Where Is It Used?
Production LLM apps; safety pipelines.

## Do I Need to Master This?
🟡 Learn it — a practical, common safety layer.

## In One Sentence
Llama Guard-style classifiers cheaply filter inputs and outputs to catch obvious misuse.

## What Should I Remember?
- Classifiers are fast, taxonomy-based filters
- They pair with, don't replace, model safety
- A bad classifier is false security

## Common Beginner Confusion
A classifier layer isn't full safety — it catches the obvious, not the clever, and shouldn't be your only defense.

## What Comes Next?
Next: how labs decide when to pause scaling.

---

# Anthropic Responsible Scaling Policy v3.0

## Simple Definition
Frontier labs publish scaling policies — part technical, part governance, part regulator signal — defining when to gate or pause a model. RSP v3.0 is Anthropic's current one. Reading the v2→v3 diff (what was added, removed, reframed) shows how a policy can get more polished yet less rigorous.

## Imagine This...
Like a company's safety manual — its real meaning is in what changed between editions.

## Why Do We Need This?
- Scaling policies shape how labs handle risk
- The version diff reveals priorities
- They signal to regulators and the public

## Where Is It Used?
AI governance; frontier-lab risk management.

## Do I Need to Master This?
🟢 Read it for literacy; know the key changes.

## In One Sentence
RSP v3.0 is Anthropic's scaling policy, best understood by what changed from v2.

## What Should I Remember?
- Policies are technical *and* political documents
- v3.0 added roadmaps but dropped the pause commitment
- External reviewers downgraded its rigor score

## Common Beginner Confusion
A more polished policy isn't necessarily a stronger one — read the diff, not the gloss.

## What Comes Next?
Next: how OpenAI and DeepMind compare.

---

# OpenAI Preparedness Framework and DeepMind Frontier Safety Framework

## Simple Definition
OpenAI's and DeepMind's safety frameworks are cousins of Anthropic's, answering the same question — when to pause or gate a model. They converge (all track long-range autonomy and deception) and diverge (how they categorize risk and what each category triggers).

## Imagine This...
Like three companies' fire codes — same goal, different thresholds and rules.

## Why Do We Need This?
- Multiple labs shape the safety landscape
- Comparing reveals shared concerns
- The differences have real consequences

## Where Is It Used?
AI governance; cross-lab risk comparison.

## Do I Need to Master This?
🟢 Know the convergence and key divergences.

## In One Sentence
OpenAI's and DeepMind's frameworks track similar risks to Anthropic's but categorize and trigger differently.

## What Should I Remember?
- All three track autonomy and deception
- They split risk categories differently
- Which "bucket" a capability lands in changes the response

## Common Beginner Confusion
The frameworks agree more on *what* to watch than on *what to do* about it.

## What Comes Next?
Next: who actually measures these capabilities.

---

# METR Time Horizons and External Capability Evaluation

## Simple Definition
Scaling policies reference thresholds that only mean something once measured. METR is an external org that evaluates frontier models (often pre-release) and publishes the numbers. Its Time Horizon benchmark compresses capability into one human-legible figure: the length of task a model can do at 50% reliability.

## Imagine This...
Like an independent crash-test lab giving cars a single comparable safety rating.

## Why Do We Need This?
- Policy thresholds need real measurements
- Independent evaluation adds credibility
- A single scalar makes capability legible

## Where Is It Used?
External model evaluation; safety thresholds.

## Do I Need to Master This?
🟢 Know what METR and time horizons are.

## In One Sentence
METR externally measures model capability, notably as a "time horizon" of doable task length.

## What Should I Remember?
- METR evaluates models independently
- Time horizon = task length at 50% reliability
- Policies become actionable via such numbers

## Common Beginner Confusion
"Time horizon" isn't how long the model runs — it's the human-effort length of tasks it can handle.

## What Comes Next?
Next: civil-society and government perspectives.

---

# CAIS, CAISI, and Societal-Scale Risk

## Simple Definition
Beyond labs and evaluators, civil-society and government bodies shape AI-risk discussion. CAIS is a non-profit publishing risk frameworks and coordinating public statements; CAISI is a US government center (within NIST) running voluntary lab agreements and evaluations. Similar names, very different missions.

## Imagine This...
Like the difference between an advocacy non-profit and a government safety agency — both about risk, different roles.

## Why Do We Need This?
- Society and government shape AI policy
- Public discourse sets the baseline
- Knowing both bodies aids literacy

## Where Is It Used?
AI policy; regulatory baseline-setting.

## Do I Need to Master This?
🟢 Know who they are and the difference.

## In One Sentence
CAIS (non-profit) and CAISI (US government) both address AI risk but with distinct missions.

## What Should I Remember?
- CAIS = non-profit framework/advocacy
- CAISI = government center within NIST
- The names rhyme; the roles don't overlap

## Common Beginner Confusion
CAIS and CAISI are easy to mix up but are entirely different organizations.

## What Comes Next?
Phase 16 turns to many agents working together — multi-agent systems and swarms.

---

## Phase Summary

**What I learned.** What changes when agents run long and autonomously: self-improving systems (STaR, AlphaEvolve, DGM) and their limits, the autonomous coding landscape, and the full safety stack — durable execution, cost governors, kill switches, human-in-the-loop, rollback, classifiers — plus the frontier safety policies and evaluators that govern it all.

**What I should remember.** Autonomy amplifies cost and risk per step. Scaffolding often matters more than the model. Safety needs layered, tamper-resistant controls, and the most damaging action is often the cheapest. Alignment must keep pace with capability.

**Most important lessons.** 🔴 Long-Horizon Agents, Durable Execution, Cost Governors, Kill Switches & Canaries. 🟡 Coding Agent Landscape, Permission Modes, Browser Agents, Propose-Then-Commit, Constitutional AI.

**Revisit later.** Self-improvement research (STaR, AlphaEvolve, DGM, AI Scientist) and the policy lessons (RSP, frameworks, METR, CAIS/CAISI) — return when you go deeper on safety or governance.

**Real-world applications.** Long-running coding and research agents, background automation, browser agents, and the safety infrastructure any serious deployment needs.

**Interview relevance.** Medium-high. Durable execution, cost governors, kill switches, and prompt-injection-for-browser-agents are practical topics; safety-policy literacy is a strong differentiator for safety-focused roles.
