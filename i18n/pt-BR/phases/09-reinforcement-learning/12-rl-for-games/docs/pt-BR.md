# RL para jogos  AlphaZero, MuZero e a Era do LLM-Razonamento

> 1992: TD-Gammon venceu campeões humanos no backgammon com TD puro. 2016: AlphaGo venceu Lee Sedol. 2017: AlphaZero dominou xadrez, shogi e Go a partir do zero. 2025: DeepSeek-R1 provou a mesma receita, com o GRPO substituindo o PPO, trabalha no raciocínio.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 05 (DQN), Phase 9 · 08 (PPO), Phase 9 · 09 (RLHF), Phase 9 · 10 (MARL)
**Time:** ~120 minutes

## O problema

Os jogos têm tudo o que RL quer. recompensa limpa (ganho/perda). Episódios infinitos (auto- jogação reset). Simulação perfeita (o jogo *é* o simulador). Espaços de ação contínuos discretos ou pequenos. Estrutura multi-agente que força robustez adversária.

E os jogos são como cada grande avanço RL foi testado. TD-Gammon (backgammon, 1992). Atari-DQN (2013). AlphaGo (2016). AlphaZero (2017). OpenAI Five (Dota 2, 2019). AlphaStar (StarCraft II, 2019). MuZero (modelo aprendido, 2019). AlphaTensor (multiplicação de matriz, 2022). AlphaDev (algoritmos de classificação, 2023). DeepSeek-R1 (razão matemática, 2025)  a mais recente demonstração de que as técnicas de jogo-RL funcionam no texto.

Esta pedra angular analisa as três arquiteturas emblemáticas  AlphaZero, MuZero e GRPO  através de uma única lente unificadora: **self-play + search + policy improvement**Cada um generaliza o anterior; GRPO em particular é a receita do AlphaZero aplicada ao raciocínio LLM, com tokens como ações e verificação matemática como sinal de vitória.

## O conceito

![AlphaZero ↔ MuZero ↔ GRPO: same loop, different environments](../assets/rl-games.svg)

**The unifying loop.**

```
while True:
    trajectory = self_play(current_policy, search)     # play game against self
    policy_target = search.improved_policy(trajectory) # search improves raw policy
    policy_net.update(policy_target, value_target)     # supervised on search output
```

**AlphaZero (2017).**Silver et al. Dado um jogo (chaque, shogi, Go) com regras conhecidas:

- Rede de valor político: uma torre $f_\theta(s) \to (p, v)$- Não .$p$É um antecessor sobre movimentos legais.$v$é o resultado esperado do jogo.
- Monte Carlo Tree Search (MCTS): a cada movimento, expandir uma árvore de possíveis continuas.$(p, v)$como o anterior + bootstrap. Selecione nós por UCB (PUCT): $a^{\ast} = \arg\max_a Q(s, a) + c \cdot p(a \mid s) \cdot \sqrt{N(s)} / (1 + N(s, a))$- Não .
- Jogar jogos de agente contra agente.$t$, a distribuição das visitas do MCTS $\pi_t$torna-se o objectivo da formação política.
- Perda: $L = (v - z)^2 - \pi \cdot \log p + c \cdot \lVert \theta \rVert^2$- Não .$z$é o resultado do jogo (+1 / 0 / -1).

Zero conhecimento humano, zero heurísticas artesanais, uma única receita que dominava xadrez, shogi e go depois de algumas dezenas de milhões de jogos de auto-jogo.

**MuZero (2019).**Schrittwieser et al. Elimina o requisito de que as regras sejam conhecidas.

- Em vez de um ambiente fixo, aprenda um modelo de dinâmica latente.$(h, g, f)$- Não .
  - $h(s)$: codificar a observação em estado latente.
  - $g(s_{\text{latent}}, a)$: prever o próximo estado latente + recompensa.
  - $f(s_{\text{latent}})$: previsão de prioridade política + valor.
- O MCTS funciona no espaço latente aprendido.
- Funciona no Go, xadrez, shogi e Atari, um algoritmo, sem conhecimento de regras.

**Stochastic MuZero (2022).**Adiciona dinâmica estocástica e nós de sorte; se estende aos jogos de classe backgammon.

**Muesli, Gumbel MuZero (2022-2024).**Melhorias na eficiência da amostra e na procura determinista.

**GRPO (2024-2025).**A mesma faixa em forma de AlphaZero, aplicada ao raciocínio do modelo de linguagem:

- "Game": responder a um problema de matemática / codificação / raciocínio. "Win" = verificador (passagens de teste, correspondências numéricas de respostas) retorna 1.
- Política: o LLM. Ações: tokens. Estado: prompt + response-so far.
- Não há críticos (estilo PPO $V_\phi$Em vez disso, para cada pedido, amostra.$G$- A política de pagamento é de um valor de R$ 5 milhões.**group-relative advantage** $A_i = (r_i - \text{mean}_r) / \text{std}_r$como sinal para atualização no estilo REINFORCE.
- A política de referência de KL para evitar a deriva (como a RLHF).
- Perda total:

  $L_{\text{GRPO}}(\theta) = -\mathbb E_{q, \lbrace o_i \rbrace} \left[ \frac{1}{G} \sum_i A_i \cdot \log \pi_\theta(o_i \mid q) \right] + \beta \cdot \mathrm{KL}(\pi_\theta \Vert \pi_{\text{ref}})$

Não há modelo de recompensa aprendido, nenhum crítico, nenhum MCTS. Um verificador baseado em regras fornece a recompensa, a linha de base relativa ao grupo substitui o crítico e o passo de busca é retirado.

**The R1 recipe in full.**DeepSeek-R1 (DeepSeek 2025) é um dos dois modelos de um único documento:

- **R1-Zero.**Comece com o modelo base DeepSeek-V3. Não há SFT. Aplique GRPO diretamente com dois componentes de recompensa: * recompensa de precisão * (baseada em regras  fez a resposta final analisar o número correto / o código passou testes de unidade) e * recompensa de formato * (a conclusão envolveu sua cadeia de pensamento em `<think>…</think>`tags). Ao longo de milhares de passos, o comprimento médio da resposta aumenta de ~100 para ~10,000 tokens e as pontuações de referência matemática subem para níveis de pré-visualização próximos a o1. O modelo aprende a raciocinar a partir do zero. A desvantagem: suas cadeias de pensamento são muitas vezes ilegíveis, misturam línguas e não têm poluição estilística.
- **R1.**Corrigir os problemas de legibilidade do R1-Zero com um gasoduto de quatro etapas:
  1. **Cold-start SFT.**Coletar alguns milhares de demonstrações longas de CoT com formato limpo, supervisionar-finetunar o modelo base sobre eles.
  2. **Reasoning-oriented GRPO.**Aplicar o GRPO com as recompensas de precisão+formato mais uma recompensa de *consistência linguística* para evitar a troca de código.
  3. **Rejection sampling + SFT round 2.**Amostre ~ 600K trajetórias de raciocínio do ponto de controle RL, mantenha apenas aquelas com respostas finais corretas e CoT legível, e combine com ~ 200K exemplos de SFT não raciocínio (escritura, QA, auto-conhecimento).
  4. **Full-spectrum GRPO.**Mais uma rodada de RL que abrange o raciocínio (recompensas baseadas em regras) e o alinhamento geral (recompensas baseadas em preferências de utilidade/inharmonia).

O resultado corresponde ao o1 em AIME e MATH-500 em pesos abertos, e é pequeno o suficiente para destilar. O mesmo artigo também libera seis modelos densos destilados (Qwen-1.5B até Llama-70B) por SFT'ing em rastros de raciocínio de R1  nenhum RL no aluno.

**Why GRPO instead of PPO for reasoning.**Três razões no artigo DeepSeekMath (Feb 2024): (1) nenhuma rede de valor para treinar, reduzindo a memória pela metade; (2) a linha de base do grupo naturalmente lida com a recompensa de final de trajetória que as tarefas de raciocínio produzem; (3) a normalização por instante torna vantagens comparáveis em problemas de dificuldade muito diferentes, o que o único crítico do PPO não pode.

**Search-free vs search-based.**Os jogos se ramificaram:

- *Jogos de informação perfeita com horizontes longos* (Go, xadrez): ainda baseados em pesquisas.
- * Raciocínio LLM*: ainda não há MCTS em produção; GRPO em implantações completas, melhor de N para computação de inferência.

```figure
f3-selfplay-ladder
```

## Construí-lo

O código está em `code/main.py`Implementos **GRPO in miniature**O algoritmo é o mesmo que em um LLM; apenas a política e o ambiente são mais simples. Ensinam a * perda* e a * vantagem relativa ao grupo*, que é a inovação 2024 da DeepSeekMath.

### Passo 1: um ambiente de verificação pequeno

```python
QUESTIONS = [
    {"prompt": "q1", "correct": 3},
    {"prompt": "q2", "correct": 1},
]

def verify(prompt_idx, answer_token):
    return 1.0 if answer_token == QUESTIONS[prompt_idx]["correct"] else 0.0
```

No GRPO real, o verificador executa testes unitários ou verifica a igualdade matemática.

### Passo 2: política: softmax sobre K tokens de resposta por pedido

```python
def policy_probs(theta, p_idx):
    return softmax(theta[p_idx])
```

Equivalente à saída final de uma MLL condicionada a um pedido.

### Passo 3: amostragem de grupo e vantagem relativa ao grupo

```python
def grpo_step(theta, p_idx, G=8, beta=0.01, lr=0.1, rng=None):
    probs = policy_probs(theta, p_idx)
    samples = [sample(probs, rng) for _ in range(G)]
    rewards = [verify(p_idx, s) for s in samples]
    mean_r = sum(rewards) / G
    std_r = stddev(rewards) + 1e-8
    advs = [(r - mean_r) / std_r for r in rewards]

    for a, A in zip(samples, advs):
        grad = onehot(a) - probs
        for i in range(len(probs)):
            theta[p_idx][i] += lr * A * grad[i]
    # KL penalty: pull theta toward reference
    for i in range(len(probs)):
        theta[p_idx][i] -= beta * (theta[p_idx][i] - reference[p_idx][i])
```

A vantagem relativa ao grupo é o truque DeepSeek 2024. Não é necessário crítico. A "linha de base" é a média do grupo, e a normalização usa o grupo std.

### Passo 4: comparação com a linha de base de REINFORCE (sem valor)

A mesma configuração, o mesmo cálculo, simples reforço.

### Passo 5: observar a entropia e KL

Os mesmos diagnósticos que o RLHF: KL para referência, entropia política, recompensa-over-time.

## Encurralagens

- **Reward hacking via verifier gaming.**O GRPO herda o risco da RLHF: se o verificador for errado ou explorável, o MLL encontrará o explorador.
- **Group size too small.**A variação da linha de base média do grupo é a seguinte:$1/G$(o seu erro padrão como $1/\sqrt{G}$Abaixo .$G = 4$, o sinal de vantagem é barulhento; escolha padrão é $G = 8$- A 64.
- **Length bias.**Completos LLM de diferentes comprimentos têm diferentes log-probabilidades. Normalize por contagem de tokens, ou use log-prob de nível de sequência, ou truncate para a máxima comprimento.
- **Pure self-play cycles.**O treinamento no estilo AlphaZero pode ficar preso em loops de domínio em jogos de soma geral.
- **Search-policy mismatch.**O AlphaZero treina a política para imitar o resultado da pesquisa.
- **Compute floor.**MuZero / AlphaZero precisa de computação maciça. Uma única ablação costuma ser de centenas de horas de GPU. Existem demos em miniatura (por exemplo, AlphaZero no Connect Four) para aprendizagem.
- **Verifier coverage.**Os testes de unidade que aprovam uma solução de buggy reforçam o bug.

## Usá-lo

O cenário de jogo-RL de 2026, por domínio:

| Domain | Dominant method |
|--------|-----------------|
| Two-player zero-sum board games (Go, chess, shogi) | AlphaZero / MuZero / KataGo |
| Imperfect info card games (poker) | CFR + deep learning (DeepStack, Libratus, Pluribus) |
| Atari / pixel games | Muesli / MuZero / IMPALA-PPO |
| Large multiplayer strategy (Dota, StarCraft) | PPO + self-play + league (OpenAI Five, AlphaStar) |
| LLM math/code reasoning | GRPO (DeepSeek-R1, Qwen-RL, open replications) |
| LLM alignment | DPO / RLHF-PPO (not GRPO; verifier is preference not verifiable) |
| Robotics | PPO + DR (not game-RL, but uses same policy-gradient tools) |
| Combinatorial problems | AlphaZero variants (AlphaTensor, AlphaDev) |

A *receita*  auto-jogo, melhoria aumentada pela pesquisa, destilação de políticas  abrange texto, pixels e controle físico.

## Envia-o

Salva como`outputs/skill-game-rl-designer.md`- Não .

```markdown
---
name: game-rl-designer
description: Design a game-RL or reasoning-RL training pipeline (AlphaZero / MuZero / GRPO) for a given domain.
version: 1.0.0
phase: 9
lesson: 12
tags: [rl, alphazero, muzero, grpo, self-play]
---

Given a target (perfect-info game / imperfect-info / Atari / LLM reasoning / combinatorial), output:

1. Environment fit. Known rules? Markov? Stochastic? Multi-agent? Informs AlphaZero vs MuZero vs GRPO.
2. Search strategy. MCTS (PUCT with learned prior), Gumbel-sampled, best-of-N, or none.
3. Self-play plan. Symmetric self-play / league / offline data / verifier-generated.
4. Target signal. Game outcome / verifier reward / preference / learned model. Include robustness plan.
5. Diagnostics. Win rate vs baseline, ELO curve, verifier pass rate, KL to reference.

Refuse AlphaZero on imperfect-info games (route to CFR). Refuse GRPO without a trusted verifier. Refuse any game-RL pipeline without a fixed baseline opponent set (self-play ELO is uncalibrated otherwise).
```

## Exercícios

1. **Easy.**Implementar o bandido do GRPO em `code/main.py`. Treinar em 2 instruções × 4 tokens de resposta cada. Convergir em < 1.000 atualizações com $G=8$- Não .
2. **Medium.**Compare a eficiência da amostra e a variação da recompensa com a GRPO no mesmo bandido.
3. **Hard.**Estender para uma "cadeia de raciocínio" de comprimento-2: o agente emite dois tokens e o verificador recompensa o par. Medir como o GRPO lida com a atribuição de crédito em duas sequências de passos. (Punta: vantagem do grupo de cálculo por *sequência completa*, propagar para ambas as posições de tokens.)

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| MCTS | "Tree search with learned net" | Monte Carlo Tree Search; UCB1/PUCT selection with learned $(p, v)$ priors. |
| AlphaZero | "Self-play + MCTS" | Policy-value net trained to match MCTS visits and game outcome. |
| MuZero | "Learned-model AlphaZero" | Same loop but in latent space via learned dynamics. |
| GRPO | "Critic-free PPO" | Group Relative Policy Optimization; REINFORCE with group-mean baseline + KL. |
| PUCT | "AlphaZero's UCB" | $Q + c \cdot p \cdot \sqrt{N} / (1 + N_a)$ — balances value estimate with prior. |
| Self-play | "Agent vs past self" | Standard for zero-sum; symmetric training signal. |
| League play | "Population-based self-play" | Past + current + exploiters sampled as opponents. |
| Verifier reward | "Verifiable RL" | Reward comes from a deterministic checker (tests pass, answer matches). |
| Process reward | "PRM" | Scores each reasoning step, not just the final answer. |

## Mais leitura

- [Silver et al. (2017). Mastering the game of Go without human knowledge (AlphaGo Zero)](https://www.nature.com/articles/nature24270)- Não .
- [Silver et al. (2018). A general reinforcement learning algorithm that masters chess, shogi, and Go through self-play (AlphaZero)](https://www.science.org/doi/10.1126/science.aar6404)- Não .
- [Schrittwieser et al. (2020). Mastering Atari, Go, chess and shogi by planning with a learned model (MuZero)](https://www.nature.com/articles/s41586-020-03051-4)- Não .
- [Vinyals et al. (2019). Grandmaster level in StarCraft II (AlphaStar)](https://www.nature.com/articles/s41586-019-1724-z)- Não .
- [DeepSeek-AI (2024). DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models (GRPO)](https://arxiv.org/abs/2402.03300) o artigo que introduziu o GRPO e a linha de base relativa ao grupo.
- [DeepSeek-AI (2025). DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning](https://arxiv.org/abs/2501.12948) a receita completa de quatro etapas R1 mais a ablação R1-Zero.
- [Brown et al. (2019). Superhuman AI for multiplayer poker (Pluribus)](https://www.science.org/doi/10.1126/science.aay2400) CFR + aprendizagem profunda em escala.
- [Tesauro (1995). Temporal Difference Learning and TD-Gammon](https://dl.acm.org/doi/10.1145/203330.203343)O jornal que começou tudo.
- [Hugging Face TRL — GRPOTrainer](https://huggingface.co/docs/trl/main/en/grpo_trainer) a referência de produção para a aplicação de GRPO com funções de recompensa personalizadas.
- [Qwen Team (2024). Qwen2.5-Math — GRPO replication](https://github.com/QwenLM/Qwen2.5-Math) replicação aberta da receita R1 em múltiplas escalas.
- [Sutton & Barto (2018). Ch. 17 — Frontiers of Reinforcement Learning](http://incompleteideas.net/book/RLbook2020.pdf) o enquadramento do livro de texto para o auto-joco, a pesquisa e a "recompensa concebida" que R1 representa na escala de LLM.
