---
name: ai-sre-plan
description: Projete uma implementação de AI SRE para uma equipe: arquitetura de triagem multiagente, runbooks estruturados, avaliação contraditória, correção automática restrita e postura de detecção preditiva.
version: 1.0.0
phase: 17
lesson: 23
tags: [ai-sre, multi-agent, runbooks, auto-remediation, adversarial-eval, datadog-bits-ai, neubird, predictive]
---

Dado o tamanho da equipe, o volume de incidentes, a maturidade da observabilidade e a tolerância ao risco, produza um plano AI SRE.

Produzir:

1. Arquitetura. Multiagente: supervisor + agente de log + agente métrico + agente runbook + portão humano. Combine agentes especializados com fontes de dados existentes (Datadog, Grafana, Loki, Confluence).
2. Transformação de runbook. Mude do Confluence não estruturado para a marcação estruturada com seções de sintomas/hipóteses/verificação/ação. Versão em git.
3. Escolha do produto. Datadog Bits AI, Agente Azure SRE, NeuBird Hawkeye, Incident.io Autopilot ou DIY.
4. Escopo da correção automática. Conjunto seguro restrito (reiniciar pod, reverter implantação, escalar dentro dos limites). Lista de negações explícita (topologia, código, IAM, banco de dados). Política como código.
5. Avaliação adversária. Especifique a porta de contrato de dois modelos para correção automática. A discordância aumenta.
6. Postura de detecção preditiva. Se estiver considerando (resultado de 89% do MIT), nomeie a política de atuação - pager, pré-drenagem, escala automática - caso contrário, será apenas um painel.

Rejeições difíceis:
- Correção automática sem controle humano em mudanças amplas. Recusar — ​​nomeie explicitamente o conjunto seguro.
- Runbooks não estruturados como base de conhecimento. Recusar – exige redução de versão estruturada e versionada.
- Enquadramento "Configure e esqueça". Recusar - definir explicitamente o que é e o que não é autônomo.

Regras de recusa:
- Se o volume de incidentes for <10/mês, recuse a implementação completa do AI SRE — o custo excede o benefício. Recomendo apenas runbooks estruturados.
- Se a observabilidade da equipe for imatura (registros inpesquisáveis, métricas escassas), recuse — o AI SRE amplifica dados ruins.
- Se a equipe propor “detecção preditiva → correção automática” como primeiro recurso, recuse – analise primeiro a questão da política de atuação.

Resultado: um plano de uma página com arquitetura, plano de runbook, escolha de produto, escopo de correção automática, porta adversária, postura preditiva. Termine com um cronograma de implementação de 12 semanas: semanas 1 a 4 runbooks estruturados, 5 a 8 agentes de triagem, 9 a 12 semanas de correção automática restrita.