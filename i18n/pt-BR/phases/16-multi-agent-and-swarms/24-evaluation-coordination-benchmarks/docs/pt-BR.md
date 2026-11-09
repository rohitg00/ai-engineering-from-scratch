# Indicadores de avaliação e coordenação

> Cinco critérios de referência para 2025-2026 abrangem o espaço de avaliação multiagente. **MultiAgentBench / MARBLE**(ACL 2025, arXiv:2503.01935) avalia as topologias de estrelas/cadeias/árvores/grafos com KPI de marcas; **graph is best for research**O planejamento cognitivo adiciona ~3% de realização de metas. **COMMA**Avalia a coordenação multimodal de informação asimétrica; modelos de ponta, incluindo o GPT-4o, lutam para superar uma linha de base aleatória. **MedAgentBoard**(arXiv:2505.12371) abrange quatro categorias de tarefas médicas e muitas vezes encontra multi-agente não domina o single-LLM. **AgentArch**(arXiv:2509.10769) referências de arquiteturas de agentes empresariais combinando utilização de ferramentas + memória + orquestração. **SWE-bench Pro**([arXiv:2509.16941](https://arxiv.org/abs/2509.16941)O modelo de fronteira tem uma pontuação de ~23% no Pro vs 70% + no Verified  uma verificação de realidade sobre a contaminação.**64.3%**Pro com coordenação explícita de agentes-equipas (nenhuma fonte primária antropópica publicada ainda  tratar como preliminar); Verdent (establo de agentes) hits **76.1% pass@1**sobre Verificado ([Verdent technical report](https://www.verdent.ai/blog/swe-bench-verified-technical-report) ).**AAAI 2026 Bridge Program WMAC**(https://multiagents.org/2026/Esta lição baseia-se nas métricas da MARBLE, faz uma varredura topologia-versus-metrica e fixa a regra "apenas passar o banco SWE Verificado não é evidência de generalização".

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 15 (Voting and Debate Topology), Phase 16 · 23 (Failure Modes)
**Time:** ~75 minutes

## Problemas

Quando um artigo afirma que "nosso sistema multi-agente é melhor", a questão é: melhor do que, em que, medida como? A era de avaliação multi-agente de 2023-2024 foi caos.

Sem benchmarks compartilhados, não se pode comparar significativamente dois sistemas multi-agentes. Pior, sem benchmarks de retenção, os modelos de fronteira podem contaminar. SWE-bench Verified tornou-se parcialmente contaminado nos corpora de treinamento em meados de 2025; pontuações de fronteira inflacionadas; Pro foi projetado como um controle de realidade não contaminado.

Esta lição enumera os cinco critérios de referência canônicos de 2026, nomeia o que cada uma mede e ensina-o a ler as afirmações de referência de forma cética.

## Conceptos

### MultiAgentBench (MARBLE)  ACL 2025

ArXiv:2503.01935. Avalia quatro topologias de coordenação (estrela, cadeia, árvore, gráfico) em tarefas de pesquisa, codificação e planejamento.

Resultados medidos:

- **Graph**A melhor topologia para cenários de investigação; apoia qualquer crítica.
- **Chain**melhor para codificação de refinamento gradual.
- **Star**melhor para uma consolidação rápida de facto.
- **Coordination tax**aparece depois de ~4 agentes no gráfico.
- **Cognitive planning**Adiciona ~3% de logros em todas as topologias.

Utilize quando: quer comparar topologias de coordenação maçãs- maçãs.https://github.com/ulab-uiuc/MARBLE) é o avaliador.

### COMMA  Informações asimétricas multimodal

O resultado relatado é desconfortável: os modelos de fronteira, incluindo o GPT-4o, lutam para vencer um grupo de**random baseline**O relatório da Comissão sobre a cooperação entre agentes no COMMA indica que as modalidades de multi-agentes são pouco treinadas e sub-avaliações.

Utilize quando: o seu sistema tem coordenação multimodal ou asimetrica de informação.

### MedAgentBoard  Teste de estresse de domínio

ArXiv:2505.12371. Quatro categorias de tarefas médicas: diagnóstico, planejamento de tratamento, geração de relatórios, comunicação com os pacientes. Comparar sistemas baseados em regras convencionais com sistemas multi-agente versus single-LLM.

A vantagem do multi-agente é estreita  A decomposição das tarefas ajuda quando as subtarefas são claramente separáveis (diagnóstico + tratamento); dói quando a coordenação de gastos gerais excede o ganho de especialização (geração de relatórios).

Use quando: seu domínio tem linhas de base claras de um único LLM. Se a lição do MedAgentBoard generaliza, muitos sistemas multi-agentes propostos são sobre-engenheirados.

### AgenteArch  Arquiteturas empresariais

ArXiv:2509.10769. Configurações empresariais com uso de ferramentas, memória e orquestração em camadas juntas. Benchmark isola a contribuição de cada camada: quanto ajuda adicionar ferramentas? adicionar memória? adicionar orquestração multi-agente?

Utilize quando: você está a projetar uma pilha de agentes empresariais e precisa justificar cada camada.

### SWE-bench Pro  a verificação da realidade

ArXiv:2509.16941. 1865 problemas em 41 repositórios abrangendo aplicativos de negócios, serviços B2B e ferramentas de desenvolvimento.**uncontaminated**Os modelos Frontier têm uma pontuação de ~23% no Pro versus 70%+ no Verified.

Resultados de abril de 2026:
- Claude Opus 4.7 no Pro: **64.3%**(relatado com coordenação explícita entre agentes e equipes; nenhuma fonte primária Anthropic publicada ainda  tratada como preliminar).
- Verdent (establo de agentes) em Verificado: **76.1% pass@1**([technical report](https://www.verdent.ai/blog/swe-bench-verified-technical-report))).
- Resultados brutos de fronteira em Pro sem andamio de agente: ~23-35% ([SWE-bench Pro paper](https://arxiv.org/abs/2509.16941))).

O resultado: "vemos vencer o banco SWE Verified" não é mais uma prova de capacidade. Pro é o teste atual de gating.

### AAAI 2026 WMAC

Programa de ponte 2026 da AAAI  Talento sobre coordenação multi-agente (https://multiagents.org/2026/O artigo 107.o, n.o 1, do Tratado de Maastricht, estabelece um quadro de cooperação entre a Comunidade Europeia e a Comunidade Europeia para a investigação sobre a IA.

### Leia as alegações de referência de forma cética  a lista de verificação de 2026

Quando alguém reclama um resultado multi-agente:

1. **Which benchmark, which split?**Verificado vs Pro é muito importante, um número relatado na divisão errada não vale nada.
2. **Contamination check.**O índice de referência foi lançado após o corte de treino do modelo?
3. **Baseline comparison.**Contra a linha de base de um único LLM, contra o aleatório, contra o trabalho anterior de vários agentes.
4. **Statistical significance.**Os modelos de fronteira são de alta variação; as corridas individuais enganam.
5. **Task diversity.**Uma tarefa ou muitas? A generalização é importante para a produção.
6. **Cost disclosure.**Uma solução de 90% a um custo de 20 vezes é uma decisão de negócios, não uma reivindicação de capacidade.

### O que nenhum dos índices de referência mede bem

- **Long-horizon coordination.**Dias de interação entre o relógio de parede.
- **Adversarial resilience.**O que acontece quando um agente é malicioso ou comprometido?
- **Drift under deployment.**Os índices de referência são estáticos; as distribuições de produção mudam.
- **Cost-normalized performance.**A maioria dos índices de referência relata precisão bruta, não precisão por dólar.

Construir o seu próprio índice de referência interno para o eixo que realmente lhe interessa é muitas vezes o movimento certo.

```figure
a5-bench-gap
```

## Construí-lo

`code/main.py`é um passeio não interativo:

- Simula 3 sistemas multi-agentes numa tarefa de brinquedo.
- Computa métricas de margem de estilo MARBLE para cada um.
- Realiza um controlo de contaminação retendo tarefas de um conjunto de "formação".
- Comparado a uma linha de base aleatória explicitamente.
- Imprime um cartão de pontuação de reivindicações de referência.

- Correr .

```bash
python3 code/main.py
npx tsx code/main.ts
```

Resultados esperados: cartão de pontuação do sistema com precisão bruta, realização de metas, custo por tarefa, delta da linha de base versus aleatório e nota de verificação da contaminação.

## Usá-lo

`outputs/skill-benchmark-reader.md`Leia qualquer pedido de referência de vários agentes e aplica a lista de controlo de controlo.

## Envia-o

Disciplina da avaliação da produção:

- **Build an internal benchmark**Os índices de referência públicos informam, mas não substituem.
- **Include a random baseline**Se não conseguirem vencer o acaso por uma grande margem numa tarefa de coordenação, a tarefa pode ser mal colocada.
- **Report cost alongside accuracy.**O custo dos tokens e o relógio de parede.
- **Rebuild the benchmark quarterly.**Mudanças na distribuição da produção; valores de referência obsoletos enganam.
- **Avoid published-benchmark overfitting.**Se a sua equipa está a optimizar especificamente para os números de SWE-bench Pro, você regressará à produção.

## Exercícios

1. Corra .`code/main.py`Identificar qual dos três sistemas simulados tem o melhor custo por marco.
2. Leia MultiAgentBench (arXiv:2503.01935). Para o seu próprio domínio de tarefas, decida qual das quatro topologias que a MARBLE recomendaria.
3. Leia o artigo do SWE-bench Pro. O que é que o torna especificamente resistente à contaminação?
4. Leia a conclusão da COMMA sobre a coordenação multimodal.
5. Aplique a lista de verificação das reivindicações de referência ao resultado principal de um recente artigo sobre vários agentes.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MARBLE | "MultiAgentBench" | ACL 2025; star/chain/tree/graph topologies with milestone KPIs. |
| COMMA | "Multimodal benchmark" | Multimodal asymmetric-info coordination; frontier models struggle vs random. |
| MedAgentBoard | "Domain stress test" | Four medical categories; often finds multi-agent does not dominate single-LLM. |
| AgentArch | "Enterprise benchmark" | Tools + memory + orchestration layered. |
| SWE-bench Pro | "Contamination-resistant" | 1865 problems, 41 repos; ~23% vs 70%+ on Verified (the contamination signal). |
| Milestone achievement | "Partial credit" | Benchmarks that reward progress, not only final success. |
| Contamination | "Benchmark leaked into training" | Post-release, benchmarks drift into training corpora; scores inflate. |
| WMAC | "AAAI 2026 Bridge Program" | Workshop on Multi-Agent Coordination; community focal point. |

## Mais leitura

- [MultiAgentBench / MARBLE](https://arxiv.org/abs/2503.01935) índice de referência de topologia com indicadores indicadores de referência
- [MARBLE repository](https://github.com/ulab-uiuc/MARBLE) Implementação de referência
- [MedAgentBoard](https://arxiv.org/abs/2505.12371) Teste de tensão de domínio; muitas vezes não domina o multi-agente
- [AgentArch](https://arxiv.org/abs/2509.10769)Arquiteturas de agentes empresariais
- [SWE-bench leaderboards](https://www.swebench.com/) Resultados verificados e pro para modelos de fronteira
- [AAAI 2026 WMAC](https://multiagents.org/2026/) o ponto focal comunitário de 2026
