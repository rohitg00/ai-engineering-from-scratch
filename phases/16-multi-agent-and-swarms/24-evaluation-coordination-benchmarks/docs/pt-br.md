# Avaliação e Benchmarks de Coordenação

> Cinco benchmarks de 2025-2026 cobrem o espaço de avaliação multi-agente. **MultiAgentBench / MARBLE** (ACL 2025, arXiv:2503.01935) avalia topologias estrela/cadeia/árvore/grafo com KPIs de marco; **grafo é o melhor pra pesquisa**, planejamento cognitivo adiciona ~3% de conquista de marcos. **COMMA** avalia coordenação multimodal de informação assimétrica; modelos state-of-the-art incluindo GPT-4o lutam pra superar um baseline aleatório. **MedAgentBoard** (arXiv:2505.12371) cobre quatro categorias de tarefas médicas e frequentemente encontra que multi-agente não domina single-LLM. **AgentArch** (arXiv:2509.10769) faz benchmark de arquiteturas de agente enterprise combinando uso de ferramentas + memória + orquestração. **SWE-bench Pro** ([arXiv:2509.16941](https://arxiv.org/abs/2509.16941)) tem 1865 problemas em 41 repos cobrindo apps de negócio, serviços B2B e ferramentas de desenvolvedor; modelos frontier pontuam ~23% no Pro vs 70%+ no Verified — um reality check sobre contaminação. Claude Opus 4.7 (abril 2026) é reportado em **64.3%** no Pro com coordenação explícita de agent-teams (nenhuma fonte primária da Anthropic publicada ainda — trate como preliminar); Verdent (scaffold de agent) atinge **76.1% pass@1** no Verified ([relatório técnico Verdent](https://www.verdent.ai/blog/swe-bench-verified-technical-report)). **AAAI 2026 Bridge Program WMAC** (https://multiagents.org/2026/) é o ponto focal comunitário de 2026. Esta aula se baseia nas métricas do MARBLE, roda um sweep de topologia-vs-métrica e fixa a regra "passar no SWE-bench Verified não é evidência de generalização".

**Tipo:** Aprender
**Idiomas:** Python (stdlib)
**Pré-requisitos:** Fase 16 · 15 (Topologia de Votação e Debate), Fase 16 · 23 (Modos de Falha)
**Tempo:** ~75 minutos

## Problema

Quando um artigo alega "nosso sistema multi-agente é melhor," a pergunta é: melhor que o quê, em quê, medido como? A era 2023-2024 de avaliação multi-agente foi caos — cada um escolheu suas próprias métricas, seus próprios baselines e seus próprios conjuntos de tarefas. Os benchmarks de 2025-2026 impuseram estrutura.

Sem benchmarks compartilhados, você não pode comparar dois sistemas multi-agente de forma significativa. Pior, sem benchmarks hold-out, modelos frontier podem contaminar. SWE-bench Verified se tornou parcialmente contaminado em corpora de treino no meio de 2025; scores de frontier inflados; Pro foi projetado como um reality check não-contaminado.

Esta aula enumera os cinco benchmarks canônicos de 2026, nomeia o que cada um mede e ensina você a ler alegações de benchmark com ceticismo.

## Conceito

### MultiAgentBench (MARBLE) — ACL 2025

arXiv:2503.01935. Avalia quatro topologias de coordenação (estrela, cadeia, árvore, grafo) em tarefas de pesquisa, código e planejamento. KPIs baseados em marcos acompanham progresso parcial ao invés de só sucesso final.

Resultados medidos:

- Topologia **grafo** melhor pra cenários de pesquisa; suporta crítica qualquer-a-qualquer.
- **Cadeia** melhor pra código de refinamento passo-a-passo.
- **Estrela** melhor pra consolidação factual rápida.
- **Taxa de coordenação** aparece passando ~4 agentes no grafo.
- **Planejamento cognitivo** adiciona ~3% de conquista de marcos em todas topologias.

Use quando: quiser comparar topologias de coordenação lado-a-lado. O repo MARBLE (https://github.com/ulab-uiuc/MARBLE) fornece o avaliador.

### COMMA — informação assimétrica multimodal

Cobre tarefas onde agentes têm modalidades de observação diferentes e precisam coordenar sem compartilhar informação completa. O resultado reportado é desconfortável: modelos frontier incluindo GPT-4o lutam pra superar um **baseline aleatório** em colaboração agent-agent no COMMA. O sinal é que modalidades multi-agente são sub-treinadas e sub-avaliadas — LLMs lidam razoavelmente com cooperação de modalidade única; coordenação multi-modalidade colapsa.

Use quando: seu sistema tem coordenação multimodal ou de informação assimétrica. O resultado nulo do COMMA é um aviso pra medir antes de alegar.

### MedAgentBoard — teste de estresse de domínio

arXiv:2505.12371. Quatro categorias de tarefas médicas: diagnóstico, planejamento de tratamento, geração de relatório, comunicação com paciente. Compara multi-agente vs single-LLM vs sistemas convencionais baseados em regras.

Achado: multi-agente NÃO domina single-LLM na maioria das categorias. A vantagem multi-agente é estreita — decomposição de tarefa ajuda quando as subtarefas são claramente separáveis (diagnóstico + tratamento); prejudica quando o overhead de coordenação excede o ganho de eespecificaçãoialização (geração de relatório).

Use quando: seu domínio tem baselines single-LLM claros. Se a lição do MedAgentBoard se generaliza, muitos sistemas multi-agente propostos são super-engineered.

### AgentArch — arquiteturas enterprise

arXiv:2509.10769. Ambientes enterprise com uso de ferramentas, memória e orquestração em camadas. O benchmark isola a contribuição de cada camada: quanto a adição de ferramentas ajuda? Adição de memória? Adição de orquestração multi-agente?

Use quando: está projetando uma pilha de agente enterprise e precisa justificar cada camada. AgentArch ajuda a evitar comprar features cujo valor você não consegue medir.

### SWE-bench Pro — o reality check

arXiv:2509.16941. 1865 problemas em 41 repositórios cobrindo apps de negócio, serviços B2B e ferramentas de desenvolvedor. Projetado pra ser **não-contaminado** com cortes de treino posteriores. Modelos frontier pontuam ~23% no Pro vs 70%+ no Verified. A lacuna é o sinal de contaminação.

Scores de abril de 2026:
- Claude Opus 4.7 no Pro: **64.3%** (reportado com coordenação explícita de agent-teams; nenhuma fonte primária da Anthropic publicada ainda — trate como preliminar).
- Verdent (scaffold de agent) no Verified: **76.1% pass@1** ([relatório técnico](https://www.verdent.ai/blog/swe-bench-verified-technical-report)).
- Scores brutos frontier no Pro sem scaffold de agent: ~23-35% ([artigo SWE-bench Pro](https://arxiv.org/abs/2509.16941)).

O take-away: "superamos o SWE-bench Verified" não é mais evidência de capacidade. Pro é o teste de gate atual. Scaffold de agent-team produz ganhos mensuráveis no Pro (delta de ~30-40 pontos), que é um dos argumentos empíricos mais fortes pra coordenação multi-agente em 2026.

### AAAI 2026 WMAC

AAAI 2026 Bridge Program — Workshop on Multi-Agent Coordination (https://multiagents.org/2026/). O ponto focal comunitário de 2026 pra pesquisa em IA multi-agente. Artigos aceitos e anais do workshop são o local canônico pra avaliar novos métodos; defira pra alegações aceitas no WMAC ao invés de preprints no arXiv pra decisões de produção.

### Leia alegações de benchmark com ceticismo — a checklist de 2026

Quando alguém alega um resultado multi-agente:

1. **Qual benchmark, qual split?** SWE-bench Verified vs Pro importa muito. Um número reportado no split errado é inútil.
2. **Verificação de contaminação.** O benchmark foi liberado depois do corte de treino do modelo? Se não, trate com cautela.
3. **Comparação de baseline.** Vs baseline single-LLM, vs aleatório, vs trabalho multi-agente anterior. Não "vs versão sem tuning do mesmo sistema."
4. **Significância estatística.** N trials, p-value, intervalo de confiança. Modelos frontier são alta-variância; runs únicas enganam.
5. **Diversidade de tarefas.** Uma tarefa ou muitas? Generalização importa pra produção.
6. **Divulgação de custo.** Tokens por tarefa, tempo de parede. Uma solução de 90% a 20x de custo é decisão de negócio, não alegação de capacidade.

### O que nenhum dos benchmarks mede bem

- **Coordenação de horizonte longo.** Dias de interação de parede. Todos benchmarks atuais rodam curto.
- **Resiliência adversarial.** O que acontece quando um agente é malicioso ou comprometido?
- **Deriva sob deploy.** Benchmarks são estáticos; distribuições de produção mudam.
- **Performance normalizada por custo.** A maioria dos benchmarks reporta acurácia bruta, não acurácia-por-dólar.

Construir seu benchmark interno pro eixo que você realmente se importa é frequentemente o movimento certo.

## Construir

`code/main.py` é um walkthrough não-interativo:

- Simula 3 sistemas multi-agente numa tarefa simples.
- Computa métricas de marco estilo MARBLE pra cada um.
- Roda verificação de contaminação restringindo tarefas de um set de "treino".
- Compara com um baseline aleatório explicitamente.
- Imprime um scorecard de alegações de benchmark.

Execute:

```bash
python3 code/main.py
```

Saída esperada: scorecard do sistema com acurácia bruta, conquista de marcos, custo-por-tarefa, delta vs-aleatório e nota de verificação de contaminação.

## Usar

`outputs/skill-benchmark-reader.md` lê qualquer alegação de benchmark multi-agente e aplica a checklist de escrutínio. Saída: uma nota e ressalvas.

## Em produção

Disciplina de avaliação em produção:

- **Construa um benchmark interno** que reflita sua distribuição de produção real. Benchboards públicos informam mas não substituem.
- **Inclua um baseline aleatório** em toda comparação. Se você não superar o aleatório por margem ampla numa tarefa de coordenação, a tarefa pode estar mal formulada.
- **Reporte custo junto com acurácia.** Custo de token e tempo de parede. Equipes de ops precisam dos dois.
- **Reconstrua o benchmark trimestralmente.** Distribuição de produção muda; benchmarks desatualizados enganam.
- **Evite overfitting em benchmarks publicados.** Se seu time está otimizando eespecificaçãoificamente pra números do SWE-bench Pro, você vai regredir em produção.

## Exercícios

1. Execute `code/main.py`. Identifique qual dos três sistemas simulados tem a melhor taxa de conquista-custo. Combina com o sistema de maior acurácia bruta?
2. Leia MultiAgentBench (arXiv:2503.01935). Pro seu domínio de tarefa, decida qual das quatro topologias o MARBLE recomendaria. Justifique com os resultados do artigo.
3. Leia o artigo SWE-bench Pro. O que eespecificaçãoificamente o torna resistente a contaminação? A mesma técnica poderia ser aplicada a outros benchmarks que você se importa?
4. Leia o achado do COMMA sobre coordenação multimodal. Projete uma tarefa simples de coordenação multimodal que você poderia adicionar ao seu benchmark interno. O que contaria como sinal útil?
5. Aplique a checklist de alegações de benchmark ao resultado headline de um artigo multi-agente recente. Qual nota você daria à alegação?

## Termos-chave

| Termo | O que dizem | O que realmente significa |
|------|----------------|------------------------|
| MARBLE | "MultiAgentBench" | ACL 2025; topologias estrela/cadeia/árvore/grafo com KPIs de marcos. |
| COMMA | "Benchmark multimodal" | Coordenação multimodal de info assimétrica; modelos frontier lutam vs aleatório. |
| MedAgentBoard | "Teste de estresse de domínio" | Quatro categorias médicas; frequentemente encontra multi-agente não dominando single-LLM. |
| AgentArch | "Benchmark enterprise" | Ferramentas + memória + orquestração em camadas. |
| SWE-bench Pro | "Resistente a contaminação" | 1865 problemas, 41 repos; ~23% vs 70%+ no Verified (o sinal de contaminação). |
| Conquista de marcos | "Crédito parcial" | Benchmarks que recompensam progresso, não só sucesso final. |
| Contaminação | "Benchmark vazou pro treino" | Pós-liberação, benchmarks derivam pra corpora de treino; scores inflam. |
| WMAC | "AAAI 2026 Bridge Program" | Workshop on Multi-Agent Coordination; ponto focal comunitário. |

## Leitura Adicional

- [MultiAgentBench / MARBLE](https://arxiv.org/abs/2503.01935) — benchmark de topologia com KPIs de marcos
- [Repositório MARBLE](https://github.com/ulab-uiuc/MARBLE) — implementação de referência
- [MedAgentBoard](https://arxiv.org/abs/2505.12371) — teste de estresse de domínio; multi-agente frequentemente não domina
- [AgentArch](https://arxiv.org/abs/2509.10769) — arquiteturas de agente enterprise
- [Leaderboards SWE-bench](https://www.swebench.com/) — scores Verified e Pro pra modelos frontier
- [AAAI 2026 WMAC](https://multiagents.org/2026/) — ponto focal comunitário de 2026
