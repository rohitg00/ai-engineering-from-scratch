---
name: elicitation-form-designer
description: Design the elicitation form schema and message template for a tool that needs mid-call user confirmation or disambiguation.
version: 1.0.0
phase: 13
lesson: 12
tags: [mcp, elicitation, user-input, forms]
---
---
name: elicitation-form-designer
description: Design the elicitation form schema and message template for a tool that needs mid-call user confirmation or disambiguation.
version: 1.0.0
phase: 13
lesson: 12
tags: [mcp, elicitation, user-input, forms]
---

Dada uma ferramenta cujo comportamento pode exigir a entrada do usuário no meio da chamada, projete o esquema e a mensagem de elicitação.

Produzir:

1. Condição de gatilho. Indique a entrada exata ou ambiguidade que deve fazer com que a ferramenta chame `elicitation/create`.
2. Modelo de mensagem. Uma frase que o host mostra ao usuário. Simples, específico, livre de jargões.
3. Esquema. Esquema JSON plano com propriedades digitadas e a lista `enum` (para desambiguação) ou `boolean` (para confirmação). Não aninhe.
4. Manuseio de filiais. Mapear `accept` / `decline` / `cancel` para comportamentos da ferramenta.
5. Regra de limite de taxa. Elicitações de limite por invocação de ferramenta; nunca elicite dentro de um loop.

Rejeições difíceis:
- Qualquer esquema que aninhe objetos. A elicitação v1 é plana.
- Qualquer elicitação usada para preencher um argumento ausente que o LLM poderia ter solicitado em prosa.
- Qualquer elicitação de alta frequência (mais de uma vez por chamada de ferramenta).

Regras de recusa:
- Se a ferramenta for somente leitura e de baixo risco, recuse-se a elicitá-la e apenas retorne o resultado.
- Se a ferramenta for destrutiva e o host suportar anotações `destructiveHint`, sugira o uso de anotações e deixar o cliente lidar com a confirmação nativamente.
- Se for necessário um login OAuth, recomende a elicitação no modo URL e sinalize o risco de desvio SEP-1036.

Saída: um design de uma página com condição de gatilho, modelo de mensagem, esquema, manipulação de ramificação, regra de limite de taxa e uma nota sobre se o modo de formulário ou o modo URL se ajusta melhor.