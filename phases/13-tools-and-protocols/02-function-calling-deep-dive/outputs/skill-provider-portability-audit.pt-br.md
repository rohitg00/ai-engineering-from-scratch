---
name: provider-portability-audit
description: Audite uma integração de chamada de função em um provedor para ver o que quebra quando portado para os outros dois.
version: 1.0.0
phase: 13
lesson: 02
tags: [function-calling, openai, anthropic, gemini, portability]
---

Dada uma integração de chamada de função em um provedor (OpenAI, Anthropic ou Gemini), produza uma auditoria de portabilidade listando cada renomeação de campo, diferença de comportamento e colisão de limite rígido que aparece quando a mesma lógica é enviada nos outros dois provedores.

Produzir:

1. Declaração diferente. Para cada ferramenta na integração, mostre o envelope/renomeação de campo/tradução de esquema necessária para cada um dos outros dois provedores. Sinalize qualquer construção de esquema JSON que o provedor de destino não suporta (Gemini: subconjunto OpenAPI 3.0; OpenAI estrito: sem `$ref`, sem `oneOf` ambíguo).
2. Diferença de resposta. Documente onde a chamada da ferramenta reside no formato de resposta de cada provedor (bloco `tool_calls[]` vs `content[]` vs entrada `parts[]`) e quem é responsável pela análise de `arguments` (string no OpenAI, objeto no Anthropic e Gemini).
3. Diferença `tool_choice`. Mapeie a configuração de escolha atual da integração (automático/proibido/forçado/obrigatório) para o formato do provedor de destino; sinalizar modos ausentes.
4. Limite as colisões. Contagem de ferramentas de relatório (128/64/64), profundidade do esquema (5/10/efetivamente ilimitado) e limites de comprimento por argumento. Aumente a gravidade do bloco em qualquer integração que exceda os limites do provedor alvo.
5. Mapeamento de modo estrito. Indique se a semântica do modo estrito é preservada no destino. OpenAI `strict: true` não tem equivalente exato no Anthropic; Gemini `responseSchema` se aproxima, mas está no nível de solicitação.

Rejeições difíceis:
- Qualquer integração que assuma que `arguments` é uma string nos destinos não OpenAI. Produzirá silenciosamente resultados errados.
- Qualquer integração cuja contagem de ferramentas exceda 64 ao portar para Anthropic ou Gemini sem roteador.
- Qualquer integração que use `$ref` no esquema quando o destino for o modo estrito OpenAI.

Regras de recusa:
- Se for solicitado a portar uma integração que depende de um recurso específico do provedor sem analógico (por exemplo, mudanças de estado da API OpenAI Responses, blocos de uso de computador Antrópico), recuse e explique qual recurso não tem equivalente de destino.
- Se for solicitado a escolher um vencedor, recuse. A escolha depende das necessidades de modo estrito do host, do perfil de custo e dos requisitos de chamada paralela.

Resultado: uma auditoria de uma página com uma tabela de diferenças por ferramenta, uma tabela de limites e um "veredicto de porta" final por provedor de destino (navio/roteador de necessidades/bloqueado por recurso). Termine com uma frase nomeando a mudança de migração de maior alavancagem.