'use strict';

const { figure } = require('../../../_shared/figkit.js');

const bands = [
  { hue: 'blue', dash: 'dashed', title: 'Deep Agents', pkg: 'deepagents 0.7.38', what: 'create_deep_agent, file tools, subagents' },
  { hue: 'blue', title: 'LangChain', pkg: 'langchain 1.5.0', what: 'create_agent, middleware, init_chat_model' },
  { hue: 'indigo', title: 'LangGraph', pkg: 'langgraph 1.2.22, checkpoint 4.3.2', what: 'StateGraph, Pregel loop, checkpoints, interrupts' },
  { hue: 'plum', title: 'provider packages', pkg: 'langchain-openai 1.8.0, -ollama 1.1.0', what: 'ChatOpenAI, ChatAnthropic, ChatOllama' },
  { hue: 'blue', title: 'LangChain core', pkg: 'langchain-core 1.8.0', what: 'messages, tools, BaseChatModel' },
  { hue: 'grey', title: 'Python 3.11 or later', pkg: 'the kit uses 3.13', what: 'pydantic 2.14.3, httpx, ormsgpack' },
];

module.exports = figure('fig-1-1', {
  height: 470,
  title: 'The four projects and their packages at the pin',
  desc: 'Six horizontal bands stacked from top to bottom: Deep Agents in deepagents 0.7.38 drawn dashed because it is optional, LangChain in langchain 1.5.0 with create_agent and middleware, LangGraph in langgraph 1.2.22 with checkpoints and interrupts, the provider packages such as langchain-openai 1.8.0, LangChain core in langchain-core 1.8.0 with messages and tools, and Python 3.11 or later. A tall box on the right is LangSmith, the langsmith 0.14.17 client and the hosted platform with Agent Server, joined to langchain-core by a dashed line because core imports the client, with tracing off by default.',
}, f => {
  f.kicker(20, 20, 'read down: each layer builds on those below');
  bands.forEach((band, index) => {
    const y = 34 + index * 68;
    f.rect(20, y, 420, 58, { hue: band.hue, dash: band.dash });
    f.text(34, y + 22, band.title, { size: 13, weight: 700, hue: band.hue });
    f.text(426, y + 22, band.pkg, { size: 11, anchor: 'end', hue: 'ink-soft' });
    f.text(34, y + 44, band.what, { size: 11, serif: true, hue: 'ink-soft' });
  });
  f.text(426, 34 + 44, 'optional', { size: 11, serif: true, anchor: 'end', hue: 'blue' });
  f.rect(476, 102, 144, 248, { hue: 'olive' });
  f.text(548, 126, 'LangSmith', { size: 13, weight: 700, anchor: 'middle', hue: 'olive' });
  f.text(548, 146, 'langsmith 0.14.17', { size: 11, anchor: 'middle', hue: 'ink-soft' });
  for (const [i, line] of ['client: traceable,', 'evaluate, run trees', '', 'platform: traces,', 'datasets, prompts,', 'Agent Server'].entries()) {
    if (line) f.text(488, 174 + i * 17, line, { size: 11, serif: true, hue: 'ink-soft' });
  }
  f.line(476, 335, 441, 335, { style: 'effect', head: false });
  f.text(548, 374, 'tracing off until', { size: 11, serif: true, anchor: 'middle', hue: 'olive' });
  f.text(548, 390, 'LANGSMITH_TRACING', { size: 11, anchor: 'middle', hue: 'olive' });
  f.text(548, 406, 'is true', { size: 11, serif: true, anchor: 'middle', hue: 'olive' });
  f.text(548, 428, 'core imports', { size: 11, serif: true, anchor: 'middle', hue: 'ink-mute' });
  f.text(548, 444, 'the client', { size: 11, serif: true, anchor: 'middle', hue: 'ink-mute' });
  f.text(20, 462, 'create_agent returns a langgraph CompiledStateGraph', { size: 11, serif: true, hue: 'ink-mute' });
});
