# Jamba -- Hibrido SSM-Transformer

> Modelos de espaco de estado (SSMs) e transformers querem coisas diferentes. Transformers compram qualidade via attention a custo quadratico. SSMs compram inferencia em tempo linear e memoria constante via recorrencia mas perdem qualidade. Jamba da AI21 (marco de 2024) e Jamba 1.5 (agosto de 2024) colocam os dois no mesmo modelo: 1 camada Transformer pra cada 7 camadas Mamba, MoE em cada outro bloco e uma janela de contexto de 256k que cabe em uma GPU 80GB unica. Mamba-3 (ICLR 2026) aperta o lado do SSM com espacos de estado complexos e projecoes MIMO. Esta aula le ambas as arquiteturas de ponta a ponta e explica por que a receita hibrida sobreviveu tres anos de escalabilidade quando tentativas puras de SSM e puro Transformer de contexto longo nao sobreviveram.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, calculadora de mix de camadas)
**Pre-requisitos:** Fase 10 · 14 (arquiteturas de modelos abertos), Fase 10 · 17 (native sparse attention)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Explicar as tres primitivas de um bloco Jamba -- camadas Transformer, camadas Mamba, MoE -- e a receita de intercalacao 1:7:par.
- Enunciar como uma recorrencia de SSM parece em alto nivel e por que ela viabiliza inferencia de memoria constante.
- Calcular o footprint do KV cache de um modelo Jamba em contexto 256k e comparar com o que um modelo puro-Transformer precisaria.
- Nomear as tres inovacoes do Mamba-3 (discretizacao trapezoidal exponencial, atualizacao de estado complexa, MIMO) e o que cada uma foca.

## O Problema

Attention e quadratico no comprimento da sequencia. Modelos de espaco de estado sao lineares. Essa diferenca se acumula: em 256k tokens, um mapa de attention de Transformer e 65B entradas por head; o estado recorrente de um SSM e de tamanho fixo independente do comprimento da sequencia.

Modelos puramente SSM (Mamba, Mamba-2) combinam perplexidade de Transformer em escalas pequenas mas perdem em tarefas de rastreamento de estado e falham em categorias de recuperacao em contexto. A intuicao: SSMs comprimem historico em um estado fixo, e quando o historico e longo, informacao vaza. Attention lembra tudo exatamente mas paga custo quadratico.

A correcao obvia: use os dois. Coloque camadas Transformer onde recall exato importa. Use camadas SSM em outro lugar. Ajuste a razao. Jamba e o primeiro modelo de producao a enviar essa receita hibrida em escala (52B total, 12B ativos, 256k contexto, GPU 80GB unica). Jamba 1.5 estende a familia pra 398B total / 94B ativos. Mamba-3 (ICLR 2026) e o melhor baseline puramente SSM atual que hibridos podem ser reconstruidos ao redor.

Esta aula le os tres papers e produz o modelo mental pra "escolher a razao certa."

## O Conceito

### Um SSM em uma pagina

Um modelo de espaco de estado processa uma sequencia `x_1, ..., x_N` via um estado `h` de tamanho fixo:

```
h_t = A h_{t-1} + B x_t
y_t = C h_t
```

A cada passo o estado evolui via uma dinamica linear `A`, recebe a entrada `B x_t` e emite saida `C h_t`. `A, B, C` podem ser aprendidos. Note a propriedade critica: calcular `y_t` precisa apenas de `h_{t-1}` e `x_t`, nao de nenhum `x` anterior. Memoria e constante. Inferencia e O(1) por token.

O truque pra qualidade de modelagem e a estrutura de `A`. S4 (Gu 2021) usava uma matriz altamente estruturada que podia ser avaliada eficientemente como uma convolucao longa durante treinamento. Mamba (Gu, Dao 2023) substituiu os `A, B, C` fixos por dependentes dos dados (a parte "seletiva"). Mamba-2 (2024) simplificou mais a estrutura. Mamba-3 (2026) readiciona complexidade em lugares eespecificaçãoificos.

A propriedade chave: pra um LLM decoder, uma camada SSM e um substituto direto pra uma camada de attention, com estado de tamanho fixo por camada ao inves de um KV cache que cresce.

