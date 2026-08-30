# 04 · API 与密钥

> 每个 AI API 的工作方式都一样：发送一个请求，得到一个响应。细节会变，但模式不变。

**类型：** 实践（Build）
**语言：** Python、TypeScript
**前置：** 阶段 0，第 01 课
**时长：** 约 30 分钟

## 学习目标

- 使用环境变量与 `.env` 文件安全地存储 API 密钥
- 同时使用 Anthropic Python SDK 与原生 HTTP 发起一次大语言模型（LLM）API 调用
- 对比基于 SDK 与原生 HTTP 的请求/响应格式，用于调试
- 识别并处理常见的 API 错误，包括认证错误与速率限制（rate limit）

## 问题所在

从阶段 11 开始，你将调用各类 LLM API（Anthropic、OpenAI、Google）。在阶段 13-16 中，你会构建在循环中使用这些 API 的智能体（agent）。你需要了解 API 密钥的工作原理、如何安全地存储它们，以及如何发起你的第一次 API 调用。

## 核心概念

```mermaid
sequenceDiagram
    participant C as Your Code
    participant S as API Server
    C->>S: HTTP Request (with API key)
    S->>C: HTTP Response (JSON)
```

每一次 API 调用都包含：
1. 一个端点（endpoint，即 URL）
2. 一个 API 密钥（用于认证）
3. 一个请求体（你想要什么）
4. 一个响应体（你得到了什么）

## 动手构建

### 第 1 步：安全地存储 API 密钥

绝不要把 API 密钥写进代码里。使用环境变量。

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
```

或者使用 `.env` 文件（并把它加入 `.gitignore`）：

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

### 第 2 步：第一次 API 调用（Python）

```python
import anthropic

client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=256,
    messages=[{"role": "user", "content": "What is a neural network in one sentence?"}]
)

print(response.content[0].text)
```

### 第 3 步：第一次 API 调用（TypeScript）

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const response = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 256,
  messages: [{ role: "user", content: "What is a neural network in one sentence?" }],
});

console.log(response.content[0].text);
```

### 第 4 步：原生 HTTP（不使用 SDK）

```python
import os
import urllib.request
import json

url = "https://api.anthropic.com/v1/messages"
headers = {
    "Content-Type": "application/json",
    "x-api-key": os.environ["ANTHROPIC_API_KEY"],
    "anthropic-version": "2023-06-01",
}
body = json.dumps({
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 256,
    "messages": [{"role": "user", "content": "What is a neural network in one sentence?"}],
}).encode()

req = urllib.request.Request(url, data=body, headers=headers, method="POST")
with urllib.request.urlopen(req) as resp:
    result = json.loads(resp.read())
    print(result["content"][0]["text"])
```

这正是 SDK 在底层所做的事情。理解原生 HTTP 调用有助于调试。

## 实际运用

在本课程中：

| API | 何时需要 | 免费额度 |
|-----|-----------------|-----------|
| Anthropic（Claude） | 阶段 11-16（智能体、工具） | 注册赠送 $5 额度 |
| OpenAI | 阶段 11（用于对比） | 注册赠送 $5 额度 |
| Hugging Face | 阶段 4-10（模型、数据集） | 免费 |

你现在并不需要全部准备好。等到对应课程需要时再去配置即可。

## 交付成果

本课产出：
- `outputs/prompt-api-troubleshooter.md` —— 诊断常见的 API 错误

## 练习

1. 申请一个 Anthropic API 密钥，并发起你的第一次 API 调用
2. 尝试原生 HTTP 版本，并把它的响应格式与 SDK 版本作对比
3. 故意使用一个错误的 API 密钥，并阅读返回的错误信息

## 关键术语

| 术语 | 人们常说 | 实际含义 |
|------|----------------|----------------------|
| API 密钥（API key） | “API 的密码” | 一个唯一的字符串，用于标识你的账户并授权请求 |
| 速率限制（rate limit） | “他们在限速” | 每分钟/每小时允许的最大请求数，用于防止滥用并确保公平使用 |
| 词元（token） | “一个单词”（在 API 语境下） | 一个计费单位：输入词元与输出词元会被分别计数并分别计费 |
| 流式传输（streaming） | “实时响应” | 逐词获取响应，而不是等待完整响应一次性返回 |
