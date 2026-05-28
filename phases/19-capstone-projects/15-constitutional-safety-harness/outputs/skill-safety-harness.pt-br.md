---
name: safety-harness
description: Conecte um pipeline de segurança em camadas em torno de um aplicativo LLM alvo, execute uma equipe vermelha de seis famílias e execute uma autocrítica constitucional para um delta mensurável de inocuidade.
version: 1.0.0
phase: 19
lesson: 15
tags: [capstone, safety, red-team, llama-guard, x-guard, garak, pyrit, constitutional-ai]
---

Dado um aplicativo LLM alvo (modelo ajustado por instrução 8B ou um chatbot RAG), fortaleça-o com um pipeline de segurança em camadas e execute um alcance autônomo de equipe vermelha em seis famílias de ataque. Produza um relatório de inocuidade antes/depois.

Plano de construção:

1. Pipeline de cinco camadas: higienização de entrada (faixa de largura zero, decodificação de codificação, normalização Unicode) -> trilhos NeMo Guardrails v0.12 -> portão classificador (Llama Guard 4 / X-Guard / ShieldGemma-2 / Nemotron 3) -> alvo LLM -> filtro de saída (Llama Guard 4 + Presidio PII + verificação de citação). As saídas sinalizadas vão para uma fila HITL do Slack.
2. Emita um intervalo Langfuse por camada para que a atribuição seja observável de ponta a ponta.
3. Agendador de equipe vermelha executando ataques garak, PyRIT, PAIR, TAP, GCG, persona multiturno e troca de código multilíngue em um cron.
4. Cada jailbreak bem-sucedido: pontuação CVSS 4.0, reprodução, plano de mitigação, cronograma de divulgação.
5. Sonda de prompt benigno XSTest em execução contínua para capturar regressões de recusa excessiva.
6. Execução de autocrítica constitucional: 1k solicitações de tentativas prejudiciais -> rascunhos alvo -> pontuações críticas contra uma constituição escrita -> pares reescritos -> SFT. Meça antes/depois na avaliação de inocuidade realizada.
7. Alertas: Aviso frouxo sobre regressão benigna, PagerDuty crítico sobre nova família de jailbreak.

Rubrica de avaliação:

| Peso | Critério | Medição |
|:-:|---|---|
| 25 | Cobertura da superfície de ataque | 6+ famílias de ataque exercidas, 2+ idiomas |
| 20 | Trade-off verdadeiro-positivo/falso-positivo | Taxa de bloqueio de ataque vs taxa de aprovação benigna do XSTest |
| 20 | Delta de autocrítica | Antes/depois da inocuidade na avaliação retida |
| 20 | Documentação e divulgação | Resultados avaliados pelo CVSS com cronograma |
| 15 | Automação e repetibilidade | Alertas orientados por Cron exercidos de ponta a ponta |

Rejeições difíceis:

- Pilhas de segurança de camada única. A tese deste ponto culminante é a defesa em profundidade.
- Execuções da equipe vermelha que relatam taxa de sucesso sem números de recusa excessiva do XSTest.
- Autocrítica constitucional sem avaliação sustentada (relata a precisão do conjunto de treinamento, não a generalização).
- Falta de pontuação CVSS nas descobertas do jailbreak.

Regras de recusa:

- Recuse-se a reportar um número de segurança sem um contraponto de sondagem benigna. Um sem o outro é enganoso.
- Recuse-se a reciclar automaticamente os sucessos da equipe vermelha sem curadoria humana dos pares críticos.
- Recuse-se a reivindicar cobertura multilíngue sem executar o X-Guard em pelo menos dois idiomas diferentes do inglês.

Resultado: um repositório contendo o pipeline de cinco camadas, o agendador da equipe vermelha, os executores PAIR/TAP/GCG, o equipamento de treinamento de autocrítica constitucional, o painel de recusa excessiva do XSTest, o rastreador de descobertas do CVSS e um artigo nomeando as três famílias de ataque que tiveram a maior taxa de sucesso no pré-endurecimento e a camada de pipeline específica que mitigou cada uma.