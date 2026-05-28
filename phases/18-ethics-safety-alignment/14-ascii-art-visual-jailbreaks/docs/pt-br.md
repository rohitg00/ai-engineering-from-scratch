# ASCII Art e Jailbreaks Visuais

> Jiang, Xu, Niu, Xiang, Ramasubramanian, Li, Poovendran, "ArtPrompt: ASCII Art-based Jailbreak Attacks against Aligned LLMs" (ACL 2024, arXiv:2402.11753). Mascarar os tokens de segurança em um pedido prejudicial, substituí-los por renderizações em ASCII art das mesmas letras, e enviar o prompt disfarçado. GPT-3.5, GPT-4, Gemini, Claude, Llama-2 todos falham em reconhecer de forma robusta tokens ASCII art. O ataque contorna filtros de perplexidade (PPL), defesas por paráfrase e retokenização. Relacionado: o benchmark ViTC mede reconhecimento de prompts visuais não-semânticos; StructuralSleight generaliza para Estruturas de Texto Não-Comuns Codificadas (UTES — árvores, grafos, JSON aninhado) como uma família de ataques de codificação.

**Tipo:** Construir
**Linguagens:** Python (stdlib, harness de mascaramento de tokens ArtPrompt)
**Pré-requisitos:** Fase 18 · 12 (PAIR), Fase 18 · 13 (MSJ)
**Tempo:** ~60 minutos

## Objetivos de Aprendizagem

- Descrever o ataque ArtPrompt: etapa de identificação de palavra, substituição ASCII art, prompt disfarçado final.
- Explicar por que defesas padrão (PPL, Paráfrase, Retokenização) falham no ArtPrompt.
- Definir ViTC e descrever o que ele mede.
- Descrever StructuralSleight como uma generalização para Estruturas de Texto Não-Comuns Arbitrárias.

## O Problemo

Ataques via paráfrase e roleplay (Lição 12) e via contexto longo (Lição 13) operam no padrão de nível de texto. ArtPrompt opera no nível de reconhecimento: o modelo não parseia o token proibido. Ele parseia uma imagem renderizada em caracteres. O filtro de segurança vê pontuação inofensiva. O modelo vê uma palavra.

## O Conceito

### ArtPrompt, duas etapas

Etapa 1. Identificação de Palavra. Dado um pedido prejudicial, o atacante usa um LLM para identificar as palavras relevantes para segurança (por exemplo, "bomba" em "como fazer uma bomba").

Etapa 2. Geração de Prompt Disfarçado. Substitua cada palavra identificada por sua renderização em ASCII art (um bloco de caracteres 7x5 ou 7x7 formando o formato da letra). O modelo recebe uma grade de pontuação e espaços que um modelo suficientemente capaz consegue reconhecer como a palavra; um filtro de segurança vê apenas a grade.

Resultado: GPT-4, Gemini, Claude, Llama-2, GPT-3.5 todos falham. Taxa de sucesso de ataque acima de 75% em seu subconjunto de benchmark.

### Por que defesas padrão falham

- **PPL (filtro de perplexidade).** ASCII art tem alta perplexidade — mas qualquer input novel também tem. Escolhas de limiar que bloqueiam ArtPrompt também bloqueiam input estruturado legítimo.
- **Paráfrase.** Parafrasear o prompt destrói o ASCII art. Na prática, LLMs de paráfrase frequentemente preservam ou reconstruem o art.
- **Retokenização.** Dividir tokens de forma diferente não muda que a visão do modelo está reconhecendo formatos de letras.

O problema subjacente é que filtros de segurança são em nível de token ou semântico; ArtPrompt opera no nível de reconhecimento visual.

### Benchmark ViTC

Reconhecimento de prompts visuais não-semânticos. Mede a capacidade do modelo de ler ASCII art, wingdings e outros conteúdos visuais não-semânticos. A efetividade do ArtPrompt correlaciona com acurácia ViTC: melhor o modelo lê texto visual, melhor o ArtPrompt funciona nele. Isso é um trade-off capacidade-segurança.

### StructuralSleight

Generaliza ArtPrompt: Estruturas de Texto Não-Comuns Codificadas (UTES). Árvores, grafos, JSON aninhado, CSV-em-JSON, blocos de código em estilo diff. Se uma estrutura é rara nos dados de segurança de treinamento mas parseável pelo modelo, ela pode esconder conteúdo prejudicial.

