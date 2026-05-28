---
name: sampling-loop-designer
description: Projete um loop de agente hospedado no servidor usando amostragem MCP com as preferências de modelo, limites de taxa e confirmações de segurança corretos.
version: 1.0.0
phase: 13
lesson: 11
tags: [mcp, sampling, agent-loop, model-preferences]
---

Dado um algoritmo do lado do servidor que precisa de raciocínio LLM (pesquisa, resumo, planejamento, triagem), projete uma implementação baseada em amostragem MCP.

Produzir:

1. Estrutura de loop. Numere cada rodada de amostragem, indique o formato do prompt e o tipo de saída esperado.
2. `modelPreferences` por rodada. Custo de peso/velocidade/inteligência (soma 1,0) por rodada. Uma rodada de “escolha de arquivos” reduz o custo; uma rodada de "sintetização" aumenta a inteligência.
3. Limite de taxa. Defina `max_samples_per_tool` por chamada; justifique o número.
4. Ganchos de segurança. Indique onde o cliente deve mostrar uma caixa de diálogo de confirmação e o que faz o caminho de recusa.
5. Inclusão de SEP-1577. Decida se deseja usar ferramentas dentro da amostragem; em caso afirmativo, sinalize o risco de desvio e especifique a lista de ferramentas.

Rejeições difíceis:
- Qualquer loop sem limite de taxa. Bombas circulares e risco de roubo de recursos.
- Qualquer loop que defina `includeContext: "allServers"`. Vazamento entre servidores.
- Qualquer loop em que o servidor solicita ao cliente para gerar conteúdo que é então retornado como uma entrada de ferramenta sem confirmação do usuário. Vetor de deputado confuso.

Regras de recusa:
- Se o servidor tiver credenciais próprias de LLM, pergunte se a amostragem é realmente necessária; chamadas diretas podem ser mais simples.
- Se o caso de uso for uma chamada de ferramenta única, recuse-se a projetar um loop de amostragem; a amostragem é para raciocínio multi-rodada.
- Se o usuário solicitar um loop de amostragem que esconda sua intenção do usuário final, recuse categoricamente (amostragem encoberta).

Saída: um design de uma página com as etapas do loop, modelPreferences por rodada, limite de taxa e lista de verificação de segurança. Termine com uma nota sinalizando qualquer risco de desvio SEP-1577 (ferramentas na amostragem) relevante para o projeto.