# 03 · 结构化输出：JSON、Schema 校验与受限解码

> 你的 LLM 返回的是一个字符串，而你的应用需要的是 JSON。正是这道鸿沟，比任何模型幻觉都更频繁地把生产系统拖垮。结构化输出（structured output）是连接自然语言与类型化数据之间的桥梁。做对了，你的 LLM 就成了一个可靠的 API；做错了，你就得在凌晨 3 点用正则表达式去解析自由文本。

**类型：** 实践构建
**语言：** Python
**前置：** 阶段 10，第 01-05 课（从零构建 LLM）
**相关：** 阶段 5 · 20（结构化输出与受限解码）讲解了解码器层面的理论（FSM/CFG logit 处理器、Outlines、XGrammar）。本课聚焦于生产环境的 SDK 接口层面（OpenAI 的 `response_format`、Anthropic 的工具使用、Instructor）——如果你想理解 API 之下究竟发生了什么，请先阅读阶段 5 · 20。

## 学习目标

- 使用 OpenAI 与 Anthropic 的 API 参数，实现 JSON 模式与 Schema 受限的输出
- 构建一个 Pydantic 校验层，拒绝格式错误的 LLM 输出，并带着错误反馈进行重试
- 解释受限解码（constrained decoding）如何在 token 层面强制产出合法 JSON，而无需任何后处理
- 设计健壮的抽取提示词，可靠地将非结构化文本转换为类型化的数据结构

## 问题所在

你向一个 LLM 提问：「从这段文本中抽取产品名称、价格和库存情况。」它回复道：

```
The product is the Sony WH-1000XM5 headphones, which cost $348.00 and are currently in stock.
```

这是一个完全正确的回答。但它对你的应用而言也完全无用。你的库存系统需要的是 `{"product": "Sony WH-1000XM5", "price": 348.00, "in_stock": true}`。你需要一个 JSON 对象，带有特定的键、特定的类型和特定的取值约束。你不需要一个句子。

最朴素的解法：在提示词里加上「以 JSON 格式回复」。这招在 90% 的情况下有效。剩下 10% 里，模型会把 JSON 包裹在 markdown 代码围栏里，或者加一句开场白「这是 JSON：」，又或者因为提前闭合了括号而产出语法非法的 JSON。于是你的 JSON 解析器崩溃，你的管线中断。你加上 try/except 和一个重试循环。可重试有时又会产出不同的数据。现在，在解析问题之上，你又多了一个一致性问题。

这不是一个提示词工程问题，而是一个解码问题。模型从左到右逐 token 生成。在每个位置上，它从一个 10 万以上选项的词表中挑选最可能的下一个 token。在任何给定位置上，这些选项中的大多数都会产出非法的 JSON。如果模型刚刚输出了 `{"price":`，那么下一个 token 必须是数字、引号（表示字符串）、`null`、`true`、`false` 或负号。任何其他东西都会产出非法 JSON。没有约束的话，模型可能会挑出一个语义上完全合理、但语法上灾难性错误的英文单词。

## 核心概念

### 结构化输出的控制谱系

结构化输出的控制可分为四个级别，一个比一个更可靠。

```mermaid
graph LR
    subgraph Spectrum["Structured Output Spectrum"]
        direction LR
        A["Prompt-based\n'Return JSON'\n~90% valid"] --> B["JSON Mode\nGuaranteed valid JSON\nNo schema guarantee"]
        B --> C["Schema Mode\nJSON + matches schema\nGuaranteed compliance"]
        C --> D["Constrained Decoding\nToken-level enforcement\n100% compliance"]
    end

    style A fill:#1a1a2e,stroke:#ff6b6b,color:#fff
    style B fill:#1a1a2e,stroke:#ffa500,color:#fff
    style C fill:#1a1a2e,stroke:#51cf66,color:#fff
    style D fill:#1a1a2e,stroke:#0f3460,color:#fff
```

**基于提示词**（「以合法 JSON 回复」）：没有任何强制。模型通常会照做，但有时不会。可靠性：约 90%。失败模式：markdown 围栏、开场白文本、被截断的输出、错误的结构。

**JSON 模式**：API 保证输出是合法的 JSON。OpenAI 的 `response_format: { type: "json_object" }` 可以启用这一点。输出能被无误地解析。但它未必符合你预期的 schema——可能多了键、类型错误，或缺少字段。

