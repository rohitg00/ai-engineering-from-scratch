# Benchmarks: SWE-bench, GAIA, AgentBench

> Três benchmarks ancora a avaliação de agentes em 2026. SWE-bench testa correção de código. GAIA testa uso de tools generalistas. AgentBench testa raciocínio multi-ambiente. Conheça a composição de cada um, a questão de contaminação, e o que eles não medem.

**Tipo:** Aprender
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 14 · 06 (Tool Use)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Nomear o test harness do SWE-bench (FAIL_TO_PASS) e explicar por que ele usa testes unitários como gate.
- Explicar por que o SWE-bench Verified (OpenAI, 500 tarefas) existe e o que ele remove.
- Descrever o design do GAIA: simples pra humanos, difícil pra IA; três níveis de dificuldade.
- Nomear os oito ambientes do AgentBench e seu principal bloqueador pra LLMs open-source.
- Resumir o achado de contaminação do SWE-bench+ e suas implicações.

## O Problema

Leaderboards te dizem qual modelo ganha num benchmark. Não te dizem:

- Se o benchmark está contaminado (soluções nos dados de treino, vazamento de teste).
- Se o benchmark mede o que você se importa (código vs navegação vs generalista).
- Se o avaliador é robusto (matching AST, checagens de estado, review humano).

Conheça os três benchmarks de referência e seus modos de falha antes de cotar um número.

## O Conceito

### SWE-bench (Jimenez et al., ICLR 2024 oral)

- 2.294 issues reais do GitHub de 12 repos Python populares.
- O agente recebe: o codebase no commit pré-fix + descrição da issue em linguagem natural.
- O agente produz: um patch.
- Avaliador: aplica o patch, roda a suíte de testes do repo. O patch precisa inverter testes FAIL_TO_PASS (antes falhando, agora passando) sem quebrar testes PASS_TO_PASS.

SWE-agent (Yang et al., 2024) chegou a 12.5% no release enfatizando interfaces agente-computador (comandos de editor de arquivos, sintaxe de busca que o modelo entende).

### SWE-bench Verified

OpenAI, ago 2024. Subconjunto de 500 tarefas curado por humanos. Remove issues ambíguas, testes não confiáveis e tarefas onde a correção era incerta. Benchmark principal pra "seu agente entrega patches reais?"

### Contaminação

- Mais de 94% das issues do SWE-bench são anteriores à maioria dos cutoffs de modelo.
- **SWE-bench+** encontrou que 32.67% dos patches bem-sucedidos tinham soluções vazadas no texto da issue (o modelo viu a correção na descrição), e 31.08% eram suspeitas por cobertura de teste fraca.
- Verified é mais limpo mas não é livre de contaminação.

Implicação prática: um modelo que marca 50% no SWE-bench pode marcar 35% no SWE-bench+. Sempre reporte ambos se você reivindicar performance no SWE-bench.

### GAIA (Mialon et al., nov 2023)

- 466 perguntas; 300 retidas pro leaderboard privado em huggingface.co/gaia-benchmark.
- Filosofia de design: "conceitualmente simples pra humanos (92%) mas difícil pra IA (GPT-4 com plugins: 15%)."
- Testa raciocínio, multimodalidade, web, uso de tools.
- Três níveis de dificuldade; Nível 3 requer longas cadeias de tools cross-modality.

GAIA é o que você roda pra medir "capacidade generalista". Não confunda com benchmarks específicos de código.

### AgentBench (Liu et al., ICLR 2024)

- 8 ambientes entre código (Bash, DB, KG), jogos (Alfworld, LTP), web (WebShop, Mind2Web) e geração aberta.
- Multi-turn, ~4k-13k turns por split.
- Achado principal: raciocínio de longo prazo, tomada de decisão e seguimento de instruções são os bloqueadores pra OSS LLMs alcancarem os comerciais.

### O que isso não mede

- Custo operacional no mundo real (tokens, wall-clock).
- Comportamento de segurança em condições adversárias.
- Performance no seu domínio (use suas próprias evals, Aula 30).
- Falhas de cauda (benchmarks fazem média; operadores de produção se importam com o pior 1%).

### Onde benchmarking dá errado

- **Fixação em número único.** SWE-bench 50% te diz menos que a distribuição P50/P75/P95 de custo + passos.
- **Claims contaminados.** Reportar SWE-bench sem mencionar Verified ou SWE-bench+ é enganoso.
- **Benchmark como meta de desenvolvimento.** Otimizar pro benchmark diverge da utilidade em produção.

## Construa

`code/main.py` implementa um harness toy estilo SWE-bench:

- Tarefas sintéticas de correção de bug (3 tarefas).
- Um "agente" roteado que propõe patches.
- Um runner de testes que checa FAIL_TO_PASS (bug agora corrigido) e PASS_TO_PASS (nada quebrado).
- Um classificador de dificuldade estilo GAIA baseado na profundidade de decomposição da pergunta.

Execute:

```
python3 code/main.py
```

A saída mostra a taxa de resolução por tarefa + por dificuldade e torna as regras do avaliador concretas.

## Use

- **SWE-bench Verified** pra agentes de código. Sempre reporte scores Verified.
- **GAIA** pra agentes generalistas. Use o split do leaderboard privado.
- **AgentBench** pra comparação multi-ambiente.
- **Evals customizadas** (Aula 30) pro formato real do seu produto.

## Entregue

`outputs/skill-benchmark-harness.md` constrói um harness estilo SWE-bench pra qualquer par codebase-tarefa com gate FAIL_TO_PASS / PASS_TO_PASS.

## Exercícios

1. Porte o harness toy pra rodar num repo real (escolha um seu). Escreva 3 testes FAIL_TO_PASS pra bugs conhecidos.
2. Adicione uma métrica de contagem de passos. Nas suas 3 tarefas, quantos passos de agente por resolução?
3. Leia o paper do SWE-bench+. Implemente uma checagem de vazamento de solução (match de padrão no texto da issue contra o diff).
4. Baixe uma pergunta do GAIA do split público. Trace o que um agente de classe GPT-4 faria. Quais tools ele precisa?
5. Leia a análise por ambiente do AgentBench. Qual espelha a superfície do seu produto? Como é o "SOTA" lá?

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| SWE-bench | "Benchmark de agente de código" | 2.294 issues GitHub; patch precisa inverter testes FAIL_TO_PASS |
| SWE-bench Verified | "SWE-bench limpo" | 500 tarefas curadas por humanos, OpenAI |
| FAIL_TO_PASS | "Gate de correção" | Testes antes falhando que devem passar após o patch |
| PASS_TO_PASS | "Gate sem regressão" | Testes que já passavam e devem continuar passando |
| GAIA | "Benchmark generalista" | 466 perguntas fáceis pra humanos / difíceis pra IA com multi-tool |
| AgentBench | "Benchmark multi-ambiente" | 8 ambientes; multi-turn de longo horizonte |
| Contaminação | "Vazamento do treino" | Tarefas do benchmark presentes no treinamento do modelo |
| SWE-bench+ | "Auditoria de contaminação" | 32.67% de vazamento de solução encontrado nos patches bem-sucedidos do SWE-bench |

## Leitura Complementar

- [Jimenez et al., SWE-bench (arXiv:2310.06770)](https://arxiv.org/abs/2310.06770) — o benchmark original
- [OpenAI, SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) — o subconjunto curado
- [Mialon et al., GAIA (arXiv:2311.12983)](https://arxiv.org/abs/2311.12983) — benchmark generalista
- [Liu et al., AgentBench (arXiv:2308.03688)](https://arxiv.org/abs/2308.03688) — suíte multi-ambiente
