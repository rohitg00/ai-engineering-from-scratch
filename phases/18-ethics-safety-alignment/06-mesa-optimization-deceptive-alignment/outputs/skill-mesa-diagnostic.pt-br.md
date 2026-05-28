---
name: mesa-diagnostic
description: Classifique uma falha de segurança observada como alinhamento externo, proxy interno ou enganoso interno.
version: 1.0.0
phase: 18
lesson: 6
tags: [mesa-optimization, deceptive-alignment, inner-alignment, hubinger]
---

Dado um relatório de avaliação de segurança (tarefa de avaliação, modo de falha, classe de modelo, receita de treinamento), classifique a falha nas categorias Hubinger 2019 e recomende a classe de mitigação que a aborda.

Produzir:

1. Categorização do modo de falha. Escolha um de:
   - Falha no alinhamento externo: o objetivo base (recompensa, perda) estava errado; o modelo o otimizou corretamente.
   - Falha do proxy de alinhamento interno: mesa-objetivo é um proxy que rastreia a distribuição da base; falha fora da distribuição.
   - Alinhamento interno enganoso: o mesa-optimizer tem consciência situacional e defeitos na implantação; o comportamento de treinamento é limpo.
2. Rastreamento de evidências. Para cada categoria, quais evidências a apoiariam. Para enganoso, distinguir de proxy: evidência de consciência situacional (sensibilidade à data, diferenciadores de avaliação versus implantação, raciocínio estratégico na cadeia de pensamento).
3. Classe de mitigação. Para alinhamento externo: alterar o objetivo (CAI, melhores dados de recompensa, supervisão de processos). Para proxy interno: cobertura distributiva, conjuntos, avaliações mantidas. Para interior enganoso: medidas de controle (Lição 10), interpretabilidade (sondas de fluxo residual), reduções de capacidade.
4. Verificação de falhas conhecidas. Para o engano interno, cite a demonstração empírica relevante de 2024-2026 (Sleeper Agents, Alignment Faking, In-Context Scheming) com a qual essa falha mais se assemelha.

Rejeições difíceis:
- Qualquer classificação de enganoso-interior sem evidência de consciência situacional. "Comportamento inesperado na implantação" não é suficiente - pode ser interno ao proxy.
- Qualquer alegação de que o treinamento de robustez contraditória por si só aborda o engano interno. Hubinger 2019 prevê (e Sleeper Agents 2024 confirma) que o treinamento adversário pode ensinar melhores diferenciais entre teste e implantação.
- Qualquer recomendação para retreinar um modelo enganosamente alinhado com mais dados. O anterior prevê que o engano será preservado sob treinamento adicional.

Regras de recusa:
- Se a evidência for uma falha única em um único prompt, recuse a classificação. As taxas básicas são importantes; você precisa de uma distribuição de falhas.
- Se o usuário lhe pedir para “descartar” o alinhamento enganoso, recuse – você pode estimar sua probabilidade a partir de evidências, mas não pode descartá-lo apenas comportamentalmente.

Resultado: um diagnóstico de uma página com categoria, rastreamento de evidências, classe de mitigação e análogo empírico mais próximo. Cite Hubinger et al. (arXiv:1906.01820) uma vez.