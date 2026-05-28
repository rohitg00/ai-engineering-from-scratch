# MIO e Modelos Multimodais Any-to-Any com Streaming

> GPT-4o lançou um produto que a maioria dos modelos open não consegue replicar: um agente que ouve voz, vê vídeo, e fala de volta em tempo real. A resposta do ecossistema open até final de 2024 foi MIO (Wang et al., setembro 2024). MIO tokeniza texto, imagem, fala e música, treina um transformer causal sobre as sequências intercaladas, e gera qualquer modalidade pra qualquer modalidade. AnyGPT (Zhan et al., fevereiro 2024) foi a prova de conceito; MIO é a escalada; Unified-IO 2 (Allen AI, dezembro 2023) é o primo com visão + grounding de ação. Esta aula analisa o padrão any-to-any — quatro tokenizers, um transformer, decodificação amigável a streaming.

**Tipo:** Aprendizado
**Linguagens:** Python (stdlib, alocador de tokens de quatro modalidades + loop de decodificação streaming)
**Pré-requisitos:** Fase 12 · 11 (Chameleon), Fase 6 (Fala e Áudio)
**Tempo:** ~120 minutos

## Objetivos de Aprendizado

- Projetar um vocabulário compartilhado que hospede tokens de texto, imagem, fala e música sem colisões.
- Comparar SEED-Tokenizer (imagens) e SpeechTokenizer residual-VQ (fala) em trade-offs de compressão + reconstrução.
- Explicar o currículo de quatro etapas que constrói geração any-to-any.
- Nomear as três receitas open any-to-any e seus principais trade-offs: MIO, AnyGPT, Unified-IO 2.

## O Problemo

Um modelo multimodal unificado é fácil de alegar e difícil de construir em escala. A maioria dos sistemas "any-to-any" até 2024 eram em pipeline: modelo de visão → representação de texto → modelo de fala → áudio. Cada salto perde informação, adiciona latência e complica o treinamento. O vídeo de demo do GPT-4o mostrou uma alternativa de modelo único com resposta sub-segundo; sistemas open ficaram pra trás por meses.

Os desafios de engenharia:

- Tokenizers precisam existir pra cada modalidade, comprimir sem perda suficiente pra reconstrução, e produzir tokens em taxas que o transformer consegue consumir.
- Um vocabulário único precisa alocar espaço pra texto (32k+), imagem (16k+), fala (4k+), música (8k+). Mais de 40 mil entradas no mínimo.
- Dados de treinamento precisam cobrir cada par de entrada-saída (texto→imagem, imagem→fala, fala→imagem, etc.) ou o modelo precisa compor.
- Inferência precisa transmitir tokens de saída rápido o suficiente pra latência conversacional (<500ms tempo-primeiro-byte-de-áudio).

## O Conceito

### Quatro tokenizers pra quatro modalidades

Stack de tokenizers do MIO:

- Texto: BPE padrão, vocab ~32000.
- Imagem: SEED-Tokenizer (2023) — VAE quantizado com codebook discreto, 4096 entradas, 32x32 tokens por imagem.
- Fala: SpeechTokenizer residual-VQ (2023) — codifica forma de onda 16kHz em 8 codebooks hierárquicos; primeiro nível é conteúdo grosseiro, níveis subsequentes adicionam prosódia e identidade do falante.
- Música: residual-VQ similar (família MusicGen / Encodec do Meta), 4-8 codebooks.

Cada modalidade produz tokens inteiros. Os tokens recebem faixas de ID disjuntas no vocabulário compartilhado:

```
texto:    0..31999
imagem:   32000..36095  (4096 tokens de imagem)
fala:     36096..40191  (4096 tokens base de fala, mais camadas residuais)
música:   40192..48383  (8192 tokens de música)
separador: 48384..48390  (<image>, <speech>, <music>, </...>, etc.)
```

Total: ~48k de vocabulário. A embedding e projeção de saída abrangem tudo.

### Decodificação streaming

Geração de fala usa residual-VQ. O transformer prevê os tokens de fala base (camada 0); um quantizador residual decodificado em paralelo prevê as camadas subsequentes. Cada token da camada 0 é mais ou menos 50ms de áudio a 16kHz.

O padrão de streaming:

1. Usuário fala no microfone; tokenizer de áudio em tempo real emite tokens de fala a cada 50ms.
2. MIO consome tokens conforme chegam (prefill do prompt + forward incremental).
3. Tokens de saída são transmitidos conforme gerados; um decoder de fala em paralelo converte em amostras de áudio com latência de ~50-150ms.
4. Tempo-primeiro-byte-de-áudio: ~300-500ms no paper do MIO, aproximando dos ~250ms do GPT-4o.

Mini-Omni (arXiv:2408.16725), GLM-4-Voice (arXiv:2412.02612) e Moshi (arXiv:2410.00037) são designs complementares de streaming speech-LLM. Moshi em particular atinge 160ms de round-trip em uma GPU.

### Currículo de quatro etapas

O currículo de treinamento do MIO:

1. Etapa 1 — alinhamento. Corpora de pares de modalidade em larga escala: texto-imagem, texto-fala, texto-música. Cada par usa seu próprio segmento de vocabulário. Treina o vocabulário compartilhado.
2. Etapa 2 — intercalada. Documentos intercalados multi-modalidade (blogs com imagem + vídeo, podcasts com transcrição, etc.). Treina contexto cross-modal.
3. Etapa 3 — fala melhorada. Dados extras de áudio pra elevar qualidade de fala sem perder capacidade de texto.
4. Etapa 4 — SFT. Instrução tuning entre modalidades: VQA, legendagem, narração, diálogo fala-a-fala.

