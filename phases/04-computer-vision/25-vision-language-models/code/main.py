import torch
import torch.nn as nn
import torch.nn.functional as F


class Projector(nn.Module):
    def __init__(self, vit_dim=32, llm_dim=64, hidden=64):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(vit_dim, hidden),
            nn.GELU(),
            nn.Linear(hidden, llm_dim),
        )

    def forward(self, x):
        return self.net(x)


class ToyVLM(nn.Module):
    def __init__(self, vit_dim=32, llm_dim=64, num_classes=5):
        super().__init__()
        self.projector = Projector(vit_dim, llm_dim, hidden=64)
        self.head = nn.Linear(llm_dim, num_classes)

    def forward(self, vision_tokens):
        projected = self.projector(vision_tokens)
        pooled = projected.mean(dim=1)
        return self.head(pooled)


def cross_modal_error_rate(image_emb, text_emb, text_confidence,
                           sim_threshold=0.25, conf_threshold=0.8):
    image_emb = F.normalize(image_emb, dim=-1)
    text_emb = F.normalize(text_emb, dim=-1)
    sim = (image_emb * text_emb).sum(dim=-1)
    high_conf_low_sim = (text_confidence > conf_threshold) & (sim < sim_threshold)
    return high_conf_low_sim.float().mean().item()


def deepstack_features(per_layer_features):
    """
    Simulate DeepStack: per_layer_features is list of (N_patches, d) tensors
    from multiple ViT depths. Stack along channel dim and project.
    """
    return torch.cat(per_layer_features, dim=-1)


def synthetic_vision_class_data(num_classes=5, num_patches=16, d_vit=32, per_class=40, seed=0):
    g = torch.Generator().manual_seed(seed)
    proto = torch.randn(num_classes, d_vit, generator=g)
    X = []
    Y = []
    for c in range(num_classes):
        for _ in range(per_class):
            base = proto[c].unsqueeze(0).expand(num_patches, -1)
            noise = 0.1 * torch.randn(num_patches, d_vit, generator=g)
            X.append(base + noise)
            Y.append(c)
    return torch.stack(X), torch.tensor(Y)


def main():
    torch.manual_seed(0)

    print("[toy vlm: train projector + head on synthetic vision tokens]")
    X, Y = synthetic_vision_class_data()
    split = int(0.85 * len(X))
    x_tr, y_tr = X[:split], Y[:split]
    x_va, y_va = X[split:], Y[split:]
    print(f"  train {len(x_tr)}, val {len(x_va)}")

    model = ToyVLM(vit_dim=32, llm_dim=64, num_classes=5)
    opt = torch.optim.Adam(model.parameters(), lr=3e-3)
    for step in range(150):
        idx = torch.randperm(len(x_tr))[:32]
        logits = model(x_tr[idx])
        loss = F.cross_entropy(logits, y_tr[idx])
        opt.zero_grad(); loss.backward(); opt.step()
        if step % 30 == 0:
            with torch.no_grad():
                acc = (model(x_va).argmax(-1) == y_va).float().mean().item()
            print(f"  step {step:3d}  ce {loss.item():.3f}  val_acc {acc:.3f}")

    print("\n[deepstack concatenation]")
    layers = [torch.randn(4, 16, 32) for _ in range(3)]  # 3 ViT depths
    stacked = deepstack_features(layers)
    print(f"  3 layers of (4, 16, 32) -> deepstack {tuple(stacked.shape)}")

    print("\n[CMER simulation]")
    # Simulated scenario: 8 outputs, half hallucinate (low sim, high conf)
    image = F.normalize(torch.randn(8, 32), dim=-1)
    text_good = image + 0.05 * torch.randn_like(image)
    text_good = F.normalize(text_good, dim=-1)
    text_bad = F.normalize(torch.randn(8, 32), dim=-1)
    text = torch.cat([text_good[:4], text_bad[4:]], dim=0)
    conf = torch.tensor([0.95, 0.9, 0.88, 0.85, 0.92, 0.9, 0.87, 0.91])
    cmer = cross_modal_error_rate(image, text, conf)
    print(f"  CMER = {cmer:.3f}  (expected ~0.5 with 4 hallucinations out of 8)")


if __name__ == "__main__":
    main()
