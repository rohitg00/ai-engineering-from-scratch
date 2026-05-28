# EAGLE-3 Speculative Decoding em Produção

> Speculative decoding combina um draft model rápido com o modelo alvo. O draft propõe K tokens; o alvo verifica em um único forward; tokens aceitos são grátis. Em 2026, o EAGLE-3 é a variante production-grade — ele treina um draft head nos hidden states do modelo alvo em vez de em tokens brutos, empurrando a taxa de aceitação alpha para a faixa de 0.6-0.8 em chat geral. A pergunta certa não é "quão rápido é o draft" mas "qual é o alpha no meu tráfego?" Se alpha cai abaixo de ~0.55, speculative decoding é líquido negativo em alta concorrência porque cada draft rejeitado custa um segundo forward pass do alvo. Esta aula te ensina a medir alpha primeiro e ligar a flag em segundo lugar.

**Tipo:** Aprendizado
**Linguagens:** Python (stdlib, simulador de taxa de aceitação toy)
**Pré-requisitos:** Fase 17 · 04 (Internals de Serving vLLM), Fase 10 · 18 (Multi-Token Prediction)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Nomear as três gerações de speculative decoding e explicar o que o EAGLE-3 muda em relação ao EAGLE-2 e a um draft model clássico.
- Definir a taxa de aceitação alpha, calcular o speedup esperado a partir de alpha e K (comprimento do draft) e identificar o alpha de break-even para sua concorrência-alvo.
- Explicar por que speculative decoding é opt-in (não padrão) no vLLM 2026 e por que ligar sem medir alpha é um anti-pattern de produção.
- Escrever um plano de medição: qual benchmark, qual distribuição de prompts, qual ponto de concorrência, qual métrica para gate.

## O Problema

Decode é limitado por memória. Em uma H100 rodando Llama 3.3 70B FP8, cada token decodificado lê ~140 GB/s de pesos e emite um token. O compute da GPU fica quase ocioso durante decode — o gargalo é largura de banda do HBM, não throughput de matmul.

Speculative decoding explora essa lacuna. Gere K tokens candidatos com um draft model barato, depois peça ao modelo alvo para verificar todos os K em um único forward pass. Cada token verificado é efetivamente grátis (amortizado em um forward de batch-de-K que o alvo teria que fazer de qualquer jeito).

A abordagem clássica de draft model usa um modelo menor da mesma família (Llama 3.2 1B fazendo draft para Llama 3.3 70B). Funciona mas a taxa de aceitação é medíocre — a distribuição do modelo menor diverge do alvo. EAGLE, depois EAGLE-2, depois EAGLE-3 treinam um draft head leve diretamente nos estados internos do modelo alvo, então a distribuição do draft acompanha o alvo muito mais de perto. É por isso que alpha vai de 0.4 com draft model para 0.6-0.8 com EAGLE-3.

O detalhe: EAGLE-3 é opt-in no vLLM 2026. `speculative_config` precisa ser setado explicitamente. Sem flag, sem aceleração. Equipes que ligam sem medir alpha no tráfego real muitas vezes veem a latência de cauda piorar, não melhorar.

## O Conceito

### O que speculative decoding realmente compra

Sem spec decode, o custo por-token é um forward do alvo. Com spec decode a comprimento de draft K e aceitação alpha, tokens esperados por forward do alvo é `1 + K * alpha`. O speedup é `(1 + K * alpha) / (1 + epsilon)` onde epsilon é o overhead de draft-mais-verificação. Para K=5, alpha=0.7: `(1 + 5*0.7) / (1 + 0.1) = 4.5 / 1.1 = 4.1x`. Números reais ficam em torno de 2-3x porque alpha raramente é tão alto em tráfego de produção e epsilon cresce em batch size alto.

### Por que alpha é a única métrica que importa

