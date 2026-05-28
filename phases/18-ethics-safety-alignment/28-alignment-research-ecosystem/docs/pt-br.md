# Ecossistema de Pesquisa em Alinhamento — MATS, Redwood, Apollo, METR

> Cinco organizações definem a camada de pesquisa em alinhamento não-laboratorial de 2026. MATS (ML Alignment & Theory Scholars): 527+ pesquisadores desde o final de 2021, 180+ papers, 10K+ citações, h-index 47; coorte de verão 2024 incorporada como 501(c)(3) com ~90 scholars e 40 mentores; 80% dos alumni pré-2025 trabalham com segurança/segurança com 200+ na Anthropic, DeepMind, OpenAI, UK AISI, RAND, Redwood, METR, Apollo. Redwood Research: laboratório de alinhamento aplicado fundado por Buck Shlegeris; introduziu AI Controle (Lição 10); colabora com UK AISI em casos de segurança de controle. Apollo Research: avaliações de planejamento pré-deploy para laboratórios de fronteira; autor de Planejamento em Contexto (Lição 8) e Rumo a Casos de Segurança para Planejamento de IA. METR (Model Evaluation and Threat Research): avaliações de capacidade baseadas em tarefas, estudos de horizonte temporal de tarefas autônomas; "Common Elements of Frontier AI Safety Policies" compara frameworks de laboratórios. Eleos AI Research: avaliações de bem-estar de modelo pré-deploy (Lição 19); conduziu avaliação de bem-estar do Claude Opus 4.

**Tipo:** Aprender
**Linguagens:** nenhuma
**Pré-requisitos:** Fase 18 · 01-27 (lições anteriores da Fase 18)
**Tempo:** ~45 minutos

## Objetivos de Aprendizado

- Identificar as cinco organizações do ecossistema de pesquisa em alinhamento não-laboratorial e seus produtos centrais.
- Descrever a escala do MATS (scholars, papers, h-index) e seu papel como pipeline de talentos.
- Descrever a agenda de AI Controle do Redwood e sua parceria com UK AISI.
- Descrever a metodologia de avaliação baseada em tarefas do METR.

## O Problema

Os laboratórios de fronteira (Lição 18) produzem avaliações de segurança internamente e publicam resultados selecionados. O ecossistema fora dos laboratórios é onde as avaliações são validadas, onde novos modos de falha são descobertos pela primeira vez, e onde talentos são treinados. Entender o ecossistema ajuda a interpretar quais resultados de pesquisa são confiáveis por quem.

## O Conceito

### MATS (ML Alignment & Theory Scholars)

Começou no final de 2021. Programa de mentoria em pesquisa; scholars passam 10-12 semanas com um pesquisador sênior em um problema eespecificaçãoífico de alinhamento.

Escala (2026):
- 527+ pesquisadores desde o início.
- 180+ papers publicados.
- 10K+ citações.
- h-index 47.
- Verão 2024: 90 scholars + 40 mentores; incorporado como 501(c)(3).

Resultados de carreira: ~80% dos alumni pré-2025 estão trabalhando com segurança/segurança. 200+ na Anthropic, DeepMind, OpenAI, UK AISI, RAND, Redwood, METR, Apollo.

### Redwood Research

Laboratório de alinhamento aplicado. Fundado por Buck Shlegeris. Introduziu a agenda de AI Controle (Lição 10). Colabora com UK AISI em casos de segurança de controle. Aconselha DeepMind e Anthropic em design de avaliação.

Papers canônicos: Greenblatt, Shlegeris et al., "AI Control" (arXiv:2312.06942, ICML 2024); Alignment Faking (Greenblatt, Denison, Wright et al., arXiv:2412.14093, em conjunto com Anthropic).

Estilo: threat models eespecificaçãoíficos, adversários de pior caso, protocolos concretos que podem ser testados.

### Apollo Research

Avaliações de planejamento pré-deploy para laboratórios de fronteira. Autor de Planejamento em Contexto (Lição 8, arXiv:2412.04984). Parceiro na colaboração de treino anti-planejamento da OpenAI em 2025. Produz Rumo a Casos de Segurança para Planejamento de IA (2024).

Estilo: avaliações em cenário agentic onde engano pode emergir; decomposição em três pilares (desalinhamento, orientação a objetivos, consciência situacional).

### METR (Model Evaluation and Threat Research)

Avaliações de capacidade baseadas em tarefas. Estudos de horizonte temporal de conclusão de tarefas autônomas. "Common Elements of Frontier AI Safety Policies" (metr.org/common-elements, 2025) compara frameworks de laboratórios.

