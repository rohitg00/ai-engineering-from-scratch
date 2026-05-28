# Redes Q Profundas (DQN)

> 2013: Mnih treinou uma rede Q-learning em pixels brutos, superou todo agente clássico de RL em sete jogos do Atari. 2015: estendido para 49 jogos, publicado no Nature, iniciou a era do RL profundo. DQN é Q-learning mais três truques que tornam a aproximação por função estável.

**Tipo:** Construir
**Linguagens:** Python
**Pré-requisitos:** Fase 3 · 03 (Backpropagation), Fase 9 · 04 (Q-learning, SARSA)
**Tempo:** ~75 minutos

## O Problema

Q-learning tabular precisa de um valor Q separado para cada par (estado, ação). Um tabuleiro de xadrez tem ~10⁴³ estados. Um frame do Atari é 210×160×3 = 100.800 features. RL tabular morre em milhares de estados, quanto mais bilhões.

A correção é óbvia retroespecificaçãotivamente: substitua a tabela Q por uma rede neural, `Q(s, a; θ)`. Mas óbvia-retroespecificaçãotivamente levou décadas. Aproximação por função ingênua com Q-learning diverge sob o "triado mortal" — aproximação por função + bootstrap + aprendizado off-policy. Mnih et al. (2013, 2015) identificaram três truques de engenharia que estabilizam o aprendizado:

1. **Experience replay** descorrelaciona transições.
2. **Rede-alvo** congela o alvo de bootstrap.
3. **Clip de recompensa** normaliza magnitudes de gradiente.

DQN no Atari foi a primeira vez que uma única arquitetura com um único conjunto de hiperparâmetros resolveu dezenas de problemas de controle a partir de pixels brutos. Tudo construído em "RL profundo" desde então — DDQN, Rainbow, Dueling, Distributional, R2D2, Agent57 — está empilhado sobre essa base de três truques.

## O Conceito

![Loop de treino DQN: env, buffer de replay, rede online, rede-alvo, perda TD de Bellman](../assets/dqn.svg)

**O objetivo.** DQN minimiza a perda TD de um passo em uma função Q neural:

`L(θ) = E_{(s,a,r,s')~D} [ (r + γ max_{a'} Q(s', a'; θ^-) - Q(s, a; θ))² ]`

`θ` = rede online, atualizada a cada passo por descida do gradiente. `θ^-` = rede-alvo, copiada periodicamente de `θ` (a cada ~10.000 passos). `D` = buffer de replay de transições passadas.

**Os três truques, em ordem de importância:**

**Experience replay.** Um buffer de anel de `~10⁶` transições. Cada passo de treino amostra um minibatch uniformemente. Isso quebra correlação temporal (frames sucessivos são quase idênticos), permite que a rede aprenda de transições raras de recompensa muitas vezes, e descorrelaciona atualizações de gradiente consecutivas. Sem ele, TD on-policy com rede neural diverge no Atari.

**Rede-alvo.** Usar a mesma rede `Q(·; θ)` em ambos os lados da equação de Bellman faz o alvo mudar a cada atualização — "perseguindo sua própria cauda". A solução: mantenha uma segunda rede `Q(·; θ^-)` com pesos congelados. A cada `C` passos, copie `θ → θ^-`. Isso estabiliza o alvo de regressão por milhares de passos de gradiente. Atualizações suaves `θ^- ← τ θ + (1-τ) θ^-` (usadas em DDPG, SAC) são uma variante mais suave.

**Clip de recompensa.** Magnitudes de recompensa do Atari variam de 1 a 1000+. Clipar para `{-1, 0, +1}` impede que qualquer jogo individual domine o gradiente. Errado quando a magnitude de recompensa importa; fine para Atari onde só o sinal importa.

**Double DQN.** Hasselt (2016) corrige viés de maximização: use a rede online para *selecionar* a ação, a rede-alvo para *avaliá-la*.

`target = r + γ Q(s', argmax_{a'} Q(s', a'; θ); θ^-)`

Substituição direta, consistentemente melhor. Use por padrão.

**Outras melhorias (Rainbow, 2017):** replay priorizado (amostra transições de alto erro TD mais), arquitetura dueling (cabeças separadas `V(s)` e de vantagem), redes ruidosas (exploração aprendida), retornos n-step, Q distribucional (C51/QR-DQN), bootstrap multi-passo. Cada uma adiciona alguns por cento; os ganhos são aproximadamente aditivos.

