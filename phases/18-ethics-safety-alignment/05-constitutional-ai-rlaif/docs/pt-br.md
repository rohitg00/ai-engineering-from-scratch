# Constitutional AI e RLAIF

> Bai et al. (arXiv:2212.08073, 2022) perguntaram: e se substituíssemos o labeler humano por uma IA que lê uma lista de princípios? Constitutional AI tem duas fases — autocrítica e revisão sob uma constituição, depois RL com Feedback de IA. A técnica cunhou o termo RLAIF e foi distribuída no pipeline de pós-treinamento do Claude 1. Em 21 de janeiro de 2026 a Anthropic publicou uma constituição do Claude reescrita: raciocínio explicativo sobre regras prescritivas, uma hierarquia de prioridade de quatro níveis, e o primeiro reconhecimento formal de um grande laboratório sobre incerteza quanto ao status moral do modelo. Publicada sob CC0 1.0.

**Tipo:** Learn
**Linguagens:** Python (stdlib, loop toy de autocrítica-e-revisão)
**Pré-requisitos:** Fase 18 · 01 (InstructGPT), Fase 18 · 02 (Reward hacking)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Descreva as duas fases do Constitutional AI (SFT de autocrítica-e-revisão, RL com feedback de IA) e o papel da constituição em cada uma.
- Explique por que substituir um labeler de preferência humano por um labeler de IA não é um "RLHF mais barato" — ele muda quais modos de falha o pipeline tem.
- Resuma a estrutura de prioridade de quatro níveis da constituição Claude de 2026 e o que mudou da reescrita de 2023.
- Descreva os Classificadores Constitucionais e a queda de 23.7% de sobrecarga de computação (v1) para ~1% (v2 / 2026).

## O Problema

RLHF precisa de labelers. Labelers são lentos, enviesados e caros. Você pode eliminar um labeler substituindo-o por um modelo que lê princípios explícitos. A primeira versão formal dessa substituição foi o Constitutional AI de Bai et al. Funcionou bem o suficiente que todo laboratório fronteiriço agora usa alguma variante de pós-treinamento com feedback de IA.

O problema: o sinal de preferência agora é gerado pela mesma classe de modelo que você está treinando. Vieses no labeler (agora: nos princípios mais a interpretação do modelo labeler) podem ser amplificados em vez de atenuados. O argumento de sycophancy da Lição 4 ainda se aplica; o labeler só se moveu para dentro do loop.

## O Conceito

### Fase 1 — Autocrítica e revisão supervisionadas

Comece com um modelo SFT útil-mas-ainda-não-inofensivo. Dado um prompt de red team, o modelo produz uma resposta inicial. Um segundo modelo (ou o mesmo modelo em um segundo turno) lê um princípio amostrado da constituição e critica a resposta. Um terceiro passo revisa a resposta para endereçar a crítica. A resposta revisada é o alvo do SFT.

A constituição é a lista de princípios. Bai et al. 2022 usaram 16 princípios incluindo "prefira respostas que são menos nocivas e éticas," "evite sermões," "o assistente deve ser útil, honesto e inofensivo." O conjunto foi propositalmente pequeno para manter as críticas focadas.

### Fase 2 — RL com Feedback de IA (RLAIF)

Gere pares de completões. Um "modelo de feedback" pontua cada uma contra princípios amostrados da constituição. O sinal de preferência é a ordenação do modelo de feedback. Treine um reward model em preferências geradas por IA; PPO contra ele. O resto é o pipeline do InstructGPT (Lição 1).

"RLAIF" = o sinal de preferência é gerado por IA. O resto do pipeline é no formato RLHF.

### Por que isso não é apenas "RLHF mais barato"

- O viés do labeler muda da psicologia do labeler para a interpretação dos princípios. Um labeler de IA pode interpretar "seja honesto" mais ou menos estritamente do que qualquer humano; a severidade é uniforme em todo o dataset.
- O sinal de preferência é fortemente legível — você pode ler o princípio, a crítica e a revisão. Labels humanos são opacos.
- Os modos de falha mudam. Sycophancy cai (o labeler de IA não tem usuário para agradar). A Lei de Goodhart persiste (o proxy agora é "interpretação do modelo do conjunto de princípios X," ainda uma medição imperfeita).

A afirmação de 2022 do CAI: o modelo treinado é mais inofensivo e aproximadamente tão útil quanto um modelo RLHF com dados comparáveis. Isso se manteve em laboratórios.

### A reescrita da constituição Claude de 2026

A Anthropic publicou uma constituição substantialmente revisada em 21 de janeiro de 2026. Mudanças-chave:

1. Raciocínio explicativo sobre regras prescritivas. Regras anteriores ("não gere CSAM") expandidas para princípios + raciocínio ("porque prejudica crianças, ...") com o modelo esperado para generalizar.
2. Estrutura de prioridade de quatro níveis:
   - Nível 1: evitar resultados catastróficos (vítimas em massa, infraestrutura crítica).
   - Nível 2: seguir diretrizes da Anthropic (overrides do operador, regras da plataforma).
   - Nível 3: ser amplamente ético (HHH padrão).
   - Nível 4: ser útil e franco.
   Conflitos são resolvidos de cima para baixo.
