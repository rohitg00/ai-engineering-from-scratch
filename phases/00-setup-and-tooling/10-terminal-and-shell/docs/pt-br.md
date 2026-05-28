# Terminal e Shell

> O terminal é onde engenheiros de IA vivem. Conforto aqui.

**Tipo:** Learn
**Linguagens:** --
**Pré-requisitos:** Fase 0, Aula 01
**Tempo:** ~35 minutos

## Objetivos de Aprendizado

- Usar piping, redirects e `grep` para filtrar e processar logs de treino da linha de comando
- Criar sessões persistentes de tmux com múltiplos painéis para treino e monitoramento de GPU concorrentes
- Monitorar recursos do sistema e GPU com `htop`, `nvtop` e `nvidia-smi`
- Transferir arquivos entre máquinas locais e remotas usando SSH, `scp` e `rsync`

## O Problema

Você vai gastar mais tempo no terminal do que em qualquer editor. Runs de treino, monitoramento de GPU, acompanhamento de logs, sessões SSH remotas, gerenciamento de ambiente. Todo fluxo de trabalho de IA toca o shell. Se você é lento aqui, é lento em tudo.

Esta aula cobre as habilidades de terminal que importam para trabalho de IA. Sem história do Unix. Sem aprofundamento em scripting Bash. Só o que você precisa.

## Construa

### Passo 1: Conheça seu shell

```bash
echo $SHELL
```

A maioria dos sistemas usa `bash` ou `zsh`. Ambos funcionam bem.

### Passo 2: Piping e redirects

```bash
# Conte quantas vezes "loss" aparece num log
cat train.log | grep "loss" | wc -l

# Extraia só os valores de loss da saída de treino
grep "loss:" train.log | awk '{print $NF}' > losses.txt

# Acompanhe um arquivo de log em tempo real, filtrando por erros
tail -f train.log | grep --line-buffered "ERROR"
```

Os três redirects que você precisa:

| Símbolo | O que faz |
|---------|----------|
| `>` | Escrever stdout no arquivo (sobrescrever) |
| `>>` | Acrescentar stdout ao arquivo |
| `2>` | Escrever stderr no arquivo |
| `2>&1` | Enviar stderr pro mesmo lugar que stdout |
| `\|` | Enviar stdout de um comando como stdin pro próximo |

### Passo 3: Processos em background

```bash
# Rodar em background (saída ainda vai pro terminal)
python train.py &

# Rodar em background, imune a hangup (fechar terminal não mata)
nohup python train.py > train.log 2>&1 &

# Ver o que está rodando em background
jobs
ps aux | grep train.py

# Trazer job de background pro foreground
fg %1

# Matar um processo de background
kill %1
```

| Método | Sobrevive ao fechar terminal? | Pode reconectar? |
|--------|------------------------------|------------------|
| `command &` | Não | Não |
| `nohup command &` | Sim | Não (checar arquivo de log) |
| `screen` / `tmux` | Sim | Sim |

Para qualquer coisa maior que alguns minutos, use tmux.

### Passo 4: tmux

tmux permite criar sessões de terminal persistentes com múltiplos painéis. Esta é a ferramenta mais útil para gerenciar runs de treino.

```bash
# Instalar
# macOS
brew install tmux
# Ubuntu
sudo apt install tmux

# Iniciar sessão nomeada
tmux new -s training

# Dividir horizontalmente
# Ctrl+B depois "

# Dividir verticalmente
# Ctrl+B depois %

# Navegar entre painéis
# Ctrl+B depois setas

# Desanexar (sessão continua rodando)
# Ctrl+B depois d

# Reconectar
tmux attach -t training

# Listar sessões
tmux ls
```

### Passo 5: Monitoramento com htop e nvtop

```bash
# Processos do sistema (melhor que top)
htop

# Processos de GPU (se tiver NVIDIA GPU)
nvtop

# Checagem rápida de GPU sem nvtop
nvidia-smi

# Acompanhe uso da GPU atualizando a cada segundo
watch -n1 nvidia-smi
```

### Passo 6: SSH para caixas de GPU remotas

```bash
# Conexão básica
ssh user@gpu-box-ip

# Com chave eespecificaçãoífica
ssh -i ~/.ssh/my_gpu_key user@gpu-box-ip

# Copiar arquivos pro remote
scp model.pt user@gpu-box-ip:~/models/

# Copiar arquivos do remote
scp user@gpu-box-ip:~/results/metrics.json ./

# Sincronizar diretório inteiro (mais rápido pra muitos arquivos)
rsync -avz ./data/ user@gpu-box-ip:~/data/

# Forward de porta (acessar Jupyter/TensorBoard remoto localmente)
ssh -L 8888:localhost:8888 user@gpu-box-ip
```

### Passo 7: Aliases úteis para IA

```bash
# Status da GPU num olhar
alias gpu='nvidia-smi --consulta-gpu=index,name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader'

# Matar todos os processos Python de treino
alias killtraining='pkill -f "python.*train"'

# Ativação rápida de ambiente virtual
alias ae='source .venv/bin/activate'

# Acompanhar loss de treino
alias watchloss='tail -f logs/*.log | grep --line-buffered "loss"'
```

## Use

| Ferramenta | Quando você usa |
|-----------|----------------|
| tmux | Todo run de treino (Fases 3+) |
| `tail -f` + `grep` | Monitorando logs de treino |
| `nohup` / `&` | Tarefas de background rápidas |
| `htop` / `nvtop` | Debugando treino lento, erros OOM |
| SSH + `rsync` | Trabalhando em GPUs na nuvem |
| Piping + redirects | Processando resultados de experimentos |
| Aliases | Economizando tempo com comandos repetitivos |

## Exercícios

1. Instale o tmux, crie uma sessão com três painéis e rode `htop` em um, `watch -n1 date` em outro e um script Python no terceiro. Desanexe e reconecte.
2. Adicione os aliases de `code/shell_aliases.sh` à configuração do seu shell e recarregue com `source ~/.zshrc` (ou `~/.bashrc`).
3. Crie um log de treino falso com `for i in $(seq 1 100); do echo "epoch $i loss: $(echo "scale=4; 1/$i" | bc)"; sleep 0.1; done > fake_train.log` e depois use `grep`, `tail` e `awk` para extrair só os valores de loss.
4. Configure uma entrada de SSH config para um servidor que você tem acesso (ou use `localhost` pra praticar a sintaxe).