**Schema 模式**：API 接收一份 JSON Schema，并保证输出与之匹配。到 2026 年，每家主流提供商都已原生支持：OpenAI 的 `response_format: { type: "json_schema", json_schema: {...} }`（也可写作 `tool_choice="required"`）、Anthropic 带 `input_schema` 的工具使用，以及 Gemini 的 `response_schema` + `response_mime_type: "application/json"`。输出会精确拥有你所指定的键、类型和约束。

**受限解码（constrained decoding）**：在生成过程中的每个 token 位置，解码器都会屏蔽掉所有会产出非法输出的 token。如果 schema 要求一个数字，而模型正要输出一个字母，那个 token 的概率会被置零。模型只能产出那些能够通向合法输出的 token。这正是 OpenAI 的结构化输出模式，以及 Outlines、Guidance 等库在底层所实现的机制。

### JSON Schema：契约语言

JSON Schema 是你用来告诉模型（或校验层）输出必须呈现何种形状的方式。每一个主流结构化输出系统都在使用它。

```json
{
  "type": "object",
  "properties": {
    "product": { "type": "string" },
    "price": { "type": "number", "minimum": 0 },
    "in_stock": { "type": "boolean" },
    "categories": {
      "type": "array",
      "items": { "type": "string" }
    }
  },
  "required": ["product", "price", "in_stock"]
}
```

这份 schema 表示：输出必须是一个对象，包含一个字符串 `product`、一个非负数 `price`、一个布尔值 `in_stock`，以及一个可选的字符串数组 `categories`。任何不匹配的输出都会被拒绝。

Schema 能处理那些棘手的情况：嵌套对象、带类型元素的数组、枚举（将字符串约束为特定取值）、模式匹配（对字符串施加正则）以及组合器（用 oneOf、anyOf、allOf 描述多态输出）。

### Pydantic 范式

在 Python 中，你不用手写 JSON Schema。你定义一个 Pydantic 模型，它会为你生成 schema。

```python
from pydantic import BaseModel

class Product(BaseModel):
    product: str
    price: float
    in_stock: bool
    categories: list[str] = []
```

这产出的 JSON Schema 与上面那份相同。Instructor 库（以及 OpenAI 的 SDK）可以直接接受 Pydantic 模型：传入模型类，拿回一个经过校验的实例。如果 LLM 的输出不匹配，Instructor 会自动重试。

### 函数调用 / 工具使用

这是针对同一问题的另一种接口。不再要求模型直接产出 JSON，而是你定义带有类型化参数的「工具」（函数）。模型输出一个带结构化参数的函数调用。OpenAI 称之为「函数调用（function calling）」，Anthropic 称之为「工具使用（tool use）」。结果是一样的：结构化数据。

```mermaid
graph TD
    subgraph ToolUse["Tool Use Flow"]
        U["User: Extract product info\nfrom this review text"] --> M["Model processes input"]
        M --> TC["Tool Call:\nextract_product(\n  product='Sony WH-1000XM5',\n  price=348.00,\n  in_stock=true\n)"]
        TC --> V["Validate against\nfunction schema"]
        V --> R["Structured Result:\n{product, price, in_stock}"]
    end

    style U fill:#1a1a2e,stroke:#0f3460,color:#fff
    style TC fill:#1a1a2e,stroke:#e94560,color:#fff
    style V fill:#1a1a2e,stroke:#ffa500,color:#fff
    style R fill:#1a1a2e,stroke:#51cf66,color:#fff
```

当模型需要选择调用哪个函数（而不仅仅是填充参数）时，工具使用是首选。如果你有 10 个不同的抽取 schema，而模型必须根据输入挑选正确的那个，那么工具使用能同时为你提供 schema 选择和结构化输出。

### 常见的失败模式

即便有了 schema 强制，结构化输出仍可能以微妙的方式失败。

**幻觉值**：输出符合 schema，但包含的是虚构的数据。文本明明写着 $348，模型却产出 `{"price": 299.99}`。Schema 校验无法捕捉这一点——类型是对的，值是错的。

**枚举混淆**：你把某个字段约束为 `["in_stock", "out_of_stock", "preorder"]`。模型却输出 `"available"`——语义上正确，但不在允许的集合内。好的受限解码能阻止这种情况，而基于提示词的方法不能。

