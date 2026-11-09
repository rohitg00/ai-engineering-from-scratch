# Capstone 05  Agente de Pesquisa Autônoma (Classe Cientista de IA)

> O Sakana's AI-Scientist-v2 publicou artigos completos. O Laboratório de Agentes realizou os experimentos. Allen AI compartilhou vestígios. A forma 2026 é planejar-executar-verificar a pesquisa de árvores sobre experimentos, custo orçado, execução de código sandboxed, um escritor de feedback LaTeX de visão e um conjunto de revisores automatizado de estilo NeurIPS. A pedra angular é construir uma, executá-la de ponta a ponta dentro de US$ 30 por papel, e sobreviver à equipa vermelha que Sakana documentou.

**Type:** Capstone
**Languages:** Python (agent + sandbox), TypeScript, LaTeX (output)
**Prerequisites:** Phase 2 (ML), Phase 3 (deep learning), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 14 (agents), Phase 15 (autonomous), Phase 16 (multi-agent), Phase 18 (safety)
**Phases exercised:**P0 · P2 · P3 · P7 · P10 · P14 · P15 · P16 · P18
**Time:** 40 hours

## Problemas

Os agentes de investigação autônomos ultrapassaram um limiar em 2026. O AI-Scientist-v2 de Sakana AI foi publicado na Nature com artigos gerados que autorizaram a revisão entre pares de oficina. ShinkaEvolve (ICLR 2026) estendeu a linha para hipóteses em evolução. O Laboratório de Agentes da AMD enviou vestígios reprodutíveis. Os agentes não são mágicos, são um ciclo de planejamento-execução-verificação que corre sobre uma árvore de experimentos candidatos, com limites de custo, caixas de areia ligadas a sementes e revisão automática. A nave está no circuito, o orçamento e a história da segurança.

Você aprende o ciclo implementando um contra uma ideia de semente em um domínio estreito (por exemplo, ablações de atenção-sparsidade em um transformador de parâmetro de 100M). O valor não está em descobrir algo novo na primeira corrida. O valor está na infraestrutura: a pesquisa em árvores, a caixa de areia de experimento, o ciclo de escritor-revisor, o relatório da equipa vermelha. A equipa Sakana documentou falhas de fuga da caixa de areia. O seu agente deve passar pela mesma equipa vermelha.

## Conceptos

O agente é um primeiro buscador de árvores. Os nós são especificações do experimento: (hipótese, configuração, código, resultado esperado). Um passo de expansão propõe às crianças pequenas edições (optimizador de troca, tamanho de lote de troca, ablate um componente). Cada criança corre numa caixa de areia fresca com um fechamento de recursos. Os resultados são transmitidos em uma função de pontuação que classifica os nós por (novidade × qualidade × orçamento restante). A árvore cresce até o orçamento ser esgotado, então o melhor ramo é escrito.

O escritor é multimodal. Ele gera um esboço LaTeX, compilou, rende números e alimenta o PDF renderizado de volta ao modo de visão do Claude Opus 4.7 para crítica no layout, legibilidade de figuras e alinhamento de reivindicações-evidência. Um conjunto de revisores de cinco juízes de LLM emite pontuações no estilo NeurIPS (novidade, rigor, clareza, reproducibilidade, impacto); se a média cair abaixo do limiar, o artigo retorna ao escritor com crítica.

A segurança é suportável. Cada experimento é executado em uma caixa de areia E2B ou Daytona sem saída de rede, relógio de parede limitado e limites de recursos fixados. O passo de geração de código do agente passa por uma camada de política que bloqueia os sistemas que escapam da caixa de areia. O relatório da equipe vermelha reproduz a superfície de ataque documentada Sakana (bombas de garfo, escapes do sistema de arquivos, chamadas de rede escritas em LLM).

## Arquitetura

