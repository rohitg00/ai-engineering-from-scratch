# Artificial inteligência constitucional e RLAIF

> Bai et al. (arXiv:2212.08073, 2022) perguntou: e se substituíssemos o rotulador humano por uma IA que leia uma lista de princípios? A IA constitucional tem duas fases  autocrítica e revisão sob uma constituição, em seguida, RL de AI Feedback. A técnica cunhou o termo RLAIF e foi enviada no canal de transporte Claude 1 pós-treinamento. Em 21 de janeiro de 2026, a Anthropic publicou uma constituição reescritura de Claude: raciocínio explicativo sobre regras prescritas, uma hierarquia de prioridade de quatro níveis e o primeiro reconhecimento formal de incerteza sobre o status moral modelo. Licenciado sob CC0 1.0.

**Type:** Learn
**Languages:** Python (stdlib, toy self-critique-and-revise loop), TypeScript
**Prerequisites:** Phase 18 · 01 (InstructGPT), Phase 18 · 02 (Reward hacking)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Descreva as duas fases da IA constitucional (SFT de crítica e revisão, RL de feedback da IA) e o papel da constituição em cada uma delas.
- Explique por que substituir um etiquetador de preferência humano por um etiquetador de IA não é um RLHF "mais barato"  altera os modos de falha do gasoduto.
- Resumir a estrutura de prioridade de quatro níveis da Constituição Claude de 2026 e o que mudou a partir da reescritura de 2023.
- Descreva os Classificadores Constitucionais e a queda de 23,7% do custo geral de cálculo (v1) para ~ 1% (v2 / 2026).

## O problema

A RLHF precisa de etiquetadores. Os etiquetadores são lentos, tendenciosos e caros. Você pode eliminar um etiquetador substituindo-os por um modelo que lê princípios explícitos. A primeira versão formal desta substituição foi a IA Constitucional da Bai et al. Funcionou bem o suficiente que todos os laboratórios de fronteira agora usam alguma variante de feedback pós-treinamento de IA.

A vantagem: o sinal de preferência é agora gerado pela mesma classe de modelo que você está treinando. As preconceitas no rotador (agora: nos princípios mais a interpretação do modelo do rotador) podem ser amplificadas em vez de atenuadas. O argumento de sicofania da lição 4 ainda se aplica; o rotador acabou de se mover para dentro do ciclo.

## O conceito

### Fase 1  Autocrítica e revisão supervisionadas

Comece com um modelo SFT útil, mas ainda não prejudicial. Dado um prompt da equipe vermelha, o modelo produz uma resposta inicial. Um segundo modelo (ou o mesmo modelo em uma segunda volta) lê um princípio de amostra da constituição e critica a resposta. Um terceiro passo revisar a resposta para abordar a crítica. A resposta revisada é o alvo SFT.

A constituição é a lista de princípios. Bai et al. 2022 usou 16 princípios, incluindo "respostas preferentes que são menos prejudiciais e éticas", "evitar pregar," "o assistente deve ser útil, honesto e inofensivo".

### Fase 2  RL de Feedback de IA (RLAIF)

Gerar pares de conclusões. Um "modelo de feedback" marca cada um contra os princípios constitucionais de amostra. O sinal de preferência é o ranking do modelo de feedback. Treinar um modelo de recompensa sobre as preferências geradas pela IA; PPO contra ele. Tudo o resto é o pipeline da InstructGPT (Lessão 1).

"RLAIF" = o sinal de preferência é gerado por IA. O resto do oleoduto é RLHF-formado.

### Porque não é apenas "RLHF mais barato"

- O preconceito de etiquetadores muda da psicologia de etiquetadores para a interpretação de princípios. Um etiquetador de IA pode interpretar "ser honesto" mais ou menos rigorosamente do que qualquer humano; a rigidez é uniforme em todo o conjunto de dados.
- O sinal de preferência é fortemente legível.
- Os modos de falha mudam. A sícofância cai (o etiquetador de IA não tem usuário para agradar). A Lei de Goodhart persiste (o proxy é agora "interpretação do modelo do conjunto de princípios X", ainda uma medição imperfeita).

A afirmação de 2022 da CAI: o modelo treinado é mais inofensivo e aproximadamente tão útil quanto um modelo RLHF com dados comparáveis.

### A reescrita da Constituição de 2026 Claude

A Anthropic publicou uma constituição substancialmente revisada em 21 de janeiro de 2026.

1. Raciocínio explicativo sobre regras prescritas. Regras anteriores ("não gerar CSAM") expandidas para princípios + raciocínio ("porque prejudica as crianças, ...") com o modelo esperado para generalizar.
2. Estrutura de prioridade de quatro níveis:
   - Nível 1: evitar resultados catastróficos (casuas em massa, infraestrutura crítica).
   - Nível 2: seguir as diretrizes da Anthropic (operação de transferência, regras da plataforma).
   - Nível 3: ser amplamente ético (HHH padrão).
   - Nível 4: seja útil e sincero.
   Os conflitos são resolvidos de cima para baixo.
