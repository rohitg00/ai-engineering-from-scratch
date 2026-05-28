---
name: fairness-criterion
description: Identifique qual critério de justiça uma reivindicação invoca e audite as suposições associadas.
version: 1.0.0
phase: 18
lesson: 21
tags: [fairness, demographic-parity, equalized-odds, counterfactual-fairness, impossibility]
---

Dada uma afirmação ou política de justiça, identifique qual o critério que está a ser invocado, de que pressupostos a afirmação depende e o que os teoremas de impossibilidade implicam para os restantes critérios.

Produzir:

1. Identificação de critérios. Rotule a afirmação como tendo como alvo: paridade demográfica, probabilidades equalizadas, igualdade de precisão de uso condicional, justiça individual, justiça contrafactual. Reivindicações ambíguas devem ser resolvidas antes de prosseguir.
2. Auditoria de taxa básica. Quais são as taxas básicas por grupo na implantação? Sob taxas básicas desiguais, aplica-se a impossibilidade de Chouldechova / KMR 2017: nenhum modelo satisfaz todos os três critérios de grupo.
3. Dependência causal-DAG. Se a alegação for de justiça contrafactual, qual é o DAG causal? A justiça contrafactual só é tão justificada quanto o DAG. A falta de um DAG invalida a reivindicação.
4. Métrica de similaridade. Se a afirmação for justiça individual, qual é a métrica de similaridade d? A escolha é específica da tarefa e é uma decisão política, não estatística.
5. Legalidade da intervenção. Se a afirmação utilizar raciocínio contrafactual, estão envolvidas intervenções em atributos protegidos? Em caso afirmativo, considere retroceder nos contrafactuais (arXiv:2401.13935) para evitar questões jurídicas.

Rejeições difíceis:
- Qualquer afirmação “justa” sem identificação de critérios.
- Qualquer reivindicação de “todos os critérios de justiça satisfeitos” sob taxas básicas desiguais sem reconhecer Chouldechova/KMR 2017.
- Qualquer alegação de justiça contrafactual sem um DAG causal publicado.

Regras de recusa:
- Se o usuário perguntar qual critério de justiça é “o correto”, recuse a classificação e explique que se trata de uma escolha política.
- Se o usuário perguntar se um modelo é “justo”, recuse a afirmação binária; a justiça é relativa ao critério.

Resultado: uma auditoria de uma página preenchendo as cinco seções acima, sinalizando a impossibilidade, se aplicável, e nomeando a escolha política implícita na reivindicação. Cite Dwork et al. 2012, Kusner et al. 2017, Chouldechova 2017, uma vez cada, conforme apropriado.