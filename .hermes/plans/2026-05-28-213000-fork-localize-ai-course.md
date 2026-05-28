# Plano: Localizacao PT-BR do AI Engineering from Scratch

## Por Que Localizacao Nao E Traducao

Traducao seca troca palavras. Localizacao adapta a experiencia inteira pra quem le em portugues brasileiro. O curso original tem um estilo muito proprio: direto, confiante, levemente irreverente ("Every AI model is just matrix math wearing a fancy hat"). Se a gente traduzir seco, fica estranha a frase, perde a personalidade, e o leitor sente que ta lendo texto de maquina.

O objetivo e que o resultado final pareca **um curso escrito originalmente em portugues brasileiro por um engenheiro brasileiro que manja do assunto**.

---

## 1. Voz e Tom

### Estilo do Original (analise)

O autor americano usa um tom que e:
- **Direto e confiante** — fala como quem ja fez e sabe que funciona
- **Levemente irreverente** — "fancy hat", "the rub is", "if you squint"
- **Instrutivo sem ser professor** — fala com o leitor como colega, nao como aluno
- **Opinionado** — nao tem medo de dizer "faz assim, nao faz assado"
- **Referencias atuais** — cita ferramentas de 2026, nao fala no vazio

### Voz Brasileira que a Gente Quer

O equivalente brasileiro desse tom nao e "cara" e "mano" a todo momento. E:

- **Direto e sem frescura** — frases curtas, vai pro ponto
- **Tecnicamente solido** — fala com propriedade, sem titubear
- **Informal sem ser vulgar** — como um colega de trabalho que manja, nao como professor da faculdade
- **Com personalidade** — pode ter pitaco, opinião, ironia leve quando fizer sentido
- **Natural em PT-BR** — nao fraseado de traducao, nao "e importante notar que", nao " vale ressaltar"

### Regras de Estilo

| Regra | Exemplo errado | Exemplo certo |
|-------|---------------|---------------|
| Nao comecar frases com "E importante" | "E importante notar que transformers usam atencao" | "Transformers usam atencao. Sem isso, nao funciona." |
| Nao usar "tal como" | "Tal como GPT, LLaMA e autoregressivo" | "GPT, LLaMA, todo mundo e autoregressivo" |
| Nao usar "dentre" | "Dentre os modelos disponiveis" | "Dos modelos disponiveis" |
| Nao usar "a fim de" | "A fim de reduzir o overfitting" | "Pra reduzir o overfitting" |
| Nao traduzir onde nao faz sentido | "O loop de agente roda em background" | "O agent loop roda em background" |
| Frases curtas | "Sendo assim, podemos concluir que o modelo convergiu" | "O modelo convergiu. Ponto." |
| Usar "voce" direto | "O programador deve configurar" | "Voce configura" |

### Referencia de Tom por Contexto

**Explicacao de conceito:**
> "Um LLM sozinho e um autocomplete. Voce pergunta, ele responde. Nao le arquivo, nao roda query, nao abre navegador. Se o modelo ta com informacao errada, ele fala errado com confiança e para por ali."

**Instrucao pratica:**
> "Roda isso:
> ```
> python3 code/main.py
> ```
> O output e um trace completo do ReAct. Troca o ToyLLM por um provedor de verdade e voce tem um agente real. E so isso."

**Alerta/pitaco:**
> "Cuidado: em 2026, agentes rodam de 40 a 400 passos por tarefa. Debugar o passo 38 exige observabilidade (Aula 23) e trilhas de avaliacao (Aula 30). Sem isso, voce ta no escuro."

---

## 2. Terminologia

### Principio

Termos tecnicos que a comunidade global usa em ingles **ficam em ingles**. Ninguem no Brasil fala "rede neural de transformacao" pra falar de "transformer". Mas a **explicacao** do que o termo significa vai em portugues.

### Tabela de Terminologia

| Termo | Como fica | Regra |
|-------|----------|-------|
| Transformer | transformer (sem traducao) | Termo universal, todos usam |
| Attention / self-attention | attention / self-attention | Termo universal |
| Backpropagation | retropropagacao (ou "backprop" informal) | Em texto formal: retropropagacao. Em explicacao: backprop |
| Tokenizer | tokenizer | Universal |
| Embedding | embedding | Universal |
| Fine-tuning | fine-tuning (ou "ajuste fino" em explicacao longa) | Depende do contexto |
| Overfitting | overajuste (ou "overfitting" em contexto breve) | Em explicacoes: overajuste. Em tabelas: overfitting |
| Loss function | funcao de perda | Traduzido |
| Gradient descent | descida do gradiente | Traduzido |
| Learning rate | taxa de aprendizado | Traduzido |
| Batch size | tamanho do lote | Traduzido |
| Inference | inferencia | Traduzido |
| Training | treinamento | Traduzido |
| Agent loop | agent loop (ou "loop de agente") | Depende do fluxo |
| Prompt | prompt | Universal |
| RAG | RAG | Universal |
| MCP | MCP | Universal |
| LoRA / QLoRA | LoRA / QLoRA | Universal |
| Quantization | quantizacao | Traduzido |
| RLHF | RLHF | Universal |
| Diffusion model | modelo de diffusao | Traduzido |
| KV cache | KV cache | Universal |
| Chain of Thought | Chain of Thought (ou "cadeia de raciocinio") | Universal em maioria |

