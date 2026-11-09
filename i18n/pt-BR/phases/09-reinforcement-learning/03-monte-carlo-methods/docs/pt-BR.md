# Métodos de Monte Carlo  Aprender com Episódios Completos

> A programação dinâmica precisa de um modelo. Monte Carlo precisa de episódios. Execute a política, observe os retornos, media-los. A ideia mais simples em RL  e a que desbloqueia tudo para baixo.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 01 (MDPs), Phase 9 · 02 (Dynamic Programming)
**Time:** ~75 minutes

## O problema

A programação dinâmica é elegante, mas assume que você pode fazer perguntas.$P(s' \mid s, a)$O sistema de preços não pode ser integrado em todas as reações dos clientes possíveis. Um LLM não pode enumerar todas as possíveis continuações após um token.

É preciso um método que só precise da capacidade de "mostrar" do ambiente.`s_0, a_0, r_1, s_1, a_1, r_2, …, s_T`- Usa-o para estimar valores.

A mudança de DP para MC é filosóficamente importante: passamos de *modelo conhecido + backup exato* para *rollouts amostragados + retorno médio*. A variância salta, mas a aplicabilidade explode.

## O conceito

![Monte Carlo: rollout, compute returns, average; first-visit vs every-visit](../assets/monte-carlo.svg)

**The core idea, in one line:** $V^\pi(s) = \mathbb E_\pi[G_t \mid s_t = s] \approx (1/N) \sum_i G^{(i)}(s)$onde$G^{(i)}(s)$são observados os retornos após as visitas a $s$Política$\pi$- Não .

**First-visit vs every-visit MC.**Dado um episódio que visita o estado$s$Multiplicas vezes, o MC da primeira visita só conta o retorno da primeira visita; cada visita MC conta todas as visitas. MC da primeira visita é imparcial. Cada visita MC pode ser ligeiramente tendencioso após um número finito de episódios, porque promedia um número aleatório de retornos por episódio e esse número pode correlacionar com os retornos, mas ambos convergem para $V^\pi(s)$A primeira visita é mais fácil de analisar (mostras de ID). Cada visita usa mais dados por episódio e normalmente converge mais rápido na prática.

**Incremental mean.**Em vez de armazenar todos os resultados, atualize a média de execução:

```math
V_n(s) = V_{n-1}(s) + (1/n) [G_n - V_{n-1}(s)]
```

Reorganizar: $V_{\text{new}} = V_{\text{old}} + \alpha \cdot (\text{target} - V_{\text{old}})$com$\alpha = 1/n$- Troca .$1/n$para um passo-dimensional constante $\alpha \in (0, 1)$e obtém um estimador de MC não estacionário que acompanha as mudanças em$\pi$Esse movimento é o salto completo de MC para TD para todos os algoritmos RL modernos.

**Exploration is now a problem.**O DP tocou todos os estados por enumeração.$\pi$As regiões inteiras do espaço do estado nunca são amostragadas e as estimativas de valor permanecem em zero para sempre.

1. **Exploring starts.**Comece cada episódio a partir de um par aleatório (s, a). Garante cobertura; irrealista na prática (você não pode "reset" um robô em um estado arbitrário).
2. **ε-greedy.**Ator ganancioso W.R.T. corrente Q, mas com probabilidade $\epsilon$Todos os pares de estado-ação são amostragados assintoticamente.
3. **Off-policy MC.**Recolher dados sob uma política de comportamento $\mu$, aprender sobre a política de alvo $\pi$É uma grande variância, mas é a ponte para métodos de repetição como o DQN.

**Monte Carlo Control.**Avaliação → melhoria → avaliação, assim como a iteração da política, mas a avaliação é baseada em amostragem:

1. Corra .$\pi$- Não, não.
2. Atualização $Q(s, a)$de retornos observados.
3. Faça$\pi$É-avidito W.R.T.$Q$- Não .
4. Repito. - Não.

Converge para $Q^{\ast}$E ...$\pi^{\ast}$com probabilidade 1 em condições leves (cada par visitado com infinita frequência, $\alpha$satisfaz Robbins-Monro).

```figure
epsilon-greedy
```

## Construí-lo

### Passo 1: lançamento → lista de (s, a, r)

```python
def rollout(env, policy, max_steps=200):
    trajectory = []
    s = env.reset()
    for _ in range(max_steps):
        a = policy(s)
        s_next, r, done = env.step(s, a)
        trajectory.append((s, a, r))
        s = s_next
        if done:
            break
    return trajectory
```

Não há modelo, só `env.reset()`E ...`env.step(s, a)`A mesma interface que um ambiente de ginásio, mas despojado.

### Passo 2: Retorno de cálculo (varagem inversa)

```python
def returns_from(trajectory, gamma):
    returns = []
    G = 0.0
    for _, _, r in reversed(trajectory):
        G = r + gamma * G
        returns.append(G)
    return list(reversed(returns))
```

Um passe,$O(T)$A recorrência retrógrada .$G_t = r_{t+1} + \gamma G_{t+1}$Evita a somação.

### Passo 3: Avaliação do MC na primeira visita

```python
def mc_policy_evaluation(env, policy, episodes, gamma=0.99):
    V = defaultdict(float)
    counts = defaultdict(int)
    for _ in range(episodes):
        trajectory = rollout(env, policy)
        returns = returns_from(trajectory, gamma)
        seen = set()
        for t, ((s, _, _), G) in enumerate(zip(trajectory, returns)):
            if s in seen:
                continue
            seen.add(s)
            counts[s] += 1
            V[s] += (G - V[s]) / counts[s]
    return V
```

Três linhas fazem o trabalho: marcar o estado visto na primeira visita, contar os incrementos, atualizar a média de execução.

### Passo 4: controlo do MC ganancioso (na política)

```python
def mc_control(env, episodes, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})
    counts = defaultdict(lambda: {a: 0 for a in ACTIONS})

    def policy(s):
        if random() < epsilon:
            return choice(ACTIONS)
        return max(Q[s], key=Q[s].get)

    for _ in range(episodes):
        trajectory = rollout(env, policy)
        returns = returns_from(trajectory, gamma)
        seen = set()
        for (s, a, _), G in zip(trajectory, returns):
            if (s, a) in seen:
                continue
            seen.add((s, a))
            counts[s][a] += 1
            Q[s][a] += (G - Q[s][a]) / counts[s][a]
    return Q, policy
```

### Passo 5: comparação com o padrão de ouro DP

A sua estimativa do MC de$V^\pi$Devem concordar com o resultado do DP da lição 02 como episódios → ∞. Na prática: 50.000 episódios em 4×4 GridWorld o leva dentro de `~0.1`da resposta DP.

## Encurralagens

- **Infinite episodes.**MC requer episódios para acabar. Se a sua política pode circular para sempre, cap.`max_steps`GridWorld com uma política aleatória rotineiramente vezes fora  que é normal, só certifique-se de contar corretamente.
- **Variance.**MC usa retornos completos. Em longos episódios, a variação é enorme  uma recompensa infeliz no final dos turnos $V(s_0)$O método TD (Lessão 04) reduziu isto através do bootstrapping.
- **State coverage.**O MC ganancioso num Q fresco com laços só vai tentar uma ação.
- **Non-stationary policies.**Se$\pi$A taxa de variação de dados é de uma taxa de variação de dados, mas a taxa de variação de dados é de uma taxa de variação de dados.
- **Off-policy importance sampling.**Os pesos .$\pi(a \mid s)/\mu(a \mid s)$A variância explode com o horizonte. O limite com IS ponderado por decisão ou a transição para TD.

## Usá-lo

O papel dos métodos Monte Carlo em 2026:

| Use case | Why MC |
|----------|--------|
| Short-horizon games (blackjack, poker) | Episodes terminate naturally; returns are clean. |
| Offline evaluation of a logged policy | Average discounted returns over stored trajectories. |
| Monte Carlo Tree Search (AlphaZero) | MC rollouts from tree leaves guide selection. |
| LLM RL evaluation | Compute average reward over sampled completions for a given policy. |
| Baseline estimation in PPO | The advantage target $A_t = G_t - V(s_t)$ uses an MC $G_t$. |
| Teaching RL | Simplest algorithm that actually works — strip bootstrapping to see the core. |

Os algoritmos modernos de deep-RL (PPO, SAC) interpolam entre MC puro (retorno total) e TD puro (bootstrap de um passo) através de $n$Os dois pontos finais são exemplos do mesmo estimador.

## Envia-o

Salva como`outputs/skill-mc-evaluator.md`- Não .

```markdown
---
name: mc-evaluator
description: Evaluate a policy via Monte Carlo rollouts and produce a convergence report with DP-comparison if available.
version: 1.0.0
phase: 9
lesson: 3
tags: [rl, monte-carlo, evaluation]
---

Given an environment (episodic, with reset+step API) and a policy, output:

1. Method. First-visit vs every-visit MC. Reason.
2. Episode budget. Target number, variance diagnostic, expected standard error.
3. Exploration plan. ε schedule (if needed) or exploring starts.
4. Gold-standard comparison. DP-optimal V* if tabular; otherwise a bound from a Q-learning / PPO baseline.
5. Termination check. Max-step cap, timeouts, handling of non-terminating trajectories.

Refuse to run MC on non-episodic tasks without a finite horizon cap. Refuse to report V^π estimates from fewer than 100 episodes per state for tabular tasks. Flag any policy with zero-variance actions as an exploration risk.
```

## Exercícios

1. **Easy.**Implementar a avaliação de MC de primeira visita da política uniforme-aleatória no 4×4 GridWorld.$V(0,0)$como função da contagem de episódios contra a resposta DP.
2. **Medium.**Implementar o controlo do MC com $\epsilon \in \lbrace 0.01, 0.1, 0.3 \rbrace$Comparar o retorno médio após 20.000 episódios.
3. **Hard.**Implementar *oft-policy* MC com amostragem de importância: recolher dados sob política uniforme aleatória $\mu$, estimativa $V^\pi$para a política determinista ideal $\pi$Comparar simples IS vs. por decisão IS vs. ponderado IS. Qual tem menor variância?

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Monte Carlo | "Random sampling" | Estimate expectations by averaging over iid samples from the distribution. |
| Return $G_t$ | "Future reward" | Sum of discounted rewards from step $t$ to episode end: $\sum_{k\ge 0} \gamma^k r_{t+k+1}$. |
| First-visit MC | "Count each state once" | Only the first visit in an episode contributes to the value estimate. |
| Every-visit MC | "Use all visits" | Every visit contributes; slightly biased for finite samples, consistent in the limit, and more sample-efficient. |
| ε-greedy | "Exploration noise" | Pick greedy action with prob $1-\epsilon$; random action with prob $\epsilon$. |
| Importance sampling | "Correcting for sampling from the wrong distribution" | Reweight returns by $\pi(a \mid s)/\mu(a \mid s)$ products to estimate $V^\pi$ from $\mu$ data. |
| On-policy | "Learn from my own data" | Target policy = behavior policy. Vanilla MC, PPO, SARSA. |
| Off-policy | "Learn from someone else's data" | Target policy ≠ behavior policy. Importance-sampled MC, Q-learning, DQN. |

## Mais leitura

- [Sutton & Barto (2018). Ch. 5 — Monte Carlo Methods](http://incompleteideas.net/book/RLbook2020.pdf) o tratamento canónico.
- [Singh & Sutton (1996). Reinforcement Learning with Replacing Eligibility Traces](https://link.springer.com/article/10.1007/BF00114726) Análise de primeira visita versus cada visita.
- [Precup, Sutton, Singh (2000). Eligibility Traces for Off-Policy Policy Evaluation](http://incompleteideas.net/papers/PSS-00.pdf) MC e controlo de variações fora da política.
- [Mahmood et al. (2014). Weighted Importance Sampling for Off-Policy Learning](https://arxiv.org/abs/1404.6362) estimadores modernos de IS de baixa variação.
- [Tesauro (1995). TD-Gammon, A Self-Teaching Backgammon Program](https://dl.acm.org/doi/10.1145/203330.203343) a primeira demonstração empírica em larga escala de auto-jogo MC/TD convergindo para o jogo sobre-humano; precursor conceitual de cada lição na segunda metade desta fase.
