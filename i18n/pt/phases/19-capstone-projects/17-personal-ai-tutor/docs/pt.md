# Capstone 17  Personal AI Tutor (Adaptivo, Multimodal, com Memória)

> Khanmigo (A Academia Khan), Duolingo Max, Google LearnLM / Gemini para Educação, Quizlet Q-Chat e Tutor de Síntese todos enviaram tutoriais multimodal adaptativos em escala em 2026. A forma comum é uma política socrática (nunca apenas descarte a resposta), um modelo de aprendiz que atualiza após cada interação (estilo de rastreamento de conhecimento bayesiano), entrada de voz + texto + foto-matemática, recuperação de gráficos do currículo, agendamento de repetição espaçada e filtros de segurança rígidos para conteúdo adequado à idade. A pedra angular é enviar um tutor específico de assunto (algêbra K-12 ou introdução Python), executar um estudo de eficácia de duas semanas com 10 alunos e passar uma auditoria de segurança de conteúdo.

**Type:** Capstone
**Languages:** Python (backend, learner model), TypeScript (web app, learner model scaffold), SQL (curriculum graph via Postgres + Neo4j)
**Prerequisites:** Phase 5 (NLP), Phase 6 (speech), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 14 (agents), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P5 · P6 · P11 · P12 · P14 · P17 · P18
**Time:** 30 hours

## Problemas

A tutorialidade adaptativa costumava ser um nicho de pesquisa em tecnologia. Até 2026, será um produto de consumo. O Khanmigo está implantado na maioria dos distritos escolares dos EUA. O Duolingo Max atingiu dezenas de milhões de MAU. O LearnLM / Gemini para Educação do Google permite a formação em Google Classroom. O Quizlet Q-Chat fica ao lado de cartões de visualização. O Tutor da Síntese atingiu a virologia com tutores para crianças curiosas. Os elementos comuns: entrada multimodal (tipo, fala, equações fotográficas), pedagogia socrática (pergunte primeiro, explique depois), um modelo de aprendiz que se atualiza após cada interação e segurança estritamente adequada à idade.

A barra de medição é um estudo de eficácia real: pontuações pré-test e pós-test durante duas semanas com 10 alunos. O loop de voz deve sentir-se natural (capstone 03 sub-pilha). A memória deve respeitar a privacidade. O filtro de segurança deve passar a equipe vermelha consciente da COPPA para K-12.

## Conceptos

Quatro componentes.**Tutor policy**O processo de aprendizagem é um ciclo socrático: quando o aprendiz pergunta a resposta, a política faz uma pergunta principal; quando a faz bem, passa ao próximo conceito; quando está preso, oferece uma sugestão de andamento. **Learner model**é o rastreamento de conhecimento bayesiano (ou uma variante simples) que atualiza a probabilidade de domínio por nó do currículo após cada interação. **Curriculum graph**É um Neo4j de conceitos com bordas pré-requisitas; a política percorre o gráfico para escolher o próximo conceito. **Memory**é um armazém episódico + semântico (estilo de memória de agente) que retém interações, erros e preferências passadas.

A UX é multimodal. Entrada de texto para respostas digitalizadas. Entrada de voz através de LiveKit + Whisper (reutilizar pedra-chave 03). Entrada de foto para problemas matemáticos através de dots.ocr ou PaliGemma 2. saída de voz através de Cartesia Sonic-2. Segurança usa Llama Guard 4 mais um filtro adequado à idade (bloqueia conteúdo adulto, violência, auto-harm) e uma política de retenção de memória consciente da COPPA.

O estudo de eficácia é o resultado. 10 alunos, pré-test e pós-test, duas semanas. Relata o ganho de aprendizagem delta e intervalo de confiança. Comparar com uma linha de base não adaptativa (o mesmo conteúdo fornecido linearmente sem a política do tutor).

## Arquitetura

```
learner device
  |
  +-- text         -> web app
  +-- voice        -> LiveKit Agents (ASR + TTS)
  +-- photo math   -> dots.ocr / PaliGemma 2
       |
       v
  tutor policy (LangGraph)
       - Socratic decision head
       - next-concept chooser (curriculum graph walk)
       - hint scaffolder
       - mastery update
       |
       v
  learner model (BKT / item-response theory)
       - per-concept mastery probability
       - spaced-repetition scheduler (SM-2 or FSRS)
       |
       v
  memory (agentmemory-style)
       - episodic: every interaction
       - semantic: learned mistakes, preferences
       - retention policy: COPPA / GDPR aware
       |
       v
  curriculum graph (Neo4j)
       - prerequisite edges
       - OER content attached
       |
       v
  safety:
    Llama Guard 4 + age-appropriate filter
    memory access guarded by learner ID scope
```

## Estaca

- Escolha de assunto: álgebra K-12 ou introdução Python (escolha um para profundidade)
- Política de tutor: LangGraph sobre Claude Sonnet 4.7 (com cache imediato)
- Modelo de aprendiz: rastreamento do conhecimento bayesiano (clássico) ou FSRS para espaçamento
- Gráfico do currículo: Neo4j de conceitos + limites pré-requisitos + conteúdo do RER
- Memória: agenteVetor persistente de memória + episódico + armazenamento semântico
- Voz: LiveKit Agents 1.0 + Cartesia Sonic-2 (sub-pilha de pedra final 03 reutilização)
- Matemática fotográfica: dots.ocr ou PaliGemma 2 para reconhecimento de equações
- Segurança: Llama Guard 4 + filtro adaptado à idade
- Eval: geração de perguntas de nível de florescimento, uso de ensaio pré-/pós-exame, ferramentas de estudo de eficácia

