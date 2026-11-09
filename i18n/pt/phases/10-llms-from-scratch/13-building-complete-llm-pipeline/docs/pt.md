# Construir um oleoduto completo de LLM

> Tudo, das lições 01 a 12, é uma fase de um pipeline. Esta lição é o andaime que transforma esses estágios em uma única corrida de ponta a ponta: tokenize, pre-trein, escala, SFT, alinhar, avaliar, quantizar, servir. Não treinarás um modelo 70B num laptop. Você vai produzir a camada de orquestração, o manifesto, o portal de avaliação e o plano de regresso que uma equipe de fronteira 2026 usa para decidir o que será enviado. Esta é a pedra angular.

**Type:** Build
**Languages:** Python (stdlib), Rust
**Prerequisites:** All Phase 10 lessons 01-12
**Time:** ~120 minutes

## Objetivos de aprendizagem

- Compõem as doze lições anteriores (dois lições de tokenizer, dados, pré-formação, escalação, SFT, RLHF, DPO, CAI, eval, quantização, inferência) em uma única especificação de pipeline reprodutível
- Defina o contrato de artefatos entre fases: o que cada etapa consome, o que produz e como a próxima fase verifica a entrada
- Construir um orquestrador que acompanhe experimentos, hashes artefatos, e portas de embarque decisões em limiares de avaliação
- Desenhar o plano de reestruturação: quais artefatos são baratos de reestruturar, quais caros e quanto custa um posto de controlo corrupto

## O problema

As lições anteriores funcionam cada vez. Tokenizer treinado. Mini GPT pré- treinado. SFT conjunto de dados montado. Modelo de recompensa treinado. DPO executado. Evals medidos. Pesos quantizados exportados. servidor de inferência espalhado. Cada um é um notebook. Cada um tem suas próprias convenções, seus próprios caminhos de saída, sua própria semente.

Uma corrida de treinamento de fronteira não é um caderno. Llama 3 405B levou 30 milhões de horas H100 em aproximadamente 54 dias. O DeepSeek-V3 usou cerca de 2,8 milhões de horas H800. Durante esse tempo, um ponto de controlo corrupto, uma contaminação de dados, uma regressão de avaliação podem custar uma semana de relógio de parede e um mês de orçamento de GPU. A forma como as equipes sobrevivem é através da higiene do pipeline: cada etapa tem uma entrada determinista, uma saída determinista, um manifesto, um hash e um portal.

Esta é a pedra final. Você não vai executar o pipeline de ponta a ponta em um laptop. Você vai escrever o orquestrador que coordena os estágios, o manifesto que descreve a execução, o verificador que gate navios decisões, e o plano de repetição que permite a um terceiro re-executar o seu trabalho a partir de um único arquivo. O código é pequeno; a disciplina é grande.

A escala do padrão varia de 100M a 1T, sem alterações. Os mesmos quatro componentes - manifesto, orquestrador, portal de avaliação, loja de artefatos - executam Llama 3 e também executam o seu hobby GPT. A diferença é o tamanho dos números dentro da configuração de cada estágio, não a forma do pipeline.

## O conceito

### As Doze Etapas

Cada lição da Fase 10 é uma fase.

```mermaid
graph TD
    S1["01 Tokenizer vocab"] --> S2["02 Trained tokenizer"]
    S2 --> S3["03 Sharded dataset"]
    S3 --> S4["04 Base model checkpoint"]
    S4 --> S5["05 Scaled training recipe"]
    S5 --> S6["06 SFT checkpoint"]
    S6 --> S7["07 Reward model + PPO policy"]
    S6 --> S8["08 DPO policy"]
    S7 --> S9["09 CAI / GRPO refined policy"]
    S8 --> S9
    S9 --> S10["10 Eval report"]
    S9 --> S11["11 Quantized weights"]
    S11 --> S12["12 Inference server"]
    S10 --> GATE["Ship gate"]
    S12 --> GATE

    style S1 fill:#1a1a2e,stroke:#e94560,color:#fff
    style S4 fill:#1a1a2e,stroke:#0f3460,color:#fff
    style S9 fill:#1a1a2e,stroke:#0f3460,color:#fff
    style GATE fill:#1a1a2e,stroke:#51cf66,color:#fff
```