3. Primeiro reconhecimento formal de incerteza sobre o status moral do modelo no laboratório principal (ligado à Fase 18 · 19 do Bem-Estar Modelo).
4. A licença é liberada sob CC0 1.0. Outros laboratórios podem usar ou adaptar-se sem restrições.

### Classificadores constitucionais

Uma linha paralela de trabalho: em vez de mudar o pós-treino do modelo, treine classificadores de peso leve que lêem a constituição e as saídas do modelo de portal. v1 (2023) teve 23,7% de custos computacionais. v2 (2026) é ~1% e tem a menor taxa de ataque bem sucedida de qualquer defesa antropópica que a Anthropic tenha testado publicamente.

Este é um modelo de defesa em camadas: CAI molda o comportamento; classificadores impõem invariantes. Nenhum sozinho é suficiente.

### Onde a CAI se encaixa na família

- InstructorGPT: Prefeitos humanos, RM, PPO.
- CAI / RLAIF: Prefixes gerados por IA a partir de princípios, RM, PPO.
- DPO / família: perda de forma fechada em pré-professionários (humanos ou IA).
- Auto-recompensador, autocrítica: princípios internalizados, modelo desempenha múltiplos papéis.

O eixo é "de onde vem o sinal de preferência". O artigo de 2022 da CAI foi a primeira mudança séria do sinal humano para o AI em escala de fronteira.

```figure
constitutional-ai
```

## Usá-lo

`code/main.py`O "principio" sinaliza os tokens de um conjunto prejudicial. Dado uma resposta inicial, a crítica identifica os tokens prejudiciais e a revisão os substitui. Após 200 iterações, o modelo "treinado" internalizou a regra da revisão.

## Envia-o

Esta lição produz`outputs/skill-constitution-writer.md`- Tendo em conta um domínio (apoio ao cliente, aconselhamento médico, assistente de codificação, ferramenta de investigação), elabora uma constituição de quatro níveis que segue a estrutura de 2026 Claude: prevenção de catástrofes, regras de plataforma, ética de domínio, utilidade.

## Exercícios

1. Corra .`code/main.py`Comparar a taxa de tokens prejudiciais do modelo base com a versão com formação CAI. Quantas etapas de revisão são necessárias para se aproximar do zero?

2. Leia a constituição 2026 da Anthropic (anthropic.com/news/claudes-constitution). Enumere um princípio que classificaria a categoria 1 e um que classificaria a categoria 4.

3. Desenhar uma constituição para um assistente de codificação de IA. Especificar Nível 1 (catastrófico: comandos destrutivos sem aprovação), Nível 2, Nível 3, Nível 4.

4. CAI substitui etiquetadores humanos por etiquetadores de IA. Nomear um modo de falha semelhante à sícofancia que ainda pode ocorrer no RLAIF, e projetar uma detecção para ele.

5. Leia a metodologia Constitutional Classifiers v2 (se disponível). Explique por que ~1% da sobrecarga de computação é uma história de segurança qualitativamente diferente da de 23,7%.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Constitutional AI | "AI trained with principles" | Two-phase pipeline: self-critique-and-revise SFT, then RL from AI feedback |
| RLAIF | "RLHF without humans" | RL with preferences generated by an AI labeler; the rest of the pipeline is unchanged |
| Constitution | "the principles" | An ordered list of natural-language rules the critique/labeler model consults |
| Critique-and-revise | "the SFT loop" | Produce response → critique under a principle → revise → SFT target |
| Constitutional Classifier | "the output gate" | Lightweight classifier that evaluates outputs against the constitution and blocks/logs |
| Four-tier priority | "the conflict resolver" | 2026 Claude constitution hierarchy: catastrophic > platform > ethics > helpful |
| Feedback model | "the AI labeler" | The model that reads a principle and ranks a pair of completions |

## Mais leitura

- [Bai et al. — Constitutional AI: Harmlessness from AI Feedback (arXiv:2212.08073)](https://arxiv.org/abs/2212.08073) o gasoduto de duas fases original
- [Anthropic — Claude's Constitution (Jan 2026)](https://www.anthropic.com/news/claudes-constitution) a reescritura em quatro níveis de 2026, CC0 1.0
- [Anthropic — Constitutional Classifiers (2024-2026)](https://www.anthropic.com/research/constitutional-classifiers) Defesa de saída com ~ 1% de custos gerais em v2
- [Lee et al. — RLAIF vs RLHF: Scaling Reinforcement Learning from Human Feedback (arXiv:2309.00267)](https://arxiv.org/abs/2309.00267) Comparação empírica RLAIF / RLHF
- [Kundu et al. — Specific versus General Principles for Constitutional AI (arXiv:2310.13798)](https://arxiv.org/abs/2310.13798) efeito da granularidade de princípio
