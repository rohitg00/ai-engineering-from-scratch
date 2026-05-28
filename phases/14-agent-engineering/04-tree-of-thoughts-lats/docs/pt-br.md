# Tree of Thoughts e LATS: Busca Deliberada

> Uma trajectory única de chain-of-thought não tem espaço pra voltar atrás. ToT (Yao et al., 2023) transforma raciocínio numa árvore com auto-avaliação em cada nó. LATS (Zhou et al., 2024) unifica ToT com ReAct e Reflexion sob Monte Carlo Tree Search. Game of 24 vai de 4% (CoT) pra 74% (ToT); LATS atinge 92.7% pass@1 no HumanEval.

**Tipo:** Construção
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 14 · 01 (Agent Loop), Fase 14 · 03 (Reflexion)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Enquadrar raciocínio como busca: nós são "pensamentos", arestas são "expansões", valor é "quão promissor".
- Implementar uma busca em árvore BFS estilo ToT com stdlib e pontuação de auto-avaliação.
- Estender pra um loop LATS MCTS de exemplo com select / expand / simulate / backpropagate.
- Decidir quando busca vale o multiplicador de tokens (Game of 24, geração de código) e quando uma trajectory única é suficiente (pergunta simples e resposta).

## O Problemo

Chain-of-thought é um caminho linear. Se a primeira etapa é errada, toda etapa subsequente trabalha numa premissa ruim. No Game of 24 (usar quatro dígitos com + − × ÷ pra fazer 24), GPT-4 CoT atinge 4% de acurácia. O modelo escolhe a sub-expressão errada cedo e não consegue se recuperar.

O que raciocínio precisa é a capacidade de propor múltiplos candidatos, avaliá-los, escolher os promissores e voltar atrás quando becos sem saída aparecem. Isso é busca. Tree of Thoughts e LATS são as duas formulações canônicas.

## O Conceito

### Tree of Thoughts (Yao et al., NeurIPS 2023)

Cada nó é um passo intermediário coerente ("um pensamento"). Cada nó pode expandir pra K pensamentos filhos. O LLM auto-avalia cada nó com um prompt de pontuação. Busca explora a árvore — BFS, DFS ou beam.

```
                     (root: "find 24 from 4 6 4 1")
                    /               |            \
           ("6 - 4 = 2")    ("4 + 1 = 5")    ("4 * 6 = 24")  <- Score: HIGH
              /   \              |                  |
          ...    ...          ...                finish
```

Auto-avaliação é a peça que aguenta o peso. O paper mostra três variantes: classificação `sure / likely / impossible`, pontuação numérica `1..10` e voto entre candidatos. As três superam CoT substancialmente no Game of 24 (4% -> 74% com GPT-4).

### LATS (Zhou et al., ICML 2024)

LATS unifica ToT, ReAct e Reflexion sob MCTS. O LLM joga três papéis:

- **Política**: propõe candidatos de próximas ações (estilo ReAct).
- **Função valor**: pontua uma trajectory parcial (auto-avaliação estilo ToT).
- **Auto-reflexor**: em falha, escreve uma reflexão em linguagem natural (estilo Reflexion) e usa pra ressemear futuras rollouts.

Feedback do ambiente (observações) se mistura na função valor pra que a busca seja informada por resultados reais de ferramentas, não só opiniões do modelo. Resultados na época do paper: HumanEval pass@1 92.7% com GPT-4 (SOTA), WebShop médio 75.9 com GPT-3.5 (se aproximando de fine-tuning baseado em gradiente).

### MCTS, minimamente

Quatro fases por iteração:

1. **Select** — caminhar da raiz até uma folha usando UCT (upper confidence bound pra árvores).
2. **Expand** — gerar K filhos via política.
3. **Simulate** — rollout a partir de um filho usando política, pontuar a folha com a função valor (ou recompensa do ambiente).
4. **Backpropagate** — atualizar contagens de visita e estimativas de valor ao longo do caminho.

Fórmula UCT: `Q(s, a) + c * sqrt(ln N(s) / N(s, a))`. Primeiro termo é exploração; segundo é exploração. Ajuste `c` por tarefa.

### A realidade do custo

Busca explode tokens. ToT no Game of 24 usa 100–1000x os tokens de CoT. LATS é parecido. Isso não é grátis; reserve busca pra:

- Tarefas onde uma trajectory única é demonstravelmente insuficiente (Game of 24, código complexo).
- Tarefas onde tempo de relógio é menos importante que correção.
- Tarefas com uma função valor barata e confiável (testes unitários pra código, alvo explícito pra matemática).

