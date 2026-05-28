# Sistemas de Moderação — OpenAI, Perespecificaçãotive, Llama Guard

> Sistemas de moderação em produção operacionalizam as políticas de segurança definidas nas Lições 12-16. OpenAI Moderation API: `omni-moderation-latest` (2024) construído sobre GPT-4o classifica texto + imagens em uma chamada; 42% melhor no conjunto de teste multilíngue que a versão anterior; o schema de resposta retorna 13 booleanos de categoria — assédio, assédio/ameaçante, ódio, ódio/ameaçante, ilícito, ilícito/violento, autolesão, autolesão/intenção, autolesão/instruções, sexual, sexual/menores, violência, violência/gráfico; gratuito para maioria dos desenvolvedores. Padrões em camadas: moderação de entrada (pré-geração), moderação de saída (pós-geração), moderação customizada (regras de domínio). Chamadas paralelas assíncronas escondem latência; respostas placeholder em caso de flag. Llama Guard 3/4 (Lição 16): 14 categorias de perigo MLCommons, Code Interpreter Abuse, 8 idiomas (v3), multi-imagem (v4). Perespecificaçãotive API (Google Jigsaw): pontuação de toxicidade que precede a onda de LLM-como-moderador; principalmente toxicidade unidimensional com variantes de toxicidade-grave/insulto/profanidade; referência para pesquisa de moderação de conteúdo. Descontinuações: Azure Content Moderator descontinuado fevereiro 2024, aposentado fevereiro 2027, substituído por Azure AI Content Safety.

**Tipo:** Construir
**Linguagens:** Python (stdlib, harness de moderação em três camadas)
**Pré-requisitos:** Fase 18 · 16 (Llama Guard / Garak / PyRIT)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Descrever a taxonomia de categorias da OpenAI Moderation API e como difere do conjunto MLCommons do Llama Guard 3.
- Descrever o padrão de três camadas de moderação (entrada, saída, customizada) e nomear um modo de falha de cada uma.
- Descrever a posição da Perespecificaçãotive API como referência pré-era-LLM e por que continua sendo usada em pesquisa.
- Enunciar o cronograma de descontinuação da Azure.

## O Problema

Lições 12-16 descrevem ferramentas de ataque e defesa. Lição 29 cobre os sistemas de moderação implantados que operacionalizam as defesas na superfície onde os usuários tocam o produto. O padrão de três camadas é a configuração padrão de 2026.

## O Conceito

### OpenAI Moderation API

`omni-moderation-latest` (2024). Construído sobre GPT-4o. Classifica texto + imagens em uma chamada. Gratuito para maioria dos desenvolvedores.

Categorias (13 booleanos no schema de resposta):
- assédio, assédio/ameaçante
- ódio, ódio/ameaçante
- autolesão, autolesão/intenção, autolesão/instruções
- sexual, sexual/menores
- violência, violência/gráfico
- ilícito, ilícito/violento

Suporte multimodal se aplica a `violência`, `autolesão` e `sexual` mas não a `sexual/menores`; o resto são apenas texto.

Para o harness de código em `code/main.py` colapsamos as sub-categorias `/ameaçante`, `/intenção`, `/instruções` e `/gráfico` em seus pais de nível superior para simplicidade pedagógica. Código de produção deve usar o schema completo de 13 categorias.

42% melhor no conjunto de teste multilíngue que o endpoint de moderação da geração anterior. Pontuações por categoria; aplicações definem limiares.

### Llama Guard 3/4

Coberto na Lição 16. 14 categorias de perigo MLCommons (organizadas de forma diferente dos 13 booleanos do schema de resposta da OpenAI). Suporta 8 idiomas (v3). Llama Guard 4 (abril 2025) é nativamente multimodal, 12B.

As taxonomias da OpenAI e Llama Guard se sobrepõem mas divergem. OpenAI tem "ilícito" como categoria ampla; Llama Guard tem "crimes violentos" e "crimes não-violentos" separadamente. Deploys escolhem com base na adequação de sua política à taxonomia.

### Perespecificaçãotive API (Google Jigsaw)

Sistema de pontuação de toxicidade que precede a onda de LLM-como-moderador (pré-2020). Categorias: TOXICITY, SEVERE_TOXICITY, INSULT, PROFANITY, THREAT, IDENTITY_ATTACK. Pontuação principal unidimensional (TOXICITY) com variantes de sub-dimensão.

Amplamente usado como referência de pesquisa de moderação de conteúdo porque a API é estável, documentada, e tem anos de dados de calibração. Para casos de uso modernos adjacentes a LLM, Llama Guard ou OpenAI Moderation é tipicamente mais adequado.

### O padrão de três camadas

