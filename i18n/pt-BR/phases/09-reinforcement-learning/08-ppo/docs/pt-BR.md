# Otimizar as políticas próximas (PPO)

> A A2C descarta cada implementação após uma atualização. O PPO envolve o gradiente da política em uma relação de importância reduzida para que você possa fazer 10+ épocas nos mesmos dados sem a política explodir. Schulman et al. (2017). Ainda o algoritmo padrão de gradiente da política em 2026.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 06 (REINFORCE), Phase 9 · 07 (Actor-Critic)
**Time:** ~75 minutes

## O problema

A2C (Lessão 07) é sobre política: o gradiente $\mathbb E_{\pi_\theta}[A \cdot \nabla \log \pi_\theta]$requer dados recolhidos a partir da * corrente* $\pi_\theta$- Faça uma atualização e...$\pi_\theta$Os dados que usou agora estão fora da política.

As implementações são caras. Na Atari, uma implementação em 8 envs × 128 passos = 1024 transições e uma dúzia de segundos de tempo ambiental.

A Primeira solução foi a otimização das políticas de região de confiança (TRPO, Schulman 2015): restringir cada atualização para que a divergência entre as políticas antigas e novas permaneça abaixo $\delta$Teoricamente limpo, mas requer uma solução conjugada-gradiente por atualização.

O PPO (Schulman et al. 2017) substitui a restrição de região de confiança dura por um objetivo simples. Uma linha extra de código. Dez épocas por implantação. Nenhum gradiente conjugado. Garantias teóricas boas o suficiente. Nove anos depois, ainda é o algoritmo padrão de política-gradiente para tudo, desde MuJoCo até RLHF.

## O conceito

![PPO clipped surrogate objective: ratio clipping at 1 ± ε](../assets/ppo.svg)

**The importance ratio.**

```math
r_t(\theta) = \frac{\pi_\theta(a_t \mid s_t)}{\pi_{\theta_{\text{old}}}(a_t \mid s_t)}
```

Esta é a relação de probabilidade entre a nova política e a política que recolheu os dados. $r_t = 1$Não significa nenhuma mudança.$r_t = 2$significa que a nova política é duas vezes mais provável que$a_t$Como os antigos.

**The clipped surrogate.**

```math
L^{\text{CLIP}}(\theta) = \mathbb{E}_t \left[ \min\left( r_t(\theta) A_t, \mathop{\mathrm{clip}}(r_t(\theta), 1-\epsilon, 1+\epsilon) A_t \right) \right]
```

Dois termos:

- Se a vantagem $A_t > 0$E a proporção tenta crescer para além.$1 + \epsilon$, o clip aplania a gradiente  não empurrar uma boa ação mais longe do que $+\epsilon$acima da velha probabilidade.
- Se a vantagem $A_t < 0$e a proporção tenta cair abaixo.$1 - \epsilon$(o que significa que faríamos uma ação ruim muito menos provável do que a velha política fez), o clip aplania a gradiente: não empurrar uma ação ruim mais longe do que $-\epsilon$abaixo da velha probabilidade.

O `min`O que é que se passa? - Não, não.

Tipico .$\epsilon = 0.2$. Descrever o objectivo como uma função de $r_t$A função linear de pedaço com um telhado plano no "lado bom" e um piso plano no "lado ruim".

**The full PPO loss.**

```math
L(\theta, \phi) = L^{\text{CLIP}}(\theta) - c_v \cdot (V_\phi(s_t) - V_t^{\text{target}})^2 + c_e \cdot H(\pi_\theta(\cdot \mid s_t))
```

A mesma estrutura de actores-críticos que A2C. Três coeficientes, geralmente $c_v = 0.5$- Não .$c_e = 0.01$- Não .$\epsilon = 0.2$- Não .

**The training loop.**

1. Coletar$N \times T$Transições transversais $N$Envistas paralelas para $T$Cada passo.
2. Calcule vantagens (GAE), congelem-nas como constantes.
3. Congelando .$\pi_{\theta_{\text{old}}}$como um instantâneo de corrente $\pi_\theta$- Não .
4. Para o$K$Epoca, para cada minipartida de `(s, a, A, V_target, log π_old(a|s))`- Não .
   - Computação$r_t(\theta) = \exp(\log \pi_\theta(a \mid s) - \log \pi_{\text{old}}(a \mid s))$- Não .
   - Aplicar$L^{\text{CLIP}}$+ perda de valor + entropia.
   - Passo gradual.
5. Descarte o lançamento, volte ao primeiro passo.

$K = 10$O PPO é robusto: os números exatos raramente importam dentro de ±50%.

