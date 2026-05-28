---
name: benchmark-reader
description: Leia com ceticismo uma afirmação de benchmark multiagente. Classifica a afirmação com base na seleção de benchmark, contaminação, linhas de base, significância estatística, diversidade de tarefas e divulgação de custos.
version: 1.0.0
phase: 16
lesson: 24
tags: [multi-agent, benchmarks, evaluation, SWE-bench, MARBLE]
---

Dada uma afirmação publicada ou interna de desempenho de benchmark multiagente, avalie a afirmação e ressalte as advertências.

Produzir:

1. **Benchmark + identificação de divisão.** Qual benchmark (MARBLE, COMMA, MedAgentBoard, AgentArch, SWE-bench Pro, SWE-bench Verified, customizado)? Qual divisão (completa, resistente, limpa de contaminação)? Divisões desconhecidas são desqualificantes.
2. **Status de contaminação.** O valor de referência pós-treinamento é o ponto de corte para o modelo em teste? Se o benchmark for anterior ao limite de treinamento, sinalize o risco de contaminação e desconte a alegação.
3. **Qualidade da linha de base.** Vs LLM único, vs aleatório, vs trabalho anterior com vários agentes. Vs mesmo sistema não ajustado não conta; é uma ablação, não uma linha de base.
4. **Significância estatística.** N ensaios, intervalo de confiança ou erro padrão, valor p ou equivalente. As alegações sem estatísticas sobre N < 50 ensaios são insuficientemente apoiadas.
5. **Diversidade de tarefas.** Uma tarefa, um domínio ou vários? As afirmações de tarefa única não implicam generalização.
6. **Divulgação de custos.** Tokens por tarefa, relógio de parede por tarefa, custo em dólares por tarefa. Uma solução de 90% a um custo 20x é uma decisão de negócios; sem custo, a reivindicação está incompleta.
7. **Nota por carta + veredicto de uma frase.**

   - **R:** Todas as seis verificações foram aprovadas; a afirmação é provavelmente robusta.
   - **B:** Uma fraqueza; a afirmação é plausível com ressalvas observadas.
   - **C:** Dois pontos fracos; a afirmação é sugestiva, mas precisa de replicação.
   - **D:** Três ou mais pontos fracos; a alegação não é evidência.
   - **F:** Problema de desqualificação (contaminação em divisão não revelada, sem estatísticas, sem linha de base).

Rejeições difíceis:

- Reivindicações citando "SWE-bench" sem especificar Verified vs Pro. A diferença de mais de 40 pontos torna estes relatórios ambíguos inaceitáveis.
- Reivindicações sem comparação de linha de base. “Nosso sistema faz X%” é um número, não um resultado.
- Reivindicações baseadas em menos de 20 testes para sistemas multiagentes. A variação é muito alta.
- Reivindicações de custos não declarados para sistemas multiagentes. A taxa de coordenação é material.

Regras de recusa:

- Se o benchmark não estiver disponível publicamente e o usuário não tiver trilha de auditoria interna, a nota não poderá ser atribuída. Recomendamos a liberação de artefatos de avaliação.
- Se a reivindicação for de um artigo atualmente sob revisão por pares (pré-impressão arXiv, não enviado), rebaixe uma nota como precaução até a replicação.
- Se o próprio usuário for o reclamante solicitando uma auditoria, execute a auditoria diretamente; sinalizador quando a reivindicação ainda não está pronta para publicação.

Resultado: um cartão de notas de uma página. Comece com um resumo de uma frase (“Nota: C — boa escolha de benchmark, linhas de base adequadas, mas sem verificação de contaminação e sem divulgação de custos”) e, em seguida, as sete seções acima. Termine com uma lista priorizada de “o que consertar para aumentar a nota”.