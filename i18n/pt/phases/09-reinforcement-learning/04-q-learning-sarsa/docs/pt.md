# Diferença temporal  Q-Learning & SARSA

> Monte Carlo espera até o final do episódio. TD atualiza após cada passo, iniciando a próxima estimativa de valor. Q-learning é fora de política e otimista; SARSA é política e cauteloso. Ambos são uma linha de código. Ambos sustentam cada método de RL profundo nesta fase.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 01 (MDPs), Phase 9 · 02 (Dynamic Programming), Phase 9 · 03 (Monte Carlo)
**Time:** ~75 minutes

## O problema

Monte Carlo funciona, mas tem duas exigências caras. Ele precisa de episódios que terminem, e ele só atualiza depois que o retorno final está dentro. Se o seu episódio é de 1.000 passos, MC espera 1.000 passos para atualizar qualquer coisa. É de alta variância, baixa viés, e lento na prática.

A programação dinâmica tem o perfil oposto  backup bootstrapped de variância zero  mas requer um modelo conhecido.

A diferença temporal (TD) divide a diferença.$(s, a, r, s')$, formam um alvo de um passo .$r + \gamma V(s')$e empurrar .$V(s)$Não há modelo, não há episódios completos, há preconceitos em usar uma aproximação.$V$A variância é muito menor do que a MC e as atualizações online a partir do primeiro passo.

Este é o pivô em que todas as modernas RL  DQN, A2C, PPO, SAC  gira. O resto da Fase 9 são camadas de aproximação de funções e truques construídos em cima da atualização TD de um passo que você vai escrever nesta lição.

## O conceito

![Q-learning vs SARSA: off-policy max vs on-policy Q(s', a')](../assets/td.svg)

**The TD(0) update for V:**

```math
V(s) \leftarrow V(s) + \alpha [r + \gamma V(s') - V(s)]
```

