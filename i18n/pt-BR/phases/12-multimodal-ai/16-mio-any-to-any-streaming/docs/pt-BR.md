# MIO e Modelos Multimodal de Streaming Qualquer Um a Qualquer Um

> O GPT-4o envia um produto que a maioria dos modelos abertos não pode replicar: um agente que ouve voz, vê vídeo e fala em tempo real. A resposta do ecossistema aberto até o final de 2024 foi MIO (Wang et al., setembro 2024). MIO tokeniza texto, imagem, fala e música, treina um transformador causal sobre as sequências entrelaçadas e gera qualquer modalidade para qualquer modalidade. AnyGPT (Zhan et al., fevereiro 2024) foi a prova do conceito; MIO é a escalada; Unified-IO 2 (Allen AI, dezembro 2023) é o primo com a visão + ação de terra. Esta lição lê o padrão de qualquer um para qualquer um  quatro tokenizers, um transformador, decodificação amigável para streaming.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, four-modality token allocator + streaming decode loop)
**Prerequisites:** Phase 12 · 11 (Chameleon), Phase 6 (Speech and Audio)
**Time:** ~120 minutes

## Objetivos de aprendizagem

- Desenhe um vocabulário compartilhado que hospede textos, imagens, fala e tokens de música sem colisões.
- Compare SEED-Tokenizer (imagem) e SpeechTokenizer residual-VQ (discurso) em compressão + reconstrução trade-offs.
- Explique o currículo de quatro etapas que constrói qualquer geração para qualquer geração.
- Cite as três receitas abertas a qualquer pessoa e as suas principais compensações: MIO, AnyGPT, Unified-IO 2.

## O problema

Um modelo multimodal unificado é fácil de reivindicar e difícil de construir em escala. A maioria dos sistemas "de qualquer a qualquer" até 2024 foram pipelineados: modelo de visão → representação de texto → modelo de fala → áudio. Cada espera perde informações, adiciona latência e complica o treinamento. O vídeo demo do GPT-4o mostrou uma alternativa de modelo único com resposta subsequente; sistemas abertos seguidos por meses.

Os desafios de engenharia:

- Os tokenizers devem existir para todas as modalidades, comprimir sem perdas - o suficiente para reconstrução, e produzir tokens às taxas que o transformador pode consumir.
- Um único vocabulário deve atribuir espaço para texto (32k+), imagem (8k+), fala (4k+), música (8k+).
- Os dados de formação devem abranger cada par de entrada e saída (texto→imagem, imagem→discurso, fala→imagem, etc.) ou o modelo deve ser composto.
- A inferência deve transmitir tokens de saída rápido o suficiente para a latência de conversação (<500ms tempo-a-primeiro-byte de áudio).

## O conceito

### Quatro tokenizers para quatro modalidades

A pilha de tokenizer da MIO:

- Texto: BPE padrão, vocabulário ~32000.
- Imagem: SEED-Tokenizer (2023), um tokenizador de imagem discreto com um livro de código de 8192 entradas que emite 32 tokens por imagem.
- Discurso: SpeechTokenizer residual-VQ (2023), que codifica uma forma de onda de 16 kHz em 8 codebooks hierárquicos; o primeiro nível é conteúdo grosseiro, níveis posteriores adicionam prosodia e identidade do alto-falante. MIO mantém o nível de conteúdo mais os três primeiros níveis de timbre, 1024 códigos cada, então 4096 IDs de fala.
- Música: similar residual-VQ (Meta's MusicGen / Encodec family), 4-8 codebooks. MIO não envia um tokenizer de música (sua quarta modalidade é vídeo, como quadros através do tokenizer de imagem); o brinquedo desta lição adiciona música para mostrar como uma nova modalidade reivindica uma faixa de ID.

Cada modalidade produz tokens inteiros. Os tokens recebem intervalos de ID desarticulados no vocabulário compartilhado:

```
text:   0..31999
image:  32000..40191  (8192 image tokens)
speech: 40192..44287  (4 codebooks x 1024 speech tokens)
music:  44288..52479  (8192 music tokens, the toy's extension)
sep:    52480..52485  (<image>, <speech>, <music>, </...>)
```

Total: ~ 52k vocabulário. A inserção de entrada e projeção de saída abrangem todo.

### Descódigo de streaming

A geração de fala usa o restante-VQ. O transformador prevê os tokens de fala base (camada 0); um quantificador residual decodificado paralelo prevê as camadas subsequentes. Cada token de camada 0 é de aproximadamente 50 ms de áudio em 16 kHz.

O padrão de streaming:

1. O usuário fala em microfone; o tokenizer de áudio em tempo real emite tokens de fala a cada 50 ms.
2. MIO consome tokens à sua chegada (preenchimento imediato + avanço incremental).
3. Os tokens de saída fluem como gerados; um decodificador de voz paralelo os converte em amostras de áudio com ~ 50-150ms de latência.
4. Tempo-a-primeira-byte de áudio: o documento MIO não relata nenhum número de latência. O orçamento abaixo coloca este design em cerca de 300ms na melhor das hipóteses, contra ~250ms do GPT-4o.

Mini-Omni (arXiv:2408.16725), GLM-4-Voice (arXiv:2412.02612), e Moshi (arXiv:2410.00037) são projetos complementares de streaming de fala-LLM. Moshi, em particular, alcança 160ms viagem de ida e volta em uma única GPU.

### Currículo de quatro etapas

Currículo de formação do MIO:

1. Estação 1  alinhamento. Corporação de pares de modalidade em grande escala: imagem-texto, fala-texto, música-texto. Cada par usa seu próprio segmento de vocabulário token. Treina o vocabulário compartilhado.
2. Estação 2  interligados. Documentos interligados de várias modalidades (blogs com imagens + vídeo, podcasts com transcrições, etc.).
3. Fase 3  Voz melhorada. Dados de áudio extras para elevar a qualidade da voz sem perder a capacidade de texto.
4. Fase 4  FSS. Aligação de instruções entre modalidades: VQA, subtítulos, narração, diálogo fala-a-fala.

O facto de não ter um estágio degrada as capacidades específicas: saltar a fase 2 e o modelo perder o contexto de modalidade cruzada; saltar a fase 3 e a fala ser pobre.

### Cadeia de pensamento visual

MIO introduz a cadeia de pensamento visual: o modelo emite tokens de imagem intermediários como um passo de raciocínio.

1. Emissões `<image>`Tokens que retransmitem a cena (a partir da imagem de entrada ou de um esboço).
2. Emite texto analisando o esboço.
3. Emite a resposta final.

A imagem intermediária é uma ferramenta de rascunho, e as referências melhoram as tarefas de raciocínio espacial.

### Competidores em qualquer

- AnyGPT (arXiv:2402.12226): 4 modalidades (texto, imagem, fala, música), design semelhante.
- Unified-IO 2 (arXiv:2312.17172): adiciona resultados de ação de visão, profundidade, normais. Mais diversidade de tarefas, menor escala.
- NExT-GPT (arXiv:2309.05519): LLM + decodificadores de difusão específicos de modalidade. Não é uma abordagem de modelo único.
- CoDi (arXiv:2305.11846): difusão compostavel; qualquer-a-qualquer via latente compartilhado.

O MIO é o mais próximo de qualquer token puro a qualquer.

### Orçamento de latência

Para um produto de conversação, a latência de cada componente importa:

- Microphone para tokens de áudio: ~ 50ms.
- Preencher (tokens de áudio + histórico): ~ 100ms em um modelo 8B.
- Primeiro token de saída: ~ 50ms.
- Descóder de voz paralelo residual-VQ +: ~ 100-150ms.

Tempo total de primeira audiobita: ~ 300ms mínimo. GPT-4o afirma ~ 250ms. Moshi afirma 160ms. Nem MIO nem AnyGPT publica um número medido, então trate este orçamento como uma estimativa, não um benchmark.

### Porque é que qualquer um fica duro

Mesmo em 2026, os modelos abertos de qualquer tipo seguem os fechados em dois eixos:

- Qualidade da fala. O tokenizador residual-VQ é perdedor; fala conversacional soa robótica em comparação com vozes da classe ElevenLabs.
- O modelo de "cantando sobre o que vê" ainda falha mais frequentemente do que as tarefas de visão pura.

Estes são problemas de pesquisa aberta. Qwen3-Omni (Lessão 12.20) é a tentativa aberta mais avançada em 2025.

```figure
any-to-any-stream
```

## Usá-lo

`code/main.py`- Não .

- Define a alocação de vocabulário de quatro modalidades e imprime-a.
- Roteia uma lista de entradas multimodal (texto, imagem, áudio-clip, música) através do roteador do tokenizer.
- Simula o decodificação de streaming para uma resposta de texto a fala com contagem de latência.
- Calcula o tempo esperado de primeiro byte de áudio dado por latências de codificação, preenchimento e decodificação.

## Envia-o

Esta lição produz`outputs/skill-any-to-any-pipeline-auditor.md`- Tendo em conta a especificação do produto conversativo (modalidades de entrada, modalidades de saída, meta de latência), verifica as escolhas de design da família MIO e calcula o orçamento de latência.

## Exercícios

1. O seu produto aceita entrada de voz e retorna saída de voz. Qual é o objetivo de orçamento de latência de ponta a ponta?

2. O SpeechTokenizer residual-VQ utiliza 8 codesbooks. Propõe por que a decodificação paralela dos níveis residuais é necessária (versus sequencial) e quais economias de latência traz.

3. O seu vocabulário tem 32k texto + 8k imagem + 4k fala. Adicione música 8k e ~10 separadores. Qual é o custo do parâmetro de matrizes de incorporação em dim 4096 oculto?

4. A cadeia de pensamento visual emite uma imagem intermediária. Que tipos de perguntas beneficiam?

5. Leia Moshi (arXiv:2410.00037). Descreva sua técnica de "monólogo interno" e compare com a cadeia de pensamento visual do MIO.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Any-to-any | "Multimodal in/out" | A single model that accepts and emits text, image, speech, and music in any direction |
| Residual-VQ | "Speech tokenizer stack" | Multi-codebook tokenization where each layer adds information; base layer is content, later layers are prosody |
| SEED-Tokenizer | "Image codes" | Discrete image tokenizer with an 8192-entry codebook and 32 tokens per image, used by MIO |
| Chain-of-visual-thought | "Visual scratchpad" | The model generates an intermediate image as a reasoning step before its final answer |
| Time-to-first-audio-byte | "TTFAB" | Latency from user voice to first audio output; <500ms for conversational feel |
| Four-stage curriculum | "Training recipe" | Alignment -> interleaved -> speech-enhanced -> SFT, in that order |

## Mais leitura

- [Wang et al. — MIO (arXiv:2409.17692)](https://arxiv.org/abs/2409.17692)
- [Zhan et al. — AnyGPT (arXiv:2402.12226)](https://arxiv.org/abs/2402.12226)
- [Lu et al. — Unified-IO 2 (arXiv:2312.17172)](https://arxiv.org/abs/2312.17172)
- [Wu et al. — NExT-GPT (arXiv:2309.05519)](https://arxiv.org/abs/2309.05519)
- [Tang et al. — CoDi (arXiv:2305.11846)](https://arxiv.org/abs/2305.11846)
