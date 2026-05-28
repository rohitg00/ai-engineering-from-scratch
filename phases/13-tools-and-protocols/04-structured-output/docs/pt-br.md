# Output Estruturado — JSON Schema, Pydantic, Zod, Decoding Restrito

> "Pedir educadamente pro modelo retornar JSON" falha de 5 a 15 por cento do tempo, mesmo em modelos frontier. Outputs estruturados fecham esse gap com decoding restrito: o modelo é literalmente impedido de emitir um token que violaria o schema. Modo strict da OpenAI, uso de ferramentas com schema tipado do Anthropic, `responseSchema` do Gemini, `output_type` do Pydantic AI e `.parse` do Zod são cinco formas superficiais da mesma ideia. Esta aula constrói o validador de schema e o contrato de modo strict que os alunos vão usar em cada pipeline de extração de produção.

**Tipo:** Construir
**Linguagens:** Python (stdlib, subconjunto JSON Schema 2020-12)
**Pré-requisitos:** Fase 13 · 02 (function calling em profundidade)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Escrever um JSON Schema 2020-12 pra um alvo de extração usando as restrições corretas (enum, min/max, required, pattern).
- Explicar por que modo strict e decoding restrito dão garantias diferentes de "validar depois de gerar".
- Distinguir os três modos de falha: erro de parse, violação de schema, recusa do modelo.
- Entregar um pipeline de extração com reparo tipado e tratamento de recusa tipado.

## O Problema

Um agente lendo um email de pedido de compra precisa transformar texto livre em `{customer, line_items, total_usd}`. Três abordagens.

**Abordagem um: pedir JSON no prompt.** "Responda em JSON com campos customer, line_items, total_usd." Funciona 85 a 95 por cento do tempo em modelos frontier. Falha de seis formas: chave faltando, vírgula no final, tipos errados, campos alucinados, truncado no limite de tokens, texto vaza como "Aqui está seu JSON:".

**Abordagem dois: validar depois de gerar.** Gerar livremente, parse, validar contra o schema, repetir em caso de falha. Confiável mas caro — você paga por cada repetição, e bugs de truncamento custam um turno extra por ocorrência.

**Abordagem três: decoding restrito.** O provedor aplica o schema na hora do decode. Tokens inválidos são mascarados da distribuição de amostragem. A saída é garantida pra parse e garantida pra validar. A falha colapsa num único modo: recusa (o modelo decide que o input não se encaixa no schema).

Todo provedor frontier de 2026 entrega alguma forma da abordagem três.

- **OpenAI.** `response_format: {type: "json_schema", strict: true}` mais `refusal` na resposta se o modelo se recusar.
- **Anthropic.** Aplicação de schema nas entradas de `tool_use`; `stop_reason: "refusal"` não existe, mas `end_turn` sem chamada de ferramenta é o sinal.
- **Gemini.** `responseSchema` no nível do request; em 2026 o Gemini entrega restrições gramaticais no nível de token pra tipos selecionados.
- **Pydantic AI.** `output_type=InvoiceModel` emite um `RunResult` tipado como `InvoiceModel`.
- **Zod (TypeScript).** Parser em runtime que valida a saída do provedor contra um schema Zod; combina com `beta.chat.completions.parse` da OpenAI.

O fio comum: declare o schema uma vez, aplique de ponta a ponta.

## O Conceito

### JSON Schema 2020-12 — a lingua franca

Todo provedor aceita JSON Schema 2020-12. Os constructos que você mais usa:

- `type`: um de `object`, `array`, `string`, `number`, `integer`, `boolean`, `null`.
- `properties`: mapa de nome de campo pra subschema.
- `required`: lista de nomes de campo que devem aparecer.
- `enum`: conjunto fechado de valores permitidos.
- `minimum` / `maximum` (números), `minLength` / `maxLength` / `pattern` (strings).
- `items`: subschema aplicado a cada elemento do array.
- `additionalProperties`: `false` proíbe campos extras (padrão varia por modo).