As etapas 07 e 08 podem funcionar em paralelo. Tudo o resto é uma dependência dura. Uma mudança na etapa 02 (tokenizer) invalida todos os artefatos a jusante. Uma mudança na etapa 10 (eval) invalida apenas a decisão do navio.

### O Manifesto

Um manifesto é um único arquivo que descreve uma execução completamente o suficiente para repeti-la. Nada que o pipeline produz deve depender do estado que não está no manifesto. Os campos são chatos e obrigatórios.

```
pipeline_version: 1.2.3
seed: 42
git_commit: a1b2c3d4
stages:
  01_tokenizer:
    recipe: bpe_32k
    input_hash: sha256:...
    output_hash: sha256:...
    wall_clock_sec: 3600
    cost_usd: 12
```

O hash de saída do estágio N é o hash de entrada do estágio N + 1. Qualquer desvio e o pipeline para. É assim que você detecta a corrupção de dados cedo. É também como um colega de equipe em um continente diferente verifica que sua repetição de um estágio determinista produziu o mesmo artefato que o seu.

Na prática, as equipes usam um pequeno esquema YAML mais um verificador de manifesto que difere da execução anterior com sucesso. Qualquer delta fora dos campos esperados (custo, relógio de parede) é uma bandeira vermelha.

### Tipografia de artefatos

A saída de cada estágio é um artefato tipado, não um bloco de diretório, nem um picil, mas um tipo com nome com um esquema conhecido.

| Stage | Artifact Type | Key Fields |
|-------|--------------|-----------|
| 01-02 | Tokenizer | vocab.json, merges.txt, config.json, hash |
| 03 | Dataset | shards[], row count, token count, dedup stats |
| 04-05 | Checkpoint | weights.safetensors, config.json, optimizer state, step count |
| 06 | SFT Model | checkpoint + SFT recipe + data mix |
| 07 | Reward Model | RM checkpoint + preference data hash |
| 08-09 | Policy | checkpoint + reference hash + beta + KL budget consumed |
| 10 | Eval Report | benchmark scores + regression diffs + eval data hash |
| 11 | Quantized Model | quantized weights + calibration data + accuracy delta vs FP16 |
| 12 | Server Spec | endpoint + model hash + config + observability hooks |

A digitação impede o modo de falha mais comum: usar uma saída de estágio 08 como entrada de estágio 06, enviar um modelo treinado por DPO através do caminho SFT. Artefatos digitalizados e assinaturas digitalizadas fazem com que esses erros sejam falhas de compilação, não falhas de cinco dias.

### A Porta de Eval

O transporte não é "treinamento terminado". O transporte é "treinamento terminado e o portal de avaliação passado". O portal é definido antes do início da corrida.

```
gates:
  mmlu:      >= baseline + 0.5   # no regression
  humaneval: >= baseline + 1.0
  truthfulqa: >= baseline         # no drop
  safety_refusal_rate: <= 0.05
  kl_from_reference: <= 25.0
  cost_total_usd: <= 50000
```

Cada porta é um limite numérico. Não há portas "parecem boas". Não há assinaturas subjetivas. Se cada porta passa, o artefato é marcado como enviável. Se qualquer porta falhar, a corrida é realizada pendente de uma revisa explícita por um revisor nomeado, que é registrado no manifesto.

O sistema de regulação da produção de produtos de base é um sistema de regulação de preços que permite a utilização de um sistema de regulação de preços.

### O Orquestrador

Um pequeno pedaço de código que lê o manifesto, despacha etapas, rastreia artefatos e detém qualquer violação de contrato.

O trabalho do orquestrador é estreito:

1. Resolva o dia da data do manifesto.
2. Para cada etapa, verifique se a saída esperada já existe no hash correto (salte se sim).
3. Caminhar o palco, capturar o estdout/stderr, medir o relógio da parede e o custo.
4. Verifique o hash de saída contra o hash de entrada esperado da fase descendente.
5. Em caso de falha, escreva um manifesto parcial com o estágio exato de falha e saia não zero.

