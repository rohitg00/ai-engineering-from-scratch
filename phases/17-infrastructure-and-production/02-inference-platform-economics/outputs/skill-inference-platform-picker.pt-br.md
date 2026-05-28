---
name: inference-platform-picker
description: Escolha uma plataforma de inferência (Fireworks, Together, Baseten, Modal, Replicate, Anyscale ou silício personalizado) de acordo com a carga de trabalho, SLA, orçamento e restrições operacionais. Normalize os preços por token, por minuto e por previsão.
version: 1.0.0
phase: 17
lesson: 02
tags: [inference, fireworks, together, baseten, modal, replicate, anyscale, economics]
---

Dado um perfil de carga de trabalho (modelo, tokens/dia, utilização sustentada, SLA TTFT, fator de intermitência, conformidade, Python vs pilha mista), produza uma recomendação de plataforma.

Produzir:

1. Plataforma primária. Nomeie a plataforma e o nível de preços específico (sem servidor vs dedicado vs lote). Justifique com as características da carga de trabalho correspondentes — por exemplo, "Fireworks sem servidor porque TTFT < 500 ms é o SLA e o tráfego está em rajadas".
2. Custo efetivo. Normalize o modelo de precificação escolhido para tokens de saída de $/M. Compare com pelo menos duas alternativas. Avise quando o valor por minuto for superior ao token (acima de aproximadamente 30% de utilização sustentada) ou vice-versa.
3. Plano de partida a frio. Para seleções sem servidor (Fireworks, Modal, Replicate), indique a latência de inicialização a frio esperada e uma mitigação (pré-aquecimento, min_workers=1, migração em tempo real). Para escolhas dedicadas (Baseten, Anyscale), pule esta seção, mas observe a compensação.
4. Vice-campeão. Cite a segunda plataforma e a condição explícita sob a qual você mudaria (por exemplo, "mudar para Baseten se fecharmos um acordo empresarial que exija HIPAA + GPUs dedicadas").
5. Camada de gateway. Recomende se você deve frontar a plataforma com um gateway de IA (LiteLLM, Portkey, Kong AI Gateway) para isolar o produto da rotatividade do fornecedor. Padrão: sim, a menos que a escala esteja abaixo de 500 RPS.

Rejeições difíceis:
- Comparando por token com por minuto sem normalizar. Recuse e insista em tokens eficazes de $/M.
- Escolher o Fireworks porque é "mais rápido" sem validar o SLA do TTFT em relação aos benchmarks publicados.
- Recomendação de silício customizado (Groq, Cerebras, SambaNova) para qualquer carga de trabalho sem latência. Eles têm um preço premium e só se justificam em SLAs interativos.

Regras de recusa:
- Se a carga de trabalho exigir uma estrutura regulamentada (SOC 2 Tipo II, HIPAA) e o cliente escolher Modal ou Replicate, recuse — nenhum deles tem a mesma presença empresarial que Baseten ou Anyscale. Sugira Baseten.
- Se o tráfego esperado for inferior a 100 mil tokens/dia, recuse recomendar por minuto (Baseten, Modal, Anyscale). A economia não funciona – o padrão é um mercado (OpenRouter, DeepInfra) ou um hiperescala gerenciado.
- Se o cliente quiser “o mais barato”, recuse – nomeie a função de custo multidimensional (taxa de token + partida a frio + atribuição + gateway + DX).

Resultado: uma recomendação de uma página nomeando plataforma primária, custo efetivo, plano de inicialização a frio, vice-campeão, postura de gateway. Termine com a única métrica que revelará uma escolha errada (inicialização a frio P99, taxa por token ou desvio de utilização).