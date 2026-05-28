---
name: skill-physical-plausibility-checks
description: Verificações automatizadas de permanência de objetos, gravidade e continuidade em qualquer vídeo gerado antes do deploy
version: 1.0.0
phase: 4
lesson: 28
tags: ['video-generation', 'quality', 'physics', 'evaluation']
---


# Verificações de Plausibilidade Física

Deployments de vídeo gerado em produção precisam de barreiras automatizadas. Revisão humana não escala; verificações de física pegam os modos de falha clássicos.

## Quando usar

- Qualquer produto que gera vídeo a partir de prompts de texto ou imagem.
- Automatizando QA em um endpoint de API de geração de vídeo.
- Monitorando o drift de qualidade de um modelo de vídeo após fine-tuning ou atualização do modelo base.

## Entradas

- `video`: a tensor `(T, H, W, 3)` or a path to an mp4.
- Optional reference info: expected number of objects, initial scene description.

## Verificações

### 1. Permanência de objetos
Rastreie cada detecção ao longo dos frames com SAM 3.1 Object Multiplex. Sinalize quando um rastreamento estável desaparece por <=3 frames e reaparece — o modelo perdeu o objeto temporariamente. Falha dura quando um objeto desaparece perto do centro do frame (não numa borda); falha suave nas bordas.

### 2. Suavidade de movimento
Optical flow entre frames consecutivos deve ser majoritariamente contínuo. Picos repentinos de flow por pixel indicam teletransporte. Compute flow com RAFT; sinalize frames onde a magnitude do flow no percentil 99 excede a mediana por um fator > 10.

### 3. Gravidade / suporte
Pra objetos detectados como sólidos (comida, bolas, ferramentas), verifique que a posição vertical não está aumentando na ausência de uma ação de levantar. Sinalize drift ascendente a menos que uma "mão agarrando" seja detectada perto do objeto.

### 4. Consistência de identidade
Pra pessoas ou personagens, use um embedding de reconhecimento facial ao longo dos frames. Similaridade coseno deve ficar > 0.8 em janelas de 5 frames pra uma identidade persistente. Abaixo do threshold significa que o personagem mudou.

### 5. Mãos e membros
Execute um estimador de pose (Lição 21). Sinalize frames onde uma mão tem > 5 ou < 4 dedos visíveis; onde o comprimento do braço dobra entre frames; onde membros intersectam o corpo através de uma superfície.

### 6. Renderização de texto (se o prompt pediu texto)
Se o prompt do usuário incluiu uma string entre aspas, faça OCR nos frames gerados e compute CER contra a string solicitada. Sinalize > 20% de CER.

## Relatório

```
[plausibility]
  video frames:           <T>
  permanence violations:  <N>
  smoothness violations:  <N>
  gravity violations:     <N>
  identity drift:         <N of 5-frame windows>
  limb anomalies:         <N>
  OCR CER vs requested:   <float>

[verdict]
  ship | hold | reject

[samples for review]
  frame ranges where each failure occurred
```

## Regras

- Não bloqueie rigidamente em nenhuma verificação individual; agregue scores e segure o vídeo pra revisão quando o total de anomalias exceder um limite.
- Dê maior peso a drift de identidade e violações de permanência — os usuários notam primeiro.
- Registre taxas de falha por verificação ao longo do tempo; uma tendência crescente geralmente significa que o modelo base foi atualizado ou a distribuição de prompts mudou.
- Nunca delete o vídeo sinalizado; guarde pra debug do modelo e post-mortems.
- Pra conteúdo sensível (pessoas, crianças, figuras públicas), exija revisão humana de todo vídeo independente do score.
