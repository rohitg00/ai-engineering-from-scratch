---
name: gateway-picker
description: Escolha um gateway de IA (LiteLLM, Portkey, Kong AI, Cloudflare/Vercel) de acordo com escala, orçamento de latência, conformidade, postura operacional e tolerância de preços.
version: 1.0.0
phase: 17
lesson: 19
tags: [ai-gateway, litellm, portkey, kong, cloudflare, vercel, bifrost, fallback, rate-limit, guardrails]
---

Dado o RPS (atual e projetado para 12 meses), orçamento de latência, conformidade (auto-hospedeiro necessário?), necessidade de proteções (redação de PII, detecção de jailbreak, auditoria) e tolerância de preços, produza uma recomendação de gateway.

Produzir:

1. Gateway primário. Dê um nome à ferramenta. Justifique com teto RPS, sobrecarga e ajuste de recursos.
2. Cadeia de reserva. Três provedores em ordem; OpenAI → Antrópico → auto-hospedado é canônico. Calcule a disponibilidade esperada.
3. Política de limite de taxa. Janela deslizante recomendada >500 RPS; token-bucket aceitável de outra forma. Camadas por locatário.
4. Guarda-corpos. Chave de portal se for necessário PII/jailbreak; Kong se precisar de balança + guarda-corpos; LiteLLM apenas se for nível de desenvolvimento.
5. Transferência de observabilidade. Aponte para a Fase 17 · 13 escolhas; confirmar o fluxo das convenções OTel GenAI.
6. Migração. Se estiver migrando da integração em nível de aplicativo, implementação gradual (1% canário no gateway, expansão em caso de sucesso).

Rejeições difíceis:
- LiteLLM a >2.000 RPS. Recusar – O benchmark Kong mostra falhas em cascata; migrar primeiro.
- Chave de portal em TTFT P99 < 100 ms SLA. Recuse – a sobrecarga de 30 ms consome muito do orçamento.
- Cloudflare AI Gateway para um cliente local regulamentado. Recusar — ​​somente gerenciado; sem auto-hospedeiro.

Regras de recusa:
- Se a ambigüidade de escala for grande (atual 100 RPS, planejado 2K+ em 6 meses), exija o plano de migração antes de se comprometer com o LiteLLM.
- Se a conformidade exigir SOC 2 Tipo II e o gateway escolhido for somente OSS sem SLA gerenciado, exija o atestado SOC 2 do próprio cliente.
- Se a equipe não tiver Kubernetes e escolher o auto-host Kong, recuse - recomende Kong gerenciado ou Portkey gerenciado.

Resultado: uma decisão de uma página com gateway, cadeia de fallback, política de limite de taxa, postura de proteção, fluxo de observabilidade, plano de migração. Termine com uma métrica: latência do gateway P99 na última hora; alerta sobre violação.