Modo strict da OpenAI adiciona três requisitos: toda propriedade precisa estar em `required`, `additionalProperties: false` em todo lugar, e nenhum `$ref` não resolvido. Se você quebrar isso, a API retorna 400 no request.

### Pydantic, o binding Python

Pydantic v2 gera JSON Schema de modelos no formato dataclass via `model_json_schema()`. Pydantic AI embrulha isso pra que você escreva:

```python
class Invoice(BaseModel):
    customer: str
    line_items: list[LineItem]
    total_usd: Decimal
```

e o framework de agente traduz o schema no modo strict da OpenAI, `input_schema` do Anthropic ou `responseSchema` do Gemini na borda. A saída do modelo volta como uma instância `Invoice` tipada. Erros de validação levantam `ValidationError` com caminhos de erro tipados.

### Zod, o binding TypeScript

Zod (`z.object({customer: z.string(), ...})`) é o equivalente em TS. O Node SDK da OpenAI expõe `zodResponseFormat(Invoice)` que traduz pro payload JSON Schema da API.

### Recusas

Modo strict não pode forçar o modelo a responder. Se o input não se encaixa no schema ("o email era um poema, não uma fatura"), o modelo emite um campo `refusal` contendo a razão. Seu código deve tratar isso como um resultado de primeira classe, não como uma falha. A recusa também é útil como sinal de segurança: um modelo pedido pra extrair número de cartão de crédito de um email com conteúdo protegido retorna uma recusa com a razão de segurança anexada.

### Decoding restrrito no código aberto

Implementações de pesos abertos usam três técnicas.

1. **Decoding baseado em gramática** (`outlines`, `guidance`, `lm-format-enforcer`): constrói um autômato finito determinístico a partir do schema; a cada passo, mascara os logits dos tokens que violariam o FSM.
2. **Mascaramento de logits com parser JSON**: roda um parser JSON em lockstep com o modelo; a cada passo, computa o conjunto de próximos tokens válidos.
3. **Decoding eespecificaçãoulativo com verificador**: modelo draft barato propõe tokens, verificador aplica o schema.

Provedores comerciais escolhem um deles nos bastidores. O estado da arte em 2026 é mais rápido que geração simples pra outputs estruturados curtos e velocidade aproximadamente igual pra longos.

### Os três modos de falha

1. **Erro de parse.** A saída não é JSON válido. Não pode acontecer sob modo strict. Ainda pode acontecer em provedores não strict.
2. **Violação de schema.** A saída faz parse mas viola o schema. Não pode acontecer sob modo strict. Comum fora dele.
3. **Recusa.** O modelo se recusa. Deve ser tratada como um resultado tipado.

### Estratégia de retry

Quando você está fora do modo strict (uso de ferramenta do Anthropic, OpenAI não strict, Gemini mais antigo), o padrão de recuperação é:

```
gerar -> parse -> validar -> se falhar, injetar erro e tentar novamente, máx 3x
```

Uma repetição geralmente basta. Três repetições pegam instabilidades de modelos fracos. Mais que três é sinal de um schema ruim: o modelo não consegue satisfazê-lo pra certos inputs, e o prompt ou o schema precisa ser corrigido.

### Suporte a modelos pequenos

Decoding restrito funciona em modelos pequenos. Um modelo aberto de 3 bilhões de parâmetros com aplicação de gramática supera um modelo de 70 bilhões de parâmetros com prompt crua em tarefas estruturadas. Essa é a principal razão pela qual outputs estruturados importam pra produção: desacopla confiabilidade do tamanho do modelo.

## Use

`code/main.py` entrega um validador mínimo de JSON Schema 2020-12 em stdlib (tipos, required, enum, min/max, pattern, items, additionalProperties). Ele embrulha um schema `Invoice` e roda uma saída falsa de LLM pelo validador, demonstrando os caminhos de erro de parse, violação de schema e recusa. Troque a saída falsa pela resposta real de qualquer provedor em produção.