**嵌套对象深度**：深度嵌套的 schema（4 层以上）会产生更多错误。每多一层嵌套，就多一个让模型丢失结构追踪的地方。

**数组长度**：模型可能在数组里产出过多或过少的元素。Schema 支持 `minItems` 和 `maxItems`，但并非所有提供商都在解码层面强制执行它们。

**可选字段被省略**：模型省略了那些技术上可选、但对你的用例而言语义上重要的字段。即便数据有时缺失，也要在 schema 中把它们设为必填——强制模型显式产出 `null`。

## 动手构建

### 第 1 步：JSON Schema 校验器

从零构建一个校验器，检查一个 Python 对象是否匹配某份 JSON Schema。这正是在输出端运行、用来验证合规性的部分。

```python
import json

def validate_schema(data, schema):
    errors = []
    _validate(data, schema, "", errors)
    return errors

def _validate(data, schema, path, errors):
    schema_type = schema.get("type")

    if schema_type == "object":
        if not isinstance(data, dict):
            errors.append(f"{path}: expected object, got {type(data).__name__}")
            return
        for key in schema.get("required", []):
            if key not in data:
                errors.append(f"{path}.{key}: required field missing")
        properties = schema.get("properties", {})
        for key, value in data.items():
            if key in properties:
                _validate(value, properties[key], f"{path}.{key}", errors)

    elif schema_type == "array":
        if not isinstance(data, list):
            errors.append(f"{path}: expected array, got {type(data).__name__}")
            return
        min_items = schema.get("minItems", 0)
        max_items = schema.get("maxItems", float("inf"))
        if len(data) < min_items:
            errors.append(f"{path}: array has {len(data)} items, minimum is {min_items}")
        if len(data) > max_items:
            errors.append(f"{path}: array has {len(data)} items, maximum is {max_items}")
        items_schema = schema.get("items", {})
        for i, item in enumerate(data):
            _validate(item, items_schema, f"{path}[{i}]", errors)

    elif schema_type == "string":
        if not isinstance(data, str):
            errors.append(f"{path}: expected string, got {type(data).__name__}")
            return
        enum_values = schema.get("enum")
        if enum_values and data not in enum_values:
            errors.append(f"{path}: '{data}' not in allowed values {enum_values}")

    elif schema_type == "number":
        if not isinstance(data, (int, float)):
            errors.append(f"{path}: expected number, got {type(data).__name__}")
            return
        minimum = schema.get("minimum")
        maximum = schema.get("maximum")
        if minimum is not None and data < minimum:
            errors.append(f"{path}: {data} is less than minimum {minimum}")
        if maximum is not None and data > maximum:
            errors.append(f"{path}: {data} is greater than maximum {maximum}")

    elif schema_type == "boolean":
        if not isinstance(data, bool):
            errors.append(f"{path}: expected boolean, got {type(data).__name__}")

    elif schema_type == "integer":
        if not isinstance(data, int) or isinstance(data, bool):
            errors.append(f"{path}: expected integer, got {type(data).__name__}")
```

### 第 2 步：Pydantic 风格的「模型转 Schema」

构建一个最小化的「类转 schema」转换器。定义一个 Python 类，自动生成它的 JSON Schema。

```python
class SchemaField:
    def __init__(self, field_type, required=True, default=None, enum=None, minimum=None, maximum=None):
        self.field_type = field_type
        self.required = required
        self.default = default
        self.enum = enum
        self.minimum = minimum
        self.maximum = maximum

def python_type_to_schema(field):
    type_map = {
        str: "string",
        int: "integer",
        float: "number",
        bool: "boolean",
    }

    schema = {}

    if field.field_type in type_map:
        schema["type"] = type_map[field.field_type]
    elif field.field_type == list:
        schema["type"] = "array"
        schema["items"] = {"type": "string"}
    elif isinstance(field.field_type, dict):
        schema = field.field_type

    if field.enum:
        schema["enum"] = field.enum
    if field.minimum is not None:
        schema["minimum"] = field.minimum
    if field.maximum is not None:
        schema["maximum"] = field.maximum

    return schema

def model_to_schema(name, fields):
    properties = {}
    required = []

    for field_name, field in fields.items():
        properties[field_name] = python_type_to_schema(field)
        if field.required:
            required.append(field_name)

    return {
        "type": "object",
        "properties": properties,
        "required": required,
    }
```

