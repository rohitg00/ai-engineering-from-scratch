# 结构化输出：JSON、Schema 验证、约束解码

> 你的 LLM 返回的是一个字符串。你的应用需要的是 JSON。这个鸿沟导致的生产系统崩溃比任何模型幻觉都多。结构化输出是自然语言与类型化数据之间的桥梁。做对了，你的 LLM 就成为一个可靠的 API。做错了，你就要在凌晨 3 点用正则表达式解析自由文本。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 10, Lessons 01-05 (LLMs from Scratch)
**Time:** ~90 minutes
**Related:** Phase 5 · 20 (Structured Outputs & Constrained Decoding) 讲解了解码器层面的理论（FSM/CFG logit 处理器、Outlines、XGrammar）。本课聚焦于生产环境 SDK 层面（OpenAI `response_format`、Anthropic tool use、Instructor）——如果你想理解 API 之下发生了什么，请先阅读 Phase 5 · 20。

## 学习目标

- 使用 OpenAI 和 Anthropic API 参数实现 JSON 模式和 schema 约束的输出
- 构建一个 Pydantic 验证层，拒绝格式错误的 LLM 输出，并携带错误反馈进行重试
- 解释约束解码如何在 token 层面强制生成合法 JSON，无需后处理
- 设计稳健的抽取提示词，可靠地将非结构化文本转换为类型化数据结构

## 问题所在

你问一个 LLM：“从这段文本中提取产品名称、价格和库存状态。”它回答：

```
The product is the Sony WH-1000XM5 headphones, which cost $348.00 and are currently in stock.
```

这个答案完全正确，但对你的应用毫无用处。你的库存系统需要 `{"product": "Sony WH-1000XM5", "price": 348.00, "in_stock": true}`。你需要一个具有特定键、特定类型和特定取值约束的 JSON 对象，而不是一个句子。

朴素的解决方案：在提示词里加上“用 JSON 回答”。这有 90% 的成功率。剩下 10% 的情况，模型会把 JSON 包在 markdown 代码围栏里，或者加上“这是 JSON：”之类的前言，或者因为提前闭合了一个括号而产生语法错误的 JSON。你的 JSON 解析器崩溃了。你的流水线断了。你加了 try/except 和重试循环。重试有时会产生不同的数据。现在你在解析问题之上又多了一个一致性问题。

这不是提示词工程问题，而是解码问题。模型从左到右生成 token。在每个位置，它从超过 10 万个候选的词表中挑选最可能的下一个 token。其中大多数选项在任何给定位置都会产生非法 JSON。如果模型刚输出了 `{"price":`，下一个 token 必须是数字、引号（用于字符串）、`null`、`true`、`false` 或负号。其他任何内容都会产生非法 JSON。没有约束的话，模型可能选出一个完全合理的英文单词，却在语法上造成灾难性错误。

## 核心概念

### 结构化输出光谱

结构化输出控制有四个层级，每一级都比上一级更可靠。

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

**基于提示词**（“用合法 JSON 回答”）：没有任何强制机制。模型通常会遵守，但有时不会。可靠性：约 90%。失败模式：markdown 围栏、前言文本、输出截断、结构错误。

**JSON 模式**：API 保证输出是合法 JSON。OpenAI 的 `response_format: { type: "json_object" }` 启用此功能。输出一定能解析成功。但未必符合你期望的 schema——可能有额外的键、错误的类型、缺失的字段。

**Schema 模式**：API 接收一个 JSON Schema 并保证输出符合它。到 2026 年，所有主要提供商都原生支持：OpenAI 的 `response_format: { type: "json_schema", json_schema: {...} }`（也以 `tool_choice="required"` 形式提供）、Anthropic 带 `input_schema` 的 tool use、以及 Gemini 的 `response_schema` + `response_mime_type: "application/json"`。输出拥有你指定的精确键、类型和约束。

**约束解码**：在生成过程中的每个 token 位置，解码器屏蔽所有会产生非法输出的 token。如果 schema 要求一个数字而模型即将输出一个字母，该 token 的概率就被置为零。模型只能产生通向合法输出的 token。这就是 OpenAI 的结构化输出模式以及 Outlines、Guidance 等库在底层实现的方式。

### JSON Schema：契约语言

JSON Schema 是你告诉模型（或验证层）输出必须具有什么形状的方式。所有主要结构化输出系统都使用它。

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

