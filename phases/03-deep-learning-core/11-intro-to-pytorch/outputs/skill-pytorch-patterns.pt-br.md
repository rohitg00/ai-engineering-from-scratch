---
name: skill-pytorch-patterns
description: Padrões de referência para treinamento, avaliação e implantação do PyTorch
version: 1.0.0
phase: 3
lesson: 11
tags: [pytorch, training, deep-learning, gpu, patterns]
---

## Loop de treinamento canônico

```python
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = Model().to(device)
criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=0.01)

for epoch in range(num_epochs):
    model.train()
    for inputs, targets in train_loader:
        inputs, targets = inputs.to(device), targets.to(device)
        optimizer.zero_grad()
        outputs = model(inputs)
        loss = criterion(outputs, targets)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()

    model.eval()
    with torch.no_grad():
        for inputs, targets in val_loader:
            inputs, targets = inputs.to(device), targets.to(device)
            outputs = model(inputs)
```

## Treinamento de precisão mista

```python
from torch.amp import autocast, GradScaler

scaler = GradScaler()
for inputs, targets in train_loader:
    inputs, targets = inputs.to(device), targets.to(device)
    optimizer.zero_grad()
    with autocast(device_type="cuda"):
        outputs = model(inputs)
        loss = criterion(outputs, targets)
    scaler.scale(loss).backward()
    scaler.step(optimizer)
    scaler.update()
```

Use quando: treinar em GPU com hardware compatível com float16 (V100, A100, H100, RTX 3090+). Espere uma aceleração de aproximadamente 1,5-2x e uma redução de memória de aproximadamente 50%.

## Acumulação de gradiente

```python
accumulation_steps = 4
optimizer.zero_grad()
for i, (inputs, targets) in enumerate(train_loader):
    inputs, targets = inputs.to(device), targets.to(device)
    outputs = model(inputs)
    loss = criterion(outputs, targets) / accumulation_steps
    loss.backward()
    if (i + 1) % accumulation_steps == 0:
        optimizer.step()
        optimizer.zero_grad()
```

Use quando: o tamanho efetivo do lote precisa ser maior do que a memória da GPU permite. Dividir a perda por acumulação_passos mantém a escala de gradiente consistente.

## Salvar e carregar

__CODE_BLOCO_3__

Sempre salve o estado do otimizador para retomar o treinamento. Apenas para inferência, salve apenas `model.state_dict()`.

## Conjunto de dados personalizado

```python
class CustomDataset(torch.utils.data.Dataset):
    def __init__(self, data_dir, transform=None):
        self.samples = self._load_samples(data_dir)
        self.transform = transform

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        x, y = self.samples[idx]
        if self.transform:
            x = self.transform(x)
        return x, y

    def _load_samples(self, data_dir):
        ...
```

##Configuração do DataLoader

__CODE_BLOCO_5__

| Parâmetro | O que faz | Quando usar |
|-----------|------------|-------------|
| num_trabalhadores=4 | Carregamento paralelo de dados | Sempre em máquinas multi-core |
| pin_memory=Verdadeiro | Memória CPU bloqueada por página | Ao treinar em GPU |
| drop_last=Verdadeiro | Descartar lote final incompleto | Ao usar BatchNorm |
| persistente_workers=Verdadeiro | Mantenha os trabalhadores vivos em todas as épocas | Quando num_workers > 0 |

## Cronogramas de taxas de aprendizagem

```python
scheduler = torch.optim.lr_scheduler.OneCycleLR(
    optimizer,
    max_lr=1e-3,
    total_steps=num_epochs * len(train_loader),
    pct_start=0.1,
)

for epoch in range(num_epochs):
    for inputs, targets in train_loader:
        ...
        optimizer.step()
        scheduler.step()
```

OneCycleLR: melhor padrão para a maioria das tarefas. Aquece até max_lr e depois o cosseno decai. Chame `scheduler.step()` após cada lote, não em cada época.

## Inicialização de peso

```python
def init_weights(module):
    if isinstance(module, nn.Linear):
        nn.init.kaiming_normal_(module.weight, nonlinearity="relu")
        if module.bias is not None:
            nn.init.zeros_(module.bias)
    elif isinstance(module, nn.Conv2d):
        nn.init.kaiming_normal_(module.weight, mode="fan_out", nonlinearity="relu")

model.apply(init_weights)
```

## Modo de inferência

```python
model.eval()

with torch.inference_mode():
    outputs = model(inputs)
```

`torch.inference_mode()` é mais rápido que `torch.no_grad()` porque desativa totalmente a autogradação, em vez de apenas suprimir o cálculo do gradiente.

## Lista de verificação de erros comuns

1. Aplicando softmax antes de CrossEntropyLoss (inclui log_softmax internamente)
2. Esquecer de chamar model.eval() durante a validação
3. Esquecer de mover os tensores para o mesmo dispositivo do modelo
4. Não chamar optimer.zero_grad() (os gradientes se acumulam por padrão)
5. Usando torch.no_grad() durante o treinamento (desativa o cálculo do gradiente)
6. Definir num_workers muito alto (gera muitos processos, desgasta a memória)
7. Não usar pin_memory=True ao treinar em GPU
8. Salvando todo o objeto do modelo em vez de state_dict (quebras na refatoração)