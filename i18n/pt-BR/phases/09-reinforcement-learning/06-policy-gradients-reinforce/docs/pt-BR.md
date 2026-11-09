# Política Gradiente  REINFORCE do zero

> Para de estimar o valor. Parametrizar a política diretamente, calcular o gradiente do retorno esperado, passo para cima. Williams (1992) escreveu em um teorema. É por isso que PPO, GRPO e cada ciclo LLM RL existem.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 03 (Backpropagation), Phase 9 · 03 (Monte Carlo), Phase 9 · 04 (TD Learning)
**Time:** ~75 minutes

## O problema

Q-learning e DQN paramétricos da função *valor*.`argmax Q`O que é bom para ações discretas e estados discretos.`argmax`sobre um torque de 10 dimensões?) ou quando você quer uma política estocástica (`argmax`É determinista por construção).

Os gradientes de política parametrizam a *política* em vez disso. $\pi_\theta(a \mid s)$A rede neural é uma rede neural que produz uma distribuição sobre ações.$\theta$- Passa para cima.`argmax`Não há recursão de Bellman, só ascensão de gradiente.$J(\theta) = \mathbb E_{\pi_\theta}[G]$- Não .

O teorema de REINFORCE (Williams 1992) diz que este gradiente é computavel: $\nabla J(\theta) = \mathbb E_\pi[ G \cdot \nabla_\theta \log \pi_\theta(a \mid s) ]$- Exerça um episódio, calcula o retorno, multiplica por$\nabla \log \pi_\theta(a \mid s)$- A média, a ascensão gradual, pronto.

Cada algoritmo LLM-RL em 2026  PPO, DPO, GRPO  é um aperfeiçoamento da REINFORCE.

## O conceito

![Policy gradient: softmax policy, log-π gradient, return-weighted update](../assets/policy-gradient.svg)

**The policy gradient theorem.**Para qualquer política$\pi_\theta$Parametrizado por $\theta$- Não .

```math
\nabla J(\theta) = \mathbb{E}_{\tau \sim \pi_\theta}[ \sum_{t=0}^{T} G_t \cdot \nabla_\theta \log \pi_\theta(a_t \mid s_t) ]
```

onde$G_t = \sum_{k=t}^{T} \gamma^{k-t} r_{k+1}$é o retorno descontado do passo $t$A expectativa é de que as trajetórias sejam completas .$\tau$amostragem de $\pi_\theta$- Não .

**The proof is short.**Diferenciar $J(\theta) = \sum_\tau P(\tau; \theta) G(\tau)$- Não é o que se espera.$\nabla P(\tau; \theta) = P(\tau; \theta) \nabla \log P(\tau; \theta)$Factor $\log P(\tau; \theta) = \sum \log \pi_\theta(a_t \mid s_t) + \text{environment terms that do not depend on } \theta$Os termos de ambiente desaparecem. Duas linhas de álgebra dão-lhe o teorema.

**Variance reduction tricks.**A Vanilla ReINFORCE tem uma variância homicida. Os retornos são ruidosos.$\nabla \log \pi$O produto é muito barulhento.

1. **Baseline subtraction.**Substitui$G_t$com$G_t - b(s_t)$para qualquer linha de base $b(s_t)$que não depende de $a_t$- Imparcial porque$\mathbb{E}[b(s_t) \cdot \nabla \log \pi(a_t \mid s_t)] = 0$. Escolha típica: $b(s_t) = \hat{V}(s_t)$aprendizado por um crítico → ator-crítico (Lessão 07).
2. **Reward-to-go.**Substitui$\sum_t G_t \cdot \nabla \log \pi_\theta(a_t \mid s_t)$com$\sum_t G_t^{\text{from } t} \cdot \nabla \log \pi_\theta(a_t \mid s_t)$. Apenas os retornos futuros são importantes para uma determinada ação  Os retornos passados contribuem com ruído zero-médio.

Combinados, obtém:

```math
\nabla J \approx (1/N) \sum_{i=1}^{N} \sum_{t=0}^{T_i} [ G_t^{(i)} - \hat{V}(s_t^{(i)}) ] \cdot \nabla_\theta \log \pi_\theta(a_t^{(i)} \mid s_t^{(i)})
```

que é REINFORCE com uma linha de base  o ancestral directo do A2C (Lessão 07) e do PPO (Lessão 08).

**Softmax policy parameterization.**Para ações discretas, a escolha padrão:

```math
\pi_\theta(a \mid s) = \exp(f_\theta(s, a)) / \sum_{a'} \exp(f_\theta(s, a'))
```

onde$f_\theta$É qualquer rede neural que produz uma pontuação por ação.

```math
\nabla_\theta \log \pi_\theta(a \mid s) = \nabla_\theta f_\theta(s, a) - \sum_{a'} \pi_\theta(a' \mid s) \nabla_\theta f_\theta(s, a')
```

Por exemplo, o resultado da acção tomada menos o seu valor esperado no âmbito da política.

**Gaussian policy for continuous actions.** $\pi_\theta(a \mid s) = N(\mu_\theta(s), \sigma_\theta(s))$- Não .$\nabla \log N(a; \mu, \sigma)$A fase 9 · 07 é a fase de SAC.

```figure
policy-gradient-landscape
```

## Construí-lo

### Passo 1: rede de políticas softmax

```python
def policy_logits(theta, state_features):
    return [dot(theta[a], state_features) for a in range(N_ACTIONS)]

def softmax(logits):
    m = max(logits)
    exps = [exp(l - m) for l in logits]
    Z = sum(exps)
    return [e / Z for e in exps]
```

Use uma política linear (um vetor de peso por ação) para um envelope tabuleiro. Para Atari, troque em uma CNN e mantenha a cabeça softmax.

### Passo 2: amostragem e probabilidade de registro

```python
def sample_action(probs, rng):
    x = rng.random()
    cum = 0
    for a, p in enumerate(probs):
        cum += p
        if x <= cum:
            return a
    return len(probs) - 1

def log_prob(probs, a):
    return log(probs[a] + 1e-12)
```

### Passo 3: lançamento com log-probes capturados

```python
def rollout(theta, env, rng, gamma):
    trajectory = []
    s = env.reset()
    while not done:
        logits = policy_logits(theta, s)
        probs = softmax(logits)
        a = sample_action(probs, rng)
        s_next, r, done = env.step(s, a)
        trajectory.append((s, a, r, probs))
        s = s_next
    return trajectory
```

### Passo 4: Atualização da REINFORCE

```python
def reinforce_step(theta, trajectory, gamma, lr, baseline=0.0):
    returns = compute_returns(trajectory, gamma)
    for (s, a, _, probs), G in zip(trajectory, returns):
        advantage = G - baseline
        grad_log_pi_a = [-p for p in probs]
        grad_log_pi_a[a] += 1.0
        for i in range(N_ACTIONS):
            for j in range(len(s)):
                theta[i][j] += lr * advantage * grad_log_pi_a[i] * s[j]
```

O gradiente$\nabla \log \pi(a \mid s) = e_a - \pi(\cdot \mid s)$(exceto em$a$- probabilidades) é o coração dos gradientes de política softmax.

### Passo 5: Linhas de base

Uma média corrente de $G$Em relação aos episódios recentes, a redução de variância é suficiente para que um GridWorld 4×4 seja executado; é preciso ~ 500 episódios para convergir.$\hat{V}(s)$E você tem crítico de ator.

## Encurralagens

- **Exploding gradients.**Os rendimentos podem ser enormes.$G$- Não .`~N(0, 1)`através do lote antes de multiplicar por $\nabla \log \pi$- Não .
- **Entropy collapse.**A política converge para uma ação quase determinista muito cedo, deixa de explorar, fica presa.$\beta \cdot H(\pi(\cdot \mid s))$Para o objectivo.
- **High variance.**A Vanilla REINFORCE precisa de milhares de episódios.
- **Sample inefficiency.**A correcção extra-política através da amostragem de importância traz dados, ao custo da variação (a taxa da OPP é um peso de IS reduzido).
- **Non-stationary gradients.**O mesmo gradiente de há 100 episódios usa o antigo .$\pi$Os métodos de política atualizam cada algumas implementações por este motivo.
- **Credit assignment.**Sem recompensa, recompensas passadas contribuem com ruído.

## Usá-lo

Em 2026, o REINFORCE raramente é executado diretamente, mas a sua fórmula de gradiente está em toda parte:

| Use case | Derived method |
|----------|---------------|
| Continuous control | PPO / SAC with Gaussian policy |
| LLM RLHF | PPO with KL penalty, running on token-level policy |
| LLM reasoning (DeepSeek) | GRPO — REINFORCE with group-relative baseline, no critic |
| Multi-agent | Centralized-critic REINFORCE (MADDPG, COMA) |
| Discrete action robotics | A2C, A3C, PPO |
| Preference-only settings | DPO — REINFORCE rewritten as a preference-likelihood loss, no sampling |

