# Minha primeira imagem Docker para Inteligência Artificial

## Objetivo

Este estudo teve como objetivo criar minha primeira imagem Docker preparada para desenvolvimento em Inteligência Artificial, utilizando Python, PyTorch e CUDA.

A proposta foi compreender como construir um ambiente isolado, com as principais dependências necessárias para executar aplicações de IA.

## Tecnologias utilizadas

- Docker
- Ubuntu 22.04
- Python 3.12
- PyTorch 2.6.0
- CUDA 12.4
- NumPy
- Pandas
- Scikit-learn
- Matplotlib

## 1. Criação do Dockerfile

O primeiro passo foi criar um arquivo chamado `Dockerfile`, responsável por definir a estrutura do ambiente.

A imagem base escolhida foi:

```dockerfile
FROM nvidia/cuda:12.4.1-devel-ubuntu22.04
```

Essa imagem já fornece um ambiente Ubuntu com ferramentas de desenvolvimento CUDA.

No Dockerfile, foram definidos os comandos para instalar o Python, configurar o ambiente e instalar as bibliotecas necessárias.

## 2. Construção da imagem

Com o Dockerfile configurado, executei o comando:

```bash
docker build -t meu-projeto-ia .
```

Esse comando constrói uma imagem chamada `meu-projeto-ia`, utilizando as instruções do Dockerfile presente no diretório atual.

A construção foi concluída com sucesso.

## 3. Verificação da imagem

Para verificar se a imagem havia sido criada corretamente, utilizei:

```bash
docker images
```

A imagem `meu-projeto-ia:latest` foi identificada na listagem do Docker.

## 4. Teste do ambiente

Em seguida, executei um teste para verificar a instalação do PyTorch e a disponibilidade do CUDA:

```bash
docker run --rm meu-projeto-ia python -c "import torch; print('PyTorch:', torch.__version__); print('CUDA disponível:', torch.cuda.is_available())"
```

Resultado obtido:

```text
PyTorch: 2.6.0+cu124
CUDA disponível: False
```

O teste confirmou que o PyTorch estava instalado corretamente.

Entretanto, a GPU não estava disponível dentro do contêiner, pois o Docker ainda não tinha acesso ao driver NVIDIA por meio do WSL.

## 5. Aprendizados

Durante essa prática, compreendi alguns conceitos importantes:

- **Dockerfile:** arquivo que contém as instruções para construir uma imagem.
- **Imagem Docker:** modelo que reúne o ambiente e as dependências de uma aplicação.
- **Contêiner:** instância de uma imagem em execução.
- **CUDA:** plataforma da NVIDIA utilizada para aproveitar o processamento paralelo da GPU.
- **Volume:** recurso que permite compartilhar arquivos entre o computador e o contêiner.

## Conclusão

Essa prática foi meu primeiro contato com a construção de uma imagem Docker voltada para Inteligência Artificial.

Consegui preparar um ambiente com Python, PyTorch e CUDA, construir a imagem e verificar suas dependências.

Também identifiquei a diferença entre ter as bibliotecas CUDA instaladas no contêiner e disponibilizar efetivamente uma GPU para ele.

Este estudo faz parte da minha jornada de aprendizado em Engenharia de IA.
