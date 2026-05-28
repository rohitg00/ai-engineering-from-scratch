---
name: eagle3-rollout
description: Produce a staged EAGLE-3 speculative-decoding rollout plan that measures acceptance rate alpha on real traffic before shipping.
version: 1.0.0
phase: 17
lesson: 05
tags: [speculative-decoding, eagle-3, vllm, alpha, production-rollout]
---
---
name: eagle3-rollout
description: Produce a staged EAGLE-3 speculative-decoding rollout plan that measures acceptance rate alpha on real traffic before shipping.
version: 1.0.0
phase: 17
lesson: 05
tags: [speculative-decoding, eagle-3, vllm, alpha, production-rollout]
---

Dado um modelo de destino, hardware (tipo e contagem de GPU), descrição de tráfego (bate-papo geral/código/especializado), meta de simultaneidade e métricas de linha de base atuais (TTFT, ITL, taxa de transferência), produza um plano de implementação EAGLE-3 em etapas.

Produzir:

1. Plano de medição de linha de base. Qual benchmark (LLMPerf, GenAI-Perf ou sombra de produção), qual distribuição imediata, qual ponto de simultaneidade, quais métricas registrar (média TTFT/P99, média ITL/P99, taxa de transferência, simultaneidade).
2. Seleção do rascunho. EAGLE-3 treinado em ShareGPT para bate-papo geral. EAGLE-3 treinado em domínio para tráfego especializado (código, médico, jurídico) ou a decisão de treinar um antes do envio.
3. Configuração. Campos exatos do vLLM `speculative_config` (método, modelo, num_speculative_tokens). Observe a compatibilidade v0.18.0: a especulação do modelo preliminar não pode ser combinada com `--enable-chunked-prefill`; A decodificação de especificação de GPU N-gram em V1 é a exceção.
4. Portão alfa. Alvo alfa >= 0,55 na simultaneidade de produção. Procedimento de medição: tráfego shadow por 24 horas, registrar vLLM `spec_decode_metrics`, dividir os tokens aceitos pelo comprimento do rascunho solicitado. Interruptor de interrupção se o alfa cair abaixo de 0,45 em qualquer janela de 1 hora.
5. Relógio de cauda. Gráfico P99 ITL delta (especificação ativada - especificação desativada). Se delta for positivo, o padrão de duas passagens de tiragem rejeitada é cortante. Reduza K ou desative esta carga de trabalho.
6. Verificação do ponto de equilíbrio. Na simultaneidade relatada, calcule o ponto de equilíbrio alfa para a sobrecarga de verificação atual. Enviar somente se o alfa medido atingir o ponto de equilíbrio em pelo menos 0,1.

Rejeições difíceis:
- Envio sem medição de alfa no tráfego de produção. Recuse e exija uma medição de sombra de 24 horas.
- Reivindicar aceleração de 2 a 3x sem nomear o alfa medido.
- Habilitar a decodificação especulativa para trabalhos em lote off-line onde a latência não é a restrição.
- Combinação de especulação de modelo de rascunho com pré-preenchimento fragmentado no vLLM v0.18.0. Incompatibilidade difícil.

Regras de recusa:
- Se o tráfego for principalmente saídas muito curtas (menos de 50 tokens), recuse. A sobrecarga de calado domina; enviar alvo simples.
- Se o hardware for consumidor (RTX 4090/5090) e o tamanho do lote permanecer abaixo de 8, recomende a meta simples – a amortização do lote de sobrecarga de verificação precisa de simultaneidade que o hardware não pode fornecer.
- Se o usuário desejar o ajuste automático de K sem um circuito de medição, recuse. K é escolhido entre alfa medido e sobrecarga de verificação; nenhum ajuste automático substitui a medição.

Resultado: um plano de implementação gradual de uma página listando linha de base → configuração → porta alfa → observação de cauda → confirmação do ponto de equilíbrio. Termine com um parágrafo "o que medir a seguir" nomeando o treinamento EAGLE-3 específico do domínio, K inferior ou reversão para a meta simples, dependendo do diagnóstico.