### O bloco Jamba

Um bloco Jamba alterna camadas de acordo com dois numeros:

- `l`: a razao attention-Mamba. Jamba usa `l = 8`, ou seja, 1 camada Transformer pra cada 7 camadas Mamba (7 Mamba + 1 Attention = 8 camadas por grupo).
- `e`: a frequencia de MoE. Jamba usa `e = 2`, ou seja, cada outra camada aplica MoE.

A sequencia de camadas dentro de um bloco:

```
M  M  M  M  M  M  M  A    (7 Mamba + 1 Attention)
|  M  |  M  |  M  |  M    (onde | marca MoE aplicado)
```

Cada bloco Jamba e 8 camadas. Em 4 blocos de profundidade (32 camadas no total), voce tem 28 Mamba e 4 Attention. 16 dessas usam MoE.

### Por que a razao 1:7

AI21 rodou abalacoes: que razao de attention-Mamba da melhor perplexidade-por-parametro E recall em contexto nas avaliacoes de contexto longo deles?

- Muita attention (1:1): qualidade sobe mas memoria e velocidade degradam.
- Pouca attention (1:15): memoria e otima mas recuperacao em contexto falha.
- Ponto ideal: 1:7 ou 1:8.

A intuicao: as camadas Transformer lidam com recall exato e rastreamento de estado. As camadas Mamba lidam com o bulk barato do processamento.

### Encoding posicional

Camadas Mamba sao elas mesmas consientes de posicao (via recorrencia). Camadas de attention nos hibridos originais baseados em Mamba nao usavam RoPE -- as camadas SSM forneciam a info de posicao. Jamba 1.5 adiciona RoPE as camadas de attention pra generalizacao em contexto longo, um refinamento posterior baseado em avaliacao empirica de contexto longo.

### O orcamento de memoria

Pra um formato Jamba-1 (32 camadas: 28 Mamba + 4 Attention, hidden 4096, 32 heads de attention):

- KV cache (so camadas de attention): `2 * 4 * 32 * 128 * 256k * 2 = 8.4 GB` em 256k BF16. So as 4 camadas de attention contribuem.
- Estado SSM: `28 * hidden * state_size` por prefixo de token, mas isso e de tamanho fixo por camada, nao escala com o comprimento da sequencia. Estado tipico Mamba de 16 por feature, hidden 4096: `28 * 4096 * 16 * 2 = 3.7 MB` total.

Compare com um Transformer puro de 32 camadas, mesmo hidden, MHA completo em 32 heads: `2 * 32 * 32 * 128 * 256k * 2 = 128 GB` em 256k BF16. Uma reducao de 8x no KV cache. Mesmo contra o baseline GQA(8) que a maioria dos modelos de 2024 usa (`2 * 32 * 8 * 128 * 256k * 2 = 32 GB`), o hibrido 1:7 de Jamba com 16 GB ainda e 2x menor.

E isso que AI21 quer dizer com "256k contexto em uma GPU 80GB unica." O KV cache de um Transformer puro de MHA completo nao caberia; ate um baseline GQA nao deixa espaco pra pesos e ativacoes; o de Jamba deixa.

### Mamba-3: o baseline puramente SSM em 2026

Mamba-3 (ICLR 2026, arXiv:2603.15569) introduz tres inovacoes no lado puramente SSM:

1. **Discretizacao trapezoidal exponencial.** Substitui a discretizacao pelo metodo de Euler no Mamba-2 por uma recorrencia mais expressiva. Operacao similar a convolucao aplicada no estado-entrada dentro da recorrencia central, ao inves de uma convolucao externa em `x_t`.

2. **Atualizacao de estado complexa.** Mambas anteriores reduziram a matriz de estado de complexa (S4) pra real diagonal (Mamba) pra identidade escalada (Mamba-2). Mamba-3 readiciona valores complexos -- equivalente a um embedding rotacional dependente dos dados no estado. Isso restaura capacidades de rastreamento de estado que simplificacoes reais anteriores custaram.

3. **Projecoes multi-entrada multi-saida (MIMO).** Ao inves de projecoes escalares por feature, usar projecoes matriciais. Melhora poder de modelagem e utilizacao de hardware na inferencia sem aumentar latencia de decode.

