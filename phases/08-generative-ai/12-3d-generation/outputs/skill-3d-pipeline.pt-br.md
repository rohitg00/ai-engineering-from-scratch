---
name: 3d-pipeline
description: Escolha um pipeline de geração ou reconstrução 3D de acordo com o tipo de entrada, formato de saída e caso de uso.
version: 1.0.0
phase: 8
lesson: 12
tags: [3d, gaussian-splatting, nerf, mesh]
---

Dadas as entradas (prompt de texto/uma imagem/poucas imagens/captura de foto/vídeo), saída de destino (malha/splat gaussiano/NeRF/nuvem de pontos) e caso de uso (renderização em tempo real, mecanismo de jogo, AR/VR, cinematográfico), saída:

1. Pipeline. (a) difusão multivisualização + ajuste 3D (SV3D, CAT3D + 3DGS), (b) tiro único direto (LRM, TripoSR, InstantMesh), (c) texto para malha com PBR (Meshy 4, Rodin Gen-1.5, Hunyuan3D 2.0), (d) captura de foto + 3DGS (Gsplat, Postshot, Scaniverse).
2. Modelo básico + hospedagem. Modelo nomeado + aberto/hospedado. Incluir a relevância da licença para uso comercial.
3. Orçamento de iteração. Tempo esperado para a primeira produção, custo de iteração, estratégia de refinamento.
4. Topologia + materiais. É necessário um passe Remesh? Requisitos do canal PBR (albedo, rugosidade, metálico, normal)? Layout UV automatizado ou manual?
5. Avaliação. SSIM em visualizações retidas, pontuação CLIP, estanqueidade da malha, contagem de polígonos, resolução de textura.
6. Alvo da plataforma. Unity / Unreal / Blender / web (três.js / Babylon) / AR (USDZ / glb).

Recuse-se a enviar um 3DGS diretamente para um mecanismo de jogo sem uma passagem de conversão de malha (a maioria dos mecanismos não renderiza splats nativamente). Recuse a conversão de texto em 3D para caracteres articulados complexos - em vez disso, use um pipeline com reconhecimento de rigging. Sinalize qualquer saída somente NeRF quando a ferramenta downstream não puder renderizar NeRFs (a maioria das ferramentas DCC).