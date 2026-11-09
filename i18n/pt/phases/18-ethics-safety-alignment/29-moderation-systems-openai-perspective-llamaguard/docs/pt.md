# Sistemas de moderação  OpenAI, Perspectiva, Guarda Lama

> Os sistemas de moderação da produção operationalizam as políticas de segurança definidas nas lições 12-16.`omni-moderation-latest`(2024) baseado no GPT-4o classifica texto + imagens em uma chamada; 42% melhor no conjunto de testes multilíngue do que na versão anterior; o esquema de resposta retorna 13 categorias booleanos  assédio, assédio/ameaça, ódio, ódio/ameaça, ilícito, ilícito/violento, auto-harm, auto-harm/intenção, auto-harm/instruções, sexual, sexual/minores, violência, violência/gráfica; gratuito para a maioria dos desenvolvedores. Padrões em camadas: moderação de entrada (pre-geração), moderação de saída (pós-geração), moderação personalizada (regras de domínio). As chamadas paralelas async ocultam a latência; uma resposta de placeholder pode cobrir a espera enquanto a moderação de entrada é concluída. Llama Guard 3/4 (Lessão 16): 14 perigos de MLCommons, Abuso de intérpretes de código, 8 línguas (v3), multi-imagem (v4). API de perspectiva (Google Jigsaw): pontuação de toxicidade anterior à onda de LLM como moderador; toxicidade primariamente de uma dimensão única com variantes de toxicidade grave/insulto/profaneidade; linha de base para pesquisas de moderamento de conteúdo. Deprecações: Moderador de Conteúdo do Azure foi demorado em fevereiro de 2024, aposentado em fevereiro de 2027, substituído pela Segurança de Conteúdo do Azure AI.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, three-layer moderation harness)
**Prerequisites:** Phase 18 · 16 (Llama Guard / Garak / PyRIT)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Descreva a taxonomia de categoria da API OpenAI Moderation e como ela difere do conjunto de MLCommons do Llama Guard 3.
- Descreva os três padrões de camada de moderação (entrada, saída e personalização) e nomeie um modo de falha de cada um.
- Descreva a posição da API Perspective como uma linha de base pré-LLM e por que continua a ser utilizada na pesquisa.
- Indicar a linha de tempo de depreciação do Azure.

## O problema

As lições 12-16 descrevem ataques e ferramentas de defesa. A lição 29 abrange os sistemas de moderação implantados que operationalizam as defesas na superfície onde os usuários tocam o produto.

## O conceito

### API de Moderação OpenAI

`omni-moderation-latest`(2024). Construído em GPT-4o. Classifica texto + imagens em uma chamada. Gratuito para a maioria dos desenvolvedores.

Categorias (13 booleanos no esquema de resposta):
- acoso, acoso/ameaça
- ódio, ódio/ameaça
- Auto-leão, auto-leão/intenção, auto-leão/instruções
- Sexual, sexual/menores
- Violência, violência/grafica
- Ilícito, ilícito/violento

O apoio multimodal é aplicável a `violence`- Não .`self-harm`, e `sexual`Mas não .`sexual/minors`O resto é apenas de texto.

Para o código de arnesamento em `code/main.py`Nós derrubamos o `/threatening`- Não .`/intent`- Não .`/instructions`, e `/graphic`O código de produção deve utilizar o esquema completo de 13 categorias.

O resultado da avaliação é de 42% melhor no conjunto de testes multilíngues do que o ponto final de moderação da geração anterior.

### Guarda de lama 3/4

Coberto na lição 16. 14 MLCommons categorias de perigo (organizada de forma diferente dos 13 booleanos de esquema de resposta da OpenAI). Suporta 8 idiomas (v3). Llama Guard 4 (abril de 2025) é nativamente multimodal, 12B.

As taxonomias OpenAI e Llama Guard se sobrepõem, mas divergem. OpenAI tem "ilícito" como uma categoria ampla; Llama Guard tem "crimes violentos" e "crimes não violentos" separadamente.

### API de perspectiva (Google Jigsaw)

Sistema de pontuação de toxicidade anterior à onda LLM-as-moderador (antes de 2020). Categorias: TOXICITY, SEVERE_TOXICITY, INSULT, PROFANITY, THREAT, IDENTITY_ATTACK. Ponto de pontuação primária de uma única dimensão (TOXICITY) com variantes sub-dimensionais.

amplamente utilizado como uma linha de base de pesquisa de moderação de conteúdo porque a API é estável, documentada e tem anos de dados de calibração. Para casos de uso modernos LLM adjacentes, Llama Guard ou OpenAI Moderation é tipicamente um melhor ajuste.

