# Controle de IA  Segurança Apesar da Subversão

> Greenblatt, Shlegeris, Sachan, Roger (Redwood Research, arXiv:2312.06942, ICML 2024). O controlo reformula a questão da segurança: dado um modelo U não confiável e forte que pode estar a optimizar adversamente contra você, que protocolos permitem extrair trabalho útil ao mesmo tempo que limita a probabilidade de um resultado inaceitável? Os recursos são um modelo mais fraco de confiança T, um orçamento de trabalho humano confiável H, e a capacidade de editar as saídas de U. Dentro deste quadro, a Edição Confiável Pareto domina o Monitoramento Não Confiável em tarefas de código de porta traseira. O quadro herda as piores suposições da engenharia de segurança: segurança é a probabilidade de que um U escolhido adversamente não possa causar um resultado concreto inaceitável, medido sob pressão da equipe vermelha que representa U.

**Type:** Learn
**Languages:** Python (stdlib, safety-vs-usefulness frontier on code-backdoor task), TypeScript
**Prerequisites:** Phase 18 · 07 (sleeper agents), Phase 18 · 08 (scheming), Phase 18 · 09 (alignment faking)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Defina o modelo de ameaça de Controle de IA: modelo forte sem confiança U, modelo mais fraco confiável T, orçamento humano confiável H.
- Descreva o protocolo de edição confiável e por que o Pareto domina o monitoramento não confiável na tarefa de código de porta traseira do ICML 2024.
- Explique a diferença entre alinhamento (U é confiável) e controlo (U não é confiável e estamos seguros de qualquer maneira).
- Descreva os três limites do controle: os seres humanos não escalam, os modelos fracos de confiança eventualmente se atrasam, o controle não produz modelos fortes confiáveis.

## O problema

Lições 7-9 estabelecem que um modelo de fronteira pode ser enganosamente alinhado, esquema ou falsificação alinhamento. A questão da segurança reformula-se: podemos extrair um trabalho útil de um modelo em que não confiamos, sem lhe dar a oportunidade de causar resultados inaceitáveis? Este é o problema de controlo, e está estruturado como a segurança clássica: assumir o pior adversário, desenhar um protocolo, medir a taxa de sucesso do adversário sob pressão da equipe vermelha.

## O conceito

### O modelo de ameaça

O controlo assume:
- O modelo não confiável é forte, capaz, possivelmente adversário (a avaliação trata-o como se fosse).
- T  modelo mais fraco de confiança, menos capaz, mas conhecido por não ser adversário.
- O orçamento é pequeno, não é escalavel.

O sistema deve produzir resultados úteis usando U. O adversário tenta causar um resultado inaceitável concreto (por exemplo, uma porta traseira no código enviado) mantendo uma fração do trabalho útil legítimo para passar os limiares de utilidade.

O controlo desiste da confiança no U. Perguntam quais protocolos mantêm a segurança na ausência de confiança do U.

### A tarefa de backdoor do ICML 2024

As instruções são problemas de codificação de nível de competição. U produz uma solução candidata. Um oráculo oculto sinaliza se a solução contém uma porta traseira (uma entrada específica que faz com que o código produz uma saída errada). A equipe vermelha controla U e tem permissão para ver todos os protocolos internos. O protocolo deve maximizar a taxa de problema resolvido mantendo a taxa de envio de porta traseira abaixo de um limiar.

### Quatro protocolos comparados

- **Baseline:**A saída do U-navio é directa, a utilidade máxima, a segurança mínima.
- **Upfront auditing:**Usar H em todas as saídas, segurança máxima, orçamento exausto rapidamente.
- **Untrusted Monitoring:**A segunda instância de U marca a saída da primeira instância; a H verifica as saídas marcadas.
- **Trusted Editing:**T modifica a saída de U em cada consulta. Se T não está confiante, encaminha para H.

Greenblatt et al. encontram que a edição confiável é dominada pela pareto-monitorização não confiável: maior utilidade em todos os níveis de segurança.

### Por que a Edição Confiável vence

O Monitoramento Não Confiável exige que a segunda instância da U não possa coordenar com a primeira. A colusão é possível através de sinais steganográficos ou de formação compartilhada. O protocolo tem de investir orçamento em resistência à colusão (parafraseamento, ofuscação) que reduz o sinal do monitor. A Edição Confiável evita a colusão inteiramente porque T é confiável  qualquer edição que T propõe não é, por suposição, adversária. O custo é que o T é menos capaz, por isso pode rejeitar demais ou perder portas traseiras sutis.

