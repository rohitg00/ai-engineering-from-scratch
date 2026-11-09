# Modélisation des récompenses et RLHF

> Les humains ne peuvent pas écrire une fonction de récompense pour " bonne réponse assistante ", mais ils peuvent comparer deux réponses et choisir la meilleure. Ajustez un modèle de récompense à ces comparaisons, puis RL le modèle de langue contre lui. Christiano 2017. InstructGPT 2022. La recette qui a transformé GPT-3 en ChatGPT. En 2026 il est principalement remplacé par DPO  mais le modèle mental reste.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 05 (Sentiment), Phase 9 · 08 (PPO)
**Time:** ~45 minutes

## Le problème

Vous avez formé un modèle de langage sur l'objectif de prédiction du prochain jeton. Il écrit l'anglais grammatical. Il ment aussi, vagabondage et refuse de refuser. Vous ne pouvez pas résoudre cela avec plus de prétrainement.

Vous voulez une * récompense à l'échelle* qui dit " la réponse A est meilleure que la réponse B pour l'instruction X. " Écrire cette fonction de récompense à la main est impossible. " Aide " n'est pas une expression de forme fermée sur des jetons. Mais les humains peuvent comparer deux sorties et marquer une préférence.

RLHF (Christiano et coll. 2017; Ouyang et coll. 2022) convertit les préférences en un modèle de récompense, puis optimise le LM via PPO contre cette récompense. En trois étapes: SFT → RM → PPO. C'est la recette qui a expédié ChatGPT, Claude, Gemini et tous les autres alignés-LLM en 20232025.

En 2026, la phase PPO est principalement remplacée par la phase 10 · 08, car elle est moins chère et presque aussi bonne pour l'ajustement de l'alignement. Mais la pièce * modèle de récompense * est toujours à la base de chaque échantillonneur Best-of-N, chaque pipeline RL-from-verifiable-rewards, et chaque modèle de raisonnement utilisant un modèle de récompense de processus.

## Le concept

![Three-stage RLHF: SFT, RM training on pairwise prefs, PPO with KL penalty](../assets/rlhf.svg)

**Stage 1: Supervised Fine-Tuning (SFT).**Commencez par un modèle de base prétrainé. Définition sur des démonstrations écrites par l'homme du comportement cible (réactions à la suite d'instructions, réponses utiles, etc.).$\pi_{\text{SFT}}$qui est *biased vers le bon comportement* mais a toujours un espace d'action illimité.

**Stage 2: Reward Model training.**

- Rassembler des paires de réponses $(y_+, y_-)$à des invites $x$, étiqueté par les humains comme "y_+ est préférable à y_-. "
- Formez un modèle de récompense $R_\phi(x, y)$pour attribuer des scores plus élevés à $y_+$- Je suis désolé .
- Perte: le **Bradley-Terry pairwise logistic**- Le numéro de la liste:

  $L(\phi) = -\mathbb{E}[ \log \sigma(R_\phi(x, y_+) - R_\phi(x, y_-)) ]$

  $\sigma$La différence de récompense implique une probabilité de préférence. BT est la norme depuis 1952 (Bradley-Terry) et est le choix dominant dans la RLHF moderne.

- $R_\phi$Le modèle SFT est généralement initialement défini avec une tête scalaire en haut.

**Stage 3: PPO against the RM with KL penalty.**

- Initialiser la politique de formation $\pi_\theta$de $\pi_{\text{SFT}}$Gardez une référence gelée.$\pi_{\text{ref}} = \pi_{\text{SFT}}$- Je suis désolé .
- Récompense à la fin d' une réponse $y$- Le numéro de la liste:

  $r_{\text{total}}(x, y) = R_\phi(x, y) - \beta \cdot \mathrm{KL}(\pi_\theta(\cdot \mid x) \Vert \pi_{\text{ref}}(\cdot \mid x))$

  La pénalité de KL empêche $\pi_\theta$de dériver arbitrairement de $\pi_{\text{SFT}}$ il s'agit d'un régulateur, pas d'une région de confiance difficile. $\beta$généralement de 0,01-0,05.
