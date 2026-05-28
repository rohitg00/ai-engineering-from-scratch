# Família Qwen-VL e Vídeo com FPS Dinâmico

> A família Qwen-VL — Qwen-VL (2023), Qwen2-VL (2024), Qwen2.5-VL (2025), Qwen3-VL (2025) — é a linhagem de modelo de visão-linguagem aberto mais influente em 2026. Cada geração fez uma aposta arquitetural decisiva que o resto do ecossistema aberto copiou em doze meses: resolução dinâmica nativa via M-RoPE, amostragem com FPS dinâmico e alinhamento de tempo absoluto, attention em janela no ViT e formatos de saída de agente estruturados. No Qwen3-VL, a receita se estabilizou: encoder ViT com 2D-RoPE e entradas de proporção nativa, projetor MLP pra uma base de linguagem Qwen3 grande e estágios de treino que enfatizavam OCR, grounding e comportamento de agente como alvos de primeira classe. Essa lição lê a família cronologicamente pra você entender por que cada ajuste está onde está.

**Tipo:** Aprendizado
**Linguagens:** Python (stdlib, encoder M-RoPE + sampler com FPS dinâmico)
**Pré-requisitos:** Fase 12 · 06 (patch-n'-pack)
**Tempo:** ~120 minutos

## Objetivos de Aprendizado

- Calcular as rotações de três eixos do M-RoPE (temporal, altura, largura) e explicar por que todas as três são necessárias.
- Escolher uma estratégia de amostragem com FPS dinâmico pra um vídeo e raciocinar sobre tokens-por-segundo vs. acurácia de detecção de eventos.
- Nomear as quatro melhorias geracionais do Qwen-VL em ordem e o que cada uma habilitou.
- Implementar um formato de saída de agente estilo JSON do Qwen2.5-VL e parsear chamadas de ferramentas estruturadas de uma resposta de VLM.

## O Problema

Qwen-VL entrou em agosto de 2023 como resposta direta ao LLaVA-1.5 e BLIP-2. A lacuna que o time Qwen visava era tripla: resolução, vídeo e saída estruturada.

Resolução: LLaVA-1.5 rodava em 336x336. Bom pra fotos, inútil pra uma nota fiscal em chinês ou um screenshot de planilha densa. A primeira inovação do Qwen-VL foi 448x448 e saída de bounding box com grounding, permitindo que o modelo apontasse pra coisas.

Vídeo: Video-LLaMA empilhava encoders por frame e os alimentava no LLM. Funcionava pra clipes curtos, não pra vídeos de vários minutos onde o eixo temporal é o sinal. O time Qwen queria um encoder único que entendesse tempo.

Saída estruturada: LLaVA emitia texto livre. Um agente precisa de JSON. Qwen-VL treinou em formatos explícitos de saída JSON incluindo coordenadas de bounding box como texto.

Cada geração do Qwen-VL estende um desses três eixos.

## O Conceito

### Qwen-VL (agosto de 2023)

Primeira geração: OpenCLIP ViT-bigG/14 como encoder (2.5B parâmetros), Q-Former compatível com LLama (1 passo com 256 queries), base Qwen-7B. Contribuições:

- Resolução 448x448 (SOTA pra VLM aberto na época).
- Grounding: treinado em pares imagem-texto com saída explícita de tokens de coordenada. "O gato está em <box>(112, 204), (280, 344)</box>."
- Treinamento multilíngue chinês + inglês desde o início.

Benchmarks na época: competitivo com GPT-4V em inglês, dominante em chinês. A supervisão de grounding era o grande destaque.

### Qwen2-VL (setembro de 2024) — M-RoPE e resolução nativa

Qwen2-VL substituiu a stack de resolução fixa + Q-Former por um encoder ViT com resolução dinâmica nativa. Mudanças principais:

- Resolução dinâmica nativa. ViT aceita qualquer HxW divisível por 28 (patch 14 com merge espacial 2x). Uma imagem de 1120x672 (40x24 patches mesclados) produz 960 tokens visuais. Sem resize, sem mosaico, sem thumbnail.
- M-RoPE (RoPE Multimodal). Cada token carrega uma posição 3D (t, h, w) em vez de 1D. Pra imagens t=0, pra vídeo t = índice do frame. RoPE rotaciona vetores consulta/key por uma frequência por eixo. Sem tabela de embedding posicional.
- Projetor MLP. Dropa Q-Former; usa MLP de 2 camadas nos patches mesclados.
- Vídeo com FPS dinâmico. Vídeo amostrado a 1-2 FPS por padrão, mas modelo aceita quantidades arbitrárias de frames.

Resultado: Qwen2-VL-7B igualou GPT-4o em vários benchmarks multimodais e o superou em DocVQA (94.5 vs 88.4). A mudança de arquitetura foi o lance decisivo.

### Qwen2.5-VL (fevereiro de 2025) — FPS dinâmico + tempo absoluto

A grande mudança do Qwen2.5-VL foi em vídeo. FPS dinâmico não é apenas "amostrar mais frames quando necessário." O artigo formalizou:

- Tokens de tempo absoluto. Em vez de índices posicionais (frame 0, 1, 2...), usa timestamps reais. "Em 0:04, o gato pula." O modelo vê tokens `<time>0.04</time>` intercalados com tokens de frame.
- FPS dinâmico. Amostra a 1 FPS pra footage lenta, 4+ FPS pra ação. O usuário ou treinador escolhe; M-RoPE se adapta.
- Attention em janela no ViT. Attention espacial é em janela (local dentro de blocos) pra throughput; attention global a cada poucas camadas.
- Formato de saída JSON explícito. Treinado em dados de chamada de ferramentas: "{\"tool\": \"click\", \"coords\": [380, 220]}". Agente pronto de fábrica.
- Escalamendo MRoPE-v2. Posições escalam com o tamanho máximo de entrada pra que um vídeo de 10 minutos não acabe com a faixa de frequência.

Benchmarks: Qwen2.5-VL-72B supera GPT-4o na maioria dos benchmarks de vídeo, iguala Gemini 2.0 em documentos e define SOTA de modelo aberto pra GUI grounding (ScreenSpot: 84% de acurácia vs 38% do GPT-4V).

### Qwen3-VL (novembro de 2025)

Qwen3-VL é uma melhoria incremental que consolida em vez de reinventar: LLM backbone maior (Qwen3-72B), dados de treino expandidos, OCR melhorado, raciocínio mais forte via "modo de pensamento" do Qwen3. ViT e M-RoPE permanecem. O artigo foca em melhorias de dados e treino sobre arquitetura.

A lição da linhagem: até 2025, a arquitetura Qwen-VL se estabilizou. Gerações adicionais escalam computação e dados, não primitivas.

### M-RoPE matematicamente

RoPE clássico rotaciona um consulta `q` de dimensão `d` por posição `m` usando coordenadas em pares:

```
q_rot[2i]   = q[2i]   * cos(m * theta_i) - q[2i+1] * sin(m * theta_i)
q_rot[2i+1] = q[2i]   * sin(m * theta_i) + q[2i+1] * cos(m * theta_i)
theta_i     = 10000^(-2i/d)
```

M-RoPE divide a dimensão oculta em três faixas. Digamos `d = 96`. Atribui 32 dims pra temporal, 32 pra altura, 32 pra largura. Cada faixa rotaciona por sua própria posição de eixo. Um patch em (t=5, h=10, w=20) recebe rotações `R_t(5)`, `R_h(10)`, `R_w(20)` aplicadas em suas três faixas.

Tokens de texto usam `t = índice_texto, h = 0, w = 0` (ou uma escolha normalizada), mantendo compatibilidade. Frames de vídeo usam `t = tempo_frame, h = linha, w = coluna`. Imagens únicas usam `t = 0`.

O benefício: uma codificação posicional única lida com texto, imagem e vídeo sem código ramificado ou tabelas de posição diferentes.

### Lógica de amostragem com FPS dinâmico

Dado um vídeo de duração `T` segundos e um orçamento-alvo de tokens `B`:

1. Calcula o FPS máximo que você pode bancar: `fps_max = B / (T * tokens_por_frame)`.
2. Escolhe um FPS-alvo de `{1, 2, 4, 8}` que satisfaz `fps <= fps_max`.
3. Se o movimento é alto (heurística de fluxo óptico ou pedido explícito do usuário), escolhe FPS mais alto. Se baixo, escolhe mais baixo.
4. Amostra uniformemente no FPS escolhido; insere tokens `<time>t</time>` entre frames.

Qwen2.5-VL treina essa lógica implicitamente; na inferência o usuário controla via parâmetro `fps`. Uma sequência de ação de 60 segundos a 4 FPS com 81 tokens por frame = 19440 tokens, gerenciável num contexto de 32k.

### Saída de agente estruturada

O treino de agente do Qwen2.5-VL visa explicitamente chamadas de ferramentas estruturadas:

```
{
  "tool": "mouse_click",
  "coords": [1024, 512],
  "button": "left",
  "modifier": null
}
```

Parse é determinístico: JSON.parse na saída do modelo. Comparado com "clique em (1024, 512)" em texto livre que exigia regex e tratamento de ambiguidade. A mudança é por que os scores ScreenSpot do Qwen2.5-VL saltaram de 55% do Qwen2-VL pra 84%.

## Use

`code/main.py` implementa:

- Cálculo posicional M-RoPE pra uma sequência empacotada misturando texto, patches de imagem e frames de vídeo.
- Sampler com FPS dinâmico: dado (duração, orçamento, nível_movimento), escolhe FPS e emite timestamps de frame.
- Um parser de brinquedo de saída JSON do Qwen2.5-VL que lida com respostas de chamada de ferramenta com campos de coordenada.

Rode e sinta a diferença quando trocar FPS fixo por FPS dinâmico num vídeo de 5 minutos.

## Entregue

Essa lição produz `outputs/skill-qwen-vl-pipeline-designer.md`. Dada uma tarefa de vídeo (monitoramento, agente, reconhecimento de ação, acessibilidade), emite a configuração do Qwen2.5-VL (orçamento de frames, estratégia de FPS, flag de attention em janela, modo de saída de agente) e estimativa de latência. Use sempre que deployar um modelo da família Qwen-VL pra um produto de vídeo.

## Exercícios

1. Calcule as rotações M-RoPE pra um patch em (t=3, h=5, w=7) com dim oculta 48 (16 por faixa, theta base 10000). Mostre os ângulos de rotação pra os três primeiros pares em cada faixa.

2. Uma gravação de câmera de segurança de 10 minutos a 1 FPS produz quantos frames? Em resolução 384 com pooling 3x, quantos tokens no total? O contexto padrão de 32k do Qwen2.5-VL lida com isso?

3. Escolha FPS pra um rally de tênis de 30 segundos vs uma demonstração de receita de 30 segundos vs uma gravação de agente de UI de 30 segundos. Justifique cada um com a lógica de FPS dinâmico.

4. Qwen2.5-VL dropa Q-Former completamente. Por que um MLP simples funciona em 2025 mas não em 2023? (Dica: escala de dados e qualidade do encoder.)

5. Parse três saídas de chamada de ferramenta JSON do Qwen2.5-VL em dicts de Python. O que falha pra JSON malformado e qual estratégia de recuperação o cookbook do Qwen recomenda?

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|-------------------------|
| M-RoPE | "RoPE multimodal" | Embedding posicional rotacional 3D com faixas de tempo, altura e largura na dimensão oculta |
| FPS dinâmico | "Amostragem inteligente" | Taxa de amostragem de frames escolhida por vídeo baseada em movimento, duração e orçamento de tokens |
| Token de tempo absoluto | "Token de timestamp" | `<time>t</time>` intercalado na sequência pra que o modelo veja segundos reais não índice de frame |
| Attention em janela | "Attention local" | Self-attention espacial restrita a pequenas janelas pra velocidade; attention global adicionada periodicamente |
| Saída de agente estruturada | "Modo JSON" | Supervisão de dados de treino ensinando o VLM a emitir JSON parseável com coordenadas e nomes de ferramentas |
| min_pixels / max_pixels | "Limites de resolução" | Controles por requisição do Qwen2.5-VL que limitam contagem total de pixels e portanto contagem de tokens |
| Grounding | "Apontar pra isso" | Emitir coordenadas de bounding box como tokens de texto; usado desde Qwen-VL v1 |

## Leitura Complementar

- [Bai et al. — Qwen-VL (arXiv:2308.12966)](https://arxiv.org/abs/2308.12966)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
- [Qwen Team — Qwen2.5-VL Technical Report (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
- [Qwen Team — Qwen3-VL (arXiv:2511.21631)](https://arxiv.org/abs/2511.21631)
- [Zhu et al. — InternVL3 (arXiv:2504.10479)](https://arxiv.org/abs/2504.10479)