O que conferir:

- O validador retorna uma lista `[ValidationError]` tipada com caminho e mensagem. Essa é a forma que você quer mostrar no prompt de retry.
- O ramo de recusa NÃO faz retry. Ele registra e retorna uma recusa tipada. Fase 14 · 09 usa recusas como sinal de segurança.
- A verificação `additionalProperties: false` dispara no input de teste adversarial, mostrando por que o modo strict fecha a porta pra campos alucinados.

## Entregue

Esta aula produz `outputs/skill-structured-output-designer.md`. Dado um alvo de extração em texto livre (faturas, tickets de suporte, currículos etc.), a skill produz um JSON Schema 2020-12 compatível com modo strict e um modelo Pydantic que espelha, com recusa tipada e tratamento de retry esboçados.

## Exercícios

1. Rode `code/main.py`. Adicione um quarto caso de teste cujo `total_usd` é um número negativo. Confirme que o validador rejeita com o caminho de restrição `minimum`.

2. Estenda o validador pra suportar `oneOf` com discriminador. Caso comum: `line_item` é um produto ou um serviço, marcado por `kind`. Modo strict tem regras sutis aqui; consulte o guia de structured outputs da OpenAI.

3. Escreva o mesmo schema Invoice como um Pydantic BaseModel e compare a saída de `model_json_schema()` com seu schema feito à mão. Identifique o único campo que Pydantic define por padrão e a versão feita à mão omite.

4. Meça taxas de recusa. Construa dez inputs que não devem ser extraíveis (uma letra de música, uma prova matemática, um email em branco) e rode por um provedor real com modo strict. Conte recusas vs. saídas alucinadas. Esse é seu ground truth pra retries com consciência de recusa.

5. Leia o guia de structured outputs da OpenAI de ponta a ponta. Identifique o único constructo que a OpenAI proíbe explicitamente no modo strict que JSON Schema permite. Depois projete um schema que usa o constructo proibido de forma não essencial e refatore pra ser compatível com strict.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| JSON Schema 2020-12 | "A eespecificaçãoificação de schema" | Dialeto de schema em draft da IETF que todo provedor moderno fala |
| Modo strict | "Schema garantido" | Flag da OpenAI que aplica schema via decoding restrito |
| Decoding restrito | "Mascaramento de logits" | Aplicação na hora do decode que mascara próximos tokens inválidos |
| Recusa | "Modelo se recusa" | Resultado tipado quando o input não se encaixa no schema |
| Erro de parse | "JSON inválido" | Saída não fez parse como JSON; impossível sob strict |
| Violação de schema | "Forma errada" | Fez parse mas violou tipos / required / enum / intervalo |
| `additionalProperties: false` | "Nada extra permitido" | Proíbe campos desconhecidos; obrigatório no strict da OpenAI |
| Pydantic BaseModel | "Saída tipada" | Classe Python que emite e valida JSON Schema |
| Schema Zod | "Tipo de saída TypeScript" | Schema em runtime TS pra validação de saída de provedor |
| Aplicação de gramática | "Decoding restrito de pesos aberto" | Mascaramento de logits baseado em FSM, como em outlines / guidance |

## Leituras Complementares

- [OpenAI — Structured outputs](https://platform.openai.com/docs/guides/structured-outputs) — modo strict, recusas e requisitos de schema
- [OpenAI — Introducing structured outputs](https://openai.com/index/introducing-structured-outputs-in-the-api/) — post de lançamento de agosto 2024 explicando a garantia de decoding
- [Pydantic AI — Output](https://ai.pydantic.dev/output/) — bindings tipados de output_type que serializam pra cada provedor
- [JSON Schema — 2020-12 release notes](https://json-schema.org/draft/2020-12/release-notes) — a eespecificaçãoificação canônica
- [Microsoft — Structured outputs in Azure OpenAI](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs) — notas de deployment empresarial e caveats do modo strict