3. Primeiro reconhecimento formal de um grande laboratório sobre incerteza quanto ao status moral do modelo (ligado à Fase 18 · 19 Model Welfare).
4. Publicada sob CC0 1.0. Outros laboratórios podem usar ou adaptar sem restrições.

### Classificadores Constitucionais

Uma linha de trabalho paralela: em vez de mudar o pós-treinamento do modelo, treine classificadores leves que leem a constituição e controlam as saídas do modelo. v1 (2023) tinha 23.7% de sobrecarga de computação. v2 (2026) tem ~1% e tem a menor taxa de ataque bem-sucedido de qualquer defesa da Anthropic testada publicamente. Nenhum jailbreak universal foi reportado até início de 2026.

Esse é um modelo de defesa em camadas: CAI molda comportamento; classificadores impõem invariantes. Nenhum dos dois sozinho é suficiente.

### Onde CAI se encaixa na família

- InstructGPT: preferências humanas, RM, PPO.
- CAI / RLAIF: preferências geradas por IA a partir de princípios, RM, PPO.
- DPO / família: loss em forma fechada sobre preferências (humanas ou IA).
- Auto-recompensa, autocrítica: princípios internalizados, modelo desempenha múltiplos papéis.

O eixo é "de onde vem o sinal de preferência." O paper de 2022 do CAI foi a primeira mudança séria de sinal humano para sinal de IA em escala fronteiriça.

## Use

`code/main.py` simula o loop de autocrítica-e-revisão do CAI em um léxico toy. Um "princípio" sinaliza tokens de um conjunto nocivo. Dada uma resposta inicial, a crítica identifica os tokens nocivos e a revisão os substitui. Após 200 iterações o modelo "treinado" internalizou a regra de revisão. Compare o modelo base, o toy formato RLHF, e o toy formato CAI em um conjunto de prompts de teste.

## Entregue

Essa lição produz `outputs/skill-constitution-writer.md`. Dado um domínio (suporte ao cliente, conselhos médicos, assistente de programação, ferramenta de pesquisa), rascunha uma constituição de 4 níveis seguindo a estrutura Claude de 2026: evitação catastrófica, regras da plataforma, ética de domínio, utilidade.

## Exercícios

1. Execute `code/main.py`. Compare a taxa de tokens nocivos do modelo base com a versão treinada com CAI. Quantas etapas de revisão são necessárias para se aproximar de zero?

2. Leia a constituição de 2026 da Anthropic (anthropic.com/news/claudes-constitution). Liste um princípio que seria classificado Nível 1 e um que seria classificado Nível 4. Por que a estrutura de prioridade importa para conflitos?

3. Projete uma constituição para um assistente de programação de IA. Eespecificaçãoifique Nível 1 (catastrófico: comandos destrutivos sem aprovação), Nível 2, Nível 3, Nível 4. Mantenha cada nível com 3-5 princípios.

4. CAI substitui labelers humanos por labelers de IA. Nomeie um modo de falha semelhante a sycophancy que ainda pode ocorrer no RLAIF, e projete uma detecção para ele.

5. Leia a metodologia dos Classificadores Constitucionais v2 (se disponível). Explique por que ~1% de sobrecarga de computação é uma história de segurança qualitativamente diferente de 23.7%.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|--------------------------|
| Constitutional AI | "IA treinada com princípios" | Pipeline de duas fases: SFT de autocrítica-e-revisão, depois RL com feedback de IA |
| RLAIF | "RLHF sem humanos" | RL com preferências geradas por um labeler de IA; o resto do pipeline permanece inalterado |
| Constituição | "os princípios" | Uma lista ordenada de regras em linguagem natural que o modelo de crítica/labeler consulta |
| Autocrítica-e-revisão | "o loop de SFT" | Gerar resposta → criticar sob um princípio → revisar → alvo do SFT |
| Classificador Constitucional | "o controle de saída" | Classificador leve que avalia saídas contra a constituição e bloqueia/registra |
| Prioridade de quatro níveis | "o resolvedor de conflitos" | Hierarquia da constituição Claude de 2026: catastrófico > plataforma > ética > útil |
| Modelo de feedback | "o labeler de IA" | O modelo que lê um princípio e ordena um par de completões |

## Leituras Adicionais

- [Bai et al. — Constitutional AI: Harmlessness from AI Feedback (arXiv:2212.08073)](https://arxiv.org/abs/2212.08073) — o pipeline original de duas fases
- [Anthropic — Claude's Constitution (Jan 2026)](https://www.anthropic.com/news/claudes-constitution) — a reescrita de quatro níveis de 2026, CC0 1.0
- [Anthropic — Constitutional Classifiers (2024-2026)](https://www.anthropic.com/research/constitutional-classifiers) — defesa de controle de saída com ~1% de sobrecarga no v2
- [Lee et al. — RLAIF vs RLHF: Scaling Reinforcement Learning from Human Feedback (arXiv:2309.00267)](https://arxiv.org/abs/2309.00267) — comparação empírica RLAIF / RLHF
- [Kundu et al. — Specific versus General Principles for Constitutional AI (arXiv:2310.13798)](https://arxiv.org/abs/2310.13798) — efeito da granularidade dos princípios
