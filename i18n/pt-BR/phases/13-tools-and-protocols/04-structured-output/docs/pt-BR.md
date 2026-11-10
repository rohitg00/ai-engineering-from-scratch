# Output estruturado  JSON Schema, Pydantic, Zod, Decodificação Restriída

> "Pedir ao modelo gentilmente para retornar JSON" falha de 5 a 15 por cento do tempo, mesmo em modelos de fronteira. As saídas estruturadas fecham essa lacuna com decodificação restrita: o modelo é literalmente impedido de emitir um token que violaria o esquema.`responseSchema`, Pydantic AI `output_type`, e do Zod.`.parse`Esta lição constrói o validador de esquema e os alunos de contrato de modo estrito usarão para cada pipeline de extracção de produção.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, JSON Schema 2020-12 subset)
**Prerequisites:** Phase 13 · 02 (function calling deep dive)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Escreva um esquema JSON 2020-12 para um alvo de extração usando as restrições certas (enum, min/max, necessário, padrão).
- Explique por que o modo rigoroso e a descodificação restrita dão garantias diferentes da "validade após geração".
- Distinguir os três modos de falha: erro de análise, violação de esquema, recusa de modelo.
- Enviar um gasoduto de extracção com reparação tipográfica e manipulação tipográfica de recusa.

## O problema

Um agente que lê um e-mail de pedido de compra precisa transformar texto livre em `{customer, line_items, total_usd}`Três abordagens.

**Approach one: prompt for JSON.**"Responde em JSON com campos cliente, line_items, total_usd. " Funciona de 85 a 95 por cento do tempo em modelos de fronteira. Falha de seis maneiras: brace faltante, viragem traseira, tipos errados, campos alucinados, truncados no limite de token, prosa vazada como "Aqui está o seu JSON:".

**Approach two: validate after generation.**Gerar livremente, analisar, validar contra o esquema, tentar novamente em falha. Confiavel mas caro  você paga por cada tentativa, e bugs de truncation custam uma volta extra por ocorrência.

**Approach three: constrained decoding.**O provedor impõe o esquema no tempo de decodificação. Tokens inválidos são mascarados da distribuição de amostragem. A saída é garantida para analisar e garantida para validar. A falha se desintegra em um modo: recusa (o modelo decide que a entrada não se encaixa no esquema).

Todos os fornecedores de fronteira de 2026 enviam alguma forma de abordagem três.

- **OpenAI.** `response_format: {type: "json_schema", strict: true}`- E mais .`refusal`na resposta se o modelo declinar.
- **Anthropic.**Execução do regime em`tool_use`insumos; `stop_reason: "refusal"`Não é uma coisa, mas...`end_turn`Sem ferramentas, é o sinal.
- **Gemini.** `responseSchema`a nível de pedido; em 2026, a Gemini lançará restrições gramaticais a nível de tokens para tipos selecionados.
- **Pydantic AI.** `output_type=InvoiceModel`emite um estruturado `RunResult`Tipo de `InvoiceModel`- Não .
- **Zod (TypeScript).**Parser de tempo de execução que valida a saída do provedor em relação a um esquema Zod; combina com o OpenAI `beta.chat.completions.parse`- Não .

O fio comum: declarar o esquema uma vez, aplicá-lo de ponta a ponta.

## O conceito

### JSON Schema 2020-12  a língua franca

Todos os provedores aceitam JSON Schema 2020-12. Os construções que você usa mais:

- `type`: um dos `object`- Não .`array`- Não .`string`- Não .`number`- Não .`integer`- Não .`boolean`- Não .`null`- Não .
- `properties`: mapa do nome do campo para o sub-esquema.
- `required`: lista de nomes de campos que devem aparecer.
- `enum`: conjunto fechado de valores permitidos.
- `minimum`- Não .`maximum`(números), `minLength`- Não .`maxLength`- Não .`pattern`- Não, não.
- `items`: subesquema aplicado a todos os elementos do array.
- `additionalProperties`- Não .`false`proíbe campos extras (o padrão varia de modo a modo).

O modo rigoroso da OpenAI acrescenta três requisitos: cada propriedade deve ser listada em `required`- Não .`additionalProperties: false`Em todas as partes, e não há nada sem solução.`$ref`Se quebrar isto, a API devolve 400 no momento do pedido.

### Pydantic, a ligação Python

O Pydantic v2 gera JSON Schema a partir de modelos em forma de classe de dados através de `model_json_schema()`A IA Pydantic enrola isto para que escrevas:

```python
class Invoice(BaseModel):
    customer: str
    line_items: list[LineItem]
    total_usd: Decimal
```

e o framework do agente traduz o esquema para o modo estrito OpenAI, Anthropic `input_schema`, ou Gémeos .`responseSchema`A saída do modelo retorna como uma tipografia`Invoice`O número de erros de validação aumenta.`ValidationError`com caminhos de erro de digitação.

### Zod, a ligação do TypeScript

