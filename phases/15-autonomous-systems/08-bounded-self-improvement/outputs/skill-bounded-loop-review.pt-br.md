---
name: bounded-loop-review
description: Audite um loop de autoaperfeiçoamento proposto em relação à pilha de quatro primitivos (invariantes, âncora, multiobjetivo, detecção de regressão).
version: 1.0.0
phase: 15
lesson: 8
tags: [bounded-self-improvement, invariants, alignment-anchor, rsi-safety]
---

Dado um ciclo de autoaperfeiçoamento proposto, compare-o com as quatro primitivas delimitadoras identificadas pelo Workshop RSI do ICLR 2026 e produza uma análise concreta de lacunas.

Produzir:

1. **Inventário invariante.** Liste todos os invariantes que o loop impõe. Para cada um, nomeie (a) o que é verificado, (b) onde a verificação é executada (alcance interno/externo do agente), (c) o que uma violação faz (rejeição definitiva, pausa, somente registro).
2. **Identificação da âncora.** Nomeie a âncora do alinhamento (declaração do objetivo, constituição, descrição da intenção). Indique seu local de armazenamento e verifique se o loop não pode editá-lo. Se não houver âncora, sinalize como ausente.
3. **Eixos multiobjetivos.** Liste todos os eixos que o loop avalia. Confirme que a segurança, a justiça e a robustez estão presentes juntamente com o desempenho. Um loop de eixo único falha nesta verificação.
4. **Política de regressão.** Indique a janela histórica, a tolerância por eixo e o que acontece quando uma queda é detectada. As verificações de confirmação de regressão usam um conjunto de comparação externo, não apenas o histórico interno.
5. **Análise de lacunas.** Para cada primitiva ausente, preveja qual classe de falha surgirá primeiro. Invariantes ausentes → capacidade contrabandeada ou desvio de ferramenta. Âncora faltando → reinterpretação objetiva. Falta multiobjetivo → regressão de segurança mascarando ganho de desempenho. Regressão ausente → perda silenciosa de capacidade.

Rejeições difíceis:
- Qualquer loop com zero invariantes.
- Qualquer loop sem âncora de alinhamento fora da superfície de edição.
- Qualquer loop que otimize uma única pontuação escalar.
- Qualquer loop cuja verificação de regressão lê apenas seu próprio histórico (o loop define "normal").

Regras de recusa:
- Se o usuário tratar "ainda não quebrou" como evidência de segurança, recuse e exija um design de portão explícito antes que qualquer cálculo seja gasto.
- Se o usuário não conseguir produzir a lista de invariantes em 15 minutos, recuse — o loop não possui invariantes.
- Se for proposto que o loop seja executado em produção (afetando usuários reais ou infraestrutura) sem todas as quatro primitivas, recuse e exija primeiro a preparação com monitoramento.

Formato de saída:

Retorne uma avaliação pontuada com:
- **Pontuação invariante** (0-5 com lista explícita)
- **Pontuação âncora** (0-5 com método de armazenamento e verificação)
- **Pontuação multiobjetivo** (0-5 com eixos listados)
- **Pontuação de regressão** (0-5 com tolerância e janela)
- **Análise de lacunas** (primeira falha prevista, plano de mitigação)
- **Prontidão de implantação** (somente produção/preparação/pesquisa)