### 第 3 步：受限的 Token 过滤器

模拟受限解码。给定一个部分 JSON 字符串和一份 schema，判断在当前位置上哪些 token 类别是合法的。

```python
def next_valid_tokens(partial_json, schema):
    stripped = partial_json.strip()

    if not stripped:
        return ["{"]

    try:
        json.loads(stripped)
        return ["<EOS>"]
    except json.JSONDecodeError:
        pass

    last_char = stripped[-1] if stripped else ""

    if last_char == "{":
        return ['"', "}"]
    elif last_char == '"':
        if stripped.endswith('":'):
            return ['"', "0-9", "true", "false", "null", "[", "{"]
        return ["a-z", '"']
    elif last_char == ":":
        return [" ", '"', "0-9", "true", "false", "null", "[", "{"]
    elif last_char == ",":
        return [" ", '"', "{", "["]
    elif last_char in "0123456789":
        return ["0-9", ".", ",", "}", "]"]
    elif last_char == "}":
        return [",", "}", "]", "<EOS>"]
    elif last_char == "]":
        return [",", "}", "<EOS>"]
    elif last_char == "[":
        return ['"', "0-9", "true", "false", "null", "{", "[", "]"]
    else:
        return ["any"]

def demonstrate_constrained_decoding():
    partial_states = [
        '',
        '{',
        '{"product"',
        '{"product":',
        '{"product": "Sony"',
        '{"product": "Sony",',
        '{"product": "Sony", "price":',
        '{"product": "Sony", "price": 348',
        '{"product": "Sony", "price": 348}',
    ]

    print(f"{'Partial JSON':<45} {'Valid Next Tokens'}")
    print("-" * 80)
    for state in partial_states:
        valid = next_valid_tokens(state, {})
        display = state if state else "(empty)"
        print(f"{display:<45} {valid}")
```

### 第 4 步：抽取管线

把所有部分组合成一个抽取管线：定义 schema、模拟 LLM 产出结构化输出、校验输出，并处理重试。

```python
def simulate_llm_extraction(text, schema, attempt=0):
    if "headphones" in text.lower() or "sony" in text.lower():
        if attempt == 0:
            return '{"product": "Sony WH-1000XM5", "price": 348.00, "in_stock": true, "categories": ["audio", "headphones"]}'
        return '{"product": "Sony WH-1000XM5", "price": 348.00, "in_stock": true}'

    if "laptop" in text.lower():
        return '{"product": "MacBook Pro 16", "price": 2499.00, "in_stock": false, "categories": ["computers"]}'

    return '{"product": "Unknown", "price": 0, "in_stock": false}'

def extract_with_retry(text, schema, max_retries=3):
    for attempt in range(max_retries):
        raw = simulate_llm_extraction(text, schema, attempt)

        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            print(f"  Attempt {attempt + 1}: JSON parse error -- {e}")
            continue

        errors = validate_schema(data, schema)
        if not errors:
            return data

        print(f"  Attempt {attempt + 1}: Schema validation errors -- {errors}")

    return None

product_schema = {
    "type": "object",
    "properties": {
        "product": {"type": "string"},
        "price": {"type": "number", "minimum": 0},
        "in_stock": {"type": "boolean"},
        "categories": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["product", "price", "in_stock"],
}
```

### 第 5 步：运行完整管线

