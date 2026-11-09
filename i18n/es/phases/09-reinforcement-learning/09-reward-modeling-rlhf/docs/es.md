# Modelado de recompensas y RLHF

> Los humanos no pueden escribir una función de recompensa para "buena respuesta de asistente", pero pueden comparar dos respuestas y elegir la mejor. Ajuste un modelo de recompensa a esas comparaciones, luego RL el modelo de lenguaje en contra de ella. Cristiano 2017.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 05 (Sentiment), Phase 9 · 08 (PPO)
**Time:** ~45 minutes

## El problema

Usted entrenó un modelo de lenguaje en el objetivo de predicción de tokens. Escribe inglés gramatical. También miente, vagabundea y se niega a rechazar. No se puede arreglar esto con más preentrenamiento.

Si quieres una recompensa *escalar* que diga "respuesta A es mejor que respuesta B para instrucción X". Es imposible escribir esa función de recompensa a mano. "Helpfulness" no es una expresión de forma cerrada sobre tokens. Pero los humanos pueden comparar dos salidas y marcar una preferencia. Eso es barato para recoger en escala.

RLHF (Christiano et al. 2017; Ouyang et al. 2022) convierte las preferencias en un modelo de recompensa, luego optimiza el LM a través de PPO en contra de esa recompensa. En tres pasos: SFT → RM → PPO. Es la receta que envió ChatGPT, Claude, Gemini y todos los demás LLM alineados en 20232025.

En 2026 el paso PPO se sustituye principalmente por DPO (Fase 10 · 08) porque es más barato y casi tan bueno para la sintonización de alineamientos. Pero la pieza de modelo de recompensa sigue siendo la base de cada muestreo Best-of-N, cada RL-from-verifiable-rewards pipeline, y cada modelo de razonamiento que utiliza un modelo de recompensa de proceso.

## El concepto

![Three-stage RLHF: SFT, RM training on pairwise prefs, PPO with KL penalty](../assets/rlhf.svg)

**Stage 1: Supervised Fine-Tuning (SFT).**Comienza con un modelo base pre-entrenado. Enfine las demostraciones escritas por el hombre del comportamiento objetivo (respuestas que siguen instrucciones, respuestas útiles, etc.). Resultado: un modelo $\pi_{\text{SFT}}$que es *preciado hacia el buen comportamiento* pero todavía tiene un espacio de acción ilimitado.

**Stage 2: Reward Model training.**

- Recoger pares de respuestas $(y_+, y_-)$a las instrucciones $x$, etiquetado por los seres humanos como "y_+ es preferido sobre y_-."
- Entrenar un modelo de recompensa$R_\phi(x, y)$para asignar puntuaciones más altas a $y_+$¿ Qué ?
- Las pérdidas:**Bradley-Terry pairwise logistic**¿Qué es esto ?

  $L(\phi) = -\mathbb{E}[ \log \sigma(R_\phi(x, y_+) - R_\phi(x, y_-)) ]$

  $\sigma$BT ha sido el estándar desde 1952 (Bradley-Terry) y es la opción dominante en la moderna RLHF.

- $R_\phi$El modelo de transformer de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de la base de datos.

**Stage 3: PPO against the RM with KL penalty.**

- Iniciar la política de capacitación $\pi_\theta$de la$\pi_{\text{SFT}}$Mantenga una referencia congelada.$\pi_{\text{ref}} = \pi_{\text{SFT}}$¿ Qué ?
- Recompensa al final de una respuesta $y$¿Qué es esto ?

  $r_{\text{total}}(x, y) = R_\phi(x, y) - \beta \cdot \mathrm{KL}(\pi_\theta(\cdot \mid x) \Vert \pi_{\text{ref}}(\cdot \mid x))$

  La penalidad de KL impide$\pi_\theta$de la deriva arbitraria de $\pi_{\text{SFT}}$ es un *regularizador*, no una región de confianza difícil. $\beta$generalmente entre 0,01-0,05.
- ejecuta PPO (Ley 08) con esta recompensa. Las ventajas se calculan en la trayectoria de nivel de token, pero el RM marca solo la respuesta completa.

