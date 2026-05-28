# MDPs, Estados, Ações e Recompensas

> Um Processo de Decisão Markoviano são cinco coisas: estados, ações, transições, recompensas, um desconto. Tudo em RL — Q-learning, PPO, DPO, GRPO — otimiza sobre essa forma. Aprenda uma vez, leia o resto de aprendizado por reforço de graça.

**Tipo:** Aprender
**Linguagens:** Python
**Pré-requisitos:** Fase 1 · 06 (Probabilidade e Distribuições), Fase 2 · 01 (Taxonomia de ML)
**Tempo:** ~45 minutos

## O Problema

Você está escrevendo um bot de xadrez. Ou um planejador de estoque. Ou um agente de trading. Ou o loop PPO que treina um modelo de raciocínio. Quatro domínios diferentes, um fato surpreendente: os quatro colapsam no mesmo objeto matemático.

Aprendizado supervisionado te dá pares `(x, y)` e te pede para ajustar uma função. Aprendizado por reforço não te dá rótulos — apenas um fluxo de estados, as ações que você tomou, e uma recompensa escalar. A jogada venceu o jogo? A decisão de reposição economizou dinheiro? O trade deu lucro? O token que o LLM acabou de produzir levou a uma recompensa maior do juiz?

Você não consegue aprender desse fluxo até formalizá-lo. "O que eu vi", "o que eu fiz", "o que aconteceu depois", "quão bom foi isso" — cada um tem que se tornar um objeto sobre o qual você pode raciocinar. Essa formalização é um Processo de Decisão Markoviano. Todo algoritmo de RL nesta fase, incluindo os loops RLHF e GRPO no final, otimiza sobre essa forma.

## O Conceito

![Processo de decisão markoviano: estados, ações, transições, recompensas, desconto](../assets/mdp.svg)

**Os cinco objetos.**

- **Estados** `S`. Tudo que o agente precisa para decidir. No GridWorld, a célula. No xadrez, o tabuleiro. Em um LLM, a janela de contexto mais qualquer memória.
- **Ações** `A`. As escolhas. Mover cima/baixo/esquerda/direita. Jogar uma jogada. Emitir um token.
- **Transições** `P(s' | s, a)`. Dado o estado `s` e a ação `a`, a distribuição sobre o próximo estado. Determinístico no xadrez, estocástico no estoque, quase-determinístico na decodificação de LLM.
- **Recompensas** `R(s, a, s')`. O sinal escalar. Vitória = +1, derrota = -1. Receita menos custo. O termo de razão de verossimilhança no GRPO.
- **Desconto** `γ ∈ [0, 1)`. Quanto a recompensa futura conta vs presente. `γ = 0,99` compra um horizonte de ~100 passos; `γ = 0,9` compra ~10.

**A propriedade Markov** `P(s_{t+1} | s_t, a_t) = P(s_{t+1} | s_0, a_0, …, s_t, a_t)`. O futuro depende apenas do estado presente. Se não depende, a representação do estado está incompleta — não é uma falha do método, é uma falha do estado.

**Políticas e retornos.** Uma política `π(a | s)` mapeia estados para distribuições de ações. O retorno `G_t = r_t + γ r_{t+1} + γ² r_{t+2} + …` é a soma descontada de recompensas futuras. O valor `V^π(s) = E[G_t | s_t = s]` é o retorno esperado começando de `s` sob a política `π`. O valor Q `Q^π(s, a) = E[G_t | s_t = s, a_t = a]` é o retorno esperado começando com uma ação eespecificaçãoífica. Todo algoritmo de RL estima um desses dois, depois melhora `π` de acordo.

**As equações de Bellman.** As equações de ponto fixo que tudo nesta fase usa:

`V^π(s) = Σ_a π(a|s) Σ_{s', r} P(s', r | s, a) [r + γ V^π(s')]`
`Q^π(s, a) = Σ_{s', r} P(s', r | s, a) [r + γ Σ_{a'} π(a'|s') Q^π(s', a')]`

Essas separam o retorno esperado em "a recompensa deste passo" mais "o valor descontado de onde você chega". Recursivo. Todo algoritmo na Fase 9 ou itera essa equação até convergir (programação dinâmica), amostra dela (Monte Carlo), ou faz bootstrap de um passo (diferença temporal).

## Construa

### Passo 1: um MDP determinístico minúsculo

Um GridWorld 4×4. Agente começa no canto superior esquerdo, terminal no canto inferior direito, recompensa de -1 por passo, ações `{cima, baixo, esquerda, direita}`. Veja `code/main.py`.

