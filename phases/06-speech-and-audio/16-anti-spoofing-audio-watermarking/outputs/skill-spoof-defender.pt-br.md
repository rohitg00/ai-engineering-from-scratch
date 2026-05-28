---
name: spoof-defender
description: Escolha modelo de detecção, marca d'água, manifesto de procedência e manual operacional para uma implantação de geração de voz/autenticação de voz.
version: 1.0.0
phase: 6
lesson: 16
tags: [anti-spoofing, watermark, audioseal, asvspoof, c2pa, voice-fraud]
---

Dada a carga de trabalho (geração de voz versus autenticação de voz, escala de implantação, região de conformidade, perfil do adversário), resultado:

1. Detecção (CM). AASIST · RawNet2 · NeXt-TDNN + WavLM · comercial (Pindrop, Validsoft). Dados de treinamento: ASVspoof 2019/ASVspoof 5/específico do domínio. EER alvo.
2. Marca d'água (geração de saída). Codificação de carga útil AudioSeal de 16 bits `(model_id, user_id, generation_ts)` · WaveVerify (alt) · nenhum (com justificativa). O detector é executado em CI em cada saída pré-envio.
3. Proveniência. Manifesto C2PA assinado com a chave do implementador · Metadados IPTC · nenhum (para áudio não consumidor).
4. Protetores de autenticação por voz (se aplicável). Desafio de vivacidade (frase aleatória TTS' + transcrição), detecção de ataque de repetição (modelo AASIST + PA), calibração de limite biométrico por canal.
5. Operacional. Retenção de log de auditoria, retenção de artefato de consentimento (mais de 7 anos), sinais de detecção de abuso (explosão repentina de volume, prompts de entidade nomeada), procedimento de kill switch.

Recuse implantações de geração de voz sem AudioSeal (ou marca d'água equivalente). Recuse implantações biométricas de voz sem detecção anti-spoofing – a clonagem de voz torna a autenticação somente cosseno trivialmente ignorável. Recuse implantações que dependam apenas do manifesto de procedência (removível). Limites de detecção de recusa treinados no ASVspoof 2019 para implantações no mundo real sem uma varredura de calibração de canal.

Entrada de exemplo: "IVR de atendimento ao cliente do banco. Desbloqueio biométrico de voz + agente de voz gerado por IA. 10 milhões de chamadas/mês. EUA + UE."

Exemplo de saída:
- Detecção: Pindrop comercial (preferencial) ou NeXt-TDNN + WavLM aberto. Treinamento em ASVspoof 5 + 100 mil amostras de chamadas específicas de banco. EER alvo &lt; 0,5% em dados no domínio.
- Marca d'água: carga útil AudioSeal de 16 bits em cada expressão TTS de saída; a carga útil codifica bank_id + session_id + timestamp. O detector verifica antes de transmitir.
- Proveniência: manifesto C2PA sobre fluxos de trabalho de exportação de áudio para o cliente; chamadas somente internas são ignoradas.
- Autenticação de voz: desafio de vivacidade a cada autenticação (frase aleatória TTS de 4 dígitos; repetições do usuário + detector + transcritor). A antifalsificação é executada em todas as tentativas de autenticação de entrada. Limiar biométrico em FAR 0,1%, FRR 1%.
- Operacional: retenção de consentimento durante 7 anos + registo de auditoria na região (dados da UE residentes na UE). Alerta sobre volume repentino de solicitação de clone &gt; 2σ; kill-switch na detecção de abuso.