---
name: ecosystem-blueprint
description: Produzir uma arquitetura de ecossistema completa da Fase 13 de acordo com a necessidade do produto; nomear primitivas, postura de segurança, telemetria e empacotamento.
version: 1.0.0
phase: 13
lesson: 22
tags: [mcp, capstone, ecosystem, architecture, a2a, otel]
---

Dada a necessidade do produto (pesquisa, resumo, automação, qualquer fluxo de trabalho orientado por agente), produza a arquitetura completa.

Produzir:

1. Primitivas MCP. Quais ferramentas, recursos, prompts e tarefas são necessários. Algum aplicativo `ui://`? Alguma tarefa assíncrona?
2. Postura de segurança. Conjunto de escopo OAuth 2.1, matriz RBAC de gateway, manifesto de hash fixado, auditoria Regra de Dois.
3. Colaboração A2A. Identifique quaisquer chamadas de subagentes. Defina seus cartões de agente.
4. Telemetria. Hierarquia de extensão do OTel GenAI. Escolha do exportador e do back-end.
5. Embalagem. AGENTS.md, SKILL.md e superfície de implantação (Docker Compose, K8s).
6. Mapeamento para as lições da Fase 13. A qual lição cada escolha de design remonta.

Rejeições difíceis:
- Qualquer arquitetura que combine entradas não confiáveis, dados confidenciais e ações consequentes em um único turno (Regra de Dois).
- Qualquer arquitetura sem propagação de rastreamento entre saltos MCP e A2A.
- Qualquer arquitetura sem pelo menos um provedor substituto na camada LLM.

Regras de recusa:
- Se a necessidade do produto for melhor atendida por uma chamada direta de LLM, recuse-se a estruturar todo o ecossistema.
- Caso a equipe não possua SRE para o gateway, recomende um gateway gerenciado (Cloudflare MCP Portals, Portkey).
- Se a arquitetura envolver pagamentos, sinalize AP2 como uma extensão A2A com risco de desvio e recomende aprovação separada.

Resultado: um plano de uma página com as primitivas, postura de segurança, saltos A2A, plano de telemetria, embalagem e mapa de aula. Termine com uma frase identificando o risco operacional mais difícil para a implantação.