```
seed idea + domain
      |
      v
  literature search (Semantic Scholar + OpenAlex + FAISS cache)
      |
      v
  LangGraph plan-execute-verify tree
      |
      v
  +--- expand node ----+      per-node sandbox
  |                    |      (E2B / Daytona)
  v                    v      resource caps
  child_1           child_k   no network egress
  |                    |      deterministic seeds
  v                    v
  run experiment       run experiment
  |                    |
  v                    v
  score nodes by (novelty, quality, budget)
      |
      v
  best branch -> LaTeX writer
      |
      v
  compile + vision critique (Opus 4.7 vision)
      |
      v
  reviewer ensemble (5 LLM judges, NeurIPS rubric)
      |
      v
  paper.pdf + review.md + trace.json
```

## Estaca

- Orquestração: LangGraph com pontos de controlo e portas de aprovação humana
- Busca em árvores: melhor primeiro personalizado sobre nós de experimento (estilo AB-MCTS de Sakana v2)
- Sandbox: E2B por experimento, Docker-in-Docker fallback; limites de recursos através de cgroups
- Literatura: API de gráfico de estudiosos semânticos + OpenAlex + cache local de resumos FAISS
- Escritor: modelo LaTeX + Claude Opus 4.7 (modo de visão) para crítica e layout de figuras
- Revista: conjunto de 5 juízes (Opus 4.7, GPT-5.4, Gemini 3 Pro, DeepSeek R1, Qwen3-Max) com agregação ponderada
- Quadro de experimentação: PyTorch 2.5 para os experimentos físicos, W&B para a madeira
- Observabilidade: Langfuse para rastrear agentes, orçamento duro de $30 por papel

```figure
ce-experiment-tree
```

## Construí-lo

1. **Seed and domain scoping.**Tomar uma ideia de semente (por exemplo, "investigar padrões de esparcidade em mapas de atenção de transformadores sub-1B"). Defina o espaço de pesquisa: modelos, conjuntos de dados, orçamento computacional.

2. **Literature pass.**Pergunte a Scholar Semantic + OpenAlex para 50 artigos relevantes mais citados; resumos de cache localmente; gerar um digest de domínio de 1 página.

3. **Tree scaffolding.**Inicialize a raiz com a hipótese da semente.`expand(node) -> children`Com propostas de pequena edição (uma alteração de configuração por filho).`score(node)`como novidade ponderada × qualidade × prazo orçamental.

4. **Sandbox wrapping.**Cada experimento é executado .`docker run --network=none --memory=8g --cpus=2 --pids-limit=256 --read-only`As sementes são escritas na caixa de areia; as saídas são montadas para leitura apenas para trás.

5. **Plan-execute-verify loop.** `plan`Propõe filhos.`execute`- É o que eu faço.`verify`Os nodos falhados recebem uma razão de falha armazenada na árvore.

6. **Writer.**Após o orçamento, selecione o melhor ramo. Render figuras com matplotlib. Gerar um rascunho de LaTeX através de Claude Opus 4.7 com o rastro do ramo no contexto. Compile. Feed o PDF compilado de volta para Opus 4.7 visão para crítica. Iterar.

7. **Reviewer ensemble.**Cinco juízes pontua o esboço em (novidade, rigor, clareza, reproducibilidade, impacto) com rubricas no estilo NeurIPS. Se média <4,0/5, retorne ao escritor com crítica. parada dura após 3 reescrituras.

8. **Red team.**Construir ou integrar um conjunto de tarefas adversárias direcionadas à caixa de areia: bombas de garfo, tentativas de exfiltração de rede, escapas do sistema de arquivos, metacarácteres de conchas escritas em LLM. Confirmar todos os bloqueados. Escrever as descobertas.

9. **Reproducibility.**Cada papel navega com seu rastreamento de árvore JSON, sementes, links de execução W & B, configurações de caixa de areia e um README que o reproduz de ponta a ponta.

## Usá-lo

