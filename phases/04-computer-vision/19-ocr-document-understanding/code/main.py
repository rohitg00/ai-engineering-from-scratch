import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F


VOCAB = ["_"] + list("0123456789abcdefghijklmnopqrstuvwxyz")


def ctc_loss(log_probs, targets, input_lengths, target_lengths, blank=0):
    return F.ctc_loss(log_probs, targets, input_lengths, target_lengths,
                      blank=blank, reduction="mean", zero_infinity=True)


def greedy_ctc_decode(log_probs, blank=0):
    preds = log_probs.argmax(dim=-1).transpose(0, 1).cpu().tolist()
    out = []
    for seq in preds:
        decoded = []
        prev = None
        for idx in seq:
            if idx != prev and idx != blank:
                decoded.append(idx)
            prev = idx
        out.append(decoded)
    return out


class TinyCRNN(nn.Module):
    def __init__(self, vocab_size=len(VOCAB), hidden=128, feat=32):
        super().__init__()
        self.cnn = nn.Sequential(
            nn.Conv2d(1, feat, 3, 1, 1), nn.BatchNorm2d(feat), nn.ReLU(inplace=True),
            nn.MaxPool2d(2),
            nn.Conv2d(feat, feat * 2, 3, 1, 1), nn.BatchNorm2d(feat * 2), nn.ReLU(inplace=True),
            nn.MaxPool2d(2),
            nn.Conv2d(feat * 2, feat * 4, 3, 1, 1), nn.BatchNorm2d(feat * 4), nn.ReLU(inplace=True),
            nn.MaxPool2d((2, 1)),
            nn.Conv2d(feat * 4, feat * 4, 3, 1, 1), nn.BatchNorm2d(feat * 4), nn.ReLU(inplace=True),
            nn.MaxPool2d((2, 1)),
        )
        self.rnn = nn.LSTM(feat * 4, hidden, bidirectional=True, batch_first=True)
        self.head = nn.Linear(hidden * 2, vocab_size)

    def forward(self, x):
        f = self.cnn(x)
        f = f.mean(dim=2).transpose(1, 2)
        h, _ = self.rnn(f)
        return F.log_softmax(self.head(h).transpose(0, 1), dim=-1)


def synthetic_line(text, height=32, char_width=16):
    W = char_width * max(1, len(text))
    img = np.ones((height, W), dtype=np.float32)
    for i, c in enumerate(text):
        x = i * char_width
        shade = 0.0 if c.isalnum() else 0.5
        img[6:height - 6, x + 2:x + char_width - 2] = shade
    return img


def build_batch(strings, max_len=None):
    H = 32
    max_len = max_len or max(len(s) for s in strings)
    W = 16 * max_len
    imgs = np.ones((len(strings), 1, H, W), dtype=np.float32)
    targets = []
    target_lengths = []
    for i, s in enumerate(strings):
        line = synthetic_line(s)
        imgs[i, 0, :, :line.shape[1]] = line
        ids = [VOCAB.index(c) for c in s]
        targets.extend(ids)
        target_lengths.append(len(ids))
    return torch.from_numpy(imgs), torch.tensor(targets, dtype=torch.long), torch.tensor(target_lengths, dtype=torch.long)


def decode_to_str(ids):
    return "".join(VOCAB[i] for i in ids)


def main():
    torch.manual_seed(0)
    model = TinyCRNN()
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    print(f"params: {sum(p.numel() for p in model.parameters()):,}")

    train_strings = [f"abc{d}" for d in range(10)] + [f"xy{d}{d+1}" for d in range(10)]
    for step in range(200):
        idx = np.random.choice(len(train_strings), 8)
        strings = [train_strings[i] for i in idx]
        imgs, targets, target_lens = build_batch(strings, max_len=5)
        log_probs = model(imgs)
        input_lens = torch.full((imgs.size(0),), log_probs.size(0), dtype=torch.long)
        loss = ctc_loss(log_probs, targets, input_lens, target_lens, blank=0)
        opt.zero_grad(); loss.backward(); opt.step()
        if step % 40 == 0:
            print(f"step {step:3d}  loss {loss.item():.3f}")

    model.eval()
    test_strings = ["abc7", "xy45", "abc2"]
    imgs, _, _ = build_batch(test_strings, max_len=5)
    with torch.no_grad():
        log_probs = model(imgs)
    preds = [decode_to_str(ids) for ids in greedy_ctc_decode(log_probs)]
    for target, pred in zip(test_strings, preds):
        match = "ok" if target == pred else "diff"
        print(f"  target {target!r:10s} -> pred {pred!r:10s}  {match}")


if __name__ == "__main__":
    main()
