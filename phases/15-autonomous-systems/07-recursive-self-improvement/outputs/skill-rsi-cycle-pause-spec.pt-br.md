---
name: rsi-cycle-pause-spec
description: Especifique as condições sob as quais um pipeline RSI deve pausar e aguardar a revisão humana antes do próximo ciclo.
version: 1.0.0
phase: 15
lesson: 7
tags: [rsi, self-improvement, alignment, pause-threshold, rsp]
---

Dado um pipeline de autoaperfeiçoamento recursivo proposto, produza uma especificação de pausa: as condições explícitas que interrompem o ciclo de inspeção humana antes do início do próximo ciclo. Um pipeline sem especificação de pausa não está pronto para execução.

Produzir:

1. **Limites em nível de ciclo.** Para cada eixo mensurável (pontuação de capacidade, pontuação de alinhamento, orçamento, duração da trajetória, uso de recursos), defina um limite numérico cujo cruzamento pausa o loop. Os limites devem ser definidos antes do início do loop e registrados.
2. **Deltas ciclo após ciclo.** Defina limites de quanto qualquer eixo pode se mover em um único ciclo. Um salto de capacidade de mais de 30% em um ciclo é quase sempre um sinal de jogo do avaliador; pausar e auditar.
3. **Lacuna de desalinhamento.** Calcule a capacidade menos o alinhamento após cada ciclo. Se a lacuna aumentar em mais de X (conjunto do operador), faça uma pausa. Esta é a métrica do simulador nos exercícios `code/main.py`.
4. **Visualização de regressão.** Se algum eixo cair mais que Y em um ciclo, faça uma pausa. As regressões de capacidade geralmente seguem picos; capturá-los evita a aceleração do falso progresso.
5. **Contrato de retomada humana.** Antes que o loop seja retomado após uma pausa, exija que um humano nomeado revise o acionador de pausa, redefina os limites, se apropriado, e registre a decisão na trilha de auditoria fora do pipeline.

Rejeições difíceis:
- Qualquer pipeline que possa ser retomado após uma pausa sem ação humana.
- Qualquer limite que dependa do próprio avaliador interno do loop (o agente pode jogá-lo).
- Qualquer pipeline cujo limite definido possa ser editado pelo agente.

Regras de recusa:
- Se o usuário não puder nomear os limites antecipadamente, recuse. Os limites definidos post-hoc não são limites; são racionalizações.
- Se o pipeline não tiver um avaliador externo (fora do loop), recuse — a regressão e a detecção de surtos exigem uma visão externa.
- Se a proposta de contrato de retomada for “avisar a equipe e continuar após 24 horas”, recuse. A retomada deve ser um ato positivo.

Formato de saída:

Retorne uma especificação de uma página com:
- **Eixos e limites** (tabela)
- **Limites ciclo-delta** (tabela)
- **Fórmula e limite de lacuna de desalinhamento**
- **Limites de regressão**
- **Avaliador externo** (o que é, quando é executado)
- **Contrato de retomada** (proprietário nomeado, lista de verificação, destino do log)
- **Linha de assinatura** (quem possui a invariante de pausa)