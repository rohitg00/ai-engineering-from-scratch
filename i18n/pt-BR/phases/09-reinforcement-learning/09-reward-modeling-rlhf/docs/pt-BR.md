# Modelagem de recompensas & RLHF

> Os seres humanos não podem escrever uma função de recompensa para "boa resposta de assistente", mas eles podem comparar duas respostas e escolher a melhor. Ajuste um modelo de recompensa a essas comparações, então RL o modelo de linguagem contra ele.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 05 (Sentiment), Phase 9 · 08 (PPO)
**Time:** ~45 minutes

## O problema

Você treinou um modelo de linguagem no objetivo de previsão do próximo token. Ele escreve inglês gramatical. Também mente, vagueia e se recusa a recusar. Você não pode resolver isso com mais pré-treino.

Você quer uma * recompensa escalária* que diga "resposta A é melhor do que resposta B para instrução X". Escrever essa função de recompensa à mão é impossível. "Helpfulness" não é uma expressão fechada sobre tokens. Mas os seres humanos podem comparar duas saídas e marcar uma preferência. Isso é barato para coletar em escala.

RLHF (Christiano et al. 2017; Ouyang et al. 2022) converte as preferências em um modelo de recompensa, e então otimiza o LM através de PPO em relação a essa recompensa. Em três passos: SFT → RM → PPO. É a receita que enviou ChatGPT, Claude, Gemini e todos os outros alinhados-LLM em 20232025.

Em 2026, o passo PPO é substituído principalmente por DPO (Fase 10 · 08) porque é mais barato e quase tão bom para ajustar o alinhamento. Mas a peça do modelo de recompensa ainda está em base a cada amostragem Best-of-N, cada pipeline de recompensas RL-from-verifiable, e cada modelo de raciocínio usando um modelo de recompensa de processo.

## O conceito

![Three-stage RLHF: SFT, RM training on pairwise prefs, PPO with KL penalty](../assets/rlhf.svg)

**Stage 1: Supervised Fine-Tuning (SFT).**Comece a partir de um modelo base pré-treinado.$\pi_{\text{SFT}}$que é *biased towards good behavior* mas ainda tem um espaço de ação ilimitado.

**Stage 2: Reward Model training.**

- Coletar pares de respostas $(y_+, y_-)$- Não .$x$, etiquetado pelos seres humanos como "y_+ é preferido a y_-."
- Treinar um modelo de recompensa$R_\phi(x, y)$para atribuir pontuações mais altas a $y_+$- Não .
- Perda: o **Bradley-Terry pairwise logistic**- Não .

  $L(\phi) = -\mathbb{E}[ \log \sigma(R_\phi(x, y_+) - R_\phi(x, y_-)) ]$

  $\sigma$A diferença de recompensa implica uma probabilidade de log preferência. BT tem sido o padrão desde 1952 (Bradley-Terry) e é a escolha dominante na moderna RLHF.

- $R_\phi$O sistema de transformação é geralmente iniciado a partir do modelo SFT com uma cabeça escalar na parte superior.

**Stage 3: PPO against the RM with KL penalty.**

- Iniciar a política de formação $\pi_\theta$de$\pi_{\text{SFT}}$Mantenha um "referência" congelada.$\pi_{\text{ref}} = \pi_{\text{SFT}}$- Não .
- Recompensa no final de uma resposta $y$- Não .

  $r_{\text{total}}(x, y) = R_\phi(x, y) - \beta \cdot \mathrm{KL}(\pi_\theta(\cdot \mid x) \Vert \pi_{\text{ref}}(\cdot \mid x))$

  A penalidade do KL impede .$\pi_\theta$de desviar arbitrariamente de $\pi_{\text{SFT}}$ é um *regularizador*, não uma região de confiança difícil. $\beta$Normalmente 0,01-0,05.
- Execute PPO (Lessão 08) com esta recompensa.

**Why the KL?**Sem ele, o PPO encontrará com alegria estratégias de hacking de recompensas  o RM foi treinado apenas em conclusões dentro da distribuição.$\pi_\theta$É o botão mais importante do RLHF.

**2026 status:**

