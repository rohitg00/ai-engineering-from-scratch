# AEGLE-3 Descodagem especulativa na produção

> A descodificação especulativa combina um modelo de projeto rápido com o modelo alvo. O projecto propõe tokens K; o alvo verifica-se em um único prazo; tokens aceitos são gratuitos. Em 2026, o EAGLE-3 é a variante de nível de produção  ele treina um projeto de cabeça nos estados ocultos do modelo alvo em vez de em tokens brutos, empurrando a taxa de aceitação alfa para a faixa de 0,6-0,8 no bate-papo geral. A pergunta certa não é "quão rápido é o projeto", mas "o que é o alfa no meu tráfego?" Se o alfa cair abaixo de ~0.55, a descodificação especulativa é negativa líquida em alta concurência porque cada projeto rejeitado custa uma segunda passagem de destino para a frente. Esta lição ensina-te a medir o alfa primeiro e a virar a bandeira em segundo lugar.

**Type:** Learn
**Languages:** Python (stdlib, toy acceptance-rate simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 10 · 18 (Multi-Token Prediction)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Nomear as três gerações de decodificação especulativa e explicar o que a EAGLE-3 muda da EAGLE-2 e de um modelo clássico de projeto.
- Defina a taxa de aceitação alfa, calcule a velocidade esperada a partir do alfa e K (longo de rascunho) e identifique o alfa de equilíbrio para a sua simultaneidade alvo.
- Explique por que a descodificação especulativa é opt-in (não padrão) no vLLM 2026 e por que ativá-la sem medir o alfa é um padrão anti-produção.
- Escrever um plano de medição: qual referência, qual distribuição de prompt, qual ponto de concurência, qual métrica para entrar.

## O problema

O decodificador é ligado à memória. Em um H100 executando Llama 3.3 70B FP8, cada passo de decodificação lê todos os ~ 70 GB de pesos do HBM e emite um token por sequência. O computador da GPU é quase ocioso durante o decodificação.

A descodificação especulativa explora a lacuna. Gerencie tokens candidatos K com um modelo de projeto barato, em seguida, peça ao modelo alvo para verificar todos os K em uma única passagem para a frente. Cada token verificado é efetivamente livre (amortizado em um lote de K para a frente o alvo teria que fazer de qualquer maneira).

A abordagem clássica de modelo de projecto utiliza um modelo menor da mesma família (Llama 3.2 1B de elaboração para Llama 3.3 70B). Funciona, mas a taxa de aceitação é mediocre  a distribuição do modelo menor diverge do objetivo. A EAGLE, depois a EAGLE-2, depois a EAGLE-3 treinam uma cabeça de projeto leve diretamente nos estados internos do modelo alvo, de modo que a distribuição do projeto acompanha o alvo muito mais de perto. É por isso que o alfa passa de 0,4 com o modelo de projeto para 0,6-0,8 com o EAGLE-3.

A captura: A EAGLE-3 está a optar por participar no VLLM 2026. `speculative_config`As equipes que o desactivam sem medir o tráfego real, muitas vezes vêem a latência da cauda piorar, não melhorar.

## O conceito

### O que a descodificação especulativa realmente compra

Sem descodificação de especificações, o custo por token é um objetivo avançado. Com o descodificação de especificações no comprimento do projeto K e alfa de aceitação, os tokens esperados por token avançado é `1 + K * alpha`O acelerador é`(1 + K * alpha) / (1 + epsilon)`onde epsilon é o custo de verificação de cheque. para K=5, alfa=0,7: `(1 + 5*0.7) / (1 + 0.1) = 4.5 / 1.1 = 4.1x`Os números do mundo real agrupam-se em torno de 2-3 vezes porque o alfa raramente é tão alto no tráfego de produção e o epsilon cresce em grandes parcelas.

### Porque é que o alfa é a única métrica que importa

Os tokens rejeitados não desaparecem  eles forçam um segundo alvo para a primeira token rejeitada. Em uma carga de trabalho onde o alfa cai para 0,4, pagas despesas gerais de projeto mais verificação mais re-roll. Em alta simultânea (digamos 256 simultâneos), o lote de decodificação já é grande o suficiente para que a diferença de largura de banda de memória entre "alvo sozinho" e "alvo com verificação" diminua. Abaixo do alfa 0,55 na maioria dos hardware de 2026, o código de especificações é negativo.

O Alpha varia de acordo com a carga de trabalho. No chat geral de estilo ShareGPT, a EAGLE-3 treinada no ShareGPT atinge 0,6-0,8. No que diz respeito ao tráfego específico de domínio (código, médico, legal), o projeto de direcção formado em dados gerais cai para 0,4-0,6. Treinar um projeto específico de domínio cabeçalhos recupera alfa  é um trabalho de treinamento leve e rápido em comparação com o objetivo de finalização. As fases 7 · 16 e 10 · 15 apresentam valores mais elevados (0,85 e superior). São taxas por token em parâmetros de chat que correspondem aos dados de treinamento do projecto. Planeje com as bandas desta página e mede o alpha pelo seu próprio tráfego.

### GERAÇÕES de águia num olhar

- **Classic draft model**A infraestrutura é simples  dois modelos carregados, o projecto corre K para frente por alvo para frente.
- **EAGLE-1 (2024)**A cabeça de projeto única treinada em estados ocultos do alvo (última camada).
- **EAGLE-2 (2025)**A programação de projetos é mais complexa.
- **EAGLE-3 (2025-2026)**A formação de um chefe de projeto em várias camadas-alvo (não apenas a última), melhor alinhamento.

### A receita de produção para 2026

1. Modelo de nave alvo simples. Messa TTFT de linha de base, ITL, rendimento na simultânea meta.
2. Ativar o projecto EAGLE-3 através do vLLM `speculative_config`Reexamine o índice de referência.
3. Taxa de aceitação de registos alfa. vLLM V1 informa isto como `spec_decode_metrics.accepted_tokens_per_request`Divida pelo comprimento do esboço solicitado para obter o alfa.
4. Se o alfa < 0,55 na distribuição do tráfego de produção, desativar a descodificação das especificações ou criar um rascunho EAGLE-3 específico para o domínio.
5. Confirme que o P99 não piorou.

### O problema da produção: cauda P99

O P99 pode piorar se você não sintonizar. Os projetos rejeitados desencadeiam uma sequência de duas passagens (draft + verifique-fail + re-rolo).

### Se o EAGLE-3 já estiver implantado

O Google implementou a descodificação especulativa em AI Overviews em 2025 (a mesma qualidade, resposta mais rápida).`speculative_config`A SGLang suporta a EAGLE-3 como o caminho de projeto recomendado para cargas de trabalho pesadas de prefixos.

### - Matemática de equilíbrio numa linha.

A aceleração prevista: `S(alpha, K) = (1 + K*alpha) / (1 + verify_overhead)`- Configuração .`S = 1`soluções para alfa: `alpha_breakeven = verify_overhead / K`. Para verify_overhead típico ~0,15 e K=5: `alpha_breakeven = 0.03`Mas essa é a matemática de decodificação crua. Na alta simultânea a verificação aumenta e o lote de decodificação já amortiza as leituras de memória em todas as sequências, então a efetiva equilíbrio alfa_breakeven sobe para ~0.45-0.55 na prática.

### Quando não utilizar a descodificação especulativa

- Geração offline de lote 1, onde a latência não importa.
- Os resultados são muito curtos (menos de 50 tokens).
- Domínios especializados sem um chefe de recrutamento treinado.
- Assumindo que cada par de recursos compõe. Verifique a matriz de compatibilidade vLLM para a sua versão: v0.18.0 marca a descodificação especulativa compatível com preenchimento em pedaços.

```figure
mx-speculative-tree
```

## Usá-lo

`code/main.py`Simula um ciclo de decodificação com e sem decodificação especulativa em uma gama de valores alfa e comprimentos de esboço K. Imprime o break-even alfa, o speedup medido e o comportamento da cauda.

## Envia-o

Esta lição produz`outputs/skill-eagle3-rollout.md`. Tendo em conta um modelo-alvo, uma descrição da distribuição de tráfego e um alvo de simultâneo, produz um plano de implantação EAGLE-3 em fases  linha de referência, permite a configuração, a medida alfa, o gate em alfa >= 0,55, ver P99 ITL.

## Exercícios

1. Corra .`code/main.py`Em K=5, qual alfa você precisa para um 2x aceleração? para um 3x aceleração?
2. Imagine que o tráfego de produção divide 70% de chat geral, 30% de código. Chat geral atinge alfa 0,7 com EAGLE-3 treinado no ShareGPT; código atinge alfa 0,4. O que é alfa misturado e o código de especificação é net-positivo?
3. Leia o VLLM `speculative_config`A documentação. Nomear os três modos (modelo de rascunho, EAGLE, N-gram) e verificar quais são as características de cada um composto em sua versão vLLM.
4. Veja a baixa média do ITL de 25% depois de habilitar a EAGLE-3, mas o P99 ITL subiu 15%.
5. Calcule o custo de memória da cabeça de projeto EAGLE-3 para Llama 3.3 70B. Como se compara a executar Llama 3.2 1B como um projeto clássico?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Speculative decoding | "draft plus verify" | Propose K tokens with a cheap model, verify all K in one target forward |
| Acceptance rate alpha | "spec accept rate" | Fraction of draft tokens accepted by the target; the only metric that matters |
| Draft length K | "spec k" | How many tokens the draft proposes per target forward; typical 4-8 |
| Verify overhead epsilon | "spec overhead" | Extra cost to verify-and-reroll vs a plain target forward; grows with batch |
| EAGLE-3 | "latest EAGLE" | 2025-2026 variant; trains draft head on multiple target layers; alpha 0.6-0.8 on general chat |
| `speculative_config` | "vLLM spec config" | The explicit opt-in in vLLM V1; no default means no acceleration |
| N-gram spec decode | "N-gram draft" | GPU-side draft using N-gram lookups in the prompt; chunked-prefill-compatible |
| Break-even alpha | "no-op alpha" | Alpha at which spec decode gives zero speedup; watch this at production concurrency |
| Rejected-draft two-pass | "reroll cost" | Two target forwards when drafts reject; drives P99 tail |

## Mais leitura

- [vLLM — Speculative Decoding docs](https://docs.vllm.ai/en/latest/features/spec_decode/) fonte autorizada em `speculative_config`e compatibilidade de preenchimento em pedaços no V1.
- [vLLM Speculative Config API](https://docs.vllm.ai/en/latest/api/vllm/config/speculative/) o conjunto exato de campos.
- [EAGLE paper (arXiv:2401.15077)](https://arxiv.org/abs/2401.15077) formulação original da cabeçalha de projecto da EAGLE.
- [EAGLE-2 paper (arXiv:2406.16858)](https://arxiv.org/abs/2406.16858) Esboços e árvores adaptáveis.
- [UC Berkeley EECS-2025-224](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2025/EECS-2025-224.html) Sistema de Mestrado em Direito e Direito Executivo e decodificação especulativa.
- [BentoML — Speculative Decoding](https://bentoml.com/llm/inference-optimization/speculative-decoding) Lista de verificação da implantação da produção.
