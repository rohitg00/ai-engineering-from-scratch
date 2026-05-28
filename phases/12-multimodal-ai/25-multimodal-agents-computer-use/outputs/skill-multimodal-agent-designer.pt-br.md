---
name: multimodal-agent-designer
description: Projete um agente multimodal (uso de computador, base de GUI, web ou móvel) com esquema de ação, estratégia de memória e plano de avaliação de benchmark.
version: 1.0.0
phase: 12
lesson: 25
tags: [multimodal-agents, computer-use, gui-grounding, visualwebarena, agentvista]
---

Dada uma especificação de produto para uso em computador (domínio, conjunto de ações, alvo de avaliação), projete o loop do agente, a estratégia de memória, o modo de aterramento e a avaliação.

Produzir:

1. Esquema de ação. Definição JSON de ações suportadas (clicar, digitar, rolar, arrastar, selecionar, navegar, concluir, além de quaisquer ferramentas visuais).
2. Modo de entrada. Somente captura de tela, árvore de acessibilidade ou híbrida. Padrão híbrido para navegadores; apenas captura de tela para aplicativos de desktop sem ganchos de acessibilidade.
3. Escolha do modelo. Qwen2.5-VL-72B (aberto), Claude Opus 4.7 para uso em computador (fechado, forte), GPT-5 (fechado, mais forte). Justifique por referência e custo.
4. Estratégia de memória. Cadeia de resumo a cada 5 etapas + 2 últimas capturas de tela ao vivo; somente log para fluxos de trabalho muito longos.
5. Recuperação de erros. Em caso de falha da ação, aterre novamente por meio da dica semântica element_desc; tente novamente até 2 vezes; voltar ao replanejamento.
6. Plano de avaliação. ScreenSpot-Pro para aterramento, VisualWebArena para ponta a ponta, AgentVista para fluxos de trabalho difíceis de várias etapas. Nível de pontuação esperado.

Rejeições difíceis:
- Usando saída de ação de texto livre. Sempre estruturado em JSON com esquema explícito.
- Reivindicar modelos 7B abertos corresponde à fronteira no AgentVista. A diferença é de 10 a 20 pontos.
- Baseando-se na memória de coordenadas nas capturas de tela. As coordenadas oscilam entre as capturas.

Regras de recusa:
- Se o produto exigir fluxos de trabalho com mais de 50 etapas, recuse o loop de agente único e recomende a divisão hierárquica de planejador + executor.
- Se o produto funcionar em uma plataforma regulamentada sem ganchos de acessibilidade, sinalize o limite de confiabilidade apenas da captura de tela e proponha uma verificação pesada.
- Se a categoria de tarefa estiver fora das distribuições treinadas (software industrial especializado), recuse os produtos prontos para uso e proponha ajustes finos nas capturas de tela do domínio.

Saída: design de agente de uma página com esquema de ação, modo de entrada, escolha de modelo, memória, recuperação, avaliação. Termine com arXiv 2401.10935 (SeeClick), 2401.13649 (VisualWebArena), 2602.23166 (AgentVista).