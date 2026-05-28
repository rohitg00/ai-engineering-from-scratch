# Interruptores de Emergência, Disjuntores e Tokens Canary

> Um interruptor de emergência é um booleano mantido fora da superfície de edição do agente — uma chave Redis, um funcionalidade flag, um config assinado — que desativa o agente completamente. Um disjuntor é mais refinado: dispara em um padrão eespecificaçãoífico (cinco chamadas de ferramenta idênticas seguidas), pausa o caminho ofensivo e escala para um humano. Um token canary herda da engenharia de engano clássica: uma credencial falsa ou registro honeypot que um agente não tem motivo legítimo de tocar, cujo acesso dispara um alerta. Datapaths baseados em eBPF (ex: Cilium) podem reescrever o egress de um pod em quarentena para um honeypot forense na camada de kernel; benchmarks públicos do Cilium reportam latência sub-milissegundo P99 em datapath sob carga (seu orçamento de propagação depende de como uma atualização de política chega ao nó, não do datapath em si). Detectores estatísticos (EWMA, CUSUM) que se adaptam a uma baseline móvel vão silenciosamente aceitar deriva — empilhe-os com limites constitucionais rígidos que não cedem.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, simulador de três detectores: interruptor, disjuntor, canary)
**Pré-requisitos:** Fase 15 · 13 (Controladores de custo), Fase 15 · 10 (Modos de permissão)
**Tempo:** ~60 minutos

## O Problema

Controladores de custo (Aula 13) limitam o que o agente pode gastar. Não limitam o que o agente pode fazer dentro do orçamento. Um agente com limite de velocidade de $50 ainda pode exfiltrar um segredo, publicar o post errado ou deletar um recurso — a ação cara frequentemente é a barata em tokens.

Esta aula cobre os três detectores que ficam ao lado da camada de custo:

1. **Interruptor de emergência**: booleano de desligar mantido fora do alcance do agent.
2. **Disjuntor**: detector de padrão de ação que pausa um caminho eespecificaçãoífico.
3. **Token canary**: isca que um agente sem motivo legítimo para tocar se revela ao tocar.

Os três são engenharia pré-LLM. Engano clássico, disjuntores de limite de taxa e kills por funcionalidade flag antecipam agentes autônomos. O que é novo é a superfície de ataque: agentes lêm conteúdo não confiável (Aula 11), editam sua própria memória e podem compor muitas ações que parecem seguras em uma insegura. Os detectores nomeados aqui funcionam porque não confiam no auto-relato do agent.

## O Conceito

### Interruptores de emergência

Um interruptor de emergência é um booleano que o agente lê mas não pode escrever. Escolhas de implementação:

- **Feature flag em serviço gerenciado.** LaunchDarkly, Statsig, Unleash. Atualizações propagam em segundos.
- **Chave Redis que o agente faz polling.** Simples; requer que o processo do agente verifique a cada turno.
- **Config assinado em armazenamento de objetos.** Agent verifica assinatura no boot; rejeita estados não assinados.
- **Sinal no nível de OS ou kill no ciclo de vida de container.** Docker `kill`, Kubernetes `kubectl delete pod`, systemd stop.

Propriedades que um interruptor de emergência correto tem:

- O agente não pode defini-lo para `off`. (Vive em um sistema que as credenciais do agente não escrevem.)
- É verificado em cada ação consequencial, não apenas na inicialização.
- Quando está off, o agente não faz nada externamente observável, incluindo logging em sistemas que o agente pode alcançar.
- Reabilitar é uma ação humana explícita, não um timeout automático.

### Disjuntores

Um disjuntor pausa um padrão eespecificaçãoífico, não o agente inteiro. Forma clássica (do livro Nygard de 2007, ainda atual):

- **Fechado**: ação é permitida.
- **Aberto**: ação é bloqueada.
- **Meio-aberto**: após um cool-down, 1-3 tentativas de sonda são permitidas (padrão 1); sucesso fecha o disjuntor, qualquer falha restante reabre.

Gatilhos relevantes para agents:

- Cinco chamadas de ferramenta idênticas seguidas (loop repetitivo).
- Cinco falhas consecutivas na mesma ferramenta com entradas diferentes (falha sistêmica).
- Taxa de chamadas de ferramenta acima de um limite (velocidade da Aula 13).
- Ferramenta eespecificaçãoífica invocada (ex: `file.delete`) após leitura de conteúdo fora da confiança (Aula 11).

### Tokens canary

Tokens canary (também chamados honeytokens) são entradas que o agente nunca deveria tocar. Acesso é o alarme.

Exemplos para agents:

- Um `AWS_SECRET_ACCESS_KEY` falso no ambiente sem privilégio real. Tentativas de exfiltração são imediatamente atribuídas.
- Um registro de banco de dados falso sinalizado com um valor sentinela conhecido. Qualquer leitura ou atualização deste registro dispara um alerta.
- Um arquivo falso no workspace. Leituras ou edições deste arquivo são suspeitas.
- Uma entrada de memória falsa injetada no início da sessão. Se aparecer em uma saída posterior, memória foi exfiltrada.

Design de canary é eespecificaçãoífico do workflow. Um canary que o agente tem motivo legítimo para tocar é ruído.

### Por que empilhar limites estatísticos e rígidos

