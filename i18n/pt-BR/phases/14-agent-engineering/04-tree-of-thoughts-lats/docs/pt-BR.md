# Árvore de Pensamentos e LATS: Busca deliberada

> Uma única trajetória de cadeia de pensamento não tem espaço para retroceder. ToT (Yao et al., 2023) transforma o raciocínio em uma árvore com auto-avaliação em cada nó. LATS (Zhou et al., 2024) unifica ToT com ReAct e Reflexion sob a Pesquisa de Árvore de Monte Carlo.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 03 (Reflexion)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Raciocínio de quadro como pesquisa: nós são "pensamentos", bordas são "expansions", valor é "quão promissor".
- Implementar uma pesquisa de árvore BFS no estilo stdlib ToT com pontuação de autoavaliação.
- Estender para um circuito LATS MCTS de brinquedo com selecção / expansão / simulação / retropropagação.
- Decida quando a pesquisa vale o multiplicador de tokens (Game of 24, geração de código) e quando uma única trajetória é suficiente (questionamento e resposta simples).

## O problema

A cadeia de pensamento é uma caminhada linear. Se o primeiro passo for errado, cada passo subsequente funciona com uma premissa ruim. No jogo de 24 (use quatro dígitos com + − × ÷ para fazer 24), o GPT-4 CoT atinge uma precisão de 4%. O modelo escolhe a subexpressão errada cedo e não pode recuperar.

O que o raciocínio precisa é da capacidade de propor vários candidatos, avaliá-los, escolher os promissores e recuar quando surgem terminações estancadas.

## O conceito

### Árvore dos Pensamentos (Yao et al., NeurIPS 2023)

Cada nó é um passo intermediário coerente ("um pensamento"). Cada nó pode se expandir para pensamentos de K. O LLM auto-avalia cada nó com um prompt de pontuação.

```
                     (root: "find 24 from 4 6 4 1")
                    /               |            \
           ("6 - 4 = 2")    ("4 + 1 = 5")    ("4 * 6 = 24")  <- Score: HIGH
              /   \              |                  |
          ...    ...          ...                finish
```

A autoavaliação é a peça de carga.`sure / likely / impossible`classificação, `1..10`Os três venceram a CoT substancialmente no jogo de 24 (4% -> 74% com GPT-4).

### LATS (Zhou et al., ICML 2024)

O LATS unifica ToT, ReAct e Reflexion sob o MCTS.

- **Policy**: propõe candidato a próximas acções (estilo ReAct).
- **Value function**: pontuação de uma trajetória parcial (auto-evaluação ao estilo ToT).
- **Self-reflector**No caso de falhas, escreva uma reflexão em linguagem natural (estilo de reflexão) e usa-a para reanalisar futuras implementações.

Os resultados em tempo de papel: HumanEval pass@1 92,7% com GPT-4 (SOTA), WebShop média de 75.9 com GPT-3.5 (aproximando-se de ajuste fino baseado em gradiente).

### MCTS, mínimo

Quatro fases por iteração:

1. **Select** caminhar de raiz a folha utilizando UCT (confiança superior ligada às árvores).
2. **Expand** gerar filhos K através da política.
3. **Simulate** lançamento de uma criança usando a política, pontuação da folha com a função de valor (ou recompensa ambiental).
4. **Backpropagate** actualizar os números de visitas e as estimativas de valor do caminho.

Formulha da TCC: `Q(s, a) + c * sqrt(ln N(s) / N(s, a))`O primeiro termo é exploração, o segundo exploração.`c`por tarefa.

### A realidade dos custos

A pesquisa explode tokens. ToT em Game of 24 usa 1001000x os tokens de CoT. LATS é semelhante.

- Tarefas em que uma única trajetória é demonstravelmente insuficiente (Game of 24, código complexo).
- Tarefas onde o relógio de parede é menos importante do que a corretão.
- Tarefas com uma função de valor barata e confiável (testes unitários para código, alvo explícito para matemática).