```python
GRID = 4
TERMINAL = (3, 3)
ACTIONS = {"up": (-1, 0), "down": (1, 0), "left": (0, -1), "right": (0, 1)}

def step(state, action):
    if state == TERMINAL:
        return state, 0.0, True
    dr, dc = ACTIONS[action]
    r, c = state
    nr = min(max(r + dr, 0), GRID - 1)
    nc = min(max(c + dc, 0), GRID - 1)
    return (nr, nc), -1.0, (nr, nc) == TERMINAL
```

Cinco linhas. Esse é todo o ambiente. Transições determinísticas, penalidade constante por passo, estado terminal absorvente.

### Passo 2: execute uma política

Uma política é uma função de estado para distribuição de ações. A mais simples: aleatório uniforme.

```python
def uniform_policy(state):
    return {a: 0.25 for a in ACTIONS}

def rollout(policy, max_steps=200):
    s, total, steps = (0, 0), 0.0, 0
    for _ in range(max_steps):
        a = sample(policy(s))
        s, r, done = step(s, a)
        total += r
        steps += 1
        if done:
            break
    return total, steps
```

Rode a política aleatória 1000 vezes. O retorno médio fica em torno de -60 a -80 para esse tabuleiro 4×4. O retorno ótimo é -6 (caminho reto para baixo-direita). Fechar esse gap é tudo na Fase 9.

### Passo 3: calcule `V^π` exatamente via equação de Bellman

Para MDPs pequenos a equação de Bellman é um sistema linear. Some os estados, aplique a expectativa, itere até os valores pararem de mudar.

```python
def policy_evaluation(policy, gamma=0.99, tol=1e-6):
    V = {s: 0.0 for s in all_states()}
    while True:
        delta = 0.0
        for s in all_states():
            if s == TERMINAL:
                continue
            v = 0.0
            for a, pi_a in policy(s).items():
                s_next, r, _ = step(s, a)
                v += pi_a * (r + gamma * V[s_next])
            delta = max(delta, abs(v - V[s]))
            V[s] = v
        if delta < tol:
            return V
```

Esta é a avaliação iterativa de política. É o primeiro algoritmo em Sutton & Barto e a base teórica de todo método de RL que se segue.

### Passo 4: `γ` é um hiperparâmetro com significado físico

Horizonte efetivo é aproximadamente `1 / (1 - γ)`. `γ = 0,9` → 10 passos. `γ = 0,99` → 100 passos. `γ = 0,999` → 1000 passos.

Muito baixo e o agente age miope. Muito alto e a atribuição de crédito fica ruidosa, porque muitos passos iniciais compartilham responsabilidade pela recompensa de longo prazo. RLHF de LLM tipicamente usa `γ = 1` porque episódios são curtos e limitados. Tarefas de controle usam `0,95–0,99`. Jogos de estratégia de longo horizonte usam `0,999`.

## Armadilhas

- **Estado não-Markoviano.** Se você precisa das últimas três observações para decidir, o "estado" não é apenas a observação atual. Solução: empilhe frames (DQN em Atari empilha 4) ou use um estado recorrente (LSTM/GRU sobre observações).
- **Recompensas esparsas.** Recompensas apenas de vitória tornam o aprendizado quase impossível em grandes espaços de estado. Modele recompensas (sinal intermediário) ou faça bootstrap com imitação (Fase 9 · 09).
- **Exploração de recompensa.** Otimizar uma recompensa proxy frequentemente produz comportamento patológico. O agente de corrida de barcos da OpenAI ficou girando em círculos coletando powerups para sempre em vez de terminar a corrida. Sempre defina a recompensa a partir do resultado alvo, não do proxy.
- **Eespecificaçãoificação errada de desconto.** `γ = 1` em uma tarefa de horizonte infinito torna todo valor infinito. Sempre limite com um horizonte finito ou `γ < 1`.
- **Escala de recompensa.** Recompensas de {+100, -100} vs {+1, -1} dão políticas ótimas idênticas mas magnitudes de gradiente vastamente diferentes. Normalize para algo em `[-1, 1]` antes de usar em PPO/DQN.

## Use

O stack de 2026 reduz cada pipeline de RL a um MDP antes de tocar código:

|| Situação | Estado | Ação | Recompensa | γ ||
||-----------|-------|--------|--------|---||
|| Controle (locação, manipulação) | Ângulos das juntas + velocidades | Torques contínuos | Eespecificaçãoífica da tarefa, modelada | 0,99 ||
|| Jogos (xadrez, Go, pôquer) | Tabuleiro + histórico | Jogada legal | Vitória=+1 / derrota=-1 | 1,0 (finito) ||
|| Estoque / precificação | Estoque + demanda | Qtd de pedido | Receita - custo | 0,95 ||
|| RLHF para LLMs | Tokens de contexto | Próximo token | Pontuação do modelo de recompensa no final | 1,0 (episódio ~200 tokens) ||
|| GRPO para raciocínio | Prompt + resposta parcial | Próximo token | Verificador 0/1 no final | 1,0 ||

