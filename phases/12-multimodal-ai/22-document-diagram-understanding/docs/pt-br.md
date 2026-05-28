# Compreensão de Documentos e Diagramas

> Documentos não são fotos. Um PDF, artigo científico, nota fiscal ou formulário manuscrito tem layout, tabelas, diagramas, rodapés, cabeçalhos e estrutura semântica que uma compreensão básica de imagem não consegue capturar. A stack pré-VLM era um pipeline: OCR Tesseract + LayoutLMv3 + heurísticas de extração de tabelas. A onda VLM substituiu isso por modelos sem OCR — Donut (2022), Nougat (2023), DocLLM (2023) — que emitem marcação estruturada diretamente. Em 2026, a fronteira é só "alimentar a imagem da página pro Claude Opus 4.7 a 2576px nativo", e a saída em markup estruturado vem de graça. Esta aula percorre o arco das três eras da IA de documentos.

**Tipo:** Construção
**Linguagens:** Python (stdlib, esqueleto de parser de documentos com consciência de layout)
**Pré-requisitos:** Fase 12 · 05 (LLaVA), Fase 5 (NLP)
**Tempo:** ~180 minutos

## Objetivos de Aprendizado

- Explicar as três eras da IA de documentos: pipeline OCR, sem OCR, VLM-nativo.
- Descrever os três fluxos de entrada do LayoutLMv3: texto, layout (bbox), patches de imagem, com masking unificado.
- Comparar Donut (sem OCR, imagem → markup), Nougat (artigo científico → LaTeX), DocLLM (generativo com consciência de layout), PaliGemma 2 (VLM-nativo).
- Escolher um modelo de documento para uma nova tarefa (notas fiscais, artigos científicos, formulários manuscritos, recibos chineses).

## O Problemo

"Entender esse PDF" é surpreendentemente difícil. A informação está em:

- Conteúdo textual (90% do sinal).
- Layout (cabeçalhos, rodapés, laterais, formato de duas colunas).
- Tabelas (linhas, colunas, células mescladas).
- Figuras e diagramas.
- Anotações manuscritas.
- Fontes e tipografia (título vs corpo).

OCR bruto joga o texto fora e perde o resto. Um sistema que lida com notas fiscais precisa saber que "Total: R$ 1.245" veio do canto inferior direito, não de um rodapé.

## O Conceito

### Era 1 — Pipeline OCR (pré-2021)

A stack clássica:

1. PDF → imagem por página.
2. Tesseract (ou OCR comercial) extrai texto com bounding boxes por palavra.
3. Analisador de layout identifica blocos (cabeçalho, tabela, parágrafo).
4. Reconhecedor de estrutura de tabelas parseia tabelas.
5. Regras de domínio + regex extraem campos.

Funciona para texto impresso limpo. Falha em manuscritos, escaneamentos tortos, tabelas complexas, scripts não-ingleses. Cada modo de falha exige um caminho de exceção customizado.

### TrOCR (2021)

TrOCR (Li et al., arXiv:2109.10282) substituiu o CNN-TC clássico do Tesseract por um transformer encoder-decoder treinado em imagens de texto sintéticas + reais. Vitória clara em texto manuscrito e multilíngue. Ainda é um pipeline (detector → TrOCR → layout), mas o passo de OCR melhorou drasticamente.

### Era 2 — Sem OCR (2022-2023)

Os primeiros modelos sem OCR disseram: pule deteção inteiramente, mapeie pixels da imagem diretamente pra saída estruturada.

Donut (Kim et al., arXiv:2111.15664):
- Transformer encoder-decoder, encoder é Swin-B.
- Saída é JSON para compreensão de formulários, markdown para sumarização, ou qualquer schema eespecificaçãoífico de tarefa.
- Sem OCR, sem layout, sem deteção.

Nougat (Blecher et al., arXiv:2308.13418):
- Treinado eespecificaçãoificamente em artigos científicos.
- Saída é LaTeX / markdown.
- Lida com equações, layout multi-coluna, figuras.
- O modelo que todo parser de arXiv usa.

Esses são eespecificaçãoialistas, não generalistas. Donut em artigo científico falha; Nougat em nota fiscal falha.

### LayoutLMv3 (2022)

Uma trilha diferente. LayoutLMv3 (Huang et al., arXiv:2204.08387) mantém OCR mas adiciona compreensão de layout:

- Três fluxos de entrada: tokens de texto OCR, bounding boxes 2D por token, patches de imagem.
- Objetivo de treinamento com masking em todas as três modalidades (texto mascarado, patches mascarados, layout mascarado).
- Downstream: classificação, extração de entidades, Q&A de tabelas.

LayoutLMv3 é o ápice da compreensão de documentos baseada em OCR. Forte em formulários e notas fiscais. Exige OCR a montante. Melhor acurácia pré-VLM em benchmarks padronizados de documentos.

### DocLLM (2023)

DocLLM (Wang et al., arXiv:2401.00908) é o irmão generativo do LayoutLM. Gera respostas livres condicionadas em tokens de layout. Melhor para Q&A em documentos; ainda depende de entrada de OCR.

### Era 3 — VLM-nativo (2024+)

2024 VLMs ficaram bons o suficiente pra substituir o pipeline inteiro. Alimente a imagem da página completa em alta resolução num VLM, faça a pergunta, receba a resposta.

