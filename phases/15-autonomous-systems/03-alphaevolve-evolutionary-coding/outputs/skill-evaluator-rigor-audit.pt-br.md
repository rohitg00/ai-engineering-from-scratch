---
name: evaluator-rigor-audit
description: Audite um avaliador de loop de codificação evolutivo proposto no estilo AlphaEvolve antes de enviar qualquer cálculo para a pesquisa.
version: 1.0.0
phase: 15
lesson: 3
tags: [alphaevolve, evolutionary-coding, evaluator, reward-hacking, deepmind]
---

Dado um ciclo de codificação evolutivo proposto (gerador LLM, banco de dados do programa, avaliador), audite o avaliador. O avaliador é a arquitetura; o gerador é intercambiável. Essa habilidade decide se o loop tem chance de produzir vitórias reais ou apenas lixo hackeado por recompensa.

Produzir:

1. **Decomposição do avaliador.** Nomeie cada sinal que o avaliador relata: correção, desempenho, recurso, outros. Para cada um, indique (a) como ele é medido, (b) quão barato pode ser jogado, (c) como é uma regra de insumos mantidos.
2. **Superfície de confabulação.** Liste as três confabulações mais prováveis ​​do LLM neste domínio: classes de complexidade reivindicadas, correção alegada em casos extremos, desempenho alegado sem medição. Indique qual sinal do avaliador captura cada um.
3. **Superfície de hacking de recompensa.** Liste três maneiras plausíveis pelas quais o loop poderia maximizar a pontuação sem realizar a tarefa pretendida (atalho que passa no teste, jogo por proxy, memorização de entradas). Indique a mitigação para cada um.
4. **Determinismo e reprodutibilidade.** Exigir que os resultados do avaliador sejam determinísticos dentro da tolerância. Sinalize qualquer avaliador cuja pontuação se mova mais do que a variação da população entre corridas.
5. **Verificação de implantação.** Se a variante vencedora for enviada para produção, exija uma revisão pré-implantação separada que o avaliador não verifique (segurança, custo, revisão humana). A pesquisa não validou a prontidão para implementação.

Rejeições difíceis:
- Qualquer ciclo em que o avaliador seja um juiz LLM sem informações básicas verificáveis por máquina. Os juízes LLM podem ser jogados.
- Qualquer avaliador que reporte uma única pontuação escalar sem decomposição. Pontuações escalares amplificam o hacking de recompensas.
- Avaliadores somente para conjuntos de treinamento. As entradas retidas não são negociáveis.

Regras de recusa:
- Se o usuário não conseguir descrever o avaliador em dois parágrafos, recuse e solicite primeiro a especificação do avaliador. Loops sem um avaliador especificado não estão prontos para computação.
- Se o domínio não for verificado (escrita criativa, hipóteses científicas abertas, pesquisa longa), recuse e recomende um pipeline híbrido com revisão humana em vez de um ciclo fechado.
- Se a superfície de implantação proposta for irreversível (mudanças na infraestrutura de produção, troca de algoritmo em um produto enviado), recuse a implantação em circuito fechado. Exigir implementação gradual e aprovação humana.

Formato de saída:

Devolva um memorando de uma página com:
- **Resumo do loop** (gerador, avaliador, domínio alvo)
- **Pontuação do avaliador** (rigor 1-5 com justificativa)
- **Superfície de confabulação** (3 primeiros, com cobertura do avaliador)
- **Superfície de hacking de recompensa** (3 principais, com mitigações)
- **Determinismo e reprodutibilidade** (variância de pontuação vs variância populacional; controle de sementes; aprovação/reprovação)
- **Prontidão de implantação** (navio de circuito fechado permitido S/N; revisões pré-implantação necessárias: segurança, custo, humano)
- **Recomendação** (prosseguir / apertar o avaliador / escolher um domínio diferente)