Se a sua tarefa tem uma única resposta correta e um avaliador barulhento, a pesquisa muitas vezes piora as coisas  encontra uma resposta errada "bom pontuação".

### 2026 posicionamento

A maioria dos agentes de produção não executa LATS. Eles executam ReAct com verificação baseada em ferramentas (CRITIC, lição 05).

- Agentes de codificação que executam testes como função de valor (estilo HumanEval).
- Agentes de pesquisa profunda que exploram vários caminhos de consulta.
- Fluxos de trabalho pesados de planejamento dentro dos subgrafos de LangGraph.

AlphaEvolve (Lessão 11) é o extremo de 2025: busca evolutiva sobre código, aptidão verificável por máquina, ganhos de fronteira (primeira melhoria de matmul 4x4 em 56 anos).

```figure
tree-of-thoughts
```

## Construí-lo

`code/main.py`Implementos:

- Um pequeno ToT BFS numa tarefa estilizada "pick arithmetic ops".
- Um brinquedo LATS MCTS loop na mesma tarefa (Select / Expand / Simulate / Backpropagate) com seleção UCT.
- Uma função de valor que compõe uma pontuação simbólica mais uma pontuação auto-equa.

- É o que é ?

```
python3 code/main.py
npx tsx code/main.ts
```

O rastro mostra o ToT expandindo três candidatos por nó com BFS, em comparação com o LATS convergindo no melhor lançamento através do MCTS.

## Usá-lo

LangGraph envia exploração de estilo ToT como padrões de subgrafos; o blog da equipe LangChain no LATS (maio de 2024) é o tutorial de referência.`TreeOfThoughts`Para a maioria dos agentes de produção de 2026 este padrão vive por trás de um`if task_complexity > threshold: use_search()`gate  ver o padrão de avaliador-optimizador na lição 05.

## Envia-o

`outputs/skill-search-policy.md`seleciona entre ReAct linear, ToT, LATS e pesquisa evolutiva dada forma da tarefa, orçamento e fidelidade do avaliador.

## Exercícios

1. Execute o LATS com UCT c=0.1 vs c=2.0.
2. A função de valor é substituída por um marcador mais ruidoso (aditar um jitter aleatório).
3. Implementar o ToT de busca de feixe (manter o top-k em cada nível) e comparar com o BFS. Qual é melhor com um orçamento de token apertado?
4. Leia a secção 5.1. Reproduzir a contagem de trajetória HumanEval: quantas lançamentos é necessário para atingir o pass@1 relatado?
5. Leia a discussão do artigo LATS sobre "quando o LATS ajuda menos". Escreva uma regra de decisão de um parágrafo mapeando a forma da tarefa para a estratégia de pesquisa.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Tree of Thoughts | "Branching CoT" | Yao et al. — tree of thought nodes with self-evaluation |
| LATS | "MCTS for LLMs" | Zhou et al. — unifies ToT + ReAct + Reflexion under MCTS |
| UCT | "Upper confidence bound" | Select formula balancing exploitation (Q) and exploration (ln N / n) |
| Value function | "How good is this state" | Prompted LLM score or environment reward; feeds backprop |
| Policy | "Action proposer" | ReAct-style generator; emits candidate next thoughts/actions |
| Rollout | "Simulated trajectory" | Walk from a node to a leaf using policy, score with value |
| Backpropagate | "Update ancestors" | Push the leaf's reward up the path, updating visit counts and Q |
| Search cost | "Token explosion" | 100-1000x CoT on Game of 24; budget before you adopt |

## Mais leitura

- [Yao et al., Tree of Thoughts (arXiv:2305.10601)](https://arxiv.org/abs/2305.10601) o papel canônico
- [Zhou et al., LATS (arXiv:2310.04406)](https://arxiv.org/abs/2310.04406) MCTS com feedback Reflexão
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) Padrões de subgráficos para pesquisa
- [AlphaEvolve (arXiv:2506.13131)](https://arxiv.org/abs/2506.13131) Pesquisa evolutiva com avaliadores programáticos
