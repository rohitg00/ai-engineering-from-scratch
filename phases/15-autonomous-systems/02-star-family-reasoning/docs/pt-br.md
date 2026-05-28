# STaR, V-STaR, Quiet-STaR — Raciocínio Auto-Ensinado

> O menor loop de auto-aprimoramento possível vive dentro da racionalização. Um modelo gera uma cadeia de raciocínio, mantém as que acertam a resposta correta e faz fine-tuning nelas. Esse é o STaR. V-STaR adiciona um verificador para que a seleção em tempo de inferência seja melhor. Quiet-STaR empurra a racionalização para cada token. Os três funcionam. Nenhum deles é mágia — o loop preserva qualquer atalho que por acaso chegou à resposta certa.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, simulador de loop de bootstrap)
**Pré-requisitos:** Fase 13 · 01-03 (Raciocínio e CoT), Fase 15 · 01 (enquadramento de longo prazo)
**Tempo:** ~60 minutos

## O Problema

A maneira direta de ensinar um modelo a raciocinar é coletar rastros de raciocínio escritos por humanos. Isso é caro, lento e limitado pela quantidade de cadeia de raciocínio de alta qualidade que humanos estão dispostos a escrever.

STaR (Self-Taught Reasoner, Zelikman et al., 2022) pergunta: e se o modelo escrevesse suas próprias racionalizações e as avaliasse contra respostas conhecidas? O loop é:

1. Amostra um raciocínio mais resposta.
2. Se a resposta final estiver correta, mantém o raciocínio.
3. Faz fine-tuning nos raciocínios mantidos.
4. Repete.

Funciona. GSM8K e CommonsenseQA melhoraram sem nova anotação humana. Mas o loop tem um viés embutido: qualquer racionalização que produziu a resposta certa é retida, independentemente de o raciocínio em si ter sido lógico. V-STaR (Hosseini et al., 2024) corrige isso com um verificador treinado; Quiet-STaR (Zelikman et al., 2024) generaliza a ideia para racionalizações internas por token.

## O Conceito

### STaR: bootstrap no que funcionou

Comece com um modelo base com alguma capacidade fraca de raciocínio. Para cada problema de treinamento, amostra uma racionalização mais resposta. Se a resposta bater com o label, mantém a tripla (problema, racionalização, resposta). Faça fine-tuning no conjunto mantido. Repete.

Uma peculiaridade importa. Se o modelo nunca acerta um problema, o loop não consegue aprender nele. STaR adiciona **racionalização**: para problemas em que o modelo falha, injeta a resposta correta como dica e reprompta o modelo para produzir uma racionalização que leve a ela. Racionalizações racionalizadas são adicionadas ao conjunto de treinamento.

Resultado no paper original (Zelikman et al., 2022): um modelo base GPT-J melhorou de 5.8% para 10.7% no GSM8K através de rodadas repetidas de STaR com racionalização — cerca de 5 pontos percentuais absolutos. No CommonsenseQA, o GPT-J 6B treinado com STaR alcançou 72.5%, comparável ao GPT-3 175B fine-tunado (~73%) — um modelo aproximadamente 30x maior treinado em racionalizações anotadas à mão.

### V-STaR: treine um verificador com DPO

STaR descarta racionalizações incorretas. Hosseini et al. (2024) observaram que essas também são dados: cada par de (racionalização, "está correto") pode treinar um verificador. Eles usam Direct Preference Optimization sobre soluções corretas e incorretas para construir um ranqueador. Em tempo de inferência, amostra N racionalizações e escolhe a melhor do verificador.

Delta reportado: +4 a +17 pontos percentuais sobre baselines anteriores de auto-aprimoramento no GSM8K e MATH, com a maior parte do ganho vindo de usar o verificador para seleção em tempo de inferência ao invés de fine-tuning adicional do gerador.

### Quiet-STaR: racionalizações internas por token

Zelikman et al. (2024) perguntaram: e se o modelo aprendesse a gerar uma racionalização curta interna em cada posição de token, não apenas entre problema e resposta? Quiet-STaR treina um modelo para emitir um "pensamento" oculto antes de cada token previsto, e então mistura a previsão consciente do pensamento com a previsão base através de um peso aprendido.

Resultado: o Mistral 7B ganhou melhorias absolutas zero-shot no GSM8K de 5.9% para 10.9% e no CommonsenseQA de 36.3% para 47.2% sem fine-tuning específico para a tarefa. O modelo aprendeu "quando pensar" — tokens difíceis recebem racionalizações internas mais longas; fáceis recebem quase nenhuma.

### Por que os três compartilham uma preocupação de segurança

Os três métodos usam a resposta final como sinal de gradiente. Uma racionalização que chega à resposta certa através de raciocínio falho — explorando um atalho, chutando ou usando um padrão não-generalizável — é reforçada positivamente. Em problemas in-distribution o atalho funciona. Em problemas out-of-distribution ele falha silenciosamente.

O verificador do V-STaR mitiga ao aprender a ranquear racionalizações, mas o verificador é treinado no mesmo conjunto de labels. Ele pode aprender a preferir raciocínio mal-formulado mas bem-formatado sobre incerteza honesta. O design mais seguro é combinar dados no estilo STaR com (a) process reward models (reward em etapas intermediárias, não apenas respostas) e (b) avaliação OOD separada que quebra atalhos simples.

