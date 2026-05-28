---
name: devops-agent
description: Crie um agente de solução de problemas do Kubernetes que percorre um gráfico de conhecimento do cluster, classifica as causas raiz e controla todas as correções por meio do Slack.
version: 1.0.0
phase: 19
lesson: 06
tags: [capstone, devops, sre, kubernetes, langgraph, fastmcp, aiops]
---

Dado um cluster K8s e uma fonte de alerta (PagerDuty ou Alertmanager), crie um agente que produza hipóteses classificadas de causa raiz em menos de cinco minutos e bloqueie todas as correções por meio de um cartão de aprovação do Slack.

Plano de construção:

1. Ingerir métricas de estado de kube em Neo4j ou kuzu a cada 30 anos. Crie um gráfico de pods, implantações, serviços, nós, PVCs, HPAs, além de bordas de sobreposição de telemetria para fontes Prometheus, Loki e Tempo.
2. Configure um receptor de webhook FastAPI para PagerDuty e Alertmanager.
3. Exponha ferramentas somente leitura por meio do FastMCP com transporte StreamableHTTP: kubectl get/describe, promql, logql, traceql.
4. Construir um agente de causa raiz LangGraph com três nós: `sample` (telemetria pull 15m), `walk` (vizinhos do gráfico transversal), `hypothesize` (classificar candidatos por recência × especificidade × contagem de citações).
5. Publique as três hipóteses mais bem classificadas com visualização do caminho do gráfico no Slack com botões de aprovação.
6. Coloque ferramentas destrutivas (escala, reversão, exclusão) em um servidor FastMCP separado, atrás de um token de aprovação que o agente obtém somente após a aprovação do Slack.
7. Mantenha um registro de auditoria somente para anexos: cada comando *considerado*, seja aprovado, seja executado, quem aprovou.
8. Crie 20 cenários de incidentes sintéticos (OOMKill, DNS flap, HPA thrash, preenchimento de PVC, vizinho barulhento, sidecar defeituoso, implementação incorreta do ConfigMap, rotação de certificado, espera de extração de imagem, falha de sonda e mais 10). Pontue o agente na precisão da RCA e no tempo para elaboração de hipóteses.

Rubrica de avaliação:

| Peso | Critério | Medição |
|:-:|---|---|
| 25 | Precisão RCA no conjunto de cenários | Pelo menos 80% corrigem a causa raiz em 20 incidentes sintéticos |
| 20 | Segurança | O guarda de ação destrutiva nunca dispara sem a aprovação do Slack no log de auditoria |
| 20 | Tempo para hipótese | p50 menos de 5 minutos do alerta ao briefing do Slack |
| 20 | Explicabilidade | Cada hipótese possui caminhos gráficos e citações de telemetria |
| 15 | Completude da integração | PagerDuty, Slack, ArgoCD, Prometheus trabalhando de ponta a ponta |

Rejeições difíceis:

- Agentes com um único servidor MCP que mistura ferramentas somente leitura e destrutivas.
- Qualquer RCA produzida sem citações de telemetria. Hipóteses não citadas devem ser rejeitadas.
- Logs de auditoria que registram apenas execuções. Eles devem registrar todos os comandos considerados.
- Reivindicações de precisão sem executar o agente contra o conjunto de 20 cenários com sementes.

Regras de recusa:

- Recuse-se a remediar sem a aprovação do Slack de um atendente humano. Mesmo que a hipótese seja óbvia.
- Recuse-se a expor `kubectl exec`, `kubectl port-forward` ou qualquer ferramenta interativa por meio do MCP somente leitura. Estes têm efeitos destrutivos.
- Recuse-se a aplicar correções em lote em diversas implantações sem cartões de aprovação por implantação.

Saída: um repositório contendo o receptor FastAPI, o agente LangGraph, os servidores MCP somente leitura e destrutivos, a integração do Slack, o conjunto de testes de 20 cenários, uma comparação lado a lado com o AWS DevOps Agent em três incidentes compartilhados e um resumo sobre comandos quase perdidos (o que o agente *considerou* mas não executou) durante uma janela de observação de uma semana.