São 200 linhas de Python.`code/main.py`Sob o capô, o oleoduto real usa`torchrun`ou `ray`Para executar etapas individuais em aglomerados, mas o próprio orquestrador funciona em uma única caixa.

### Perseguimento de Experimentos e Armazenamento de Artefactos

Dois sistemas externos ancoram o gasoduto.

**Experiment tracker (wandb, neptune, mlflow).**Registros de curvas de perda, métricas de avaliação, telemetria do sistema por etapa. O rastreador é onde você vai quando você precisa comparar corrida A contra corrida B três semanas depois. As equipes quase sempre usam um rastreador hospedado para isso - escrever seu próprio perde tempo que deve ir para o treinamento.

**Artifact store (S3, R2, GCS).**Armazenamento imutável de objetos para pontos de verificação, conjuntos de dados, tokenizers, relatórios de avaliação.`latest.pt`é uma arma de pé;`ckpt-7b-step-20000-sha256:abc123.safetensors`É um contrato.

O orquestrador escreve para ambos, o rastreador é para humanos a olhar para mapas, a loja de artefatos é para o próximo estágio a procurar entradas.

### Custo

Uma corrida de fronteira tem um número de dólar ligado.

**Pre-run estimate.**Do manifesto, calcula os FLOPs esperados (para pré-treino: 6 x parâmetros x tokens), as horas de GPU esperadas (FLOPs / pico de produção / utilização) e o custo em dólares na taxa de aluguel atual.

**In-run tracking.**O relógio de parede estágio por estágio e o custo são registrados no manifesto. Após cada estágio, o orçamento restante é verificado. Se um estágio for ultrapassado, o portão da próxima etapa é avaliado com o novo orçamento restante. Você não descobre que está sem dinheiro quando o VC liga.

O custo relatado da Llama 3 foi $61M. DeepSeek-V3 reported $5,6 milhões para a corrida principal de pré-treino. A relação é principalmente eficiência de hardware mais mistura de especialistas -- mas o custo específico é visível porque ambas as equipes rastrearam por etapa, não por corrida.

### Reprodução vs Determinismo

Estes não são os mesmos. *Reproducible* significa o mesmo manifesto mais o mesmo código mais a mesma infraestrutura produz um ponto de controlo com métricas equivalentes a jusante. *Deterministic* significa saída bit-identical.

A formação moderna de Mestrado em Direito Jurídico é reprodutiva, mas não determinista. O redução de ordem do treinamento distribuído, o não-determinismo do kernel da GPU (cuBLAS, flash-attn) e o arredondamento de precisão mista se combinam para produzir flutuantes que diferem no nível 1e-5 entre corridas. Isto é bom para as métricas finais, que não se movem. É fatal se estiver a tentar depurar com diferenças de nível de bits. A cura é registrar o hash de entrada, hash de saída e métricas de cabeçalho de cada etapa. Em uma repetição, os hashes coincidem apenas para etapas deterministas, como processamento de dados e tokenization. Uma fase de treinamento escreve novos pesos, então o hash de saída muda. Para essas etapas, a corrida é "reproduzida" quando as métricas de cabeçalho coincidem, mesmo que os pesos não sejam bit-identicos.

```mermaid
graph LR
    M["Manifest v1.2.3"] --> O["Orchestrator"]
    O --> S["Stages 01 → 12"]
    S --> AS["Artifact Store\n(content-addressed)"]
    S --> ET["Experiment Tracker\n(metrics, curves)"]
    AS --> GATE["Eval Gate"]
    ET --> GATE
    GATE -->|pass| SHIP["Ship"]
    GATE -->|fail| ROLL["Rollback plan"]

    style M fill:#1a1a2e,stroke:#0f3460,color:#fff
    style GATE fill:#1a1a2e,stroke:#e94560,color:#fff
    style SHIP fill:#1a1a2e,stroke:#51cf66,color:#fff
    style ROLL fill:#1a1a2e,stroke:#c0392b,color:#fff
```

### Plano de retorno

Antes de começar a corrida, escreva o que acontece em cada falha de cada etapa.