A implicação defensiva: segurança precisa generalizar sobre as representações estruturadas que o modelo consegue parsear. O conjunto é grande e crescente.

### Análogo à modalidade de imagem

LLMs visuais (GPT-5.2, Gemini 3 Pro, Claude Opus 4.5, Grok 4.1) expandem a superfície de ataque. Ataques estilo ArtPrompt com imagens reais são mais fortes que analogos em ASCII art porque codificadores de imagem produzem sinal mais rico.

### Onde isso se encaixa na Fase 18

Lição 12-14 descrevem três vetores de ataque ortogonais: refinamento iterativo (PAIR), comprimento de contexto (MSJ) e codificação (ArtPrompt/StructuralSleight). Lição 15 muda de ataques centrados no modelo para ataques na fronteira do sistema (indirect prompt injection). Lição 16 descreve a resposta de ferramentagem defensiva.

## Use

`code/main.py` constrói um ArtPrompt simulado. Você pode disfarçar palavras eespecificaçãoíficas em uma consulta prejudicial com glifos ASCII art, verificar se a string disfarçada passa um filtro de palavras-chave, e (opcionalmente) decodificar a string de volta usando um reconhecedor simples.

## Entregue

Essa lição gera `outputs/skill-encoding-audit.md`. Dado um relatório de defesa contra jailbreak, enumera as famílias de ataques de codificação cobertas (ASCII art, base64, leet-speak, homóglifo UTF-8, UTES) e a camada de defesa que detecta cada uma.

## Exercícios

1. Execute `code/main.py`. Verifique se a string disfarçada passa um filtro de palavras-chave simples. Reporte a mudança necessária em nível de caractere.

2. Implemente uma segunda codificação: base64 para a mesma palavra alvo. Compare a taxa de contorno do filtro contra ArtPrompt e a dificuldade de recuperação.

3. Leia Jiang et al. 2024 Seção 4.3 (resultados em cinco modelos). Proponha uma razão pela qual a resistência de Claude ao ArtPrompt é maior que a do Gemini no mesmo benchmark.

4. Projete uma defesa pré-geração que detecta regiões com formato de ASCII art no prompt. Meça a taxa de falsos positivos em código legítimo, tabelas e notação matemática.

5. StructuralSleight lista 10 estruturas de codificação. Esboce uma defesa generalizada que lide com todas as 10 e estime o custo de compute por prompt defendido.

## Termos-Chave

| Termo | O que dizem | O que realmente significa |
|-------|-------------|---------------------------|
| ArtPrompt | "o ataque ASCII art" | Jailbreak de duas etapas que mascara palavras de segurança com renderizações ASCII art |
| Cloaking | "esconder a palavra" | Substituir um token proibido por uma representação visual que o modelo lê mas o filtro não |
| UTES | "estrutura não-comum" | Estrutura de Texto Não-Comum Codificada — árvore, grafo, JSON aninhado, etc. usado para contrabandear conteúdo |
| ViTC | "capacidade texto-visual" | Benchmark para capacidade do modelo de ler codificação visual não-semântica |
| Filtro de perplexidade | "defesa PPL" | Rejeita prompts com alta perplexidade; falha porque input estruturado legítimo também pontua alto |
| Retokenização | "defesa de mudança de tokenizer" | Pré-processa o prompt com um tokenizer diferente; falha porque o reconhecimento é visual |
| Homóglifo | "caracteres parecidos" | Caracteres Unicode que parecem idênticos a letras latinas; contornam verificações por substring |

## Leitura Complementar

- [Jiang et al. — ArtPrompt (ACL 2024, arXiv:2402.11753)](https://arxiv.org/abs/2402.11753) — o paper de jailbreak ASCII art
- [Li et al. — StructuralSleight (arXiv:2406.08754)](https://arxiv.org/abs/2406.08754) — generalização UTES
- [Chao et al. — PAIR (Lição 12, arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) — ataque iterativo complementar
- [Anil et al. — Many-shot Jailbreaking (Lição 13)](https://www.anthropic.com/research/many-shot-jailbreaking) — ataque de comprimento complementar
