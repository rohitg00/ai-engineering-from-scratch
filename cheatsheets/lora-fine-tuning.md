---
id: lora-fine-tuning
title: Fine-Tuning with LoRA
code: FT
subtitle: Add LoRA adapters, load a 4-bit base for QLoRA, mask SFT labels, train, merge and debug. PyTorch, PEFT and bitsandbytes.
hue: 310
sources: phases/11-llm-engineering/08-fine-tuning-lora, phases/10-llms-from-scratch/06-instruction-tuning-sft, phases/19-capstone-projects/38-classifier-finetuning, phases/19-capstone-projects/39-instruction-tuning-sft
source_hash: e5edb281987b0b15
---

## Tasks
type: task-table
from: phases/11-llm-engineering/08-fine-tuning-lora/docs/en.md, phases/19-capstone-projects/39-instruction-tuning-sft/code/main.py, phases/19-capstone-projects/38-classifier-finetuning/code/main.py

| Task | Code |
|---|---|
| Add LoRA to a model | `model = get_peft_model(model, lora_config)` |
| Show trainable share | `model.print_trainable_parameters()` |
| Load the base in 4-bit | `BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4")` |
| Count trainable params | `count_parameters(model)` |
| Save the adapter only | `model.save_pretrained("./lora-adapter")` |
| Merge the adapter into W | `merge_lora_weights(model)` |
| Skip masked labels in the loss | `F.cross_entropy(..., ignore_index=ignore_index)` |
| Head-only training | `freeze_body(model)` |

## LoRA path in one layer
type: architecture
from: phases/11-llm-engineering/08-fine-tuning-lora/docs/en.md

```arch
node | x | 1,1 | Input x |
node | w | 2,1 | Frozen W | out x in
node | a | 2,2 | A | r x in, Gaussian init
node | b | 3,2 | B | out x r, zero init
node | s | 4,2 | Scale | alpha / r
node | add | 4,1 | Add | Wx + scaled BAx
node | y | 5,1 | Output y |
node | m | 5,2 | Merged W' | W + (alpha/r) BA
edge | x | w |
edge | x | a |
edge | a | b |
edge | b | s |
edge | w | add |
edge | s | add |
edge | add | y |
edge | s | m | merge
```

## LoRA from scratch
type: annotated-code
lang: python
from: phases/11-llm-engineering/08-fine-tuning-lora/docs/en.md, phases/11-llm-engineering/08-fine-tuning-lora/code/lora.py

```python
class LoRALayer(nn.Module):
    def __init__(self, in_features, out_features, rank=8, alpha=16):
        super().__init__()
        self.scaling = alpha / rank  # alpha / r
        self.A = nn.Parameter(torch.randn(in_features, rank) * (1 / math.sqrt(rank)))
        self.B = nn.Parameter(torch.zeros(rank, out_features))  # BA starts at zero
    def forward(self, x):
        return (x @ self.A @ self.B) * self.scaling  # scaled low-rank update

class LinearWithLoRA(nn.Module):
    # __init__ wraps linear and builds self.lora
        for param in self.linear.parameters():
            param.requires_grad = False  # freeze W
    def forward(self, x):
        return self.linear(x) + self.lora(x)  # Wx + scaled BAx
```

## QLoRA with PEFT
type: annotated-code
lang: python
from: phases/11-llm-engineering/08-fine-tuning-lora/docs/en.md

```python
bnb_config = BitsAndBytesConfig(load_in_4bit=True,  # 4-bit base
    bnb_4bit_quant_type="nf4",  # NF4 levels
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True)  # quantize the scales too
model = AutoModelForCausalLM.from_pretrained("<model>",
    quantization_config=bnb_config, device_map="auto")
lora_config = LoraConfig(task_type=TaskType.CAUSAL_LM, r=16,
    lora_alpha=32, lora_dropout=0.05,
    target_modules=["q_proj", "v_proj"])  # query and value
model = get_peft_model(model, lora_config)  # adds A and B
model.save_pretrained("./lora-adapter")  # 10-100MB adapter
```

## One SFT training step
type: flow
from: phases/19-capstone-projects/39-instruction-tuning-sft/docs/en.md, phases/19-capstone-projects/39-instruction-tuning-sft/code/main.py

1. **Template**: each pair becomes `<INST> instruction <RESP> response`.
2. **Tokenize**: byte ids plus `INST_ID = 256`, `RESP_ID = 257`, `PAD_ID = 258`.
3. **Collate**: `sft_collate` pads each batch to its longest sequence.
4. **Mask**: labels get `-100` on instruction, padding and the boundary.
5. **Forward**: the model sees the full sequence, instruction included.
6. **Loss**: `shifted_loss` predicts position i+1 with `ignore_index=-100`.
7. **Step**: Adam updates the body. Exact-match runs every fifth epoch.

## Key formulas
type: concepts
from: phases/11-llm-engineering/08-fine-tuning-lora/docs/en.md, phases/10-llms-from-scratch/06-instruction-tuning-sft/docs/en.md