### Os quatro eixos do protocolo

1. Qual o papel que desempenha U: só produtor, monitor ou ambos.
2. Qual o papel que desempenha T: editor, monitor ou resampler.
3. Como é atribuída a H: auditoria uniforme, auditoria aleatória ou auditoria dirigida à bandeira.
4. Quanto o protocolo gasta na resistência à colusão.

### Alinhamento contra controlo

- Alineação: "É seguro confiar em Vós?" As lições 2, 4, 5, 6, 7, 8, 9 se baseiam nisso.
- Controle: "podemos usar o U de forma segura sem confiar nele?" Lição 10.

O controle não produz modelos alinhados, produz o uso seguro de modelos possivelmente não alinhados. Ambas as agendas são necessárias.

### Três limites fundamentais

- Os humanos não escalam. O orçamento H é limitado pelo número de humanos dispostos a auditar as saídas de IA.
- Quando T é muito mais fraco do que U, o sinal de edição de T se torna ruído.
- Os protocolos que funcionam na ASL-3 (Lessão 18) podem não funcionar na ASL-4  se U puder manipular T ou raciocinar sobre a distribuição de auditoria de H, o controle falha.

### O desenvolvimento de 2025

A AISI e Redwood do Reino Unido colaboram em Casos de Segurança de Controle (metr.org / redwoodresearch.org 2025): um caso de segurança de controle argumenta que, sob as suposições de pior caso sobre U, o protocolo limita a probabilidade de um resultado inaceitável.

### Onde isto encaixa na Fase 18

As lições 6-9 descrevem a ameaça (o engano é possível). A lição 10 descreve o paradigma defensivo sob a suposição de que a ameaça é real. A lição 11 descreve o paradigma ofensivo complementar (faça U confiável através de supervisão escalável).

```figure
al-control-protocol
```

## Usá-lo

`code/main.py`O sistema de controle de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados

## Envia-o

Esta lição produz`outputs/skill-control-protocol-audit.md`. Dada uma descrição do protocolo de implantação, identifica as funções de U/T/H, nomeia os vetores de colusão e estima a posição do protocolo na fronteira de utilidade-segurança sob pressão da equipa vermelha.

## Exercícios

1. Corra .`code/main.py`Reproduzir a fronteira de utilidade e segurança entre edição confiável e monitorização não confiável. Identificar o regime orçamental no qual a suposição de conluio da monitorização não confiável se torna fundamental.

2. Adicione um novo protocolo: "T reproduz em baixa temperatura, então U modifica a saída de T". Messa sua posição na fronteira.

3. O documento 2024 assume que U pode ver o protocolo. Desenhar um protocolo que se esconda de U que as saídas estão sendo auditadas. O que esse protocolo requer da infraestrutura de implantação?

4. Leia Greenblatt et al. 2024 Secção 7 (collusão). Propõe uma medida de resistência à colusão e explique o custo de utilidade esperado.

5. Articular um caso de segurança de controlo para uma implantação que utiliza U = GPT-4-classe, T = GPT-3.5-classe, H = 1% das saídas auditadas. Identificar a suposição única mais forte do caso depende.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| AI Control | "safety under subversion" | Protocol design that bounds unacceptable outcomes under a worst-case U |
| Untrusted model (U) | "the strong model" | The capable model we want to extract work from but do not trust |
| Trusted model (T) | "the weak model" | A weaker model, known not to be adversarial, used as editor/monitor |
| Trusted human (H) | "the audit budget" | Bounded expert labor; expensive; the ground-truth signal |
| Trusted Editing | "T edits U" | Protocol where T is the gate on U's outputs; H called on ambiguous outputs |
| Untrusted Monitoring | "U monitors U" | Protocol where a second U instance scores outputs; collusion-resistant only with extra investment |
| Control safety case | "the formal argument" | Written argument that a protocol bounds the adversary's success under worst-case U |

## Mais leitura

- [Greenblatt, Shlegeris, Sachan, Roger — AI Control (arXiv:2312.06942)](https://arxiv.org/abs/2312.06942) o documento canônico ICML 2024
- [Redwood Research — Recent AI Control papers index](https://redwoodresearch.substack.com/) Seguimentos de 2024 a 2025
- [UK AISI + METR — Control safety cases](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) operacionalização de laboratórios de fronteira
- [Hubinger et al. — Sleeper Agents (Lesson 7, arXiv:2401.05566)](https://arxiv.org/abs/2401.05566) o modelo de controlo de ameaças assume