Em 1.5B de parametros, Mamba-3 melhora a acuracia downstream media em 0.6 pontos sobre Gated DeltaNet; a variante MIMO adiciona mais 1.2 pontos pra um total de 1.8 pontos de ganho. No mesmo tamanho de estado, Mamba-3 combina Mamba-2 com metade do estado.

Mamba-3 ainda nao esta sendo enviado em um hibrido de producao em escala -- mas e o candidato obvio pro lado SSM do proximo modelo classe Jamba.

### Quando usar um hibrido

Hibridos ganham quando:

- Contexto e longo o suficiente que o KV cache de Transformer puro vira doloroso (64k+).
- Tarefas misturam estrutura de curto alcance (bom pra SSM) com recall de longo alcance (precisa de Transformer).
- Voce quer implantação em orcamentos de memoria de GPU unica onde so o KV cache de Transformer nao caberia.

Hibridos perdem quando:

- Contexto e curto (abaixo de 16k). O overhead de SSM e desperdicado; Transformer puro e fine.
- Tarefas precisam de attention em todo-lugar-pra-todo-lugar (raciocinio profundo, referencia cruzada multi-documento). A esparsidade das camadas de attention no hibrido prejudica.
- Voce esta escalando pra modelos de fronteira de trilhoes de parametros. Transformer puro + MLA + MoE (estilo DeepSeek-V3) atualmente ganha a corrida de capacidade.

### O cenario competitivo

| Modelo | Familia | Escala | Alegacao unica |
|--------|---------|--------|---------------|
| Mamba-2 | puro SSM | 3B | tempo linear, memoria constante |
| Jamba | hibrido | 52B/12B | 256k em 80GB |
| Jamba 1.5 Large | hibrido | 398B/94B | contexto longo de nivel enterprise |
| Mamba-3 | puro SSM | 1.5B (paper) | rastreamento de estado restaurado |
| DeepSeek-V3 | Transformer puro + MoE | 671B/37B | capacidade de fronteira |

O cenario em 2026: Transformer puro MoE domina a fronteira, mas hibridos possuem o nicho de contexto 256k+. Os ganhos de rastreamento de estado do Mamba-3 podem empurrar razoes de hibrido pra baixo (mais SSM, menos attention) na proxima geracao.

## Usar

`code/main.py` e uma calculadora de memoria pra arquiteturas hibridas. Dada uma razao SSM-Transformer e uma config de hidden-size / contagem-de-camadas, calcula:

- KV cache no contexto alvo.
- Memoria de estado SSM.
- Memoria total no contexto N para uma variedade de formatos de modelo.

A calculadora suporta:

- Baseline de Transformer puro (KV cache cresce com N).
- Hibrido estilo Jamba 1:7.
- SSM puro (sem KV cache nenhum).

Os numeros sao direto dos papers Jamba-1 e Jamba-1.5 pra formatos publicados e extrapolados pra variantes hipotheticas.

Consideracoes de integracao pra implantação real:

- A maioria dos servidores de inferencia de producao (vLLM, SGLang) suporta Jamba e Mamba. Verifique a versao eespecificaçãoifica.
- Em contexto 256k, a vantagem de memoria do Jamba aparece no throughput de requests concorrentes. Na mesma VRAM voce caixa mais sequencias de Jamba que de Transformer.
- Mamba-3 como modelo standalone ainda nao esta sendo enviado em producao -- preview de pesquisa em 1.5B.

## Entregar

Esta aula produz `outputs/skill-hybrid-picker.md`. Dada uma eespecificaçãoificacao de carga de trabalho (perfil de contexto, mix de tarefas, orcamento de memoria), recomenda entre um Transformer puro, um hibrido estilo Jamba e um SSM puro, com raciocinio explicito sobre os tradeoffs de memoria e qualidade.

## Exercicios

1. Rode `code/main.py` pra calcular o KV cache em contexto 256k pra um Transformer puro de 32 camadas (hidden 4096, 32 heads) e pra um hibrido Jamba-1 do mesmo formato. Verifique a reducao de ~8x de memoria que o paper da AI21 alega.