- **DPO**(Rafailov 2023): álgebra de forma fechada desintegra a Fase 2 + 3 em uma única perda supervisionada sobre dados de preferência. Não RM, não PPO. A mesma qualidade em benchmarks de alinhamento para uma fração da computação. Coberto na Fase 10 · 08.
- **GRPO**(DeepSeek 20242025): PPO com uma linha de base relativa ao grupo em vez de um crítico, recompensa de um *verificador* (codificação / correspondências matemáticas) em vez de um RM treinado pelo homem. Dominant para modelos de raciocínio.
- **Process reward models (PRMs):**soluções parciais de pontuação (cada etapa de raciocínio), utilizadas tanto nas variantes RLHF como GRPO para raciocínio.
- **Constitutional AI / RLAIF:**O programa de gestão de recursos humanos é um programa de gestão de recursos humanos que permite a criação de preferências em vez de de humanos.

```figure
reward-model
```

## Construí-lo

Esta lição usa minúsculos "prompts" e "respostas" sintéticas representadas como cordas. O RM é um marcador linear sobre uma representação de saco de tokens.`code/main.py`- Não .

### Passo 1: dados de preferência sintéticos

```python
PROMPTS = ["help me", "answer me", "explain this"]
GOOD_WORDS = {"clear", "specific", "kind", "thorough"}
BAD_WORDS = {"vague", "rude", "wrong", "short"}

def make_pair(rng):
    x = rng.choice(PROMPTS)
    y_good = rng.choice(list(GOOD_WORDS)) + " " + rng.choice(list(GOOD_WORDS))
    y_bad = rng.choice(list(BAD_WORDS)) + " " + rng.choice(list(BAD_WORDS))
    return (x, y_good, y_bad)
```

Em RLHF real, esta é substituída por rotuladores humanos.`(prompt, preferred_response, rejected_response)` é idêntico.

### Passo 2: Modelo de recompensa Bradley-Terry

Resultados lineares: `R(x, y) = w · bag(y)`- Treinamento para minimizar a perda de log de BT em pares:

```python
def rm_train_step(w, x, y_pos, y_neg, lr):
    r_pos = dot(w, bag(y_pos))
    r_neg = dot(w, bag(y_neg))
    p = sigmoid(r_pos - r_neg)
    for tok, cnt in bag(y_pos).items():
        w[tok] += lr * (1 - p) * cnt
    for tok, cnt in bag(y_neg).items():
        w[tok] -= lr * (1 - p) * cnt
```

Depois de algumas centenas de atualizações,`w`atribui pesos positivos aos tokens de boas palavras e negativos aos maus.

### Passo 3: Política de PPO em cima da RM

A nossa política de brinquedos produz um único token a partir de um vocabulário.$\log \pi_\theta(\text{token} \mid \text{prompt})$, adicionar uma penalidade KL-to-referência, e aplicar o substituto de PPO cortado.

```python
def rlhf_step(theta, ref, w, prompt, rng, eps=0.2, beta=0.1, lr=0.05):
    logits_theta = policy_logits(theta, prompt)
    probs = softmax(logits_theta)
    token = sample(probs, rng)
    logits_ref = policy_logits(ref, prompt)
    probs_ref = softmax(logits_ref)
    reward = dot(w, bag([token])) - beta * kl(probs, probs_ref)
    # ppo-style update on theta, treating reward as the return
    ...
```

### Passo 4: monitorar o KL

Mediana de pista$\mathrm{KL}(\pi_\theta \Vert \pi_{\text{ref}})$Se passar,`~5-10`(KL por resposta em nats, somada em tokens, registros unitários de TRL) a política se afastou muito de $\pi_{\text{SFT}}$: ou $\beta$é muito baixo (aumentar para retirar a política) ou a recompensa hacking está começando.

### Passo 5: receita de produção com TRL

