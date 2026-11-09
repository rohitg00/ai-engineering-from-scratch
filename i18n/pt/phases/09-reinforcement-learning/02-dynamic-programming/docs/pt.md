# Programação Dinâmica  Iteração de Política e Iteração de Valor

> A programação dinâmica é RL com a fraude. Você já sabe as funções de transição e recompensa; você apenas itera a equação Bellman até que$V$ou $\pi$O método de referência é o que todos os métodos baseados em amostragem tentam abordar.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 01 (MDPs)
**Time:** ~75 minutes

## O problema

Você tem um MDP com um modelo conhecido: você pode consultar $P(s' \mid s, a)$E ...$R(s, a, s')$Um gerente de estoque conhece a distribuição da demanda. um jogo de tabuleiro tem transições deterministas. um mundo de grade é quatro linhas de Python. você tem um *modelo*.

O RL livre de modelos (Q-learning, PPO, REINFORCE) foi inventado para o caso em que você não tem um modelo  você só pode sampler do ambiente. Mas quando você tem um, há métodos mais rápidos e melhores: programação dinâmica. Bellman os projetou em 1957. Eles ainda definem a corretão: quando as pessoas dizem "política ideal para este MDP", eles querem dizer que a política DP retornaria.

Os dados são necessários para 2026 por três razões: primeiro, cada ambiente tabular na pesquisa RL (GridWorld, FrozenLake, CliffWalking) é resolvido com DP para produzir a política padrão de ouro.$V^{\ast}(s_0)$Terceiro, os modernos métodos de RL offline e planejamento (MCTS, pesquisa do AlphaZero, RL baseado em modelo na Fase 9 · 10) todos iteram um backup Bellman sobre um modelo aprendido ou dado.

## O conceito

![Policy iteration and value iteration, side by side](../assets/dp.svg)

**Two algorithms, both fixed-point iteration on Bellman.**

**Policy iteration.**Alterna duas etapas até que a política pare de mudar.

