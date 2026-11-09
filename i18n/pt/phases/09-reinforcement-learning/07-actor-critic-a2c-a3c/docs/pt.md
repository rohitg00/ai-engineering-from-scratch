# Actor-Critico  A2C e A3C

> A ReINFORCE é barulhenta, adicione um crítico que aprenda.$\hat{V}(s)$A 2C executa sincronicamente; A 3C executa através de fios. Ambos são o modelo mental para cada método moderno de RL profundo.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 04 (TD Learning), Phase 9 · 06 (REINFORCE)
**Time:** ~75 minutes

## O problema

A Vanilla ReINFORCE funciona, mas a sua variação é terrível.$G_t$O que é que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é.$\nabla \log \pi$e a média produz um estimador de gradiente que leva milhares de episódios para mover a política a mesma distância que você poderia mover com muito menos atualizações DQN.

A variação vem do uso de retornos brutos. Se subtrair uma linha de base $b(s_t)$ qualquer função de estado, incluindo um valor aprendido  a expectativa é inalterada e a variância cai.$\hat{V}(s_t)$Agora a quantidade se multiplica .$\nabla \log \pi$é a *vantagem*:

```math
A(s, a) = G - \hat{V}(s)
```

Uma ação é boa se produzir retornos acima da média; ruim se abaixo. REINFORCE com um crítico erudito é *actor-crítica*. O crítico dá ao ator um professor de baixa variação. Este é todo método de política profunda após 2015 (A2C, A3C, PPO, SAC, IMPALA).

## O conceito

![Actor-critic: policy net plus value net, TD residual as advantage](../assets/actor-critic.svg)

**Two networks, one shared loss:**

- **Actor** $\pi_\theta(a \mid s)$A política: a política.
- **Critic** $V_\phi(s)$As estimativas de retorno esperado do estado.$(V_\phi(s) - \text{target})^2$- Não .

**The advantage.**Dois formulários padrão:

- *Vantagem MC:* $A_t = G_t - V_\phi(s_t)$Imparcial, maior variância.
- *Vantagem TD:* $A_t = r_{t+1} + \gamma V_\phi(s_{t+1}) - V_\phi(s_t)$. Preciados (utilizos $V_\phi$O valor de variação é muito menor.$\delta_t$- Não .

**n-step advantage.**Interpolar entre os dois:

```math
A_t^{(n)} = r_{t+1} + \gamma r_{t+2} + \ldots + \gamma^{n-1} r_{t+n} + \gamma^n V_\phi(s_{t+n}) - V_\phi(s_t)
```

$n = 1$é TD puro. $n = \infty$A maioria das implementações utiliza$n = 5$para a Atari, $n = 2048$Para o PPO no MuJoCo.

**Generalized Advantage Estimation (GAE).**Schulman et al. (2016) propôs uma média ponderada exponencialmente sobre todas as vantagens do n-passo:

```math
A_t^{\text{GAE}} = \sum_{l=0}^{\infty} (\gamma \lambda)^l \delta_{t+l}
```

com$\lambda \in [0, 1]$- Não .$\lambda = 0$é TD (baixa variância, alto viés). $\lambda = 1$é MC (alta variância, imparcial). $\lambda = 0.95$é o 2026 de acordo com o padrão  tune até que o dial de desvio/variância esteja onde você quer.

**A2C: synchronous advantage actor-critic.**Coletar$T$Passo de cruzamento .$N$Paralelas de ambiente. Compute vantagens para cada passo. Atualize ator e crítico no lote combinado. Repita. O irmão mais simples e mais escalavel do A3C.

**A3C: asynchronous advantage actor-critic.**Mnih et al. (2016). Spawn $N$As funções de trabalho são de um tipo de processador, cada um executando um env. Cada trabalhador calcula gradientes localmente em sua própria implementação, em seguida, assincronicamente os aplica a um servidor de parâmetros compartilhado.

**The combined loss.**

```math
L(\theta, \phi) = -\mathbb{E}[ A_t \cdot \log \pi_\theta(a_t \mid s_t) ] + c_v \cdot \mathbb{E}[(V_\phi(s_t) - G_t)^2] - c_e \cdot \mathbb{E}[H(\pi_\theta(\cdot \mid s_t))]
```

Três termos: perda de grau de política, regressão de valor, bônus de entropia. `c_v ~ 0.5`- Não .`c_e ~ 0.01`são pontos de partida canônicos.

```figure
actor-critic
```

## Construí-lo

### Passo 1: um crítico

Crítico linear $V_\phi(s) = w \cdot \text{features}(s)$Atualizado com a MSE:

```python
def critic_update(w, x, target, lr):
    v_hat = dot(w, x)
    err = target - v_hat
    for j in range(len(w)):
        w[j] += lr * err * x[j]
    return v_hat
```

Em um ambiente tabular o crítico converge em algumas centenas de episódios.

### Passo 2: vantagem de n-passo

Dado o seu comprimento .$T$E uma final de arranque .$V(s_T)$- Não .

```python
def compute_advantages(rewards, values, gamma=0.99, lam=0.95, last_value=0.0):
    advantages = [0.0] * len(rewards)
    gae = 0.0
    for t in reversed(range(len(rewards))):
        next_v = values[t + 1] if t + 1 < len(values) else last_value
        delta = rewards[t] + gamma * next_v - values[t]
        gae = delta + gamma * lam * gae
        advantages[t] = gae
    returns = [a + v for a, v in zip(advantages, values)]
    return advantages, returns
```

`returns`É o alvo crítico.`advantages`é o que se multiplica.$\nabla \log \pi$- Não .

### Passo 3: atualização combinada

```python
for step_i, (x, a, _r, probs) in enumerate(traj):
    adv = advantages[step_i]
    target_v = returns[step_i]

    # critic
    critic_update(w, x, target_v, lr_v)

    # actor
    for i in range(N_ACTIONS):
        grad_logpi = (1.0 if i == a else 0.0) - probs[i]
        for j in range(N_FEAT):
            theta[i][j] += lr_a * adv * grad_logpi * x[j]
```

Na política, uma implementação por atualização, taxas de aprendizagem separadas para ator e crítico.

### Passo 4: paralelação (A3C vs. A2C)

- **A3C:**- Não .$N$Cada um corre seu próprio env e seu próprio pass para a frente. Periodicamente empurrar atualizações de gradiente para um mestre compartilhado.
- **A2C:**- Correr .$N$Env instâncias num único processo, empilhar observações em um `[N, obs_dim]`Batch, batch forward pass, batch backward pass. Maior utilização de GPU, determinista, mais fácil de raciocinar.

O nosso código de brinquedo é de um único fio para a clareza; reescrever para A2C em lote é três linhas de numpy.

## Encurralagens

- **Critic bias before actor gradient.**Se o crítico é aleatório, a sua linha de base é desinformativa e você está treinando em ruído puro. aqueça o crítico por algumas centenas de passos antes de ativar o gradiente de política, ou use uma taxa lenta de aprendizagem de atores.
- **Advantage normalization.**Normaliza as vantagens para zero média/unit-std por lote. Estabiliza o treinamento em massa a um custo próximo a zero.
- **Shared trunk.**Use um extractor de recursos compartilhado para ator e crítico em entradas de imagem. cabeças separadas. Os recursos compartilhados de livre-mover em ambas as perdas.
- **On-policy contract.**A A2C reutiliza dados para exatamente uma atualização. Mais e o seu gradiente é tendencioso (a correção de amostragem de importância é o que a PPO adiciona).
- **Entropy collapse.**Sem .$c_e > 0$A política se torna quase determinista em algumas centenas de atualizações e deixa de explorar.
- **Reward scale.**Grandes vantagens dependem da escala de recompensa. Normalize recompensas (por exemplo, divisão run-std) para magnitudes de gradiente consistentes em tarefas.

## Usá-lo

A2C/A3C raramente são a escolha final em 2026, mas são a arquitetura que tudo mais tarde refinará:

| Method | Relation to A2C |
|--------|----------------|
| PPO | A2C + clipped importance ratio for multi-epoch updates |
| IMPALA | A3C + V-trace off-policy correction |
| SAC (Phase 9 · 07) | Off-policy A2C with a soft-value critic (next lesson) |
| GRPO (Phase 9 · 12) | A2C without the critic — group-relative advantage |
| DPO | A2C collapsed into a preference-ranking loss, no sampling |
| AlphaStar / OpenAI Five | A2C with league training + imitation pre-training |

Se virem "vantagem" num artigo de 2026, pensem em crítico de actores.

## Envia-o

Salva como`outputs/skill-actor-critic-trainer.md`- Não .

```markdown
---
name: actor-critic-trainer
description: Produce an A2C / A3C / GAE configuration for a given environment, with advantage estimation and loss weights specified.
version: 1.0.0
phase: 9
lesson: 7
tags: [rl, actor-critic, gae]
---

Given an environment and compute budget, output:

1. Parallelism. A2C (GPU batched) vs A3C (CPU async) and the number of workers.
2. Rollout length T. Steps per env per update.
3. Advantage estimator. n-step or GAE(λ); specify λ.
4. Loss weights. `c_v` (value), `c_e` (entropy), gradient clip.
5. Learning rates. Actor and critic (separate if using).

Refuse single-worker A2C on environments with horizon > 1000 (too on-policy, too slow). Refuse to ship without advantage normalization. Flag any run with `c_e = 0` and observed entropy < 0.1 as entropy-collapsed.
```

## Exercícios

1. **Easy.**Treinar actor-crítica com vantagem MC $(G_t - V(s_t))$Compare a eficiência da amostra com a linha de base da REINFORCE-with-running-median da lição 06.
2. **Medium.**Passe para vantagem residual TD $(r + \gamma V(s') - V(s))$- Medir a variância dos lotes de vantagem.
3. **Hard.**Implementar o GAE ((λ).$\lambda \in \lbrace 0, 0.5, 0.9, 0.95, 1.0 \rbrace$O que é o ponto de preferência para esta tarefa?

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Actor | "The policy net" | $\pi_\theta(a \mid s)$, updated by policy gradient. |
| Critic | "The value net" | $V_\phi(s)$, updated by MSE regression to returns / TD targets. |
| Advantage | "How much better than average" | $A(s, a) = Q(s, a) - V(s)$ or its estimators. Multiplier for $\nabla \log \pi$. |
| TD residual | "δ" | $\delta_t = r + \gamma V(s') - V(s)$; one-step advantage estimate. |
| GAE | "The interpolation knob" | Exponentially weighted sum of n-step advantages, parameterized by $\lambda$. |
| A2C | "Synchronous actor-critic" | Batched across envs; one gradient step per rollout. |
| A3C | "Async actor-critic" | Worker threads push gradients to a shared param server. Original paper; less common in 2026. |
| Bootstrap | "Use V at the horizon" | Truncate the rollout, add $\gamma^n V(s_{t+n})$ to close the sum. |

## Mais leitura

- [Mnih et al. (2016). Asynchronous Methods for Deep Reinforcement Learning](https://arxiv.org/abs/1602.01783) A3C, o papel crítico-actor asíncrono original.
- [Schulman et al. (2016). High-Dimensional Continuous Control Using Generalized Advantage Estimation](https://arxiv.org/abs/1506.02438) GAE.
- [Sutton & Barto (2018). Ch. 13 — Actor-Critic Methods](http://incompleteideas.net/book/RLbook2020.pdf) fundamentos; combinar isto com o capítulo 9 sobre aproximação de funções quando o crítico é uma rede neural.
- [Espeholt et al. (2018). IMPALA](https://arxiv.org/abs/1802.01561) Escalabilidade distribuída de actor-crítica com correcção de fora de política de rastreamento V.
- [OpenAI Baselines / Stable-Baselines3](https://stable-baselines3.readthedocs.io/) implementações de produção A2C/PPO que valham a pena ler.
- [Konda & Tsitsiklis (2000). Actor-Critic Algorithms](https://papers.nips.cc/paper/1786-actor-critic-algorithms) o resultado de convergência fundamental para a decomposição actor-crítica em duas escalas.
