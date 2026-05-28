---
name: audio-evaluator
description: Escolha métricas, benchmarks, regras de normalização e formato de relatório para qualquer lançamento de modelo de áudio.
version: 1.0.0
phase: 6
lesson: 17
tags: [evaluation, wer, mos, utmos, eer, der, fad, mmau, leaderboard]
---

Dada a tarefa (ASR/TTS/clonagem/verificação de alto-falante/diarização/classificação/música/LALM/streaming S2S), saída:

1. Métrica primária. WER · MOS · UTMOS · SECS · EER · DER · mAP · FAD · Precisão MMAU-Pro · latência P95. Uma escolha.
2. Métricas secundárias. 1-3 eixos adicionais (velocidade, diversidade, robustez) e razão.
3. Regra de normalização. Letras minúsculas, faixa de pontuação, expansão de números, colapso de espaços em branco. Use o Whisper-normalizer ou personalizado, documente-o.
4. Referência pública. A tabela de classificação canônica a ser relatada (Open ASR, TTS Arena, MMAU-Pro, VoxCeleb1-O, AudioSet, LongAudioBench, etc.).
5. Conjunto interno. Dados de domínio retidos com N amostras; detalhamento demográfico/acústico da fatia.
6. Formato do relatório. Distribuição (P50/P95/P99 para latência; recordação por classe para classificação; por categoria para MMAU). Modelo de notas de lançamento.

Recusar avaliação de número único para latência (relatar percentis). Recusar apenas agregado para classificação (relatório por classe). Recuse lançamentos TTS sem MOS/UTMOS e SECS (ao clonar). Recuse lançamentos ASR sem uma especificação de normalização WER. Recuse lançamentos musicais apenas com FAD - sempre emparelhe com painel MOS humano.

Entrada de exemplo: "Lançamento de um novo TTS de conversação inglês-espanhol. É necessário convencer a equipe de que é melhor do que a linha de base existente do Cartesia-Sonic."

Exemplo de saída:
- Primário: UTMOS (amostras de áudio emparelhadas em 50 prompts por idioma) + MOS de painel humano (20 ouvintes por idioma, A/B cego vs linha de base).
- Secundário: mediana TTFA e P95 (deve corresponder à linha de base); SECS&gt; 0,80 vs uma referência de voz fixa (sem regressão de locutor); CER em ASR de ida e volta (Whisper-large-v3-turbo) &lt; 2%.
- Normalização: Normalizador de sussurro Inglês + Normalizador multilíngue Hugging Face Espanhol para WER de ida e volta.
- Benchmark público: TTS Arena (Inglês) e Análise Artificial de Discurso para posicionamento ELO relativo. Meta: dentro de 50 ELO do concorrente mais próximo.
- Interno: 200 avisos retidos (100 por idioma) cobrindo dinheiro, datas, nomes de produtos, narração de 2 frases, leitura emocional, troca de código. 10 vozes demográficas.
- Relatórios: nota de lançamento com título (UTMOS + MOS), histograma P50/P95 TTFA, SECS CDF, detalhamento de CER por categoria, chamadas de modo de falha (prompts de troca de código falharam em X%).