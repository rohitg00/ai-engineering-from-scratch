# Agentes multimodal e utilização de computadores (Capstone)

> O produto 2026 frontier é um agente multimodal que lê capturas de tela, clique em botões, navega por interfaces web, preenche formulários e completa fluxos de trabalho de ponta a ponta. SeeClick e CogAgent (2024) provaram a primitiva de grounding de GUI. A interface de ferret adicionou móveis. O ChartAgent introduziu o uso de ferramentas visuais para gráficos. VisualWebArena e AgentVista (2026) são os referências que as perseguições de fronteira  e até mesmo Gemini 3 Pro e Claude Opus 4.7 pontuação ~30% nas tarefas difíceis de AgentVista. Esta pedra final reúne todos os fios da Fase 12: percepção (VLM de alta resolução), raciocínio (LLM com uso de ferramentas), aterramento (saída de coordenadas), memória de longo horizonte e avaliação.

**Type:** Capstone
**Languages:** Python (stdlib, action schema + agent loop skeleton), TypeScript
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 12 · 09 (Qwen-VL JSON), Phase 14 (Agent Engineering)
**Time:** ~240 minutes

## Objetivos de aprendizagem

- Desenhar um ciclo de agentes multimodal: perceber → razão → agir → observar → repetir.
- Construir um esquema de saída de aterragem da GUI (coordenadas de clique, texto de tipo, rolamento, arrastar) o VLM pode emitir como JSON.
- Compare agentes apenas para captura de tela versus agentes de árvore de acessibilidade versus agentes híbridos.
- Configurar uma avaliação de referência de agente multimodal em uma pequena faixa do VisualWebArena.

## O problema

Um fluxo de trabalho no local de reserva: "Encontre-me um voo para Tóquio para 15 de abril, assento no corredor de menos de $800, reserva-o".

Um agente multimodal precisa:

1. Tome uma captura de tela do navegador.
2. Partilhe a captura de tela + URL + objetivo em um plano.
3. Emite uma ação estruturada: clique (em x,y), digite "Tokio" (em elemento E), deslize para baixo, selecione (botão de rádio).
4. Aplicar a ação no navegador.
5. Observe o novo estado (próximo captura de tela).
6. Repita até que a tarefa seja concluída.

Cada passo é uma chamada VLM multimodal. A saída VLM deve ser JSON parseável. Os erros compõem-se em todas as etapas, então a recuperação importa.

## O conceito

### A terra da UI  o primitivo

A aterragem da interface gráfica é: dada uma captura de tela e uma instrução de linguagem natural, saia a coordenada (x, y) para clicar (ou outra ação).

SeeClick (arXiv:2401.10935) foi o primeiro resultado aberto em escala: ajuste fino de um VLM em dados sintéticos + GUI real, coordenadas de saída como tokens de texto simples.

CogAgent (arXiv:2312.08914) adicionou 1120x1120 codificação de alta resolução para interfaces de uso densas.

Ferret-UI (arXiv:2404.05719) concentra-se em UI móveis, integra-se com dados de acessibilidade iOS.

O formato de saída é geralmente JSON:

```json
{"action": "click", "x": 384, "y": 220, "element_desc": "Search button"}
```

O `element_desc`ajuda a recuperação: se as coordenadas se deslocarem entre as capturas de tela, a sugestão semântica permite que o sistema re-terrestre.

### Regimes de acção

Um esquema de ação típico tem 6 a 10 tipos de ação:

- `click`(x, y)
- `type`(texto, x?, y?)
- `scroll`: (direcção, quantidade)
- `drag`(x0, y0, x1, y1)
- `select`: (option_index)
- `hover`(x, y)
- `navigate`- Não .
- `wait`(ms)
- `done`(sucesso, explicação)

O agente emite uma ação por passo. O envelope do navegador executa e retorna o novo estado.

### Apenas imagens de tela versus árvore de acessibilidade

Dois modos de entrada:

- Apenas imagem de tela: imagem completa, sem informações estruturais.
- Árvore de acessibilidade: informação estruturada de acessibilidade DOM / iOS. Muito mais confiável para a aterragem; funciona onde a árvore está disponível.
- Híbrido: ambos, com a árvore como base confiável para ações atômicas e a captura de tela para contexto semântico.

Os agentes de produção usam híbridos quando possível. A automação do navegador (Selenium + acessibilidade) sempre tem a árvore; às vezes, os aplicativos de desktop.

### Memória de longo horizonte

Um fluxo de trabalho de 20 passos gera 20 capturas de tela. O contexto do VLM se enche rapidamente.

- Resumo-cadeia: depois de cada 5 passos, resumir o que aconteceu, soltar capturas de tela antigas.
- Skip-frame: mantenha a primeira, a última e cada 3a captura de tela.
- Registo de ferramentas: executa ações, mantenha um registro de texto do que foi feito; não volte a olhar para capturas de tela antigas.

A API de computador do Claude usa o padrão de registro, mais simples e confiável.

### Utilização de ferramentas visuais

