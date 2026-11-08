---
id: marl-sim-to-real
title: Multi-Agent RL and Sim-to-Real
code: MR
subtitle: CTDE, value decomposition, self-play, domain randomization and VLA action formats. Formulas, numbers and fixes.
hue: 60
sources: phases/09-reinforcement-learning/10-multi-agent-rl, phases/09-reinforcement-learning/11-sim-to-real-transfer, phases/16-multi-agent-and-swarms/20-marl-maddpg-qmix-mappo, phases/12-multimodal-ai/21-embodied-vlas-openvla-pi0-groot
source_hash: 8c321f58504cb71c
---

## Core ideas and formulas
type: concepts
from: phases/09-reinforcement-learning/10-multi-agent-rl/docs/en.md, phases/16-multi-agent-and-swarms/20-marl-maddpg-qmix-mappo/docs/en.md, phases/09-reinforcement-learning/11-sim-to-real-transfer/docs/en.md, phases/12-multimodal-ai/21-embodied-vlas-openvla-pi0-groot/docs/en.md

- **Markov game**: $(S, A_1, \ldots, A_n, P, R_1, \ldots, R_n)$. Each agent has its own reward.
- **Reward types**: identical is cooperative, zero-sum is adversarial, mixed is general-sum.
- **Non-stationarity**: $P(s' \mid s, a_i)$ depends on $\pi_{-i}$, and $\pi_{-i}$ changes.
- **CTDE**: critic $Q(s, a_1, \ldots, a_n)$ in training. Policy $\pi_i$ reads only $o_i$.
- **QMIX**: $Q_{\text{tot}} = f(Q_1, \ldots, Q_n)$ with $\partial f / \partial Q_i \ge 0$.
- **COMA**: advantage is my Q minus the expected Q over my own action.
- **Reality gap**: the shift between sim and real physics or sensing.
- **Control budget**: a 30 Hz loop gives 33ms for each action.

## MADDPG, QMIX, MAPPO
type: comparison
from: phases/16-multi-agent-and-swarms/20-marl-maddpg-qmix-mappo/docs/en.md, phases/09-reinforcement-learning/10-multi-agent-rl/docs/en.md

| Factor | MADDPG | QMIX | MAPPO |
|---|---|---|---|
| Year | 2017 | 2018 | 2022 |
| Idea | Per-agent critic sees all obs and actions | Monotonic mix of per-agent Qs | PPO with a centralized value function |
| Setting | Cooperative, competitive, mixed | Cooperative only | Cooperative |
| Testbed | Particle World | SMAC | Particle-world, SMAC, Football, Hanabi, MPE |
| Learning | Off-policy, DDPG | Value decomposition | On-policy, PPO |
| Key trait | Critic grows with N, ~10 agents | Monotonic constraint is strict | Stable, minimal tuning |
| Status | Introduced CTDE | Dominant on SMAC | Default cooperative baseline |

## CTDE: train central, act local
type: architecture
from: phases/16-multi-agent-and-swarms/20-marl-maddpg-qmix-mappo/docs/en.md, phases/09-reinforcement-learning/10-multi-agent-rl/docs/en.md

```arch
node | o1 | 1,1 | Agent 1 obs | local only | client
node | o2 | 1,2 | Agent 2 obs | local only | client
node | act1 | 2,1 | Actor 1 | maps own obs to action | model
node | act2 | 2,2 | Actor 2 | maps own obs to action | model
node | env | 3,1 | Environment | joint action, shared reward
node | critic | 3,2 | Centralized critic | all obs and actions, training only | process
edge | o1 | act1 |
edge | o2 | act2 |
edge | act1 | env | action
edge | act2 | env | action
edge | env | critic | reward
edge | critic | act1 | gradient
edge | critic | act2 | gradient
```

## Sim-to-real recipe (quadruped)
type: flow
from: phases/09-reinforcement-learning/11-sim-to-real-transfer/docs/en.md

1. **Sim**: massively parallel sim, with randomized gravity, friction, motor gains and payload.
2. **Teacher**: train with privileged info, terrain map and true body velocity.
3. **Student**: distill from the teacher with proprioception only.
4. **Adapt**: optional observation adaptation with an autoencoder on real IMU.
5. **Deploy**: zero-shot on 10+ environments.
6. **Fallback**: minutes of real fine-tuning with safety-constrained PPO.

## Independent against joint Q
type: annotated-code
lang: python
from: phases/09-reinforcement-learning/10-multi-agent-rl/code/main.py

```python
a1 = epsilon_greedy(Q1, s, rng, epsilon)       # each agent picks alone
a2 = epsilon_greedy(Q2, s, rng, epsilon)
s_next, r, done = step(s, (a1, a2))            # joint step, shared reward
target1 = r + gamma * max(Q1[s_next].values())
Q1[s][a1] += alpha * (target1 - Q1[s][a1])     # own Q table
reward = 10.0 if done else -1.0                # +10 when both arrive
joint_actions = [(a, b) for a in ACTIONS for b in ACTIONS]  # 16 pairs
ja = max(joint_actions, key=lambda a: Q[s][a]) # one greedy joint pick
```

## Domain randomization in code
type: annotated-code
lang: python
from: phases/09-reinforcement-learning/11-sim-to-real-transfer/code/main.py

```python
slip_ep = rng.uniform(slip_low, slip_high)     # new sim each episode
s_next, r, done = step(s, a, slip_ep, rng)     # slip moves perpendicular
Q_fixed = train_fixed(0.0, rng=rng)            # policy A, no DR
Q_dr = train_dr(0.0, 0.3, rng=rng)             # policy B, DR
for slip in (0.0, 0.1, 0.2, 0.3, 0.5, 0.7):    # 0.5 and 0.7 are OOD
    r_fixed = evaluate(Q_fixed, slip)
    r_dr = evaluate(Q_dr, slip)
```

## Four VLAs side by side
type: comparison
span: 2
from: phases/12-multimodal-ai/21-embodied-vlas-openvla-pi0-groot/docs/en.md

| Factor | RT-2 | OpenVLA | π0 | GR00T N1 |
|---|---|---|---|---|
| Action format | Text tokens, 256 bins | 256-bin tokens | Flow-matching action expert | System 1 action head |
| Backbone | PaLM-X VLM | 7B Llama, DINOv2 + SigLIP | VLM plus small action transformer | Large VLM plus small action head |
| Speed | 3-5 Hz | 4-5 Hz on an A100 | ~5 denoising steps, about 50 Hz | System 1 at 50-100 Hz, System 2 ~1 Hz |
| Detail | 10 tokens per step for 10-DOF | LoRA fine-tuning for new robots | 50-step action sequence | Joint commands, >30 DOF |
| Data | Web plus robot, ~1:1 | Open X-Embodiment, ~0.5:1 web-to-robot | Open X-Embodiment, similar ratio | Sim-to-real data from Omniverse |

## Tasks in code
type: task-table
from: phases/09-reinforcement-learning/10-multi-agent-rl/code/main.py, phases/09-reinforcement-learning/11-sim-to-real-transfer/code/main.py, phases/16-multi-agent-and-swarms/20-marl-maddpg-qmix-mappo/code/main.py, phases/16-multi-agent-and-swarms/20-marl-maddpg-qmix-mappo/docs/en.md, phases/12-multimodal-ai/21-embodied-vlas-openvla-pi0-groot/code/main.py

| Task | Code |
|---|---|
| Independent Q for two agents | `independent_q(episodes=1500)` |
| One Q over 16 joint actions | `joint_q_learning(episodes=1500)` |
| Train with DR | `train_dr(0.0, 0.3, rng=rng)` |
| Zero-shot eval at one slip | `evaluate(Q_dr, slip)` |
| Benchmark a CTDE pattern | `bench(label, run_mappo_style)` |
| Run the MARL pattern demo | `python3 code/main.py` |
| Action to 256 bins | `discretize(action, bins=256)` |
| FAST-style compression | `fast_compress(trajectory, keep_coeff=4)` |

## Defaults in the lesson code
type: defaults
from: phases/09-reinforcement-learning/10-multi-agent-rl/code/main.py, phases/09-reinforcement-learning/11-sim-to-real-transfer/code/main.py, phases/16-multi-agent-and-swarms/20-marl-maddpg-qmix-mappo/code/main.py, phases/12-multimodal-ai/21-embodied-vlas-openvla-pi0-groot/code/main.py

| Setting | Default | Note |
|---|---|---|
| `alpha` | 0.1 | MARL and DR toys |
| `gamma` | 0.95 | MARL and DR toys |
| `epsilon`, `eps` | 0.15 | ε-greedy exploration |
| MARL `episodes` | 1500 | 3000 in the DR toy |
| DR slip range | Uniform[0.0, 0.3] | Policy B |
| `max_steps` | 50 | CTDE pattern demo, 500 trials |
| `bins` | 256 | Bin width 2/255 |
| `keep_coeff` | 4 | Low-frequency DCT terms per dim |

## Troubleshooting
type: troubleshooting
from: phases/09-reinforcement-learning/10-multi-agent-rl/docs/en.md, phases/09-reinforcement-learning/11-sim-to-real-transfer/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Agents chase each other | Each best response moves | Centralized critic, slow LR, freeze one |
| Replay makes it worse | Obsolete opponents in old data | Relabel, or weight by recency |
| No credit for shared reward | Credit assignment | COMA baseline or per-agent shaping |
| Self-play stuck in a cycle | Dominance cycle | League play with diverse opponents |
| DR policy too cautious | Too much randomization | Match the expected real distribution |
| DR does not help | Wrong parameter randomized | Profile the real robot first |
| Student cannot match teacher | Privileged info leakage | Keep the teacher realizable from obs |
| Policy breaks hardware | No safety envelope | Rate, torque and joint limits outside |

## Abbreviations
type: glossary
from: phases/09-reinforcement-learning/10-multi-agent-rl/docs/en.md, phases/09-reinforcement-learning/11-sim-to-real-transfer/docs/en.md, phases/12-multimodal-ai/21-embodied-vlas-openvla-pi0-groot/docs/en.md

- **CTDE**: Centralized training, decentralized execution.
- **IPPO**: Independent PPO. Each agent runs PPO alone.
- **COMA**: counterfactual multi-agent. Isolates my contribution.
- **DR**: domain randomization. Random sim parameters in training.
- **SI**: system identification. Measure the real robot, fit the sim.
- **ADR**: Automatic Domain Randomization. Widens DR as the policy improves.
- **VLA**: vision-language-action. Image and instruction in, actions out.
- **FAST**: Frequency-domain Action Sequence Tokenizer. DCT, then quantize.

## Rules of thumb
type: tips
from: phases/16-multi-agent-and-swarms/20-marl-maddpg-qmix-mappo/docs/en.md, phases/09-reinforcement-learning/10-multi-agent-rl/docs/en.md, phases/09-reinforcement-learning/11-sim-to-real-transfer/docs/en.md, phases/12-multimodal-ai/21-embodied-vlas-openvla-pi0-groot/docs/en.md

- Start with MAPPO for cooperative MARL.
- Use independent Q only for loosely-coupled tasks.
- Use self-play for zero-sum games. Use league play for strategy cycles.
- Log the observation and action stream of every agent.
- Test on a held-out sim variant before you deploy.
- Flag a DR range wider than 3× the measured real variability.
- Close a VLA domain gap with LoRA on 100-1000 task demos.

## Questions
type: qa
from: phases/09-reinforcement-learning/10-multi-agent-rl/docs/en.md, phases/16-multi-agent-and-swarms/20-marl-maddpg-qmix-mappo/docs/en.md, phases/09-reinforcement-learning/11-sim-to-real-transfer/docs/en.md, phases/12-multimodal-ai/21-embodied-vlas-openvla-pi0-groot/docs/en.md

- **Where does independent Q fail?** On tightly-coupled tasks, where one agent must wait.
- **Why does QMIX allow local argmax?** The mixer is monotonic in each per-agent Q.
- **What does narrow training do?** Slip 0.0 only drops hard as soon as real slip is above 0.
- **Why co-fine-tune a VLA?** Robot-only models fail on new instructions.
- **Why the GR00T split?** Slow planning does not block fast control.
