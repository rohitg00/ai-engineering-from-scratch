# Referências: WebArena e OSWorld

> WebArena testa a capacidade de agente web em quatro aplicativos auto-hospedados. OSWorld testa a capacidade de agente de desktop em Ubuntu, Windows, macOS. No lançamento (20232024) ambos mostraram uma grande lacuna entre os melhores agentes da classe e os humanos. A lacuna está se reduzindo; os modos de falha não mudaram.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 19 (SWE-bench, GAIA)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Descreva os quatro aplicativos auto-hospedados da WebArena e por que a avaliação baseada na execução é importante.
- Explique por que o OSWorld usa capturas de tela reais do sistema operacional em vez de APIs de acessibilidade.
- Nomear os dois principais modos de falha do OSWorld: conectividade de interface gráfica e conhecimento operacional.
- Resumir o que os OSWorld-G e os OSWorld-Human adicionam ao índice de referência base.

## O problema

Os agentes generalistas podem chamar ferramentas. Eles podem dirigir um navegador em 20 cliques para concluir um checkout de compras? Eles podem configurar uma caixa Linux usando apenas teclado e mouse? Estas são as perguntas que WebArena e OSWorld respondem.

## O conceito

### WebArena (Zhou et al., ICLR 2024)

- 812 tarefas de longo horizonte em quatro aplicativos web auto-hospedados: um site de compras, um fórum, uma ferramenta de desenvolvimento como o GitLab, um CMS empresarial.
- Além de utilidades: mapa, calculadora, scratchpad.
- A avaliação é baseada na execução através de APIs de ginásio  foi a ordem colocada, foi o problema encerrado, foi a página do CMS atualizada?
- Na liberação: melhor agente GPT-4 atingiu 14,41% de sucesso contra humano 78,24%.

O enquadramento auto-hosted importa  o índice de referência não é escorregadio porque os aplicativos-alvo são fixados e reprodutíveis.

### Extensões

- **VisualWebArena** tarefas baseadas em elementos visuais, onde o sucesso depende da interpretação das imagens (câmpanhas de tela como observações de primeira classe).
- **TheAgentCompany**(Dec 2024)  adiciona terminal + codificação; mais como um ambiente de trabalho remoto real.

### OSWorld (Xie et al., NeurIPS 2024)

- 369 tarefas reais de computador em Ubuntu, Windows, macOS.
- Controle de teclado e mouse de forma livre de aplicações reais.
- 1920×1080 capturas de tela como observação.
- No momento da liberação: melhor modelo 12,24% vs humano 72,36%.

### Modos de falha primária

1. **GUI grounding.**Mapeamento de pixel → elemento. Os modelos lutam para localizar os elementos da interface de forma confiável em 1920×1080.
2. **Operational knowledge.**Qual menu tem a configuração, qual atalho de teclado, qual painel de preferências.

### Seguimento

- **OSWorld-G**564 amostras de terra + Jedi treinamento conjunto.
- **OSWorld-Human**- trajetórias de acção do ouro seleccionadas manualmente.

### Por que isto importa

Claude uso de computadores, OpenAI CUA, Gemini 2.5 Uso de computadores (Lessão 21) todos treinam em cargas de trabalho moldadas pela WebArena e OSWorld.

### Onde a análise comparativa vai mal

- **Screenshot-only evals.**O OSWorld é guiado por captura de tela; avaliar um agente que usa DOM ou APIs de acessibilidade no OSWorld perde o desafio de aterrissagem.
- **Ignoring trajectory length.**A pontuação apenas de taxa de sucesso perde a ineficiência de 1,4-2,7x nas superfícies OSWorld-Human.
- **Stale self-hosted apps.**Os aplicativos da WebArena pin versões específicas; atualização sem re-curatização quebra comparabilidade.

```figure
ae-agent-human-gap
```

## Construí-lo

`code/main.py`Implementa um arnes de agentes de web de brinquedo:

- Uma máquina de estado "aplicativo de compras" mínima: list_items, add_to_cart, checkout.
- Tráetoras de ouro para 3 tarefas.
- Um agente com guião que tenta cada tarefa.
- Avaliação baseada na execução (controle de estado) e métrica de eficiência de trajetória (pasos versus ouro).

- É o que é ?

```
python3 code/main.py
npx tsx code/main.ts
```

Resultado: taxa de sucesso por tarefa e eficiência de trajetória, que refletem a metodologia da OSWorld-Human.

## Usá-lo

- **WebArena Verified**auto-hostado num cluster interno para avaliação contínua.
- **OSWorld**numa frota de máquinas virtuais para agentes de desktop.
- **Computer-use agents**(Lessão 21) Claude, OpenAI CUA, Gemini, todos treinados para carregar tarefas como esta.
- **Your own product flows** capturar trajetórias de ouro para as suas 20 principais tarefas; executar agentes contra eles semanalmente.

## Envia-o

`outputs/skill-web-desktop-harness.md`Construirá um arsenal de agentes web/desktop com métricas de avaliação e eficiência de trajetória baseadas em execução.

## Exercícios

1. Estende o arame de brinquedo com um segundo aplicativo (um fórum). Escreva 3 tarefas mais trajetórias de ouro.
2. Adicione o relatório de eficiência de trajetória por tarefa.
3. Implementar uma ferramenta "distractor" que a trajetória do ouro nunca usa.
4. Como separaria as falhas de aterragem das falhas de planeamento nas suas próprias avaliações?
5. Leia os aplicativos do WebArena README. O que se rompe quando você atualiza uma das versões de aplicativos fixadas?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| WebArena | "Web agent benchmark" | 812 tasks across 4 self-hosted apps; gym-style evaluation |
| VisualWebArena | "Visual WebArena" | Visually grounded WebArena; screenshots are observations |
| OSWorld | "Desktop agent benchmark" | 369 tasks on real Ubuntu/Windows/macOS |
| GUI grounding | "Pixel-to-element mapping" | Model localizing UI elements in 1920x1080 |
| Operational knowledge | "OS know-how" | Which menu, which shortcut, which preference pane |
| OSWorld-G | "Grounding suite" | 564 grounding-only samples + training set |
| OSWorld-Human | "Gold trajectories" | Manual expert action sequences to measure efficiency |
| Trajectory efficiency | "Steps over gold" | Agent step count divided by human minimum |

## Mais leitura

- [Zhou et al., WebArena (arXiv:2307.13854)](https://arxiv.org/abs/2307.13854) Referência web de quatro aplicações
- [Xie et al., OSWorld (arXiv:2404.07972)](https://arxiv.org/abs/2404.07972) Referência de desktop cross-OS
- [Anthropic, Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) Capacidade de referência de Claude
- [OpenAI, Computer-Using Agent](https://openai.com/index/computer-using-agent/) Números OSWorld e WebArena
