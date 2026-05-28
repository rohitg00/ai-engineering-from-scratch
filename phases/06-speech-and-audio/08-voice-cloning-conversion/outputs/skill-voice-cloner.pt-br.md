---
name: voice-cloner
description: Escolha a abordagem de clonagem (disparo zero/conversão/adaptação), artefato de consentimento, marca d'água e filtros de segurança para uma implantação de clonagem de voz.
version: 1.0.0
phase: 6
lesson: 08
tags: [voice-cloning, voice-conversion, watermark, consent, safety]
---

Dada a tarefa (idioma, comprimento de referência disponível, orçamento de adaptação, restrições de licença, status de consentimento, escala de implantação), resultado:

1. Abordagem. Clone zero-shot (F5-TTS / VibeVoice / Orpheus / OpenVoice V2) · conversão de voz (kNN-VC / OpenVoice V2 tom-cor) · adaptação de alto-falante (XTTS v2 + LoRA / VITS ajuste fino completo).
2. Preparação de referência. Comprimento necessário, SNR (≥ 20 dB), mono 16 kHz+, ajuste de silêncio, `ref_text` (deve corresponder exatamente para F5-TTS). Rejeite referências de música.
3. Artefato de consentimento. Consentimento explícito gravado do proprietário da voz. Modelo: nome + data + finalidade + escopo + procedimento de revogação. Armazene mais de 7 anos.
4. Marca d'água. Carga útil de 16 bits incorporada ao AudioSeal em todas as saídas. Configure o detector no CI para verificar a presença antes de publicar o áudio.
5. Filtros de segurança. Rejeição imediata da entidade nomeada (celebridade/político/menor); limite de taxa por usuário por hora; log de auditoria de cada geração de clone; interruptor de interrupção.

Recuse-se a enviar clonagem sem uma estratégia de marca d'água. Recuse-se a clonar celebridades/políticos/menores de idade, independentemente de reivindicações de consentimento. Recusar referências abaixo de 3 s ou SNR &lt; 20dB. Recuse F5-TTS para implantações comerciais (CC-BY-NC). Recuse a clonagem interlingual sem sinalizar explicitamente a lacuna na transferência de sotaque.

Entrada de exemplo: "Aplicativo de acessibilidade: deixe o paciente com ELA controlar a voz enquanto ainda fala e, em seguida, fale através do TTS após a perda de voz. Inglês, EUA."

Exemplo de saída:
- Abordagem: OpenVoice V2 (MIT, zero-shot, referência de 6 s). Caso de uso de acessibilidade com consentimento inerente; paciente é dono da voz.
- Preparação de referência: grave clipes de 5 × 6 s em condições de qualidade de estúdio (sala silenciosa, microfone USB, 24 kHz). Armazene transcrições brutas +. Construa referência centróide para estabilidade.
- Consentimento: assinatura digital + vídeo afirmação atestando a finalidade (“reuso de voz pós-diagnóstico”), armazenado em volume criptografado com retenção de 10 anos. Linha direta de revogação.
Marca d'água: codificação de carga útil AudioSeal de 16 bits `patient_id` + `clip_id`; o detector é executado em todas as gerações no CI.
- Segurança: prompts de entidade nomeada com filtro rígido; registrar cada geração; ROI limitado à instância do aplicativo conectado do paciente. Sem exposição à API.