Co-autor do esboço de caso de segurança sobre Planejamento de IA com Apollo.

Estilo: avaliações de tarefas de longo horizonte, medição empírica de capacidade, síntese de frameworks.

### Eleos AI Research

Avaliações de bem-estar de modelo pré-deploy. Conduziu a avaliação de bem-estar do Claude Opus 4 documentada na seção 5.3 do system card. Fornece a verificação metodológica externa para as alegações de bem-estar relevantes da Lição 19.

### O fluxo

MATS treina pesquisadores. Formandos vão para Anthropic, DeepMind, OpenAI (equipes de segurança de laboratório) ou para Redwood, Apollo, METR, Eleos (avaliação externa). Avaliadores externos se associam a laboratórios e a UK AISI / CAISI. Publicações alimentam o ecossistema de volta ao MATS para a próxima coorte.

### Por que essa camada importa

Avalições de fonte única são não-confiáveis: laboratórios avaliando seus próprios modelos têm conflito de interesse estrutural. Avaliadores externos podem levantar e validar modos de falha que o laboratório pode sub-reportar. O paper Sleeper Agents de 2024 (Lição 7) foi Anthropic + Redwood; Alignment Faking foi Anthropic + Redwood; Planejamento em Contexto foi Apollo; Anti-Planejamento foi Apollo + OpenAI. A estrutura multi-organização é o controle de qualidade.

### Onde isso se encaixa na Fase 18

Lições 7-11 referenciam trabalho do Redwood e Apollo; Lição 18 referencia a comparação de frameworks do METR; Lição 19 referencia Eleos. Lição 28 é o mapa organizacional explícito para o ecossistema que o resto da Fase depende.

## Use

Sem código. Leia "Common Elements of Frontier AI Safety Policies" do METR como exemplo de como síntese externa agrega valor ao trabalho de política interno dos laboratórios.

## Entregue

Esta lição produz `outputs/skill-ecosystem-map.md`. Dada uma alegação de alinhamento ou avaliação, identifica a organização, o veículo de publicação, e o estilo metodológico, e verifica cruzadamente com organizações contrapartes conhecidas.

## Exercícios

1. Escolha um paper das Lições 7-15 e identifique as organizações envolvidas. Verifique cruzadamente os autores com alumni do MATS e afiliações atuais do ecossistema.

2. Leia "Common Elements of Frontier AI Safety Policies" do METR. Identifique as três convergências entre laboratórios que eles enfatizam e as duas maiores divergências.

3. Resultados de carreira do MATS são ~80% segurança/segurança. Argumente se essa pressão seletiva é adaptativa (treina o campo) ou enviesada (filtra posições heterodoxas).

4. Redwood e Apollo ambos fazem trabalho de controle/planejamento mas com estilos diferentes. Escolha um modo de falha e descreva como cada um o investigaria.

5. Eleos AI é a única organização pura de bem-estar de modelo. Projete uma segunda organização hipotética focada em uma questão diferente adjacente ao bem-estar (liberdade cognitiva, encarnação robótica, etc.) e articule sua metodologia.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|---------------------------|
| MATS | "o programa de mentoria" | ML Alignment & Theory Scholars; 527+ pesquisadores desde 2021 |
| Redwood Research | "o laboratório de controle" | Alinhamento aplicado; autores de AI Controle; parceiro do UK AISI |
| Apollo Research | "as avaliações de planejamento" | Avaliações de planejamento pré-deploy para laboratórios de fronteira |
| METR | "as avaliações de horizonte de tarefa" | Avaliações de capacidade baseadas em tarefas; síntese de frameworks |
| Eleos AI | "o laboratório de bem-estar" | Avaliações de bem-estar de modelo pré-deploy |
| Pipeline de talentos | "MATS -> laboratórios" | Formandos do MATS fluem para Anthropic, DM, OpenAI, Redwood, Apollo, METR |
| Avaliação externa | "verificação não-laboratorial" | Avaliação não feita pelo produtor do modelo; adiciona credibilidade |

## Leitura Complementar

- [MATS (ML Alignment & Theory Scholars)](https://www.matsprogram.org/) — o programa de mentoria
- [Redwood Research](https://www.redwoodresearch.org/) — papers de AI Controle
- [Apollo Research](https://www.apolloresearch.ai/) — avaliações de planejamento
- [METR — Common Elements of Frontier AI Safety Policies](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) — comparação de frameworks
- [Eleos AI Research](https://www.eleosai.org/research) — metodologia de bem-estar de modelo