- Exécutez PPO (Léction 08) avec cette récompense.

**Why the KL?**Sans elle, le PPO trouvera heureusement des stratégies de piratage des récompenses  le RM n'a été formé que sur les réalisations en distribution.$\pi_\theta$C'est le bouton le plus important de la RLHF.

**2026 status:**

- **DPO**(Rafailov 2023): l'algèbre de forme fermée s'effondre en une seule perte supervisée sur les données de préférence. Aucun RM, aucun PPO. La même qualité sur les points de référence d'alignement pour une fraction du calcul.
- **GRPO**(DeepSeek 20242025): PPO avec une base de référence relative au groupe au lieu d'un critique, récompense d'un *verifier* (code run / maths answers matches) au lieu d'un RM formé par l'homme. Dominant pour les modèles de raisonnement. couvert dans la phase 9 · 12.
- **Process reward models (PRMs):**Les solutions partielles de score (chaque étape de raisonnement), utilisées dans les variantes RLHF et GRPO pour le raisonnement.
- **Constitutional AI / RLAIF:**Il est important de noter que les entreprises peuvent utiliser un LLM aligné pour générer des préférences au lieu d'utiliser des humains.

```figure
reward-model
```

## Faites-le

Cette leçon utilise de minuscules "interrogations" et "réactions" synthétiques représentées sous forme de chaînes. Le RM est un marqueur linéaire sur une représentation de sac de jetons.`code/main.py`- Je suis désolé .

### Étape 1: données de préférence synthétiques

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

Dans la vraie RLHF, cette étiquette est remplacée par des étiquettes humaines.`(prompt, preferred_response, rejected_response)` est identique.

### Étape 2: Modèle de récompense Bradley-Terry

Score linéaire: `R(x, y) = w · bag(y)`- Trainer pour minimiser les pertes de logs par couples BT:

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

Après quelques centaines de mises à jour,`w`assigne des poids positifs aux bons mots et négatifs aux mauvais.

### Étape 3: Politique de PPO en plus de RM

Notre politique de jouets produit un seul jeton à partir d'un vocabulaire.$\log \pi_\theta(\text{token} \mid \text{prompt})$, ajouter une pénalité KL à référence, et appliquer le coupé PPO substitué.

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

### Étape 4: surveiller le KL

La moyenne de la piste $\mathrm{KL}(\pi_\theta \Vert \pi_{\text{ref}})$chaque mise à jour.`~5-10`(KL par réponse en nats, résumé sur des jetons, les journaux unitaires TRL) la politique a dérivé loin de $\pi_{\text{SFT}}$: soit $\beta$est trop bas (le relevez pour retirer la politique) ou le piratage de la récompense commence.

### Étape 5: la recette de production avec RTR

