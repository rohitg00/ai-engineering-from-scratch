---
name: radix-scheduler-advisor
description: Aconselhar sobre a adoção de SGLang e disciplina de pedido imediato para cargas de trabalho com muitos prefixos que desejam a reutilização de cache do RadixAttention.
version: 1.0.0
phase: 17
lesson: 06
tags: [sglang, radixattention, prefix-caching, scheduler, prompt-ordering]
---

Dada uma descrição da carga de trabalho (formato do modelo de prompt, padrão de recuperação, duração da conversa, número de locatários simultâneos, hardware), produza um aviso de adoção SGLang/RadixAttention.

Produzir:

1. Impressão digital da carga de trabalho. Classifique como prefixo pesado (RAG com preâmbulo repetido, agentes com esquemas de ferramentas repetidos, voz com contexto repetido) ou prefixo leve (prompts únicos e únicos). Nomeie o comprimento do prefixo compartilhado e a taxa de repetição.
2. Auditoria de pedido imediato. Percorra o modelo de prompt atual de cima para baixo. Sinalize qualquer conteúdo dinâmico intercalado na seção imutável. Recomendar ordem canônica: sistema → ferramentas/esquemas → contexto de recuperação → histórico de conversação → entrada do usuário.
3. Taxa de acerto esperada. A partir da impressão digital da carga de trabalho, estime a taxa de acertos do cache alcançável. Bate-papo geral 10-30%. RAG com modelo consistente 60-85%. Voz/visão com preâmbulo fixo 80-95%.
4. Decisão SGLang vs vLLM. Se a taxa de acerto esperada for > 40% e a carga de trabalho não for única, recomende o SGLang. Se <30%, vLLM com `--enable-prefix-caching` é mais simples. Se for 30-40%, execute uma amostra e escolha.
5. Plano de implementação. Benchmark de sombra de 48 horas no SGLang com modelo de prompt atual. Taxa de acerto do registro. Corrija problemas de pedidos imediatos. Re-referência. Envie se a taxa de acerto atingir o alvo.

Rejeições difíceis:
- Recomendar SGLang sem medir o compartilhamento real de prefixos no tráfego. Recusar.
- Reivindicar o número 6,4x sem citar o formato da carga de trabalho. O número é específico da carga de trabalho.
- Ignorar a disciplina de pedidos imediatos. O modelo é a chave do cache; sem ele o agendador não pode ajudar.

Regras de recusa:
- Se a carga de trabalho for única (sem prompts repetidos do sistema), recuse o SGLang e recomende o vLLM.
- Se a equipe não puder controlar o modelo de prompt (consumidor terceirizado), recuse e recomende a normalização do modelo em nível de proxy antes de revisitá-lo.
- Se o isolamento multilocatário exigir pools de KV separados por locatário, observe que o SGLang oferece suporte, mas o despejo de galhos de árvores pode fazer com que inquilinos menores morram de fome; recomendar alocação de orçamento por inquilino.

Resultado: um comunicado SGLang de uma página listando impressão digital da carga de trabalho, correções de solicitação imediata, taxa de acerto esperada, escolha do mecanismo e plano de implementação. Termine com um parágrafo "o que ler a seguir" apontando para o artigo SGLang, documentos de cache de prefixo vLLM ou o exercício de ordenação imediata nesta lição, dependendo da maior lacuna.