这个 schema 表示：输出必须是一个对象，包含一个字符串 `product`、一个非负数 `price`、一个布尔值 `in_stock`，以及一个可选的字符串数组 `categories`。任何不匹配的输出都会被拒绝。

Schema 能处理困难情况：嵌套对象、带类型化元素的数组、枚举（将字符串限制为特定取值）、模式匹配（对字符串使用正则）、以及组合器（用于多态输出的 oneOf、anyOf、allOf）。

### Pydantic 模式

在 Python 中，你不需要手写 JSON Schema。定义一个 Pydantic 模型，它会自动生成 schema。

```python
from pydantic import BaseModel

class Product(BaseModel):
    product: str
    price: float
    in_stock: bool
    categories: list[str] = []
```

这将产生与上面相同的 JSON Schema。Instructor 库（以及 OpenAI 的 SDK）直接接受 Pydantic 模型：传入模型类，返回一个已验证的实例。如果 LLM 输出不匹配，Instructor 会自动重试。

### Function Calling / Tool Use

同一问题的另一种接口。不是让模型直接产生 JSON，而是定义带类型化参数的“工具”（函数）。模型输出一个带有结构化参数的函数调用。OpenAI 称之为 "function calling"，Anthropic 称之为 "tool use"。结果是一样的：结构化数据。

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

当模型需要选择调用哪个函数而不仅仅是填充参数时，tool use 是首选。如果你有 10 个不同的抽取 schema，模型必须根据输入选择正确的一个，tool use 同时给你 schema 选择和结构化输出。

### 常见失败模式

即使有 schema 强制，结构化输出仍可能以微妙的方式失败。

**幻觉值**：输出符合 schema 但包含编造的数据。文本写的是 $348，模型却输出 `{"price": 299.99}`。Schema 验证无法捕获这一点——类型正确，值错了。

**枚举混淆**：你把一个字段约束为 `["in_stock", "out_of_stock", "preorder"]`。模型输出 `"available"`——语义上正确，但不在允许的取值集合中。良好的约束解码可以防止这种情况。基于提示词的方法则不能。

**嵌套对象深度**：深层嵌套的 schema（4 层以上）会产生更多错误。每层嵌套都是模型可能迷失结构的另一个地方。

**数组长度**：模型可能在数组中产生过多或过少的元素。Schema 支持 `minItems` 和 `maxItems`，但并非所有提供商都在解码层面强制执行。

**可选字段省略**：模型省略了技术上可选但对你的用例语义上重要的字段。即使数据有时缺失，也要在 schema 中把它们设为必填——强制模型显式输出 `null`。

```figure
mx-schema-funnel
```

## 动手构建

### 第 1 步：JSON Schema 验证器

从零开始构建一个验证器，检查 Python 对象是否匹配某个 JSON Schema。这是在输出端运行的、用于验证合规性的组件。

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

### 第 2 步：Pydantic 风格模型转 Schema

构建一个极简的类到 schema 转换器。定义一个 Python 类并自动生成它的 JSON Schema。

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

### 第 3 步：约束 Token 过滤器

模拟约束解码。给定一个部分 JSON 字符串和一个 schema，判断当前位置哪些 token 类别是合法的。

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

### 第 4 步：抽取流水线

将所有部分组合成一个抽取流水线：定义 schema，模拟 LLM 产生结构化输出，验证输出，并处理重试。

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

### 第 5 步：运行完整流水线

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

## 实际使用

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

OpenAI 的结构化输出模式在内部使用约束解码。模型生成的每个 token 都被保证产生符合 Pydantic schema 的输出。无需重试。无需验证。约束被内置于解码过程中。

### Anthropic Tool Use

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

Anthropic 通过 tool use 实现结构化输出。模型发出一个工具调用，其结构化参数符合 input_schema。结果相同，API 表面不同。

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

Instructor 封装任意 LLM 客户端，并添加带验证的自动重试。如果第一次尝试未通过验证，它会把错误作为上下文发回给模型，要求其修正输出。这适用于任何提供商，而不仅是 OpenAI。

## 上线交付

本课产出 `outputs/prompt-structured-extractor.md`——一个可复用的提示词模板，在给定 schema 定义的情况下从任意文本中抽取结构化数据。输入一个 JSON Schema 和非结构化文本，它返回经过验证的 JSON。

它还产出 `outputs/skill-structured-outputs.md`——一个决策框架，根据你的提供商、可靠性要求和 schema 复杂度，选择合适的结构化输出策略。

## 练习

