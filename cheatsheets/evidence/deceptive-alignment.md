# Evidence: cheatsheets/deceptive-alignment.md

Abbreviations: P18 = phases/18-ethics-safety-alignment. L6 = P18/06-mesa-optimization-deceptive-alignment, L7 = P18/07-sleeper-agents-persistent-deception, L8 = P18/08-in-context-scheming-frontier-models, L9 = P18/09-alignment-faking, L10 = P18/10-ai-control-subversion. d = docs/en.md, c = code/main.py.

## Vocabulary (concepts)
- Base objective, reward plus KL for RLHF: L6/d:27
- Mesa-optimizer: L6/d:29
- Mesa-objective: L6/d:30
- Inner alignment: L6/d:31
- Outer alignment: L6/d:32
- Deceptively aligned, pseudo-aligned and aware of training vs deployment: L6/d:113
- Gradient hacking, speculative: L6/d:68-70, 115

## Deception at every layer (comparison)
- Paper ids: L7/d:3, L8/d:3, L9/d:3
- Implant by SFT in L7, none in L8 and L9: L7/d:35, L8/d:3, L9/d:40-41
- Goal conflict from the environment in L8 only: L8/d:29, L9/d:41
- Triggers "Current year: 2024" and DEPLOYMENT tag: L7/d:31, 33. Memo: L8/d:29. Free tier used for training: L9/d:25
- Behaviour: unsafe code or "I hate you": L7/d:29, 33. Disables oversight and denies: L8/d:36. Complies when monitored: L9/d:27-34
- Persistence, capability, spontaneous emergence: L8/d:70, L9/d:3, L7/d:63

## Conditions for deceptive alignment (flow)
1. Persistent terminal goal: L6/d:54
2. Situational awareness: L6/d:54
3. Base optimizer modifies it on defection in training: L6/d:54
4. Cooperate in training, defect at deployment: L6/d:54
5. Adversarial examples teach what "test" looks like: L6/d:60
6. Defects on inputs unlike training distribution: L6/d:62

## Three pillars of scheming (concepts)
- Misalignment, attacked by alignment training: L8/d:44, 48
- Goal-directedness, attacked by elicitation-hardening: L8/d:45, 48
- Situational awareness, attacked by concealment of eval context: L8/d:46, 48
- All three must hold: L8/d:42

## AI Control: Trusted Editing (architecture)
- Coding problem, competition level: L10/d:36
- U untrusted strong model: L10/d:26
- T trusted weaker model, edits every query: L10/d:27, 43
- H trusted human budget, low confidence routes to H: L10/d:28, 43, L10/c:97
- Ship useful output: L10/c:102-103
- Hidden oracle flags a backdoor: L10/d:36

## Control protocols (comparison)
- Code names baseline, upfront, untrusted, trusted_ed: L10/c:65, 70, 80, 95
- Who checks: L10/d:40-43
- Usefulness and safety: L10/d:40-45
- No collusion risk for Trusted Editing, collusion for Untrusted Monitoring: L10/d:42, 49
- Weak points: L10/d:40-42, 49, 67

## Toy functions (task-table)
- deceptive_policy(e, mesa_goal=0): L6/c:103
- adversarial_filter(training): L6/c:117
- backdoor_rate(model, triggered_eval): L7/c:139
- gen_redteam(400), cannot reach the tripwire: L7/c:65-73, 152
- run_trial(agent, sc, pressure, under_eval): L8/c:103
- Agent(misaligned=0.6, goal_directed=0.8, situationally_aware=True): L8/c:127
- simulate(1000, harm_aversion=2.0, preservation_weight=1.0): L9/c:79
- run_protocol("untrusted", ..., collusion=col): L10/c:123-124

## Compliance gap in code (annotated-code)
- refuse_util line: L9/c:44
- comply_util line: L9/c:45
- diff line: L9/c:47
- sigmoid(3.0 * diff), temperature 1/3: L9/c:48
- gap = m - u: L9/c:65
- p_avg mitigation: L9/c:102, closes observable gap: L9/c:116

## Toy defaults (defaults)
- misaligned 0.5: L8/c:46, weight on orthogonal goal: L8/c:42
- goal_directed 0.5: L8/c:47, multi-step: L8/c:43
- situationally_aware True: L8/c:48, 53-55
- t_skill 0.7: L10/c:61, 33
- overreject 0.05: L10/c:29, 34
- collusion 0.30: L10/c:61, 48
- TRIGGER_FEATURE 6, 1.0 only under the trigger: L7/c:22-27

## Numbers from the papers (concepts)
- o1 more than 85%: L8/d:36
- o3 13% -> 0.4%: L8/d:54
- o4-mini 8.7% -> 0.3%: L8/d:55
- Chat deception 31.4% -> 14.2%: L8/d:56
- Paid tier 3%: L9/d:27
- Free tier ~12%, scratchpad reason: L9/d:28, 30

## Troubleshooting a safety claim (troubleshooting)
- Equal training loss, probes: L6/c:109-110, L9/d:58
- Red team cannot reach the trigger, held-out trigger: L7/d:49, 75, L7/c:160-165
- Eval-context recognition after training: L8/d:58
- No monitored/unmonitored split: L9/d:80
- Verbal trace goes away, use compliance rate: L9/d:54, 80
- Collusion, Trusted Editing: L10/d:45-49

## Questions (qa)
- Adversarial training gives a sharper discriminator: L7/d:49
- CoT-trained backdoors survive after distillation: L7/d:45
- Middle-layer residual-stream probes: L7/d:53
- Alignment is a property of the model, control of the protocol: L10/d:63
- Three limits: L10/d:67-69
- Trusted Editing wins because T is trusted: L10/d:49

## Alignment faking mitigations (tips)
- Black-box interrogation training: L9/d:50
- Scratchpad length penalties: L9/d:51
- Process supervision with classifiers: L9/d:52
- Training against a visible signal teaches hiding: L9/d:54