## Construa

O código aqui é stdlib-only sem numpy — usamos um MLP de uma camada oculta de mão em um GridWorld contínuo minúsculo, então cada passo de treino roda em microssegundos. O algoritmo é idêntico ao DQN do Atari em escala.

### Passo 1: buffer de replay

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

~50.000 de capacidade para Atari; 5.000 basta para nosso ambiente de brinquedo.

### Passo 2: uma Q-network minúscula (MLP manual)

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

Passada forward: linear → ReLU → linear. Essa é toda a rede.

### Passo 3: a atualização DQN

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

A forma é o Q-learning da Aula 04 com duas diferenças: (a) fazemos backprop por um `Q(·; θ)` diferenciável em vez de indexar uma tabela, (b) o alvo usa `Q(·; θ^-)`.

### Passo 4: o loop externo

Para cada episódio, aja ε-guloso em `Q(·; θ)`, empurre transições no buffer, amostra um minibatch, dê um passo de gradiente, sincronize periodicamente `θ^- ← θ`. O padrão:

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

Em nosso GridWorld minúsculo com estado one-hot de 16 dims, o agente aprende uma política quase-ótima em ~500 episódios. No Alice, escale para 200M frames e adicione um extrator de features CNN.

## Armadilhas

- **Triado mortal.** Aproximação por função + off-policy + bootstrap pode divergir. DQN mitiga com rede-alvo + replay; não remova nenhum dos dois.
- **Exploração.** ε deve decair, tipicamente de 1,0 para 0,01 nos primeiros ~10% do treino. Sem exploração inicial suficiente a Q-net converge a uma bacia local.
- **Superestimação.** `max` sobre Q ruidoso é enviesado para cima. Sempre use Double DQN em produção.
- **Escala de recompensa.** Clip ou normalize recompensas; a magnitude do gradiente é proporcional à magnitude da recompensa.
- **Coldstart do buffer de replay.** Não treine até o buffer ter algumas milhares de transições. Gradientes iniciais em ~20 samples sobreadaptam.
- **Frequência de sincronização da rede-alvo.** Frequente demais ≈ sem rede-alvo; infrequente demais ≈ alvos obsoletos. DQN do Atari usa 10.000 passos de ambiente. Regra geral: sincronize a cada ~1/100 do horizonte de treino.
- **Pré-processamento de observação.** DQN do Atari empilha 4 frames para tornar o estado Markov. Qualquer env com informação de velocidade precisa de empilhamento de frames ou estado recorrente.

## Use

Em 2026, DQN raramente é o estado da arte mas continua sendo o algoritmo off-policy de referência:

|| Tarefa | Método escolhido | Por que não DQN? ||
||------|------------------|--------------||
|| Ações discretas estilo Atari | Rainbow DQN ou Muesli | Mesmo framework, mais truques. ||
|| Controle contínuo | SAC / TD3 (Fase 9 · 07) | DQN não tem rede de política. ||
|| On-policy / alto throughput | PPO (Fase 9 · 08) | Sem buffer de replay; mais fácil de escalar. ||
|| RL offline | CQL / IQL / Decision Transformer | Alvos Q conservadores, sem explosões de bootstrap. ||
|| Grandes espaços de ação discreta (recomendador) | DQN com embedding de ação, ou IMPALA | Fine; decoração importa. ||
|| RL de LLM | PPO / GRPO | Nível de sequência, não de passo; perda diferente. ||

As aulas ainda funcionam. Replay e redes-alvo aparecem em SAC, TD3, DDPG, SAC-X, buffer de auto-jogo do AlphaZero, e todo método de RL offline. Clip de recompensa vive como normalização de vantagem no PPO. A arquitetura é o blueprint.

## Entregue

Salve como `outputs/skill-dqn-trainer.md`:

```markdown
---
name: dqn-trainer
description: Produza uma configuração de treino DQN (buffer, sync de rede-alvo, agenda de ε, clip de recompensa) para uma tarefa de RL com ações discretas.
version: 1.0.0
phase: 9
lesson: 5
tags: [rl, dqn, deep-rl]
---

Dado um ambiente com ações discretas (forma da observação, contagem de ações, horizonte, escala de recompensa), gere:

1. Rede. Arquitetura (MLP / CNN / Transformer), dim das features, profundidade.
2. Buffer de replay. Capacidade, tamanho do minibatch, tamanho do warmup.
3. Rede-alvo. Estratégia de sync (duro a cada C passos ou suave τ).
4. Exploração. ε início / fim / duração da agenda.
5. Perda. Huber vs MSE, valor de clip de gradiente, regra de clip de recompensa.
6. Double DQN. Ligado por padrão a menos que haja razão explícita para desligar.

Recuse lançar um DQN sem rede-alvo, sem buffer de replay, ou com ε mantido em 1. Recuse tarefas de ação contínua (roteie para SAC / TD3). Sinalize qualquer faixa de recompensa > 10× a média por passo como necessitando clip ou normalização de escala.
```

## Exercícios

1. **Fácil.** Execute `code/main.py`. Plote a curva de retorno por episódio. Quantos episódios até a média móvel ultrapassar -10?
2. **Médio.** Desligue a rede-alvo (use a rede online para ambos os lados do alvo de Bellman). Meça instabilidade de treino — o retorno oscila ou diverge?
3. **Difícil.** Adicione Double DQN: use a rede online para escolher `argmax a'`, rede-alvo para avaliar. Compare viés de `Q(s_0, best_a)` vs `V*(s_0)` verdadeiro após 1.000 episódios com vs sem Double DQN em um GridWorld de recompensa ruidosa.

## Termos Chave

|| Termo | O que as pessoas dizem | O que realmente significa ||
||------|-----------------|-----------------------||
|| DQN | "Q-learning profundo" | Q-learning com função Q neural, buffer de replay e rede-alvo. ||
|| Experience replay | "Transições embaralhadas" | Buffer de anel amostrado uniformemente a cada passo de gradiente; descorrelaciona dados. ||
|| Rede-alvo | "Bootstrap congelado" | Cópia periódica de Q usada no alvo de Bellman; estabiliza treino. ||
|| Triado mortal | "Por que RL diverge" | Aproximação por função + bootstrap + off-policy = sem garantia de convergência. ||
|| Double DQN | "Correção para viés de maximização" | Rede online seleciona ação, rede-alvo avalia. ||
|| Dueling DQN | "Cabeças V e A" | Decomponha Q = V + A - mean(A); mesma saída, melhor fluxo de gradiente. ||
|| Rainbow | "Todos os truques" | DDQN + PER + dueling + n-step + ruidoso + distribucional em um. ||
|| PER | "Replay Priorizado" | Amostra transições proporcional à magnitude do erro TD. |

## Leituras Complementares

- [Mnih et al. (2013). Playing Atari with Deep Reinforcement Learning](https://arxiv.org/abs/1312.5602) — o paper do workshop NeurIPS 2013 que iniciou o RL profundo.
- [Mnih et al. (2015). Human-level control through deep reinforcement learning](https://www.nature.com/articles/nature14236) — o paper do Nature, DQN de 49 jogos.
- [Hasselt, Guez, Silver (2016). Deep Reinforcement Learning with Double Q-learning](https://arxiv.org/abs/1509.06461) — DDQN.
- [Wang et al. (2016). Dueling Network Architectures](https://arxiv.org/abs/1511.06581) — dueling DQN.
- [Hessel et al. (2018). Rainbow: Combining Improvements in Deep RL](https://arxiv.org/abs/1710.02298) — o paper de truques empilhados.
- [OpenAI Spinning Up — DQN](https://spinningup.openai.com/en/latest/algorithms/dqn.html) — exposição moderna clara.
- [Sutton & Barto (2018). Cap. 9 — Previsão On-policy com Aproximação](http://incompleteideas.net/book/RLbook2020.pdf) — o tratamento didático do "triado mortal" (aproximação por função + bootstrap + off-policy) que a rede-alvo e o buffer de replay do DQN foram projetados para domar.
- [Implementação DQN do CleanRL](https://docs.cleanrl.dev/rl-algorithms/dqn/) — DQN single-file de referência usado em estudos de ablação; bom de ler junto com a versão from-scratch desta aula.