Tokens rejeitados não desaparecem — eles forçam um segundo forward do alvo para o primeiro token rejeitado. Em um workload onde alpha cai para 0.4, você paga o overhead do draft mais a verificação mais o reroll. Em alta concorrência (digamos 256 concorrentes), o batch de decode já é grande o suficiente para que a lacuna de largura de banda de memória entre "alvo sozinho" e "alvo com verificação" diminua. Abaixo de alpha 0.55 na maioria dos hardware de 2026, spec decode é líquido negativo.

Alpha varia por workload. Em chat geral estilo ShareGPT, EAGLE-3 treinado em ShareGPT atinge 0.6-0.8. Em tráfego de domínio específico (código, médico, jurídico) o draft head treinado em dados gerais cai para 0.4-0.6. Treinar um draft head de domínio específico recupera alpha — é um trabalho de treinamento leve e rápido comparado a fine-tuning do alvo.

### Gerações do EAGLE num olhar

- **Draft model clássico**: modelo menor da mesma família. Alpha 0.3-0.5. Infraestrutura simples — dois modelos carregados, draft roda K forwards por forward do alvo.
- **EAGLE-1 (2024)**: draft head único treinado nos hidden states do alvo (última camada). Alpha ~0.5-0.6. Overhead pequeno de parâmetros sobre o alvo.
- **EAGLE-2 (2025)**: comprimento de draft adaptativo e drafts baseados em árvore (verificar múltiplos ramos em um passo do alvo). Alpha ~0.6-0.7. Scheduler de draft mais complexo.
- **EAGLE-3 (2025-2026)**: draft head treinado em múltiplas camadas do alvo (não só a última), melhor alinhamento. Alpha ~0.6-0.8 em chat geral.

### A receita de produção para 2026

1. Implante o modelo alvo sem nada. Meça TTFT, ITL e throughput baseline na concorrência-alvo.
2. Ative EAGLE-3 draft via `speculative_config` do vLLM. Re-execute o benchmark.
3. Registre a taxa de aceitação alpha. O V1 do vLLM reporta isso como `spec_decode_metrics.accepted_tokens_per_request`. Divida pelo comprimento de draft solicitado para obter alpha.
4. Se alpha < 0.55 na distribuição de tráfego de produção, desative spec decode ou treine um draft EAGLE-3 de domínio específico.
5. Na concorrência de produção, re-execute. Confirme que P99 ITL não piorou.

### O obstáculo de produção: cauda P99

ITL médio cai com spec decode. P99 pode piorar se você não ajustar. Drafts rejeitados disparam uma sequência de dois passos (draft + falha de verificação + reroll). Em batch cheio, esses dois passos se serializam. Observe P99 ITL, não P50.

### Onde EAGLE-3 já está implantado

Google implantou speculative decoding no AI Overviews em 2025 (mesma qualidade, resposta mais rápida). V1 do vLLM entrega `speculative_config` como interface documentada; N-gram GPU speculative decoding no V1 é a variante compatível com chunked prefill. SGLang suporta EAGLE-3 como caminho de draft recomendado para workloads com prefixo pesado.

### Matemática de break-even em uma linha

Speedup esperado: `S(alpha, K) = (1 + K*alpha) / (1 + verify_overhead)`. Igualando `S = 1` resolve para alpha: `alpha_breakeven = verify_overhead / K`. Para verify_overhead típico ~0.15 e K=5: `alpha_breakeven = 0.03`. Mas essa é a matemática bruta de decode. Em alta concorrência o overhead de verificação sobe e o batch de decode já amortiza leituras de memória entre sequências, então o alpha_breakeven efetivo sobe para ~0.45-0.55 na prática.

### Quando não usar speculative decoding

- Geração batch-1 offline onde latência não importa. Use o alvo puro.
- Saídas muito curtas (abaixo de 50 tokens). Overhead do draft e custo de verificação dominam.
- Domínios especializados sem um draft head treinado nesse domínio. Alpha muito baixo.
- vLLM v0.18.0 mais draft-model spec decode mais `--enable-chunked-prefill`. Essa combinação não compila. A exceção documentada é N-gram GPU spec decode no V1.

