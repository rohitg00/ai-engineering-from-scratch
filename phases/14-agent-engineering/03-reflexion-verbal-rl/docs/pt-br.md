# Reflexion: Aprendizado por Reforço Verbal

> RL baseado em gradiente precisa de milhares de tentativas e um cluster de GPU pra corrigir um modo de falha. Reflexion (Shinn et al., NeurIPS 2023) faz isso em linguagem natural: após cada tentativa fracassada, o agente escreve uma reflexão, armazena em memória episódica e condiciona a próxima tentativa nessa memória. Esse é o padrão por trás do sleep-time compute da Letta, do CLAUDE.md do Claude Code e do learn-rule do pro-workflow.

**Tipo:** Construção
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 14 · 01 (Agent Loop), Fase 14 · 02 (ReWOO)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Nomear os três componentes do Reflexion (Actor, Evaluator, Self-Reflector) e o papel da memória episódica.
- Implementar um loop Reflexion com stdlib com avaliador binário, buffer de reflexão e novas tentativas.
- Escolher entre fontes de feedback escalar, heurísticas e auto-avaliadas pra uma dada tarefa.
- Explicar por que o reforço verbal pega erros que RL baseado em gradiente precisaria de milhares de tentativas pra corrigir.

## O Problema

Um agente falha numa tarefa. Em RL padrão você rodaria milhares de tentativas, computaria gradientes, atualizaria pesos. Caro, lento, e a maioria dos agentes de produção não tem orçamento de treino pra cada falha.

Reflexion (Shinn et al., arXiv:2303.11366) faz uma pergunta diferente: e se o agente só pensasse sobre por que falhou e tentasse de novo com esse pensamento no seu prompt? Sem atualização de pesos. Sem gradiente. Só linguagem natural armazenada entre tentativas.

O resultado: no ALFWorld ele supera ReAct e outros baselines não fine-tunados. No HotpotQA ele melhora sobre ReAct. Em geração de código (HumanEval/MBPP) ele define o estado da arte na época. Tudo sem um único passo de gradiente.

## O Conceito

### Os três componentes

```
Actor         : generates a trajectory (ReAct-style loop)
Evaluator     : scores the trajectory — binary, heuristic, or self-eval
Self-Reflector: writes a natural-language reflection on the failure
```

Mais uma estrutura de dados:

```
Episodic memory: list of prior reflections, prepended to the next trial's prompt
```

Uma tentativa roda o Actor. Evaluator pontua. Se a pontuação é baixa, Self-Reflector produz uma reflexão ("Eu escolhi a ferramenta errada porque li a pergunta como se fosse sobre X quando era sobre Y"). A reflexão vai pra memória episódica. A próxima tentativa começa do zero mas vê a reflexão.

### Três tipos de avaliador

1. **Escalar** — um sinal binário externo. ALFWorld passa ou falha. Testes do HumanEval passam ou falham. O mais simples, maior sinal.
2. **Heurístico** — assinaturas de falha predefinidas. "Se o agente produziu a mesma ação duas vezes seguidas, marcar como travado." "Se a trajectory exceder 50 etapas, marcar como ineficiente."
3. **Auto-avaliado** — o LLM pontua sua própria trajectory. Necessário quando não há ground truth disponível. Sinal mais fraco; combina bem com verificação ancorada em ferramenta (Aula 05 — CRITIC).

O padrão de 2026 é uma mistura: escalar quando disponível, auto-avaliado quando não, heurísticas como rails de segurança.

### Por que isso generaliza

Reflexion não é tanto um novo algoritmo quanto um padrão nomeado. Quase todo agente "auto-reparável" de produção roda alguma variante:

- Sleep-time compute da Letta (Aula 08): um agente separado reflete sobre conversas passadas e escreve em blocos de memória.
- Padrão `CLAUDE.md` / "save memory" do Claude Code: reflexões capturadas como aprendizados, prepended em sessões futuras.
- Comando `/learn-rule` do pro-workflow: correções capturadas como regras explícitas.
- Nós de reflexão do LangGraph: um nó que pontua saída e roteia pra refinar se necessário.

Todos derivam do mesmo insight: linguagem natural é um meio rico o suficiente pra carregar "o que aprendi com a falha" entre execuções.

### Quando funciona e quando não

Reflexion funciona quando:

- Há um sinal claro de falha (falha de teste, erro de ferramenta, resposta errada).
- A classe de tarefa é reprodutível (o mesmo tipo de pergunta pode ser feita de novo).
- A reflexão tem espaço pra melhorar na trajectory (orçamento de ação suficiente).

Reflexion não ajuda quando:

- O agente já acerta na primeira tentativa.
- A falha é externa (rede caiu, ferramenta quebrada) — refletir sobre "a rede caiu" não ajuda execuções futuras.
- A reflexão vira superstição — armazenar uma narrativa sobre uma execução instável pontual.

Armadilha de 2026: decomposição de memória. Reflexões acumulam; algumas ficam obsoletas ou erradas; re-execuções ficam mais lentas à medida que o buffer episódico cresce. Mitigação: compactação periódica (Aula 06), TTL nas reflexões ou um agente separado de limpeza em horário de descanso (Letta).

## Construa

`code/main.py` implementa Reflexion num puzzle de exemplo: produzir uma lista de 3 elementos que soma a um alvo. Actor emite listas candidatas; Evaluator verifica a soma; Self-Reflector escreve uma linha sobre o que deu errado. A reflexão vai pra memória episódica pra próxima tentativa.

Componentes:

- `Actor` — uma política programada que melhora quando vê reflexões.
- `Evaluator.binary()` — passa/falha na soma alvo.
- `SelfReflector` — gera um diagnóstico de uma linha sobre a falha.
- `EpisodicMemory` — uma lista limitada com semântica de TTL.

Rode:

```
python3 code/main.py
```

O trace mostra três tentativas. Tentativa 1 falha, uma reflexão é armazenada, tentativa 2 vê a reflexão e melhora mas ainda falha, tentativa 3 passa. Compare com uma execução baseline (sem reflexão) — fica travada na resposta da tentativa 1.

## Use

LangGraph entrega reflexão como padrão de nó. Comando `/memory` do Claude Code e `/learn-rule` do pro-workflow externalizam o buffer episódico como um arquivo markdown. O sleep-time compute da Letta roda o Self-Reflector em downtime pra que o agente principal fique com latência limitada. OpenAI Agents SDK não entrega Reflexion diretamente; você constrói com um Guardrail customizado que rejeita trajectories por pontuação e uma `Session` de memória que persiste entre execuções.

## Entregue

`outputs/skill-reflexion-buffer.md` cria e mantém um buffer episódico com captura de reflexão, TTL e deduplicação. Dada uma classe de tarefa e uma falha, ele emite uma reflexão que realmente ajuda a próxima tentativa (não um genérico "seja mais cuidadoso").

## Exercícios

1. Troque de avaliador binário pra um escalar que retorna uma métrica de distância (quão longe do alvo). Ele converge mais rápido?
2. Adicione um TTL de 10 tentativas nas reflexões. Reflexões mais velhas ajudam ou prejudicam depois desse ponto?
3. Implemente avaliador heurístico: marque a tentativa como travada se a mesma ação se repete. Como isso interage com o Self-Reflector?
4. Rode Reflexion com um Actor adversarial que ignora reflexões. Qual é o mínimo de engenharia de prompt de reflexão que força o Actor a notá-las?
5. Leia a Seção 4 do paper do Reflexion sobre AlfWorld. Reproduza a melhoria de 130% na taxa de sucesso conceitualmente: qual é a diferença-chave vs ReAct vanilla?

## Termos-Chave

| Termo | O que a galera fala | O que realmente significa |
|-------|---------------------|---------------------------|
| Reflexion | "Auto-correção" | Shinn et al. 2023 — Actor, Evaluator, Self-Reflector mais memória episódica |
| Verbal reinforcement | "Aprendizado sem gradientes" | Reflexão em linguagem natural prepended no prompt da próxima tentativa |
| Episodic memory | "Reflexões por tarefa" | Buffer limitado de reflexões anteriores pra uma classe de tarefa |
| Scalar evaluator | "Sinal binário de sucesso" | Passa/falha ou pontuação numérica do ground truth |
| Heuristic evaluator | "Detector baseado em padrões" | Assinaturas de falha predefinidas (ex: loop travado, muitas etapas) |
| Self-evaluator | "LLM como juiz da própria trajectory" | Fallback com sinal mais fraco quando não há ground truth — combine com verificação ancorada em ferramenta |
| Memory rot | "Reflexões obsoletas" | Buffer episódico enche de entradas obsoletas; conserte com compactação/TTL |
| Sleep-time reflection | "Auto-reflexão assíncrona" | Rode Self-Reflector fora do caminho crítico pra que o agente principal fique rápido |

## Leitura Complementar

- [Shinn et al., Reflexion: Language Agents with Verbal Reinforcement Learning (arXiv:2303.11366)](https://arxiv.org/abs/2303.11366) — o paper canônico
- [Letta, Sleep-time Compute](https://www.letta.com/blog/sleep-time-compute) — reflexão assíncrona em produção
- [Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — gerenciando o buffer episódico como parte do contexto
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) — padrão de nó de reflexão