O ChartAgent (arXiv:2510.04514) introduz o uso de ferramentas visuais para a compreensão de gráficos: crop, zoom, OCR, chamada de detecção externa. O agente pode emitir "crop to region (100, 200, 300, 400) e depois chamar OCR" como uma chamada de ferramenta. A ferramenta retorna texto; o VLM continua a raciocínio.

Este padrão generaliza: a solicitação de conjunto de marcas, anotação de região e ferramentas de detecção externas se encaixam no mesmo esquema "saia uma chamada de ferramenta, receba uma resposta estruturada".

### Os índices de referência de 2026

- ScreenSpot-Pro. GUI de aterragem em ~ 1k web screenshots. SOTA Qwen2.5-VL-72B ~ 85% Frontier ~ 90%.
- VisualWebArena. tarefas web de ponta a ponta (loja, fórum, anúncios classificados). SOTA aberta ~ 20%. Gemini 3 Pro ~ 27%.
- O modelo de referência mais difícil de 2026: fluxos de trabalho realistas em 12 domínios.
- WebArena / WebShop. Referências mais antigas; saturadas por fronteira.

### Porque é que ainda é difícil

Gargalos de engarrafamento no desempenho do agente:

1. "Clique no pequeno X" falha frequentemente na resolução móvel.
2. Depois de 10 ações, o agente desvia-se do alvo.
3. Recuperação de erro. Quando um clique falha (botão errado), detecção + recuperação raramente é treinado dados.
4. Contexto de página cruzada. Salto entre as fichas ou formulários longos perde estado.

Direcções de investigação: arquiteturas de memória, replanejamento explícito, verificação multimodal (combatimento de imagens de tela para o sucesso da ação).

### A pedra-chave construiu-o

A tarefa final: construir um agente de uso de computador que:

1. Leia a captura de tela HTML + de uma página falsa do site de reserva.
2. Planeja uma sequência de vários passos: busca → selecionar → preencher formulário → enviar.
3. Emite ações JSON correspondentes ao esquema de ação.
4. Avalia em uma faixa fixa de 10 tarefas.

A lição fornece código de andamio que é fácil de estender para um navegador real.

```figure
mm-agent-loop
```

## Usá-lo

`code/main.py`é o andaime de pedra:

- Esquema de ação definição JSON (10 ações: as nove acima listadas mais `screenshot_region`, uma ferramenta de crescimento + zoom).
- O estado do navegador falso como ditado.
- O esqueleto do agente: estado de recepção, emissão de ação, aplicação, ciclo.
- Mini-marca de referência de 10 tarefas (páginas sintéticas) para medir a taxa de sucesso de ponta a ponta.
- Anel de recuperação de erros para quando uma ação falha.

## Envia-o

Esta lição produz`outputs/skill-multimodal-agent-designer.md`. Tendo em conta um produto de utilização informática (domínio, conjunto de ações, meta de avaliação), desenha o ciclo completo de agentes, a estratégia de memória, o modo de aterramento e a pontuação esperada de referência.

## Exercícios

1. O esquema do código adiciona um `screenshot_region`O que é que as tarefas beneficiam?

2. Leia AgentVista (arXiv:2602.23166). Descreva a categoria de tarefas mais difíceis e por que os modelos de fronteira ainda falham.

3. Compressão de memória de longo horizonte: desenhar uma cadeia de resumo com ≤4 capturas de tela mantidas em directo, qualquer número registado.

4. Construir um gancho de recuperação de erros: em falha de ação (botão não encontrado), o que o agente faz a seguir?

5. Compare Claude 4.7 com um screenshot híbrido + árvore de acessibilidade Qwen2.5 - VL em 10 tarefas da web. Qual vence em quais tarefas?

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| GUI grounding | "Click coordinates" | Model outputs (x,y) for the target of an instruction on a screenshot |
| Action schema | "Tool definitions" | JSON description of valid actions (click, type, scroll, drag) |
| Accessibility tree | "Structured DOM" | Machine-readable UI hierarchy from browser/iOS APIs |
| Hybrid agent | "Screenshot + tree" | Uses both image and structured info; more reliable than either alone |
| Visual tool use | "Zoom/crop/detect" | Agent calls external vision tools (OCR, detection) mid-plan |
| Summary-chain | "Memory compression" | Periodic text summaries replace long screenshot history |
| VisualWebArena | "E2E web bench" | 2024 benchmark for end-to-end web tasks |
| AgentVista | "2026 hard bench" | 12-domain realistic workflows; even Gemini 3 Pro scores ~30% |

## Mais leitura

- [Cheng et al. — SeeClick (arXiv:2401.10935)](https://arxiv.org/abs/2401.10935)
- [Hong et al. — CogAgent (arXiv:2312.08914)](https://arxiv.org/abs/2312.08914)
- [You et al. — Ferret-UI (arXiv:2404.05719)](https://arxiv.org/abs/2404.05719)
- [ChartAgent (arXiv:2510.04514)](https://arxiv.org/abs/2510.04514)
- [Koh et al. — VisualWebArena (arXiv:2401.13649)](https://arxiv.org/abs/2401.13649)
- [AgentVista (arXiv:2602.23166)](https://arxiv.org/abs/2602.23166)
