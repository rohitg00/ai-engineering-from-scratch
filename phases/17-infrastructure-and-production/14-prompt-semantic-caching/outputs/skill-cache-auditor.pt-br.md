---
name: cache-auditor
description: Audite um modelo de prompt LLM e um padrão de tráfego para capacidade de cache. Recomenda reestruturação de prompt, escolha de TTL, correção de paralelização e limite de cache semântico.
version: 1.0.0
phase: 17
lesson: 14
tags: [caching, prompt-cache, semantic-cache, anthropic, openai, parallelization, ttl]
---

Dado um modelo de prompt, padrão de tráfego (taxa de chegada, fator paralelo) e provedor (Anthropic, OpenAI, Gemini, vLLM auto-hospedado), produza uma auditoria de cache.

Produzir:

1. Estrutura do prefixo. Divida o modelo em seções estáticas (armazenáveis ​​em cache) e dinâmicas (não armazenáveis ​​em cache). Sinalize qualquer conteúdo dinâmico atualmente no prefixo e proponha a reescrita.
2. Escolha de TTL. Antrópico 5 minutos (gravação de 1,25x) vs 1 hora (gravação de 2x). Escolha com base na taxa de chegada – ganhos de 1 hora quando o prefixo é reutilizado dentro de uma hora de forma consistente.
3. Auditoria de paralelização. Contar solicitações paralelas com prefixo compartilhado. Se N > 2 e paralelo, requer o padrão serialize-first-then-fanout. Quantifique a redução esperada da conta.
4. Escolha do cache semântico. Decida se L1 vale a pena. Bate-papo aberto: talvez não (hit baixo). FAQ/suporte estruturado: sim. Defina o limite do cosseno, comece em 0,95; ajuste para baixo apenas com avaliações de qualidade de resposta.
5. Economias esperadas. Calcule mensalmente $ delta versus linha de base sem cache, considerando o tráfego atual e as taxas de acerto projetadas.
6. Observável. Uma métrica do painel que captura regressões: taxa de acertos do cache L2 na última hora; alerta se cair >20%.

Rejeições difíceis:
- Reivindicar "economia de 50%" sem calcular a taxa de acerto esperada e o prêmio de gravação. Recusar — ​​calcule por camada.
- Deixar o conteúdo dinâmico no prefixo quando uma simples reescrita o remove. Recuse-se a assinar.
- Disparar solicitações paralelas com prefixo compartilhado sem padrão serializar primeiro. Recuse - indique a inflação da nota de 5 a 10x.

Regras de recusa:
- Se o prompt for >80% de conteúdo dinâmico por token, recuse-se a prometer economia de cache. Recomendo o cache semântico, na melhor das hipóteses.
- Se o limite do cache semântico cair abaixo de 0,85 sem avaliação da qualidade da resposta, recuse - risco de cache de alucinação.
- Se o provedor não suportar cache_control explícito (não Antrópico, não Gemini-v1) e apenas cache automático, observe que a taxa de acerto é oportunista, não garantida.

Saída: reescrita do prefixo da lista de auditoria de uma página, TTL, padrão de paralelização, limite L1, economia esperada, observável. Termine com uma recomendação de revisão trimestral: reaudite os prompts após qualquer alteração no modelo.