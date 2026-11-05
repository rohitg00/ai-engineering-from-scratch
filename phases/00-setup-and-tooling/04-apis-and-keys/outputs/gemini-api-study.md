# Estudo de APIs com Gemini

## Objetivo

Praticar o consumo de APIs de modelos de linguagem (LLMs), utilizando o Google Gemini por meio de duas abordagens: o SDK oficial do Python e requisições HTTP diretas.

## Ambiente utilizado

- Python
- Ambiente virtual (`venv`)
- Biblioteca `google-genai`
- Biblioteca `python-dotenv`
- `urllib.request` para requisições HTTP
- API do Google Gemini

## Configuração da chave de API

A chave é armazenada em um arquivo `.env` na raiz do repositório:

```env
GEMINI_API_KEY=sua_chave_aqui
```

O arquivo `.env` não deve ser enviado ao GitHub. A chave é carregada no Python com `python-dotenv`:

```python
import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
```

Nunca publique sua chave em código, capturas de tela ou arquivos versionados.

## 1. Consumo da API com o SDK

Arquivo: `testar_gemini.py`

O SDK oficial `google-genai` simplifica a comunicação com a API. Ele permite criar um cliente, enviar uma pergunta e acessar a resposta sem precisar montar manualmente a requisição HTTP.

Principais etapas:

1. Carregar a chave do ambiente.
2. Criar o cliente Gemini.
3. Enviar uma pergunta com `generate_content`.
4. Exibir a resposta ou tratar uma exceção.

## 2. Consumo da API via HTTP

Arquivo: `testar_gemini_http.py`

Nesta abordagem, a requisição é construída manualmente com `urllib.request`.

O código:

1. Monta a URL do endpoint `generateContent`.
2. Envia a chave no cabeçalho `x-goog-api-key`.
3. Constrói o corpo da requisição em JSON.
4. Realiza uma requisição `POST`.
5. Interpreta a resposta JSON retornada pela API.

Essa abordagem ajuda a compreender o funcionamento da comunicação HTTP por trás dos SDKs.

## Diferenças entre SDK e HTTP

| SDK oficial | HTTP direto |
|---|---|
| Código mais simples e abstrato | Controle explícito da requisição |
| Cliente gerenciado pela biblioteca | URL, cabeçalhos e JSON montados manualmente |
| Resposta tratada pelo SDK | Resposta interpretada a partir do JSON |
| Depende da biblioteca `google-genai` | Utiliza ferramentas HTTP da biblioteca padrão |

## Como executar

Ative o ambiente virtual:

```bash
source ~/estudos-ia/.venv/bin/activate
```

Na raiz do repositório, execute o teste com SDK:

```bash
python testar_gemini.py
```

Para executar a versão HTTP:

```bash
python testar_gemini_http.py
```

Os dois arquivos devem estar na raiz do repositório, conforme a organização atual dos estudos.

## Aprendizados

- Armazenamento de credenciais em variáveis de ambiente.
- Uso de arquivos `.env` com `python-dotenv`.
- Consumo de APIs de modelos de linguagem.
- Diferenças entre SDKs e requisições HTTP.
- Construção e interpretação de dados JSON.
- Tratamento básico de erros em chamadas de API.

## Observações

A disponibilidade dos modelos pode mudar. Se uma chamada falhar, verifique o nome do modelo disponível, a chave de API, os limites de uso e as mensagens de erro retornadas.

Este material registra uma adaptação prática dos estudos de APIs para utilizar o Gemini, mantendo os exemplos originais do curso separados.
