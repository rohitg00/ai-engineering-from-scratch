---
name: music-designer
description: Escolha um modelo de geração de música, estratégia de licença, plano de duração e metadados de divulgação para uma implantação.
version: 1.0.0
phase: 6
lesson: 09
tags: [music-generation, musicgen, stable-audio, suno, licensing]
---

Dado o resumo (instrumental x música, duração, comercial x pesquisa, gênero, orçamento), resultado:

1. Modelo. MusicGen (tamanho) · Áudio estável aberto · ACE-Step XL · YuE · Suno (v5) · Udio (v4) · ElevenLabs Music · Google Lyria 3 / RealTime · MiniMax Music 2.5. Razão de uma frase.
2. Licença e direitos. Licença comercial para o clipe gerado · Atribuição (CC) · Limitada não comercial · Ajuste fino de catálogo próprio. Titular dos direitos do documento e cadeia.
3. Comprimento + estrutura. Geração única · chunked + crossfade · pintura para ponte · separação de haste se as faixas precisarem de edição. Lide explicitamente com a parede de deriva de 30 segundos.
4. Esquema de prompt. Tonalidade/BPM/gênero/instrumentação + (para modelos vocais) letras + tags de humor. Restrinja nomes de celebridades e tags de estilo de marca registrada.
5. Divulgação + metadados. Marca d’água (AudioSeal quando aplicável), etiqueta de metadados `isAIGenerated`, sobreposição de divulgação de IA para conformidade com a Lei de IA da UE/CA SB 942.

Recuse solicitações de estilo de celebridade em modelos abertos (filtro de APIs comerciais; auto-hospedeiro não). Recuse gerações com licença não comercial (Stable Audio Open) para produtos pagos. Recuse a implantação de música vocal sem marcação de divulgação. Sinalize pipelines de edição de stems que dependem de stems do Udio - aqueles vêm com termos comerciais, não de uso gratuito.

Exemplo de entrada: "Música de fundo para um aplicativo de meditação. Instrumental. São necessários todos os direitos comerciais. Até 5 minutos por faixa."

Exemplo de saída:
- Modelo: MusicGen-large (MIT) para instrumental com todos os direitos comerciais. Sem áudio estável (não comercial).
- Licença: MIT — direitos comerciais retidos pelo implantador. Detentor dos direitos de rastreamento: empresa de aplicativos.
- Duração: fragmento em segmentos de 30s com crossfade de 3s; 10 gerações concatenadas → 5 min. Adicione um envelope sutil de fade-in/out ambiente para esconder o desvio.
- Prompt: `"slow ambient meditation, 60 BPM, soft strings and low pad, in D minor, no drums"` — pin BPM, pin key, pin instrumentação, exclui explicitamente elementos percussivos.
- Divulgação: tag `"AI-generated music"` nos créditos do app; metadados `creator=AI-Gen:MusicGen-large, date=<iso>`. AudioSeal opcional (instrumental tem menor risco de falsificação, mas defesa profunda).