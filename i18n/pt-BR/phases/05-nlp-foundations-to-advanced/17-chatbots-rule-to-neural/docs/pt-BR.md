# Chatbots  Regras baseadas em Neural para LLM Agentes

> Ela respondeu com padrões de correspondência. DialogFlow mapeou intenções. GPT respondeu a partir de pesos. Claude corre ferramentas e verifica. Cada era resolveu o pior fracasso do anterior.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 14 (Information Retrieval)
**Time:** ~75 minutes

## O problema

Um usuário diz "Quero mudar meu voo". O sistema tem que descobrir o que eles querem, que informações faltam, como obtê-las e como concluir a ação.

A conversação é difícil para um sistema ML. A entrada é aberta. A saída tem que ser coerente em muitas viradas. O sistema pode precisar agir no mundo (mudar um voo, carregar um cartão). Cada passo errado é visível para o usuário.

As arquiteturas de chatbot têm ciclizado através de quatro paradigmas, cada um introduzido porque o anterior falhou de forma visível. Esta lição os acompanha em ordem.

## O conceito

![Chatbot evolution: rule-based → retrieval → neural → agent](../assets/chatbot.svg)

### O meio século escrito, 1950-2001

O primeiro paradigma não durou cinco anos. Durou cinquenta. Saber seu arco importa porque cada sistema nele é a mesma máquina  entrada de correspondência, emitir uma resposta emlatada, atualizar um pequeno estado  e cinquenta anos de adição de regras a essa máquina nunca produziram o caso geral. Esse teto é por que paradigmas de dois a quatro existem.

**1950.**Turing evita "as máquinas podem pensar?" propondo uma substituição operacional: se um interrogador não pode distinguir a máquina de uma pessoa através de um teletipo, a questão filosófica é discutida. A conversa se torna o ponto de referência do campo antes que o campo tenha um nome.

**1956.**O nome chega a um workshop de verão em Dartmouth, onde se faz uma "inteligência artificial" na conjectura de que cada característica da inteligência "pode ser descrita com tanta precisão que uma máquina possa ser feita para simula-la".

**1966.**ELIZA envia o truque de reflexão que você constrói no Passo 1: regras de decomposição puxar fragmentos da entrada, regras de reensamblagem ecoá-los como perguntas. Cerca de 200 padrões total, estado zero, zero compreensão  e os usuários confiaram nele de qualquer maneira. Weizenbaum passou o resto de sua carreira alarmado com quão pouca maquinaria que levou.

**1972.**PARRY, construído em Stanford para modelar a paranóia, acrescenta a peça que a ELIZA não tinha: o estado interno. As variáveis numéricas para medo, raiva e desconfiança atualizam-se em cada virada e porta que o script dispara a seguir, por isso, entradas idênticas produzem respostas diferentes dependendo da conversa até agora. Num teste de transcrição cego, os psiquiatras distinguiram o PARRY dos pacientes humanos por acaso. É o antepassado direto do condicionamento de personalidade, um sistema de prompt implementado como três flutuantes. No mesmo ano, os dois bots foram apontados um para o outro através da ARPANET: um script de terapeuta entrevistando uma máquina de estado de paranoia, a primeira conversa bot-to-bot em uma rede.

**1995.**A Alice escalou a receita ELIZA com AIML, um dialeto XML para pares de padrões-template. Cerca de 40.000 categorias escritas à mão, três vencedores do Prêmio Loebner.

**2001.**O SmarterChild coloca a receita na frente de 30 milhões de usuários de mensagens instantâneas e adiciona buscas de fundo  tempo, ações, horários de filmes  entrelaçadas em modelos.

O paradigma acabou não porque alguém o refutou mas porque o custo de manutenção das máquinas de estado escritas à mão cresce linearmente com a cobertura enquanto as expectativas dos usuários crescem com o que viram na semana passada.

```figure
chatbot-lineage
```

**Rule-based (ELIZA, AIML, DialogFlow).**Os padrões de escrita manual correspondem às entradas do usuário e produzem respostas. Os classificadores de intenções encaminham-se para fluxos predefinidos. As máquinas de preenchimento de slot coletam informações necessárias. Funciona brilhantemente dentro do escopo estreito para o qual foi projetado. Falha imediatamente fora dele. Ainda navega em domínios críticos à segurança (autenticação bancária, reserva de companhias aéreas) onde a alucinação não é tolerada.

