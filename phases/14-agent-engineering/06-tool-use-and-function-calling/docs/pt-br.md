# Uso de Ferramentas e Function Calling

> Toolformer (Schick et al., 2023) começou a anotação auto-supervisionada de ferramentas. Berkeley Function Calling Leaderboard V4 (Patil et al., 2025) define a régua de 2026: 40% agentic, 30% multi-turn, 10% live, 10% non-live, 10% alucinação. Single-turn tá resolvido. Memória, tomada de decisão dinâmica e cadeias de ferramentas de longo horizonte não.

**Tipo:** Construção
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 14 · 01 (Agent Loop), Fase 13 · 01 (Function Calling Deep Dive)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Explicar o sinal de treino auto-supervisionado do Toolformer: manter anotações de ferramenta só quando a execução reduz a perda no próximo token.
- Nomear as cinco categorias de avaliação do BFCL V4 e o que cada uma mede.
- Implementar um registro de ferramentas com stdlib com validação de schema, coerção de argumentos e sandboxing de execução.
- Diagnosticar os três problemas abertos de 2026: cadeamento de ferramentas de longo horizonte, tomada de decisão dinâmica e memória.

## O Problema

O uso de ferramentas cedo perguntava: o modelo consegue prever uma chamada de função correta? O uso moderno de ferramentas pergunta: o modelo consegue encadear ferramentas em 40 etapas, com memória, com observabilidade parcial, com recuperação de falhas de ferramenta, sem alucinar ferramentas que não existem?

Toolformer estabeleceu o baseline: modelos podem aprender quando chamar ferramentas com auto-supervisão. BFCL V4 define o alvo de avaliação de 2026. O gap entre eles é o espaço onde agents de produção vivem.

## O Conceito

### Toolformer (Schick et al., NeurIPS 2023)

Ideia: deixe o modelo anotar seu próprio corpus de pre-treinamento com chamadas de API candidatas. Para cada candidata, execute. Mantenha a anotação só se incluir o resultado da ferramenta reduzir a perda no próximo token. Fine-tune no corpus filtrado.

Ferramentas cobertas: calculadora, sistema de QA, mecanismos de busca, tradutor, calendário. O sinal de auto-supervisão é puramente sobre se a ferramenta ajuda a prever texto — sem rótulos humanos.

Resultado de escala: uso de ferramentas emerge na escala. Modelos menores sofrem com anotações de ferramenta; modelos maiores ganham. É por isso que modelos frontier de 2026 têm uso de ferramentas forte embutido enquanto a maioria dos modelos de 7B precisa de fine-tuning explícito de uso de ferramenta pra ser confiável.

### Berkeley Function Calling Leaderboard V4 (Patil et al., ICML 2025)

BFCL é a avaliação de facto de 2026. Composição do V4:

- **Agentic (40%)** — trajectories completas de agent: memória, multi-turn, decisões dinâmicas.
- **Multi-Turn (30%)** — conversas interativas com cadeias de ferramentas.
- **Live (10%)** — prompts reais submetidos por usuários (distribuição mais difícil).
- **Non-Live (10%)** — casos de teste sintéticos.
- **Hallucination (10%)** — detectar quando nenhuma ferramenta deve ser chamada.

V3 introduziu avaliação baseada em estado: após uma sequência de ferramentas, checar o estado real da API (ex: "o arquivo foi criado?") em vez de casar o AST das chamadas de ferramenta. V4 adicionou categorias de busca web, memória e sensibilidade a formato.

Achado-chave de 2026: function calling single-turn tá quase resolvido. Falhas se concentram em memória (carregar contexto entre turnos), tomada de decisão dinâmica (escolher ferramentas baseado em resultados anteriores), cadeias de longo horizonte (deriva depois de 20+ etapas) e detecção de alucinação (recusar chamar quando nenhuma ferramenta se encaixa).

### Schema de ferramenta

Todo provider tem um schema. Diferem em detalhes mas compartilham a mesma forma:

```
name: string
description: string (what it does, when to use it)
input_schema: JSON Schema (properties, required, types, enums)
```

Anthropic usa `input_schema` diretamente. OpenAI usa `function.parameters`. Ambos aceitam JSON Schema. Descrições aguentam o peso — o modelo as lê pra escolher a ferramenta certa. Descrições ruins de ferramenta são a causa raiz #1 de falhas de ferramenta errada.

### Validação de argumentos

Não confie em nenhuma chamada de ferramenta. Valide:

1. **Coerção de tipo.** Modelo pode retornar string "5" onde o schema diz int. Coerça se inequívoco; rejeite se não.
2. **Validação de enum.** Se o schema diz `status in {"open", "closed"}` e o modelo emite `"in_progress"`, rejeite com erro descritivo.
3. **Campos obrigatórios.** Campo obrigatório faltando -> observação de erro imediata de volta pro modelo, não um crash.
4. **Validação de formato.** Datas, emails, URLs — valide com parsers concretos, não regex.

