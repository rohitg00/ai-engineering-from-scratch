# Qwen-VL Família e Dinâmico-FPS Video

> A família Qwen-VL  Qwen-VL (2023), Qwen2-VL (2024), Qwen2.5-VL (2025), Qwen3-VL (2025)  é a linhagem de modelos de linguagem de visão aberta mais influente em 2026. Cada geração fez uma única aposta arquitetônica decisiva que o resto do ecossistema aberto copiou em doze meses: resolução dinâmica nativa através de M-RoPE, amostragem dinâmica-FPS com alinhamento de tempo absoluto, atenção de janela no ViT e formatos de saída de agente estruturado. Por Qwen3-VL, a receita havia se estabilizado: um codificador 2D-RoPE-ViT com entradas nativas de relação de aspecto, um projetor MLP em uma grande base de linguagem Qwen3, e estágios de treinamento que enfatizava o OCR, o enraizamento e o comportamento do agente como alvos de primeira classe. Esta lição lê a família em ordem cronológica para que compreendas por que cada botão está onde está.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, M-RoPE encoder + dynamic-FPS sampler)
**Prerequisites:** Phase 12 · 06 (patch-n'-pack)
**Time:** ~120 minutes

## Objetivos de aprendizagem

- Calcule as rotações de três eixos do M-RoPE (temporal, altura, largura) e explique por que são necessárias todas as três.
- Escolha uma estratégia de amostragem FPS dinâmica para um vídeo e racionalize a precisão dos tokens por segundo versus a detecção de eventos.
- Cite as quatro atualizações geracionais do Qwen-VL em ordem e o que cada uma permitiu.
- Enviar um formato de saída de agente JSON de estilo Qwen2.5-VL e analisar as chamadas de ferramentas estruturadas a partir de uma resposta VLM.

## O problema

O Qwen-VL foi enviado em agosto de 2023 como resposta direta ao LLaVA-1.5 e BLIP-2.

Resolução: LLaVA-1.5 funcionou em 336x336. Bom para fotos, inútil para uma fatura em chinês ou uma tela de tela de cálculo densa. A primeira inovação do Qwen-VL foi 448x448 e saída de caixa de limite terrestre, deixando o modelo apontar para as coisas.

Video: Video-LLaMA empilhou codificadores por quadro e os alimentou para o LLM. Funcionou para clips curtos, não para vídeos de vários minutos onde o eixo temporal é o sinal. A equipe Qwen queria um único codificador que entenda o tempo.

Output estruturado: LLaVA emite texto de forma livre. Um agente precisa de JSON. Qwen-VL treinado em formatos de saída JSON explícitos, incluindo coordenadas de caixa de limites como texto.

Cada geração Qwen-VL estende um destes três eixos.

## O conceito

### Qwen-VL (agosto 2023)

A primeira geração: OpenCLIP ViT-bigG/14 como codificador (2.5B parâmetros), LLama-compatível Q-Former (1-passo com 256 consultas), base Qwen-7B. Contribuições:

- Resolução 448x448 (então SOTA para um VLM aberto).
- A formação de terra: treinado em pares de imagem-texto com saída explícita de tokens de coordenadas. "O gato está em <box>(112, 204), (280, 344)</box>".
- Formação multilingüe em chinês + inglês desde o início.

Os critérios de referência na época: competitivo com o GPT-4V em inglês, dominante no chinês.

### Qwen2-VL (septembro de 2024)  M-RoPE e resolução nativa

Qwen2-VL substituiu a pilha de resolução fixa + Q-Former por um codificador ViT de resolução dinâmica nativo.

- Resolução dinâmica nativa. O ViT aceita qualquer HxW divisível por 28 (patch 14 com 2x fusão espacial). Uma imagem em 1120x672 (40x24 patches fusíveis) produz 960 tokens visuais.
- M-RoPE (RoPE multimodal). Cada token carrega uma posição 3D (t, h, w) em vez de 1D. Para imagens t = 0, para vídeo t = frame_index. RoPE gira vectores de consulta / chave por uma frequência por eixo.
- Lança o Q-Former, use um MLP de 2 camadas nos tokens de parche combinados.
- Vídeo com FPS dinâmico. Vídeo amostrado a 1-2 FPS por padrão, mas o modelo aceita contagens arbitrárias de quadros.

Resultado: Qwen2-VL-7B equipara GPT-4o em vários benchmarks multimodal e superou-o em DocVQA (94.5 vs 88.4).

### Qwen2,5-VL (Fevereiro 2025)  FPS dinâmico + tempo absoluto

O grande passo da Qwen2.5VL foi o vídeo.

- O eixo temporal do M-RoPE segue marcas de tempo reais, de modo que a diferença entre os dois quadros identifica os segundos entre eles. "A 0:04, o gato salta". Nenhum token de texto extra carrega o tempo, então a codificação não adiciona nenhum comprimento de sequência.
- FPS dinâmico. Amostra a 1 FPS para imagens lentas, 4+ FPS para a ação. O usuário ou treinador escolhe; M-RoPE se adapta.
- Atenção ao espaço é ventralhada (local dentro dos blocos) para a transmissão; atenção global a cada poucas camadas.
- Formato de saída JSON explícito. Treinado em dados de chamada de ferramenta: "{\" ferramenta\": \"clique\", \"coordes\": [380, 220]}". Agente pronto para fora da caixa.
- MRoPE-v2 escala. Escala posições com o tamanho máximo de entrada para que um vídeo de 10 minutos não se esgotar na faixa de frequência.

Benchmarks: Qwen2.5-VL-72B supera o GPT-4o na maioria dos benchmarks de vídeo, combina com o Gemini 2.0 nos documentos e define o SOTA de modelo aberto para o grounding da GUI (ScreenSpot: 84% de precisão vs 38% para o GPT-4o).

### Qwen3-VL (novembro 2025)

Qwen3-VL é uma atualização incremental que consolida em vez de reinventar: maior espinha dorsal do LLM (Qwen3-72B), dados de treinamento expandidos, melhorado OCR, raciocínio mais forte através do "modo de pensamento" Qwen3.

A linha de linhagem: até 2025, a arquitetura Qwen-VL tinha se estabilizado.

### M-RoPE matematicamente

O RoPE clássico gira uma consulta `q`de dimensão `d`por posição `m`utilizando coordenadas emparelhadas:

```math
\begin{aligned}
q_{\text{rot}}[2i] &= q[2i] \cos(m \theta_i) - q[2i+1] \sin(m \theta_i) \\
q_{\text{rot}}[2i+1] &= q[2i] \sin(m \theta_i) + q[2i+1] \cos(m \theta_i) \\
\theta_i &= 10000^{-2i/d}
\end{aligned}
```

O M-RoPE divide o escuro escondido em três bandas.`d = 96`. Assinar 32 dims para temporário, 32 para altura, 32 para largura. Cada faixa gira por sua própria posição de eixo. Um parche em (t=5, h=10, w=20) obtém rotações `R_t(5)`- Não .`R_h(10)`- Não .`R_w(20)`Aplicada às suas três bandas.

Uso de tokens de texto `t = text_index, h = 0, w = 0`(ou uma escolha normalizada), mantendo a compatibilidade.`t = frame_time, h = row, w = col`. Uso de imagens únicas `t = 0`- Não .

A vantagem: uma codificação de posição lida com texto, imagem e vídeo sem código ramificado ou tabelas de posição diferentes.

### Lógicas de amostragem de FPS dinâmico

Dado um vídeo de duração `T`segundos e um orçamento de tokens-alvo `B`- Não .

1. Calcule o máximo de FPS que pode pagar: `fps_max = B / (T * tokens_per_frame)`- Não .
2. Escolha um FPS alvo de `{1, 2, 4, 8}`que satisfaz .`fps <= fps_max`- Não .
3. Se o movimento for alto (heurística de fluxo óptico ou pedido explícito do usuário), escolha FPS mais alto.
4. Escolha uniformemente no FPS escolhido; ajuste a identificação temporal M-RoPE de cada quadro a partir de sua marca de tempo em segundos.

Qwen2.5-VL treina essa lógica implicitamente; na inferência o utilizador controla através de `fps`Parâmetro: Uma sequência de ação de 60 segundos em 4 FPS com 81 tokens por quadro = 19440 tokens, gerenciável em um contexto de 32k.

### Output de agente estruturado

O treinamento de agentes da Qwen2.5VL visa explícitamente as chamadas de ferramentas estruturadas:

```
{
  "tool": "mouse_click",
  "coords": [1024, 512],
  "button": "left",
  "modifier": null
}
```

O parsing é determinista: JSON.parse sobre a saída do modelo. Comparar com o "clique em (1024, 512) " em forma livre, que exigia regex e manipulação de ambigüidade. A mudança é por que as pontuações ScreenSpot do Qwen2.5-VL saltaram de 55% para 84%.

```figure
mm-mrope-axes
```

## Usá-lo

`code/main.py`Implementos:

- M-RoPE computação de posição para uma sequência de mistura de texto, parches de imagem e quadros de vídeo.
- Prêmio de melhor desempenho de um sistema de gestão de dados
- Um parseador de saída JSON Qwen2.5-VL que lida com as respostas de chamadas de ferramenta com campos de coordenadas.

Exerça, e depois sinta a diferença quando trocar FPS fixo por FPS dinâmico em um vídeo de 5 minutos.

## Envia-o

Esta lição produz`outputs/skill-qwen-vl-pipeline-designer.md`. Dada uma tarefa de vídeo (monitorização, agente, reconhecimento de ação, acessibilidade), emite a configuração Qwen2.5VL (orçamento de quadro, estratégia FPS, bandeira de atenção à janela, modo de saída de agente) e uma estimativa de latência.

## Exercícios

1. Calcule as rotações M-RoPE para um parche em (t=3, h=5, w=7) com 48 escondidos (16 por banda, base theta 10000). Mostre os ângulos de rotação para os três primeiros pares em cada banda.

2. Uma câmera de segurança de 10 minutos em 1 FPS produz quantos quadros? Em 384 resolução com pool 3x, quantos tokens totais?

3. Escolha FPS para um rally de tênis de 30 segundos versus uma demonstração de receita de 30 segundos versus uma gravação de agente de interface de 30 segundos.

4. Qwen2.5VL deixa cair o Q-Former inteiramente. Por que um simples MLP funciona em 2025 mas não em 2023?

5. Parse três Qwen2.5-VL JSON ferramenta-chamadas de saída em Python dicts. O que falha para JSON malformado e que estratégia de recuperação recomendamos Qwen cookbook?

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| M-RoPE | "Multimodal RoPE" | 3D rotary position embedding with temporal, height, and width bands in the hidden dim |
| Dynamic FPS | "Smart sampling" | Frame sampling rate chosen per video based on motion, duration, and token budget |
| Absolute time encoding | "Time-aligned M-RoPE" | Temporal position IDs set from each frame's timestamp, so the model sees actual seconds, not frame index, with no extra tokens |
| Window attention | "Local attention" | Spatial self-attention restricted to small windows for speed; global attention added periodically |
| Structured agent output | "JSON mode" | Training data supervision teaching the VLM to emit parseable JSON with coords and tool names |
| min_pixels / max_pixels | "Resolution bounds" | Per-request Qwen2.5-VL controls bounding total pixel count and therefore token count |
| Grounding | "Point-at-it" | Outputting bounding-box coordinates as text tokens; used since Qwen-VL v1 |

## Mais leitura

- [Bai et al. — Qwen-VL (arXiv:2308.12966)](https://arxiv.org/abs/2308.12966)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
- [Qwen Team — Qwen2.5-VL Technical Report (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
- [Qwen Team — Qwen3-VL (arXiv:2511.21631)](https://arxiv.org/abs/2511.21631)
- [Zhu et al. — InternVL3 (arXiv:2504.10479)](https://arxiv.org/abs/2504.10479)
