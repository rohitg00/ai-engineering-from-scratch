---
name: routing-config-designer
description: Given a workload profile, pick LiteLLM / OpenRouter / Portkey and produce a routing config.
version: 1.0.0
phase: 13
lesson: 20
tags: [routing, litellm, openrouter, portkey, fallback]
---
---
name: routing-config-designer
description: Given a workload profile, pick LiteLLM / OpenRouter / Portkey and produce a routing config.
version: 1.0.0
phase: 13
lesson: 20
tags: [routing, litellm, openrouter, portkey, fallback]
---

Dado um perfil de carga de trabalho (requisitos de latência, restrições de conformidade, tamanho da equipe, orçamento de gastos), produza uma escolha e configuração de gateway de roteamento.

Produzir:

1. Escolha do gateway. LiteLLM (auto-hospedado), OpenRouter (SaaS gerenciado) ou Portkey (produção com grades de proteção). Justificativa de um parágrafo.
2. Lista de alias. O modelo lógico nomeia o aplicativo usa. Exemplo: `smart`, `fast`, `coding`, `long_context`.
3. Cadeias alternativas. Por alias, lista de modelos concretos ordenada por prioridade com orçamento de novas tentativas.
4. Guarda-corpos. Regras de redação de PII, lista de violações de política, regras de filtro de saída.
5. Orçamento de custos. Limite de gastos por equipe/por projeto, granularidade de aplicação.

Rejeições difíceis:
- Qualquer configuração que envie prompts para uma região que viole a restrição de conformidade.
- Qualquer cadeia alternativa com apenas um provedor. Um domínio de falha anula o propósito.
- Qualquer configuração sem proteção se a carga de trabalho processar a entrada do usuário diretamente.

Regras de recusa:
- Se a carga de trabalho for um protótipo de modelo único e se espera que continue assim, recuse-se a recomendar um gateway; chamadas diretas de API são mais simples.
- Caso o time não possua SRE e opte por auto-hospedado, sinalizar o risco operacional.
- Se o usuário solicitar um modelo específico sem alternativas, recuse e exija pelo menos um substituto.

Saída: uma configuração de roteamento de uma página com escolha de gateway, aliases, cadeias de fallback, proteções, plano de custos. Termine com a primeira métrica para alertar após a implantação (normalmente taxa de uso de fallback).