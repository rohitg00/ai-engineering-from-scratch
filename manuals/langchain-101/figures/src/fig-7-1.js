'use strict';

const fs = require('fs');
const path = require('path');
const { figure } = require('../../../_shared/figkit.js');

const read = name => fs.readFileSync(path.join(__dirname, '../../capture/out', name), 'utf8');
const retrieval = read('39-retrieval.txt');
const dimsMatch = retrieval.match(/"dims": (\d+)/);
if (!dimsMatch) throw new Error('fig-7-1: no dims in 39-retrieval.txt');
const dims = Number(dimsMatch[1]);
const agentText = read('47-retrieval-agent.txt');
const hitMatch = agentText.match(/"type": "ToolMessage",\n\s+"content": "(\[[^\]]+\] [^"]*)"/);
const chunkMatch = agentText.match(/the hit is chunk (\d+) of (\d+)/);
if (!hitMatch || !chunkMatch) throw new Error('fig-7-1: no ToolMessage or hit line in 47-retrieval-agent.txt');
const hit = hitMatch[1];
const shown = hit.length > 74 ? hit.slice(0, hit.lastIndexOf('. ', 72) + 1) : hit;
const chunks = Number(chunkMatch[2]);

module.exports = figure('fig-7-1', {
  height: 330,
  title: 'Index time and query time of the retrieval capture',
  desc: `Two rows. At index time, three Markdown files go to RecursiveCharacterTextSplitter from langchain-text-splitters, which makes ${chunks} chunks of at most 80 characters. OllamaEmbeddings from langchain-ollama, with the model nomic-embed-text, turns each chunk into ${dims} numbers, and InMemoryVectorStore from langchain-core keeps them as doc-0 to doc-${chunks - 1}. At query time, create_agent asks the model, the model calls the tool search_docs, the tool calls a retriever from as_retriever with k equal to 1, the retriever searches the store, and the ToolMessage carries chunk doc-${chunkMatch[1]} back to the model, which starts with "${shown}"`,
}, f => {
  f.kicker(20, 20, 'index time: once');
  const files = f.box({ x: 20, y: 32, w: 128, h: 58, hue: 'violet', title: '3 files', sub: ['checkpoints.md', 'and two more'] });
  const split = f.box({ x: 176, y: 32, w: 136, h: 58, hue: 'blue', title: 'TextSplitter', sub: ['Recursive, size 80', `${chunks} chunks`] });
  const embed = f.box({ x: 340, y: 32, w: 130, h: 58, hue: 'plum', title: 'embedding', sub: ['nomic-embed-text', `${dims} numbers each`] });
  const store = f.box({ x: 498, y: 32, w: 122, h: 58, hue: 'blue', title: 'vector store', sub: ['InMemory', `doc-0 to doc-${chunks - 1}`] });
  f.arrow(files.right(), [split.x - 1, files.cy], { style: 'call' });
  f.arrow(split.right(), [embed.x - 1, split.cy], { style: 'call' });
  f.arrow(embed.right(), [store.x - 1, embed.cy], { style: 'call' });
  f.text(176, 108, 'langchain-text-splitters', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(340, 108, 'langchain-ollama', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(498, 108, 'langchain-core', { size: 11, serif: true, hue: 'ink-soft' });
  f.kicker(20, 146, 'query time: each tool call');
  const agent = f.box({ x: 20, y: 160, w: 128, h: 58, hue: 'indigo', title: 'create_agent', sub: ['model node', 'tools node'] });
  const tool = f.box({ x: 176, y: 160, w: 136, h: 58, hue: 'green', title: 'search_docs', sub: ['@tool, one', 'argument: query'] });
  const retr = f.box({ x: 340, y: 160, w: 130, h: 58, hue: 'blue', title: 'retriever', sub: ['as_retriever', 'k=1'] });
  f.arrow(agent.right(agent.h / 2 - 12), [tool.x - 1, agent.cy - 12], { style: 'call' });
  f.arrow([tool.x - 1, agent.cy + 14], [agent.x + agent.w + 1, agent.cy + 14], { style: 'reply' });
  f.arrow(tool.right(), [retr.x - 1, tool.cy], { style: 'call' });
  f.path(`M${retr.x + retr.w} ${retr.cy} H604 V${store.y + store.h + 1}`, { style: 'call' });
  f.text(562, 160, 'search', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 246, 'The start of the ToolMessage back to the model:', { size: 11, serif: true, hue: 'ink-soft' });
  f.box({ x: 20, y: 256, w: 600, h: 34, hue: 'green', title: shown, titleSize: 11.5, weight: 400, align: 'left' });
  f.text(20, 316, `nomic-embed-text on Ollama picked chunk ${chunkMatch[1]} of ${chunks} for the question of the model.`, { size: 11, serif: true, hue: 'ink-soft' });
});
