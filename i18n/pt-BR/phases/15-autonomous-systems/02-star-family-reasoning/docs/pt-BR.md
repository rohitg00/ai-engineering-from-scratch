# STAR, V-STAR, Silent-STAR  Raciocínio auto-instruído

> O menor ciclo de auto-melhoria possível está dentro da lógica. Um modelo gera uma cadeia de pensamentos, mantém os que aterram nas respostas corretas e ajusta-os. É o STAR. O V-STaR adiciona um verificador, por isso a seleção de tempo de inferência é melhor. O Quiet-STaR empurra a razão para cada sinal. Os três trabalham. Nenhum deles é mágico. O ciclo preserva qualquer atalho que aconteceu para chegar à resposta certa.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, bootstrap-loop simulator)
**Prerequisites:** Phase 13 · 01-03 (Reasoning and CoT), Phase 15 · 01 (long-horizon framing)
**Time:** ~60 minutes

## O problema

A maneira mais simples de ensinar um modelo a raciocínio é recolher traços de raciocínio escrito pelo homem.

O STaR (Self-Teught Reasoner, Zelikman et al., 2022) pergunta: e se o modelo escrever seus próprios racionais e classificá-los em relação às respostas conhecidas?

1. Uma resposta de raciocínio, mais um rastro.
2. Se a resposta final for correta, mantenha o rastro.
3. - Aponta os vestígios.
4. Repito. - Não.

GSM8K e CommonsenseQA melhoraram sem novas anotações humanas. Mas o loop tem um viés incorporado: qualquer raciocínio que produziu a resposta certa é mantido, independentemente de se o raciocínio em si foi sólido. V-STaR (Hosseini et al., 2024) corrige isso com um verificador aprendido; Quiet-STaR (Zelikman et al., 2024) generaliza a ideia para per-token raciocínios internos.

## O conceito

### STaR: bootstrap no que funcionou

Comece a partir de um modelo base com alguma capacidade de raciocínio fraca. Em cada problema de treinamento, amostre uma razão mais resposta. Se a resposta coincide com o rótulo, mantenha o (problema, raciocínio, resposta) triplo. Ajuste o modelo no conjunto mantido. Repita.

Uma vez que o modelo nunca consegue resolver um problema, o ciclo não pode aprender com ele.**rationalization**Para os problemas que o modelo falha, injectar a resposta correta como uma sugestão e re-instigar o modelo para produzir uma racionalização que o leve a ele.

Resultado no artigo original (Zelikman et al., 2022): um modelo base GPT-J melhorou no GSM8K de 5,8% para 10,7% através de rodadas repetidas de STaR com racionalização  cerca de 5 pontos percentuais absolutos. No CommonsenseQA, o GPT-J 6B treinado no STaR atingiu 72,5%, comparável a um GPT-3 175B (~73%)

### V-STaR: treinar um verificador com o DPO

Os dados são também dados: cada par de (rationale, "is this correct") pode treinar um verificador. Eles usam a otimização de preferências diretas sobre soluções corretas e incorretas para construir um ranker.

Delta relatada: +4 a +17 pontos percentuais em relação às linhas de base de auto-melhoria anteriores no GSM8K e no MATH, com a maior parte do ganho proveniente da utilização do verificador para a seleção do tempo de inferência em vez de para o ajuste fino adicional do gerador.

### Quiet-STaR: racionalidades internas por token

Zelikman et al. (2024) perguntou: e se o modelo aprende a gerar uma raciocínio interna curta em cada posição de token, não apenas entre problema e resposta? Quiet-STaR treina um modelo para emitir um "pensamento" oculto antes de cada token previsto, em seguida, mistura a previsão consciente do pensamento com a previsão de linha de base através de um peso aprendido.

Resultado: Mistral 7B ganhou melhorias absolutas de zero-shot no GSM8K de 5,9% para 10,9% e CommonsenseQA de 36,3% para 47,2% sem ajuste específico de tarefa. O modelo aprendeu "quando pensar"  tokens duros obtêm racionalidades internas mais longas; os fáceis quase nenhuma.

### Por que os três compartilham uma preocupação com a segurança

Os três métodos usam a resposta final como o sinal de gradiente. Uma razão que chega à resposta correta através de raciocínio defeituoso  explorando um atalho, adivinhando ou usando um padrão não generalizador  é reforçada positivamente. Em problemas de distribuição, o atalho funciona. Em problemas fora da distribuição, quebra em silêncio.

O verificador do V-STaR atenuam aprendendo a classificar racionais, mas o verificador é treinado no mesmo conjunto de rótulos. Ele pode aprender a preferir o raciocínio errado bem formatado ao contrário de incerteza honesta. O design mais seguro é combinar dados no estilo STaR com (a) modelos de recompensa supervisionados pelo processo (recompensando passos intermediários, não apenas respostas) e (b) avaliação de OOD realizada que quebra atalhos simples.

