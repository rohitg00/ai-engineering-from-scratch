# Compreensão do documento e do diagrama

> Os documentos não são fotos. Um PDF, documento científico, faturamento ou formulário manuscrito tem um layout, tabelas, diagramas, notas de rodapé, cabeçalhos e estrutura semântica que a compreensão de imagens simples não pode capturar. A pilha pré-VLM era um pipeline: Tesseract OCR + LayoutLMv3 + heurísticas de extracção de tabela. A onda VLM substituiu os modelos sem OCR  Donut (2022), Nougat (2023), DocLLM (2023)  que emitem marcas estruturadas diretamente. Em 2026, a fronteira é apenas "alimentar a imagem da página para Claude Opus 4.7 em 2576px nativo", e a saída de marcação estruturada vem gratuitamente. Esta lição lê o arco de três eras da IA de documentos.

**Type:** Build
**Languages:** Python (stdlib, layout-aware document parser skeleton), TypeScript
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 5 (NLP)
**Time:** ~180 minutes

## Objetivos de aprendizagem

- Explique as três eras da IA de documentos: OCR pipeline, OCR-free, VLM-native.
- Descreva os três fluxos de entrada do LayoutLMv3: texto, layout (bbox), patches de imagem, com mascaragem unificada.
- Compare Donut (livre de OCR, imagem → marcação), Nougat (papel científico → LaTeX), DocLLM (generativo de layout), PaliGemma 2 (nativo VLM).
- Escolha um modelo de documento para uma nova tarefa (facturas, trabalhos científicos, formulários manuscritos, recibos chineses).

## O problema

"Entender este PDF" é enganosamente difícil.

- Conteúdo de texto (90% do sinal).
- Layout (títulos, notas de rodapé, barras laterais, formato de duas colunas).
- Tablas (linhas, colunas, células combinadas).
- Figuras e diagramas.
- Anotativas manuscritas.
- Fontes e tipografia (título vs corpo).

O OCR bruto descarta o texto e perde o resto. Um sistema que se importa com as faturas precisa saber "Total: $1.245" veio da parte inferior à direita, não de uma nota de rodapé.

## O conceito

### Era 1  OCR (antes de 2021)

A pilha clássica:

1. PDF → imagem por página.
2. O Tesseract (ou OCR comercial) extrai texto com caixas de limite por palavra.
3. O analisador de layout identifica blocos (título, tabela, parágrafo).
4. Reconhecedor de estrutura de tabela paralisa tabelas.
5. Regras de domínio + campos de extração de regex.

Funciona para texto impresso limpo. Fugas na escrita, digitalização distorcida, tabelas complexas, scripts não-inglês.

### TrOCR (2021)

TrOCR (Li et al., arXiv:2109.10282) substituiu o clássico CNN-CTC da Tesseract por um transformador encoder-decoder treinado em imagens de texto sintéticas + reais.

### Era 2  Livre de OCR (2022-2023)

Os primeiros modelos sem OCR disseram: "Salte a detecção inteiramente, mapeie os pixels de imagem para a saída estruturada diretamente".

Donut (Kim et al., arXiv:2111.15664):
- Transformador de codificador-decodificador, codificador é Swin-B.
- A saída é JSON para compreensão de formulários, marcação para resumo ou qualquer esquema específico de tarefa.
- Sem OCR, sem layout, sem detecção.

Nougat (Blecher et al., arXiv:2308.13418):
- Formada especificamente em artigos científicos.
- A saída é LaTeX / markdown.
- Manuseia equações, layout de colunas múltiplas, figuras.
- O modelo que cada arXiv-parser chama.

São especialistas, não generalistas. O donut num artigo científico falha; o nougat numa fatura falha.

### LayoutLMv3 (2022)

Uma faixa diferente. LayoutLMv3 (Huang et al., arXiv:2204.08387) mantém OCR mas adiciona compreensão de layout:

- Três fluxos de entrada: tokens de texto OCR, caixas de limite 2D por token, parches de imagem.
- Objectivo de formação mascarada em todas as três modalidades (texto mascarado, parches mascarados, layout mascarado).
- A seguir: classificação, extração de entidades, tabela QA.

LayoutLMv3 é o auge da compreensão de documentos baseados em OCR. Forte em formulários e faturas. Requer OCR upstream. Melhor precisão pré-VLM em referências padronizadas de documentos.

### DocLLM (2023)

DocLLM (Wang et al., arXiv:2401.00908, apresentado 31 de dezembro de 2023, então o ID carrega um prefixo de janeiro de 2024) é o irmão gerativo do LayoutLM. Gera respostas de forma livre condicionadas a tokens de layout. Melhor para QA em documentos; ainda depende da entrada de OCR.

### Era 3  VLM-nativo (2024+)

2024 VLMs tornou-se bom o suficiente para substituir o gasoduto inteiramente.

- LLaVA- NEXT 336-tile AnyRes funciona para pequenos documentos.
- Qwen2.5VL de resolução dinâmica lida com 2048+ pixels nativo.
- Claude Opus 4.7 suporta documentos de 2576px.
- PaliGemma 2 (dezembro de 2024) treina especificamente para documentos + escrita à mão.