A quantidade em brackets é o erro TD $\delta = r + \gamma V(s') - V(s)$É o analogo online de $G_t - V(s_t)$Em MC. A convergência exige $\alpha$A satisfação de Robbins-Monro ($\sum \alpha = \infty$- Não .$\sum \alpha^2 < \infty$O Governo da República, em especial, foi o primeiro a visitar os Estados-Membros.

**Q-learning.**Um método de controlo TD fora da política:

```math
Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma \max_{a'} Q(s', a') - Q(s, a)]
```

O `max`Assume que a política *comprometida* será seguida a partir de$s'$O desacoplamento faz com que o aprendizado Q aprenda.$Q^{\ast}$Mnih et al. (2015) converteram isso em aprendizado Q profundo na Atari (Lesson 05).

**SARSA.**Um método de TD sobre a política:

```math
Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma Q(s', a') - Q(s, a)]
```

O nome é o tuple .$(s, a, r, s', a')$A SARSA utiliza a acção .$a'$O agente é o que vai seguir, não o ganancioso.`argmax`Converge para$Q^\pi$Para o que quer que seja avaro .$\pi$Está a correr, que no limite $\epsilon \to 0$torna-se$Q^{\ast}$- Não .

**The cliff-walking difference.**Na tarefa clássica de caminhada em penhasco (caída-desde-penhasco = recompensa -100), a aprendizagem Q aprende o caminho ideal ao longo da borda do penhasco, mas ocasionalmente assume a penalidade durante a exploração. A SARSA aprende um caminho mais seguro a um passo da falésia porque faz com que o ruído da exploração seja incluído em seu valor Q. Com o treinamento, ambos atingem o ponto ideal.$\epsilon \to 0$Na prática, importa: quando a exploração está realmente a acontecer na implantação, o comportamento da SARSA é mais conservador.

**Expected SARSA.**Substitui$Q(s', a')$com o seu valor esperado inferior a $\pi$- Não .

```math
Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma \sum_{a'} \pi(a' \mid s') Q(s', a') - Q(s, a)]
```

Variância menor do que a SARSA (não há amostra de $a'$O objetivo é o mesmo em matéria de política, muitas vezes o padrão dos livros didáticos modernos.

**n-step TD and TD(λ).**Interpolar entre TD(0) e MC, esperando $n$Passo antes de arrancar. $n=1$é TD, $n=\infty$é MC. TD(λ) médias sobre todos $n$com pesos geométricos $(1-\lambda)\lambda^{n-1}$A maioria dos usos de RL profundo$n$Entre 3 e 20.

```figure
qlearning-gridworld
```

## Construí-lo

### Passo 1: SARSA sobre a política de avareza

```python
def sarsa(env, episodes, alpha=0.1, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})

    def choose(s):
        if random() < epsilon:
            return choice(ACTIONS)
        return max(Q[s], key=Q[s].get)

    for _ in range(episodes):
        s = env.reset()
        a = choose(s)
        while True:
            s_next, r, done = env.step(s, a)
            a_next = choose(s_next) if not done else None
            target = r + (gamma * Q[s_next][a_next] if not done else 0.0)
            Q[s][a] += alpha * (target - Q[s][a])
            if done:
                break
            s, a = s_next, a_next
    return Q
```

A única diferença com a aprendizagem Q é a linha-alvo.

### Passo 2: Aprendizagem Q

```python
def q_learning(env, episodes, alpha=0.1, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})
    for _ in range(episodes):
        s = env.reset()
        while True:
            a = choose(s, Q, epsilon)
            s_next, r, done = env.step(s, a)
            target = r + (gamma * max(Q[s_next].values()) if not done else 0.0)
            Q[s][a] += alpha * (target - Q[s][a])
            if done:
                break
            s = s_next
    return Q
```

O `max`O símbolo é a diferença entre dentro da política e fora da política.

### Passo 3: Curvas de aprendizagem

A média de retorno de pista por 100 episódios. Q-learning converge mais rápido no GridWorld determinista simples; SARSA é mais conservador no caminhão em penhasco.`code/main.py`, ambos são quase ótimos depois de cerca de 2.000 episódios com$\alpha=0.1, \epsilon=0.1$- Não .

### Passo 4: comparação com a verdade DP

Iteração de valor de execução (Lessão 02) para obter $Q^{\ast}$- Cheque .$\max_{s,a} \lvert Q_{\text{learned}}(s,a) - Q^{\ast}(s,a) \rvert$Um agente TD tabuleiro saudável atinge o interior .`~0.5`no 4x4 GridWorld depois de 10.000 episódios.

## Encurralagens

- **Initial Q values matter.**Optimismo inicial ($Q = 0$A política de ganância pode ser atrapada para sempre.
- **α schedule.**Constantemente .$\alpha$É bom para problemas não estacionários.$\alpha_n = 1/n$dá convergência em teoria mas é muito lento na prática  pin $\alpha$em `[0.05, 0.3]`e monitorar a curva de aprendizagem.
- **ε schedule.**Começar alto ($\epsilon=1.0$), decadência a $\epsilon=0.05$. "GLIE" (avididade no limite com exploração infinita) é a condição de convergência.
- **Max bias in Q-learning.**O `max`O operador é tendencioso para cima quando $Q$O método de aprendizagem dupla de Hasselt (usado pelo DDQN na lição 05) corrige isto com duas tabelas de Q.
- **Non-terminating episodes.**TD pode aprender sem terminais, mas você precisa de captar os passos ou lidar com a banda de arranque corretamente na banda. padrão: tratar a banda como não terminal, continuar a arrancar.
- **State hashing.**Se os estados forem tuples/tensores, use uma chave hashável (tuple, não lista; tuple de flotas arredondadas, não cruas).

## Usá-lo

O panorama da TD de 2026:

| Task | Method | Reason |
|------|--------|--------|
| Small tabular environments | Q-learning | Learns optimal policy directly. |
| On-policy safety-critical | SARSA / Expected SARSA | Conservative during exploration. |
| High-dimensional state | DQN (Phase 9 · 05) | Neural-net Q-function with replay and target net. |
| Continuous actions | SAC / TD3 (Phase 9 · 07) | TD update on a Q-network; policy net emits actions. |
| LLM RL (reward-model-based) | PPO / GRPO (Phase 9 · 08, 12) | Actor-critic with TD-style advantage via GAE. |
| Offline RL | CQL / IQL (Phase 9 · 08) | Q-learning with conservative regularization. |

90% do "RL" que você lê sobre em 2026 artigos é alguma elaboração de Q-learning ou SARSA. Entender a atualização tabuleira em seus dedos antes de ler mais fundo.

## Envia-o

Salva como`outputs/skill-td-agent.md`- Não .

```markdown
---
name: td-agent
description: Pick between Q-learning, SARSA, Expected SARSA for a tabular or small-feature RL task.
version: 1.0.0
phase: 9
lesson: 4
tags: [rl, td-learning, q-learning, sarsa]
---

Given a tabular or small-feature environment, output:

1. Algorithm. Q-learning / SARSA / Expected SARSA / n-step variant. One-sentence reason tied to on-policy vs off-policy and variance.
2. Hyperparameters. α, γ, ε, decay schedule.
3. Initialization. Q_0 value (optimistic vs zero) and justification.
4. Convergence diagnostic. Target learning curve, `|Q - Q*|` check if DP is possible.
5. Deployment caveat. How will exploration behave at inference? Is SARSA's conservatism needed?

Refuse to apply tabular TD to state spaces > 10⁶. Refuse to ship a Q-learning agent without a max-bias caveat. Flag any agent trained with ε held at 1.0 throughout (no exploitation phase).
```

## Exercícios

1. **Easy.**Implementar Q-learning e SARSA no GridWorld 4×4. Planejar curvas de aprendizagem (retorno médio por 100 episódios) para 2.000 episódios. Quem converge mais rápido?
2. **Medium.**Construa um ambiente de caminhada em penhasco (4×12, a última linha é o penhasco com recompensa -100 e reinicie para começar). Compare as políticas finais de Q-learning e SARSA.
3. **Hard.**Implementar o duplo aprendizado Q. num GridWorld (ruído gaussiano) com um volume de ruído.$\sigma=5$adicionado à recompensa por etapa), mostram sobreestimações de aprendizagem Q $V^{\ast}(0,0)$A aprendizagem dupla de Q não faz isso.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| TD error | "The update signal" | $\delta = r + \gamma V(s') - V(s)$, the bootstrapped residual. |
| TD(0) | "One-step TD" | Update after every transition using only the next state's estimate. |
| Q-learning | "Off-policy RL 101" | TD update with `max` over next-state actions; learns $Q^{\ast}$ regardless of behavior policy. |
| SARSA | "On-policy Q-learning" | TD update using the actual next action; learns $Q^\pi$ for current ε-greedy π. |
| Expected SARSA | "The low-variance SARSA" | Replace sampled $a'$ with its expectation under π. |
| GLIE | "Correct exploration schedule" | Greedy in the Limit with Infinite Exploration; needed for Q-learning convergence. |
| Bootstrapping | "Using current estimate in the target" | What distinguishes TD from MC. Source of bias but massive variance reduction. |
| Maximization bias | "Q-learning overestimates" | `max` over noisy estimates is upward-biased; fixed by Double Q-learning. |

## Mais leitura

- [Watkins & Dayan (1992). Q-learning](https://link.springer.com/article/10.1007/BF00992698) o papel original e a prova de convergência.
- [Sutton & Barto (2018). Ch. 6 — Temporal-Difference Learning](http://incompleteideas.net/book/RLbook2020.pdf) TD(0), SARSA, Q-learning, Esperado SARSA.
- [Hasselt (2010). Double Q-learning](https://papers.nips.cc/paper_files/paper/2010/hash/091d584fced301b442654dd8c23b3fc9-Abstract.html) fixação do preconceito de maximização.
- [Seijen, Hasselt, Whiteson, Wiering (2009). A Theoretical and Empirical Analysis of Expected SARSA](https://ieeexplore.ieee.org/document/4927542) motivação esperada para a SARSA.
- [Rummery & Niranjan (1994). On-line Q-learning using connectionist systems](https://www.researchgate.net/publication/2500611_On-Line_Q-Learning_Using_Connectionist_Systems) o artigo que contou o SARSA (então chamado de "Q-learning de conexão modificada").
- [Sutton & Barto (2018). Ch. 7 — n-step Bootstrapping](http://incompleteideas.net/book/RLbook2020.pdf) generaliza TD(0) para TD(n), o caminho da aprendizagem Q para os traços de elegibilidade e, mais tarde, GAE em PPO.
