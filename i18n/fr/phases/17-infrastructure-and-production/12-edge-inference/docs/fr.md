# L'utilisation de la technologie de pointe est également considérée comme une des principales caractéristiques de la technologie de pointe.

> La contrainte de bord de base est la bande passante de la mémoire, pas le calcul. La DRAM mobile est à 50 à 90 Go/s; le centre de données HBM3 élimine 2-3 TB/s  un écart de 30 à 50 fois. Le décodeur est lié à la mémoire, donc l'écart est décisif. En 2026, le paysage est divisé en quatre parties. Le moteur neural Apple M4/A18 atteint 38 TOPS avec mémoire unifiée (pas de copie CPUNPU). Qualcomm Snapdragon X Elite / 8 Gen 4 Hexagon atteint 45 TOPS. WebGPU + WebLLM exécute Llama 3.1 8B (Q4) à ~ 41 tok/s sur M3 Max (environ 70-80% de natifs); 17,6k étoiles GitHub, API compatible avec OpenAI, ~70-75% de couverture mobile. NVIDIA Jetson Orin Nano Super (8GB) est compatible avec Llama 3.2 3B / Phi-3; AGX Orin fonctionne gpt-oss-20b via vLLM à ~40 tok/s; Jetson T4000 (JetPack 7.1) est 2x AGX Orin. TensorRT Edge-LLM prend en charge EAGLE-3, NVFP4, pré-remplissage en morceaux  présenté au CES 2026 par Bosch, ThunderSoft, MediaTek.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy bandwidth-bound decode simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 17 · 09 (Production Quantization)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Expliquez pourquoi l'inférence mobile LLM est liée à la mémoire et à la bande passante et le calcul est secondaire.
- Enumérez les quatre cibles de bord (Apple ANE, Qualcomm Hexagon, WebGPU/WebLLM, NVIDIA Jetson) et correspondrez chacune à un cas d'utilisation.
- Nombre de la lacune de couverture WebGPU 2026 (Firefox Android pour rattraper) et le débarquement Safari iOS 26.
- Choisissez un format de quantification par cible (Core ML INT4 + FP16 pour ANE, QNN INT8/INT4 pour Hexagon, WebGPU Q4 pour navigateur, NVFP4 pour Jetson Thor).

## Le problème

Un client veut un chatbot sur un appareil: voix-première, privé par défaut, fonctionne hors ligne. Sur un MacBook Pro M3 Max, Llama 3.1 8B Q4 fonctionne à ~55 tok/s  fine. Sur un iPhone 16 Pro, le même modèle fonctionne à 3 tok/s  non bien. Sur un Android de milieu de gamme avec Snapdragon 8 Gen 3, 7 tok/s. Dans le navigateur via WebGPU sur Chrome Android v121+, 4-8 tok/s selon l'appareil.

La variance de débit n'est pas un problème de port. C'est l'écart de bande passante fois le format de quantification fois si le NPU est accessible depuis l'espace utilisateur.

## Le concept

### La bande passante est le vrai plafond

Le décode lit l'ensemble complet des poids pour chaque jeton. Un modèle 7B dans le Q4 est de 3,5 Go. La lecture de 3,5 Go à 50 Go / s prend 70 ms  un plafond théorique de ~ 14 Tok / s. À 90 Go / s (DRAM mobile haut de gamme) le plafond se déplace à ~ 25 Tok / s. Aucune quantité de calcul ne permet de dépasser ce nombre.

Le centre de données HBM3 à 3 TB/s nettoie les mêmes 3,5 GB en 1,2 ms  le plafond est de 830 tok/s. Le même modèle, les mêmes poids.

### Moteur neuronal d'Apple (M4 / A18)

- Jusqu'à 38 TOPS. mémoire unifiée (CPU et ANE partagent le même pool)  Aucun coût de copie.
- Accès par le système de base ML + `.mlmodel`modèles compilés, ou par des métal-shaders (MPS) par PyTorch.
- Llama.cpp Metal backend utilise MPS, pas ANE directement; ANE natif nécessite la conversion de Core ML.
- Le meilleur chemin pratique pour les applications iOS en 2026: ML de base avec des poids INT4 + activations FP16.

### Qualcomm Hexagon (Snapdragon X Elite / 8 Gen 4)

- Intégré avec le processeur et la GPU dans le SoC mais séparé domaine de mémoire.
- Le SDK QNN (Qualcomm Neural Network) et l'AI Hub fournissent la conversion à partir de PyTorch/ONNX.
- Les modèles de chat, Llama 3.2, Phi-3 sont tous envoyés comme des objets de première classe sur l'AI Hub.

### Les NPU Intel / AMD (Lunar Lake, Ryzen AI 300)

- 40-50 TOPS. Le logiciel est en retard sur Apple/Qualcomm; OpenVINO s'améliore mais est un niche.
- Meilleur pour les applications de copilote ARM Windows; natif sur les ordinateurs de bureau AMD/Intel pour la première fois locale.

### L'utilisation de l'appareil

- Exécuter des modèles dans le navigateur via des shaders de calcul WebGPU; aucune installation.
- Llama 3.1 8B Q4 à ~41 tok/s sur M3 Max  environ 70-80% de natifs via le même backend.
- 17,6k GitHub étoiles sur WebLLM; API JS compatible avec OpenAI; Apache 2.0.
- Couverture 2026: Chrome Android v121+, Safari iOS 26 GA, Firefox Android toujours à la traîne. Couverture mobile globale ~ 70-75%.

### La famille Jetson

