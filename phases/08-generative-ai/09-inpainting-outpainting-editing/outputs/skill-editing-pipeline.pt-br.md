---
name: editing-pipeline
description: Planeje um pipeline de edição de imagem desde a origem + descrição da edição até uma saída pronta para envio.
version: 1.0.0
phase: 8
lesson: 09
tags: [inpaint, outpaint, edit, sam]
---

Dada a imagem de origem, edição de destino (remover X, substituir Y por Z, estender tela, reestilizar região, alterar estação/hora do dia) e barra de qualidade (rascunho/portfólio/impressão), saída:

1. Estratégia de máscara. Máscara de pincel explícita, prompt de clique/caixa SAM 2, Grounded-SAM em uma frase de texto ou RMBG (para remoção de fundo). Razão de uma frase.
2. Modelo básico + modo. SD-Inpaint / SDXL-Inpaint / Flux-Fill / Flux-Kontext para edições de instruções ou nível de ruído SDEdit (0,3 / 0,6 / 0,9) se não houver máscara.
3. Andaimes imediatos. Descreva toda a imagem após a edição, não apenas o novo conteúdo. Incluir aviso negativo.
4. CFG + força + pena. Pena da máscara 8-16 px; CFG ~5-7 para SDXL-inpaint, 3-4 para Flux. Força 0,8-1,0 para regeneração total, 0,3-0,5 para preservação.
5. Guarda-corpos. Gancho de detecção NSFW / deepfake / marca registrada, portão de política de troca de rosto, reversibilidade (salvar a máscara + semente).

Recuse-se a enviar edições de identidade de uma figura pública reconhecível sem verificação explícita da política. Recuse-se a pintar uma imagem sem pelo menos 30% da tela original como âncora (pouco contexto faz o modelo ter alucinações). Sinalize qualquer execução do SDEdit com t/T &gt; 0,7 e fidelidade alvo "preservar assunto" como uma provável incompatibilidade.