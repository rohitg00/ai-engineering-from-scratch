# A Interface de Ferramentas — Por Que Agentes Precisam de I/O Estruturado

> Um modelo de linguagem produz tokens. Um programa toma ações. O gap entre os dois é a interface de ferramentas: um contrato que permite ao modelo solicitar uma ação e ao host executá-la. Toda stack de 2026 — function calling no OpenAI, Anthropic e Gemini; o `tools/call` do MCP; as task parts do A2A — é uma codificação diferente do mesmo loop de quatro passos. Esta aula nomeia o loop e mostra a infraestrutura mínima pra rodar ele.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, sem LLM)
**Pré-requisitos:** Fase 11 (APIs de LLM completion)
**Tempo:** ~45 minutos

## Objetivos de Aprendizado

- Explicar por que um LLM que só gera texto não consegue, sozinho, tomar ações contra o mundo real.
- Desenhar o loop de quatro passos de ferramenta call (descrever → decidir → executar → observar) e nomear quem é dono de cada passo.
- Escrever a descrição de uma ferramenta como três partes: nome, JSON Schema de entrada e uma função executora determinística.
- Distinguir ferramentas puras e com efeitos colaterais e explicar por que essa separação importa pra segurança.

## O Problema

Um LLM emite uma distribuição de probabilidade sobre o próximo token. Esse é o universo inteiro de saída. Se você pergunta ao chat model "qual o tempo em Bengaluru agora", ele consegue escrever uma frase plausível, mas não consegue chamar uma API de clima. A frase pode estar certa por acidente ou estar três dias defasada.

Fechar esse gap é o propósito da interface de ferramentas. O programa host — seu agente runtime, Claude Desktop, ChatGPT, Cursor ou um script custom — divulga uma lista de ferramentas chamáveis ao modelo. O modelo, quando decide que uma ação é necessária, emite um payload estruturado nomeando uma ferramenta e seus argumentos. O host faz parse desse payload, roda a ferramenta de verdade, e alimenta o resultado de volta. O loop continua até o modelo decidir que não precisa mais de chamadas.

A primeira versão desse contrato saiu em junho de 2023 como o parâmetro "functions" da OpenAI. A Anthropic seguiu com blocos `tool_use` no Claude 2.1. O Gemini adicionou `functionDeclarations` alguns meses depois. Todo provedor agora expõe a mesma forma: uma lista de ferramentas tipada com JSON Schema, e uma chamada de ferramenta em payload JSON. O Model Context Protocol (novembro de 2024) generalizou o contrato pra que um único registry de ferramentas sirva qualquer modelo. O A2A (abril de 2026, v1.0) adicionou a mesma primitiva pra delegação agent-to-agent.

O loop de quatro passos é o invariante por baixo de tudo isso. O resto da Fase 13 é uma elaboração.

## O Conceito

### Passo um: descrever

O host declara cada ferramenta com três campos.

- **Nome.** Um identificador estável e legível por máquina. `get_weather`, não "coisa de clima".
- **Descrição.** Um parágrafo de texto natural em resumo. "Usar quando o usuário pergunta sobre condições atuais para uma cidade eespecificaçãoífica. Não usar para dados históricos."
- **Schema de entrada.** Um objeto JSON Schema (draft 2020-12) descrevendo os argumentos da ferramenta.

O modelo recebe a lista. Provedores modernos serializam essas declarações no system prompt usando um template eespecificaçãoífico do provedor, então você como caller só lida com a forma estruturada.

### Passo dois: decidir

Dada a mensagem do usuário e as ferramentas disponíveis, o modelo escolhe um dos três comportamentos.

1. **Responder diretamente** em texto. Sem chamada de ferramenta.
2. **Chamar uma ou mais ferramentas.** Emitir objetos de chamada estruturados. Com `parallel_tool_calls: true` (padrão no OpenAI e Gemini, opt-in no Anthropic) o modelo pode emitir múltiplas chamadas num turno.
3. **Recusar.** Outputs estruturados em modo strict podem produzir um bloco `refusal` tipado em vez de uma chamada.

O payload de uma chamada de ferramenta tem três campos estáveis: um `id` de chamada, um `name` de ferramenta e um objeto JSON de `arguments`. O id existe pra que o host possa correlacionar o resultado posterior com a chamada eespecificaçãoífica, o que importa quando chamadas paralelas voltam fora de ordem.

### Passo três: executar

O host recebe a chamada, valida os argumentos contra o schema declarado, e roda o executor. Argumentos inválidos significam que o modelo alucinou um campo ou usou o tipo errado — uma falha muito comum em modelos fracos. Hosts de produção fazem uma de três coisas com argumentos inválidos: falham rápido e mostram o erro ao modelo, consertam o JSON com um parser restrito, ou tentam de novo com o erro de validação incluído no prompt.

