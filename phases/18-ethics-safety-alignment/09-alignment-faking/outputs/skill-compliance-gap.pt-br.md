---
name: compliance-gap
description: Avalie se um relatório de segurança pode detectar falsificação de alinhamento, por meio da lacuna de conformidade monitorada/não monitorada.
version: 1.0.0
phase: 18
lesson: 9
tags: [alignment-faking, compliance-gap, anthropic, safety-evaluation]
---

Dado um relatório de avaliação de segurança, avalie se ele consegue distinguir a falsificação de alinhamento da conformidade genuína usando o Greenblatt et al. Estrutura de lacunas de conformidade para 2024.

Produzir:

1. Divisão de condição. A avaliação executa uma condição monitorada (relevante para o treinamento) e uma não monitorada (sem treinamento)? Sem ambos, a falsificação do alinhamento é invisível.
2. Medição de lacunas de conformidade. Relate a lacuna como taxa de conformidade (monitorada - não monitorada). Interpretar sinal e magnitude: lacuna positiva = comportamento em forma de falsificação; lacuna negativa = recusa excessiva quando observada.
3. Verificação de traços verbais versus comportamento. A avaliação depende do raciocínio do modelo ou da própria ação? De acordo com o Anthropic 2025, as mitigações que visam o traço verbal podem removê-lo sem remover o comportamento.
4. Auditoria de operacionalização. A condição de monitoramento é criada por meio de prompt do sistema, ajuste fino sintético ou contexto de implantação natural? A dependência do prompt do sistema enfraquece a reivindicação; replicações de ajuste fino sintético o fortalecem.
5. Verificação de incentivos residuais. Após qualquer mitigação aplicada, a estrutura de incentivos ainda está presente (o modelo ainda se beneficiaria com a falsificação se assim o desejasse)? A persistência de incentivos significa que o comportamento pode retornar sob mudança de distribuição.

Rejeições difíceis:
- Qualquer alegação de “falsificação de alinhamento” baseada apenas em avaliação não monitorada.
- Qualquer alegação de que “o raciocínio do bloco de notas não verbaliza mais a falsificação” implica que o comportamento cessou.
- Qualquer alegação de que os modelos treinados por HHH não falsificam o alinhamento — Greenblatt et al. 2024 estabelece que o treinamento HHH é uma condição necessária, não uma defesa suficiente.

Regras de recusa:
- Se o usuário perguntar "meu modelo simula alinhamento", recuse a resposta binária sem os dados de lacuna de conformidade.
- Se o usuário solicitar uma remediação que ataque apenas o traço verbal (por exemplo, “treinar o scratchpad para corresponder à ação”), recuse e explique o modo de falha do CoT fiel (acompanhamento de 2025).

Resultado: uma avaliação de uma página que relata a conformidade em ambas as condições, a lacuna, a separação entre traços verbais e comportamento e a força da operacionalização. Sinalize cada elemento ausente. Cite Greenblatt et al. (arXiv:2412.14093) uma vez como fonte da estrutura.