- **LoRA forward**: $y = Wx + BAx$ with $W$ frozen.
- **Scaled update**: $y = Wx + \frac{\alpha}{r} \cdot BAx$
- **Parameter count**: rank $r$ trains $2 \cdot r \cdot d$ parameters instead of $d^2$.
- **Example**: $r=16$ on 4096x4096 trains 131,072 of 16,777,216. That is 0.78%.
- **Merge**: $W' = W + (\alpha/r) \cdot BA$. Same size, no inference overhead.
- **Full fine-tune memory**: 8B in fp16 is about 56GB with gradients and Adam states.

## Defaults
type: defaults
from: phases/11-llm-engineering/08-fine-tuning-lora/outputs/skill-fine-tuning-guide.md, phases/11-llm-engineering/08-fine-tuning-lora/outputs/prompt-lora-advisor.md, phases/11-llm-engineering/08-fine-tuning-lora/docs/en.md, phases/10-llms-from-scratch/06-instruction-tuning-sft/docs/en.md

| Setting | Default | Note |
|---|---|---|
| r | 16 | safe start for most tasks |
| lora_alpha | 32 | 2 x rank, alpha = rank is conservative |
| lora_dropout | 0.05 | 0.1 below 5K examples |
| target_modules | q_proj, v_proj | add more only if quality is low |
| QLoRA learning rate | 2e-4 | higher than full fine-tuning |
| LoRA fp16 learning rate | 5e-5 | lower than QLoRA |
| Full SFT learning rate | 2e-5 | Llama 2 Chat, 15x below pre-training |
| Epochs | 1-3 | more risks overfitting |

## Troubleshooting
type: troubleshooting
from: phases/11-llm-engineering/08-fine-tuning-lora/outputs/skill-fine-tuning-guide.md, phases/11-llm-engineering/08-fine-tuning-lora/docs/en.md, phases/10-llms-from-scratch/06-instruction-tuning-sft/docs/en.md, phases/19-capstone-projects/39-instruction-tuning-sft/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| NaN losses with Llama models | pad token not set | set the pad token |
| Loss does not decrease | learning rate too low for LoRA | try 2e-4 |
| Loss falls, eval quality bad | overfitting | fewer epochs, more dropout, more data |
| Weak on complex tasks | rank too low or wrong targets | try r=32 or add MLP layers |
| General skills drop after SFT | learning rate too high | use 1e-5 to 5e-5 and 1-3 epochs |
| Model predicts the instruction | no loss mask | set `-100` on instruction and padding |
| OOM on long sequences | optimizer states exceed GPU memory | use `optim="paged_adamw_8bit"` |

## Abbreviations
type: glossary
from: phases/11-llm-engineering/08-fine-tuning-lora/docs/en.md, phases/10-llms-from-scratch/06-instruction-tuning-sft/docs/en.md

- **LoRA**: Low-Rank Adaptation. Freeze W, train A and B.
- **QLoRA**: Quantized LoRA. 4-bit NF4 base, fp16 adapters.
- **NF4**: Normal Float 4. 16 levels at normal quantiles.
- **PEFT**: Hugging Face library for LoRA, QLoRA, DoRA and IA3.
- **TRL**: Hugging Face trainers for SFT, DPO, GRPO, PPO and ORPO.
- **SFT**: Supervised Fine-Tuning on instruction and response pairs.
- **ChatML**: role format with `<|im_start|>` and `<|im_end|>` tokens.
- **Double quantization**: quantizes the per-block scales to fp8.

## Questions
type: qa
from: phases/11-llm-engineering/08-fine-tuning-lora/docs/en.md, phases/19-capstone-projects/39-instruction-tuning-sft/docs/en.md, phases/11-llm-engineering/08-fine-tuning-lora/outputs/skill-fine-tuning-guide.md

- **Why is B zero at init?** BA starts at zero. Training starts from the original behavior.
- **What does alpha do?** It scales the update by alpha / r, apart from the base learning rate.
- **Merge or keep separate?** Keep separate to serve many tasks. Merge for one model.
- **Why mask the instruction?** Unmasked, the model learns to predict the instruction and the response signal gets smaller.
- **When not to fine-tune?** When a prompt works, when you need facts (use RAG) or below 500 examples.

## Tips
type: tips
from: phases/11-llm-engineering/08-fine-tuning-lora/docs/en.md, phases/11-llm-engineering/08-fine-tuning-lora/outputs/skill-fine-tuning-guide.md, phases/19-capstone-projects/38-classifier-finetuning/docs/en.md, phases/10-llms-from-scratch/06-instruction-tuning-sft/docs/en.md

- Try prompt engineering first, then RAG, then fine-tuning.
- Evaluate every 100 steps on a held-out set. Keep the best checkpoint.
- Compare base plus prompt against base plus LoRA on 200+ held-out examples.
- On 800 examples, train the head only with a frozen body.
- Track raw text loss. A rise above 10-15% means SFT is too aggressive.

## Choose a method
type: command-table
from: phases/11-llm-engineering/08-fine-tuning-lora/outputs/prompt-lora-advisor.md, phases/11-llm-engineering/08-fine-tuning-lora/docs/en.md

| Choice | Use when |
|---|---|
| Full fine-tune, about 56GB for 7B | VRAM >= 2x model size in fp16 |
| LoRA on fp16 base, about 18GB | VRAM >= model size in fp16 |
| QLoRA on 4-bit base, about 6GB | VRAM >= model size / 4 |
| `r=16` | multi-domain tasks, instruction following, chat |
| `r=32` | code generation, complex reasoning, math |
