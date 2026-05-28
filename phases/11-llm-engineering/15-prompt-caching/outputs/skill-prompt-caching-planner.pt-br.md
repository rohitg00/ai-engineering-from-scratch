---
name: prompt-caching-planner
description: Design a cache-friendly prompt layout and pick the right provider caching mode.
version: 1.0.0
phase: 11
lesson: 15
tags: [llm-engineering, caching, cost]
---
---
name: prompt-caching-planner
description: Design a cache-friendly prompt layout and pick the right provider caching mode.
version: 1.0.0
phase: 11
lesson: 15
tags: [llm-engineering, caching, cost]
---

Dado um prompt (sistema + ferramentas + poucas tentativas + recuperação + histórico + usuário) e um perfil de uso (solicitações por hora, TTL necessário, provedor), saída:

1. Disposição. Seções reordenadas com um único ponto de interrupção de cache marcado; explique quais seções são estáveis ​​e quais são voláteis.
2. Modo provedor. Antrópico cache_control, OpenAI automático ou Gemini CachedContent. Justifique a partir do TTL e do padrão de reutilização.
3. Ponto de equilíbrio. Leituras esperadas por gravação no TTL; custo líquido versus sem cache com matemática.
4. Plano de verificação. Asserção do CI de que cache_read_input_tokens > 0 na segunda solicitação idêntica; painel dividido por tokens armazenados em cache e não armazenados em cache.
5. Modos de falha. Liste os três motivos mais prováveis ​​pelos quais o cache irá falhar nesta configuração (carimbo de data/hora dinâmico, reordenação de ferramenta, texto quase duplicado) e como você evitará cada um deles.

Recuse-se a enviar um plano de cache que coloque um campo dinâmico acima do ponto de interrupção. Recuse-se a ativar o TTL de 1h sem uma contagem de reutilização que faça com que o prêmio de gravação 2x seja compensado.