### O padrão de três camadas

1. **Input moderation.**Classificar o prompt do usuário antes da geração. Rejeitar se marcado. Latência: uma chamada de classificador.
2. **Output moderation.**Classificar a saída do modelo antes da entrega. Substitua-a por uma recusa se sinalizada. Latência: um classificador chamada após geração.
3. **Custom moderation.**Regras específicas de domínio (regex, permissivos, política empresarial).

As três camadas são sequenciais por conceção: a moderação de entrada deve ser concluída antes da geração e a moderação de saída corre após a geração. O paralelismo se aplica dentro de uma camada  executando vários classificadores (por exemplo, OpenAI Moderation + Llama Guard + Perspective) simultaneamente no mesmo texto oculta a latência por classificador. Como uma otimização opcional, uma resposta de colocação ("um momento, verificação...") pode ser mostrada enquanto a moderação de entrada é concluída e o streaming token-1 é adiado. O comportamento da bandeira é configurável: rejeitar, desinfeccionar, escalar para revisão humana.

### Modos de falha

- **Input only.**Não capta alucinações de saída (Lessão 12-14 de codificação de ataques contornar classificadores de entrada).
- **Output only.**Permite que qualquer entrada chegue ao modelo; aumenta o custo; faz com que o atacante tenha raciocínio interno.
- **Custom only.**Não são robustos em todas as categorias; os regexes são frágeis.

A camada é o padrão.

### Deprecação do Azure

Moderador de Conteúdo do Azure: desfeito em fevereiro de 2024, aposentado em fevereiro de 2027. Substituído por Azure AI Content Safety, que é baseado em LLM e integra-se com Azure OpenAI. A migração é um projeto de nível de campo de 2024-2027 para implementações do Azure.

### Onde isto encaixa na Fase 18

A lição 16 abrange as ferramentas de moderação no contexto da equipe vermelha. A lição 29 abrange a moderação implementada. A lição 30 encerra com a evidência atual de capacidade de duplo uso.

```figure
an-moderation-layers
```

## Usá-lo

`code/main.py`Construi um arsenal de moderação de três camadas: moderador de entrada (palavra-chave + pontuação de categoria), moderador de saída (o mesmo classificador na saída), moderador personalizado (regras de domínio).

## Envia-o

Esta lição produz`outputs/skill-moderation-stack.md`- Em função da implantação, recomenda uma configuração de pilha de moderação: qual classificador em entrada, qual em saída, quais regras personalizadas e qual juiz para casos de borda.

## Exercícios

1. Corra .`code/main.py`- Faça uma entrada benigna, de limite e prejudicial através das três camadas.

2. Estender o arame com uma pontuação de toxicidade no estilo Perspective-API em uma categoria específica.

3. Leia os documentos da API de Moderação do OpenAI e a lista de categoria Llama Guard 3. Mapear cada categoria do OpenAI para as categorias de Llama Guard mais próximas. Identifique três categorias que não mapeam limpo.

4. Desenhar uma pilha de moderação para uma implementação de assistente de código (por exemplo, GitHub Copilot). Identificar as categorias mais e menos relevantes e propor regras personalizadas.

5. O Moderador de Conteúdo do Azure retira-se em fevereiro de 2027. Planeje uma migração para a Segurança de Conteúdo do Azure AI. Identifique o elemento de maior risco da migração.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| OpenAI Moderation | "omni-moderation-latest" | GPT-4o-based 13-category (text) classifier with partial multimodal support |
| Perspective API | "Google Jigsaw toxicity" | Pre-LLM-era toxicity scoring baseline |
| Llama Guard | "MLCommons 14-category" | Meta's hazard classifier (v3: 8B text, 8 langs; v4: 12B multimodal) |
| Input moderation | "pre-generation filter" | Classifier on user prompt before model call |
| Output moderation | "post-generation filter" | Classifier on model output before delivery |
| Custom moderation | "domain rules" | Deployment-specific rules (regex, allowlist, policy) |
| Layered moderation | "all three layers" | Standard production deployment pattern |

## Mais leitura

- [OpenAI Moderation API docs](https://platform.openai.com/docs/api-reference/moderations) ponto final de omni-moderação
- [Meta PurpleLlama + Llama Guard](https://github.com/meta-llama/PurpleLlama) Llama Guard repo
- [Google Jigsaw Perspective API](https://perspectiveapi.com/) pontuação da toxicidade
- [Azure AI Content Safety](https://learn.microsoft.com/en-us/azure/ai-services/content-safety/) Substituição do Azure