1. *Evaluation:* dada política $\pi$, computação $V^\pi$através da aplicação repetida $V(s) \leftarrow \sum_a \pi(a \mid s) \sum_{s',r} P(s',r \mid s,a) [r + \gamma V(s')]$Até que converja.
2. * Melhoria:* dada $V^\pi$, fazer$\pi$ganancioso W.R.T.$V^\pi$- Não .$\pi(s) \leftarrow \arg\max_a \sum_{s',r} P(s',r \mid s,a) [r + \gamma V(s')]$- Não .

A convergência é garantida porque (a) cada etapa de melhoria mantém $\pi$Aumento do número de pessoas em situação de risco$V^\pi$Para alguns estados, (b) o espaço das políticas deterministas é finito. geralmente converge em ~ 520 iterações externas mesmo para grandes espaços de estado.

**Value iteration.**Colapsa a avaliação e melhoria em uma única varredura. Aplique a equação Bellman *optimalidade*:

```math
V(s) \leftarrow \max_a \sum_{s',r} P(s',r \mid s,a) [r + \gamma V(s')]
```

Repita até $\max_s \lvert V_{\text{new}}(s) - V(s) \rvert < \epsilon$. Extrair a política no final tomando a ação gananciosa. Estritamente mais rápido por iteração  nenhum loop de avaliação interna  mas normalmente precisa de mais iterações para convergir.

**Generalized policy iteration (GPI).**A estrutura unificadora. Função de valor e política estão bloqueadas em um loop de melhoria bidirecional; qualquer método que conduza ambos para a consistência mútua (iteração de valor assíncrona, iteração de política modificada, Q-learning, ator-crítica, PPO) é uma instância de GPI.

**Why $\gamma < 1$ matters.**O operador Bellman é um$\gamma$- contracção na norma-sup: $\lVert T V - T V' \rVert_\infty \le \gamma \lVert V - V' \rVert_\infty$A contração implica um ponto fixo único e uma convergência geométrica.$\gamma < 1$E se perder a garantia, precisa de um horizonte finito ou um estado terminal de absorção.

```figure
value-iteration-gamma
```

## Construí-lo

### Passo 1: construir o modelo GridWorld MDP

Usar o mesmo 4x4 GridWorld da lição 01. Adicionamos uma variante estocástica: com probabilidade `0.1`O agente desliza numa direcção perpendicular aleatória.

```python
SLIP = 0.1

def transitions(state, action):
    if state == TERMINAL:
        return [(state, 0.0, 1.0)]
    outcomes = []
    for direction, prob in action_probs(action):
        outcomes.append((apply_move(state, direction), -1.0, prob))
    return outcomes
```

`transitions(s, a)`Retorna uma lista de `(s', r, p)`Este é o modelo inteiro.

### Passo 2: Avaliação das políticas

Dado uma política `π(s) = {action: prob}`, iterar a equação de Bellman até $V$Parou de se mover:

```python
def policy_evaluation(policy, gamma=0.99, tol=1e-6):
    V = {s: 0.0 for s in states()}
    while True:
        delta = 0.0
        for s in states():
            v = sum(pi_a * sum(p * (r + gamma * V[s_prime])
                              for s_prime, r, p in transitions(s, a))
                   for a, pi_a in policy(s).items())
            delta = max(delta, abs(v - V[s]))
            V[s] = v
        if delta < tol:
            return V
```

### Passo 3: Melhoria das políticas

Substitui$\pi$Com a política gananciosa W.R.T.$V$Se ...$\pi$Não mudou, retorno  estamos no óptimo.

```python
def policy_improvement(V, gamma=0.99):
    new_policy = {}
    for s in states():
        best_a = max(
            ACTIONS,
            key=lambda a: sum(p * (r + gamma * V[s_prime])
                              for s_prime, r, p in transitions(s, a)),
        )
        new_policy[s] = best_a
    return new_policy
```

### Passo 4: Conectar-os

```python
def policy_iteration(gamma=0.99):
    policy = {s: "up" for s in states()}   # arbitrary start
    for _ in range(100):
        V = policy_evaluation(lambda s: {policy[s]: 1.0}, gamma)
        new_policy = policy_improvement(V, gamma)
        if new_policy == policy:
            return V, policy
        policy = new_policy
```

Convergência típica em 4×4: 46 iterações externas.$V^{\ast}(0,0) \approx -6$E uma política que reduz rigorosamente a contagem de passos.

### Passo 5: Iteração de valor (versão de um ciclo)

```python
def value_iteration(gamma=0.99, tol=1e-6):
    V = {s: 0.0 for s in states()}
    while True:
        delta = 0.0
        for s in states():
            v = max(sum(p * (r + gamma * V[s_prime])
                       for s_prime, r, p in transitions(s, a))
                   for a in ACTIONS)
            delta = max(delta, abs(v - V[s]))
            V[s] = v
        if delta < tol:
            break
    policy = policy_improvement(V, gamma)
    return V, policy
```

O mesmo ponto fixo, menos linhas de código.

## Encurralagens

- **Forgetting to handle terminals.**Se aplicarmos o Bellman a um estado de absorção, ele ainda capta uma "melhor ação" que não muda nada.`if s == terminal: V[s] = 0`- Não .
- **Sup-norm vs L2 convergence.**Utilização`max |V_new - V|`A garantia teórica está na sup-norma.
- **In-place vs synchronous updates.**Atualização`V[s]`O sistema de concentração de gases em local (Gauss-Seidel) converge mais rapidamente do que um sistema de concentração separado.`V_new`O código de produção usa o local.
- **Policy ties.**Se duas ações tiverem o mesmo valor Q,`argmax`A primeira ação em ordem fixa é a de uma relação de separação estável.
- **State-space explosion.**DP é$O(\lvert S \rvert \cdot \lvert A \rvert)$Para a análise, a função é estimada em cerca de 107.

## Usá-lo

Em 2026, o DP é a linha de base de correcção e o ciclo interno dos planejadores:

| Use case | Method |
|----------|--------|
| Solve a small tabular MDP exactly | Value iteration (simpler) or policy iteration (fewer outer steps) |
| Verify a Q-learning / PPO implementation | Compare to DP-optimal $V^{\ast}$ on a toy environment |
| Model-based RL (Phase 9 · 10) | Bellman backup on a learned transition model |
| Planning in AlphaZero / MuZero | Monte Carlo Tree Search = async Bellman backup |
| Offline RL (CQL, IQL) | Conservative Q-iteration — DP with a penalty on OOD actions |

Sempre que alguém diz "a função de valor ideal", eles querem dizer "o ponto fixo DP".$V^{\ast}$ou $Q^{\ast}$num jornal, imaginem este ciclo.

## Envia-o

Salva como`outputs/skill-dp-solver.md`- Não .

```markdown
---
name: dp-solver
description: Solve a small tabular MDP exactly via policy iteration or value iteration. Report convergence behavior.
version: 1.0.0
phase: 9
lesson: 2
tags: [rl, dynamic-programming, bellman]
---

Given an MDP with a known model, output:

1. Choice. Policy iteration vs value iteration. Reason tied to |S|, |A|, γ.
2. Initialization. V_0, starting policy. Convergence sensitivity.
3. Stopping. Sup-norm tolerance ε. Expected number of sweeps.
4. Verification. V*(s_0) computed exactly. Greedy policy extracted.
5. Use. How this baseline will be used to debug/evaluate sampling-based methods.

Refuse to run DP on state spaces > 10⁷. Refuse to claim convergence without a sup-norm check. Flag any γ ≥ 1 on an infinite-horizon task as a guarantee violation.
```

## Exercícios

1. **Easy.**Execute iteração de valor no 4×4 GridWorld com $\gamma \in \lbrace 0.9, 0.99 \rbrace$Quantos baralhos até$\max \lvert \Delta V \rvert < 10^{-6}$Impressão$V^{\ast}$como uma grade 4x4.
2. **Medium.**Compare iteração de política vs iteração de valor no GridWorld *stochastic* (probabilidade de deslize `0.1`Contar: varreduras, tempo de relógio de parede, final $V^{\ast}(0,0)$O que converge mais rápido em iterações?
3. **Hard.**Construir iteração de política modificada: na fase de avaliação, executar apenas $k$- Esvaziam em vez de convergirem.$V^{\ast}(0,0)$erro vs $k$Para$k \in \lbrace 1, 2, 5, 10, 50 \rbrace$O que diz a curva sobre a compensação entre avaliação e melhoria?

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Policy iteration | "DP algorithm" | Alternating evaluation ($V^\pi$) and improvement (greedy $\pi$ w.r.t. $V^\pi$) until the policy stops changing. |
| Value iteration | "Faster DP" | Bellman optimality backup applied in one sweep; converges to $V^{\ast}$ geometrically. |
| Bellman operator | "The recursion" | $(T V)(s) = \max_a \sum P (r + \gamma V(s'))$; a $\gamma$-contraction in sup-norm. |
| Contraction | "Why DP converges" | Any operator $T$ with $\lVert T x - T y \rVert \le \gamma \lVert x - y \rVert$ has a unique fixed point. |
| GPI | "Everything is DP" | Generalized Policy Iteration: any method driving $V$ and $\pi$ to mutual consistency. |
| Synchronous update | "Jacobi-style" | Use old $V$ throughout a sweep; cleanly analyzable but slower. |
| In-place update | "Gauss-Seidel-style" | Use $V$ as it's being updated; converges faster in practice. |

## Mais leitura

- [Sutton & Barto (2018). Ch. 4 — Dynamic Programming](http://incompleteideas.net/book/RLbook2020.pdf) a apresentação canónica da iteração de políticas e da iteração de valores.
- [Bertsekas (2019). Reinforcement Learning and Optimal Control](http://www.athenasc.com/rlbook_athena.html) tratamento rigoroso dos argumentos de mapeamento de contracção.
- [Puterman (2005). Markov Decision Processes](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316887) a iteração da política modificada e a sua análise de convergência.
- [Howard (1960). Dynamic Programming and Markov Processes](https://mitpress.mit.edu/9780262582300/dynamic-programming-and-markov-processes/) o documento original de iteração da política.
- [Bertsekas & Tsitsiklis (1996). Neuro-Dynamic Programming](http://www.athenasc.com/ndpbook.html) a ponte de DP a aproximadamente-DP / profunda RL utilizada em cada aula subsequente.