```
$ ai-scientist run --seed "attention sparsity in sub-1B transformers" --budget 30
[lit]    50 papers, digest in 12s
[tree]   expanded 8 nodes, budget 12/30
[exec]   node #3 sparsity=top-8, loss=2.83 (best so far)
[exec]   node #6 sparsity=top-4, loss=3.12 (worse)
[exec]   ...
[tree]   chose branch rooted at node #3 (novelty 0.62, quality 0.81)
[write]  LaTeX draft v1 complete
[vision] critique: figure 2 legend too small, claim-evidence ok
[write]  draft v2 after 3 edits
[review] mean 4.2/5 (novelty 3.9, rigor 4.3, clarity 4.1, repro 4.5, impact 4.2)
[done]   paper.pdf + review.md + trace.json     $28.40 spent
```

## Envia-o

`outputs/skill-ai-scientist.md`Dado uma ideia de semente + um domínio + um orçamento de $ 30, ele executa todo o pipeline e emite um papel revisível mais um pacote de reprodução.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Paper quality | Blind rubric review against published workshop papers |
| 20 | Experimental rigor | Baselines, seeds, ablations; every claim backed by a cell in the results table |
| 20 | Cost and compute discipline | $30/paper ceiling enforced, Langfuse-traced |
| 20 | Safety | Sandbox red team passes; network policy and kill-switch verified |
| 15 | Reproducibility | One-command rerun with identical seeds reproduces the paper |
| **100** | | |

## Exercícios

1. Compare quais partes da pesquisa de árvores se sobrepõem, identifique o cálculo desperdiçado duplicado.

2. Adicione um portal humano antes da execução do experimento para nós estimados acima de US$ 5.

3. Troca o grupo de revisores por um único juiz, e mede a taxa de falsos aceites num conjunto de papéis conhecidos e maus.

4. Introduza um teste de rede de exfiltração da equipe vermelha: o agente escreve código que tenta `curl`- Um endereço externo.`--network=none`A política bloqueia-o.

5. Comparar a sua pesquisa em árvores com uma linha de base aleatória plana (o mesmo orçamento, sem estratégia de expansão).

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Tree search | "AB-MCTS-style expansion" | Best-first exploration over experiment nodes with a novelty×quality×budget score |
| Sandbox | "Experiment isolation" | Container with no network, bounded CPU/memory, pinned seeds, read-only inputs |
| Vision critique | "Render-then-read" | Compile the paper to PDF, feed the PDF back to a VLM for layout and claim-evidence critique |
| Reviewer ensemble | "Automated peer review" | Multiple LLM judges scoring the paper with a NeurIPS rubric; weighted aggregate gates the pipeline |
| Novelty score | "Is this new?" | Heuristic that penalizes proximity to the 50-paper literature cache |
| Cost ceiling | "$ budget" | Hard cap on total spend per paper; Langfuse counters + pre-run estimates |
| Red team | "Sandbox-escape audit" | Adversarial tasks that would escape the sandbox if the policy is wrong |

## Mais leitura

- [Sakana AI-Scientist-v2 repository](https://github.com/SakanaAI/AI-Scientist-v2) o agente de investigação de produção de referência
- [Sakana AI-Scientist-v1 paper (arXiv:2408.06292)](https://arxiv.org/abs/2408.06292) a metodologia original
- [ShinkaEvolve (Sakana ICLR 2026)](https://sakana.ai) Extensão evolutiva
- [Agent Laboratory (AMD)](https://github.com/SamuelSchmidgall/AgentLaboratory) Estrutura de laboratório de investigação multifunção
- [LangGraph documentation](https://langchain-ai.github.io/langgraph/) camada de orquestração de referência
- [Semantic Scholar Graph API](https://api.semanticscholar.org/) Busca de literatura
- [E2B sandboxes](https://e2b.dev) Isolamento de experiências de referência
- [NeurIPS reviewer guidelines](https://neurips.cc/Conferences/2026/ReviewerGuidelines) a rubrica codificada pelo grupo de revisores
