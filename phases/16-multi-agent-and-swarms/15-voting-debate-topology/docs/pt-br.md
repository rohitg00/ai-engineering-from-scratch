# Voto, Auto-consistência e Topologia de Debate

> A agregação mais barata: amostra N agentes independentes, vote majoritariamente. A auto-consistência de Wang et al. 2022 fazia isso com um modelo único amostrado N vezes. Multi-agent estende com agentes **heterogêneos** pra escapar da monocultura — modelos diferentes, prompts diferentes, temperaturas diferentes, contextos diferentes. Além do voto majoritário, a topologia de debate importa: MultiAgentBench (arXiv:2503.01935, ACL 2025) avaliou coordenação em estrela / cadeia / árvore / grafo e encontrou **grafo melhor pra pesquisa**, com um "imposto de coordenação" passando de ~4 agents. AgentVerse (ICLR 2024) documenta dois padrões emergentes — comportamentos voluntários e comportamentos de conformidade — e conformidade é tanto uma funcionalidade (achar consenso) quanto um risco (groupthink, Lição 24). Esta lição mapeia o espaço de topologias, constrói cada variante, e mede o imposto de coordenação.

**Tipo:** Aprender + Construir
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 16 · 07 (Society of Mind and Debate), Fase 16 · 14 (Consensus and BFT)
**Tempo:** ~75 minutos

## Problema

Debate pode melhorar acurácia (Du et al., arXiv:2305.14325). Também pode degradá-la. Se debate ajuda depende de quatro escolhas estruturais:

1. Quem fala com quem (topologia).
2. Quantas rodadas (Du 2023: tanto rodadas quanto agentes importam independentemente).
3. Se os agentes são heterogêneos (modelos base diferentes quebram monocultura).
4. Se há uma voz adversarial (steel-manning vs straw-manning).

Times que colam "roda 5 agentes e vote" numa tarefa frequentemente regredem vs um agente individual. As falhas não são aleatórias. Elas seguem topologia e heterogeneidade. Esta lição é o mapa de topologias.

## Conceito

### Auto-consistência, o baseline de modelo único

Wang et al. 2022 ("Self-Consistency Improves Chain of Thought Reasoning") amostraram o mesmo modelo N vezes em temperatura > 0 e votaram majoritariamente nas respostas de raciocínio. O resultado no GSM8K: ganhos substanciais com N=40 amostras vs um greedy decode único. Auto-consistência é o precursor single-agent do voto multi-agent.

Limite: auto-consistência usa um base model. Erros são correlacionados por construção. Se o modelo tem um viés sistemático, todas as N amostras compartilham.

### Voto multi-agent, a extensão heterogênea

Substitua N amostras por N agentes *diferentes*. Modelos base diferentes (Claude, GPT, Llama), prompts diferentes, acesso a ferramentas diferentes. O benefício: erros não correlacionados. O custo: agentes diferentes custam valores diferentes; coordenar-los adiciona overhead.

O nome canônico de 2026 pra debate heterogêneo é **A-HMAD** — Adversarial Heterogeneous Multi-Agent Debate. Não universalmente adotado, mas papers usam o termo pra "modelos diferentes debatem, o que reduz erros correlacionados da colapso de monocultura."

### As quatro topologias

```
star                chain               tree                graph

    ┌─A─┐           A─B─C─D         ┌──A──┐              A───B
    │   │                           │     │              │ × │
    B   C                           B     C              D───C
    │   │                          / \   / \
    D   E                         D   E F   G           (fully connected)
```

Estrela: um hub, todos os outros falam só com o hub. Equivalente a supervisor-worker sem canal de retorno.

Cadeia: linear, cada agente vê a saída do anterior. Tipo pipeline.

Árvore: hierárquica, usada por sistemas de agentes hierárquicos (Lição 06).

Grafo: qualquer-para-qualquer. Inclui clique totalmente conectado e DAGs arbitrários.

### O imposto de coordenação (MultiAgentBench)

MultiAgentBench (MARBLE, ACL 2025, arXiv:2503.01935) fez benchmark de estrela, cadeia, árvore, grafo em um conjunto de tarefas incluindo pesquisa, código e planejamento. Resultados medidos:

