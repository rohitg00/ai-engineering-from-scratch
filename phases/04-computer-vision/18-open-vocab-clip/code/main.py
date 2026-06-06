import torch
import torch.nn as nn
import torch.nn.functional as F


class TwoTower(nn.Module):
    def __init__(self, img_in=128, txt_in=64, emb=64):
        super().__init__()
        self.image_proj = nn.Sequential(nn.Linear(img_in, 128), nn.ReLU(), nn.Linear(128, emb))
        self.text_proj = nn.Sequential(nn.Linear(txt_in, 128), nn.ReLU(), nn.Linear(128, emb))
        self.logit_scale = nn.Parameter(torch.ones([]) * 2.6592)

    def encode_image(self, x):
        return F.normalize(self.image_proj(x), dim=-1)

    def encode_text(self, x):
        return F.normalize(self.text_proj(x), dim=-1)

    def forward(self, img_feats, txt_feats):
        i = self.encode_image(img_feats)
        t = self.encode_text(txt_feats)
        return i, t, self.logit_scale.exp()


def clip_loss(i, t, logit_scale):
    N = i.size(0)
    sim = logit_scale * i @ t.T
    targets = torch.arange(N, device=sim.device)
    l_i = F.cross_entropy(sim, targets)
    l_t = F.cross_entropy(sim.T, targets)
    return (l_i + l_t) / 2


@torch.no_grad()
def zero_shot_classify(model, image_feats, class_text_feats, class_names):
    i = model.encode_image(image_feats)
    t = model.encode_text(class_text_feats)
    sim = i @ t.T
    pred = sim.argmax(dim=-1)
    return [class_names[p] for p in pred.tolist()]


def main():
    torch.manual_seed(0)
    model = TwoTower()

    print("[random batch sanity]")
    img = torch.randn(8, 128)
    txt = torch.randn(8, 64)
    i, t, scale = model(img, txt)
    loss = clip_loss(i, t, scale)
    print(f"  batch {i.size(0)}  loss={loss.item():.3f}  expected~log(8)={torch.log(torch.tensor(8.0)).item():.3f}")

    print("\n[train on structured synthetic pairs]")
    rng = torch.Generator().manual_seed(42)
    dim = 32
    num_classes = 5
    proto = F.normalize(torch.randn(num_classes, dim, generator=rng), dim=-1)

    def sample_pair_batch(batch=32):
        labels = torch.randint(0, num_classes, (batch,))
        img = torch.randn(batch, 128)
        txt = torch.randn(batch, 64)
        img[:, :dim] = proto[labels] + 0.1 * torch.randn(batch, dim)
        txt[:, :dim] = proto[labels] + 0.1 * torch.randn(batch, dim)
        return img, txt, labels

    opt = torch.optim.Adam(model.parameters(), lr=3e-3)
    for step in range(100):
        img_b, txt_b, _ = sample_pair_batch(32)
        i_emb, t_emb, s = model(img_b, txt_b)
        loss = clip_loss(i_emb, t_emb, s)
        opt.zero_grad(); loss.backward(); opt.step()
        if step % 20 == 0:
            print(f"  step {step:3d}  loss {loss.item():.3f}")

    print("\n[zero-shot on held-out images]")
    class_text = torch.zeros(num_classes, 64)
    class_text[:, :dim] = proto
    test_img, _, test_labels = sample_pair_batch(batch=16)
    class_names = [f"class_{c}" for c in range(num_classes)]
    preds = zero_shot_classify(model, test_img, class_text, class_names)
    correct = sum(p == f"class_{l}" for p, l in zip(preds, test_labels.tolist()))
    print(f"  zero-shot accuracy: {correct}/16 = {correct / 16:.3f}")


if __name__ == "__main__":
    main()
