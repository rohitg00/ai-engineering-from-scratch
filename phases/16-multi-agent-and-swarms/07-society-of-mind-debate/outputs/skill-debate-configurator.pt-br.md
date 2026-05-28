---
name: debate-configurator
description: Configure a multi-agent debate for a given task, estimating quality gain and token cost before running.
version: 1.0.0
phase: 16
lesson: 07
tags: [multi-agent, debate, society-of-mind, consensus]
---
---
name: debate-configurator
description: Configure a multi-agent debate for a given task, estimating quality gain and token cost before running.
version: 1.0.0
phase: 16
lesson: 07
tags: [multi-agent, debate, society-of-mind, consensus]
---

Dada uma pergunta ou tarefa, produza uma configuração de debate pronta para ser executada em qualquer estrutura de agente (LangGraph, AutoGen, loop personalizado).

Produzir:

1. **Verificação de adequação da tarefa.** Esta tarefa pode ser melhorada por consenso? O debate ajuda no raciocínio, na factualidade e na decomposição; não ajuda tarefas já determinísticas (aritmética, compilação de código) ou puramente generativas (escrita criativa).
2. **Contagem de agentes.** 3, 4 ou 5. Padrão 3; 4+ somente se o custo for insensível e a tarefa precisar de visões mais diversas.
3. **Contagem de rodadas.** 2 ou 3. Padrão 3; raramente mais. Cite Du et al. platô.
4. **Heterogeneidade.** Mesmo modelo base (mais simples, mais barato, com mais erros correlacionados) ou família mista (Llama + Claude + GPT; decorrelaciona; mais caro, precisa de uma camada de roteamento).
5. **Atribuição de papéis.** Simétrico (todos os agentes têm o mesmo papel) versus um adversário (um agente instruído a discordar). O slot adversário é um seguro barato contra cascatas de bajulação.
6. **Método de agregação.** Votação majoritária (respostas discretas), média ponderada (numérica) ou síntese LLM-juiz (aberto).
7. **Estimativa de custo.** N agentes × R rodadas × mediana de tokens por turno. Indique a estimativa em dólares de acordo com os preços atuais do fornecedor.

Rejeições difíceis:

- Qualquer configuração com mais de 5 agentes ou mais de 3 rodadas sem justificativa de custo concreta.
- Debates simétricos apenas sobre tarefas com risco conhecido de bajulação.
- Usar debate para tarefas que possuem um verificador determinístico (compilar, testar, matemática exata) — em vez disso, execute o verificador.

Regras de recusa:

- Se a tarefa for uma simples pesquisa factual, recuse e recomende agente único com recuperação aumentada.
- Se a tarefa for generativa (escrever um poema), recuse — o debate arrasta os resultados para a média.
- Se o usuário não tiver definido um orçamento de token/dólar, recuse e peça um. O debate é de 5 a 15 vezes o custo do agente único.

Saída: resumo de configuração de uma página. Comece com a verificação de adequação da tarefa e termine com a estimativa de custo total.