Escreva as cinco tuplas antes de escrever qualquer loop de treino. A maioria dos relatórios de "RL não funciona" remonta a uma formulação de MDP que estava quebrada no papel.

## Entregue

Salve como `outputs/skill-mdp-modeler.md`:

```markdown
---
name: mdp-modeler
description: Dada uma descrição de tarefa, produza uma eespecificaçãoificação de Processo de Decisão Markoviano e sinalize riscos de formulação antes do treino.
version: 1.0.0
phase: 9
lesson: 1
tags: [rl, mdp, modeling]
---

Dada uma tarefa (controle / jogo / recomendação / fine-tuning de LLM), gere:

1. Estado. Vetor de features ou eespecificaçãoificação de tensor exata. Justifique a propriedade Markov.
2. Ação. Conjunto discreto ou faixa contínua. Dimensionalidade.
3. Transição. Determinística, estocástica-com-modelo-conhecido, ou apenas-amostrável.
4. Recompensa. Função e fonte. Esparsa vs modelada. Terminal vs por passo.
5. Desconto. Valor e justificativa do horizonte.

Recuse lançar qualquer MDP onde o estado é não-Markoviano sem menção explícita a empilhamento de frames ou estado recorrente. Recuse qualquer recompensa que não foi definida em termos do resultado alvo. Sinalize qualquer `γ ≥ 1,0` em uma tarefa de horizonte infinito. Sinalize qualquer faixa de recompensa >100x a recompensa média por passo como provável fonte de explosão de gradiente.
```

## Exercícios

1. **Fácil.** Implemente o GridWorld 4×4 e o rollout de política aleatória em `code/main.py`. Rode 10.000 episódios. Reporte média e desvio padrão do retorno. Compare com o retorno ótimo (-6).
2. **Médio.** Rode `policy_evaluation` com `γ ∈ {0,5, 0,9, 0,99}` para a política aleatória uniforme. Imprima `V` como um grid 4×4 para cada. Explique por que os valores dos estados perto do terminal crescem mais rápido com `γ` maior.
3. **Difícil.** Torne o GridWorld estocástico: cada ação desliza para uma direção adjacente com probabilidade `p = 0,1`. Reavalie a política uniforme. `V[start]` melhora ou piora? Por quê?

## Termos Chave

|| Termo | O que as pessoas dizem | O que realmente significa ||
||------|-----------------|-----------------------||
|| MDP | "Setup de RL" | Tupla `(S, A, P, R, γ)` satisfazendo a propriedade Markov. ||
|| Estado | "O que o agente vê" | Estatística suficiente para dinâmicas futuras sob a classe de política escolhida. ||
|| Política | "Comportamento do agente" | Distribuição condicional `π(a | s)` ou mapeamento determinístico `s → a`. ||
|| Retorno | "Recompensa total" | Soma descontada `Σ γ^t r_t` a partir do passo atual. ||
|| Valor | "Quão bom é um estado" | Retorno esperado sob `π` começando de `s`. ||
|| Valor Q | "Quão boa é uma ação" | Retorno esperado sob `π` começando de `s` com a primeira ação `a`. ||
|| Equação de Bellman | "Recursão de programação dinâmica" | Decomposição de ponto fixo do valor / Q em recompensa de um passo mais valor descontado do sucessor. ||
|| Desconto `γ` | "Futuro vs presente" | Peso geométrico sobre recompensa de longo prazo; horizonte efetivo `~1/(1-γ)`. |

## Leituras Complementares

- [Sutton & Barto (2018). Reinforcement Learning: An Introduction, 2nd ed.](http://incompleteideas.net/book/RLbook2020.pdf) — o livro didático. Cap. 3 cobre MDPs e equações de Bellman; Cap. 1 motiva a hipótese de recompensa que fundamenta todas as aulas seguintes.
- [Bellman (1957). Dynamic Programming](https://press.princeton.edu/books/paperback/9780691146683/dynamic-programming) — a origem da equação de Bellman.
- [OpenAI Spinning Up — Part 1: Key Concepts](https://spinningup.openai.com/en/latest/spinningup/rl_intro.html) — intro sucinta a MDPs de uma perespecificaçãotiva de RL profundo.
- [Puterman (2005). Markov Decision Processes](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316887) — a referência de pesquisa operacional sobre MDPs e métodos de solução exata.
- [Littman (1996). Algorithms for Sequential Decision Making (PhD thesis)](https://www.cs.rutgers.edu/~mlittman/papers/thesis-main.pdf) — a derivação mais limpa de MDPs como eespecificaçãoialização de programação dinâmica.
