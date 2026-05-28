---
name: reflexion-buffer
description: Mantenha um buffer de memória episódica de reflexões para RL verbal com TTL, desduplicação e escopo com escopo.
version: 1.0.0
phase: 14
lesson: 03
tags: [reflexion, episodic-memory, self-healing, verbal-rl, sleep-time]
---

Dada uma classe de tarefa (tipo repetido de execução de agente - por exemplo, "refatorar uma função", "fechar um ticket de suporte"), mantenha um buffer de memória episódica de reflexões. Cada reflexão registra um modo de falha e o insight corretivo em linguagem natural. O buffer é anexado à próxima tentativa da mesma classe de tarefa.

Produzir:

1. Captura de reflexão. Depois que um teste terminar com uma pontuação do avaliador abaixo do limite, emita uma reflexão de uma linha no formato "Não consegui fazer X porque Y; da próxima vez, Z". Descarte reflexões sobre falhas externas (rede, upstream 500s), a menos que sejam reproduzíveis.
2. TTL e desduplicação. As reflexões expiram após N tentativas por padrão (10 sugestões). Colapso de duplicatas exatas. Quase duplicatas (> 0,9 cosseno em um modelo de incorporação pequeno ou substring compartilhada> = 80%) mantêm apenas as mais recentes.
3. Política de escopo. Três escopos: classe de tarefa (por nome de tarefa), usuário (em tarefas para o mesmo usuário), agente (em todos os usuários). O padrão é classe de tarefa. Escale para o escopo do usuário somente se a reflexão se referir a preferências específicas do usuário; nunca escale automaticamente para o escopo do agente.
4. Compactação. Quando o buffer exceder o orçamento, execute a compactação do tempo de suspensão: cluster quase duplicado, resumido, mesclado. A compactação sai do caminho ativo — não atrase a resposta do agente primário.
5. Integração imediata. Emita um único bloco intitulado "O que aprendi em testes anteriores" com uma lista com marcadores. Limite de 6 itens no prompt; overflow vai para um item de resumo separado ("... e 4 reflexões mais antigas sobre tempos limite").

Rejeições difíceis:

- Escrever reflexões como “tenha mais cuidado na próxima vez”. Isso não é acionável. Execute novamente o refletor com um aviso que forçará uma instrução concreta na próxima vez.
- Expiração de reflexões com base no tempo do relógio em vez da contagem de teste. O TTL deve ter escopo de teste, não de tempo, para execuções reproduzíveis offline.
- Armazenar reflexões que fazem referência a segredos (chaves de API, tokens, PII). Rejeite com um erro de classe específico "contém segredo" antes de confirmar no buffer.

Regras de recusa:

- Se nenhum avaliador estiver contratado, recuse e recomende a Lição 05 (Auto-Refinamento/CRITICA) — a reflexão requer um sinal, não um pressentimento.
- Se a classe da tarefa for única (nunca se repete), recuse; a memória episódica não faz nada por uma tarefa que nunca se repete.

Saída: um arquivo de buffer estruturado (JSON com objetos de reflexão: ID de teste, classe de tarefa, escopo, texto, criado_at, ttl_remaining), um bloco de prompt para o próximo teste e um relatório de "reflexões obsoletas" listando entradas que expirarão em breve.

Termine com uma nota "o que ler a seguir" apontando para a Lição 06 (compactação de contexto) se o buffer continuar atingindo seu limite, ou para a Lição 08 (Letta sleep-time computing) para mover a compactação para fora do caminho ativo.