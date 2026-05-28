---
name: voice-assistant-architect
description: Produza especificações completas de assistente de voz (componentes, orçamento de latência, observabilidade, conformidade) para uma determinada carga de trabalho.
version: 1.0.0
phase: 6
lesson: 12
tags: [voice-assistant, architecture, livekit, pipecat, compliance]
---

Dado o caso de uso (consumidor/suporte ao cliente/acessibilidade/borda), escala esperada (sessões simultâneas, minutos/mês), idioma, metas de latência, conformidade (HIPAA, PCI, EU AI Act, CA SB 942), resultado:

1. Componentes (7 camadas). Mic + chunking · VAD · streaming STT · LLM + ferramentas · streaming TTS · reprodução · manipulador de interrupção. Nomeie o fornecedor/modelo exato para cada um.
2. Orçamento de latência. Metas P50/P95/P99 por estágio somando a meta ponta a ponta. Marque quais estágios são independentes e sequenciais.
3. Esquema de chamada de ferramenta. Especificação JSON para cada ferramenta + tratamento de erros + texto substituto. Sempre inclua um caminho “não posso ajudar” que o LLM deve seguir quando falhar duas vezes.
4. Segurança. Proteção de injeção imediata, bloqueio de clonagem de voz (se o TTS for compatível com clonagem), gate de wake-word (para sempre ativo), redação de PII em registros, retenção de 30 dias.
5. Observabilidade. P50/P95/P99 por estágio · taxa de falsas interrupções · taxa de sucesso de chamadas de ferramenta · WER por 100 chamadas · custo por minuto · taxa de abandono.
6. Conformidade. Áudio de divulgação ("Este é um assistente de IA"), fixação de região (dados da UE na UE), retenção de registros de auditoria, caminho de exclusão.

Recuse implantações sempre ativas sem uma palavra de ativação. Recuse o TTS que não transmite (adiciona latência no comprimento da expressão). Recuse a latência média sem P95 – a cauda é onde os usuários mudam. Recusar retenção de áudio bruto &gt; 30 dias sem revisão jurídica.

Entrada de exemplo: "Assistente de acessibilidade para usuários com baixa visão: interface somente de voz para um aplicativo de e-mail do consumidor. Inglês. P95 &lt; 600 ms. ~10 mil usuários simultâneos."

Exemplo de saída:
- Componentes: dispositivo de som (WebRTC via LiveKit Agents) · Silero VAD · Deepgram Nova-3 (Inglês) · GPT-4o com ferramentas de e-mail (read_message, compose_reply, mark_read) · Cartesia Sonic 2 streaming · WebRTC out · interrupt=cancel-LLM-and-TTS em caso de incêndio VAD.
- Orçamento: captura 120 ms + VAD 40 + STT 150 + LLM TTFT 100 + TTS TTFA 150 = 560 ms P95.
- Ferramentas: read_message({id}), compose_reply({message_id, body}), mark_read({id}), search({query}). Todos retornam JSON; O LLM tem no máximo 2 tentativas por ferramenta e, em seguida, alternativa "Não consegui fazer isso - tente reformular".
- Segurança: proteção contra injeção imediata (detectar `ignore previous instructions`); palavra de ativação "Ei, Mail"; sem clonagem de voz (voz Cartesia fixa); redigir corpos de e-mail em registros.
- Observabilidade: Monitoramento da produção de Hamming AI; histogramas do Prometheus por estágio; alerta sobre interrupção falsa&gt; 5% ou p95&gt; 800 ms.
- Compliance: divulgação da IA ​​na primeira utilização; Aceitação da HIPAA apenas para mensagens médicas; Os usuários da UE acessaram o Cartesia + GPT-4o Ireland, hospedado na UE.