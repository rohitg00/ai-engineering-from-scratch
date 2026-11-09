# Política de Escalagem Responsável Antropical v3.0

> A RSP v3.0 entrou em vigor em 24 de fevereiro de 2026, substituindo a política de 2023. Mitigamento de dois níveis: o que a Anthropic fará unilateralmente versus o que é enquadrado como uma recomendação para toda a indústria (incluindo os padrões de segurança RAND SL-4). Adiciona mapas de roteiro de segurança de fronteiras e relatórios de riscos como documentos permanentes, em vez de dados de entrega pontuais. Despeja o compromisso de pausa para 2023. Introduz o limiar de I&D-4 da IA: uma vez ultrapassado, a Anthropic deve publicar um caso afirmativo identificando riscos e mitigações de desalinhamento. O Claude Opus 4.6 não atravessa. A Antropic afirma no anúncio da versão 3.0 que "confiar que descartar isso está ficando difícil". A SaferAI classificou o RSP de 2023 em 2.2; eles rebaixaram a versão 3.0 para 1.9, colocando a Anthropic na categoria de RSP "fraca" ao lado da OpenAI e DeepMind. Os limites qualitativos substituíram os compromissos quantitativos de 2023; a eliminação da cláusula de pausa é a regressão mais acentuada.

**Type:** Learn
**Languages:** Python (stdlib, RSP threshold decision engine), TypeScript
**Prerequisites:** Phase 15 · 06 (AAR), Phase 15 · 07 (RSI)
**Time:** ~45 minutes

## O problema

Os laboratórios Frontier publicam políticas de escalagem que são em parte documentos técnicos, em parte documentos de governança e em parte sinais para os reguladores. RSP v3.0 é o documento atual Anthropic. Ler de perto importa não porque o cumprimento com ele é vinculativo (não é), mas porque o enquadramento molda como um laboratório concebe o risco catastrófico e como eles comunicam compensações ao público.

A diferença v3.0 vs v2.0 é a unidade útil. O que foi adicionado: Mapa de estrada de segurança fronteiriça, relatórios de riscos, o limiar de I&D-4 da IA. O que foi removido: o compromisso de pausa de 2023. O que foi reformado: um cronograma de mitigação de dois níveis dividido entre a Antropic unilateral e a recomendação da indústria. Revisão externa  SaferAI  reduziu a pontuação de 2.2 (v2) para 1.9 (v3.0). É assim que uma política de escala pode ser menos rigorosa enquanto parece mais polida.

## O conceito

### O calendário de mitigação de dois níveis

- **Anthropic unilateral actions**O treinamento termina acima de um limiar, medidas de segurança específicas, portas de implantação específicas.
- **Industry-wide recommendations**A Anthropic não se compromete a promover a segurança, mas a promover políticas.

A estrutura de dois níveis não estava no v2. Significa que um leitor precisa olhar para a coluna em que cada compromisso vive. Uma medida de segurança na coluna "recomendação para toda a indústria" não é a promessa da Anthropic; é a esperança da Anthropic.

### O limiar de I&D-4 da IA

Este é o nível de capacidade RSP v3.0 nomeia como o próximo limiar importante. Especificamente: um modelo que poderia automatizar uma fração substancial da pesquisa de IA a um custo competitivo. Uma vez que a Anthropic acredita que um modelo o cruza, eles devem publicar um caso afirmativo identificando riscos de desalinhamento e mitigações antes de continuar a escala.

Claude Opus 4.6 não ultrapassa o limite de risco segundo o anúncio v3.0. O documento acrescenta: "Certamente, descartar isso está ficando difícil". Essa fraseção é importante; admite que o limiar está perto o suficiente para ser uma preocupação real, não um limite especulativo.

A lição 6 (Automated Alignment Research) e a lição 7 (Recursive Self-Improvement) alimentam diretamente este limiar.

### Mapa de rota da segurança nas fronteiras e relatórios de riscos

O v3.0 eleva dois tipos de artefatos a documentos permanentes:

- **Frontier Safety Roadmap**O documento apresenta um quadro de orientação para o futuro que descreve os trabalhos de segurança planejados, as expectativas de capacidade e a investigação sobre a mitigação.
- **Risk Report**O documento retrospectivo sobre modelos específicos após a liberação, que descreve a capacidade observada e o risco residual.

Ambos são públicos. Ambos são atualizados em uma cadência declarada. A utilidade é: o leitor pode rastrear como o que a Anthropic disse que faria em um Roadmap compara com o que relatam em um Relatório de Risco.

### Removendo a cláusula de pausa

O RSP de 2023 incluiu um compromisso explícito de pausa: se um modelo ultrapassasse os limiares de capacidade específicos, o treinamento interromperia até que as atenuações fossem implementadas. V3.0 substitui a pausa explícita por uma formulação mais suave (publicar um caso afirmativo, prosseguir se as atenuações forem adequadas). SaferAI e outros analistas chamaram isso diretamente como a regressão mais forte no novo documento.

