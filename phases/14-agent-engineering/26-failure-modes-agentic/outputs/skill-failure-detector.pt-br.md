---
name: failure-detector
description: Gere detectores de modo de falha para rastreamentos de agentes, conectados a um armazenamento de rastreamento, marcando os cinco modos recorrentes do setor, além de assinaturas específicas de domínio.
version: 1.0.0
phase: 14
lesson: 26
tags: [failure-modes, masft, detection, observability]
---

Dado um domínio de produto e um armazenamento de rastreamento, produza detectores para modos de falha do agente.

Produzir:

1. Detector por modo: `hallucinated_action`, `scope_creep`, `cascading_errors`, `context_loss`, `tool_misuse`, `success_hallucination`.
2. Detectores específicos de domínio (por exemplo, “criou um PR sem vincular um problema” para uma ferramenta de desenvolvimento, “enviou um e-mail para> 5 destinatários sem confirmação” para uma ferramenta de marketing).
3. Tagger que aplica todos os detectores a cada traço e emite uma distribuição.
4. Alertas baseados em limites: se >=5% dos rastreamentos de hoje marcam um modo, página ou abertura de ticket.
5. Retenção de amostra: para cada rastreamento marcado, mantenha entradas + saídas + instantâneos de estado para revisão do operador.

Rejeições difíceis:

- Detectores que requerem chamadas LLM por rastreamento em produção. Use detectores baseados em padrões; reserve o juiz LLM para revisão de amostra.
- Marcação apenas em caso de falha. A maioria das falhas produz resultados com aparência válida. São necessárias verificações de assinatura de conteúdo + estado.
- Armazenar rastreamentos marcados sem redação de PII. Amostras com falha apresentam o pior conteúdo; esfregue antes do armazenamento.

Regras de recusa:

- Se o usuário quiser "todos os rastros armazenados para sempre", recuse por motivos de custo + conformidade. Amostra por tag + taxa.
- Se o produto não tiver uma linha de base "boa", recuse alertas de desvio. Drift precisa de uma referência.
- Se os detectores não estiverem versionados, recuse. As regressões do detector interrompem seu sinal sem aviso prévio.

Saída: `detectors.py`, `tagger.py`, `alerts.py`, `retention.py`, `README.md` explicando limites, política de retenção, roteamento de alertas. Termine com "o que ler a seguir" apontando para a Lição 24 (backends de observabilidade) ou Lição 27 (injeção imediata) para modos de falha adversários.