O executor em si é código comum. Python, TypeScript, um comando shell, uma consulta de banco. Ele produz um resultado, que geralmente é uma string mas pode ser qualquer valor JSON ou um bloco de conteúdo estruturado (texto, imagem ou referência de recurso no MCP). O resultado deve ser serializável.

### Passo quatro: observar

O host anexa o resultado da ferramenta à conversa (como uma mensagem de role `tool` com `id` correspondente) e invoca o modelo de novo. O modelo agora tem a saída da ferramenta no contexto e pode produzir uma resposta final ou pedir mais chamadas. Isso continua até o modelo parar de emitir chamadas ou o host atingir um limite de segurança no número de iterações.

### A separação de confiança

Ferramentas vêm em dois tipos que importam pra segurança.

- **Puras.** Somente leitura, determinísticas, sem efeitos colaterais. `get_weather`, `search_docs`, `get_current_time`. Seguras pra chamar de forma eespecificaçãoulativa.
- **Consequentes.** Mutam estado, gastam dinheiro, mexem com dados do usuário. `send_email`, `delete_file`, `execute_trade`. Precisam ser controladas.

A "Regra dos Dois" de 2026 da Meta pra segurança de agentes diz que um único turno pode combinar no máximo dois de: input não confiável, dados sensíveis, ação consequente. A interface de ferramentas é onde você aplica essa regra — rejeitando chamadas, exigindo confirmação do usuário ou escalando escopos. Veja Fase 13 · 15 pro capítulo completo de segurança e Fase 14 · 09 pras políticas de permissão de nível de agente.

### Onde o loop vive

| Contexto | Quem descreve | Quem decide | Quem executa |
|----------|---------------|-------------|--------------|
| Function calling single-turn (OpenAI/Anthropic/Gemini) | Desenvolvedor da aplicação | LLM | Desenvolvedor da aplicação |
| MCP | Servidor MCP | LLM via cliente MCP | Servidor MCP |
| A2A | Publicador do Agent Card | Agente chamador | Agente chamado |
| Navegador web (agent com function calling) | Extensão do navegador / WebMCP | LLM | Runtime do navegador |

Em todo lugar, os mesmos quatro passos. Os nomes das colunas mudam; a estrutura não.

### Por que simplesmente pedir ao modelo pra emitir JSON não funciona?

"Pedir ao modelo pra responder em JSON" era o padrão pré-function calling. Falha de 5 a 15 por cento do tempo em modelos frontier e muito mais em modelos menores. Os modos de falha incluem chaves faltando, vírgulas no final, campos alucinados e tipos errados. Aí você precisa de um passo de reparo de JSON, uma nova tentativa ou um decoder restrito.

Function calling nativo é melhor por três razões. Primeiro, o provedor treina o modelo de ponta a ponta na forma exata da chamada, então a taxa de JSON válido sobe pra 89 a 99 por cento em modo strict. Segundo, o payload da chamada fica no seu próprio slot de protocolo, não dentro de texto livre — então uma chamada de ferramenta nunca vaza pra resposta visível ao usuário. Terceiro, provedores aplicam conformidade com o schema via decoding restrito (modo strict da OpenAI, `tool_use` do Anthropic, `responseSchema` do Gemini). A saída é garantida pra validar.

Fase 13 · 02 caminha pelas três APIs de provedor lado a lado. Fase 13 · 04 aprofunda em outputs estruturados.

### Disjuntores

O loop termina quando o modelo para de emitir chamadas ou o host atinge um número máximo de turnos. Hosts de produção configuram isso entre 5 e 20 turnos. Acima disso, você quase certamente está num loop que o modelo não consegue sair. Claude Code usa 20 por padrão; OpenAI Assistants usa 10; o modo agente do Cursor usa 25.

A alternativa — loops sem limite — aparece a cada seis meses em post-mortems de "agent gastou $400 em chamadas de API durante a noite". Não lance sem um limite.

Fase 14 · 12 cobre recuperação de erros e auto-healing em profundidade; Fase 17 cobre rate limits de produção.

### Pra onde vai a Fase 13 a partir daqui

- Aulas 02 até 05 refinam a superfície de chamada de ferramenta no nível de provedor.
- Aulas 06 até 14 generalizam o loop pro MCP.
- Aulas 15 até 18 defendem o loop contra servidores hostis, usuários adversariais e superfícies de autenticação remota não autenticadas.
- Aulas 19 até 22 estendem o padrão pra colaboração agent-to-agent, observabilidade, roteamento e empacotamento.
- Aula 23 entrega um ecossistema completo usando cada primitiva.

Cada aula restante é uma elaboração desse loop de quatro passos. Guarde ele como o invariante.