## Use

`code/main.py` simula um loop de decode com e sem speculative decoding em uma faixa de valores de alpha e comprimentos de draft K. Imprime o alpha de break-even, o speedup medido e o comportamento de cauda. Execute em várias combinações (alpha, K) para ver exatamente onde speculative decoding para de valer a pena.

## Entregue

Esta aula produz `outputs/skill-eagle3-rollout.md`. Dado um modelo alvo, descrição da distribuição de tráfego e concorrência-alvo, produz um plano de rollout escalonado de EAGLE-3 — benchmark baseline, ativar config, medir alpha, gate em alpha >= 0.55, observar P99 ITL.

## Exercícios

1. Execute `code/main.py`. A K=5, qual alpha você precisa para um speedup de 2x? Para 3x? Quão sensível é isso a verify_overhead?
2. Imagine que o tráfego de produção se divide 70% chat geral, 30% código. Chat geral atinge alpha 0.7 com EAGLE-3 treinado em ShareGPT; código atinge alpha 0.4. Qual é o alpha misto e spec decode é líquido-positivo?
3. Leia a documentação de `speculative_config` do vLLM. Nomeie os três modos (draft model, EAGLE, N-gram) e qual é compatível com chunked prefill.
4. Você vê o ITL médio cair 25% depois de ativar EAGLE-3 mas o P99 ITL subiu 15%. Diagnosticar e propor uma mitigação.
5. Calcule o custo de memória do draft head do EAGLE-3 para o Llama 3.3 70B. Como se compara a rodar Llama 3.2 1B como um draft clássico?

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Speculative decoding | "draft mais verificação" | Propor K tokens com um modelo barato, verificar todos os K em um forward do alvo |
| Taxa de aceitação alpha | "taxa de aceitação spec" | Fração de tokens do draft aceitos pelo alvo; a única métrica que importa |
| Comprimento de draft K | "spec k" | Quantos tokens o draft propõe por forward do alvo; típico 4-8 |
| Overhead de verificação epsilon | "overhead spec" | Custo extra de verificar-e-reroll vs um forward puro do alvo; cresce com batch |
| EAGLE-3 | "EAGLE mais novo" | Variante 2025-2026; treina draft head em múltiplas camadas do alvo; alpha 0.6-0.8 em chat geral |
| `speculative_config` | "config spec do vLLM" | O opt-in explícito no V1 do vLLM; sem padrão significa sem aceleração |
| N-gram spec decode | "draft N-gram" | Draft no lado da GPU usando lookups N-gram no prompt; compatível com chunked prefill |
| Alpha de break-even | "alpha no-op" | Alpha onde spec decode dá zero speedup; observe na concorrência de produção |
| Draft rejeitado two-pass | "custo de reroll" | Dois forwards do alvo quando drafts rejeitam; impulsiona a cauda P99 |

## Leitura Complementar

- [vLLM — Speculative Decoding docs](https://docs.vllm.ai/en/latest/features/spec_decode/) — fonte autoritativa sobre `speculative_config` e compatibilidade com chunked prefill no V1.
- [vLLM Speculative Config API](https://docs.vllm.ai/en/latest/api/vllm/config/speculative/) — o conjunto exato de campos.
- [EAGLE paper (arXiv:2401.15077)](https://arxiv.org/abs/2401.15077) — formulação original do EAGLE draft-head.
- [EAGLE-2 paper (arXiv:2406.16858)](https://arxiv.org/abs/2406.16858) — drafts adaptativos e árvores.
- [UC Berkeley EECS-2025-224](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2025/EECS-2025-224.html) — sistema LLM eficiente com speculative decoding.
- [BentoML — Speculative Decoding](https://bentoml.com/llm/inference-optimization/speculative-decoding) — checklist de rollout em produção.