- **Cheap to re-run**Tokenizer, eval, quantização, servidor de inferência.
- **Medium**(días): SFT, DPO, CAI. Mantém o modelo base; reexamine apenas as etapas de alinhamento.
- **Expensive**O plano de retrocesso aqui não é "re-exercício". É "utilizar o último bom ponto de controlo e re-exercer as etapas mais baratas do fluxo de dados revistos".

Como as dependências de estágio são digitadas e hashadas, o orquestador pode calcular o conjunto de rollback automaticamente: invalidar o estágio falhado mais todos os descendentes. Uma falha no estágio 06 (SFT) invalidar 06, 07, 08, 09, 10, 11, 12.

### Recetas de produção observadas em 2026

A maioria das equipes de fronteira convergiu no mesmo esqueleto.

- Tokenizer: 128k BPE com fallback de byte.
- Pre-treinamento: 10-20T tokens, principalmente web plus código mais sintético. Muon ou AdamW optimizador. FSDP2 ou DeepSpeed ZeRO-3.
- SFT: pares de instruções 500k-2M, misturados com humanos e sintéticos, com depuração rigorosa contra o conjunto de eval.
- Alineamento: DPO ou CAI + GRPO. RLHF apenas quando o sinal de preferência é demasiado multidimensional para o DPO.
- Eval: MMLU-Pro, MATH, HumanEval+, GPQA, SWE-Bench Verified, LiveBench, mais um set privado que o público nunca vê.
- Quantização: GPTQ ou AWQ de 4 bits para servir, 8 bits para avaliações de segurança, onde a precisão é importante.
- Servir: vLLM, TensorRT-LLM, ou interno. Batch contínuo. Descodagem especulativa.

Os números mudam a cada seis meses.

```figure
beam-search
```

## Construí-lo

O código da lição é um orquestrador e um verificador de manifesto, não doze guiões de treinamento. Cada etapa é simulada com um reservatório de lugar que produz um artefato de saída com a forma correta e hash.

Veja .`code/main.py`Para a execução completa, as partes-chave:

- `Manifest`Dataclass: versão de pipeline, seed, git commit, estágios, gates.
- `Stage`Dataclass: nome, tipo, entradas (hashes), saída (hash), relógio de parede, custo.
- `Orchestrator.run()`: resolve o DAG, envia etapas, verifica hashes, actualizações manifestam.
- `EvalGate.check()`: lê os limiares, compara com o último relatório de avaliação, apresenta o resultado positivo/negativo.
- `ArtifactStore`(in-memory stub): colocar/pegar por hash, simula S3.
- `CostTracker`: por fase e cumulativa, paradas quando o limite ultrapassado.

O gasoduto em `main.py`O sistema de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste

## Usá-lo

O fluxo de trabalho canônico tem três comandos.

```bash
python code/main.py plan    # validate manifest, compute cost estimate, print DAG
python code/main.py run     # execute stages, writing to manifest.out.yaml
python code/main.py gate    # read manifest.out.yaml, apply eval gates, ship-or-hold
```

O porto de Rust funciona da mesma forma .`plan`Passo:

```bash
rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson plan
```

Corra .`plan`A maioria dos bugs de pipeline aparecem no tempo planeado - limiares de entrada faltantes, hashes obsoletos, ultrapassamentos de orçamento.`plan`É livre, correndo.`run`Poupar dinheiro capturando percevejos no lado barato.

A produção de `gate`É um dos dois .`SHIP`ou `HOLD: <reason>`Uma corrida realizada não é um fracasso; é um ponto de decisão. Um revisor nomeado ou revita (e a revitalização é registrada), ou aprova o revitalização.

## Envia-o

Esta lição produz`outputs/skill-llm-pipeline-reviewer.md`. fornecer um manifesto de pipeline proposto e verificar todos os contratos: fase de digitação, cadeia de hash, portas, plano de retrocesso, estimativa de custos. recusa-se a aprovar um manifesto com um portal de avaliação faltante, um orçamento KL ilimitado ou uma execução que mistura dados de avaliação e treinamento.

## Exercícios

