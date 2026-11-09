# Ecossistema de investigação de alinhamento  MATS, Redwood, Apollo, METR

> Cinco organizações definem a camada de investigação de alinhamento não laboratorial para 2026. MATS (ML Alignment & Theory Scholars): 527+ pesquisadores desde o final de 2021, 180+ trabalhos, 10K+ citações, h-index 47; coorte de verão de 2024 incorporada como 501 ((c) ((3) com ~ 90 estudiosos e 40 mentores; 80% dos ex-alunos de pré-2025 trabalham em segurança / segurança com 200+ na Anthropic, DeepMind, OpenAI, UK AISI, RAND, Redwood, METR, Apollo. Redwood Research: laboratório de alinhamento aplicado fundado por Buck Shlegeris; introduziu o controle de IA (Lessão 10); colabora com a AISI do Reino Unido em casos de segurança de controle. Pesquisa Apollo: avaliações de planejamento pré-implementação para laboratórios de fronteira; autor de Planejamento no contexto (Lessão 8) e Em direcção a casos de segurança para planejamento de IA. METR (Model Evaluation and Threat Research): avaliações de capacidade baseadas em tarefas, estudos de horário-horizonte de tarefas autônomas; "Elementos comuns das políticas de segurança de inteligência artificial de fronteira" compara os quadros de laboratório. Eleos AI Research: avaliações pré-implementação do modelo de bem-estar (Lessão 19); conduziu uma avaliação do bem-estar do Claude Opus 4.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 18 · 01-27 (prior Phase 18 lessons)
**Time:** ~45 minutes

## Objetivos de aprendizagem

- Identificar as cinco organizações do ecossistema de investigação de alinhamento não laboratorial e a sua produção principal.
- Descreva a escala do MATS (escolhentes, trabalhos, índice h) e o seu papel como um pipeline de talentos.
- Descreva a agenda de controle de IA da Redwood e a sua parceria com a AISI do Reino Unido.
- Descrever a metodologia de avaliação baseada em tarefas do METR.

## O problema

Os laboratórios de fronteira (Lessão 18) produzem avaliações de segurança internamente e publicam resultados selecionados. O ecossistema fora dos laboratórios é onde as avaliações são validadas, onde novos modos de falha são descobertos pela primeira vez e onde os talentos são treinados.

## O conceito

### MATS (M.L. Alignment & Theory Scholars)

Começou no final de 2021. Programa de mentoria de pesquisa; os estudiosos passam 10-12 semanas com um pesquisador sênior em um problema específico de alinhamento.

Escala (2026):
- 527+ investigadores desde a sua criação.
- 180 artigos publicados.
- 10 mil citações.
- índice h 47.
- Verão de 2024: 90 acadêmicos + 40 mentores; incorporados como 501 ((c) ((3).

Resultados da carreira: ~ 80% dos ex-alunos pré-2025 trabalham em segurança. 200+ na Anthropic, DeepMind, OpenAI, UK AISI, RAND, Redwood, METR, Apollo.

### Pesquisa em Redwood

Laboratório de alinhamento aplicado. Fundado por Buck Shlegeris. Introduziu a agenda de controle de IA (Lessão 10). Colabora com a AISI do Reino Unido em casos de segurança de controle. Aconselha a DeepMind e a Anthropic no projeto de avaliação.

Papéis canônicos: Greenblatt, Shlegeris et al., "AI Control" (arXiv:2312.06942, ICML 2024); Alignment Faking (Greenblatt, Denison, Wright et al., arXiv:2412.14093, em conjunto com Anthropic).

Estilo: modelos específicos de ameaça, adversários no pior dos casos, protocolos concretos que podem ser testados por estresse.

### Pesquisa do Apollo

Avaliações de esquemas pré-implementação para laboratórios de fronteira. Autor de Esquemas em contexto (Lessão 8, arXiv:2412.04984). Parceiro em 2025 OpenAI colaboração de treinamento anti-esquema. Produce Para Casos de Segurança para AI Scheming (2024).

Estilo: avaliações de configuração de agentes em que pode surgir o engano; decomposição de três pilares (mal alinhamento, orientação ao objetivo, consciência situacional).

### METR (Modelo de Avaliação e Pesquisa de ameaças)

Avaliações de capacidade baseadas em tarefas. Estudos de horário-horizonte de conclusão de tarefas autônomas. "Elementos comuns das políticas de segurança de inteligência artificial de fronteira" (metr.org/common-elements, 2025) compara os quadros de laboratório.

Co-autor do esboço de segurança de AI Scheming com o Apollo.

Estilo: avaliações de tarefas de longo horizonte, medição empírica de capacidade, síntese de quadro.

### Eleos AI Research

A avaliação de bem-estar do modelo de pré-implementação. realizou a avaliação de bem-estar do Claude Opus 4, documentada na secção 5.3 do cartão do sistema.

### O fluxo

O MATS treina pesquisadores. Os graduados vão para Anthropic, DeepMind, OpenAI (teams de segurança de laboratório) ou para Redwood, Apollo, METR, Eleos (avaliação externa).

### Por que essa camada importa

As avaliações de uma só fonte são pouco confiáveis: os laboratórios que avaliam os seus próprios modelos têm um conflito de interesses estrutural. Os avaliadores externos podem aumentar e validar os modos de falha que o laboratório pode subrepor. O artigo de 2024 de Agentes dormidos (Lessão 7) foi Antropic + Redwood; Falsação de alinhamento foi Antropic + Redwood; Planejamento no contexto foi Apollo; Anti-Scheming foi Apollo + OpenAI. A estrutura multiorgânica é o controlo da qualidade.

### Onde isto encaixa na Fase 18

Lições 7-11 referem-se ao trabalho de Redwood e Apollo; Lição 18 refere-se à comparação do quadro do METR; Lição 19 refere-se ao Eleos. Lição 28 é o mapa organizacional explícito para o ecossistema em que o resto da Fase depende.

```figure
sae-features
```

## Usá-lo

Não há código. Leia "Elementos comuns das políticas de segurança de inteligência artificial de fronteira" do METR como um exemplo de como a síntese externa adiciona valor ao trabalho de políticas internas do laboratório.

## Envia-o

Esta lição produz`outputs/skill-ecosystem-map.md`. Tendo em conta uma alegação ou avaliação de alinhamento, identifica a organização, o local de publicação e o estilo metodológico, bem como as verificações cruzadas contra organizações conhecidas.

## Exercícios

1. Escolha um artigo das lições 7-15 e identifique as organizações envolvidas.

2. Leia os "Elementos Comuns das Políticas de Segurança da IA Fronteira" do METR. Identifique as três convergências transnacionais que enfatizam e as duas maiores divergências.

3. Os resultados da carreira de MATS são ~ 80% de segurança.

4. Redwood e Apollo fazem ambos o trabalho de controle/desenho, mas com estilos diferentes.

5. Eleos AI é a única organização de bem-estar modelo pura. Desenhar uma segunda organização hipotética focada em uma questão de bem-estar adjacente diferente (liberdade cognitiva, realização robótica, etc.) e articular sua metodologia.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| MATS | "the mentorship program" | ML Alignment & Theory Scholars; 527+ researchers since 2021 |
| Redwood Research | "the control lab" | Applied alignment; AI Control authors; UK AISI partner |
| Apollo Research | "the scheming evals" | Pre-deployment scheming evaluations for frontier labs |
| METR | "the task-horizon evals" | Task-based capability evaluations; framework synthesis |
| Eleos AI | "the welfare lab" | Model-welfare pre-deployment evaluations |
| Talent pipeline | "MATS -> labs" | MATS graduates flow to Anthropic, DM, OpenAI, Redwood, Apollo, METR |
| External evaluation | "non-lab check" | Evaluation not done by the model's producer; adds credibility |

## Mais leitura

- [MATS (ML Alignment & Theory Scholars)](https://www.matsprogram.org/) o programa de mentoria
- [Redwood Research](https://www.redwoodresearch.org/) Artificial Intelligence Control papers
- [Apollo Research](https://www.apolloresearch.ai/) Avaliações de planos
- [METR — Common Elements of Frontier AI Safety Policies](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) Comparação do quadro
- [Eleos AI Research](https://www.eleosai.org/research) Modelo de metodologia de assistência social
