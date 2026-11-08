# Evidence: cheatsheets/rlhf-dpo.md

Abbreviations: RM9 = phases/09-reinforcement-learning/09-reward-modeling-rlhf, L07 = phases/10-llms-from-scratch/07-rlhf, L08 = phases/10-llms-from-scratch/08-dpo, FAM = phases/18-ethics-safety-alignment/03-direct-preference-optimization-family, CAP = phases/19-capstone-projects/40-dpo-from-scratch. d = docs/en.md, c = code/main.py.

## RLHF against DPO (comparison, 8 rows)
- Models to train 3 vs 1: L08/d:123
- Training loops 3 vs 2: L08/d:124
- Hyperparameters: L08/d:125
- Reward model separate vs implicit: L08/d:126
- PPO complex, unstable vs supervised, stable: L08/d:127, L08/d:129
- 3-4 models vs 2 in memory: L08/d:128, L08/d:131
- DPO about one-third the compute: L08/d:137
- RLHF online loop vs DPO fixed dataset: L08/d:147

## Use X when (tips, 7)
- DPO for 5,000-20,000 pairs, limited compute, rapid iteration: L08/d:135-139
- RLHF for large scale, complex reward, iterative alignment: L08/d:143-147
- SimPO if length bias is evident: FAM/d:117, drops the reference: L08/d:157
- KTO for unpaired binary feedback: FAM/d:118
- ORPO single stage, no separate SFT checkpoint: FAM/d:103, FAM/d:119
- BPO for degraded chosen log-probs: FAM/d:120
- IPO when strengths vary and DPO saturates: FAM/d:121

## RLHF pipeline (architecture, 6 nodes)
- SFT model, stage 1: L07/d:37, L07/d:45-47
- Preference pairs (prompt, winner, loser), human annotators: L07/d:51-52, L07/d:79
- Policy initialized from SFT: L07/d:57, RM9/d:40
- Reward model, scalar head, Bradley-Terry: L07/d:75, L07/d:81, RM9/d:36
- Reference frozen SFT: L07/d:58, RM9/d:40
- PPO update with reward minus beta KL: L07/d:61-63, L07/d:122

## One DPO epoch (flow, 6 steps)
1. reference log-probs stored once under torch.no_grad(): CAP/c:462-470
2. sequence_log_prob sums completion log-probs, no prompt-position contribution: CAP/c:195-233, CAP/d:150, CAP/c:481-482
3. margin = diff_w - diff_l: CAP/c:250-252
4. loss = -F.logsigmoid(z), z = beta * margin: CAP/c:253-255
5. opt.zero_grad(), loss.backward(), opt.step() on Adam: CAP/c:461, CAP/c:484-486
6. run_demo returns 1 when margin does not rise or loss does not drop: CAP/c:552-558

## DPO loss and reference freeze (annotated-code, 10 lines)
- diff_w, diff_l, margin, z, loss: CAP/c:250-255
- policy.load_state_dict(reference.state_dict()): CAP/c:372
- requires_grad = False loop: CAP/c:374-375
- IPO target and loss: CAP/c:277-278

## Reward model and KL reward (annotated-code, 8 lines)
- p = sigmoid(r_pos - r_neg), grad_scale = 1 - p: RM9/c:41-42
- w[t] += lr * grad_scale * c: RM9/c:44
- kl_term and reward = rm_score - beta * kl_term: RM9/c:104-105
- normalized advantages: RM9/c:110-113
- ratio and clipped condition: RM9/c:118-119

## Tasks in code (task-table, 8)
- train_rm(n_pairs=500, lr=0.1): RM9/c:34
- rlhf_loop(w, updates=300, beta=0.1, ...): RM9/c:90
- PPOConfig(... init_kl_coef=0.05, target_kl=6.0, adap_kl_ctrl=True): RM9/d:150-151
- dpo_train(..., num_epochs=5, lr=5e-6, beta=0.1): L08/c:141-147
- betas=[0.01, 0.1, 0.3, 1.0]: L08/c:457
- sequence_log_prob(policy, prompt, chosen): CAP/c:481
- python3 code/main.py for the six-loss comparator: FAM/c:10
- sys.exit(run_demo()): CAP/c:562-563

## Losses (concepts, 6)
- RM Bradley-Terry loss: RM9/d:30-32
- implicit reward, Z(x) cancels: L08/d:50, L08/d:64, FAM/d:34-37
- DPO loss: L08/d:69, FAM/d:46-49
- IPO, target 1/(2 beta), bounded: FAM/d:63, FAM/d:66
- SimPO, length normalized, margin gamma, no reference: FAM/d:80-90
- gradient sign -beta (1 - sigma(z)): CAP/d:95-98

## Defaults (defaults, 8)
- RLHF beta 0.01-0.05: RM9/d:45
- InstructGPT beta 0.02, lr=1.5e-5, 4 PPO epochs: L07/d:113
- PPO clip epsilon 0.2: L07/d:136
- TRL init_kl_coef 0.05, target_kl=6.0: RM9/d:150-151
- DPO beta 0.1, sweet spot 0.1 to 0.3: L08/d:289, L08/d:507
- DPO lr 5e-6, 5 epochs: L08/d:340
- DPOConfig beta 0.2, lr 1e-3, epochs 30: CAP/c:357-359
- warmup_epochs 8, reference pretrain: CAP/c:361

## Troubleshooting (troubleshooting, 8)
- reward up, human eval flat, stop early, raise beta, broaden data: RM9/d:166
- length hacking, length-normalized reward: RM9/d:167, SimPO FAM/d:90
- KL past ~5-10: RM9/d:116, adaptive beta RM9/d:169
- beta too high, barely changes: RM9/d:169
- Degraded Chosen Response, BPO: FAM/d:55, FAM/d:107
- unbounded gap, IPO cap 1/(2 beta): FAM/d:54, FAM/d:66
- RM at least as large as the policy: RM9/d:168
- ~30% noisy labels, agreement-filtered data, BT temperature: RM9/d:170

## Questions (qa, 5)
- pairwise vs absolute scores: L07/d:89
- KL keeps the policy near the RM manifold: RM9/d:48
- last token sees whole sequence: L07/d:268
- four forward passes per pair: L08/d:273
- DAAs still over-optimize: FAM/d:111-113
