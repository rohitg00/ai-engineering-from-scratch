---
name: horizon-interpretation
description: Revise a declaração de horizonte de tempo de um fornecedor e produza uma análise de lacunas entre a declaração de referência e a realidade da implantação.
version: 1.0.0
phase: 15
lesson: 21
tags: [metr, time-horizon, hcast, re-bench, eval-vs-deploy, external-evaluation]
---

Dada a afirmação de horizonte de tempo publicada por um fornecedor (por exemplo, "nosso modelo conclui tarefas de 14 horas com 50% de confiabilidade"), produza uma análise de lacunas que quantifique o delta da realidade de implantação e sinalize quaisquer fraquezas metodológicas.

Produzir:

1. **Auditoria de metodologia.** Identifique o conjunto de tarefas (HCAST, RE-Bench, SWAA ou proprietário). Confirme se o ajuste logístico foi divulgado (inclinação, tamanho da amostra, intervalo de confiança). Um horizonte sem divulgação de metodologia é uma afirmação de marketing.
2. **Ajuste da distribuição de tarefas.** Mapeie a distribuição de tarefas de referência do fornecedor na distribuição de tarefas de produção do usuário. Se eles divergirem materialmente (o fornecedor mede as tarefas SWE, a produção são os fluxos de suporte ao cliente), o número não é transferido.
3. **Lacuna no contexto de avaliação.** Aplique uma lacuna de 10–40% entre o horizonte de referência e a realidade da implantação. Cite o estudo de falsificação de alinhamento da Anthropic 2024 e o Relatório Internacional de Segurança de IA de 2026 sobre jogos em contexto de avaliação. A lacuna real depende do protocolo de avaliação; os jogos são maiores em tarefas não estruturadas.
4. **Lacuna de ferramentas.** As ferramentas de referência são limpas e bem instrumentadas. As ferramentas de produção são mais confusas. Estime um desconto adicional de confiabilidade de 5 a 30%.
5. **Suposição humana no circuito.** Os benchmarks não pressupõem HITL. Agentes de produção com HITL funcionam com maior confiabilidade, mas com menor autonomia. Ajuste a interpretação do horizonte de acordo.

Rejeições difíceis:
- Afirmações Horizon sem metodologia de origem ou tamanho de amostra.
- Afirma que um horizonte de referência prevê a confiabilidade da implantação.
- Fornecedores que citam um número de horizonte de 2025 ou anterior como atual (o tempo de duplicação é de aproximadamente 7 meses; os números de 2025 ficam obsoletos dentro de um ano).
- Tratar um horizonte de 50% como "funcionará na maior parte do tempo" — 50% de confiabilidade é um cara ou coroa.

Regras de recusa:
- Se o fornecedor não divulgar a metodologia, recuse e exija o artigo original ou postagem no blog.
- Se a distribuição do benchmark não se sobrepuser à distribuição da produção, recusar e exigir avaliação interna.
- Se o fornecedor citar horizontes sem auditoria de jogos em seu pipeline de avaliação específico, recuse-se a citar o número como uma previsão de confiabilidade.

Formato de saída:

Retorne um memorando de interpretação do horizonte com:
- **Metodologia de origem** (conjunto, método de ajuste, tamanho da amostra, CI)
- **Sobreposição de distribuição** (benchmark vs produção; % de mapeamento)
- **Estimativa de lacuna do contexto de avaliação** (baixo/médio/alto com justificativa)
- **Estimativa de folga de ferramentas** (baixo/médio/alto)
- **Suposição HITL** (HITL autônomo de estilo de referência versus HITL de produção)
- **Horizonte ajustado para implantação** (horizonte após intervalo e descontos em ferramentas)
- **Veredicto de prontidão** (somente produção/encenação/pesquisa)