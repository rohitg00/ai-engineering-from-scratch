# Responsible Scaling Policy v3.0 da Anthropic

> RSP v3.0 entrou em vigor em 24 de fevereiro de 2026, substituindo a política de 2023. Mitigação em dois níveis: o que a Anthropic fará unilateralmente vs o que é enquadrado como recomendação da indústria (incluindo padrões de segurança RAND SL-4). Adiciona Frontier Safety Roadmaps e Risk Reports como documentos permanentes ao invés de entregas únicas. Remove o compromisso de pausa de 2023. Introduz o limiar AI R&D-4: uma vez cruzado, a Anthropic deve publicar um caso afirmativo identificando riscos de desalinhamento e mitigações. Claude Opus 4.6 não o cruza. A Anthropic afirma no anúncio da v3.0 que "afastar isso com confiança está se tornando difícil." SaferAI avaliou o RSP de 2023 com 2.2; rebaixou a v3.0 para 1.9, colocando a Anthropic na categoria "fraca" de RSP ao lado da OpenAI e DeepMind. Limiares qualitativos substituíram compromissos quantitativos de 2023; remover a cláusula de pausa é a regressão mais aguda.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, engine de decisão de limiares do RSP)
**Pré-requisitos:** Fase 15 · 06 (AAR), Fase 15 · 07 (RSI)
**Tempo:** ~45 minutos

## O Problema

Laboratórios de fronteira publicam políticas de escala que são parcialmente documentos técnicos, parcialmente documentos de governança e parcialmente sinais para reguladores. RSP v3.0 é o documento atual da Anthropic. Lê-lo de perto importa não porque a conformidade com ele é vinculante (não é), mas porque o enquadramento molda como um laboratório conceitualiza risco catastrófico e como comunica trade-offs ao público.

O diff v3.0 vs v2.0 é a unidade útil. O que foi adicionado: Frontier Safety Roadmaps, Risk Reports, limiar AI R&D-4. O que foi removido: o compromisso de pausa de 2023. O que foi reenquadrado: uma agenda de mitigação em dois níveis dividida entre unilateral-da-Anthropic e recomendação-da-indústria. Revisão externa — SaferAI — rebaixou a nota de 2.2 (v2) para 1.9 (v3.0). É assim que uma política de escala pode ficar menos rigorosa enquanto parece mais polida.

## O Conceito

### A agenda de mitigação em dois níveis

- **Ações unilaterais da Anthropic**: o que a Anthropic fará independente do que outros laboratórios façam. Treino para acima de um limite, medidas de segurança específicas, gates de deploy específicos.
- **Recomendações da indústria**: o que a Anthropic acha que a indústria deveria fazer coletivamente. Inclui padrões de segurança RAND SL-4. Não são compromissos do lado da Anthropic; são advocacy de política.

A estrutura de dois níveis não estava na v2. Significa que um leitor precisa olhar em qual coluna cada compromisso vive. Uma medida de segurança na coluna "recomendação da indústria" não é promessa da Anthropic; é a esperança da Anthropic.

### O limiar AI R&D-4

Este é o nível de capacidade que o RSP v3.0 nomeia como o próximo limiar importante. Especificamente: um modelo que poderia automatizar uma fração substancial da pesquisa de IA a custo competitivo. Uma vez que a Anthropic acredite que um modelo cruza isso, deve publicar um caso afirmativo identificando riscos de desalinhamento e mitigações antes de continuar escalando.

Claude Opus 4.6 não cruza de acordo com o anúncio v3.0. O documento acrescenta: "afastar isso com confiança está se tornando difícil." Essa formulação importa; concede que o limiar está perto o suficiente para ser uma preocupação ativa, não um limite especulativo.

A Aula 6 (Pesquisa de Alinhamento Automatizada) e a Aula 7 (Auto-Aprimoramento Recursivo) alimentam diretamente este limiar. Pesquisadores de alinhamento automatizados cruzando barreiras de qualidade de pesquisa é evidência de que o limiar AI R&D-4 está se aproximando.

### Frontier Safety Roadmaps e Risk Reports

v3.0 eleva dois tipos de artefatos a documentos permanentes:

- **Frontier Safety Roadmap**: documento prospectivo descrevendo trabalho de segurança planejado, expectativas de capacidade e pesquisa de mitigação.
- **Risk Report**: documento retrospectivo sobre modelos específicos após release, descrevendo capacidade observada e risco residual.

Ambos são públicos. Ambos são atualizados em cadência declarada. A utilidade é: o leitor pode rastrear como o que a Anthropic disse que faria em um Roadmap se compara ao que reporta em um Risk Report.

### Remover a cláusula de pausa

O RSP de 2023 incluía um compromisso explícito de pausa: se um modelo cruzasse limiares de capacidade específicos, o treinamento pausaria até que mitigações estivessem no lugar. v3.0 substitui a pausa explícita por uma formulação mais suave (publicar um caso afirmado, prosseguir se mitigações forem adequadas). SaferAI e outros analistas sinalizaram isso diretamente como a regressão mais forte no novo documento.