### Comparação

| Método | Sinal de treinamento | Custo de inferência | Desperdício de dados | Modo de falha conhecido |
|---|---|---|---|---|
| STaR | mantém (racionalização, resposta) se correto | 1x | descarta todas as racionalizações incorretas | racionalizações de atalho |
| STaR + racionalização | acima + retries com resposta correta como dica | 1x | menos | racionalizações racionalizadas podem ser implausíveis |
| V-STaR | STaR + verificador DPO de ambas as classes | Nx (best-of-N) | mínimo | verificador pode reforçar confiança errada |
| Quiet-STaR | racionalização por token + peso de mistura | 1.5-3x | mínimo | ainda gradiente condicionado à resposta |

### Onde isso se encaixa na stack de 2026

STaR é antigo. Mas o padrão reaparece em toda parte em 2025-2026. RL em problemas de matemática verificáveis (DeepSeek-R1, Kimi-k1.5, o1) é o sinal de gradiente condicionado à resposta do STaR, escalado. Process reward models (Lightman et al., 2023; "Let's verify step by step" da OpenAI) são a alternativa supervisionada por processo. AlphaEvolve (Aula 3) é STaR para código, com um avaliador de programa no lugar de um label. Darwin Godel Machine (Aula 4) é STaR para a estrutura do próprio agent.

Entender STaR faz tudo isso clicar. É o loop de auto-aprimoramento mínimo-viável.

## Use

`code/main.py` roda um loop STaR simulado em uma tarefa de aritmética de brinquedo. Você pode observar:

- Como a acurácia sobe ao longo de rodadas de bootstrap.
- Como atalhos se infiltram: o simulador inclui uma classe de racionalização "preguiçosa" que acerta a resposta certa 40% das vezes mas generaliza mal. Observe se o STaR mantém essas.
- Como um verificador (no estilo V-STaR) ajuda na inferência mas não consegue podar completamente os atalhos introduzidos durante o treinamento.

## Entregue

`outputs/skill-star-loop-reviewer.md` ajuda a auditar um pipeline proposto de raciocínio auto-ensinado antes de treinar nele.

## Exercícios

1. Rode o simulador. Defina a frequência de atalhos como zero e depois como 0.4. Quanto a acurácia final diverge entre as duas execuções, mesmo que ambas atinjam >90% na distribuição de treinamento?

2. Adicione um teste OOD separado ao simulador. Extraia problemas de uma distribuição diferente e avalie o modelo bootstrapped em ambos os conjuntos, in-distribution e OOD. Quantifique a lacuna.

3. Leia o paper Quiet-STaR (arXiv:2403.09629) Seção 3. Explique o token "end-of-thought" e o mixing-weight head em três frases cada.

4. Compare o filtro keep-if-correct do STaR com uma alternativa supervisionada por processo que recompensa cada passo da racionalização independentemente. Identifique a diferença de custo de anotação e a diferença de qualidade plausível.

5. Projete uma avaliação que pegasse racionalizações de atalho em um modelo em deploy. Não precisa ser perfeita — precisa quebrar os atalhos mais simples que um loop STaR reforçaria.

## Termos-Chave

| Termo | O que dizem | O que significa de verdade |
|---|---|---|
| STaR | "Self-Taught Reasoner" | Fine-tuning em racionalizações geradas pelo modelo que chegam a respostas corretas; repetir |
| Racionalização | "Retry com dica" | Injetar a resposta correta e repromptar para uma racionalização em problemas em que o modelo base falha |
| V-STaR | "Verifier STaR" | Treinar um verificador com DPO em racionalizações corretas e incorretas, usar para seleção em tempo de inferência |
| Quiet-STaR | "Racionalizações por token" | Gerar pensamentos ocultos em cada posição de token; misturar com a previsão base |
| Answer-conditioned gradient | "Sinal baseado em resultado" | O loop de treinamento recompensa respostas finais, não passos de raciocínio |
| Process reward model | "Verificador por passo" | Reward model treinado em correção por passo, não em resultado — contraposto ao STaR |
| Racionalização de atalho | "Resposta certa, raciocínio errado" | Uma racionalização que chega ao label através de um padrão não-generalizável; STaR mantém essas |

## Leituras Adicionais

- [Zelikman et al. (2022). STaR: Bootstrapping Reasoning With Reasoning](https://arxiv.org/abs/2203.14465) — o paper original.
- [Hosseini et al. (2024). V-STaR: Training Verifiers for Self-Taught Reasoners](https://arxiv.org/abs/2402.06457) — adiciona um verificador DPO para seleção em tempo de inferência.
- [Zelikman et al. (2024). Quiet-STaR: Language Models Can Teach Themselves to Think Before Speaking](https://arxiv.org/abs/2403.09629) — racionalizações internas por token.
- [Lightman et al. (2023). Let's Verify Step by Step](https://arxiv.org/abs/2305.20050) — process reward models, o sinal de gradiente alternativo.
- [DeepSeek-R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) — RL em tarefas verificáveis, STaR escalado para treinamento de fronteira.