1. Extenda o orquestrador para apoiar a execução paralela das etapas 07 e 08.`concurrent.futures`Confirme que o manifesto final registra as saídas de ambas as etapas e que o hash de entrada do estágio 09 é uma combinação determinista de ambas.

2. Adicione um gate de "controle de contaminação". Tendo em conta o hash do conjunto de dados eval e os fragmentos do conjunto de dados de treinamento, calcule a sobreposição (combinação exata de cadeia ou correspondência de 13 gramas). O gate falha se a sobreposição exceder 0,1%.

3. Implementar uma estimadora de custos a partir de primeiros princípios. Para a fase 04 (pre-treino), estimar FLOPs como 6 x parâmetros x tokens, assumir 40% MFU (utilização de FLOPs modelo) no H100 em 989 TFLOPs BF16, a $ 2,50/GPU-hora. Relatar a estimativa para um modelo 7B treinado em tokens 2T. Compare com números Llama 2 publicados.

4. Construir um rollback parcial. Simula uma falha no estágio 09 (CAI), em seguida, re-executar os estágios 09 a 12 deixando 01-08 em cache. O orquestrador deve detectar os artefatos em cache por hash e ignorá-los. Medir o relógio de parede guardado versus re-exercício completo.

5. Adicione observabilidade. Emite extensões OpenTelemetry para cada etapa, com atributos para parâmetros, tokens vistos, perda e custo.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Manifest | "The recipe file" | YAML or JSON describing pipeline version, seed, per-stage config, and gate thresholds — sufficient to replay a run |
| Content-addressed | "By hash not name" | Artifacts stored by SHA-256 of their contents, so you can never confuse version A with version B |
| Eval gate | "The ship criteria" | Numeric thresholds on benchmark metrics and safety scores that must pass before an artifact is marked shippable |
| KL budget | "How far alignment drifted" | A cap on cumulative $\mathrm{KL}(\text{policy} \Vert \text{reference})$ across alignment stages, enforced as a gate |
| MFU | "How much of the GPU you used" | Model FLOPs Utilization — achieved FLOPs divided by theoretical peak. 40% is typical at 70B scale, 55% at 7B |
| Rollback plan | "What we do when it breaks" | Pre-written set of actions per stage on failure: re-run, fall back, retrain with revised inputs |
| Orchestrator | "The conductor" | The process that reads the manifest, dispatches stages, verifies hashes, halts on any contract violation |
| Artifact store | "Versioned S3 for weights" | Immutable content-addressed object store — single source of truth for checkpoints, datasets, eval reports |
| Reproducible | "Same metrics on replay" | Different bit-level weights but equivalent downstream metrics — the realistic target for distributed LLM training |
| Cost gate | "You cannot exceed X" | Pre-run cost estimate plus in-run tracker — the pipeline refuses to start if the estimate exceeds budget |

## Mais leitura

- [Dubey et al., 2024 -- "The Llama 3 Herd of Models"](https://arxiv.org/abs/2407.21783)- a descrição pública mais detalhada de um pipeline de fronteira, incluindo dados, formação, alinhamento, avaliação
- [DeepSeek-AI, 2024 -- "DeepSeek-V3 Technical Report"](https://arxiv.org/abs/2412.19437)-- primeiro de eficiência, em cerca de 1/10 do custo do treinamento de classe Llama 3
- [Kaplan et al., 2020 -- "Scaling Laws for Neural Language Models"](https://arxiv.org/abs/2001.08361)-- a relação de escalação original computação-parâmetros de dados
- [Hoffmann et al., 2022 -- "Training Compute-Optimal Large Language Models (Chinchilla)"](https://arxiv.org/abs/2203.15556)-- a correcção para Kaplan que recalibrou os orçamentos modernos de dados
- [PyTorch FSDP2 documentation](https://pytorch.org/docs/stable/fsdp.html)-- o primitivo de formação distribuído que substitui o FSDP1 no PyTorch 2.4+
- [Weights & Biases LLM Reports](https://wandb.ai/site/solutions/llms/)-- Manifestos reais e experimentos de rastreamento de saída para cursos de LLM de código aberto, úteis como modelos plagiáveis