- Orin Nano Super (8 Go): s'adapte à Llama 3.2 3B, Phi-3 à bon taux de partage.
- AGX Orin: fonctionne gpt-oss-20b via vLLM à ~40 tok/s.
- Thor / T4000 (JetPack 7.1): 2x de performance AGX Orin, EAGLE-3 et NVFP4 pris en charge.
- TensorRT Edge-LLM (2026) prend en charge le décoding spéculatif EAGLE-3, les poids NVFP4, le pré-remplissage en morceaux  les optimisations du centre de données portées à bord.

### Choix de quantification par cible

| Target | Format | Notes |
|--------|--------|-------|
| Apple ANE | INT4 weights + FP16 activations | Core ML conversion path |
| Qualcomm Hexagon | QNN INT8 / INT4 | AI Hub converters |
| WebGPU / WebLLM | Q4 MLC (q4f16_1) | Use `mlc_llm convert_weight` + compiled `.wasm`; GGUF is not supported |
| Jetson Orin Nano | Q4 GGUF or TRT-LLM INT4 | Memory-bound |
| Jetson AGX / Thor | NVFP4 + FP8 KV | Edge-LLM path |

### Le piège du long contexte sur le bord

Le contexte 128K de Llama 3.1 est une fonctionnalité de centre de données. Sur un téléphone avec 8 Go de RAM, modèle 4 Go + 2 Go de cache KV pour les jetons 32 Go + OS overhead = OOM. Les déploiements Edge gardent le contexte à 4 K-8 Go à moins que la quantification KV agressive (Q4 KV) ne soit acceptée.

### La voix est l'application tueur

Les agents vocaux sont sensibles à la latence (premier jeton < 500 ms). L'inférence locale élimine complètement la latence du réseau.

### Les chiffres que vous devriez vous rappeler

- Apple M4 / A18 ANE: 38 survols.
- Qualcomm Hexagon SD X Elite: 45 TOPS.
- WebLLM M3 Max: ~41 tocs/s sur Llama 3.1 8B Q4.
- AGX Orin: ~ 40 tok/s sur gpt-oss-20b par vLLM.
- L'écart de bande passante entre le centre de données et le bord: 30 à 50 fois.
- Couverture mobile WebGPU: ~ 70-75% (décalage de Firefox Android).

```figure
edge-bandwidth-pipe
```

## Utilisez-le

`code/main.py`Comparé aux points de référence observés et aux points marqués où la bande passante, et non le calcul, est le goulot d'étranglement.

## La faire partir

Cette leçon produit `outputs/skill-edge-target-picker.md`. En fonction de la plateforme (iOS/Android/browser/Jetson), du modèle et du budget de latence/mémoire, choisit un format de quantification et un pipeline de conversion.

## Exercices

1. On court .`code/main.py`Pour un modèle 7B au Q4 sur un Snapdragon 8 Gen 3 (~77 Go/s de bande passante), calculer le plafond de décode.
2. Le WebGPU sur Android nécessite Chrome v121+. Concevoir un back-up pour les navigateurs plus anciens  côté serveur via la même API OpenAI compatible.
3. Votre application iOS a besoin de streaming de contexte 4K. Quelle combinaison de modèle/format vous permet de rester sous 4 Go de mémoire active sur un iPhone 16 ?
4. Jetson AGX Orin fonctionne gpt-oss-20b à 40 tok/s. Jetson Nano ne correspond qu'à un 3B. Si votre produit cible les deux, comment unifier la pile d'inférence?
5. Débattrez si "WebLLM est prêt à la production en 2026". Citez la couverture, les performances et le fossé entre Firefox et Android.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| ANE | "Apple neural engine" | On-device NPU in M-series and A-series; unified memory |
| Hexagon | "Qualcomm NPU" | Snapdragon NPU; QNN SDK for access |
| WebGPU | "browser GPU" | W3C-standardized browser GPU API; Chrome/Safari 2026 |
| WebLLM | "browser LLM runtime" | MLC-LLM project; Apache 2.0; OpenAI-compatible JS |
| Jetson | "NVIDIA edge" | Orin Nano / AGX / Thor / T4000 family |
| TRT Edge-LLM | "edge TensorRT" | 2026 edge port of TensorRT-LLM; EAGLE-3 + NVFP4 |
| Unified memory | "shared pool" | CPU and NPU see same RAM; no copy overhead |
| Bandwidth-bound | "memory limited" | Decode gated by bytes/sec reading weights |
| Core ML | "Apple conversion" | Apple framework for ANE-native models |
| QNN | "Qualcomm stack" | Qualcomm Neural Network SDK |

## Pour en savoir plus

- [On-Device LLMs State of the Union 2026](https://v-chandra.github.io/on-device-llms/) paysage et critères de référence.
- [NVIDIA Jetson Edge AI](https://developer.nvidia.com/blog/getting-started-with-edge-ai-on-nvidia-jetson-llms-vlms-and-foundation-models-for-robotics/) Orin / AGX / Thor.
- [NVIDIA TensorRT Edge-LLM](https://developer.nvidia.com/blog/accelerating-llm-and-vlm-inference-for-automotive-and-robotics-with-nvidia-tensorrt-edge-llm/) Annonce de port de bord de 2026.
- [WebLLM (arXiv:2412.15803)](https://arxiv.org/html/2412.15803v2) conception et critères de référence.
- [Apple Core ML](https://developer.apple.com/documentation/coreml) Conversion en ANE-native.
- [Qualcomm AI Hub](https://aihub.qualcomm.com/) Modèles préconvertis pour Hexagon.