1. **Moderação de entrada.** Classificar o prompt do usuário antes da geração. Rejeitar se sinalizado. Latência: uma chamada de classificador.
2. **Moderação de saída.** Classificar a saída do modelo antes da entrega. Substituir por uma recusa se sinalizado. Latência: uma chamada de classificador após geração.
3. **Moderação customizada.** Regras eespecificaçãoíficas do domínio (regex, listas de permissão, política de negócio). Roda na entrada ou saída.

As três camadas são sequenciais por design: moderação de entrada deve completar antes da geração, e moderação de saída roda após geração. Paralelismo se aplica dentro de uma camada — rodar múltiplos classificadores (ex., OpenAI Moderation + Llama Guard + Perespecificaçãotive) simultaneamente no mesmo texto esconde a latência por classificador. Como otimização opcional, uma resposta placeholder ("um momento, verificando...") pode ser mostrada enquanto moderação de entrada completa e streaming de token-1 é adiado. Comportamento de flag é configurável: recusar, sanitizar, escalar para revisão humana.

### Modos de falha

- **Apenas entrada.** Não pega alucinações de saída (ataques de codificação das Lições 12-14 contornam classificadores de entrada).
- **Apenas saída.** Permite qualquer entrada chegar ao modelo; aumenta custo; expõe raciocínio interno ao atacante.
- **Apenas customizada.** Não robusta entre categorias; regex são frágeis.

Em camadas é o padrão. Cinto e suspensórios.

### Descontinuação da Azure

Azure Content Moderator: descontinuado fevereiro 2024, aposentado fevereiro 2027. Substituído por Azure AI Content Safety, que é baseado em LLM e se integra com Azure OpenAI. A migração é um projeto de campo 2024-2027 para deploys Azure.

### Onde isso se encaixa na Fase 18

Lição 16 cobre ferramentas de moderação no contexto de red-team. Lição 29 cobre moderação implantada. Lição 30 fecha com a evidência atual de capacidade de uso duplo.

## Use

`code/main.py` constrói um harness de moderação em três camadas: moderador de entrada (palavra-chave + pontuação de categoria), moderador de saída (mesmo classificador na saída), moderador customizado (regras de domínio). Você pode rodar entradas e observar qual camada pega o quê.

## Entregue

Esta lição produz `outputs/skill-moderation-stack.md`. Dado um deploy, recomenda uma configuração de stack de moderação: qual classificador na entrada, qual na saída, quais regras customizadas, e qual julgador para casos limite.

## Exercícios

1. Execute `code/main.py`. Rode uma entrada benigna, limite e prejudicial por todas as três camadas. Relate qual camada dispara para cada uma.

2. Estenda o harness com pontuação de toxicidade estilo Perespecificaçãotive-API em uma categoria eespecificaçãoífica. Compare seu comportamento de limiar com a pontuação de categoria.

3. Leia a documentação da OpenAI Moderation API e a lista de categorias do Llama Guard 3. Mapeie cada categoria da OpenAI para as categorias mais próximas do Llama Guard. Identifique três categorias que não mapeiam de forma limpa.

4. Projete uma stack de moderação para um implantação de assistente de código (ex., GitHub Copilot). Identifique as categorias mais e menos relevantes e proponha regras customizadas.

5. O Azure Content Moderator se aposenta fevereiro 2027. Planeje uma migração para Azure AI Content Safety. Identifique o elemento de maior risco da migração.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|---------------------------|
| OpenAI Moderation | "omni-moderation-latest" | Classificador de 13 categorias (texto) baseado em GPT-4o com suporte multimodal parcial |
| Perespecificaçãotive API | "toxicidade do Google Jigsaw" | Referência de pontuação de toxicidade pré-era-LLM |
| Llama Guard | "14 categorias MLCommons" | Classificador de perigos da Meta (v3: 8B texto, 8 idiomas; v4: 12B multimodal) |
| Moderação de entrada | "filtro pré-geração" | Classificador no prompt do usuário antes da chamada ao modelo |
| Moderação de saída | "filtro pós-geração" | Classificador na saída do modelo antes da entrega |
| Moderação customizada | "regras de domínio" | Regras eespecificaçãoíficas do implantação (regex, lista de permissão, política) |
| Moderação em camadas | "as três camadas" | Padrão padrão de implantação em produção |

## Leitura Complementar

- [Documentação da OpenAI Moderation API](https://platform.openai.com/docs/api-reference/moderations) — endpoint omni-moderation
- [Meta PurpleLlama + Llama Guard](https://github.com/meta-llama/PurpleLlama) — repositório do Llama Guard
- [Google Jigsaw Perespecificaçãotive API](https://perespecificaçãotiveapi.com/) — pontuação de toxicidade
- [Azure AI Content Safety](https://learn.microsoft.com/en-us/azure/ai-services/content-safety/) — substituto da Azure