Se sua tarefa tem uma resposta certa e um avaliador barulhento, busca frequentemente piora as coisas — ela encontra uma resposta errada "com boa pontuação".

### Posicionamento em 2026

A maioria dos agents de produção não roda LATS. Eles rodam ReAct com verificação ancorada em ferramenta (CRITIC, Aula 05). Busca aparece em nichos especializados:

- Agents de código que rodam testes como função valor (estilo HumanEval).
- Agents de pesquisa profunda que exploram múltiplos caminhos de query.
- Workflows pesados em planejamento dentro de subgrafos do LangGraph.

AlphaEvolve (Aula 11) é o extremo de 2025: busca evolutiva sobre código, fitness verificável por máquina, ganhos frontier (primeira melhoria em matmul 4x4 em 56 anos).

## Construa

`code/main.py` implementa:

- Uma mini BFS ToT numa tarefa estilizada "escolher operações aritméticas".
- Um loop LATS MCTS de exemplo na mesma tarefa (Select / Expand / Simulate / Backpropagate) com seleção UCT.
- Uma função valor que compõe uma pontuação simbólica com uma pontuação de auto-avaliação.

Rode:

```
python3 code/main.py
```

O trace mostra ToT expandindo três candidatos por nó com BFS, comparado com LATS convergindo na melhor rollout via MCTS. Contagens de tokens impressas pra ambos.

## Use

LangGraph entrega exploração estilo ToT como padrões de subgrafo; o post da equipe do LangChain sobre LATS (Maio 2024) é o tutorial de referência. LlamaIndex entrega um agent `TreeOfThoughts`. Pra maioria dos agents de produção de 2026 esse padrão fica atrás de um gate `if task_complexity > threshold: use_search()` — veja o padrão evaluator-optimizer na Aula 05.

## Entregue

`outputs/skill-search-policy.md` escolhe entre ReAct linear, ToT, LATS e busca evolutiva dada a forma da tarefa, orçamento e fidelidade do avaliador.

## Exercícios

1. Rode o LATS de exemplo com UCT c=0.1 vs c=2.0. O que muda no trace?
2. Troque a função valor por uma pontuação mais barulhenta (adicione jitter aleatório). MCTS ainda encontra a melhor folha? Qual é o mínimo de sinal/barulho que ele tolera?
3. Implemente busca ToT em beam (mantenha top-k em cada nível) e compare com BFS. Qual é melhor com orçamento apertado de tokens?
4. Leia Seção 5.1 do LATS. Reproduza a contagem de trajectories do HumanEval: quantas rollouts são necessárias pra atingir o pass@1 reportado?
5. Leia a discussão do paper do LATS sobre "quando LATS ajuda menos". Escreva uma regra de decisão de um parágrafo mapeando forma da tarefa pra estratégia de busca.

## Termos-Chave

| Termo | O que a galera fala | O que realmente significa |
|-------|---------------------|---------------------------|
| Tree of Thoughts | "CoT ramificado" | Yao et al. — árvore de nós de pensamento com auto-avaliação |
| LATS | "MCTS pra LLMs" | Zhou et al. — unifica ToT + ReAct + Reflexion sob MCTS |
| UCT | "Upper confidence bound" | Fórmula de seleção equilibrando exploração (Q) e exploração (ln N / n) |
| Value function | "Quão bom é esse estado" | Pontuação de LLM via prompt ou recompensa do ambiente; alimenta backprop |
| Policy | "Propositor de ação" | Gerador estilo ReAct; emite candidatos de próximos pensamentos/ações |
| Rollout | "Trajectory simulada" | Caminhar de um nó até uma folha usando política, pontuar com valor |
| Backpropagate | "Atualizar ancestrais" | Empurrar a recompensa da folha pro caminho, atualizando contagens de visita e Q |
| Search cost | "Explosão de tokens" | 100-1000x CoT no Game de 24; orce antes de adotar |

## Leitura Complementar

- [Yao et al., Tree of Thoughts (arXiv:2305.10601)](https://arxiv.org/abs/2305.10601) — o paper canônico
- [Zhou et al., LATS (arXiv:2310.04406)](https://arxiv.org/abs/2310.04406) — MCTS com feedback de Reflexion
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) — padrões de subgrafo pra busca
- [AlphaEvolve (arXiv:2506.13131)](https://arxiv.org/abs/2506.13131) — busca evolutiva com avaliadores programáticos