```figure
cf-tutor-loop
```

## Construí-lo

1. **Curriculum graph.**Construir um Neo4j de 50-150 nós conceitual (por exemplo, álgebra K-12 de "linha de números" para "formula quadrática") com bordas pré-requisitas. Anexe o conteúdo OER por nó (Open Textbook, OpenStax).

2. **Learner model.**Iniciar o rastreamento do conhecimento bayesiano com antecedentes: adivinha, deslize, taxa de aprendizagem. Atualizar o domínio por conceito após cada interação. Persistir por aprendiz.

3. **Tutor policy.**LangGraph com nós: `read_signal`(a resposta do aluno foi correta / parcial / obstruída?), `select_concept`(grafico de currículo de caminhada escolhendo o conceito de maior prioridade), `scaffold`(Proposta de Socrate),`update_mastery`- Não .

4. **Memory.**Cada interação escreve para uma loja episódica. erros e preferências promovem a memória semântica. Política de retenção consciente da COPPA: auto-eliminação após 1 ano, acessível aos pais.

5. **Voice path.**Trabalhador do LiveKit Agents ligado à política de tutor. ASR via Whisper-v3-turbo. TTS via Cartesia Sonic-2. Barge-in suportado (mecânica de reutilização de capstone 03).

6. **Photo-math path.**Carregar ou capturar imagem; executar dots.ocr ou PaliGemma 2 para reconhecer a equação; alimentar o tutor como entrada estruturada.

7. **Safety.**Cada saída do modelo passa por Llama Guard 4 + um filtro adequado à idade (bloqueia auto-lesionamento, conteúdo adulto, violência). Acesso à memória escopoado pelo ID do aprendiz; superfície de acesso dos pais para exclusão.

8. **Efficacy study.**10 alunos, pré-test (base de 30 perguntas padronizada), duas semanas de interação com os tutores (3 sessões/semana), pós-test.

9. **Weekly progress reports.**Por aprendiz, gerar automaticamente um resumo PDF dos tópicos explorados, as trajetórias de domínio e os próximos passos recomendados.

## Usá-lo

```
learner: "I don't understand why 3x + 6 = 12 means x = 2"
[signal]   stuck
[concept]  'isolating variables' (prerequisite: addition-subtraction-equality)
[scaffold] "what number would you subtract from both sides to start?"
learner: "6"
[signal]   correct
[mastery]  addition-subtraction-equality: 0.62 -> 0.77
[concept]  continue 'isolating variables'
[scaffold] "great. now what is 3x / 3 equal to?"
```

## Envia-o

`outputs/skill-ai-tutor.md`Um tutor adaptativo específico de assunto com entrada multimodal, um modelo de aprendizagem, memória, segurança e eficácia medida.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Learning gain delta | Pre/post-test delta in a 10-learner two-week study |
| 20 | Socratic fidelity | Rubric score on transcript samples |
| 20 | Multimodal UX | Voice + photo + text coherence end to end |
| 20 | Safety + privacy posture | Llama Guard 4 pass rate + COPPA-aware retention |
| 15 | Curriculum breadth and graph quality | Concept coverage + prerequisite graph consistency |
| **100** | | |

## Exercícios

1. Execute o estudo de eficácia com e sem o modelo adaptativo de aprendizagem (ordem aleatório de conceitos).

2. Adicione uma sonda multimodal: a mesma pergunta conceitual entregue como texto, voz e foto.

3. Construir um painel de controle principal: tópicos praticados, trajetórias de domínio, conceitos futuros, eventos de segurança (qualquer acidente de guarda).

4. Adicione um modo de comutação de idioma: o tutor aceita a entrada em espanhol e ensina em espanhol.

5. Enfatizar a privacidade da memória: verificar que o aprendiz A não pode ver os dados do aprendiz B mesmo através de um ataque de re-ingestão de vídeo de voz.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Socratic policy | "Ask, do not dump" | Tutor asks a leading question rather than giving the answer |
| Bayesian knowledge tracing | "BKT" | Classic learner-model equations for mastery probability per concept |
| FSRS | "Free Spaced Repetition Scheduler" | 2024 spaced-repetition scheduler, better than SM-2 |
| Curriculum graph | "Concept DAG" | Neo4j of concepts with prerequisite edges |
| Episodic memory | "Per-interaction log" | Every interaction stored for later retrieval |
| Semantic memory | "Learned pattern store" | Compacted mistakes and preferences promoted from episodic |
| COPPA | "Kids privacy law" | US law restricting data collection from children under 13 |

## Mais leitura

- [Khanmigo (Khan Academy)](https://www.khanmigo.ai) tutor de referência de consumo K-12
- [Duolingo Max](https://blog.duolingo.com/duolingo-max/) tutor de referência para aprendizagem de línguas
- [Google LearnLM / Gemini for Education](https://blog.google/products-and-platforms/products/education/google-learnlm-gemini-generative-ai/) modelo de referência hospedado
- [Quizlet Q-Chat](https://quizlet.com) Referência alternativa
- [Synthesis Tutor](https://www.synthesis.com) Referência de inicialização
- [FSRS algorithm](https://github.com/open-spaced-repetition/fsrs4anki) Programação de repetições espaçadas
- [Bayesian Knowledge Tracing](https://en.wikipedia.org/wiki/Bayesian_knowledge_tracing) modelo de aprendiz clássico
- [LiveKit Agents](https://github.com/livekit/agents) Estaca de voz
