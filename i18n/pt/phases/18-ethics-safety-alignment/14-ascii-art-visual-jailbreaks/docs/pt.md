# ASCII Arte e Prisões Visuais

> Jiang, Xu, Niu, Xiang, Ramasubramanian, Li, Poovendran, "ArtPrompt: Ataques de Jailbreak baseados em arte ASCII contra LLM alinhados" (ACL 2024, arXiv:2402.11753). Mascarar os tokens relevantes para a segurança em um pedido prejudicial, substituí-los por renderização ASCII-art das mesmas letras, e enviar o aviso disfarçado. GPT-3.5, GPT-4, Gemini, Claude, Llama-2 todos falham em reconhecer robustamente os tokens de arte ASCII. O ataque contorna PPL (filtros de perplexidade), defesas de paráfrase e retokenization. Relacionado: o ViTC benchmark mede o reconhecimento de pedidos visuais não semânticos; StructuralSleight generaliza para estruturas incomuns codificadas por texto (árvores, gráficos, JSON aninhados) como uma família de ataques de codificação.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, ArtPrompt token-masking harness)
**Prerequisites:** Phase 18 · 12 (PAIR), Phase 18 · 13 (MSJ)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Descreva o ataque ArtPrompt: passo de identificação de palavras, substituição ASCII-art, final de encoberta de prompt.
- Explique por que as defesas padrão (PPL, Paraphrase, Retokenization) falham no ArtPrompt.
- Defina o ViTC e descreva o que ele mede.
- Descreva StructuralSleight como uma generalização para estruturas arbitrárias incomuns codificadas por texto.

## O problema

Os ataques por meio de parafrase e jogo de roteiro (Lessão 12) e por meio de longo contexto (Lessão 13) operam no padrão de nível de texto. ArtPrompt opera no nível de reconhecimento: o modelo não analisa o token proibido. Ele analisa uma imagem renderizada em caracteres. O filtro de segurança vê pontuação inofensiva. O modelo vê uma palavra.

## O conceito

### ArtPrompt, dois passos

Passo 1. Identificação de palavras. Dado um pedido prejudicial, o atacante usa um LLM para identificar as palavras relevantes para a segurança (por exemplo, "bomba" em "como fazer uma bomba"). 

Passo 2. Geração de Prompt encoberta. Substitua cada palavra identificada com sua representação de arte ASCII (um bloco de caracteres 7x5 ou 7x7 formando a forma da letra). O modelo recebe uma grade de pontuação e espaços que um modelo suficientemente capaz pode reconhecer como a palavra; um filtro de segurança vê apenas a grade.

Resultado: GPT-4, Gemini, Claude, Llama-2, GPT-3.5 todos falham. Taxa de sucesso de ataque acima de 75% em seu subconjunto de referência.

### Por que as defesas padrão falham

- **PPL (perplexity filter).**A arte ASCII tem uma alta perplexidade  mas também todas as entradas novas.
- **Paraphrase.**Parafrasear o prompt destrói a arte ASCII. Na prática, parafrase LLM muitas vezes preservam ou reconstruem a arte.
- **Retokenization.**Dividir os tokens de forma diferente não muda que a visão do modelo esteja reconhecendo formas de letras.

O problema subjacente é que os filtros de segurança são de nível token ou semântico; o ArtPrompt opera no nível de reconhecimento visual.

### Indicador de referência ViTC

Reconhecimento de pedidos visuais não semânticos. Medem a capacidade do modelo de ler ASCII-art, wingdings e outros conteúdos visuais não-texto-semânticos. A eficácia do ArtPrompt correlaciona com a precisão ViTC: quanto melhor o modelo lê texto visual, melhor o ArtPrompt trabalha nele.

### EstruturaSleight

