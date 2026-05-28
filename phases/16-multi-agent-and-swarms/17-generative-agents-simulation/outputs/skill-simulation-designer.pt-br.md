---
name: simulation-designer
description: Projete uma simulação de agente generativo (estilo Smallville) para um determinado cenário. Especifica esquema de memória, cadência de reflexão, horizonte de plano, restrições espaciais/sociais e métricas de avaliação.
version: 1.0.0
phase: 16
lesson: 17
tags: [multi-agent, simulation, generative-agents, emergence, memory]
---

Dado um cenário que requer comportamento emergente de uma população de agentes (simulação social, NPCs de jogos, ensaio de políticas, dinâmica de mercado), projete a simulação.

Produzir:

1. **Tamanho e heterogeneidade da população.** N agentes; que compartilham um modelo básico versus diferentes; alertar as famílias; distribuição de papéis. Smallville utilizou 25 agentes homogêneos com personas individualizadas; populações maiores se beneficiam da heterogeneidade.
2. **Esquema de memória.** Campos por entrada: `(ts, kind, content, importance, embedding_ref, source_ids)`. Constante de decaimento de recência; procedimento de pontuação de importância; métrica de relevância (cosseno com incorporação do modelo X). Política de retenção para compactação.
3. **Cadência de reflexão.** Gatilho: soma da importância não processada > limite, ou cada N observações, ou tick periódico. Número de reflexões por gatilho. Modelo de prompt de reflexão.
4. **Planejar horizonte.** Dia/hora/níveis de ação. Quais são obrigatórios; qual opcional. Gatilho de revisão: uma nova observação com importância > limite que contradiz o plano ativo.
5. **Modelo mundial.** Grade espacial, gráfico social, restrições de recursos. O que constitui uma observação (linha de visão, conversa, notificação). Quais restrições normativas a arquitetura NÃO aprende e devem ser codificadas explicitamente (limites de capacidade, horários fechados, espaços privados).
6. **Metas iniciais.** Quais agentes são propagados com quais prioridades. Metas sobrepostas que podem competir; objetivos não concorrentes que devem coexistir.
7. **Orçamento.** Chamadas LLM por tick por agente (observar + recuperar + refletir + planejar + agir). Tokens esperados por tick por agente. Custo total de simulação para ticks T.
8. **Métrica de avaliação.** Credibilidade (avaliador humano), taxa de cumprimento de metas, eventos de coordenação contados, violações de normas espaciais como um sinal de falha.

Rejeições difíceis:

- Projetos sem codificação explícita de normas espaciais/sociais. A arquitetura irá violá-los (falhas de loja fechada e banheiro único do Parque 2023).
- Projetos com memória mutável. A memória deve ser somente anexada; correções são novas entradas.
- Projetos que refletem a cada tick. Isto é ineficiente em termos orçamentais; a reflexão é cara e os gatilhos devem ser baseados em limites.
- Simulações em grande número N (> 50) sem estratégia de compactação de memória. O custo de recuperação aumenta com o comprimento do fluxo.

Regras de recusa:

- Se o cenário exigir *execução de tarefa* emergente em vez de *comportamento social* emergente, recomende os padrões supervisor/funções/primitivos (Fase 16 · 05-08). Smallville é para simulação social.
- Se o orçamento permitir < 100 chamadas LLM por tick total, recomende N = 3-5 com interações densas em vez de populações maiores.
- Se o cenário não se beneficiar da emergência (tarefa com script rígido), recomende agente único + ferramentas.

Resultado: um resumo do design de uma página. Comece com um resumo de uma única frase ("Simulação no estilo Smallville: 15 agentes heterogêneos, reflexão na soma de importância > 120, horizonte de plano de 3 níveis, grade espacial com restrições de capacidade, medida pela credibilidade + eventos de coordenação."), depois as oito seções acima. Termine com os comportamentos emergentes esperados e os três primeiros modos de falha a serem observados.