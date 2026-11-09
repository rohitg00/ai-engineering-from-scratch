# Reflexão: Aprendizagem por reforço verbal

> A RL baseada em gradientes precisa de milhares de testes e um cluster de GPU para corrigir um modo de falha. Reflexion (Shinn et al., NeurIPS 2023) faz isso em linguagem natural: após cada teste falhado, o agente escreve uma reflexão, armazená-la em memória episódica e condiciona o próximo teste nessa memória. Este é o padrão por trás do cálculo do tempo de sono da Letta, das aprendizagens do Claude Code CLAUDE.md e da regra de aprendizagem pro-fluxo de trabalho.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 02 (ReWOO)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Nome os três componentes da Refleção (Ator, Avalador, Auto-Reflector) e o papel da memória episódica.
- Implementar um loop de reflexão stdlib com avaliador binário, buffer de reflexão e novas tentativas de repetição.
- Escolha entre fontes de feedback escalares, heurísticas e auto-avaliações para uma determinada tarefa.
- Explique por que o reforço verbal detecta erros que a RL baseada em gradientes precisaria de milhares de testes para corrigir.

## O problema

Um agente falha numa tarefa. Em RL padrão você executaria milhares de testes mais, calcular gradientes, atualizar pesos.

A reflexão (Shinn et al., arXiv:2303.11366) faz uma pergunta diferente: e se o agente pensasse apenas em por que falhou e tentasse novamente com esse pensamento em seu prompt?

O resultado: no ALFWorld, ele supera o ReAct e outras linhas de base não-finamente sintonizadas. No HotpotQA, ele melhora em relação ao ReAct. Na geração de código (HumanEval / MBPP) ele define o estado da arte na época. Tudo sem um único passo de gradiente.

## O conceito

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

Um teste é realizado pelo ator. O avaliador o marca. Se a pontuação for baixa, o auto-reflector produz uma reflexão ("Escolhi a ferramenta errada porque li mal a pergunta como perguntando sobre X quando estava perguntando sobre Y"). A reflexão entra na memória episódica.

### Três tipos de avaliadores

1. **Scalar**- um sinal binário externo. ALFWorld é bem-sucedido ou falha. testes HumanEval passar ou falhar.
2. **Heuristic** assinaturas de falha predefinidas. "Se o agente tiver produzido a mesma ação duas vezes seguidas, marque como bloqueado". "Se a trajetória exceder 50 passos, marque como ineficiente".
3. **Self-evaluated**O Mestrado em Direito e Direito do Trabalho (LLM) tem uma trajetória própria.

O padrão 2026 é uma mistura: escalar quando disponível, auto-equivalente quando não, heurísticas como trilhas de segurança.

### Por que isso generaliza

A reflexão não é um novo algoritmo, mas sim um padrão com nome.

- Computação de tempo de sono de Letta (Lessão 08): um agente separado reflete sobre conversas passadas e escreve para blocos de memória.
- O Claude Code.`CLAUDE.md`/ padrão de "salvar memória": reflexões capturadas como aprendizagem, prependidas para futuras sessões.
- Pro-fluxo de trabalho `/learn-rule`comando: correções capturadas como regras explícitas.
- Os nós de reflexão do LangGraph: um nó que marca a saída e as rotas para refinar se necessário.

Todos derivam da mesma percepção: a linguagem natural é um meio rico o suficiente para levar "o que aprendi do fracasso" entre corridas.

### Quando funciona e quando não funciona

A reflexão funciona quando:

- Há um sinal de falha claro (falha de teste, erro de ferramenta, resposta errada).
- A classe de tarefas é reprodutiva (o mesmo tipo de pergunta pode ser repetida).
- A reflexão tem espaço para melhorar a trajetória (orçamento de acção suficiente).

A reflexão não ajuda quando:

- O agente já tem sucesso na primeira tentativa.
- A falha é externa (rede desligada, ferramenta quebrada)  a reflexão sobre "a rede estava desligada" não ajuda futuras operações.
- O reflexo transforma-se em superstição, armazenando uma narrativa sobre uma corrida única.