```python
def run_demo():
    print("=" * 60)
    print("  Structured Output Pipeline Demo")
    print("=" * 60)

    print("\n--- Schema Definition ---")
    product_fields = {
        "product": SchemaField(str),
        "price": SchemaField(float, minimum=0),
        "in_stock": SchemaField(bool),
        "categories": SchemaField(list, required=False),
    }
    generated_schema = model_to_schema("Product", product_fields)
    print(json.dumps(generated_schema, indent=2))

    print("\n--- Schema Validation ---")
    test_cases = [
        ({"product": "Test", "price": 10.0, "in_stock": True}, "Valid object"),
        ({"product": "Test", "price": -5.0, "in_stock": True}, "Negative price"),
        ({"product": "Test", "in_stock": True}, "Missing price"),
        ({"product": "Test", "price": "ten", "in_stock": True}, "String as price"),
        ("not an object", "String instead of object"),
    ]

    for data, label in test_cases:
        errors = validate_schema(data, product_schema)
        status = "PASS" if not errors else f"FAIL: {errors}"
        print(f"  {label}: {status}")

    print("\n--- Constrained Decoding Simulation ---")
    demonstrate_constrained_decoding()

    print("\n--- Extraction Pipeline ---")
    texts = [
        "The Sony WH-1000XM5 headphones are priced at $348 and currently available.",
        "The new MacBook Pro 16-inch laptop costs $2499 but is sold out.",
        "This is a random sentence with no product info.",
    ]

    for text in texts:
        print(f"\n  Input: {text[:60]}...")
        result = extract_with_retry(text, product_schema)
        if result:
            print(f"  Output: {json.dumps(result)}")
        else:
            print(f"  Output: FAILED after retries")
```

## 实际运用

### OpenAI 结构化输出

```python
# from openai import OpenAI
# from pydantic import BaseModel
#
# client = OpenAI()
#
# class Product(BaseModel):
#     product: str
#     price: float
#     in_stock: bool
#
# response = client.beta.chat.completions.parse(
#     model="gpt-5-mini",
#     messages=[
#         {"role": "system", "content": "Extract product information."},
#         {"role": "user", "content": "Sony WH-1000XM5, $348, in stock"},
#     ],
#     response_format=Product,
# )
#
# product = response.choices[0].message.parsed
# print(product.product, product.price, product.in_stock)
```

OpenAI 的结构化输出模式在内部使用受限解码。模型生成的每一个 token 都被保证产出符合 Pydantic schema 的输出。无需重试，无需校验。约束已被嵌入到解码过程之中。

### Anthropic 工具使用

```python
# import anthropic
#
# client = anthropic.Anthropic()
#
# response = client.messages.create(
#     model="claude-opus-4-7",
#     max_tokens=1024,
#     tools=[{
#         "name": "extract_product",
#         "description": "Extract product information from text",
#         "input_schema": {
#             "type": "object",
#             "properties": {
#                 "product": {"type": "string"},
#                 "price": {"type": "number"},
#                 "in_stock": {"type": "boolean"},
#             },
#             "required": ["product", "price", "in_stock"],
#         },
#     }],
#     messages=[{"role": "user", "content": "Extract: Sony WH-1000XM5, $348, in stock"}],
# )
```

Anthropic 通过工具使用来实现结构化输出。模型产出一个带结构化参数的工具调用，这些参数匹配 input_schema。结果相同，只是 API 接口面不同。

### Instructor 库

```python
# pip install instructor
# import instructor
# from openai import OpenAI
# from pydantic import BaseModel
#
# client = instructor.from_openai(OpenAI())
#
# class Product(BaseModel):
#     product: str
#     price: float
#     in_stock: bool
#
# product = client.chat.completions.create(
#     model="gpt-5-mini",
#     response_model=Product,
#     messages=[{"role": "user", "content": "Sony WH-1000XM5, $348, in stock"}],
# )
```

Instructor 包装任意 LLM 客户端，并加上带校验的自动重试。如果第一次尝试未通过校验，它会把错误作为上下文回传给模型，要求其修正输出。这适用于任何提供商，而不仅仅是 OpenAI。

## 交付成果

本课产出 `outputs/prompt-structured-extractor.md`——一个可复用的提示词模板，给定一份 schema 定义，它能从任意文本中抽取结构化数据。喂给它一份 JSON Schema 和一段非结构化文本，它就返回经过校验的 JSON。

本课还产出 `outputs/skill-structured-outputs.md`——一个决策框架，帮助你根据所用的提供商、可靠性要求和 schema 复杂度，选择正确的结构化输出策略。

## 练习

1. 扩展 schema 校验器以支持 `oneOf`（数据必须恰好匹配若干 schema 中的一个）。这能处理多态输出——例如，某个字段既可以是 `Product` 对象，也可以是形状不同的 `Service` 对象。

2. 构建一个「schema diff」工具，比较两份 schema，识别出破坏性变更（移除了必填字段、改变了类型）与非破坏性变更（新增了可选字段、放宽了约束）。这对于在生产环境中给抽取 schema 做版本管理至关重要。

