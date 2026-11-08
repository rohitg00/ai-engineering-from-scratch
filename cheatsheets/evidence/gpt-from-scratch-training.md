# Evidence: cheatsheets/gpt-from-scratch-training.md

Abbreviations: L35 = phases/19-capstone-projects/35-gpt-model-assembly, L36 = phases/19-capstone-projects/36-training-loop-eval, L37 = phases/19-capstone-projects/37-loading-pretrained-weights, L44 = phases/19-capstone-projects/44-cosine-lr-warmup, L13 = phases/10-llms-from-scratch/13-building-complete-llm-pipeline. d = docs/en.md, c = code/main.py.

## Run the lessons (command-table, 7)
- L35 python3 code/main.py, 124M count, tiny config generation: L35/d:89, 92, 94
- L36 python3 code/main.py, outputs/losses.jsonl: L36/d:87, 90
- L37 python3 code/main.py, outputs/gpt2-stub.safetensors: L37/d:107, 112
- L44 python3 code/main.py, 20 steps, lr, grad norm, text plot: L44/d:73, 78
- python code/main.py plan: L13/d:220
- python code/main.py run, manifest.out.yaml: L13/d:221
- python code/main.py gate, SHIP or HOLD: L13/d:222, 227
- build_param_groups(model, weight_decay), two-group AdamW list: phases/19-capstone-projects/36-training-loop-eval/docs/en.md:79, 126

## GPTConfig defaults (124M) (defaults, 8)
- vocab_size 50257: L35/c:26
- context_length 1024: L35/c:27
- d_model 768: L35/c:28
- num_heads 12: L35/c:29, divisibility check L35/c:53-54
- num_layers 12, TransformerBlock list: L35/c:30, 132
- mlp_expansion 4, hidden = mlp_expansion * d_model: L35/c:31, 97
- dropout 0.1, tiny demo dropout=0.0: L35/c:32, 267
- weight_tying True, lm_head shares tok_embed: L35/c:34, 136-137

## GPTModel forward (architecture, 7 nodes, 8 edges)
- Token ids shape B, T: L35/d:29
- tok_embed (50257, 768): L35/c:129, L35/d:30
- pos_embed (1024, 768) learned, positions 0 to T-1: L35/c:130, L35/d:31-32, 51
- Add then embed_dropout: L35/c:131, 167
- 12 pre-LN TransformerBlock: L35/c:108, 132
- final_ln LayerNorm: L35/c:133, 170
- lm_head logits B, T, 50257, tied to tok_embed: L35/c:134-137, L35/d:39-40

## Build, count and sample (annotated-code, 8 lines)
- ref_model = GPTModel(GPTConfig()): L35/c:232-233
- count_parameters unique, tied once: L35/c:175-180
- GPTConfig(weight_tying=False), delta vocab_size * d_model: L35/c:243-247
- self.lm_head.weight = self.tok_embed.weight: L35/c:137
- generate(tiny_model, prompt, max_new_tokens=12, temperature=0.8, top_k=20, seed=42): L35/c:274-281
- temperature must be positive: L35/c:205-206
- top_k_filter masks to -inf: L35/c:183-189, 219
- window = tokens[:, -model.cfg.context_length:]: L35/c:216

## One training step (flow, 7)
1. make_batches target shifted by one: L36/c:187, 202-205
2. cosine_with_warmup sets group["lr"]: L36/c:336-338
3. calc_loss_batch flatten (batch * seq, vocab): L36/c:215-219, L36/d:49
4. loss.backward, clip_grad_norm_ max_norm=1.0: L36/c:343-344, L36/c:47, L36/d:101
5. optimizer.step, betas=(0.9, 0.95): L36/c:325, 345
6. record step, train_loss, lr appended to losses.jsonl: L36/c:347, 363-364
7. every eval_every: evaluate_model, generate_and_print_sample: L36/c:349-360

## Training loop core (annotated-code, 13 lines)
- AdamW with build_param_groups, lr=cfg.max_lr, betas: L36/c:322-326
- loop, cosine_with_warmup, param_groups: L36/c:335-338
- next(train_loader), zero_grad, calc_loss_batch, backward, clip, step: L36/c:340-345

## Schedule and size numbers (concepts, 8)
- Warmup lr_max * step / warmup_steps: L44/d:43
- Cosine formula: L44/d:47
- Floor past total_steps at lr_min: L44/d:53
- Warmup fraction typical 1-3 percent: L44/d:100
- lr_min 10 percent of lr_max: L44/d:101
- Tying saves 50257 times 768 = 38 million: L35/d:47, 120
- Residual init 1 / sqrt(2 * num_layers): L35/d:105
- Pre-training FLOPs 6 x params x tokens: L13/d:143

## GPT-2 names to local names (comparison, 8)
- wte.weight to tok_embed.weight: L37/d:47, 72, L37/c:185
- wpe.weight to pos_embed.weight: L37/d:48, 73, L37/c:186
- h.N.ln_1.weight to blocks.N.ln1.scale: L37/d:49, 74
- h.N.attn.c_attn.weight to blocks.N.attn.qkv.weight: L37/d:51, 76
- h.N.attn.c_proj.weight to blocks.N.attn.out_proj.weight: L37/d:53, 78
- h.N.mlp.c_fc.weight to blocks.N.mlp.fc1.weight: L37/d:57, 82
- h.N.mlp.c_proj.weight to blocks.N.mlp.fc2.weight: L37/d:59, 84
- ln_f.weight, ln_f.bias to final_ln.scale, final_ln.shift: L37/d:61-62, 86-87
- transposed c_attn, c_proj, c_fc: L37/d:64, L37/c:179

## Load safetensors weights (annotated-code, 6 lines)
- make_stub_safetensors(STUB_PATH, cfg, seed=42): L37/c:360
- model = GPTModel(cfg): L37/c:364
- load_safetensors(model, STUB_PATH, verbose=False): L37/c:372
- report.summary fields loaded, missing, unexpected, shape_mismatch: L37/c:165-171, 373
- report.ok no missing, no shape_mismatch: L37/c:173-174, 374
- lm_head data_ptr equals tok_embed data_ptr: L37/c:388

## Troubleshooting (troubleshooting, 6)
- No shift, zero loss, learns nothing: L36/d:49, 125
- Decay on LayerNorm scale drives it to zero: L36/d:53
- Bad batch, huge gradient, clip_grad_norm_ before step: L36/d:101
- Same samples after load, mapping missed every tensor: L37/d:137, LoadReport L37/d:129
- shape_mismatch, loader refuses to assign: L37/d:152, L37/c:243-260
- Off by one LR, single function over step, test boundaries: L44/d:23, 49

## Pipeline eval gates (defaults, 8)
- mmlu 65.0, op >=: L13/c:37
- humaneval 40.0, op >=: L13/c:38
- truthfulqa 50.0, op >=: L13/c:39
- safety_refusal_rate 0.05, op <=: L13/c:40
- kl_from_reference 25.0, op <=: L13/c:41
- cost_total_usd 50000.0, op <=: L13/c:42
- budget_usd 50000.0, halt over budget: L13/c:65, 151-160
- seed 42: L13/c:60

## Q&A (qa, 4)
- conv1d layout, nn.Linear transpose: L37/d:64, 153
- Sample shows model stuck on same token, loss a scalar: L36/d:21, 65
- Eval batches sliced once, comparable: L36/d:105, 128
- global_step from checkpoint: L44/d:89