### Glossario Bilingue

Criar `glossario/termos-pt-br.md` como referencia central. Cada termo tem:
- **Em ingles**: termo original
- **Em portugues**: traducao quando aplicavel
- **Uso**: quando traduzir e quando manter em ingles
- **Nota**: contexto ou observacao

---

## 3. Adaptacao Cultural

### Referencias Brasileiras

Onde fizer sentido, adicionar referencia ao contexto brasileiro:

- **Empresas**: Nubank (ML em producao), iFood (recomendacao), Stone (payments ML), Loft (computer vision), TOTVS
- **Pesquisadores**: institutos brasileiros (IME, USP, UNICAMP, PUC-Rio) quando citados em contextos de pesquisa
- **Comunidade**: MLBR, comunidades de IA no Brasil, eventos como Python Brasil, DevOps Brasil
- **Dados**: quando o curso usa exemplos com USD, mencionar que USD e a moeda padrao mas os conceitos sao universais

### Exemplos Contextualizados

Nao trocar TODOS os exemplos, mas adaptar onde for natural:

- Exemplos com moeda: manter USD como padrao (e o padrao da area), mas em aulas de setup/infra, mencionar que GPUs no Brasil sao mais caras
- Exemplos com idioma: o curso e focado em ingles (tokens, NLP), manter assim mas explicar que modelos multilinguais existem
- Exemplos com cultura: se tem referencia a "Silicon Valley", pode mencionar que o ecossistema BR tambem existe

### O que NAO adaptar

- **Nao trocar nomes de ferramentas** — PyTorch continua PyTorch
- **Nao trocar exemplos de codigo** — codigo e universal
- **Nao trocar papers academicos** — referencias sao globais
- **Nao trocar nomes de conceitos** — "ReAct" continua "ReAct"
- **Nao adicionar "no Brasil" onde nao existe** — forcar patriotismo e pior que nao traduzir

---

## 4. Estrutura de Arquivos

### Modelo de Localizacao

Para cada aula, a estrutura fica:

```
01-the-agent-loop/
├── docs/
│   ├── en.md           ← original (intocavel)
│   └── pt-br.md        ← versao localizada
├── code/
│   ├── main.py         ← comentarios em pt-br (opcional)
│   └── main.ts
├── outputs/
│   ├── skill-agent-loop.md       ← original
│   └── skill-agent-loop.pt-br.md ← versao localizada
├── quiz.json            ← original
└── quiz.pt-br.json      ← versao localizada
```

### Arquivos Raiz

```
README.md              ← original
README.pt-br.md        ← versao brasileira (com banner de idioma)
CONTRIBUTING.pt-br.md  ← guia de contribuicao em PT-BR
ROADMAP.pt-br.md       ← roadmap em PT-BR
```

### Site

Adicionar seletor de idioma no site. Quando pt-BR selecionado, carrega `docs/pt-br.md` em vez de `docs/en.md`.

---

## 5. Prioridade de Localizacao

### Modulos mais Relevantes pra Voce (comecar por aqui)

| Modulo | Por que | Aulas |
|--------|---------|-------|
| **14 - Agent Engineering** | diretamente aplicavel ao que voce faz | 42 |
| **07 - Transformers Deep Dive** | fundamentacao solida | 16 |
| **10 - LLMs from Scratch** | entender o que roda por baixo | 24 |
| **11 - LLM Engineering** | pratico e util no dia a dia | 17 |
| **13 - Tools & Protocols** | MCP, A2A, o que voce ja usa | 23 |
| **15 - Autonomous Systems** | agentes autonomos | 22 |

### Modulos Fundamentais (traduzir depois)

| Modulo | Aulas |
|--------|-------|
| 00 - Setup | 12 |
| 01 - Math Foundations | 22 |
| 02 - ML Fundamentals | 18 |
| 03 - Deep Learning Core | 13 |

### Modulos Complementares (traduzir por ultimo)

