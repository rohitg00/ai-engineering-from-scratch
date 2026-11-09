# Redes Q Profundas (DQN)

> 2013: Mnih treinou uma rede de aprendizado Q em pixels brutos, venceu todos os agentes RL clássicos em sete jogos Atari. 2015: estendido para 49 jogos, publicado na Nature, desencadeou a era do aprendizado profundo.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 03 (Backpropagation), Phase 9 · 04 (Q-learning, SARSA)
**Time:** ~75 minutes

## O problema

O tabular Q-learning precisa de um valor Q separado para cada par (estado, ação). Uma tabela de xadrez tem ~1043 estados. Um quadro Atari é 210×160×3 = 100.800 recursos.

A solução é óbvia em retrospectiva: substituir a tabela Q por uma rede neural.$Q(s, a; \theta)$Mas a aproximação das funções naívas com a aprendizagem Q diverge sob a "triade mortal"  aproximação das funções + bootstrapping + aprendizagem fora da política. Mnih et al. (2013, 2015) identificou três truques de engenharia que estabilizam a aprendizagem:

1. **Experience replay**descorrela as transições.
2. **Target network**congela o alvo da banda de arranque.
3. **Reward clipping**normaliza as magnitudes de gradiente.

A DQN no Atari foi a primeira vez que uma única arquitetura com um único conjunto de hiperparâmetros resolveu dezenas de problemas de controle a partir de pixels brutos. Tudo o "deep-RL" construído desde DDQN, Rainbow, Dueling, Distribucional, R2D2, Agent57  é empilhado em cima desta base de três truques.

## O conceito

![DQN training loop: env, replay buffer, online net, target net, Bellman TD loss](../assets/dqn.svg)

**The objective.**DQN minimiza a perda TD de um passo em uma função Q neural:

```math
L(\theta) = \mathbb{E}_{(s,a,r,s') \sim D}[ (r + \gamma \max_{a'} Q(s', a'; \theta^-) - Q(s, a; \theta))^2 ]
```

$\theta$= rede online, atualizada a cada passo por descida de gradiente. $\theta^-$= rede-alvo, copiada periodicamente a partir de $\theta$(a cada ~ 10.000 passos). $D$= Buffer de repetição de transições passadas.

**The three tricks, in order of importance:**

**Experience replay.**Um tampão de anel de `~10⁶`Transmissões. Cada etapa de treinamento mostra um minibatch uniformemente aleatório. Isso quebra a correlação temporal (quadros sucessivos são quase idênticos), permite que a rede aprenda de raras transições gratificantes muitas vezes e descorrela atualizações de gradiente consecutivas. Sem ele, a TD na política com uma rede neural diverge na Atari.

**Target network.**Usando a mesma rede $Q(\cdot; \theta)$Em ambos os lados da equação Bellman faz com que o alvo se mova a cada atualização  "perseguindo sua própria cauda".$Q(\cdot; \theta^-)$com pesos congelados.$C$Passo, cópia.$\theta \to \theta^-$Estabiliza o alvo de regressão para milhares de passos de gradiente de uma vez.$\theta^- \leftarrow \tau \theta + (1-\tau) \theta^-$(usados em DDPG, SAC) são uma variante mais suave.

**Reward clipping.**As magnitudes da recompensa Atari variam de 1 a 1000+.$\lbrace-1, 0, +1 \rbrace$Não é certo quando a magnitude da recompensa é importante, bem para a Atari, onde só a assinatura é importante.

**Double DQN.**Hasselt (2016) corrige o viés de maximização: use a rede online para *selecionar* a ação, a rede alvo para * avaliá-la*.

```math
\text{target} = r + \gamma Q(s', \arg\max_{a'} Q(s', a'; \theta); \theta^-)
```

Substituição de drop-in, consistentemente melhor.

