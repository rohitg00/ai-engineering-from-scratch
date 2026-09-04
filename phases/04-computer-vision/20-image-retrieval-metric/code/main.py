import torch
import torch.nn as nn
import torch.nn.functional as F


def triplet_loss(anchor, positive, negative, margin=0.2):
    d_ap = F.pairwise_distance(anchor, positive, p=2)
    d_an = F.pairwise_distance(anchor, negative, p=2)
    return F.relu(d_ap - d_an + margin).mean()


def semi_hard_negatives(emb, labels, margin=0.2):
    dist = torch.cdist(emb, emb)
    same_class = labels[:, None] == labels[None, :]
    N = emb.size(0)

    positives = dist.clone()
    positives[~same_class] = float("-inf")
    positives.fill_diagonal_(float("-inf"))
    pos_idx = positives.argmax(dim=1)

    # Semi-hard: d_ap < d_an < d_ap + margin. Exclude same-class, diagonals,
    # negatives closer than the positive, and those past the margin boundary.
    semi_hard = dist.clone()
    semi_hard[same_class] = float("inf")
    d_ap = dist[torch.arange(N), pos_idx].unsqueeze(1)
    semi_hard[dist <= d_ap] = float("inf")
    semi_hard[dist >= d_ap + margin] = float("inf")
    neg_idx = semi_hard.argmin(dim=1)

    fallback = semi_hard[torch.arange(N), neg_idx] == float("inf")
    if fallback.any():
        hardest = dist.clone()
        hardest[same_class] = float("inf")
        neg_idx = torch.where(fallback, hardest.argmin(dim=1), neg_idx)
    return pos_idx, neg_idx


def recall_at_k(query_emb, gallery_emb, query_labels, gallery_labels, k=1):
    sim = query_emb @ gallery_emb.T
    _, top_k = sim.topk(k, dim=-1)
    matches = (gallery_labels[top_k] == query_labels[:, None]).any(dim=-1)
    return matches.float().mean().item()


class Encoder(nn.Module):
    def __init__(self, in_dim=128, emb_dim=64):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, 128), nn.ReLU(),
            nn.Linear(128, emb_dim),
        )

    def forward(self, x):
        return F.normalize(self.net(x), dim=-1)


def main():
    torch.manual_seed(0)
    num_classes = 6
    dim = 128
    protos = F.normalize(torch.randn(num_classes, dim), dim=-1)

    def sample(bs=48):
        labels = torch.randint(0, num_classes, (bs,))
        x = protos[labels] + 0.15 * torch.randn(bs, dim)
        return x, labels

    enc = Encoder(in_dim=dim, emb_dim=64)
    opt = torch.optim.Adam(enc.parameters(), lr=3e-3)

    for step in range(200):
        x, y = sample(48)
        emb = enc(x)
        pos_idx, neg_idx = semi_hard_negatives(emb, y)
        loss = triplet_loss(emb, emb[pos_idx], emb[neg_idx])
        opt.zero_grad(); loss.backward(); opt.step()
        if step % 40 == 0:
            print(f"step {step:3d}  triplet {loss.item():.4f}")

    enc.eval()
    with torch.no_grad():
        gx, gy = sample(200)
        g_emb = enc(gx)
        qx, qy = sample(50)
        q_emb = enc(qx)
        for k in [1, 5, 10]:
            r = recall_at_k(q_emb, g_emb, qy, gy, k=k)
            print(f"  recall@{k}: {r:.3f}")


if __name__ == "__main__":
    main()