**Retrieval-based.**Um sistema de estilo FAQ. Encode cada par de (expresso, resposta). No tempo de execução, codifique a mensagem do usuário e recupere a resposta armazenada mais próxima. Pense no clássico recurso de "artigois semelhantes" da Zendesk.

**Neural (seq2seq).**Encoder-decoder treinado em registros de conversação. Gera respostas a partir do zero. Fluente, mas propenso a saídas genéricas ("não sei") e derivação factual. Nunca confiável sobre o tópico. A razão é que Google, Facebook e Microsoft tiveram chatbots decepcionantes em 2016-2019.

**LLM agents.**Um modelo de linguagem envolto em um loop que planeja, chama ferramentas e verifica resultados. Não é um chatbot com um prompt longo. Um loop de agente: planejar → chamar ferramenta → observar resultado → decidir o próximo passo. Retrieval-first grounding (RAG) impede que ele alucine. chamadas de ferramenta deixam que ele realmente faça as coisas. Esta é a arquitetura de 2026.

Os quatro paradigmas não são substituições sequenciais. Um chatbot de produção 2026 percorre os quatro: baseado em regras para autenticação e ações destrutivas, recuperação para FAQ, geração neural para fraseamento natural, agente LLM para consultas abertas ambíguas.

## Construí-lo

### Passo 1: correspondência de padrões baseada em regras

```python
import re


class RulePattern:
    def __init__(self, pattern, response_template):
        self.regex = re.compile(pattern, re.IGNORECASE)
        self.template = response_template


PATTERNS = [
    RulePattern(r"my name is (\w+)", "Nice to meet you, {0}."),
    RulePattern(r"i (need|want) (.+)", "Why do you {0} {1}?"),
    RulePattern(r"i feel (.+)", "Why do you feel {0}?"),
    RulePattern(r"(.*)", "Tell me more about that."),
]


def rule_based_respond(user_input):
    for pattern in PATTERNS:
        m = pattern.regex.match(user_input.strip())
        if m:
            return pattern.template.format(*m.groups())
    return "I don't understand."
```

ELIZA em 20 linhas. O truque de reflexão ("Eu me sinto triste" → "Por que você se sente triste") é a demonstração canônica do psicoterapeuta de Weizenbaum de 1966.

### Passo 2: baseado em recuperação (FAQ)

Este trecho ilustrativo requer`pip install sentence-transformers`O corretor.`code/main.py`para esta lição usa uma semelhança de Jaccard stdlib em vez disso, então a lição funciona sem dependências externas.

```python
from sentence_transformers import SentenceTransformer
import numpy as np


FAQ = [
    ("how do i reset my password", "Go to Settings > Security > Reset Password."),
    ("how do i cancel my order", "Go to Orders, find the order, click Cancel."),
    ("what is your return policy", "30-day returns on unused items, original packaging."),
]


encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
faq_questions = [q for q, _ in FAQ]
faq_embeddings = encoder.encode(faq_questions, normalize_embeddings=True)


def faq_respond(user_input, threshold=0.5):
    q_emb = encoder.encode([user_input], normalize_embeddings=True)[0]
    sims = faq_embeddings @ q_emb
    best = int(np.argmax(sims))
    if sims[best] < threshold:
        return None
    return FAQ[best][1]
```

A recusa baseada em limiares é a escolha chave de design.`None`E deixem o sistema escalar.

### Passo 3: geração neural (linha de base)

Use um pequeno codificador-decodificador com sintonia de instruções (FLAN-T5) ou um modelo de conversação com sintonia fina. Produção-inutile por si só em 2026 (contradição, deriva fora do tópico, absurdo factual), mas embarca dentro de sistemas híbridos para fraseamento natural. Os modelos de decodificação apenas no estilo DialoGPT precisam de separadores de viradas explícitos e de manuseio de EOS para produzir respostas coerentes; um modelo de texto FLAN-T5 funciona fora da caixa para um exemplo de ensino.

```python
from transformers import pipeline

chatbot = pipeline("text2text-generation", model="google/flan-t5-small")

response = chatbot("Respond politely to: Hi there!", max_new_tokens=40)
print(response[0]["generated_text"])
```

### Passo 4: Loop de agente LLM

Forma de produção de 2026:

```python
def agent_loop(user_message, tools, llm, max_steps=5):
    history = [{"role": "user", "content": user_message}]
    for _ in range(max_steps):
        response = llm(history, tools=tools)
        tool_call = response.get("tool_call")
        if tool_call:
            tool_name = tool_call.get("name")
            args = tool_call.get("arguments")
            if not isinstance(tool_name, str) or tool_name not in tools:
                history.append({"role": "assistant", "tool_call": tool_call})
                history.append({"role": "tool", "name": str(tool_name), "content": f"error: unknown tool {tool_name!r}"})
                continue
            if not isinstance(args, dict):
                history.append({"role": "assistant", "tool_call": tool_call})
                history.append({"role": "tool", "name": tool_name, "content": f"error: arguments must be a dict, got {type(args).__name__}"})
                continue
            fn = tools[tool_name]
            result = fn(**args)
            history.append({"role": "assistant", "tool_call": tool_call})
            history.append({"role": "tool", "name": tool_name, "content": result})
        else:
            return response["content"]
    return "I could not complete the task in the step budget."
```

As ferramentas são funções chamáveis que o LLM pode invocar. O ciclo termina quando o LLM retorna uma resposta final em vez de uma chamada de ferramenta. O orçamento de passo evita loops infinitos em tarefas ambíguas.

A produção real adiciona: a primeira colocação em terra de recuperação (injectar documentos relevantes antes de cada chamada de LLM), barris (recusar ações destrutivas sem confirmação), observabilidade (logar cada passo) e avaliações (controlas automatizadas de que o comportamento do agente permanece em conformidade com as especificações).

### Passo 5: encaminhamento híbrido

```python
def hybrid_chat(user_input):
    if is_destructive_action(user_input):
        return structured_flow(user_input)

    faq_answer = faq_respond(user_input, threshold=0.6)
    if faq_answer:
        return faq_answer

    return agent_loop(user_input, tools, llm)


def is_destructive_action(text):
    danger_words = ["delete", "cancel", "charge", "refund", "transfer"]
    return any(w in text.lower() for w in danger_words)
```

O padrão: regras deterministas para qualquer coisa destrutiva, recuperação para FAQs em lata, agentes LLM para tudo o mais.

## Usá-lo

A pilha de 2026:

| Use case | Architecture |
|---------|---------------|
| Booking, payment, authentication | Rule-based state machines + slot filling |
| Customer support FAQs | Retrieval over curated answers |
| Open-ended help chat | LLM agent with RAG + tool calls |
| Internal tools / IDE assistants | LLM agent with tool calls (search, read, write) |
| Companion / character chatbots | Tuned LLM with persona system prompt, retrieval on knowledge |

Sempre use roteamento híbrido na produção. Nenhuma arquitetura única lida bem com cada solicitação. A camada de roteamento em si é tipicamente um pequeno classificador de intenções.

## Modos de falha que ainda enviam

- **Confident fabrication.**A redução: verificar os resultados, registar as chamadas de ferramentas, nunca deixar o LLM afirmar ter feito algo sem uma devolução bem-sucedida da ferramenta.
- **Prompt injection.**O usuário inserir texto que excede o sistema de solicitação. LLM01 classificado no OWASP Top 10 para LLM Aplicações 2025. Dois sabores: injeção direta (pesteado no chat) e injeção indireta (oculto em documentos, e-mails ou ferramentas de saída que o agente lê).

  As taxas de ataque variam de acordo com o cenário. As taxas de sucesso medidas variam entre 0,5-8,5% em modelos de fronteira em referência geral de utilização de ferramentas e codificação. As configurações específicas de alto risco (ataques adaptativos contra agentes de codificação de IA, orquestração vulnerável) atingiram ~84%. Os CVEs de produção incluem EchoLeak (CVE-2025-32711, CVSS 9.3)  uma falha de exfiltração de dados com clicar zero no Microsoft 365 Copilot desencadeada por um e-mail controlado pelo atacante.

  Mitigações: tratar a entrada do usuário como não confiável ao longo do loop; desinfeccionar antes das chamadas de ferramenta; isolar as saídas da ferramenta do prompt principal; usar o padrão Plan-Verificar-Executar (PVE) onde o agente planeja primeiro, depois verifica cada ação contra esse plano antes de executar (isso impede resultados da ferramenta de injetar novas ações não planejadas); exigir confirmação do usuário para ações destrutivas; aplicar menos privilégios aos escopo de ferramenta.

  Não há uma quantidade de engenharia rápida que elimine completamente esse risco.