### Comparativo

| Method | Training signal | Inference cost | Data waste | Known failure mode |
|---|---|---|---|---|
| STaR | keep (rationale, answer) if correct | 1x | discards all incorrect rationales | shortcut rationales |
| STaR + rationalization | above + correct-answer hinted retries | 1x | less | rationalized rationales may be implausible |
| V-STaR | STaR + DPO verifier from both classes | Nx (best-of-N) | minimal | verifier can reinforce confident wrongness |
| Quiet-STaR | per-token rationale + mixing weight | 1.5-3x | minimal | still answer-conditioned gradient |

### Onde esta fica no monte de 2026

O STAR é velho. Mas o padrão reaparece em toda parte em 2025-2026. RL em problemas matemáticos verificáveis (DeepSeek-R1, Kimi-k1.5, o1) é o sinal de gradiente de resposta condicionado do STaR, aumentado. Os modelos de recompensa de processo (Lightman et al., 2023; "Verificemos passo a passo" da OpenAI) são a alternativa supervisionada pelo processo. AlphaEvolve (Lessão 3) é STaR para código, com um evaluador de programa em vez de um rótulo. Darwin Godel Machine (Lessão 4) é STaR para o próprio andaime do agente.

Entender o STaR faz todos estes cliques. É o ciclo de auto-melhora mínimo viável.

```figure
reflection-loop
```

## Usá-lo

`code/main.py`executa um ciclo STaR simulado numa tarefa aritmética de brinquedo.

- Como a precisão sobe sobre as balas de arranque.
- Como os atalhos se infiltram: o simulador inclui uma classe de raciocínio "voeiro" que obtém a resposta certa 40% das vezes, mas generaliza mal.
- Como um verificador (estilo V-STaR) ajuda na inferência, mas não pode recortar completamente os atalhos introduzidos durante o treinamento.

## Envia-o

`outputs/skill-star-loop-reviewer.md`ajuda a auditar um pipeline de raciocínio autodidacta antes de treinar.

## Exercícios

1. Execute o simulador. Configure a frequência de atalho para zero, em seguida para 0,4.

2. Adicione um teste de OOD prolongado ao simulador. Desenhe problemas de uma distribuição diferente e avalia o modelo arrancado em conjuntos de distribuição e OOD. Cuantifique a lacuna.

3. Leia o artigo Quiet-STaR (arXiv:2403.09629) Secção 3. Explique o símbolo "final de pensamento" e a cabeça de peso de mistura em três frases cada.

4. Compare o filtro de manutenção se correto da STaR com uma alternativa supervisionada por processos que recompensa cada passo racional de forma independente.

5. Desenhar uma avaliação que capture racionais de atalhos em um modelo implementado. Não precisa ser perfeito  tem que quebrar os atalhos mais simples que um ciclo STaR reforçaria.

## Termos-chave

| Term | What people say | What it actually means |
|---|---|---|
| STaR | "Self-Taught Reasoner" | Fine-tune on model-generated rationales that land correct answers; repeat |
| Rationalization | "Hinted retry" | Inject the correct answer and re-prompt for a rationale on problems the base model fails |
| V-STaR | "Verifier STaR" | DPO-train a verifier on both correct and incorrect rationales, use it for inference-time selection |
| Quiet-STaR | "Per-token rationales" | Generate hidden thoughts at every token position; mix with baseline prediction |
| Answer-conditioned gradient | "Outcome-based signal" | The training loop rewards final answers, not reasoning steps |
| Process reward model | "Step-level verifier" | Reward model trained on per-step correctness, not outcome — contrasts with STaR |
| Shortcut rationale | "Right answer, wrong reasoning" | A rationale that reaches the label via a non-generalizing pattern; STaR keeps these |

## Mais leitura

- [Zelikman et al. (2022). STaR: Bootstrapping Reasoning With Reasoning](https://arxiv.org/abs/2203.14465)- O papel original.
- [Hosseini et al. (2024). V-STaR: Training Verifiers for Self-Taught Reasoners](https://arxiv.org/abs/2402.06457) adiciona um verificador DPO para a selecção do tempo de inferência.
- [Zelikman et al. (2024). Quiet-STaR: Language Models Can Teach Themselves to Think Before Speaking](https://arxiv.org/abs/2403.09629) rationalizações internas por token.
- [Lightman et al. (2023). Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) Modelos de recompensa de processo, o sinal de gradiente alternativo.
- [DeepSeek-R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) RL em tarefas verificáveis, STaR escalado para formação de fronteira.
