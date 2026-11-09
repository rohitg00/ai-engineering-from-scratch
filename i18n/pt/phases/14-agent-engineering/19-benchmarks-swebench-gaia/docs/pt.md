# Indicações de referência: SWE-bench, GAIA, AgentBench

> Três pontos de referência avaliação de agentes ancoradores em 2026. SWE-bench testes patching de código. GAIA testes uso de ferramentas generalistas. AgentBench testes raciocínio multi-ambiente. Conheça sua composição, sua história de contaminação, e o que eles não medem.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 06 (Tool Use)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Nomear o arame de ensaio do banco SWE (FAIL_TO_PASS) e explicar por que é incompatível com os testes unitários.
- Explique por que existe o SWE-bench Verified (OpenAI, 500 tarefas) e o que elimina.
- Descreva o design da GAIA: simples para os seres humanos, difícil para a IA; três níveis de dificuldade.
- Nomear os oito ambientes do AgentBench e seu principal bloqueador para LLM de código aberto.
- Resumir a constatação da contaminação do banco SWE+ e as suas implicações.

## O problema

Os rankings dizem-lhe qual modelo vence num ponto de referência.

- Se o indicador de referência está contaminado (soluções nos dados de formação, vazamento de ensaio).
- Se o índice de referência mede o que lhe interessa (código vs navegação vs generalista).
- Se o avaliador é robusto (matching AST, verificações de estado, revisão humana).

Conheça os três pontos de referência de ancoragem e os seus modos de falha antes de citar um número.

## O conceito

### SWE-bench (Jimenez et al., ICLR 2024 oral)

- 2.294 problemas reais do GitHub de 12 repositorios populares do Python.
- Agente recebe: a base de código no pré-fix comit + descrição de problema em linguagem natural.
- O agente produz um parche.
- Avaliação: aplicar correção, executar o conjunto de testes do repo. O correção deve virar testes FAIL_TO_PASS (anteriormente falhando, agora passando) sem quebrar testes PASS_TO_PASS.

O agente SWE (Yang et al., 2024) atingiu 12,5% na liberação enfatizando interfaces agente-computador (comandos de editor de arquivo, sintaxe de pesquisa que o modelo entende).

### Banco SWE Verificado

OpenAI, agosto de 2024. Subconjunto de 500 tarefas curado pelo ser humano. Elimina problemas ambíguos, testes não confiáveis e tarefas onde a correção não era clara.

### Contaminação

- Mais de 94% dos problemas de banco SWE são anteriores à maioria dos cortes de modelos.
- **SWE-bench+**A Comissão concluiu que, em relação aos resultados dos testes, a Comissão não tinha qualquer informação sobre os resultados dos testes.
- Verificado é mais limpo, mas não livre de contaminação.

Implicação prática: um modelo que obtenha 50% em SWE-bench pode obter 35% em SWE-bench+.

### A Comissão deve tomar medidas para evitar que a situação seja prejudicial.

- 466 perguntas; 300 mantidas para o ranking privado no huggingface.co/gaia-benchmark.
- Filosofia do design: "conceptualmente simples para os seres humanos (92%) mas difícil para a IA (GPT-4 com plugins: 15%)."
- Teste de raciocínio, multi-modalidade, web, uso de ferramentas.
- Três níveis de dificuldade; o nível 3 requer longas cadeias de ferramentas em todas as modalidades.

GAIA é o que você corre para medir "capacidade generalista". Não confundir com referências específicas de código.

### Agente Bench (Liu et al., ICLR 2024)

- 8 ambientes em código (Bash, DB, KG), jogos (Alfworld, LTP), web (WebShop, Mind2Web) e geração aberta.
- Multiplo-turn, ~ 4K-13K voltas por divisão.
- Conclusão primária: raciocínio a longo prazo, tomada de decisão e instrução são os bloqueadores para os LLM OSS alcançar a comercial.

### O que estes não medem

- Custo operacional real (tokens, relógio de parede).
- Comportamento de segurança em condições adversas.
- Performance no seu domínio (utilizar as suas próprias avaliações, lição 30).
- Falhas de cauda (média de valores de referência; os operadores de produção se preocupam com o pior 1%).

### Onde a análise comparativa vai mal

- **Single-number fixation.**O banco SWE 50% diz-lhe menos do que o custo P50/P75/P95 + distribuição de etapas.
- **Contaminated claims.**Relacionar o banco SWE sem mencionar o Verified ou o banco SWE+ é enganoso.
- **Benchmark-as-development-target.**A otimização para o índice de referência diverge da utilidade da produção.

```figure
ae-swebench-gate
```

## Construí-lo

`code/main.py`Instala um arame de brinquedo SWE-bench:

- Tarefas de correção de bugs sintéticas (3 tarefas).
- Um "agente" com guião que propõe patches.
- Um test runner que verifica FAIL_TO_PASS (bug agora corrigido) e PASS_TO_PASS (nada quebrado).
- Um classificador de dificuldade de estilo GAIA baseado na profundidade da decomposição da questão.

- É o que é ?

```
python3 code/main.py
npx tsx code/main.ts
```

A saída mostra a taxa de resolução por tarefa + por dificuldade e torna concretas as regras do avaliador.

## Usá-lo

- **SWE-bench Verified**Sempre relatar as pontuações verificadas.
- **GAIA**Para agentes generalistas, use a divisão de classificação privada.
- **AgentBench**para comparação entre ambientes.
- **Custom evals**(Lessão 30) para a forma real do seu produto.

## Envia-o

`outputs/skill-benchmark-harness.md`Construi um arnes de estilo SWE-bench para qualquer par de tarefas base de código com fechamento FAIL_TO_PASS / PASS_TO_PASS.

## Exercícios

1. Portar o arnes de brinquedo para funcionar em um repo real (põe um do seu). Escrever 3 testes FAIL_TO_PASS para bugs conhecidos.
2. Adicione uma métrica de contagem de etapas.
3. Leia o documento SWE-bench+. Implemente uma verificação de fuga de solução (paraleia o padrão com o texto do problema contra a diferença).
4. Descarregar uma pergunta da GAIA da divisão pública, rastrear o que um agente da classe GPT-4 faria.
5. Leia a descrição de ambiente do agente Bench, qual ambiente reflete a superfície do produto?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| SWE-bench | "Code agent benchmark" | 2,294 GitHub issues; patch must flip FAIL_TO_PASS tests |
| SWE-bench Verified | "Clean SWE-bench" | 500 human-curated tasks, OpenAI |
| FAIL_TO_PASS | "Fix gate" | Tests previously failing that must pass after the patch |
| PASS_TO_PASS | "No-regression gate" | Tests that were passing and must still pass |
| GAIA | "Generalist benchmark" | 466 human-easy / AI-hard multi-tool questions |
| AgentBench | "Multi-env benchmark" | 8 environments; long-horizon multi-turn |
| Contamination | "Training-set leak" | Benchmark tasks present in model training |
| SWE-bench+ | "Contamination audit" | 32.67% solution leakage found in successful SWE-bench patches |

## Mais leitura

- [Jimenez et al., SWE-bench (arXiv:2310.06770)](https://arxiv.org/abs/2310.06770) o índice de referência original
- [OpenAI, SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) o subconjunto seleccionado
- [Mialon et al., GAIA (arXiv:2311.12983)](https://arxiv.org/abs/2311.12983) Referência geralista
- [Liu et al., AgentBench (arXiv:2308.03688)](https://arxiv.org/abs/2308.03688) Suite multi-ambiente