A lacuna entre o VLM-nativo e o OCR-pipeline foi rapidamente encerrada.

- Texto de cena (escrito à mão + impresso, scripts mistos).
- Tablas complexas com células fundidas.
- Equações matemáticas incorporadas no texto.
- Figuras com anotações de texto.

Os gasodutos OCR continuam a ganhar:

- Cargas de trabalho de escaneamento puro em escala maciça onde a latência por página importa.
- Confiabilidade do gasoduto (falhas deterministas versus alucinações VLM).
- Ambientes regulamentados que exigem uma saída de OCR auditável.

### A fronteira Claude 4.7 / GPT-5

Com entrada nativa de 2576 pixels, os VLMs de fronteira documentam a compreensão com precisão quase humana.

- DocVQA: Claude 4.7 ~ 95,1, PaliGemma 2 ~ 88,4, Nougat ~ 77,3, Layout em tubulaçãoLMv3 ~ 83.
- ChartQA: Claude 4.7 ~ 92,2, GPT-4V ~ 78.
- VisualMRC: Claude 4.7 ~ 94.

O espaço entre os modelos fechados é principalmente de resolução e escala LLM base. Os modelos abertos em 7B estão alguns pontos atrás, mas conseguem alcançar.

### Equações matemáticas e saída de LaTeX

Os trabalhos científicos precisam de exata saída de LaTeX para equações. Nougat foi treinado sobre isso. VLMs treinados com metas LaTeX (Qwen2.5-VL-Math, derivados de Nougat) produzem LaTeX utilizável. Sem treinamento explícito LaTeX, VLMs produzem transcrições legíveis, mas imprecisas.

Para os canais de papel científico em 2026: cadeia Nougat no PDF, depois um VLM em páginas complicadas.

### Escrita à mão

Ainda é a sub-tarefa mais difícil. A impressão mista + escrita à mão (notificações de médicos, formulários preenchidos) é onde os canais de OCR ainda superam os VLM em custo.

### 2026 receita

Para um novo projecto de IA documental:

- Faturas impressas em escala: LayoutLMv3 + regras, custo-eficiente.
- Documentos mistos (científicos + manuscritos + formulários): nativos do VLM (PaliGemma 2 ou Qwen2.5-VL).
- Ingestão completa do arXiv: Nougat para matemática, VLM para números.
- Regulatório: OCR pipeline + VLM validador para verificação cruzada.

```figure
mm-doc-layout
```

## Usá-lo

`code/main.py`- Não .

- Um tokenizer de brinquedo consciente de layout: dado (texto, bbox) pares, produz a entrada de estilo LayoutLMv3.
- Um gerador de esquema de tarefa de estilo Donut: modelo JSON para formulários.
- Uma comparação de orçamentos de tokens por página em toda a pipeline OCR, Donut, Nougat e VLM-native.

## Envia-o

Esta lição produz`outputs/skill-document-ai-stack-picker.md`- Tendo em conta um projecto de IA de documentos (domínio, escala, qualidade, regulamentação), escolha entre o pipeline de OCR, o especialista livre de OCR e o VLM nativo.

## Exercícios

1. O teu projeto é de 10 milhões de faturas por dia.

2. Por que o layoutLMv3 supera os CLIP-VLMs puros no formulário QA mas tem um desempenho inferior no texto de cena?

3. Propõe um caso de teste onde a saída nativa VLM vence o Nougat na fidelidade LaTeX, e um caso em que o Nougat ganha.

4. Leia o artigo PaliGemma 2 (Google, 2024). Qual foi a adição chave de dados de treinamento que levantou a precisão do documento versus PaliGemma 1?

5. Desenhar um híbrido regulatório seguro: OCR como principal, VLM como secundário de verificação cruzada. Como resolver desentendimentos?

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| OCR pipeline | "Tesseract-style" | Stage-wise stack: detect -> OCR -> layout -> rules; deterministic, fragile |
| OCR-free | "Donut-style" | Image-to-output transformer that skips explicit OCR; single model |
| Layout-aware | "LayoutLM" | Input includes per-token bbox coordinates; unified masking across modalities |
| VLM-native | "Frontier VLM" | Feed page image directly to Claude/GPT/Qwen VLM at high resolution; no pipeline |
| DocVQA | "Doc benchmark" | Document VQA standard; most-cited score |
| Markup output | "LaTeX / MD" | Structured output format instead of free-form text; enables downstream automation |

## Mais leitura

- [Li et al. — TrOCR (arXiv:2109.10282)](https://arxiv.org/abs/2109.10282)
- [Blecher et al. — Nougat (arXiv:2308.13418)](https://arxiv.org/abs/2308.13418)
- [Huang et al. — LayoutLMv3 (arXiv:2204.08387)](https://arxiv.org/abs/2204.08387)
- [Kim et al. — Donut (arXiv:2111.15664)](https://arxiv.org/abs/2111.15664)
- [Wang et al. — DocLLM (arXiv:2401.00908)](https://arxiv.org/abs/2401.00908)
