# Cientista de IA v2  Pesquisa Autônoma de Nível de Talhado

> O Cientista de IA de Sakana v2 (Yamada et al., arXiv:2504.08066) executa o ciclo completo de pesquisa: hipótese, código, experimentos, números, redação, submissão. É o primeiro sistema a ter uma revisão de pares de passagens de papel gerada num workshop do ICLR 2025. A avaliação independente (Beel et al.) descobriu que 42% das experiências falharam em erros de codificação e revisão de literatura frequentemente rotulava erroneamente conceitos estabelecidos como novos. Os próprios docentes de Sakana alertam que a base de código executa código escrito pelo LLM e recomendam o isolamento do Docker. Ambas as metades da imagem são o ponto.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, research-loop state-machine toy)
**Prerequisites:** Phase 15 · 03 (AlphaEvolve), Phase 15 · 04 (DGM)
**Time:** ~60 minutes

## O problema

A pesquisa é uma tarefa aberta. Ao contrário da pesquisa algorítmica da AlphaEvolve ou da auto-modificação limitada por benchmark da DGM, um resultado de pesquisa não tem um critério de corretão verificável por máquina. Um artigo é julgado por revisores, não por testes unitários. Isso torna o ciclo mais difícil de fechar  e mais valioso se fechado, porque a pesquisa é onde o progresso composto vive.

O Cientista de IA v1 (Sakana, 2024) fechou o ciclo começando com modelos de autoria humana. O LLM completou experimentos dentro de um andaime fixo. AI Scientist v2 (Yamada et al., 2025) remove o requisito de modelo usando a pesquisa agencial de árvore com um ciclo de crítica de modelo de linguagem de visão. O sistema gera ideias, implementa experimentos, produz números, escreve um artigo e retrata os comentários dos revisores.

Veredicto de revisão por pares: um artigo gerado por v2 foi aceito em uma oficina do ICLR 2025 (com divulgação). Veredicto de avaliação independente: o sistema está longe de ser confiável. Ambos são verdadeiros.

## O conceito

### A arquitetura

1. **Idea generation.**O LLM propõe ideias de pesquisa condicionadas a um tópico e literatura anterior. v1 utiliza modelos; v2 usa pesquisa agencial sobre um espaço de hipóteses.
2. **Novelty check.**A fase de recuperação da literatura verifica se a ideia foi publicada. Esta é a etapa em que a avaliação de Beel et al. encontrou erroneamente etiquetado  métodos estabelecidos frequentemente classificados como novidade.
3. **Experiment plan.**O agente desenha um protocolo experimental e escreve código.
4. **Execution.**O código corre em uma caixa de areia. Os erros são enviados de volta para um ciclo de retest. Nas medições de Beel et al., 42% das experiências falharam por erros de codificação nesta fase.
5. **Figure generation.**Um modelo de linguagem visual lê figuras geradas e as reescreve para clareza.
6. **Writeup.**O LLM elabora um artigo, reitera com um revisor interno.
7. **Optional: submission.**O papel é apresentado a um local.

### O que significa o resultado da aceitação do workshop

Um artigo gerado por v2 passou por revisão por pares em um workshop do ICLR 2025. Os autores revelaram a origem do artigo ao comitê do programa. A aceitação é um ponto de dados; não é uma licença para reivindicar que o sistema "faz pesquisa".

Contexto importante: os trabalhos de oficina são uma barra mais baixa do que os trabalhos de conferência principal. A revisão entre pares é barulhenta; uma pequena fração das apresentações são aceitas em qualquer dia dado. Um sucesso é uma prova de conceito, não uma alegação de confiabilidade. O artigo Nature 2026 documenta o ciclo de ponta a ponta e foi co-autor por pesquisadores humanos; não é "o sistema escreveu um artigo Nature".

### O que a avaliação independente revelou

A Beel et al. (arXiv:2502.14297) realizou uma avaliação externa.

- **Experiment failures.**42% das experiências falharam por erros de codificação (importações erradas, desajustes de forma, variáveis não definidas).
- **Novelty mislabeling.**O passo de recuperação de literatura frequentemente sinalizava conceitos estabelecidos como novos.
- **Presentation-quality gap.**A crítica de figuras de linguagem visual produziu visuais de qualidade de publicação, mascando as fraquezas experimentais subjacentes.

A última conclusão é a importante para esta fase: um sistema que produz resultados convincentes sem fazer pesquisas convincentes é mais perigoso, não mais seguro, do que um que falha obviamente.

### A preocupação com a fuga da caixa de areia

O próprio repositório de Sakana README adverte:

> Devido à natureza deste software, que executa código gerado pela LLM, não podemos garantir a segurança. Há riscos de pacotes perigosos, acesso à web descontrolado e reprodução de processos não intencionais. Use a seu próprio risco e considere o isolamento do Docker.

Este é o formato operacional da autonomia em um domínio não verificado. O LLM escreve código; o código é executado; o código pode fazer qualquer coisa que o processo seja autorizado a fazer. Sem uma caixa de areia que limite duramente o sistema de arquivos, rede e ações de processo, qualquer agente de pesquisa autodirigido pode exfiltrar dados, queimar computação ou se reescrever.

A história da caixa de areia do AlphaEvolve é mais fácil porque seu avaliador é apertado. O loop do AI Scientist v2 executa código aberto com metas abertas. É por isso que precisa de um isolamento mais forte (Docker mínimo; seccomp / gVisor preferido) e uma revisão manual de cada submissão antes de sair do sistema.

### Onde v2 fica na pilha de fronteira

| System | Target | Output kind | Evaluator | Known failure |
|---|---|---|---|---|
| AlphaEvolve | algorithms | code | unit + benchmark | bounded by evaluator rigor |
| DGM | agent scaffolding | code | SWE-bench | reward hacking |
| AI Scientist v2 | research papers | text + code + figures | peer review (weak) | experiment failures, mislabeling, polish masking weakness |

O v2 tem o avaliador automático mais fraco dos três, a superfície de saída mais ampla e o caminho mais curto para artefatos públicos.

```figure
mx-research-loop
```

## Usá-lo

`code/main.py`Simula o loop v2 como uma máquina de estado: ideia → novidade verificação → experimento → figura → escrever → revisão → aceitar-ou-iterar. Cada estado tem uma probabilidade de falha configurável tirada dos resultados de Beel et al.

- Quantas ideias chegam à submissão.
- Quantas submissões teriam uma falha experimental crítica que o papel polido esconde.
- Como os orçamentos de retest trocam qualidade vs rendimento.

## Envia-o

`outputs/skill-ai-scientist-sandbox-review.md`é uma lista de revisão de dois portões para qualquer coisa produzida por um agente de ciclo de pesquisa antes de sair da caixa de areia.

## Exercícios

1. Corra .`code/main.py`Qual fração de loop runs produz um papel "limpo"?

2. As defesas já utilizam o 42% / 25% da Beel et al.`--experiment-failure 0.20 --novelty-mislabel 0.10`E depois com `--experiment-failure 0.60 --novelty-mislabel 0.40`Como é que a parte polida, mas imperfeita, muda entre as duas corridas?

3. Leia o repo README de Sakana AI Scientist v2 sobre requisitos de caixa de areia. Cite duas restrições adicionais (além do Docker) que você aplicaria para uma execução autónoma de vários dias.

4. Leia a secção 4 sobre a lacuna de qualidade da apresentação.

5. Propõe um protocolo de revisão humana para resultados de agentes de pesquisa que se balanceie melhor do que "um doutorado lê cada artigo". Identifique o gargalo de engarrafamento e o projeto em torno dele.

## Termos-chave

| Term | What people say | What it actually means |
|---|---|---|
| AI Scientist v1 | "Sakana's templated research agent" | Filled experiments into a fixed scaffold |
| AI Scientist v2 | "Template-free research agent" | Agentic tree search with VLM figure critique |
| Agentic tree search | "Branching research agent" | Expands multiple experiment plans in parallel; prunes by internal critic |
| Vision-language critique | "VLM polish on figures" | Multimodal model reads figures and rewrites them for clarity |
| Literature retrieval | "Novelty check" | Searches prior work to confirm idea novelty — documented to mislabel |
| Polish masking | "Pretty paper, broken research" | Presentation quality exceeds experimental quality; hides weaknesses |
| Sandbox escape | "LLM code breaks out" | Agent-executed code does things the loop designer did not intend |

## Mais leitura

- [Yamada et al. (2025). The AI Scientist-v2](https://arxiv.org/abs/2504.08066)- Papel.
- [Sakana blog on the Nature 2026 publication](https://sakana.ai/ai-scientist-nature/) resumo do fornecedor com contexto de revisão por pares.
- [Beel et al. (2025). Independent evaluation of The AI Scientist](https://arxiv.org/abs/2502.14297) Números de avaliação externa.
- [Sakana AI Scientist v1 paper](https://arxiv.org/abs/2408.06292) o antecessor templado.
- [Anthropic — Measuring AI agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) mais amplo enquadramento dos agentes de investigação de âmbito aberto.