| Modulo | Aulas |
|--------|-------|
| 04 - Computer Vision | 28 |
| 05 - NLP | 29 |
| 06 - Speech & Audio | 17 |
| 08 - Generative AI | 15 |
| 09 - Reinforcement Learning | 12 |
| 12 - Multimodal AI | 25 |
| 16 - Multi-Agent & Swarms | 25 |
| 17 - Production | 28 |
| 18 - Ethics & Safety | 30 |
| 19 - Capstone Projects | 55 |

---

## 6. Fluxo de Trabalho por Aula

### Passo 1: Ler o original inteiro
Entender o contexto completo antes de comecar a traduzir. Nao traduzir linha por linha.

### Passo 2: Identificar o que localizar
- Texto narrativo → localizar (traduzir + adaptar tom)
- Blocos de codigo → manter intactos
- Formulas LaTeX → manter intactas
- Nomes de APIs/funcoes → manter em ingles
- Tabelas de termos → localizar termos e explicacoes
- Links/referencias → manter URLs, localizar titulos se fizer sentido

### Passo 3: Escrever a versao PT-BR
- Seguir o estilo descrito na secao 1
- Usar terminologia da secao 2
- Adaptar onde a secao 3 orientar

### Passo 4: Revisar consistencia
- Verificar glossario antes de cada sessao de traducao
- Rodar busca por termos inconsistentes
- Manter o mesmo tom em todas as aulas do modulo

### Passo 5: Quiz
- Traduzir perguntas e opcoes
- Manter as alternativas corretas nas mesmas posicoes
- Adaptar exemplos culturais nas perguntas quando fizer sentido

---

## 7. Ferramentas de Auxilio

### Script de Traducao Assistida

Criar um script Python que:
1. Le o `docs/en.md`
2. Identifica blocos de codigo (```...```) e preserva
3. Identifica formulas LaTeX e preserva
4. Identifica links e preserva URLs
5. Identifica tabelas e formata para traducao
6. Gera um esqueleto `pt-br.md` com os blocos nao-textuais ja preservados

Isso agiliza o trabalho manual, que fica focado no texto narrativo.

### Checklist de Localizacao

Para cada aula traduzida:
- [ ] Tom natural em PT-BR (sem fraseado de traducao)
- [ ] Termos tecnicos consistentes com glossario
- [ ] Blocos de codigo intactos
- [ ] Formulas LaTeX intactas
- [ ] Links funcionais
- [ ] Quiz traduzido e testado
- [ ] Output/skill traduzido
- [ ] Revisado por leitura rapida (fluxo natural)

---

## 8. Plano de Execucao

### Sessao 0: Fork e Setup (15 min)
- Fork do repositorio
- Branch `feat/pt-br-localization`
- Criar glossario base
- Criar script auxiliar de traducao

### Sessao 1: Arquivos Raiz (30 min)
- README.pt-br.md
- Estrutura do fork com indicacao de idioma

### Sessao 2-3: Modulo 14 (Agent Engineering) — 42 aulas
- 3 subagents em paralelo, ~14 aulas cada
- Prioridade: aulas 01-10 (fundamentos do modulo)

### Sessao 4-5: Modulo 07 (Transformers) — 16 aulas
- 2 subagents em paralelo

### Sessao 6-7: Modulos 10+11 (LLMs) — 41 aulas
- 3 subagents em paralelo

### Sessao 8: Modulo 13 (Tools) — 23 aulas
- 3 subagents em paralelo

### Sessao 9-10: Modulo 15 (Autonomous) — 22 aulas
- 3 subagents em paralelo

### Sessao 11-16: Modulos restantes (136 aulas)
- 3 subagents em paralelo por sessao

### Sessao 17: Site e Integracao (1h)
- Seletor de idioma
- Testes

### Sessao 18: Revisao Final (30 min)
- Consistencia geral
- Push e publicacao

---

## 9. Riscos

| Risco | Mitigacao |
|-------|-----------|
| Tom inconsistente entre modulos | Glossario de estilo + revisao por modulo |
| Traducao automatica de baixa qualidade | Subagents com prompt detalhado de estilo + revisao |
| Escopo enorme (1240+ arquivos) | Fasear por relevancia, publicar modulo a modulo |
| Termos traduzidos de forma inconsistente | Glossario bilingue como referencia obrigatoria |
| Codigo com comentarios em ingles | Comentarios em pt-br no codigo tambem (fase opcional) |

---

## 10. Definicao de Sucesso

O curso esta localizado quando:
1. Um engenheiro brasileiro le qualquer aula e entende sem pensar "isso foi traduzido"
2. Termos tecnicos sao usados como a comunidade brasileira usa
3. O tom e natural, com personalidade, nao generico
4. O quiz funciona e as perguntas sao claras em PT-BR
5. O site mostra o conteudo em PT-BR sem quebrar
