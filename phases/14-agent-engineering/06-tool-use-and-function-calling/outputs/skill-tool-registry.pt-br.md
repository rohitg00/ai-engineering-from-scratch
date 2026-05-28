---
name: tool-registry
description: Crie um catálogo e registro de ferramentas de produção com validação de esquema JSON, envio paralelo e observabilidade.
version: 1.0.0
phase: 14
lesson: 06
tags: [function-calling, tools, schema, validation, bfcl, parallel-tools]
---

Dado um domínio de tarefa, produza um catálogo de ferramentas que um agente possa usar de forma confiável nos eixos BFCL V4 (agente, multiturno, ativo, não ativo, alucinação).

Produzir:

1. Definições de ferramentas. Para cada ferramenta: `name` (snake_case), `description` (informa ao modelo quando usá-lo e quando NÃO), entrada do esquema JSON com propriedades digitadas, campos obrigatórios, enums quando aplicável, mínimo/máximo para numéricos, tempo limite por ferramenta, política de sandbox por ferramenta (superfície fs, rede, limite de memória).
2. Verificação de qualidade da descrição. Execute cada descrição em "isso informa ao modelo quando escolher esta ferramenta em vez das outras?" Se duas ferramentas tiverem descrições sobrepostas, recuse e reescreva.
3. Plano de despacho paralelo. Para cada tarefa realista, identifique quais chamadas de ferramentas são independentes (podem ser paralelizadas) e quais devem ser sequenciais. Emita um gráfico de despacho esperado.
4. Política de validação. Verificações de enum, regras de coerção de tipo (por exemplo, "aceitar int-as-string, rejeitar float-as-string"), aplicação de campo obrigatório. Cada falha retorna uma string de observação estruturada, nunca aumenta para o loop.
5. Observabilidade. Cada ferramenta emite um intervalo OpenTelemetry GenAI `tool_call` com atributos `gen_ai.tool.name`, `gen_ai.tool.call.id`, `gen_ai.tool.call.arguments`, `gen_ai.tool.call.result` (referência, não inline, quando a política de conteúdo exige).

Rejeições difíceis:

- Ferramenta genérica shell/command-exec. Recuse e divida verbos específicos (`git_status`, `fs_read`, `npm_test`).
- Enumerações ausentes quando o parâmetro possui um conjunto fechado de valores. A validação de enum é a maneira mais barata de detectar desvios.
- Mesma descrição para duas ferramentas diferentes. O modelo não pode escolher entre eles de forma confiável.
- `description` que apenas nomeia a ferramenta (“Adiciona dois números”). Inclua QUANDO para escolher entre alternativas.
- Sem tempo limite. Cada chamada de ferramenta deve ter um teto.

Regras de recusa:

- Se a lista de ferramentas exceder 30 ferramentas para um único agente, recuse e recomende a delegação de subagentes (Lição 17).
- Se alguma ferramenta realizar uma ação destrutiva sem portão de confirmação, recuse e aponte para a Lição 09 (permissões, sandbox).
- Se a tarefa for usar o computador (clicar, digitar, capturar a tela), recuse e aponte para a Lição 21 — que é um formato de ferramenta separado com ações baseadas na visão.

Saída: um catálogo de ferramentas JSON pronto para colar em chamadas Anthropic / OpenAI / Gemini SDK, um diagrama de gráfico de despacho, um documento de política de validação e uma miniavaliação estilo BFCL que o registro deve passar.

Termine com um ponteiro "o que ler a seguir": Lição 09 (sandboxing), Lição 23 (extensões OTel GenAI) ou Lição 30 (orientada para avaliação).