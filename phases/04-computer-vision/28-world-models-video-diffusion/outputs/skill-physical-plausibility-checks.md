---
name: skill-physical-plausibility-checks
description: ship 前に任意の generated video に対して object permanence、gravity、continuity の automated checks を行う
version: 1.0.0
phase: 4
lesson: 28
tags: [video-generation, quality, physics, evaluation]
---

# Physical Plausibility Checks

generated video の production deployment には automated guardrails が必要である。human review は scale しない。physics checks は古典的な failure modes を捕捉する。

## 使用する場面

- text または image prompts から video を生成する任意の product。
- video generation API endpoint の QA を自動化するとき。
- fine-tuning または base-model update 後に video model の quality drift を monitor するとき。

## 入力

- `video`: tensor `(T, H, W, 3)` または mp4 への path。
- optional reference info: expected number of objects、initial scene description。

## checks

### 1. Object permanence
SAM 3.1 Object Multiplex で detection を frames across に track する。stable track が <=3 frames 消えて再出現したら flag する。model が一時的に object を失っている。frame centre 付近で object が消える場合は hard fail、edge では soft fail。

### 2. Motion smoothness
consecutive frames 間の optical flow は概ね continuous であるべき。sudden per-pixel flow spikes は teleportation を示す。RAFT で flow を計算し、99th-percentile flow magnitude が median の 10 倍を超える frames を flag する。

### 3. Gravity / support
solid として検出された objects (food、balls、tools) について、lifting action がない場合は vertical position が non-increasing であることを確認する。object 付近に "grasping hand" が検出されない限り、upward drift を flag する。

### 4. Identity consistency
people または characters には、frames across で face-recognition embedding を使う。persistent identity では 5-frame windows にわたり cosine similarity が > 0.8 を保つべきである。threshold 未満なら character が morph したことを意味する。

### 5. Hands and limbs
pose estimator (Lesson 21) を実行する。hand に visible fingers が > 5 または < 4 しかない frames、arm length が frames 間で 2 倍になる frames、limbs が surface を通って body と交差する frames を flag する。

### 6. Text rendering (if prompt asked for text)
user prompt に quotes 内の string が含まれる場合、generated frames を OCR し、requested string に対する CER を計算する。> 20% CER を flag する。

## report

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

## ルール

- single check だけで hard-block しない。scores を aggregate し、total anomalies が threshold を超えた場合に video を review に hold する。
- identity drift と permanence violations の weight を最も高くする。users はこれらに最初に気づく。
- per-check failure rates を時系列で log する。rising trend は通常、base model update または prompt distribution shift を意味する。
- flagged video を削除しない。model debugging と post-mortems のために保持する。
- sensitive content (people、children、public figures) では、score にかかわらずすべての video に human review を要求する。