- LLaVA-NeXT 336-tile AnyRes funciona para documentos pequenos.
- Qwen2.5-VL resolução dinâmica lida com 2048+ pixels nativamente.
- Claude Opus 4.7 suporta documentos de 2576px.
- PaliGemma 2 (abril de 2025) treina eespecificaçãoificamente para documentos + manuscritos.

O gap entre VLM-nativo e pipeline OCR fechou rapidamente. Em 2026, VLM-nativo ganha em:

- Texto de cena (manuscrito + impresso, scripts mistos).
- Tabelas complexas com células mescladas.
- Equações matemáticas embutidas no texto.
- Figuras com anotações textuais.

Pipelines OCR ainda ganham em:

- Workloads de escaneamento puro em massa onde latência por página importa.
- Confiabilidade de pipeline (falhas determinísticas vs alucinações de VLM).
- Ambientes regulados que exigem saída de OCR auditável.

### A fronteira Claude 4.7 / GPT-5

Com entrada nativa de 2576 pixels, VLMs de fronteira fazem compreensão de documentos com acurácia quase humana. Os números de benchmark do início de 2026:

- DocVQA: Claude 4.7 ~95.1, PaliGemma 2 ~88.4, Nougat ~77.3, LayoutLMv3 em pipeline ~83.
- ChartQA: Claude 4.7 ~92.2, GPT-4V ~78.
- VisualMRC: Claude 4.7 ~94.

O gap entre modelos fechados é majoritariamente resolução e escala do LLM base. Modelos abertos a 7B estão alguns pontos atrás mas alcançando.

### Equações matemáticas e saída LaTeX

Artigos científicos precisam de saída LaTeX exata para equações. Nougat foi treinado pra isso. VLMs treinados com alvos LaTeX (Qwen2.5-VL-Math, derivados do Nougat) produzem LaTeX utilizável. Sem treinamento explícito de LaTeX, VLMs produzem transcrições legíveis mas imprecisas.

Para pipelines de artigos científicos em 2026: encadene Nougat no PDF, depois um VLM nas páginas difíceis.

### Manuscritos

Ainda a subtarefa mais difícil. Impresso misto + manuscrito (notas de médico, formulários preenchidos) é onde pipelines OCR ainda batem VLMs em custo. Manuscritos puros em VLMs estão melhorando (Claude 4.7, PaliGemma 2).

### Receita de 2026

Para um novo projeto de IA de documentos:

- Notas fiscais puramente impressas em escala: LayoutLMv3 + regras, eficiente em custo.
- Documentos mistos (científico + manuscrito + formulários): VLM-nativo (PaliGemma 2 ou Qwen2.5-VL).
- Ingestão completa de arXiv: Nougat pra matemática, VLM pra figuras.
- Regulatório: pipeline OCR + validador VLM pra verificação cruzada.

## Use

`code/main.py`:

- Tokenizador de exemplo com consciência de layout: dadas pares (texto, bbox), produz entrada estilo LayoutLMv3.
- Gerador de schema de tarefa estilo Donut: template JSON para formulários.
- Comparação de orçamento de tokens por página entre pipeline OCR, Donut, Nougat e VLM-nativo.

## Entregue

Esta aula produz `outputs/skill-document-ai-stack-picker.md`. Dado um projeto de IA de documentos (domínio, escala, qualidade, regulatório), escolhe entre pipeline OCR, eespecificaçãoialista sem OCR, e VLM-nativo.

## Exercícios

1. Seu projeto processa 10M de notas fiscais por dia. Qual stack minimiza custo por página sem perder acurácia?

2. Por que o LayoutLMv3 supera VLMs puros de CLIP em Q&A de formulários mas perde em texto de cena? O que o fluxo bbox sacrificou?

3. Nougat gera LaTeX. Proponha um caso de teste onde saída VLM-nativa supera Nougat em fidelidade de LaTeX, e um caso onde Nougat ganha.

4. Leia o artigo do PaliGemma 2 (Google, 2024). Qual foi a adição chave nos dados de treinamento que elevou a acurácia de documentos vs PaliGemma 1?

5. Projete um híbrido seguro para regulatórios: pipeline OCR como primário, VLM como verificação secundária. Como você resolve divergência?

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|--------------------------|
| Pipeline OCR | "Estilo Tesseract" | Stack em estágios: detectar → OCR → layout → regras; determinístico, frágil |
| Sem OCR | "Estilo Donut" | Transformer imagem-to-output que pula OCR explícito; modelo único |
| Consciência de layout | "LayoutLM" | Entrada inclui coordenadas bbox por token; masking unificado entre modalidades |
| VLM-nativo | "VLM de fronteira" | Alimentar imagem da página diretamente em Claude/GPT/Qwen VLM em alta resolução; sem pipeline |
| DocVQA | "Benchmark de documentos" | Padrão de VQA de documentos; score mais citado |
| Saída em markup | "LaTeX / MD" | Formato de saída estruturado em vez de texto livre; habilita automação downstream |

## Leitura Adicional

- [Li et al. — TrOCR (arXiv:2109.10282)](https://arxiv.org/abs/2109.10282)
- [Blecher et al. — Nougat (arXiv:2308.13418)](https://arxiv.org/abs/2308.13418)
- [Huang et al. — LayoutLMv3 (arXiv:2204.08387)](https://arxiv.org/abs/2204.08387)
- [Kim et al. — Donut (arXiv:2111.15664)](https://arxiv.org/abs/2111.15664)
- [Wang et al. — DocLLM (arXiv:2401.00908)](https://arxiv.org/abs/2401.00908)