**Other improvements (Rainbow, 2017):**Reprodução prioritária (muitas transições de alto TD-erro), arquitetura de duelo (separada $V(s)$A primeira é a de um sistema de gestão de dados, que é o sistema de gestão de dados e de dados, que é o sistema de gestão de dados e de dados, que é o sistema de gestão de dados e de dados, que é o sistema de gestão de dados e de dados e que é o sistema de gestão de dados e de dados.

```figure
f3-dqn-stability
```

## Construí-lo

O código aqui é stdlib-only numpy-free  usamos um MLP de camada oculta única rolado à mão em um pequeno GridWorld contínuo, então cada passo de treinamento é executado em microsecondas. O algoritmo é idêntico ao Atari DQN em escala.

### Passo 1: Buffer de repetição

```python
class ReplayBuffer:
    def __init__(self, capacity):
        self.buf = []
        self.capacity = capacity
    def push(self, s, a, r, s_next, done):
        if len(self.buf) == self.capacity:
            self.buf.pop(0)
        self.buf.append((s, a, r, s_next, done))
    def sample(self, batch, rng):
        return rng.sample(self.buf, batch)
```

- 106 capacidade para a Atari, como no DQN original (recolhe 50.000 transições antes de começar a aprendizagem); 5.000 são suficientes para o nosso ambiente de brinquedos.

### Passo 2: uma pequena rede Q (MLP manual)

```python
class QNet:
    def __init__(self, n_in, n_hidden, n_actions, rng):
        self.W1 = [[rng.gauss(0, 0.3) for _ in range(n_in)] for _ in range(n_hidden)]
        self.b1 = [0.0] * n_hidden
        self.W2 = [[rng.gauss(0, 0.3) for _ in range(n_hidden)] for _ in range(n_actions)]
        self.b2 = [0.0] * n_actions
    def forward(self, x):
        h = [max(0.0, sum(w * xi for w, xi in zip(row, x)) + b) for row, b in zip(self.W1, self.b1)]
        q = [sum(w * hi for w, hi in zip(row, h)) + b for row, b in zip(self.W2, self.b2)]
        return q, h
```

Passagem para a frente: linear → ReLU → linear.

### Passo 3: atualização do DQN

```python
def train_step(online, target, batch, gamma, lr):
    grads = zeros_like(online)
    for s, a, r, s_next, done in batch:
        q, h = online.forward(s)
        if done:
            y = r
        else:
            q_next, _ = target.forward(s_next)
            y = r + gamma * max(q_next)
        td_error = q[a] - y
        accumulate_grads(grads, online, s, h, a, td_error)
    apply_sgd(online, grads, lr / len(batch))
```

A forma é Q-learning da lição 04 com duas diferenças: (a) nós retro-prop através de um diferenciável $Q(\cdot; \theta)$Em vez de indexar uma tabela, (b) as utilizações-alvo $Q(\cdot; \theta^-)$- Não .

### Passo 4: o circuito externo

Para cada episódio, agem com ganância.$Q(\cdot; \theta)$, empurrar transições para o tampão, amostrar um minibatch, dar um passo de gradiente, sincronizar periodicamente $\theta^- \leftarrow \theta$O padrão:

```python
for episode in range(N):
    s = env.reset()
    while not done:
        a = epsilon_greedy(online, s, epsilon)
        s_next, r, done = env.step(s, a)
        buffer.push(s, a, r, s_next, done)
        if len(buffer) >= batch:
            train_step(online, target, buffer.sample(batch), gamma, lr)
        if steps % sync_every == 0:
            target = copy(online)
        s = s_next
```

No nosso pequeno GridWorld com um estado de 16 dimensões, o agente aprende uma política quase ótima em cerca de 500 episódios.

## Encurralagens

- **Deadly triad.**A aproximação de função + off-policy + bootstrapping pode divergir. DQN mitiga com rede de alvo + replay; não remova nenhum.
- **Exploration.**A rede Q-net converge para uma bacia local sem exploração precoce suficiente.
- **Overestimation.** `max`Em relação ao Q barulhento, a taxa de aumento é parcial.
- **Reward scale.**Clip ou normalizar recompensas; a magnitude do gradiente é proporcional à magnitude da recompensa.
- **Replay buffer coldstart.**Não treine até o tampão ter alguns milhares de transições.
- **Target sync frequency.**O Atari DQN usa 10.000 passos de env. Regra geral: sincronizar cada 1/100 do horizonte de treinamento.
- **Observation preprocessing.**A Atari DQN apila 4 quadros para fazer estado Markov. Qualquer env com informações de velocidade precisa de estado de quadros ou recorrente.

## Usá-lo

Em 2026, o DQN raramente é o estado da arte, mas continua a ser o algoritmo de referência fora da política:

| Task | Method of choice | Why not DQN? |
|------|------------------|--------------|
| Discrete-action Atari-like | Rainbow DQN or Muesli | Same framework, more tricks. |
| Continuous control | SAC / TD3 (Phase 9 · 07) | DQN has no policy network. |
| On-policy / high-throughput | PPO (Phase 9 · 08) | No replay buffer; easier to scale. |
| Offline RL | CQL / IQL / Decision Transformer | Conservative Q targets, no bootstrapping blowups. |
| Large discrete action spaces (recommender) | DQN with action embedding, or IMPALA | Fine; decoration matters. |
| LLM RL | PPO / GRPO | Sequence-level, not step-level; different loss. |

As lições ainda viajam. Replay e redes alvo aparecem em SAC, TD3, DDPG, SAC-X, buffer de auto-replay do AlphaZero e em todos os métodos offline de RL. O recorte de recompensas continua a ser uma normalização de vantagem no PPO. A arquitetura é o projeto.

## Envia-o

Salva como`outputs/skill-dqn-trainer.md`- Não .

```markdown
---
name: dqn-trainer
description: Produce a DQN training config (buffer, target sync, ε schedule, reward clipping) for a discrete-action RL task.
version: 1.0.0
phase: 9
lesson: 5
tags: [rl, dqn, deep-rl]
---

Given a discrete-action environment (observation shape, action count, horizon, reward scale), output:

1. Network. Architecture (MLP / CNN / Transformer), feature dim, depth.
2. Replay buffer. Capacity, minibatch size, warmup size.
3. Target network. Sync strategy (hard every C steps or soft τ).
4. Exploration. ε start / end / schedule length.
5. Loss. Huber vs MSE, gradient clip value, reward clipping rule.
6. Double DQN. On by default unless explicit reason to disable.

Refuse to ship a DQN with no target network, no replay buffer, or ε held at 1. Refuse continuous-action tasks (route to SAC / TD3). Flag any reward range > 10× per-step mean as needing clipping or scale normalization.
```

## Exercícios

1. **Easy.**Corra .`code/main.py`Quantos episódios até que a média de execução exceda -10?
2. **Medium.**Desativar a rede-alvo (utilizar a rede online para ambos os lados do alvo Bellman).
3. **Hard.**Adicionar DQN duplo: usar a rede online para escolher `argmax a'`, meta rede para avaliar.`Q(s_0, best_a)`contra verdade$V^{\ast}(s_0)$Depois de 1.000 episódios com vs. sem Double DQN em um GridWorld de prêmios barulhentos.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| DQN | "Deep Q-learning" | Q-learning with a neural Q-function, replay buffer, and target network. |
| Experience replay | "Shuffled transitions" | Ring buffer sampled uniformly each gradient step; decorrelates data. |
| Target network | "Frozen bootstrap" | Periodic copy of Q used in the Bellman target; stabilizes training. |
| Deadly triad | "Why RL diverges" | Function approximation + bootstrapping + off-policy = no convergence guarantee. |
| Double DQN | "Fix for maximization bias" | Online net selects action, target net evaluates it. |
| Dueling DQN | "V and A heads" | Decompose Q = V + A - mean(A); same output, better gradient flow. |
| Rainbow | "All the tricks" | DDQN + PER + dueling + n-step + noisy + distributional in one. |
| PER | "Prioritized Replay" | Sample transitions proportional to TD-error magnitude. |

## Mais leitura

- [Mnih et al. (2013). Playing Atari with Deep Reinforcement Learning](https://arxiv.org/abs/1312.5602) o artigo de workshop de 2013 do NeurIPS que deu início à RL profunda.
- [Mnih et al. (2015). Human-level control through deep reinforcement learning](https://www.nature.com/articles/nature14236)O artigo Nature, 49 jogos DQN.
- [Hasselt, Guez, Silver (2016). Deep Reinforcement Learning with Double Q-learning](https://arxiv.org/abs/1509.06461) DDQN.
- [Wang et al. (2016). Dueling Network Architectures](https://arxiv.org/abs/1511.06581)Duelos com DQN.
- [Hessel et al. (2018). Rainbow: Combining Improvements in Deep RL](https://arxiv.org/abs/1710.02298)O papel de truques empilhados.
- [Sutton & Barto (2018). Ch. 9 — On-policy Prediction with Approximation](http://incompleteideas.net/book/RLbook2020.pdf) o tratamento manual da "triada mortal" (aproximativa de funções + bootstrapping + off-policy) que a rede-alvo e o buffer de repetição da DQN são concebidos para domar.
- [CleanRL DQN implementation](https://docs.cleanrl.dev/rl-algorithms/dqn/) DQN de referência de ficheiro único utilizado em estudos de ablação; bom para ler ao lado da versão do zero desta lição.