- **Scope creep.**O agente sai da tarefa porque uma chamada de ferramenta retornou informações tangencialmente relacionadas. Mitigation: contratos de ferramentas estreitos; manter o sistema imediatamente focado; adicionar avaliações para taxa de fora da tarefa.
- **Infinite loops.**A redução do orçamento, a dedução da chamada, o juiz de LLM sobre "estamos a fazer progressos".
- **Context window exhaustion.**As conversas longas empurram as primeiras voltas para fora do contexto.

## Envia-o

Salva como`outputs/skill-chatbot-architect.md`- Não .

```markdown
---
name: chatbot-architect
description: Design a chatbot stack for a given use case.
version: 1.0.0
phase: 5
lesson: 17
tags: [nlp, agents, chatbot]
---

Given a product context (user need, compliance constraints, available tools, data volume), output:

1. Architecture. Rule-based, retrieval, neural, LLM agent, or hybrid (specify which paths go where).
2. LLM choice if applicable. Name the model family (Claude, GPT-4, Llama-3.1, Mixtral). Match to tool-use quality and cost.
3. Grounding strategy. RAG sources, retrieval method (see lesson 14), tool contracts.
4. Evaluation plan. Task success rate, tool-call correctness, off-task rate, hallucination rate on held-out dialogs.

Refuse to recommend a pure-LLM agent for any destructive action (payments, account deletion, data modification) without a structured confirmation flow. Refuse to skip the prompt-injection audit if the agent has write access to anything.
```

## Exercícios

1. **Easy.**Implementar a resposta baseada em regras acima com 10 padrões para um bot de encomenda de cafeteria.
2. **Medium.**Construir uma FAQ híbrida + fallback LLM. 50 entradas de FAQ em lata para um produto SaaS, fallback LLM com recuperação no site do doc. Medir a taxa de recusa e precisão em 100 perguntas reais de suporte.
3. **Hard.**Implemente o ciclo de agente acima com três ferramentas (busca, leitura de dados do usuário, envio de e-mail). Execute uma avaliação com 50 cenários de teste, incluindo tentativas de injeção imediata.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Intent | What the user wants | Categorical label (book_flight, reset_password). Routed to a handler. |
| Slot | A piece of info | Parameter the bot needs (date, destination). Slot filling is the sequence of asks. |
| RAG | Retrieval plus generation | Retrieve relevant docs, then ground the LLM's response. |
| Tool call | Function invocation | LLM emits a structured call with name + args. Runtime executes, returns result. |
| Agent loop | Plan, act, verify | Controller that runs LLM calls interleaved with tool calls until task complete. |
| Prompt injection | User attacks prompt | Malicious input that tries to override the system prompt. |

## Mais leitura

- [Turing (1950). Computing Machinery and Intelligence](https://academic.oup.com/mind/article/LIX/236/433/986238) o artigo que fez da conversa o ponto de referência do campo.
- [Weizenbaum (1966). ELIZA — A Computer Program For the Study of Natural Language Communication](https://web.stanford.edu/class/cs124/p36-weizenabaum.pdf) o papel original baseado em regras.
- [Colby, Weber, Hilf (1971). Artificial Paranoia](https://doi.org/10.1016/0004-3702(71)90002-6)  Arquitetura variável de afeto de PARRY, o primeiro chatbot com estado.
- [Thoppilan et al. (2022). LaMDA: Language Models for Dialog Applications](https://arxiv.org/abs/2201.08239)O artigo do Google sobre chatbot neural, pouco antes de os agentes do LLM assumirem o cargo.
- [Yao et al. (2022). ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629)O papel que nomeou o padrão do ciclo do agente.
- [Anthropic's guide on building effective agents](https://www.anthropic.com/research/building-effective-agents) Orientação de produção de 2024 que ainda se mantém em 2026.
- [Greshake et al. (2023). Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection](https://arxiv.org/abs/2302.12173) o papel de injecção rápida.
- [OWASP Top 10 for LLM Applications 2025 — LLM01 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) o ranking que fez da injecção rápida a principal preocupação de segurança.
- [AWS — Securing Amazon Bedrock Agents against Indirect Prompt Injections](https://aws.amazon.com/blogs/machine-learning/securing-amazon-bedrock-agents-a-guide-to-safeguarding-against-indirect-prompt-injections/) Defesas práticas de camada de orquestração, incluindo fluxos de planeamento-verificação-execução e de confirmação do utilizador.
- [EchoLeak (CVE-2025-32711)](https://www.vectra.ai/topics/prompt-injection) o CVE canônico de exfiltração de dados com clicar zero da injecção indirecta de prompt.
