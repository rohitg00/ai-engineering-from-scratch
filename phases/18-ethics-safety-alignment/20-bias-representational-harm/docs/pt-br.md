# Bias e Dano Representacional em LLMs

> Gallegos, Rossi, Barrow, Tanjim, Kim, Dernoncourt, Yu, Zhang, Ahmed (Computational Linguistics 2024, arXiv:2309.00770). Survey canônico de 2024 distinguindo danos representacionais (estereótipos, apagamento) de danos alocacionais (distribuição desigual de recursos) e categorizando métricas de avaliação como baseadas em embeddings, baseadas em probabilidade ou baseadas em texto gerado. Dados empíricos 2024-2025: An et al. (PNAS Nexus, março de 2025) medem bias interseccional gênero x raça em GPT-3.5 Turbo, GPT-4o, Gemini 1.5 Flash, Claude 3.5 Sonnet, Llama 3-70B em avaliação automatizada de currículo para 20 vagas de nível inicial. WinoIdentity (COLM 2025, arXiv:2508.07111) introduz avaliação de justiça baseada em incerteza para identidades interseccionais. Yu & Ananiadou 2025 identificam neurônios de gênero em camadas MLP; Ahsan & Wallace 2025 usam SAEs para revelar bias racial clínico; Zhou et al. 2024 (UniBias) manipula heads de attention para debiasing. Meta-crítica (arXiv:2508.11067): 10 anos de literatura focam desproporcionalmente em bias de gênero binário.

**Tipo:** Construir
**Linguagens:** Python (stdlib, sonda de bias simulada baseada em embeddings)
**Pré-requisitos:** Fase 05 (word embeddings), Fase 18 · 01 (seguimento de instruções)
**Tempo:** ~60 minutos

## Objetivos de Aprendizagem

- Definir dano representacional vs alocacional e dar um exemplo de cada em um deployment de LLM.
- Nomear as três categorias de métrica de avaliação de Gallegos et al. 2024 e descrever uma métrica de cada.
- Descrever interseccionalidade e por que a medição de justiça baseada em incerteza do WinoIdentity aborda gaps em avaliação de bias de eixo único.
- Descrever duas abordagens de interpretabilidade mecanística para bias (neurônios de gênero, características SAE, manipulação de heads de attention).

## O Problemo

Lições anteriores cobrem dano deliberado (jailbreaks, esquema) e governança de segurança. Bias é dano que emerge sem intenção — de distribuições de dados de treino, de enquadramento de prompts, de escolhas de design acumuladas. Medir e reduzir isso é um desafio metodológico distinto da robustez adversarial.

## O Conceito

### Representacional vs alocacional

- **Dano representacional.** Estereótipos, apagamento, retratos degradantes. Um LLM que retrata enfermeiras exclusivamente como femininas está produzindo dano representacional.
- **Dano alocacional.** Resultados materiais desiguais. Um LLM que pontua currículos de pretos sistematicamente mais baixo está produzindo dano alocacional.

Não são a mesma coisa. Um modelo pode ser "representacionalmente imparcial" (produz retratos diversos) sendo "alocacionalmente enviesado" (faz recomendações desiguais). Avaliações precisam medir os dois.

### Três categorias de métrica (Gallegos et al. 2024)

- **Baseadas em embeddings.** Testos estilo WEAT em embeddings pré-RLHF. Medem associações estatísticas entre termos de identidade e termos de atributo. Limitações: mede a representação, não o comportamento.
- **Baseadas em probabilidade.** Log-likelihood de completões que confirmam vs violam estereótipos. Medição no lado do decoder. Captura algum bias comportamental.
- **Baseadas em texto gerado.** Medição em tarefas downstream sobre texto gerado. Pontuação de currículos, escrita de recomendações, diálogo. Mais validade ecológica; mais difícil de reproduzir.

### Interseccionalidade

Avaliação de bias em "gênero" ignora o bias que só dispara em pares (gênero, raça). An et al. 2025 encontram que GPT-4o penaliza mulheres pretas em pontuação de currículo mais que homens pretos e mais que mulheres brancas separadamente. Avaliação de eixo único não consegue capturar isso.

WinoIdentity (COLM 2025) introduz justiça interseccional baseada em incerteza. Mede se a incerteza do modelo sobre resultados difere entre tuplas de identidade interseccional — não apenas a predição pontual. Isso pega casos onde o modelo está igualmente errado entre grupos mas mais incerto para alguns, o que produz comportamento de alocação downstream diferente.

### Abordagens mecanísticas

Trabalho de interpretabilidade 2024-2025 abre bias para intervenção mecanística:

- **Neurônios de gênero (Yu & Ananiadou 2025).** Neurônios MLP específicos se correlacionam com comportamentos específicos de gênero. Ablação desses neurônios reduz métricas de gap de gênero com custo limitado de capacidade.
- **Bias racial clínico via SAEs (Ahsan & Wallace 2025).** Características de sparse autoencoder decompõem a representação interna em dimensões interpretáveis; características correlacionadas com raça podem ser identificadas e suprimidas.
- **UniBias (Zhou et al. 2024).** Manipulação de heads de attention para debiasing zero-shot. Heads específicas amplificam sensibilidade de classe de identidade; zerar ou re-pesar essas heads reduz bias sem fine-tuning.

### A meta-crítica

A revisão de 10 anos de literatura (arXiv:2508.11067, 2025) encontra que o campo foca desproporcionalmente em bias de gênero binário. Outros eixos — deficiência, religião, status migratório, identidade multilíngue — recebem muito menos atenção. A meta-crítica argumenta que foco estreito pode prejudicar grupos marginalizados por negligência: um modelo bem-desenviesado em gênero binário pode ter bias ruim em dimensões que ninguém verificou.

### Onde isso se encaixa na Fase 18

Lições 20-21 cobrem bias e justiça formalmente. Lição 22 cobre privacidade. Lição 23 cobre marcação d'água. Essas são a camada de dano ao usuário complementando a camada anterior de engano/segurança.

## Use

`code/main.py` constrói uma sonda de bias simulada baseada em embeddings: mede distância estilo WEAT entre termos de identidade e termos de atributo em um embedding simples de co-ocorrência. Você pode injetar um bias e observar a métrica disparar; aplicar uma operação simples de debiasing e observar recuperação parcial.

## Entregue

Essa lição gera `outputs/skill-bias-eval.md`. Dado um model card ou afirmação de justiça, audita a avaliação nas três categorias de métrica (embedding, probabilidade, texto gerado), a cobertura de interseccionalidade, e o mecanismo de qualquer intervenção de debiasing.

## Exercícios

1. Execute `code/main.py`. Reporte scores de bias estilo WEAT antes e depois do passo de debiasing. Explique por que a métrica não cai a zero.

2. Estenda a sonda com um teste interseccional: (gênero, raça) x (carreira, família). Reporte scores de bias cross-eixo.

3. Leia An et al. 2025 (PNAS Nexus). Identifique os dois efeitos interseccionais que eles reportam que uma avaliação de gênero de eixo único perderia.

4. Yu & Ananiadou 2025 identificam neurônios de gênero. Esboce um experimento de falsificação que distinguiria "esses neurônios causam bias de gênero" de "esses neurônios se correlacionam com bias de gênero."

5. A meta-crítica argumenta que o campo foca muito estreitamente em gênero binário. Escolha um eixo sub-estudado e descreva um protocolo de medição de dano representacional para ele.

## Termos-Chave

| Termo | O que dizem | O que realmente significa |
|-------|-------------|---------------------------|
| Dano representacional | "estereótipos / apagamento" | Retrato enviesado de um grupo |
| Dano alocacional | "decisões desiguais" | Resultado material enviesado para um grupo |
| WEAT | "o teste de embedding" | Word Embedding Association Test; sonda de bias baseada em co-ocorrência |
| Interseccionalidade | "efeitos de identidade combinados" | Bias que emerge na interseção de múltiplos eixos de identidade |
| Neurônios de gênero | "neurônios de bias MLP" | Neurônios específicos cujas ativações se correlacionam com comportamento específico de gênero |
| Característica SAE | "dimensão interpretável" | Característica identificada por sparse autoencoder; útil para análise mecanística de bias |
| UniBias | "debiasing por head de attention" | Debiasing zero-shot por repesagem de heads de attention |

## Leitura Complementar

- [Gallegos et al. — Bias and Fairness in LLMs: A Survey (arXiv:2309.00770, Computational Linguistics 2024)](https://arxiv.org/abs/2309.00770) — survey canônico
- [An et al. — Intersectional resume-evaluation bias (PNAS Nexus, março de 2025)](https://academic.oup.com/pnasnexus/article/4/3/pgaf089/8111343) — estudo interseccional em cinco modelos
- [WinoIdentity — uncertainty-based intersectional fairness (arXiv:2508.07111, COLM 2025)](https://arxiv.org/abs/2508.07111) — novo benchmark
- [UniBias — attention-head manipulation (Zhou et al. 2024, ACL)](https://arxiv.org/abs/2405.20612) — debiasing zero-shot