2026 trampa: rotação da memória. Reflexões se acumulam; alguns são obsoletos ou errados; re-runs ficam mais lentos à medida que o buffer episódico cresce. Mitigation: compactação periódica (Lessão 06), TTL em reflexões, ou um agente de limpeza separado no tempo de sono (Letta).

```figure
react-trace
```

## Construí-lo

`code/main.py`O ator emite listas de candidatos; o avaliador verifica a soma; o autor-reflector escreve uma linha sobre o que correu mal. A reflexão entra na memória episódica para o próximo teste.

Componentes:

- `Actor` uma política escrita que melhora quando vê reflexões.
- `Evaluator.binary()` Passar/falhar na quantia-alvo.
- `SelfReflector` gera um diagnóstico de falha de linha única.
- `EpisodicMemory` uma lista limitada com semântica TTL.

- É o que é ?

```
python3 code/main.py
npx tsx code/main.ts
```

O rastro mostra três ensaios. Ensaios 1 falha, um reflexo é armazenado, ensaios 2 vê o reflexo e melhora, mas ainda falha, ensaios 3 é bem sucedido. Compare com uma execução de linha de base (sem reflexo)  ele permanece preso na resposta de ensaios 1.

## Usá-lo

O LangGraph envia a reflexão como um padrão de nós.`/memory`O comando e o fluxo de trabalho pro `/learn-rule`Externalize o buffer episódico como um arquivo de marcação. O computador de tempo de sono de Letta executa o Auto-Reflector em tempo de inatividade para que o agente primário permaneça limitado à latência. O OpenAI Agents SDK não envia Reflexion diretamente; você o constrói com um Guardrail personalizado que rejeita trajetórias por pontuação e memória`Session`que sobrevive através de corridas.

## Envia-o

`outputs/skill-reflexion-buffer.md`cria e mantém um buffer episódico com captura de reflexão, TTL e deduplicação. Dada uma classe de tarefas e uma falha, emite um reflexo que realmente ajuda o próximo teste (não um genérico "seja mais cuidadoso").

## Exercícios

1. Passe de avaliador binário para avaliador escalar que retorna uma métrica de distância (quão longe do alvo).
2. Adicione um TTL de 10 testes às reflexões.
3. Implementar avaliador heurístico: marque o ensaio como preso se a mesma ação se repetir. Como isso interage com o Auto-Reflector?
4. Exerce Reflexion com um Actor adversário que ignora os reflexos.
5. Leia a secção 4 do artigo Reflexão sobre AlfWorld. Reproduzir a melhoria da taxa de sucesso de 130% conceptualmente: qual é a chave delta vs. vanilla ReAct?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Reflexion | "Self-correction" | Shinn et al. 2023 — Actor, Evaluator, Self-Reflector plus episodic memory |
| Verbal reinforcement | "Learning without gradients" | Natural-language reflection prepended to the next trial's prompt |
| Episodic memory | "Per-task reflections" | Bounded buffer of prior reflections for one task class |
| Scalar evaluator | "Binary success signal" | Pass/fail or numeric score from ground truth |
| Heuristic evaluator | "Pattern-based detector" | Predefined failure signatures (e.g. stuck-loop, too-many-steps) |
| Self-evaluator | "LLM-as-judge on own trace" | Lower-signal fallback when no ground truth — pair with tool-grounded verification |
| Memory rot | "Stale reflections" | Episodic buffer fills with obsolete entries; fix with compaction/TTL |
| Sleep-time reflection | "Async self-reflection" | Run Self-Reflector off the hot path so primary agent stays fast |

## Mais leitura

- [Shinn et al., Reflexion: Language Agents with Verbal Reinforcement Learning (arXiv:2303.11366)](https://arxiv.org/abs/2303.11366) o papel canônico
- [Letta, Sleep-time Compute](https://www.letta.com/blog/sleep-time-compute) Reflexão de sincronia na produção
- [Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) Gestão do buffer episódico como parte do contexto
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) padrão de nó de reflecção