O argumento político para a mudança: os limites quantitativos em 2023 revelaram-se inalcançáveis pelos referências de capacidade da era 2026 porque os referências em si foram re-escalados. O contra-argumento: uma cláusula de pausa numa política de escala é um instrumento de compromisso; a sua eliminação elimina a credibilidade da política.

### A redução do nível da SaferAI

A SaferAI é uma organização independente que avalia documentos de estilo RSP. Sua classificação pública: 2023 Anthropic RSP obteve 2.2 (de uma escala onde 4.0 é a melhor RSP atual e 1.0 é nominal). v3.0 obteve 1.9.

Os fatores de redução de classificação por SaferAI:
- Os limites de qualidade substituíram os de qualidade.
- A pausa de compromisso foi removida.
- As mitigações do limiar de I&D-4 da IA são descritas como "casos afirmativos" em vez de medidas específicas.
- Os mecanismos de revisão dependem do Grupo Consultivo de Segurança da Anthropic, com supervisão independente limitada.

### O que esta lição não é

Esta não é uma lição de conformidade. RSP v3.0 não é uma regulamentação; nada obriga a Anthropic a segui-la. A lição é ler o documento com a especificidade e o ceticismo que merece. As políticas de escalagem são os principais laboratórios públicos de sinais fronteiriços emitidos sobre posturas de risco catastrófico. Ler bem é uma habilidade prática para qualquer pessoa cujo trabalho depende das capacidades fronteiriças.

```figure
a5-rsp-ladder
```

## Usá-lo

`code/main.py`Implementa um pequeno motor de decisão que reflete a forma de avaliação do limiar de RSP: dado um modelo candidato e um conjunto de medições de capacidade, retorne se o limiar de I&D-4 da IA foi ultrapassado, as seções de casos afirmativos necessárias e se a implantação pode continuar. É intencionalmente simples; o ponto é tornar a lógica do documento explícita.

## Envia-o

`outputs/skill-scaling-policy-review.md`Revisar uma política de escalagem (Anthropic, OpenAI, DeepMind ou interna) em relação à referência v3.0: estrutura de dois níveis, limiares, compromissos de pausa, revisão independente.

## Exercícios

1. Corra .`code/main.py`- Introdução de três modelos sintéticos em diferentes níveis de capacidade.

2. Leia RSP v3.0 em sua totalidade (32 páginas). Identifique cada compromisso que vive na categoria "recomendações para toda a indústria". Qual desses compromissos teria sido "antropico unilateral" na v2?

3. Leia a metodologia de classificação RSP da SaferAI. Reproduzir a pontuação 1,9 para a versão 3.0 aplicando sua rubrica ao documento. Qual linha de rubrica levou a rebaixada mais?

4. Propõe um compromisso de substituição que preserve a credibilidade da política, reconhecendo o problema da recalculação dos valores de referência de 2026.

5. Compare RSP v3.0 com OpenAI Preparedness Framework v2 (Lessão 20). Escolha uma área onde v3.0 é mais forte. Escolha uma área onde o Framework de Preparedness é mais forte.

## Termos-chave

| Term | What people say | What it actually means |
|---|---|---|
| RSP | "Anthropic's scaling policy" | Responsible Scaling Policy; v3.0 effective Feb 24, 2026 |
| AI R&D-4 | "Research-automation threshold" | Capability to automate substantial AI research at competitive cost |
| Affirmative case | "Safety justification" | Published argument that risks are identified and mitigations adequate |
| Frontier Safety Roadmap | "Forward plan" | Standing document on planned safety work and expected capabilities |
| Risk Report | "Retrospective on a model" | Standing document on observed capability and residual risk after release |
| Two-tier mitigation | "Unilateral vs industry" | Anthropic commitments vs industry recommendations, separated |
| Pause commitment | "2023 clause" | Explicit promise to pause training; removed in v3.0 |
| SaferAI rating | "Independent RSP grade" | Third-party rubric; v3.0 scored 1.9 (v2 was 2.2) |

## Mais leitura

- [Anthropic — Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) a política completa de 32 páginas.
- [Anthropic — RSP v3.0 announcement](https://www.anthropic.com/news/responsible-scaling-policy-v3) resumo das alterações a partir de v2.
- [Anthropic — Frontier Safety Roadmap](https://www.anthropic.com/responsible-scaling-policy/roadmap) documento permanente ligado a partir do RSP v3.0.
- [Anthropic — Risk Report: February 2026](https://www.anthropic.com/feb-2026-risk-report) retrospectiva sobre o modelo de fronteira Claude Opus 4.6, quando foi publicado.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) liga a IA R&D-4 à autonomia medida.