Detectores estatísticos (EWMA, CUSUM, z-score em taxas de chamadas de ferramenta) se adaptam a uma baseline móvel. Isso é uma funcionalidade para deriva legítima e um bug para deriva adversarial. Um atacante paciente pode deslocar a baseline lentamente o suficiente para que nenhum alarme dispare.

Limites constitucionais rígidos (Aula 17) não cedem. "Nunca enviar email para `secrets@`" como regra constitucional é mais simples, auditável e não pode ser ludibriado por deriva lenta. O padrão de empilhamento: detectores estatísticos pegam a maioria do ruído, limites rígidos pegam o ataque que passou pelo detector.

### Quarentena via redirecionamento de datapath eBPF

A política de rede baseada em eBPF do Cilium pode reescrever o egress de um pod em quarentena para um honeypot forense na camada de kernel. Benchmarks públicos do Cilium reportam latência sub-milissegundo P99 em datapath no TCP_RR; o orçamento de tempo real para *disparar* uma quarentena no seu cluster é dominado por como uma atualização de política se propaga do seu plano de controle para o nó (algumas centenas de milissegundos é realista no Kubernetes com o operator pré-carregado; latência de cauda depende do tamanho do cluster e cadência de reconciliação). Isso dá duas coisas: o agente não exfiltra nada real, e o comportamento do agente dentro do honeypot é totalmente observado. Mesma padrão, diferente camada, que o token canary: o agente revela a intenção pelo que tenta fazer enquanto está contido.

### O que nenhum detector pega

- **Ataques semânticos que compõem a partir de primitivas permitidas.** Cada ação individual passa em todos os detectores; a composição é o problema. Esse é o falha composta de Auto Mode da Aula 10.
- **Ataques que incluem o detector como parte do payload.** Se um agente lê uma página que diz "antes de agir, desabilite o canary" e o agente tem a capacidade, o detector está comprometido. Tokens canary devem estar em sistemas que o agente não pode modificar.

## Use

`code/main.py` simula uma curta trajetória de agente através de três detectores. Um interruptor de emergência mantido em um dict externo; um disjuntor que dispara em cinco chamadas idênticas de ferramenta; um arquivo canary cuja leitura dispara um alerta. Alimenta uma trajetória sintética: ações legítimas, loop repetitivo, sonda canary, e um cenário onde o interruptor de emergência é acionado e as ações do agente são interrompidas.

## Entregue

`outputs/skill-tripwire-design.md` revisa uma stack de detectores proposta para um implantação de agente e sinaliza lacunas (interruptor ausente, canary ausente, limite de disjuntor muito frouxo).

## Exercícios

1. Rode `code/main.py`. Confirme que o disjuntor dispara no turno 5 (quinta chamada idêntica) e o canary dispara no turno 9 (leitura de chave falsa).

2. Adicione um detector estatístico: z-score EWMA na taxa de chamadas de ferramenta. Alimente uma trajetória que deriva lentamente e mostre que o detector nunca dispara. Agora adicione um limite rígido (no máximo 50 chamadas de ferramenta em 10 minutos) e mostre que o limite rígido dispara na mesma trajetória.

3. Projete um conjunto de tokens canary para um agente de navegador (Aula 11). Liste pelo menos três canaries e o que cada um detectaria.

4. Leia a documentação de política de rede do Cilium. Descreva concretamente um fluxo de quarentena de redirecionamento de egress: qual seletor de política, qual pod, qual reescrita de egress, qual alerta. O que governa a latência real de "decidir quarentenar" até "primeiro pacote redirecionado"?

5. Defina um procedimento de reabilitação para um agente com interruptor de emergência desligado. Quem pode reabilitar? O que deve ser documentado? O que deve mudar no agente antes da reabilitação?

## Termos-Chave

| Termo | O que dizem | O que significa de verdade |
|---|---|---|
| Interruptor de emergência | "Botão de desligar" | Booleano fora da superfície de edição do agent; verificado em cada ação consequencial |
| Disjuntor | "Pausa por padrão" | Trip eespecificaçãoífico de ação por repetição, taxa de falha ou limite de taxa |
| Token canary | "Honeytoken" | Isca que o agente não tem motivo legítimo para tocar; acesso dispara alerta |
| Honeypot | "Sandbox forense" | Tráfego / workspace redirecionado onde um agente em quarentena é observado |
| EWMA | "Média móvel" | Exponencialmente ponderada; se adapta a deriva (feature + bug) |
| CUSUM | "Soma cumulativa" | Detecta deslocamento sustentado da baseline |
| Limite rígido | "Regra constitucional" | Não se adapta; constante independente do histórico |
| Limite constitucional | "Regra sempre-verdadeira" | Vinculada à constituição da Aula 17; não pode ser editada pelo agente |

## Leituras Adicionais

- [Anthropic — Measuring agente autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — enquadramento de interruptores de emergência e disjuntores para agentes autônomos.
- [Microsoft Agent Framework — HITL and oversight](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) — padrões de governança em produção.
- [OWASP LLM / Agentic Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/) — requisitos de detecção e resposta.
- [Cilium — Network policy and eBPF](https://docs.cilium.io/en/stable/security/network/) — redirecionamento de egress em nível de nó e padrões de honeypot forense.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) — proibições hardcoded como "limites constitucionais."