**KL-penalty variant.**O artigo original propôs uma alternativa que utilizasse uma penalidade KL adaptativa: $L = L^{\text{PG}} - \beta \cdot \mathrm{KL}(\pi_\theta \Vert \pi_{\text{old}})$com$\beta$A versão de corte tornou-se dominante; a variante KL sobrevive no RLHF (onde KL à política de referência é uma restrição separada que você sempre quer de qualquer maneira).

```figure
ppo-clip
```

## Construí-lo

### Passo 1: Captura`log π_old(a | s)`no momento da implantação

```python
for step in range(T):
    probs = softmax(logits(theta, state_features(s)))
    a = sample(probs, rng)
    s_next, r, done = env.step(s, a)
    buffer.append({
        "s": s, "a": a, "r": r, "done": done,
        "v_old": value(w, state_features(s)),
        "log_pi_old": log(probs[a] + 1e-12),
    })
    s = s_next
```

A imagem é tirada uma vez, no momento da implantação.

### Passo 2: calcular as vantagens do GAE (Lessão 07)

A mesma coisa que o A2C. Normaliza-se ao longo do lote.

### Passo 3: atualização de substituição cortada

```python
for _ in range(K_EPOCHS):
    for mb in minibatches(buffer, size=64):
        for rec in mb:
            x = state_features(rec["s"])
            probs = softmax(logits(theta, x))
            logp = log(probs[rec["a"]] + 1e-12)
            ratio = exp(logp - rec["log_pi_old"])
            adv = rec["advantage"]
            surrogate = min(
                ratio * adv,
                clamp(ratio, 1 - EPS, 1 + EPS) * adv,
            )
            # backprop -surrogate, add value loss, subtract entropy
            grad_logpi = onehot(rec["a"]) - probs
            if (adv > 0 and ratio >= 1 + EPS) or (adv < 0 and ratio <= 1 - EPS):
                pg_grad = 0.0  # clipped
            else:
                pg_grad = ratio * adv
            for i in range(N_ACTIONS):
                for j in range(N_FEAT):
                    theta[i][j] += LR * pg_grad * grad_logpi[i] * x[j]
```

O padrão de "gradiente de corte → zero" é o coração da PPO. Se a nova política já se desviou muito longe na direcção benéfica, a atualização pára.

### Passo 4: valor e entropia

Adicionar MSE padrão ao alvo crítico e um bônus de entropia no ator, igual ao A2C.

### Passo 5: diagnóstico

Três coisas para ver em cada atualização:

- **Mean KL** $\mathbb{E}[\log \pi_{\text{old}} - \log \pi_\theta]$Devia ficar dentro .`[0, 0.02]`Se passar por aí .`0.1`, reduzir`K_EPOCHS`ou `LR`- Não .
- **Clip fraction** a fracção das amostras cuja proporção se encontra fora $[1-\epsilon, 1+\epsilon]$Devia ser .`~0.1-0.3`Se ...`~0`, o clip nunca desencadeia → aumento `LR`ou `K_EPOCHS`Se ...`~0.5+`, você está super-ajustando a implantação → baixá-los.
- **Explained variance** $1 - \text{Var}(V_{\text{target}} - V_{\text{pred}}) / \text{Var}(V_{\text{target}})$Metrica de qualidade crítica. Deve subir para 1.

## Encurralagens

- **Clip coefficient mistuned.** $\epsilon = 0.2$É o padrão de facto.`0.1`torna as atualizações demasiado tímidas; `0.3+`Invita a instabilidade.
- **Too many epochs.** $K > 20$O sistema de segurança social é um dos principais factores de destabilização da política social.$\pi_{\text{old}}$- Epoca de limite, especialmente para grandes redes.
- **No reward normalization.**Grandes escalas de recompensa se alimentam na faixa de clip. Normalize recompensas (exercício std) antes de vantagens computacionais.
- **Forgetting advantage normalization.**A normalização de média zero/unit-std por lote é padrão.
- **Learning rate not decayed.**O PPO beneficia da decadência do LR linear para zero.
- **Importance ratio math errors.**Sempre .`exp(log_new - log_old)`para estabilidade numérica, não `new / old`- Não .
- **Wrong gradient sign.**Maximizar a substitutória = *minimizar* $-L^{\text{CLIP}}$Um sinal invertido é o bug mais comum de PPO.

## Usá-lo

O PPO é o algoritmo RL padrão de 2026 em um número surpreendente de domínios:

| Use case | PPO variant |
|----------|-------------|
| MuJoCo / robotics control | PPO with Gaussian policy, GAE(0.95) |
| Atari / discrete games | PPO with categorical policy, rolling 128-step rollouts |
| RLHF for LLMs | PPO with KL penalty to reference model, reward from RM at end of response |
| Large-scale game agents | IMPALA + PPO (AlphaStar, OpenAI Five) |
| Reasoning LLMs | GRPO (Lesson 12) — PPO variant without critic |
| Preference-only data | DPO — closed-form collapsing of PPO+KL, no online sampling |