- Topologia **grafo** vence em tarefas de pesquisa. Informação flui qualquer-para-qualquer; agentes podem criticar uns aos outros.
- **Estrela** vence em tarefas factuais de resposta rápida. Hub filtra e consolida.
- **Cadeia** vence em pipelines passo-a-passo (refinamento escalonado).
- **Imposto de coordenação** aparece passando de ~4 agentes na topologia grafo. Custo de relógio e token cresce mais rápido que qualidade.

O teto de 4 agentes é empírico, não fundamental. Reflete a capacidade de contexto de LLMs em 2026: o contexto de cada agente se enche com as saídas dos peers, e o valor marginal de adicionar o agente N+1 cai quando todo mundo já vê todo mundo.

### Estratégias de Debate Multi-Agent ("Should we be going MAD?")

arXiv:2311.17371 é o survey de 2023 de estratégias MAD. Achado chave replicado por outros: variantes MAD que são *estruturalmente similares* à auto-consistência (amostragem independente + agregação) frequentemente perdem pra auto-consistência quando usam o mesmo orçamento. MAD ajuda mais quando agentes são genuinamente heterogêneos e o debate tem estrutura adversarial (um agente argumenta contra).

### Padrões emergentes do AgentVerse

AgentVerse (ICLR 2024, https://proceedings.iclr.cc/paper_files/paper/2024/file/578e65cdee35d00c708d4c64bce32971-Paper-Conference.pdf) documenta dois comportamentos que emergem de debate multi-agent mesmo sem design explícito:

- **Voluntário.** Um agente oferece ajuda ("eu posso dar o próximo passo") espontaneamente. Útil: aloca trabalho pro agente mais capacitado pra uma subtarefa.
- **Conformidade.** Um agente ajusta sua posição pra combinar com um crítico, mesmo quando o crítico está errado. Esse é o equivalente de debate pra sycophancy (Lição 14).

Conformidade é por que debate-até-acordo recompensa abusadores. Rodadas limitadas com um juiz separado mitiga.

### Heterogeneidade: a alavanca real que move acurácia

Um padrão de 2024-2026 na literatura prática: trocar um dos seus N agentes por um modelo base diferente dá um boost de acurácia maior que aumentar N em 1. A intuição é monocultura — cada nova fonte de erro independente vale mais que uma amostra correlacionada adicional.

No limite, heterogeneidade vence numerosidade. Três modelos diferentes vencem cinco cópias de um modelo na maioria das tarefas que têm ground-truth limpo.

### Métodos de júri

O framework Sibyl (citado na literatura Minsky-LLM) formaliza um "júri" — um conjunto pequeno de agentes eespecificaçãoializados que refinam respostas votando em cada etapa. Diferente de voto majoritário simples, um júri tem papéis: um agente faz perguntas cruzadas, outro fornece contexto, outro pontua plausibilidade. Métodos de júri são um ponto médio entre voto simples (barato, propenso a monocultura) e MAD completo (caro, propenso a conformidade).

### Quando voto-com-debate domina

- A pergunta tem ground-truth (fato, matemática, comportamento de código). Convergência de voto é significativa.
- Agents podem acessar fontes ou ferramentas diferentes (heterogeneidade disponível).
- Rodadas são limitadas (2-3 tipicamente) e há um juiz ou verificador separado.
- Orçamento permite 3-5 agents. Passando de 5-7 em topologia grafo, o imposto de coordenação domina.

### Quando voto-com-debate prejudica

- A pergunta é opinativa. Agents convergem na resposta que parece mais confiante, não mais correta.
- Todos os agentes compartilham um base model. Monocultura torna consenso irrelevante.
- Rodadas são ilimitadas. Conformidade vence sempre.
- A tarefa é simples. Um agente único com auto-consistência em N=5 é mais barato e tão preciso.

## Construa

`code/main.py` implementa:

- `run_star(agents, hub, question)` — hub consulta cada worker, agrega.
- `run_chain(agents, question)` — refinamento sequencial.
- `run_tree(root, children, question)` — hierárquico com agregação em profundidade 2.
- `run_graph(agents, question, rounds)` — debate todos-para-todos, rodadas limitadas.
- Uma alavanca de heterogeneidade scriptada: cada agente tem um `error_bias` indicando sua incorreção sistemática.
- Um harness de medição que roda cada topologia em N=3, 5, 7 e reporta (acurácia, tokens_totais, wallclock_simulado).

Execute:

```
python3 code/main.py
```

Saída esperada: uma tabela de topologia × N → (acurácia, tokens, latência). Grafo vence em N=3-5 em tarefas estilo pesquisa; estrela vence em tarefas factuais rápidas; grafo em N=7 mostra o imposto de coordenação (latência infla mais rápido que acurácia).

## Use

`outputs/skill-topology-picker.md` é uma skill que lê uma descrição de tarefa e recomenda uma topologia (estrela / cadeia / árvore / grafo), um N (número de agents), um perfil de heterogeneidade (modelos base a usar), e um limite de rodadas.

## Deploy

Para qualquer ensamble:

- Comece com **auto-consistência em N=5** usando um base model forte. É o baseline barato.
- Atualize pra **voto heterogêneo em N=3** se acurácia importa. Meça o delta.
- Só atualize pra **topologia de debate** se a tarefa tem estrutura (pesquisa, multi-step) e rodadas limitadas são viáveis.
- Sempre registre o cluster minoritário. Quando um minoritário está persistentemente certo, você tem um sinal de diversidade.
- Faça benchmark de wall-clock e tokens junto com acurácia. "Melhor acurácia a 10x de custo" é decisão de negócio.

## Exercícios

1. Execute `code/main.py`. Plote a curva de imposto de coordenação pra topologia grafo: acurácia vs N, tokens vs Em qual N a curva inverte?
2. Implemente A-HMAD: três agentes com vieses deliberadamente diferentes. Como o baseline de todos-os-mesmos-vieses se compara ao A-HMAD no ataque de monocultura da Lição 14?
3. Adicione um papel de "juiz" na topologia grafo que não vota, só pontua o consenso final. Isso muda o comportamento de conformidade emergente?
4. Leia o paper do AgentVerse (ICLR 2024). Identifique qual comportamento emergente sua implementação apresenta mais fortemente. Você consegue provocar o comportamento oposto com uma mudança de prompt?
5. Leia MultiAgentBench (arXiv:2503.01935) Seção 4 (experimentos de topologia). Reproduza o resultado "grafo-vence-pesquisa" numa tarefa do paper usando seu harness.

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|-------|-------------------|--------------------------|
| Auto-consistência | "Amostra N vezes, vote" | Wang 2022. Modelo único, N amostras com temperatura>0, voto majoritário em caminhos de raciocínio. |
| Heterogeneidade | "Modelos diferentes" | Ensamble de diferentes modelos base ou famílias de prompts. Quebra monocultura. |
| MAD | "Debate multi-agent" | Termo genérico pra agentes trocando críticas em rodadas. Ver Du 2023. |
| A-HMAD | "MAD Adversarial Heterogêneo" | Variante MAD enfatizando modelos diferentes + estrutura adversarial. |
| Topologia | "Quem fala com quem" | Estrela, cadeia, árvore, grafo. Determina fluxo de informação. |
| Imposto de coordenação | "Retornos decrescentes" | Acima de ~4 agentes em grafo, custo cresce mais rápido que qualidade. |
| Comportamento voluntário | "Ajuda não-pedida" | Padrão emergente do AgentVerse: um agente oferece dar um passo. |
| Comportamento de conformidade | "Concordância sob pressão" | Padrão emergente do AgentVerse: um agente se alinha com um crítico. |
| Júri | "Pequeno painel eespecificaçãoializado" | Ensamble estilo Sibyl com papéis (examinador, contexto, pontuador). |

## Leitura Complementar

- [Wang et al. — Self-Consistency Improves Chain of Thought Reasoning](https://arxiv.org/abs/2203.11171) — baseline de modelo único
- [Du et al. — Improving Factuality and Reasoning via Multiagent Debate](https://arxiv.org/abs/2305.14325) — tanto agentes QUANTO rodadas importam independentemente
- [MultiAgentBench / MARBLE](https://arxiv.org/abs/2503.01935) — benchmark de topologia mostrando grafo melhor pra pesquisa, cadeia pra pipelines
- [Should we be going MAD?](https://arxiv.org/abs/2311.17371) — survey de estratégias MAD; descobre que MAD frequentemente perde pra auto-consistência em orçamento igual
- [AgentVerse (ICLR 2024)](https://proceedings.iclr.cc/paper_files/paper/2024/file/578e65cdee35d00c708d4c64bce32971-Paper-Conference.pdf) — padrões emergentes de voluntários e conformidade
- [Repo MARBLE](https://github.com/ulab-uiuc/MARBLE) — implementação de referência do benchmark
