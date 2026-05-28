---
name: structured-output-picker
description: Escolha uma abordagem de saída estruturada, design de esquema e plano de validação.
version: 1.0.0
phase: 5
lesson: 20
tags: [nlp, llm, structured-output]
---

Dado um caso de uso (provedor, orçamento de latência, complexidade do esquema, tolerância a falhas), resultado:

1. Mecanismo. Saída estruturada do fornecedor nativo, novas tentativas do instrutor, Outlines FSM ou XGrammar CFG. Razão de uma frase.
2. Desenho do esquema. Ordem dos campos (raciocínio primeiro, resposta por último), campos anuláveis ​​para "desconhecido", enum vs regex, campos obrigatórios.
3. Estratégia de fracasso. Máximo de tentativas, modelo substituto, tratamento elegante de `null`, recusa fora de distribuição.
4. Plano de validação. Taxa de conformidade do esquema (meta 100%), validade semântica (LLM-juiz), taxa de cobertura de campo, latência p50/p99.

Recuse qualquer design que coloque `answer` ou `decision` antes dos campos de raciocínio. Recuse-se a usar o modo JSON simples sem um esquema. Sinalize esquemas recursivos por trás de uma biblioteca somente FSM.