**Why the KL?**Sin él, PPO encontrará estrategias de hackeo de recompensas  el RM sólo fue entrenado en completos en distribución. Una respuesta fuera de distribución podría tener un puntaje más alto que cualquier otro escrito por humanos.$\pi_\theta$Es el nodo más importante en el RLHF.

**2026 status:**

- **DPO**(Rafailov 2023): el álgebra de forma cerrada se desploma en la etapa 2 + 3 en una sola pérdida supervisada sobre los datos de preferencia. No RM, no PPO. La misma calidad en los puntos de referencia de alineación para una fracción del cálculo.
- **GRPO**(DeepSeek 20242025): PPO con un baseline relativo al grupo en lugar de un crítico, recompensa de un *verificador* (codificación / correspondencias matemáticas) en lugar de un RM entrenado por el hombre.
- **Process reward models (PRMs):**soluciones parciales de puntaje (cada paso de razonamiento), utilizadas tanto en las variantes RLHF como en las GRPO para el razonamiento.
- **Constitutional AI / RLAIF:**El programa de investigación de la Comisión de Investigación y Desarrollo de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación de la Investigación

```figure
reward-model
```

## Construye el mismo

Esta lección utiliza pequeñas "invitaciones" y "respuestas" sintéticas representadas como cuerdas. El RM es un punteador lineal sobre una representación de bolsa de fichas.`code/main.py`¿ Qué ?

### Paso 1: Datos de preferencias sintéticas

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

En el RLHF real, esto es reemplazado por etiquetadores humanos.`(prompt, preferred_response, rejected_response)` es idéntico.

### Paso 2: modelo de recompensa Bradley-Terry

Punto lineal: `R(x, y) = w · bag(y)`. Entrenamiento para minimizar la pérdida de registro de BT en parejas:

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

Después de unos cientos de actualizaciones,`w`asigna pesos positivos a los tokens de buenas palabras y negativos a los malos.

### Paso 3: Política similar a la PPO en la parte superior de RM

Nuestra política de juguetes produce un solo token de un vocabulario.$\log \pi_\theta(\text{token} \mid \text{prompt})$, añadir una penalidad KL-a-referencia, y aplicar el recortado PPO sustituta.

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

### Paso 4: Monitorear el KL

Mediano de pista$\mathrm{KL}(\pi_\theta \Vert \pi_{\text{ref}})$Cada actualización. Si se hace pasar.`~5-10`(KL por respuesta en nats, sumado en tokens, el registro unitario de TRL) la política se ha alejado mucho de $\pi_{\text{SFT}}$: o $\beta$es demasiado bajo (alza para retirar la póliza) o el hacking de recompensa está comenzando. Este es el diagnóstico superior en RLHF real.

### Paso 5: receta de producción con TRL