Une fois que vous comprenez le pipeline de jouets, voici la même boucle qu'un véritable utilisateur de bibliothèque l'écrit.[TRL](https://huggingface.co/docs/trl)est la mise en œuvre de référence  `RewardTrainer`pour la phase 2 et `PPOTrainer`(avec un KL-to-reference intégré) pour la phase 3.

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

Trois choses que la bibliothèque fait pour vous.`adap_kl_ctrl=True`met en œuvre le calendrier adaptatif-β: si le KL observé dépasse `target_kl`Le modèle de référence est gelé par convention  vous ne devez pas partager accidentellement des paramètres avec `policy`La valeur de la tête de la police est la même que celle de la police (`AutoModelForCausalLMWithValueHead`Il est également possible de faire une mise en place de la TRL.`policy/kl`et `value/loss`séparément.

## Les pièges

- **Over-optimization / reward hacking.**Le RM est imparfait .$\pi_\theta$Les symptômes: la récompense monte indéfiniment tandis que le score humain d'évaluation atteint des plateaux ou des chutes.$\beta$- l'élargissement des données de formation RM.
- **Length hacking.**Les RM formés sur des réponses utiles récompensent souvent implicitement la longueur.
- **Too-small RM.**Une petite somme ne peut pas évaluer fidèlement les résultats de la police.
- **KL tuning.**La politique de détection de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur est est est est est est est est est de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur
- **Preference-data noise.**- 30% des étiquettes humaines sont bruyantes ou ambiguës.
- **Off-policy problems.**Les données de PPO sont légèrement hors politique après la première époque.

## Utilisez-le

Le RLHF en 2026 est couché:

| Layer | Target | Method |
|-------|--------|--------|
| Instruction following, helpfulness, harmlessness | Alignment | DPO (Phase 10 · 08) preferred over RLHF-PPO. |
| Reasoning correctness (math, code) | Capability | GRPO with verifier reward (Phase 9 · 12). |
| Long-horizon multi-step tasks | Agentic | PPO / GRPO with process reward models over steps. |
| Safety / refusal behavior | Safety | RLHF-PPO with separate safety RM, or Constitutional AI. |
| Best-of-N at inference | Fast alignment | Use RM at decode time; no policy training needed. |
| Reward distillation | Inference compute | Train a small "reward head" on top of a frozen LM. |

En 2026, les pipelines d'alignement de production sont DPO-first, PPO-only pour les étapes de RM-intensive ou critiques pour la sécurité.

## La faire partir

- Je ne sais pas .`outputs/skill-rlhf-architect.md`- Le numéro de la liste:

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

## Exercices

1. **Easy.**Entrenez le modèle de récompense Bradley-Terry .`code/main.py`sur 500 paires de préférence synthétiques. Mesurer par paires la précision sur 100 paires de préférence.
2. **Medium.**Réglez la boucle de jouets PPO-RLHF avec $\beta \in \lbrace 0.0, 0.1, 1.0 \rbrace$Pour chaque score, le score RM par rapport au KL à la référence sur les mises à jour.
3. **Hard.**Mettre en œuvre le DPO (perte de probabilité de préférence de forme fermée) sur les mêmes données de préférence et comparer avec le pipeline RLHF-PPO en calcul utilisé et le score final RM obtenu.

## Les termes clés

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

## Pour en savoir plus

- [Christiano et al. (2017). Deep Reinforcement Learning from Human Preferences](https://arxiv.org/abs/1706.03741)Le journal qui a lancé RLHF.
- [Ouyang et al. (2022). InstructGPT — Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155) la recette derrière le ChatGPT.
- [Stiennon et al. (2020). Learning to summarize with human feedback](https://arxiv.org/abs/2009.01325) RLHF antérieur pour résumé.
- [Rafailov et al. (2023). Direct Preference Optimization](https://arxiv.org/abs/2305.18290) DPO; le défaut post-RLHF en 2026.
- [Bai et al. (2022). Constitutional AI: Harmlessness from AI Feedback](https://arxiv.org/abs/2212.08073) RLAIF et boucle d'autocritique.
- [Anthropic RLHF paper (Bai et al. 2022). Training a Helpful and Harmless Assistant](https://arxiv.org/abs/2204.05862)- Le papier HH.
- [Hugging Face TRL library](https://huggingface.co/docs/trl) production `RewardTrainer`et `PPOTrainer`- Lisez la source de l'entraîneur pour les détails de la KL adaptative et de la valeur de tête.
- [Hugging Face — Illustrating Reinforcement Learning from Human Feedback](https://huggingface.co/blog/rlhf)par Lambert, Castricato, von Werra, Havrilla  la marche canonique du pipeline en trois étapes avec des diagrammes.
- [von Werra et al. (2020). TRL: Transformer Reinforcement Learning](https://github.com/huggingface/trl) la bibliothèque; `examples/`Il a des scripts RLHF de bout en bout pour Llama, Mistral et Qwen.
- [Sutton & Barto (2018). Ch. 17.4 — Designing Reward Signals](http://incompleteideas.net/book/RLbook2020.pdf) la vision de l'hypothèse de récompense; condition préalable essentielle pour penser au piratage de la récompense.