Zod (`z.object({customer: z.string(), ...})`O SDK Node da OpenAI expõe `zodResponseFormat(Invoice)`que se traduz na carga útil do esquema JSON da API.

### Refusos

O modo rigoroso não pode forçar o modelo a responder. Se a entrada não se encaixa no esquema ("o e-mail era um poema, não uma fatura"), o modelo emite um `refusal`O código deve tratar isto como um resultado de primeira classe, não como um fracasso. A recusa também é útil como sinal de segurança: um modelo solicitado a extrair um número de cartão de crédito de um e-mail de conteúdo protegido retorna uma recusa com a razão de segurança anexada.

### Descodagem restrita em aberto

As implementações de pesos abertos utilizam três técnicas.

1. **Grammar-based decoding**(`outlines`- Não .`guidance`- Não .`lm-format-enforcer`): construir um autônomo finito determinista a partir do esquema; em cada passo, mascarar os logits de tokens que violarão o FSM.
2. **Logit masking with a JSON parser**: executar um parser JSON em streaming em lockstep com o modelo; em cada passo, calcular o conjunto de tokens válidos-próximo.
3. **Speculative decoding with a verifier**O modelo de projeto barato propõe tokens, o verificador aplica o esquema.

Os fornecedores comerciais escolhem um destes nos bastidores. O estado da arte de 2026 é mais rápido do que a geração comum para as saídas estruturadas curtas e aproximadamente a mesma velocidade para as longas.

### Os três modos de falha

1. **Parse error.**A saída não é válida JSON. Não pode acontecer no modo estritto. Ainda pode acontecer em provedores não estritos.
2. **Schema violation.**A saída é analisada, mas viola o esquema, não pode acontecer no modo rigoroso.
3. **Refusal.**O modelo declina, deve ser tratado como um resultado tipado.

### Estratégia de retomada

Quando você está fora do modo estritamente (uso de ferramentas antropicas, OpenAI não estritamente, Gemini mais antigo), o padrão de recuperação é:

```
generate -> parse -> validate -> if fail, inject error and retry, max 3x
```

Uma retratação é geralmente suficiente. Três retratações captam flacos de modelo fraco. Além de três é um sinal de um esquema ruim: o modelo não pode satisfazê-lo para algumas entradas, e o prompt ou o esquema precisa ser corrigido.

### Apoio a modelos pequenos

A decodificação restrita funciona em modelos pequenos. Um modelo aberto com parâmetro 3B com aplicação gramatical supera um modelo com parâmetro 70B com prompting bruto em tarefas estruturadas. Esta é a principal razão pela qual as saídas estruturadas são importantes para a produção: ela descopla a confiabilidade do tamanho do modelo.

```figure
constrained-decoding
```

## Usá-lo

`code/main.py`Envia um validador mínimo de JSON Schema 2020-12 em stdlib (tipos, exigidos, enum, min/max, padrão, itens, propriedades adicionais). Envolve um `Invoice`O sistema de análise de dados é executado através do validador, demonstrando erros de análise, violação de esquema e caminhos de recusa.

O que ver:

- O validador retorna um `[ValidationError]`Esta é a forma que você quer aparecer no prompt de retrovisor.
- O ramo de recusa NÃO retrata. Regista e retorna uma recusa digitada. Fase 14 · 09 utiliza recusas como sinal de segurança.
- O `additionalProperties: false`Verificar os incêndios na entrada de ensaio adversário, mostrando por que o modo rígido fecha a porta em campos alucinados.

## Envia-o

Esta lição produz`outputs/skill-structured-output-designer.md`. Dado um alvo de extração de texto livre (facturas, bilhetes de suporte, currículos, etc.), a habilidade produz um JSON Schema 2020-12 que é estritamente compatível com o modo e um modelo Pydantic que o reflete, com rejeição de tipo e manipulação de retomada.

## Exercícios

1. Corra .`code/main.py`Adicionar um quarto caso de teste cujo`total_usd`Confirme que o validador o rejeita com o número `minimum`- O caminho de restrição.

2. Extender o validador para suportar `oneOf`O caso comum: `line_item`é um produto ou um serviço, etiquetado por `kind`. O modo rígido tem regras sutis aqui; verifique o guia de saídas estruturadas da OpenAI.

3. Escreva o mesmo esquema de faturamento como um BaseModel Pydantic e compare `model_json_schema()`Identifique os conjuntos de Pydantic de um campo por padrão que a versão rolada à mão omite.

4. Messa as taxas de recusa. Construa dez entradas que não devem ser extraídas (um texto de canção, uma prova matemática, um e-mail em branco) e execute-as através de um provedor real com modo rigoroso. Conte recusas versus saídas alucinadas. Esta é a sua verdade básica para retemptar recusa consciente.

5. Leia o guia de saídas estruturadas do OpenAI de cima para baixo. Identifique o construção que ele proíbe explicitamente em modo estritamente que o simples JSON Schema permite.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| JSON Schema 2020-12 | "The schema spec" | IETF-draft schema dialect every modern provider speaks |
| Strict mode | "Guaranteed schema" | OpenAI flag that enforces schema via constrained decoding |
| Constrained decoding | "Logit masking" | Decode-time enforcement that masks invalid next-tokens |
| Refusal | "Model declines" | Typed outcome when input cannot fit the schema |
| Parse error | "Invalid JSON" | Output did not parse as JSON; impossible under strict |
| Schema violation | "Wrong shape" | Parsed but violated types / required / enum / range |
| `additionalProperties: false` | "No extras allowed" | Forbids unknown fields; required in OpenAI strict |
| Pydantic BaseModel | "Typed output" | Python class that emits and validates JSON Schema |
| Zod schema | "TypeScript output type" | TS runtime schema for provider output validation |
| Grammar enforcement | "Open-weights constrained decode" | FSM-based logit masking, as in outlines / guidance |

## Mais leitura

- [OpenAI — Structured outputs](https://platform.openai.com/docs/guides/structured-outputs) Requisitos de modo rigoroso, recusa e esquema
- [OpenAI — Introducing structured outputs](https://openai.com/index/introducing-structured-outputs-in-the-api/) Agosto 2024 post de lançamento explicando a garantia de decodificação
- [Pydantic AI — Output](https://ai.pydantic.dev/output/) ligamentos de tipo output_type que se seriam para cada fornecedor
- [JSON Schema — 2020-12 release notes](https://json-schema.org/draft/2020-12/release-notes) a especificação canónica
- [Microsoft — Structured outputs in Azure OpenAI](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs) Notas de implantação empresarial e avisos de modo rigoroso
