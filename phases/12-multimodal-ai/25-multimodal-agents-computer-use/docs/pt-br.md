# Agents Multimodais e Uso de Computador (Capstone)

> O produto de fronteira em 2026 é um agente multimodal que lê screenshots, clica em botões, navega UIs web, preenche formulários e completa workflows de ponta a ponta. SeeClick e CogAgent (2024) provaram a primitiva de fundamentação GUI. Ferret-UI adicionou mobile. ChartAgent introduziu uso de ferramentas visuais para gráficos. VisualWebArena e AgentVista (2026) são os benchmarks que a fronteira persegue — e até Gemini 3 Pro e Claude Opus 4.7 pontuam ~30% nas tarefas difíceis do AgentVista. Este capstone reúne todos os fios da Fase 12: percepção (VLM de alta resolução), raciocínio (LLM com uso de ferramentas), fundamentação (saída de coordenadas), memória de longo prazo e avaliação.

**Tipo:** Capstone
**Linguagens:** Python (stdlib, schema de ação + esqueleto de loop do agent)
**Pré-requisitos:** Fase 12 · 05 (LLaVA), Fase 12 · 09 (Qwen-VL JSON), Fase 14 (Engenharia de Agents)
**Tempo:** ~240 minutos

## Objetivos de Aprendizado

- Projetar um loop de agente multimodal: perceber → raciocinar → agir → observar → repetir.
- Construir um schema de saída de fundamentação GUI (coordenadas de clique, digitar texto, scroll, arrastar) que o VLM pode emitir como JSON.
- Comparar agentes apenas de screenshot vs agentes de accessibility-tree vs agentes híbridos.
- Configurar uma avaliação de benchmark de agente multimodal num pequeno recorte do VisualWebArena.

## O Problemo

Um workflow de site de reservas: "ache um voo pra Tóquio pra 15 de abril, assento na janela abaixo de R$ 400, reserve."

Um agente multimodal precisa:

1. Tirar um screenshot do navegador.
2. Parsear o screenshot + URL + objetivo num plano.
3. Emitir uma ação estruturada: clique (em x,y), digite "Tóquio" (no elemento E), scroll pra baixo, selecione (botão de rádio).
4. Aplicar a ação no navegador.
5. Observar o novo estado (próximo screenshot).
6. Repetir até a tarefa estar completa.

Cada passo é uma chamada multimodal de VLM. Saída do VLM precisa ser JSON parseável. Erros se acumulam entre passos, então recuperação importa.

## O Conceito

### Fundamentação GUI — a primitiva

Fundamentação GUI é: dado um screenshot e uma instrução em linguagem natural, emitir a coordenada (x, y) pra clicar (ou outra ação).

SeeClick (arXiv:2401.10935) foi o primeiro resultado aberto em escala: fine-tune de um VLM em dados GUI sintéticos + reais, saída de coordenadas como tokens de texto simples. Funciona.

CogAgent (arXiv:2312.08914) adicionou codificação de alta resolução 1120x1120 pra UIs densas. Score: ~84% em navegação web.

Ferret-UI (arXiv:2404.05719) foca em UIs mobile, integra com dados de acessibilidade do iOS.

Formato de saída geralmente é JSON:

```json
{"action": "click", "x": 384, "y": 220, "element_desc": "Search button"}
```

O `element_desc` ajuda na recuperação: se as coordenadas deslocam entre screenshots, a dica semântica permite que o sistema refunde.

### Schemas de ação

Um schema de ação típico tem 6-10 tipos de ação:

- `click`: (x, y)
- `type`: (texto, x?, y?)
- `scroll`: (direção, quantidade)
- `drag`: (x0, y0, x1, y1)
- `select`: (option_index)
- `hover`: (x, y)
- `navigate`: (url)
- `wait`: (ms)
- `done`: (sucesso, explicação)

O agente emite uma ação por passo. O wrapper do navegador executa e retorna o novo estado.

### Apenas screenshot vs accessibility-tree

Dois modos de entrada:

- Apenas screenshot: imagem completa, sem informação estrutural. Mais generalista; funciona em qualquer app.
- Accessibility tree: DOM estruturado / informação de acessibilidade iOS. Muito mais confiável pra fundamentação; funciona onde a árvore está disponível.
- Híbrido: ambos, com a árvore como fundamentador confiável pra ações atômicas e o screenshot pra contexto semântico.

Agents em produção usam híbrido quando possível. Automação de navegador (Selenium + accessibility) sempre tem a árvore; apps desktop às vezes têm.

### Memória de longo prazo

Um workflow de 20 passos gera 20 screenshots. Contexto do VLM enche rápido. Três estratégias de compressão:

- Summary-chain: a cada 5 passos, resumir o que aconteceu, descartar screenshots antigos.
- Skip-frame: manter o primeiro, o último, e cada 3º screenshot.
- Log gravado por ferramenta: executar ações, manter um log de texto do que foi feito; não olhar screenshots antigos de novo.

API de computer-use do Claude usa o padrão de log. Mais simples, mais confiável.

### Uso de ferramentas visuais

