---
name: clip-zero-shot
description: Execute a classificação de imagens zero-shot com um ponto de verificação CLIP/SigLIP, produzindo previsões classificadas com pontuações de similaridade.
version: 1.0.0
phase: 12
lesson: 02
tags: [clip, siglip, zero-shot, vision-language]
---

Dada uma lista de imagens (caminhos de arquivos ou URLs) e uma lista de nomes de classes candidatas, produza uma classificação classificada como zero-shot usando um ponto de verificação CLIP ou SigLIP declarado. A habilidade é pura previsão; não treina nem faz ajustes finos.

Produzir:

1. Construção imediata. Para cada classe, forme N modelos de texto (padrão: `a photo of a {class}`, `a picture of a {class}`, `an image of a {class}`). Incorpore cada prompt com o codificador de texto e a média para formar o protótipo da classe.
2. Incorporação de imagem. Incorpore cada imagem de entrada com o codificador de visão indicado. Normalize ambos os lados para comprimento unitário.
3. Previsões classificadas. Calcule a similaridade de cosseno entre cada incorporação de imagem e cada protótipo de classe. Retorne o top 1 e o top 5 com pontuações.
4. Metadados do ponto de verificação. Nomeie o ponto de verificação exato do Hugging Face usado (por exemplo, `openai/clip-vit-large-patch14` ou `google/siglip2-so400m-patch14-384`) e a resolução que ele espera.
5. Aviso de honestidade. Afirme que o tiro zero em aulas fora da distribuição pré-treinamento não é confiável; exibir a pontuação do primeiro lugar como um proxy de confiança e avisar quando estiver abaixo de 0,2.

Rejeições difíceis:
- Qualquer uso que enquadre a saída como um rótulo definitivo para classes que não estão na lista fornecida pelo chamador.
- Reivindicações sobre pontuações em diferentes pontos de verificação serem comparáveis; Pontuação SigLIP e CLIP em diferentes escalas.
- Execução de imagens conhecidas por conterem pessoas sem uma política de consentimento posterior.

Regras de recusa:
- Se o chamador solicitar a classificação em categorias médicas, legais ou críticas de segurança (diagnóstico, identidade, atributos protegidos), recuse e redirecione para modelos supervisionados com trilhas de auditoria.
- Se o chamador fornecer um único nome de classe (classificação unilateral sem alternativas), recuse — o tiro zero precisa de pelo menos dois candidatos para ser significativo.
- Se o ponto de verificação não for especificado, recuse e pergunte qual (CLIP, OpenCLIP, SigLIP, SigLIP 2) mais qual escala.

Saída: uma lista classificada das 5 principais previsões por imagem com pontuações de similaridade de cosseno, nome do ponto de verificação, modelos de prompt usados ​​e um sinalizador de confiança. Termine com um parágrafo "o que ler a seguir" apontando para a Lição 12.06 para NaFlex (lidando com proporções de aspecto variáveis) ou o artigo SigLIP 2 para um mergulho mais profundo.