Uma vez que compreendemos o pipeline de brinquedos, aqui está o mesmo ciclo que um usuário de biblioteca real escreve.[TRL](https://huggingface.co/docs/trl)é a aplicação de referência  `RewardTrainer`para a fase 2 e `PPOTrainer`(com um KL-to-reference incorporado) para a fase 3.

```python
# Stage 2: reward model from pairwise preferences
from trl import RewardTrainer, RewardConfig
from transformers import AutoModelForSequenceClassification, AutoTokenizer

tok = AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-8B-Instruct")
rm = AutoModelForSequenceClassification.from_pretrained(
    "meta-llama/Llama-3.1-8B-Instruct", num_labels=1
)

# dataset rows: {"prompt", "chosen", "rejected"} — Bradley-Terry format
trainer = RewardTrainer(
    model=rm,
    tokenizer=tok,
    train_dataset=preference_data,
    args=RewardConfig(output_dir="./rm", num_train_epochs=1, learning_rate=1e-5),
)
trainer.train()
```

```python
# Stage 3: PPO against the RM with KL penalty to the SFT reference
from trl import PPOTrainer, PPOConfig, AutoModelForCausalLMWithValueHead

policy = AutoModelForCausalLMWithValueHead.from_pretrained("./sft-checkpoint")
ref    = AutoModelForCausalLMWithValueHead.from_pretrained("./sft-checkpoint")  # frozen

ppo = PPOTrainer(
    config=PPOConfig(learning_rate=1.41e-5, batch_size=64, init_kl_coef=0.05,
                     target_kl=6.0, adap_kl_ctrl=True),
    model=policy, ref_model=ref, tokenizer=tok,
)

for batch in dataloader:
    responses = ppo.generate(batch["query_ids"], max_new_tokens=128)
    rewards   = rm(torch.cat([batch["query_ids"], responses], dim=-1)).logits[:, 0]
    stats     = ppo.step(batch["query_ids"], responses, rewards)
    # stats includes: mean_kl, clip_frac, value_loss — the three PPO diagnostics
```

Três coisas que a biblioteca faz por ti.`adap_kl_ctrl=True`implementa o cronograma de adaptação-β: se a KL observada exceder `target_kl`O modelo de referência é congelado por convenção  não se podem compartilhar acidentalmente os parâmetros com `policy`E a cabeça de valor vive na mesma espinha dorsal que a política (`AutoModelForCausalLMWithValueHead`O TRL informa que o TRL não pode ser utilizado para a produção de produtos de qualidade.`policy/kl`E ...`value/loss`separadamente.

## Encurralagens

- **Over-optimization / reward hacking.**O RM é imperfeito .$\pi_\theta$Os sintomas: recompensa sobe indefinidamente enquanto a avaliação humana pontuação planícies ou descontos.$\beta$, ampliar os dados de formação RM.
- **Length hacking.**Os RMs treinados em respostas úteis muitas vezes recompensam implícitamente a duração. A política aprende a encher as respostas. Remediação: recompensa normalizada em comprimento, ou RLAIF com uma RM consciente de comprimento.
- **Too-small RM.**O RM tem de ser pelo menos tão grande quanto a política.
- **KL tuning.**O método de manipulação é um método de manipulação de dados que é utilizado para determinar o valor de um sistema de transferência de dados.
- **Preference-data noise.**- 30% das etiquetas humanas são barulhentas ou ambíguas.
- **Off-policy problems.**Os dados de PPO são ligeiramente fora da política após a primeira época.

## Usá-lo

O RLHF em 2026 é revestido:

| Layer | Target | Method |
|-------|--------|--------|
| Instruction following, helpfulness, harmlessness | Alignment | DPO (Phase 10 · 08) preferred over RLHF-PPO. |
| Reasoning correctness (math, code) | Capability | GRPO with verifier reward (Phase 9 · 12). |
| Long-horizon multi-step tasks | Agentic | PPO / GRPO with process reward models over steps. |
| Safety / refusal behavior | Safety | RLHF-PPO with separate safety RM, or Constitutional AI. |
| Best-of-N at inference | Fast alignment | Use RM at decode time; no policy training needed. |
| Reward distillation | Inference compute | Train a small "reward head" on top of a frozen LM. |

O RLHF foi o método em 2022-2024. Em 2026, os canais de alinhamento de produção são DPO-primeiro, PPO-apenas para as etapas de RM-intensiva ou de segurança crítica.

## Envia-o

Salva como`outputs/skill-rlhf-architect.md`- Não .

```markdown
---
name: rlhf-architect
description: Design an RLHF / DPO / GRPO alignment pipeline for a language model, including RM, KL, and data strategy.
version: 1.0.0
phase: 9
lesson: 9
tags: [rl, rlhf, alignment, llm]
---

Given a base LM, a target behavior (alignment / reasoning / refusal / agent), and a preference or verifier budget, output:

1. Stage. SFT? RM? DPO? GRPO? With justification.
2. Preference or verifier source. Humans, AI feedback, rule-based, unit-test-pass, or reward distillation.
3. KL strategy. Fixed β, adaptive β, or DPO (implicit KL).
4. Diagnostics. Mean KL, reward stability, over-optimization guard (holdout human eval).
5. Safety gate. Red-team set, refusal rate, safety RM separate from helpfulness RM.

Refuse to ship RLHF-PPO without a KL monitor. Refuse to use an RM smaller than the target policy. Refuse length-only rewards. Flag any pipeline that does not hold back a blind human-eval set as lacking over-optimization protection.
```

## Exercícios

1. **Easy.**Treinar o modelo de recompensa Bradley-Terry em`code/main.py`Em 500 pares sintéticos de preferência, medir a precisão em pares em 100 pares de mão. Deve exceder 90%.
2. **Medium.**Execute o loop de brinquedo PPO-RLHF com $\beta \in \lbrace 0.0, 0.1, 1.0 \rbrace$Para cada um, o resultado da RM vs. KL-to-referência sobre as atualizações.
3. **Hard.**Implementar DPO (perda de probabilidade de preferência de forma fechada) sobre os mesmos dados de preferência e comparar com o pipeline RLHF-PPO em cálculo utilizado e pontuação final RM alcançada.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| RLHF | "Alignment RL" | Three-stage SFT + RM + PPO pipeline (Christiano 2017, Ouyang 2022). |
| Reward Model (RM) | "The scoring net" | Learned scalar function fit to pairwise preferences via Bradley-Terry. |
| Bradley-Terry | "Pairwise logistic loss" | $P(y_+ \succ y_-) = \sigma(R(y_+) - R(y_-))$; the standard RM objective. |
| KL penalty | "Stay near the reference" | $\beta \cdot \mathrm{KL}(\pi_\theta \Vert \pi_{\text{ref}})$ in the reward; the anti-reward-hacking regularizer. |
| Reward hacking | "Goodhart's law" | Policy exploits RM flaws; symptoms: reward up, human eval flat. |
| RLAIF | "AI-labeled preferences" | RLHF where labels come from another LM instead of humans. |
| PRM | "Process Reward Model" | Scores partial reasoning steps; used in reasoning pipelines. |
| Constitutional AI | "Anthropic's method" | AI-generated preferences guided by explicit rules. |

## Mais leitura

- [Christiano et al. (2017). Deep Reinforcement Learning from Human Preferences](https://arxiv.org/abs/1706.03741)O jornal que iniciou a RLHF.
- [Ouyang et al. (2022). InstructGPT — Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155) a receita por trás do ChatGPT.
- [Stiennon et al. (2020). Learning to summarize with human feedback](https://arxiv.org/abs/2009.01325) RLHF anterior para resumo.
- [Rafailov et al. (2023). Direct Preference Optimization](https://arxiv.org/abs/2305.18290) DPO; o padrão pós-RLHF em 2026.
- [Bai et al. (2022). Constitutional AI: Harmlessness from AI Feedback](https://arxiv.org/abs/2212.08073) RLAIF e ciclo de autocrítica.
- [Anthropic RLHF paper (Bai et al. 2022). Training a Helpful and Harmless Assistant](https://arxiv.org/abs/2204.05862)O papel da HH.
- [Hugging Face TRL library](https://huggingface.co/docs/trl) produção `RewardTrainer`E ...`PPOTrainer`Leia a fonte do treinador para os detalhes de KL adaptativo e de valor.
- [Hugging Face — Illustrating Reinforcement Learning from Human Feedback](https://huggingface.co/blog/rlhf)por Lambert, Castricato, von Werra, Havrilla  o caminhão canônico do oleoduto de três etapas com diagramas.
- [von Werra et al. (2020). TRL: Transformer Reinforcement Learning](https://github.com/huggingface/trl) a biblioteca; `examples/`tem end-to-end RLHF scripts para Llama, Mistral e Qwen.
- [Sutton & Barto (2018). Ch. 17.4 — Designing Reward Signals](http://incompleteideas.net/book/RLbook2020.pdf) a visão da hipótese de recompensa; pré-requisito essencial para pensar no hacking de recompensa.