2. Modifique a calculadora pra modelar um hibrido 1:3 (4 Mamba : 1 Attention) e um hibrido 1:15 (14 Mamba : 1 Attention). Plote KV cache vs razao. Em que razao o KV cache iguala a memoria de estado SSM?

3. Leia a Secao 3 do paper do Jamba (arXiv:2403.19887). Explique por que AI21 usa Mamba-1 ao inves de Mamba-2 apesar de Mamba-2 ser mais rapido. Dica: a secao de abalacao hibrida documenta isso.

4. Calcule o overhead de parametros do MoE em cada outra camada no Jamba 1.5 Large (398B total, 94B ativos). Compare a razao ativa com o DeepSeek-V3 (37B/671B) e explique por que a arquitetura do Jamba empurra a razao ativa pra cima.

5. Leia a Secao 3 do paper do Mamba-3 (arXiv:2603.15569). Explique em tres frases por que uma atualizacao de estado complexa equivale a um embedding rotacional dependente dos dados. Ligue a resposta a derivacao do RoPE da Aula 04 da Fase 7.

## Termos Principais

| Termo | O que a gente diz | O que realmente significa |
|-------|-------------------|--------------------------|
| Modelo de espaco de estado (SSM) | "Recorrencia com estado fixo" | Uma camada com recorrencia aprendida `h_t = A h_{t-1} + B x_t`; memoria constante por token |
| SSM seletivo | "O truque do Mamba" | Parametros A, B, C dependentes dos dados que dao ao modelo seletividade tipo gate em tempo linear |
| Razao attention-Mamba | "Quantas camadas de attention" | No Jamba, `l = 8` significa 1 camada de attention pra cada 7 Mamba |
| Bloco Jamba | "O grupo de 8 camadas" | Um attention + sete Mamba + MoE em posicoes alternadas |
| Estado SSM | "O buffer oculto" | Estado de tamanho fixo por camada que substitui o KV cache nas camadas Mamba |
| Contexto 256k | "O numero principal do Jamba" | O comprimento de sequencia que Jamba-1 cabe em uma GPU 80GB unica; Transformer puro nao consegue nesse tamanho |
| Mamba-3 | "SSM puro 2026" | A melhor arquitetura SSM atual com estado complexo + MIMO; o baseline que hibridos reconstruem ao redor |
| MIMO | "Multi-entrada multi-saida" | Inovacao do Mamba-3 usando projecoes matriciais ao inves de escalares por funcionalidade |
| Discretizacao trapezoidal exponencial | "A recorrencia do Mamba-3" | Recorrencia mais expressiva que subsume a discretizacao pelo metodo de Euler do Mamba-2 |
| Arquitetura hibrida | "Misturar attention e SSM" | Qualquer modelo que alterna camadas Transformer e SSM; Jamba e o arquetipo de producao |

## Leitura Complementar

- [Lieber et al. -- Jamba: A Hybrid Transformer-Mamba Language Model (arXiv:2403.19887)](https://arxiv.org/abs/2403.19887) -- o paper original do Jamba, abalacoes de razao, alegacao de contexto 256k
- [AI21 -- Jamba 1.5: Hybrid Transformer-Mamba at Scale (arXiv:2408.12570)](https://arxiv.org/abs/2408.12570) -- a familia escalada, releases publicos de 398B/94B e 12B/52B
- [Gu, Dao -- Mamba: Linear-Time Sequence Modeling with Selective State Spaces (arXiv:2312.00752)](https://arxiv.org/abs/2312.00752) -- o paper do SSM seletivo que Jamba se baseia
- [Dao, Gu -- Mamba-2 (arXiv:2405.21060)](https://arxiv.org/abs/2405.21060) -- o sucessor estruturado-estado-espaco simplificado
- [Lahoti et al. -- Mamba-3 (arXiv:2603.15569, ICLR 2026)](https://arxiv.org/abs/2603.15569) -- estado complexo, MIMO, a fronteira SSM pura 2026
- [Gu et al. -- Efficiently Modeling Long Sequences with Structured State Spaces (arXiv:2111.00396)](https://arxiv.org/abs/2111.00396) -- o paper S4, o ponto de partida da genealogia SSM pra LLMs