Toda falha de validação deve retornar uma observação estruturada pra que o modelo possa tentar de novo com a forma correta.

### Chamadas de ferramenta paralelas

Providers modernos suportam chamadas de ferramenta paralelas num turno do assistente. O loop:

1. Modelo emite 3 chamadas de ferramenta com `tool_use_id`s distintos.
2. Runtime executa (em paralelo se independentes).
3. Cada resultado volta como um bloco `tool_result` correlacionado por `tool_use_id`.

Regra de engenharia: trate IDs de correlação como peças que aguentam o peso. Troque-os e você roteia ferramenta-errada-pra-resultado-errado.

### Sandboxing

Execução de ferramenta é a fronteira de sandbox. Veja Aula 09 pra detalhes. Versão curta: toda ferramenta deve especificar superfície de leitura/escrita, acesso à rede, timeout, limite de memória. Genérico `run_shell(cmd)` é uma bandeira vermelha; específico `git_status()` é mais seguro.

## Construa

`code/main.py` implementa um registro de ferramentas com cara de produção:

- Validador de subconjunto de JSON Schema (só stdlib).
- Registro de ferramenta com descrição, schema de input, timeout e executor.
- Coerção de argumentos e validação de enum.
- Despacho paralelo de ferramentas com IDs de correlação.
- Observações de erro como strings estruturadas.

Rode:

```
python3 code/main.py
```

O trace mostra um mini agent chamando três ferramentas num turno, com uma chamada propositalmente malformada que é rejeitada com erro descritivo que o modelo pode agir.

## Use

Todo provider tem seu próprio schema de ferramentas — Anthropic, OpenAI, Gemini, Bedrock. Use uma camada de tradução (OpenAI Agents SDK, Vercel AI SDK, LangChain tool adapter) se precisar multi-provider. BFCL é o benchmark de referência — rode contra seu agent antes de entregar se uso de ferramenta é central pro produto.

## Entregue

`outputs/skill-tool-registry.md` gera um catálogo, schema e registro de ferramentas pra um domínio de tarefa dado. Inclui checagens de qualidade de descrição (a descrição de cada ferramenta diz ao modelo quando usá-la?).

## Exercícios

1. Adicione uma ferramenta "no-op" que permite ao modelo recusar explicitamente usar qualquer outra ferramenta. Meça num teste de alucinação estilo BFCL.
2. Implemente coerção de argumentos pra int-as-string e float-as-string. Onde coerção começa a esconder bugs reais?
3. Adicione um timeout por ferramenta e um circuit breaker (recuse a ferramenta por 60s após 3 falhas consecutivas). Isso muda como o modelo se recupera?
4. Leia a descrição do BFCL V4. Escolha uma categoria (ex: "multi-turn") e rode 10 prompts de exemplo pelo seu agent. Reporte a taxa de aprovação.
5. Porte o validador stdlib pra Pydantic ou Zod. O que Pydantic/Zod pegou que o exemplo perdeu?

## Termos-Chave

| Termo | O que a galera fala | O que realmente significa |
|-------|---------------------|---------------------------|
| Function calling | "Uso de ferramenta" | Invocação de ferramenta com saída estruturada e schema validado |
| Toolformer | "Anotação auto-supervisionada de ferramenta" | Schick 2023 — manter chamadas de ferramenta cujos resultados reduzem perda no próximo token |
| BFCL | "Berkeley Function Calling Leaderboard" | Benchmark de 2026: 40% agentic, 30% multi-turn, 10% live, 10% non-live, 10% alucinação |
| Tool schema | "Assinatura de função pro modelo" | name, description, JSON Schema dos argumentos |
| tool_use_id | "ID de correlação" | Vincula uma chamada de ferramenta ao seu resultado; essencial pra despacho paralelo |
| Hallucination detection | "Saber quando não chamar" | Categoria V4: recusar chamar quando nenhuma ferramenta se encaixa |
| Argument coercion | "Reparo string-to-int" | Fixes estreitos pra mismatch de schema previsível; rejeite se ambíguo |
| Sandboxing | "Fronteira de execução de ferramenta" | Superfície leitura/escrita, rede, timeout, limite de memória por ferramenta |

## Leitura Complementar

- [Schick et al., Toolformer (arXiv:2302.04761)](https://arxiv.org/abs/2302.04761) — anotação auto-supervisionada de ferramenta
- [Berkeley Function Calling Leaderboard (V4)](https://gorilla.cs.berkeley.edu/leaderboard.html) — benchmark de avaliação de 2026
- [Anthropic, Tool use documentation](https://platform.claude.com/docs/en/agent-sdk/overview) — schema de ferramenta de produção no Claude Agent SDK
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) — tipo de ferramenta function e Guardrails
