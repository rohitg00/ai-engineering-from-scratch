# Benchmarks: WebArena e OSWorld

> WebArena testa capacidade de web-agent em quatro apps self-hosted. OSWorld testa capacidade de desktop-agent em Ubuntu, Windows, macOS. No lançamento (2023–2024) ambos mostraram uma grande lacuna entre os melhores agentes e humanos. A lacuna está diminuindo; os modos de falha não mudaram.

**Tipo:** Aprender
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 14 · 19 (SWE-bench, GAIA)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Descrever os quatro apps self-hosted do WebArena e por que avaliação baseada em execução importa.
- Explicar por que o OSWorld usa screenshots reais de OS ao invés de APIs de acessibilidade.
- Nomear os dois principais modos de falha do OSWorld: GUI grounding e conhecimento operacional.
- Resumir o que OSWorld-G e OSWorld-Human adicionam sobre o benchmark base.

## O Problema

Agentes generalistas conseguem chamar tools. Conseguem dirigir um browser por 20 cliques pra completar uma compra? Conseguem configurar uma máquina Linux usando só teclado e mouse? Essas são as perguntas que WebArena e OSWorld respondem.

## O Conceito

### WebArena (Zhou et al., ICLR 2024)

- 812 tarefas de longo horizonte em quatro web apps self-hosted: um site de compras, um fórum, uma ferramenta de dev tipo GitLab, um CMS empresarial.
- Mais utilitários: mapa, calculadora, bloco de notas.
- Avaliação é baseada em execução via gym APIs — o pedido foi feito, a issue foi fechada, a página do CMS foi atualizada?
- No lançamento: melhor agente GPT-4 chegou a 14.41% de sucesso vs humano 78.24%.

O framing self-hosted importa — o benchmark não é instável porque os apps alvo são fixos e reproduzíveis.

### Extensões

- **VisualWebArena** — tarefas visualmente grounding onde sucesso depende de interpretar imagens (screenshots como observações de primeira classe).
- **TheAgentCompany** (dez 2024) — adiciona terminal + codagem; mais parecido com um ambiente real de trabalho remoto.

### OSWorld (Xie et al., NeurIPS 2024)

- 369 tarefas reais de computador em Ubuntu, Windows, macOS.
- Controle livre de teclado e mouse em aplicações reais.
- Screenshots 1920×1080 como observação.
- No lançamento: melhor modelo 12.24% vs humano 72.36%.

### Principais modos de falha

1. **GUI grounding.** Mapeamento pixel → elemento. Modelos têm dificuldade em localizar elementos de UI de forma confiável em 1920×1080.
2. **Conhecimento operacional.** Qual menu tem a config, qual atalho de teclado, qual painel de preferências. Conhecimento que humanos constroem ao longo de anos.

### Acompanhamentos

- **OSWorld-G** — suíte de grounding de 564 amostras + conjunto de treino Jedi. Decomposte grounding de planejamento pra medir separadamente.
- **OSWorld-Human** — trajetórias douradas de ações curadas manualmente. Mostra que os melhores agentes usam 1.4-2.7x mais passos que o necessário (a lacuna de eficiência de trajetória).

### Por que isso importa

Claude computer use, OpenAI CUA, Gemini 2.5 Computer Use (Aula 21) todos treinam em workloads moldados por WebArena e OSWorld. Os benchmarks são a meta; os modelos de produção são a resposta entregue.

### Onde benchmarking dá errado

- **Evals só com screenshot.** OSWorld é screenshot-driven; avaliar um agente que usa DOM ou APIs de acessibilidade no OSWorld perde o desafio de grounding.
- **Ignorar comprimento da trajetória.** Pontuar só taxa de sucesso perde a ineficiência de 1.4-2.7x de passos que o OSWorld-Human revela.
- **Apps self-hosted desatualizados.** Os apps do WebArena fixam versões específicas; atualizar sem re-cura quebra comparabilidade.

## Construa

`code/main.py` implementa um harness toy de web-agent:

- Uma máquina de estados mínima de "app de compras": list_items, add_to_cart, checkout.
- Trajetórias douradas pra 3 tarefas.
- Um agente roteado que tenta cada tarefa.
- Avaliador baseado em execução (checagem de estado) e métrica de eficiência de trajetória (passos vs dourado).

Execute:

```
python3 code/main.py
```

Saída: taxa de sucesso e eficiência de trajetória por tarefa, espelhando a metodologia do OSWorld-Human.

## Use

- **WebArena Verified** self-hosted num cluster interno pra avaliação contínua.
- **OSWorld** numa frota de VMs pra agentes de desktop.
- **Computer-use agents** (Aula 21) — Claude, OpenAI CUA, Gemini — todos treinados em workloads como esses.
- **Seus próprios fluxos de produto** — capture trajetórias douradas pras suas 20 top tarefas; rode agentes contra elas semanalmente.

## Entregue

`outputs/skill-web-desktop-harness.md` constrói um harness web/desktop com eval baseada em execução e métrica de eficiência de trajetória.

## Exercícios

1. Estenda o harness toy com um segundo app (um fórum). Escreva 3 tarefas mais trajetórias douradas.
2. Adicione reporte de eficiência de trajetória por tarefa. No seu toy, o agente tá 1x, 2x ou 3x sobre o dourado?
3. Implemente uma tool "distrator" — uma que a trajetória dourada nunca usa. O agente roteado é tentado?
4. Leia o OSWorld-G. Como você separaria falhas de grounding de falhas de planejamento nas suas próprias evals?
5. Leia o README dos apps do WebArena. O que quebra quando você atualiza uma das versões fixadas dos apps?

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| WebArena | "Benchmark de web-agent" | 812 tarefas em 4 apps self-hosted; avaliação estilo gym |
| VisualWebArena | "WebArena Visual" | WebArena com grounding visual; screenshots são observações |
| OSWorld | "Benchmark de desktop-agent" | 369 tarefas em Ubuntu/Windows/macOS reais |
| GUI grounding | "Mapeamento pixel-to-elemento" | Modelo localizando elementos de UI em 1920x1080 |
| Conhecimento operacional | "Know-how de OS" | Qual menu, qual atalho, qual painel de preferências |
| OSWorld-G | "Suíte de grounding" | 564 amostras só de grounding + conjunto de treino |
| OSWorld-Human | "Trajetórias douradas" | Sequências de ações manuais de especialistas pra medir eficiência |
| Eficiência de trajetória | "Passos sobre o dourado" | Contagem de passos do agente dividida pelo mínimo humano |

## Leitura Complementar

- [Zhou et al., WebArena (arXiv:2307.13854)](https://arxiv.org/abs/2307.13854) — benchmark web de quatro apps
- [Xie et al., OSWorld (arXiv:2404.07972)](https://arxiv.org/abs/2404.07972) — benchmark desktop cross-OS
- [Anthropic, Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) — capacidade do Claude moldada por benchmarks
- [OpenAI, Computer-Using Agent](https://openai.com/index/computer-using-agent/) — números do OSWorld e WebArena