Quando você lê`loss = -advantage * log_prob`Os trabalhos completos (DPO, GRPO, RLOO) são truques de redução de variância no topo desta linha.

## Envia-o

Salva como`outputs/skill-policy-gradient-trainer.md`- Não .

```markdown
---
name: policy-gradient-trainer
description: Produce a REINFORCE / actor-critic / PPO training config for a given task and diagnose variance issues.
version: 1.0.0
phase: 9
lesson: 6
tags: [rl, policy-gradient, reinforce]
---

Given an environment (discrete / continuous actions, horizon, reward stats), output:

1. Policy head. Softmax (discrete) or Gaussian (continuous) with parameter counts.
2. Baseline. None (vanilla), running mean, learned `V̂(s)`, or A2C critic.
3. Variance controls. Reward-to-go on by default, return normalization, gradient clip value.
4. Entropy bonus. Coefficient β and decay schedule.
5. Batch size. Episodes per update; on-policy data freshness contract.

Refuse REINFORCE-no-baseline on horizons > 500 steps. Refuse continuous-action control with a softmax head. Flag any run with `β = 0` and observed policy entropy < 0.1 as entropy-collapsed.
```

## Exercícios

1. **Easy.**Implementar REINFORCE no 4×4 GridWorld com uma política de softmax linear. Treinar por 1.000 episódios sem uma linha de base. Planejar a curva de aprendizagem; medir a variância (std de retornos).
2. **Medium.**Adicione uma linha de base de corrida média. Treine novamente. Compare a eficiência da amostra e a variância com a corrida de baunilha. Em quanto a linha de base reduz os passos para a convergência?
3. **Hard.**Adicionar um bônus de entropia $\beta \cdot H(\pi)$- Esvaziar .$\beta \in \lbrace 0, 0.01, 0.1, 1.0 \rbrace$O que é que é o ponto de encontro desta tarefa?

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Policy gradient | "Train the policy directly" | $\nabla J(\theta) = \mathbb{E}[G \cdot \nabla \log \pi_\theta(a \mid s)]$; derived from the log-derivative trick. |
| REINFORCE | "The original PG algorithm" | Williams (1992); Monte Carlo returns multiplied by log-policy gradient. |
| Log-derivative trick | "Score function estimator" | $\nabla P(\tau;\theta) = P(\tau;\theta) \cdot \nabla \log P(\tau;\theta)$; makes gradients of expectations tractable. |
| Baseline | "Variance reduction" | Any $b(s)$ subtracted from $G$; unbiased because $\mathbb{E}[b \cdot \nabla \log \pi] = 0$. |
| Reward-to-go | "Only future returns count" | $G_t^{\text{from } t}$ instead of the full $G_0$; correct and lower-variance. |
| Entropy bonus | "Encourage exploration" | $+\beta \cdot H(\pi(\cdot \mid s))$ term keeps the policy from collapsing. |
| On-policy | "Train on what you just saw" | Gradient expectation is w.r.t. the current policy — cannot reuse old data directly. |
| Advantage | "How much better than average" | $A(s, a) = G(s, a) - V(s)$; the signed quantity REINFORCE-with-baseline multiplies. |

## Mais leitura

- [Williams (1992). Simple Statistical Gradient-Following Algorithms for Connectionist Reinforcement Learning](https://link.springer.com/article/10.1007/BF00992696) o papel original do REINFORCE.
- [Sutton et al. (2000). Policy Gradient Methods for Reinforcement Learning with Function Approximation](https://papers.nips.cc/paper_files/paper/1999/hash/464d828b85b0bed98e80ade0a5c43b0f-Abstract.html) o teorema moderno da política-gradiente com aproximação de funções.
- [Sutton & Barto (2018). Ch. 13 — Policy Gradient Methods](http://incompleteideas.net/book/RLbook2020.pdf) apresentação de livros didáticos.
- [OpenAI Spinning Up — VPG / REINFORCE](https://spinningup.openai.com/en/latest/algorithms/vpg.html) Exposição pedagógica clara com código PyTorch.
- [Peters & Schaal (2008). Reinforcement Learning of Motor Skills with Policy Gradients](https://homes.cs.washington.edu/~todorov/courses/amath579/reading/PolicyGradient.pdf) A redução da variância e a visão natural-gradiente que liga a REINFORCE à família da região de confiança (TRPO, PPO).