O argumento de política para a mudança: limiares quantitativos em 2023 se mostraram inatingíveis por benchmarks de capacidade da era 2026 porque os próprios benchmarks foram reescalonados. O contra-argumento: uma cláusula de pausa em uma política de escala é um dispositivo de compromisso; removê-la remove a credibilidade da política.

### O rebaixamento da SaferAI

SaferAI é uma organização independente que avalia documentos no estilo RSP. Sua avaliação pública: RSP da Anthropic de 2023 pontuou 2.2 (em uma escala onde 4.0 é o melhor RSP atual e 1.0 é nominal). v3.0 pontuou 1.9. Isso moveu a Anthropic de "moderada" para "fraca," juntando-se à OpenAI e DeepMind na categoria fraca.

Fatores do rebaixamento pela SaferAI:
- Limiares qualitativos substituíram quantitativos.
- Compromisso de pausa removido.
- Mitigações do limiar AI R&D-4 são descritas como "caso afirmativo" ao invés de medidas específicas.
- Mecanismos de revisão dependem do Safety Advisory Group da Anthropic, com supervisão independente limitada.

### O que esta aula não é

Esta não é uma aula de conformidade. RSP v3.0 não é uma regulação; nada força a Anthropic a segui-la. A aula é em ler o documento com a especificação e o ceticismo que merece. Políticas de escala são o sinal público principal que laboratórios de fronteira emitem sobre postura de risco catastrófico. Lá-las bem é uma habilidade prática para qualquer pessoa cujo trabalho dependa de capacidades de fronteira.

## Use

`code/main.py` implementa uma pequena engine de decisão que espelha a forma de avaliação de limiar do RSP: dado um modelo candidato e um conjunto de medições de capacidade, retornar se o limiar AI R&D-4 foi cruzado, as seções de caso afirmativo necessárias, e se o deploy pode prosseguir. É intencionalmente simples; o ponto é tornar a lógica do documento explícita.

## Entregue

`outputs/skill-scaling-policy-review.md` revisa uma política de escala (Anthropic, OpenAI, DeepMind ou interna) contra a referência v3.0: estrutura de dois níveis, limiares, compromissos de pausa, revisão independente.

## Exercícios

1. Rode `code/main.py`. Alimente três modelos sintéticos em diferentes níveis de capacidade. Confirme que o avaliador de limiar se comporta como esperado e produz o template correto de caso afirmativo.

2. Leia o RSP v3.0 completo (32 páginas). Identifique cada compromisso que vive no nível de "recomendação da indústria." Quais desses compromissos teriam sido "unilateral da Anthropic" na v2?

3. Leia a metodologia de avaliação de RSP da SaferAI. Reproduza a nota de 1.9 para v3.0 aplicando sua rubrica ao documento. Qual linha da rubrica mais contribuiu para o rebaixamento?

4. O compromisso de pausa de 2023 foi removido. Proponha um compromisso substituto que preserve a credibilidade da política enquanto reconhece o problema de reescalonamento de benchmarks de 2026.

5. Compare o RSP v3.0 com o Preparedness Framework v2 da OpenAI (Aula 20). Escolha uma área onde v3.0 é mais forte. Escolha uma área onde o Preparedness Framework é mais forte.

## Termos-Chave

| Termo | O que dizem | O que significa de verdade |
|---|---|---|
| RSP | "Política de escala da Anthropic" | Responsible Scaling Policy; v3.0 em vigor desde 24/fev/2026 |
| AI R&D-4 | "Limiar de automação de pesquisa" | Capacidade de automatizar pesquisa substancial de IA a custo competitivo |
| Caso afirmativo | "Justificativa de segurança" | Argumento publicado de que riscos foram identificados e mitigações adequadas |
| Frontier Safety Roadmap | "Plano prospectivo" | Documento permanente sobre trabalho de segurança planejado e capacidades esperadas |
| Risk Report | "Retrospectiva de um modelo" | Documento permanente sobre capacidade observada e risco residual após release |
| Mitigação em dois níveis | "Unilateral vs indústria" | Compromissos da Anthropic vs recomendações da indústria, separados |
| Compromisso de pausa | "Cláusula de 2023" | Promessa explícita de pausar treinamento; removida em v3.0 |
| Avaliação SaferAI | "Nota RSP independente" | Rubrica de terceiros; v3.0 pontuou 1.9 (v2 foi 2.2) |

## Leituras Adicionais

- [Anthropic — Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) — a política completa de 32 páginas.
- [Anthropic — RSP v3.0 announcement](https://www.anthropic.com/news/responsible-scaling-policy-v3) — resumo das mudanças da v2.
- [Anthropic — Frontier Safety Roadmap](https://www.anthropic.com/research/frontier-safety) — documento permanente vinculado ao RSP v3.0.
- [Anthropic — Risk Report: Claude Opus 4.6](https://www.anthropic.com/research/risk-report-claude-opus-4-6) — retrospectiva sobre o modelo de fronteira atual.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — conecta AI R&D-4 à autonomia medida.
