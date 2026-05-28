---
name: vllm-stack-decider
description: Decida o layout de implantação do vLLM — gráfico Helm da pilha de produção, descarregamento de KV (CPU nativa ou LMCache), integração de roteador/observabilidade — de acordo com a carga de trabalho e o tamanho da frota.
version: 1.0.0
phase: 17
lesson: 18
tags: [vllm, production-stack, lmcache, kv-offload, connector-api]
---

Dada a carga de trabalho (formato do prompt, simultaneidade, padrão de reutilização de prefixo), frota (mecanismos, tipo de GPU) e contexto operacional (nativo do Kubernetes, multilocatário, orçamento), produza um plano de pilha vLLM.

Produzir:

1. Pilha. Use o gráfico Helm da pilha de produção vLLM (recomendado para novas implantações) ou crie o seu próprio. Indicar quais os operadores/CRD aplicáveis.
2. Descarga de KV. Escolha:
   - Nenhum (prompts curtos, baixa simultaneidade — a sobrecarga excede o benefício).
   - Descarregamento de CPU vLLM nativo (pressão HBM monomotor, simples).
   - Conector LMCache (reutilização de prefixo multimecanismo, prompts compartilhados com preempção pesada ou multilocatário).
3. Monitoramento da utilização do HBM. Defina `--gpu-memory-utilization` com altura livre; alerta em 92%+ sustentado como um sinal de pré-preempção.
4. Integração do roteador. Roteador com reconhecimento de cache (Fase 17 · 11). Confirme o canal de eventos KV configurado.
5. Observabilidade. Rascunho do Prometheus por mecanismo, atributos OTel GenAI (Fase 17 · 13), modelo de painel Grafana da pilha de produção.
6. Impacto esperado. Quantifique o ganho de rendimento esperado versus a corrente — faça referência ao formato de benchmark 16x H100 (LMCache ajuda quando a pegada KV excede HBM).

Rejeições difíceis:
- Implantação do LMCache sem prefixos compartilhados ou preempção. Recusar – despesas gerais, sem benefício.
- Executando vLLM sem monitoramento de pressão HBM. Recuse – a primeira preempção será uma surpresa.
- Rolar manualmente a pilha de produção quando o gráfico do Helm cobre o caso de uso. Recuse – reinvente o custo.

Regras de recusa:
- Se a frota tiver <2 motores, recuse o LMCache — a reutilização entre motores é o ponto; uso de motor único nativo.
- Se a carga de trabalho tiver prompts < 1K tokens e < 100 simultaneidade, recuse qualquer tipo de descarregamento – o espaço livre da HBM é suficiente.
- Se a equipe não tiver capacidade K8s, recuse a pilha de produção – comece com um vLLM monomotor + proxy simples.

Resultado: uma pilha de nomenclatura de plano de uma página, escolha de descarregamento KV, monitoramento HBM, integração de roteador, observabilidade, impacto esperado. Termine com o portão único: utilização HBM P99 nas últimas 24h.