A forma de perda de PPO *  substituto cortado + valor + entropia  é o andamio para DPO, GRPO e quase todos os oleodutos RLHF.

## Envia-o

Salva como`outputs/skill-ppo-trainer.md`- Não .

```markdown
---
name: ppo-trainer
description: Produce a PPO training config and a diagnostic plan for a given environment.
version: 1.0.0
phase: 9
lesson: 8
tags: [rl, ppo, policy-gradient]
---

Given an environment and training budget, output:

1. Rollout size. `N` envs × `T` steps.
2. Update schedule. `K` epochs, minibatch size, LR schedule.
3. Surrogate params. `ε` (clip), `c_v`, `c_e`, advantage normalization on.
4. Advantage. GAE(`λ`) with explicit `γ` and `λ`.
5. Diagnostics plan. KL, clip fraction, explained variance thresholds with alerts.

Refuse `K > 30` or `ε > 0.3` (unsafe trust region). Refuse any PPO run without advantage normalization or KL/clip monitoring. Flag clip fraction sustained above 0.4 as drift.
```

## Exercícios

1. **Easy.**Execute PPO em 4×4 GridWorld com $\epsilon=0.2, K=4$- Compare a eficiência da amostra com A2C (uma época por implantação) em etapas de ambiente correspondentes.
2. **Medium.**Esvaziar$K \in \lbrace 1, 4, 10, 30 \rbrace$- Retorno de trama versus passos de env e seguimento média KL por atualização.$K$O KL explode nesta tarefa?
3. **Hard.**Substitua a substitutora cortada por uma penalidade KL adaptativa ($\beta$duplicado se $\mathrm{KL} > 2 \cdot \text{target}$, reduzida à metade se $\mathrm{KL} < \text{target}/2$) Compare o retorno final, estabilidade e livre de clipes.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Importance ratio | "r_t(θ)" | $\pi_\theta(a \mid s) / \pi_{\text{old}}(a \mid s)$; deviation from the policy that collected the data. |
| Clipped surrogate | "PPO's main trick" | $\min(r \cdot A, \mathop{\mathrm{clip}}(r, 1-\epsilon, 1+\epsilon) \cdot A)$; flat gradient past the clip on beneficial side. |
| Trust region | "TRPO / PPO intent" | Limit each update's KL to guarantee monotone improvement. |
| KL penalty | "Soft trust region" | Alternative PPO: $L - \beta \cdot \mathrm{KL}(\pi_\theta \Vert \pi_{\text{old}})$. Adaptive $\beta$. |
| Clip fraction | "How often clipping triggers" | Diagnostic — should be 0.1-0.3; outside means mistuned. |
| Multi-epoch training | "Data reuse" | K epochs on each rollout; variance cost traded for sample efficiency. |
| On-policy-ish | "Mostly on-policy" | PPO is nominally on-policy but K>1 epochs uses slightly-off-policy data safely. |
| PPO-KL | "The other PPO" | KL-penalty variant; used in RLHF where KL-to-reference is already a constraint. |

## Mais leitura

- [Schulman et al. (2017). Proximal Policy Optimization Algorithms](https://arxiv.org/abs/1707.06347)- O jornal.
- [Schulman et al. (2015). Trust Region Policy Optimization](https://arxiv.org/abs/1502.05477)TRPO, o antecessor da PPO.
- [Andrychowicz et al. (2021). What Matters In On-Policy RL? A Large-Scale Empirical Study](https://arxiv.org/abs/2006.05990) todos os hiperparâmetros de PPO foram eliminados.
- [Ouyang et al. (2022). Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155) InstructGPT; a receita de PPO-in-RLHF.
- [OpenAI Spinning Up — PPO](https://spinningup.openai.com/en/latest/algorithms/ppo.html)- Exposição moderna limpa com PyTorch.
- [CleanRL PPO implementation](https://github.com/vwxyzjn/cleanrl) Referência de PPO de um único arquivo utilizado por muitos documentos.
- [Hugging Face TRL — PPOTrainer](https://huggingface.co/docs/trl/main/en/ppo_trainer) a receita de produção para o PPO em modelos de linguagem; ler junto à lição 09 (RLHF).
- [Engstrom et al. (2020). Implementation Matters in Deep Policy Gradients](https://arxiv.org/abs/2005.12729) o artigo "37 optimizações de nível de código"; quais os truques de PPO são carregáveis e quais são folclores.
