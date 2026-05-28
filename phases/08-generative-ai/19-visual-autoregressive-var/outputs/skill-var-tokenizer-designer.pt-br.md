---
name: var-tokenizer-designer
description: Projete um tokenizer VQ residual em várias escalas para geração de imagens autoregressivas visuais de próxima escala.
version: 1.0.0
phase: 8
lesson: 19
tags: [var, next-scale-prediction, vq-vae, residual-vq, image-generation, tokenizer]
---

Dado o alvo da imagem (resolução, canais, cor versus escala de cinza, tamanho do conjunto de dados, orçamento de computação LM downstream, FID alvo), saída:

1. Cronograma de escala. Liste os níveis de resolução K de 1x1 até (H/p) x (W/p). Padrão 10 escalas para 256x256, 14 para 512x512. Justifique K em relação ao comprimento efetivo da sequência do LM (soma das áreas da escala) e ao orçamento paralelo dentro da escala por passagem.
2. Livro de códigos. Tamanho único do livro de código compartilhado V em todas as escalas (típico 4096/8192/16384). Escolha V no tamanho do conjunto de dados e na capacidade do decodificador. Confirme se o uso do livro de códigos permanece acima de 50% em um lote de calibração ou reduza V.
3. Compartilhamento residual. Confirme que as escalas 1..K reconstroem juntas o latente por meio de embeddings resumidos (VQ residual). Indique o tamanho do patch p e o backbone VAE (discriminador estilo VQGAN ativado / desativado, peso de perda perceptual).
4. Decodificador. Mapeamento do decodificador VAE somado de volta aos pixels. Escolha entre o decodificador VQGAN, o decodificador de papel VAR ou um decodificador mais leve do estilo MAGVIT. Justifique em relação ao alvo FID e ao decodificador VRAM.
5. Posicione a incorporação. Confirme (scale_index, row, col) triplo com uma incorporação aprendida por escala e um sen-cos 2D dentro da escala. Rejeite posições 1D planas; o LM precisa do rótulo da escala para aplicar a condicional correta.

Recuse um tokenizer multiescala não residual para VAR. Sem a soma dos resíduos, a condicional da próxima escala torna-se mal definida e o LM otimiza um objetivo diferente do que o artigo prova. Recuse livros de códigos separados por escala, a menos que V seja calibrado para a contagem de pixels da escala menor e o colapso do livro de códigos seja mitigado. Recuse a previsão da próxima escala quando K x área de escala média exceder o comprimento máximo de sequência do LM menos o headroom para condicionamento de texto.

Entrada de exemplo: "ImageNet classe condicional 256x256, conjunto de dados 1,2M, orçamento LM parâmetros 1,5B, FID alvo abaixo de 5,0."

Exemplo de saída:
- Cronograma de escala: K=10, tamanhos 1, 2, 3, 4, 5, 6, 8, 10, 13, 16. Total de tokens 671.
- Livro de códigos: compartilhado, V=4096. Espere 70-80 por cento de uso no ImageNet em 256.
- Partilha residual: confirmada; p = 16, backbone VQGAN com perdas perceptivas + adversárias, reconstruções de soma residual f.
- Decodificador: decodificador VQGAN, 4 blocos de upsampling, sem refinador extra.
- Incorporação de posição: (escala, linha, coluna) triplo, token de escala aprendido + sen-cos 2D dentro da escala.