Generaliza ArtPrompt: Estruturas incomuns codificadas por texto (UTES). Árvores, gráficos, JSON aninhado, CSV-in-JSON, blocos de código de estilo diferente. Se uma estrutura é rara no treinamento de dados de segurança, mas pode ser analisada pelo modelo, ela pode esconder conteúdo prejudicial.

A implicação da defesa: a segurança deve generalizar-se através das representações estruturadas que o modelo pode analisar.

### Análogo de modalidade de imagem

Os LLM visuais (GPT-5.2, Gemini 3 Pro, Claude Opus 4.5, Grok 4.1) ampliam a superfície de ataque. Ataques de estilo ArtPrompt com imagens reais são mais fortes do que os análogos de arte ASCII porque os codificadores de imagens produzem um sinal mais rico.

### Onde isto encaixa na Fase 18

As lições 12-14 descrevem três vetores de ataque ortogonais: refinamento iterativo (PAIR), comprimento de contexto (MSJ) e codificação (ArtPrompt/StructuralSleight). A lição 15 muda de ataques centrados no modelo para ataques de fronteira do sistema (injeção de prompt indireta).

```figure
al-ascii-cloak
```

## Usá-lo

`code/main.py`Você pode encobrir palavras específicas em uma consulta prejudicial com glifos de arte ASCII, verificar que a cadeia encoberta passa por um filtro de palavra-chave e (opcionalmente) decodificar a cadeia encoberta de volta usando um reconhecedor simples.

## Envia-o

Esta lição produz`outputs/skill-encoding-audit.md`. Dado um relatório de defesa contra jailbreak, ele enumera as famílias de ataques de codificação cobertas (arte ASCII, base64, leet-speak, homoglifos UTF-8, UTES) e a camada de defesa que capta cada um.

## Exercícios

1. Corra .`code/main.py`Verifique se a cadeia encoberta passa por um simples filtro de palavras-chave.

2. Implementar uma segunda codificação: base64 para a mesma palavra-alvo. Compare a taxa de ultrapassagem do filtro com o ArtPrompt e a dificuldade de recuperação.

3. Leia Jiang et al. 2024 Seção 4.3 (resultados de cinco modelos). Propõe uma razão pela qual a resistência ArtPrompt de Claude é maior do que a de Gémeos no mesmo índice de referência.

4. Desenhar uma defesa de pré-geração que detecte regiões em forma de arte ASCII no prompt. Medir a taxa de falso positivo em código legítimo, tabelas e notação matemática.

5. StructuralSleight lista 10 estruturas de codificação. Esboce uma defesa generalizada que lida com todas as 10 e estimar o custo de computação por prompt defendido.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| ArtPrompt | "the ASCII-art attack" | Two-step jailbreak that masks safety words with ASCII-art renderings |
| Cloaking | "hide the word" | Replace a forbidden token with a visual representation the model reads but the filter does not |
| UTES | "uncommon structure" | Uncommon Text-Encoded Structure — tree, graph, nested JSON, etc. used to smuggle content |
| ViTC | "visual-text capability" | Benchmark for model's ability to read non-semantic visual encoding |
| Perplexity filter | "PPL defense" | Reject prompts with high perplexity; fails because legitimate structured input also scores high |
| Retokenization | "tokenizer shift defense" | Pre-process the prompt with a different tokenizer; fails because recognition is visual |
| Homoglyph | "lookalike characters" | Unicode characters that look identical to Latin letters; bypass substring checks |

## Mais leitura

- [Jiang et al. — ArtPrompt (ACL 2024, arXiv:2402.11753)](https://arxiv.org/abs/2402.11753)O papel de jailbreak da ASCII-art
- [Li et al. — StructuralSleight (arXiv:2406.08754)](https://arxiv.org/abs/2406.08754) Generalização de UTES
- [Chao et al. — PAIR (Lesson 12, arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) ataque iterativo complementar
- [Anil et al. — Many-shot Jailbreaking (Lesson 13)](https://www.anthropic.com/research/many-shot-jailbreaking) Ataque de comprimento complementar