Una vez que entiendes la línea de juguetes, aquí hay el mismo bucle que un usuario de biblioteca real lo escribe.[TRL](https://huggingface.co/docs/trl)es la aplicación de referencia  `RewardTrainer`para la etapa 2 y `PPOTrainer`(con un KL-to-reference incorporado) para la etapa 3.

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

Tres cosas que la biblioteca hace por ti.`adap_kl_ctrl=True`se aplica el calendario de adaptación-β: si el KL observado excede `target_kl`El modelo de referencia está congelado por convención  no se pueden compartir accidentalmente los parámetros con `policy`Y el valor de la cabeza vive en la misma espina dorsal que la póliza (`AutoModelForCausalLMWithValueHead`se une una cabeza de MLP escalar), por lo que TRL informa `policy/kl`y `value/loss`por separado.

## Las trampas

- **Over-optimization / reward hacking.**El RM es imperfecto .$\pi_\theta$Los síntomas: la recompensa sube indefinidamente mientras que la evaluación humana califica plateaos o bajas.$\beta$, ampliar los datos de formación RM.
- **Length hacking.**Las RM entrenadas en respuestas útiles a menudo recompensan implícitamente la longitud. La política aprende a cubrir las respuestas.
- **Too-small RM.**El RM tiene que ser al menos tan grande como la póliza.
- **KL tuning.**El método estándar es un método de *adaptiva* β que se dirige a un KL fijo por paso.
- **Preference-data noise.**- 30% de las etiquetas humanas son ruidosas o ambigüas. Calibrar mediante la formación del RM en datos filtrados por acuerdo o utilizar una temperatura en BT.
- **Off-policy problems.**Los datos de PPO son ligeramente fuera de política después de la primera época.

## Usalo

El RLHF en 2026 se superponerá a capas:

| Layer | Target | Method |
|-------|--------|--------|
| Instruction following, helpfulness, harmlessness | Alignment | DPO (Phase 10 · 08) preferred over RLHF-PPO. |
| Reasoning correctness (math, code) | Capability | GRPO with verifier reward (Phase 9 · 12). |
| Long-horizon multi-step tasks | Agentic | PPO / GRPO with process reward models over steps. |
| Safety / refusal behavior | Safety | RLHF-PPO with separate safety RM, or Constitutional AI. |
| Best-of-N at inference | Fast alignment | Use RM at decode time; no policy training needed. |
| Reward distillation | Inference compute | Train a small "reward head" on top of a frozen LM. |

El RLHF fue el método en 2022-2024. En 2026, las tuberías de alineación de producción son DPO-primero, PPO-solo para las etapas de RM-intensivas o críticas a la seguridad.

## Envío

Salvo como`outputs/skill-rlhf-architect.md`¿Qué es esto ?

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

## Los ejercicios

1. **Easy.**Entrenemos el modelo de recompensa Bradley-Terry en .`code/main.py`En el caso de las piezas de la serie, el valor de la precisión de la medida es de un par de 100 pares.
2. **Medium.**Ejecutar el bucle de juguete PPO-RLHF con $\beta \in \lbrace 0.0, 0.1, 1.0 \rbrace$Para cada uno, compro RM puntuación vs KL-a-referencia sobre las actualizaciones. ¿Cuál ejecuta recompensa-hack?
3. **Hard.**Implemente DPO (perdida de probabilidad de preferencia en forma cerrada) en los mismos datos de preferencia y compare con el oleoducto RLHF-PPO en el cálculo utilizado y el puntaje final RM obtenido.

## Términos clave

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

## Leer más

- [Christiano et al. (2017). Deep Reinforcement Learning from Human Preferences](https://arxiv.org/abs/1706.03741) el periódico que comenzó RLHF.
- [Ouyang et al. (2022). InstructGPT — Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155) la receta detrás de ChatGPT.
- [Stiennon et al. (2020). Learning to summarize with human feedback](https://arxiv.org/abs/2009.01325) RLHF anterior para su resumen.
- [Rafailov et al. (2023). Direct Preference Optimization](https://arxiv.org/abs/2305.18290) DPO; el incumplimiento posterior al RLHF en 2026.
- [Bai et al. (2022). Constitutional AI: Harmlessness from AI Feedback](https://arxiv.org/abs/2212.08073) RLAIF y circuito de autocrítica.
- [Anthropic RLHF paper (Bai et al. 2022). Training a Helpful and Harmless Assistant](https://arxiv.org/abs/2204.05862) el papel de HH.
- [Hugging Face TRL library](https://huggingface.co/docs/trl) producción `RewardTrainer`y `PPOTrainer`. Lea la fuente del entrenador para los detalles de KL y valor de cabeza.
- [Hugging Face — Illustrating Reinforcement Learning from Human Feedback](https://huggingface.co/blog/rlhf)por Lambert, Castricato, von Werra, Havrilla  el paseo canónico de la tubería de tres etapas con diagramas.
- [von Werra et al. (2020). TRL: Transformer Reinforcement Learning](https://github.com/huggingface/trl) la biblioteca; `examples/`tiene guiones de extremo a extremo RLHF para Llama, Mistral y Qwen.
- [Sutton & Barto (2018). Ch. 17.4 — Designing Reward Signals](http://incompleteideas.net/book/RLbook2020.pdf) la visión de la hipótesis de recompensa; condición esencial para pensar en el hacking de recompensa.