## Use

`code/main.py` roda o loop de quatro passos sem um LLM. Uma função falsa de "decisor" simula o modelo fazendo pattern matching na mensagem do usuário; o executor, o validador de schema e o harness do passo de observação são reais. Rode pra ver a coreografia completa de request/resposta com estado intermediário imprimível, e depois substitua o decisor falsos por qualquer provedor real numa aula posterior.

O que conferir:

- O registry de ferramentas mantém quatro campos por ferramenta: nome, descrição, schema e uma referência do executor.
- O validador é um subconjunto mínimo de JSON Schema (tipos, required, enum, min/max) escrito só com stdlib. Fase 13 · 04 entrega um mais completo.
- O loop limita a iteração em cinco. Agentes de produção precisam exatamente desse tipo de disjuntor.

## Entregue

Esta aula produz `outputs/skill-tool-interface-reviewer.md`. Dada uma definição de ferramenta provisória (nome + descrição + schema + esboço do executor), a skill audita a adequação ao loop: o nome é estável pra máquina, a descrição é um brief completo de uso, o schema usa JSON Schema 2020-12 corretamente, e a classificação pura vs. consequente é explícita.

## Exercícios

1. Adicione uma quarta ferramenta ao `code/main.py` chamada `get_stock_price(ticker)`. Escreva a descrição como "Usar quando o usuário pede o preço atual de uma ação pelo ticker. Não usar para preços históricos ou resumos de mercado." Rode o harness e confirme que o decisor falsos roda consultas mencionando tickers pra nova ferramenta.

2. Quebre o validador de schema. Passe uma chamada cujo objeto `arguments` está faltando um campo obrigatório, e confirme que o host rejeita antes da execução. Depois passe uma chamada com um campo extra desconhecido. Decida: o host deve rejeitar ou ignorar? Justifique sua escolha com um argumento de segurança.

3. Classifique cada ferramenta no harness como pura ou consequente. Adicione uma flag `consequential: true` nos registros do registry que precisam, e mude o loop pra imprimir uma linha "confirmaria com o usuário" sempre que uma ferramenta consequente for escolhida. Essa é a forma do gate de confirmação que todo host de produção precisa.

4. Desenhe o loop de quatro passos no papel com a tabela de colunas de provedor preenchida pro seu cliente favorito (Claude Desktop, Cursor, ChatGPT ou uma stack custom). Faça referência cruzada com a variante eespecificaçãoífica do MCP na Fase 13 · 06.

5. Leia o guia de function calling da OpenAI de ponta a ponta. Identifique o único campo que está no request mas não no loop de quatro passos apresentado aqui. Explique o que ele acrescenta e por que é conveniente em vez de essencial.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Tool | "Uma coisa que o modelo pode chamar" | Um triplo de nome + entrada tipada com JSON Schema + função executora |
| Function calling | "Uso nativo de ferramentas" | Suporte de API de nível de provedor pra emitir chamadas de ferramenta estruturadas em vez de texto |
| Tool call | "A solicitação do modelo pra agir" | Um payload JSON com `id`, `name`, `arguments` emitido pelo modelo |
| Tool result | "O que a ferramenta retornou" | A saída do executor, envolvida numa mensagem de role `tool` com id correspondente |
| Parallel ferramenta calls | "Muitas chamadas de uma vez" | Múltiplos objetos de chamada num turno do modelo, independentes e ordenáveis por id |
| Strict mode | "JSON garantido" | Decoding restrito que força a saída do modelo a validar contra o schema declarado |
| Tool pura | "Ferramenta somente leitura" | Sem efeitos colaterais; segura pra reexecutar |
| Tool consequente | "Ferramenta de ação" | Muta estado externo; requer gate, auditoria ou confirmação do usuário |
| Loop de quatro passos | "O ciclo de chamada de ferramenta" | descrever → decidir → executar → observar |
| Host | "Runtime do agente" | O programa que mantém o registry de ferramentas, chama o modelo e roda o executor |

## Leituras Complementares

- [OpenAI — Function calling guide](https://platform.openai.com/docs/guides/function-calling) — referência canônica pra declarações de ferramentas no estilo OpenAI
- [Anthropic — Tool use overview](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview) — formato de blocos `tool_use` / `tool_result` do Claude
- [Google — Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling) — `functionDeclarations` e semântica de chamadas paralelas no Gemini
- [Model Context Protocol — Specification 2025-11-25](https://modelcontextprotocol.io/especificaçãoification/2025-11-25) — a generalização da interface de ferramentas independente de provedor
- [JSON Schema — 2020-12 release notes](https://json-schema.org/draft/2020-12/release-notes) — o dialeto de schema que toda API moderna de ferramentas fala