ChartAgent (arXiv:2510.04514) introduz uso de ferramentas visuais pra compreensão de gráficos: recortar, ampliar, OCR, chamar detecção externa. O agente pode emitir "recortar região (100, 200, 300, 400) e depois chamar OCR" como ferramenta call. A ferramenta retorna texto; o VLM continua raciocinando.

Esse padrão generaliza: set-of-mark prompting, anotação de regiões, e ferramentas de detecção externa se encaixam todos no mesmo schema de "emitir ferramenta call, receber resposta estruturada."

### Os benchmarks de 2026

- ScreenSpot-Pro. Fundamentação GUI em ~1k screenshots web. SOTA aberto Qwen2.5-VL-72B ~85%. Fronteira ~90%.
- VisualWebArena. Tarefas web de ponta a ponta (loja, fórum, classificados). SOTA aberto ~20%. Gemini 3 Pro ~27%.
- AgentVista (arXiv:2602.23166). O benchmark mais difícil de 2026. Workflows realistas em 12 domínios. Modelos de fronteira pontuam 27-40%; modelos abertos 10-20%.
- WebArena / WebShop. Benchmarks mais antigos; saturados pela fronteira.

### Por que ainda é difícil

Gargalos de performance do agent:

1. Fundamentação visual em escala fina. "Clique no X pequeno" falha frequentemente em resolução mobile.
2. Planejamento de longo prazo. Depois de 10 ações, o agente desvia do objetivo.
3. Recuperação de erros. Quando um clique falha (botão errado), detectar + recuperar raramente é dado de treinamento.
4. Contexto entre páginas. Pular entre abas ou formulários longos perde estado.

Direções de pesquisa: arquiteturas de memória, replanejamento explícito, verificação multimodal (correspondência de screenshot pra sucesso de ação).

### Capstone build-it

A tarefa do capstone: construir um agente de computer-use que:

1. Leia o HTML + screenshot de uma página mock de site de reservas.
2. Planeje uma sequência multi-step: buscar → selecionar → preencher formulário → submeter.
3. Emita ações JSON correspondentes ao schema de ação.
4. Avalie num slice fixo de 10 tarefas.

A aula fornece código scaffold fácil de estender pra um navegador real.

## Use

`code/main.py` é o scaffold do capstone:

- Definição JSON do schema de ação (10 ações).
- Estado de navegador simulado como dict.
- Esqueleto do loop do agent: receber estado, emitir ação, aplicar, repetir.
- Mini-benchmark de 10 tarefas (páginas sintéticas) pra medir taxa de sucesso de ponta a ponta.
- Hook de recuperação de erros pra quando uma ação falha.

## Entregue

Esta aula produz `outputs/skill-multimodal-agent-designer.md`. Dado um produto de computer-use (domínio, conjunto de ações, alvo de avaliação), projeta o loop completo do agent, estratégia de memória, modo de fundamentação e score esperado de benchmark.

## Exercícios

1. Estenda o schema de ação com uma ferramenta `screenshot_region` (recorte + ampliação). Que tarefas se beneficiam?

2. Leia AgentVista (arXiv:2602.23166). Descreva a categoria de tarefa mais difícil e por que modelos de fronteira ainda falham.

3. Compressão de memória de longo prazo: projete uma summary-chain com ≤4 screenshots mantidos ativos, qualquer quantidade em log.

4. Construa um hook de recuperação de erros: em falha de ação (botão não encontrado), o que o agente faz depois?

5. Compare Claude 4.7 apenas de screenshot com Qwen2.5-VL híbrido screenshot + accessibility-tree em 10 tarefas web. Qual ganha em quais tarefas?

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|--------------------------|
| Fundamentação GUI | "Coordenadas de clique" | Modelo emite (x,y) pro alvo de uma instrução num screenshot |
| Schema de ação | "Definições de ferramenta" | Descrição JSON de ações válidas (clique, digite, scroll, arraste) |
| Accessibility tree | "DOM estruturado" | Hierarquia de UI legível por máquina de APIs do navegador/iOS |
| Agent híbrido | "Screenshot + árvore" | Usa imagem e informação estruturada; mais confiável que qualquer um sozinho |
| Uso de ferramentas visuais | "Zoom/recorte/deteção" | Agent chama ferramentas visuais externas (OCR, detecção) no meio do plano |
| Summary-chain | "Compressão de memória" | Resumos periódicos de texto substituem histórico longo de screenshots |
| VisualWebArena | "Benchmark web E2E" | Benchmark de 2024 pra tarefas web de ponta a ponta |
| AgentVista | "Benchmark difícil 2026" | Workflows realistas em 12 domínios; até Gemini 3 Pro pontua ~30% |

## Leitura Adicional

- [Cheng et al. — SeeClick (arXiv:2401.10935)](https://arxiv.org/abs/2401.10935)
- [Hong et al. — CogAgent (arXiv:2312.08914)](https://arxiv.org/abs/2312.08914)
- [You et al. — Ferret-UI (arXiv:2404.05719)](https://arxiv.org/abs/2404.05719)
- [ChartAgent (arXiv:2510.04514)](https://arxiv.org/abs/2510.04514)
- [Koh et al. — VisualWebArena (arXiv:2401.13649)](https://arxiv.org/abs/2401.13649)
- [AgentVista (arXiv:2602.23166)](https://arxiv.org/abs/2602.23166)
