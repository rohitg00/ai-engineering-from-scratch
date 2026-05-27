# 函数调用（Function Calling）与工具使用（Tool Use）

> LLM 什么都做不了。它们只能生成文本。这就是全部能力。它们无法查询天气、无法查询数据库、无法发送邮件、无法运行代码、也无法读取文件。你见过的每一个"AI 智能体"（agent），本质上都是一个 LLM 在生成 JSON，指明要调用哪个函数——然后由你的代码实际去调用它。模型是大脑。工具是双手。函数调用是连接两者的神经系统。

**类型：** 构建
**语言：** Python
**先决条件：** 阶段 11 第 03 课（结构化输出）
**时间：** 约 75 分钟
**关联：** 阶段 11 · 14（模型上下文协议，Model Context Protocol）——当工具需要在不同主机间共享时，需从内联函数调用升级为 MCP 服务器。本课程涵盖内联情况；MCP 涵盖协议情况。

## 学习目标

- 实现一个函数调用循环：定义工具架构（schema），解析模型输出的工具调用 JSON，执行函数，并返回结果
- 设计具有清晰描述和类型化参数的工具架构，使模型能够可靠地调用
- 构建一个多轮智能体循环，能够串联多个函数调用来回答复杂查询
- 处理函数调用的边缘情况：并行工具调用、错误传播以及防止无限工具循环

## 问题

你构建了一个聊天机器人。用户问："现在东京的天气怎么样？"

模型回答："我无法获取实时天气数据，但根据季节推断，东京当前大概在15摄氏度左右……"

这是一个披着免责声明的幻觉。模型不知道天气。它永远不会知道。天气每小时都在变化。模型的训练数据是几个月前的。

正确的答案需要调用 OpenWeatherMap API，获取当前温度，并返回真实数据。模型不能调用 API。但你的代码可以。缺少的环节是：一个结构化协议，允许模型表示"我需要用这些参数调用天气 API"，并让你的代码执行该调用并将结果反馈回来。

这就是函数调用。模型输出结构化的 JSON，描述要调用哪个函数以及使用哪些参数。你的应用程序执行该函数。结果被放回对话中。模型使用这些结果来生成最终答案## 的概念：函数调用循环 概念, 实践应用
的回答。 Figure 1 illustrates ˜e Protool-Use flow.vity, outcome-accept thetool result'

不加函数调用LLM百科全书;加了函数调用LLM Agent Master agreed thetask Figure 2, illustrate the agent loop finishes areturn temperature:int.





的LLM & –) as_; bei roda ultas), outer Reasoner Agent Loop。我

 KV cacheless — can## Tool calling flow diagram: user's query Triggingermany by invoking get_shoulder.png-info-3480 Kope.available. cwq_using Schema Contract. -Lesson _)
 {
 •.currentTopicToolTypeInfoToolCallToolUse Thing LL.To);

 dével assistant tool_calls， byToolDefinition(arguments by Anthropic Gemini Gemini is Claude 只能=_T engaging).aptTether _)ace_  without written

Tags lists «
)


- [1iaret 。 llmagentframework;

publication (e.g-.com/function-c习 how to write prompts that are like structured outputs from: Lesson byword)
這 i,{.CurrentZipO