3. 实现一个更贴近现实的受限解码模拟器。给定一份 JSON Schema 和一个含 100 个 token 的词表（字母、数字、标点、关键字），逐步走完生成过程，在每个位置屏蔽非法 token。测量在每一步中，词表里有多大比例是合法的。

4. 构建一套抽取评估（eval）测试集。创建 50 段产品描述，并手工标注其 JSON 输出。在全部 50 段上运行你的抽取管线，测量完全匹配率、字段级准确率和类型合规率。找出哪些字段最难被正确抽取。

5. 为你的抽取管线加上「置信度分数」。对每个被抽取的字段，估计模型的置信程度（基于 token 概率，或通过运行抽取 3 次并测量一致性）。把低置信度的字段标记出来，交由人工审查。

## 关键术语

| 术语 | 人们口中怎么说 | 它实际的含义 |
|------|----------------|----------------------|
| JSON mode（JSON 模式） | 「返回 JSON」 | 一个 API 标志，保证输出是语法合法的 JSON，但不强制任何特定 schema |
| Structured output（结构化输出） | 「类型化 JSON」 | 匹配某份特定 JSON Schema 的输出，拥有正确的键、类型和约束 |
| Constrained decoding（受限解码） | 「引导式生成」 | 在每个 token 位置屏蔽掉会产出非法输出的 token——保证 100% 的 schema 合规 |
| JSON Schema | 「一个 JSON 模板」 | 一种声明式语言，用于描述 JSON 数据的结构、类型和约束（被 OpenAPI、JSON Forms 等采用） |
| Pydantic | 「升级版 Python dataclass」 | 一个 Python 库，用类型校验定义数据模型，被 FastAPI 和 Instructor 用来生成 JSON Schema |
| Function calling（函数调用） | 「工具使用」 | LLM 输出一个结构化的函数调用（名称 + 类型化参数）而非自由文本——OpenAI 和 Anthropic 都支持 |
| Instructor | 「面向 LLM 的 Pydantic」 | 一个 Python 库，包装 LLM 客户端以返回经过校验的 Pydantic 实例，并在校验失败时自动重试 |
| Token masking（Token 屏蔽） | 「过滤词表」 | 在生成过程中把特定 token 的概率置零，使模型无法产出它们 |
| Schema compliance（Schema 合规） | 「形状匹配」 | 输出拥有每一个必填字段、正确的类型、约束范围内的取值，且没有多余的不允许字段 |
| Retry loop（重试循环） | 「反复尝试直到成功」 | 把校验错误回传给模型并要求其修正输出——Instructor 会自动做到这一点，直到可配置的上限 |

## 延伸阅读

- [OpenAI 结构化输出指南](https://platform.openai.com/docs/guides/structured-outputs)——OpenAI API 中基于 JSON Schema 的受限解码的官方文档
- [Willard & Louf, 2023——《Efficient Guided Generation for Large Language Models》](https://arxiv.org/abs/2307.09702)——Outlines 论文，描述了如何把 JSON Schema 编译为有限状态机以实现 token 级约束
- [Instructor 文档](https://python.useinstructor.com/)——用 Pydantic 校验与重试从任意 LLM 获取结构化输出的标准库
- [Anthropic 工具使用指南](https://docs.anthropic.com/en/docs/tool-use)——Claude 如何通过带 JSON Schema input_schema 的工具使用来实现结构化输出
- [JSON Schema 规范](https://json-schema.org/)——每个主流结构化输出系统所使用的 schema 语言的完整规范
- [Outlines 库](https://github.com/outlines-dev/outlines)——开源的受限生成，使用正则和编译为有限状态机的 JSON Schema
- [Dong et al., 《XGrammar: Flexible and Efficient Structured Generation Engine for Large Language Models》（MLSys 2025）](https://arxiv.org/abs/2411.15100)——当前最先进的语法引擎；采用下推自动机编译，以约 100 ns/token 的速度屏蔽 token
- [Beurer-Kellner et al., 《Prompting Is Programming: A Query Language for Large Language Models》（LMQL）](https://arxiv.org/abs/2212.06094)——LMQL 论文，把受限解码构想为一种带类型和取值约束的查询语言
- [Microsoft Guidance（框架文档）](https://github.com/guidance-ai/guidance)——模板驱动的受限生成；与 Outlines 和 XGrammar 互补，且与厂商无关