1. 扩展 schema 验证器以支持 `oneOf`（数据必须恰好匹配多个 schema 中的一个）。这可以处理多态输出——例如，一个字段可以是 `Product` 或形状不同的 `Service` 对象。

2. 构建一个“schema diff”工具，比较两个 schema 并识别破坏性变更（删除必填字段、修改类型）与非破坏性变更（新增可选字段、放宽约束）。这对于在生产环境中对抽取 schema 进行版本管理至关重要。

3. 实现一个更真实的约束解码模拟器。给定一个 JSON Schema 和一个包含 100 个 token 的词表（字母、数字、标点、关键字），逐步执行生成过程，在每个位置屏蔽非法 token。测量每一步词表中合法 token 的百分比。

4. 构建一个抽取评估套件。创建 50 条带有手工标注 JSON 输出的产品描述。在你的抽取流水线上运行全部 50 条，测量精确匹配率、字段级准确率和类型合规性。找出哪些字段最难正确抽取。

5. 为你的抽取流水线添加“置信度分数”。对每个抽取的字段，估计模型的可信程度（基于 token 概率，或运行 3 次抽取并测量一致性）。将低置信度字段标记出来供人工审核。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| JSON 模式 | “返回 JSON” | 保证语法合法 JSON 输出的 API 开关，但不强制任何特定 schema |
| 结构化输出 | “类型化的 JSON” | 符合特定 JSON Schema 的输出，具有正确的键、类型和约束 |
| 约束解码 | “引导式生成” | 在每个 token 位置屏蔽会产生非法输出的 token——保证 100% 符合 schema |
| JSON Schema | “一个 JSON 模板” | 用于描述 JSON 数据结构、类型和约束的声明式语言（被 OpenAPI、JSON Forms 等使用） |
| Pydantic | “Python dataclasses 增强版” | 定义带类型验证的数据模型的 Python 库，被 FastAPI 和 Instructor 用来生成 JSON Schema |
| Function calling | “Tool use” | LLM 输出结构化的函数调用（名称 + 类型化参数）而非自由文本——OpenAI 和 Anthropic 都支持 |
| Instructor | “LLM 的 Pydantic” | 封装 LLM 客户端以返回已验证 Pydantic 实例的 Python 库，验证失败时自动重试 |
| Token 屏蔽 | “过滤词表” | 在生成过程中将特定 token 的概率置为零，使模型无法产生它们 |
| Schema 合规 | “形状匹配” | 输出包含所有必填字段、类型正确、取值在约束范围内、且没有多余的不允许字段 |
| 重试循环 | “不断重试直到成功” | 把验证错误发回给模型并要求其修正输出——Instructor 自动执行此操作，最多重试可配置次数 |

## 延伸阅读

- [OpenAI Structured Outputs Guide](https://platform.openai.com/docs/guides/structured-outputs) -- OpenAI API 中基于 JSON Schema 的约束解码官方文档
- [Willard & Louf, 2023 -- "Efficient Guided Generation for Large Language Models"](https://arxiv.org/abs/2307.09702) -- Outlines 论文，描述如何将 JSON Schema 编译为有限状态机以实现 token 级约束
- [Instructor documentation](https://python.useinstructor.com/) -- 从任意 LLM 获取结构化输出、带 Pydantic 验证和重试的标准库
- [Anthropic Tool Use Guide](https://docs.anthropic.com/en/docs/tool-use) -- Claude 如何通过带 JSON Schema input_schema 的 tool use 实现结构化输出
- [JSON Schema specification](https://json-schema.org/) -- 所有主要结构化输出系统所使用的 schema 语言的完整规范
- [Outlines library](https://github.com/outlines-dev/outlines) -- 开源约束生成库，将正则和 JSON Schema 编译为有限状态机
- [Dong et al., "XGrammar: Flexible and Efficient Structured Generation Engine for Large Language Models" (MLSys 2025)](https://arxiv.org/abs/2411.15100) -- 当前最先进的语法引擎；下推自动机编译，每个 token 的屏蔽耗时约 100 ns。
- [Beurer-Kellner et al., "Prompting Is Programming: A Query Language for Large Language Models" (LMQL)](https://arxiv.org/abs/2212.06094) -- LMQL 论文，将约束解码框架化为带类型和取值约束的查询语言。
- [Microsoft Guidance (framework docs)](https://github.com/guidance-ai/guidance) -- 模板驱动的约束生成；Outlines 和 XGrammar 的供应商无关补充。