Pular uma etapa degrada capacidades eespecificaçãoíficas: pular etapa 2 e o modelo perde contexto cross-modal; pular etapa 3 e a fala fica ruim.

### Cadeia-de-pensamento-visual

MIO introduz cadeia-de-pensamento-visual: o modelo emite tokens de imagem intermediários como etapa de raciocínio. Pra "o gato está escalando uma árvore?", o modelo:

1. Emite tokens `<image>` renderizando a cena (da imagem de entrada ou um esboço).
2. Emite texto analisando o esboço.
3. Emite a resposta final.

A imagem intermediária renderizada serve como rascunho. Benchmarks melhoram em tarefas de raciocínio espacial. A ideia espelha cadeia-de-pensamento pra raciocínio de texto.

### Concorrentes em any-to-any

- AnyGPT (arXiv:2402.12226): 4 modalidades (texto, imagem, fala, música), design similar.
- Unified-IO 2 (arXiv:2312.17172): adiciona saídas de ação visual, profundidade, normais. Mais diversidade de tarefas, escala menor.
- NExT-GPT (arXiv:2309.05519): LLM + decoders de difusão eespecificaçãoíficos por modalidade. Não é abordagem de modelo único.
- CoDi (arXiv:2305.11846): difusão componível; any-to-any via latente compartilhado.

MIO é o mais perto de any-to-any puramente por tokens. AnyGPT é seu ancestral conceitual.

### Orçamento de latência

Pra um produto conversacional, a latência de cada componente importa:

- Microfone pra tokens de áudio: ~50ms.
- Prefill (tokens de áudio + histórico): ~100ms num modelo de 8B.
- Primeiro token de saída: ~50ms.
- Residual-VQ em paralelo + decoder de fala: ~100-150ms.

Tempo total primoero-byte-de-áudio: ~300ms no mínimo. GPT-4o alega ~250ms. Moshi alega 160ms. MIO/AnyGPT ficam na faixa de 400-600ms em benchmarks públicos.

### Por que any-to-any continua difícil

Mesmo em 2026, modelos open any-to-any ficam atrás dos fechados em dois eixos:

- Qualidade de fala. O tokenizer residual-VQ é com perdas; fala conversacional soa robótica comparada a vozes classe ElevenLabs.
- Raciocínio cross-modal. Pedir pro modelo "cante sobre o que você vê" ainda falha mais vezes que tarefas puramente de visão.

Esses são problemas de pesquisa aberta. Qwen3-Omni (Aula 12.20) é a tentativa open mais avançada em 2025.

## Use

`code/main.py`:

- Define a alocação de vocabulário de quatro modalidades e imprime.
- Roteia uma lista de entradas multimodais (texto, imagem, clipe de áudio, música) pelo roteador de tokenizers.
- Simula decodificação streaming pra uma resposta texto-para-fala com contagem de latência.
- Calcula o tempo esperado primoero-byte-de-áudio dado encoder, prefill e latências do decoder.

## Implemente

Esta aula produz `outputs/skill-any-to-any-pipeline-auditor.md`. Dada uma eespecificaçãoificação de produto conversacional (modalidades de entrada, modalidades de saída, alvo de latência), audita as escolhas de design da família MIO e calcula o orçamento de latência.

## Exercícios

1. Seu produto aceita entrada de fala e retorna saída de fala. Qual o alvo de orçamento de latência de ponta a ponta? Liste os componentes que gastam tempo.

2. SpeechTokenizer residual-VQ usa 8 codebooks. Proponha por que decodificar os níveis residuais em paralelo é necessário (vs sequencial) e que economia de latência isso traz.

3. Seu vocabulário tem 32k texto + 4k imagem + 4k fala. Adicione 8k música e ~10 separadores. Qual o custo em parâmetros da matriz de embedding com dimensão oculta 4096?

4. Cadeia-de-pensamento-visual emite uma imagem intermediária. Que tipos de perguntas se beneficiam? Quais são prejudicadas pelos tokens extras?

5. Leia Moshi (arXiv:2410.00037). Descreva sua técnica de "monólogo interno" e compare com a cadeia-de-pensamento-visual do MIO.

## Termos-Chave

| Termo | O que a galera diz | O que realmente significa |
|-------|-------------------|--------------------------|
| Any-to-any | "Multimodal entrada/saída" | Um único modelo que aceita e emite texto, imagem, fala e música em qualquer direção |
| Residual-VQ | "Stack de tokenizer de fala" | Tokenização multi-codebook onde cada camada adiciona informação; camada base é conteúdo, camadas seguintes são prosódia |
| SEED-Tokenizer | "Códigos de imagem" | Tokenizer de imagem discreto com codebook de 4096 entradas usado pelo MIO |
| Cadeia-de-pensamento-visual | "Rascunho visual" | O modelo gera uma imagem intermediária como etapa de raciocínio antes da resposta final |
| Tempo-primeiro-byte-de-áudio | "TTFAB" | Latência da voz do usuário ao primeiro áudio de saída; <500ms pra sensação conversacional |
| Currículo de quatro etapas | "Receita de treinamento" | Alinhamento -> intercalada -> fala melhorada -> SFT, nessa ordem |

## Leitura Complementar

- [Wang et al. — MIO (arXiv:2409.17692)](https://arxiv.org/abs/2409.17692)
- [Zhan et al. — AnyGPT (arXiv:2402.12226)](https://arxiv.org/abs/2402.12226)
- [Lu et al. — Unified-IO 2 (arXiv:2312.17172)](https://arxiv.org/abs/2312.17172)
- [Wu et al. — NExT-GPT (arXiv:2309.05519)](https://arxiv.org/abs/2309.05519)
- [Tang et al. — CoDi (arXiv:2305.11846)](https://arxiv.org/abs/2305.11846)
