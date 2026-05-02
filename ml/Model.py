import argparse
import os
import sys
from typing import Tuple, List, Dict

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score
import matplotlib.pyplot as plt

try:
    from . import data as data_mod  # type: ignore
except ImportError:  # pragma: no cover
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    if parent_dir not in sys.path:
        sys.path.append(parent_dir)
    import ml.data as data_mod  # type: ignore


class GradesDataset(Dataset):
    def __init__(self, X_df, y_series):
        self.X = torch.tensor(X_df.values, dtype=torch.float32)
        self.y = torch.tensor(y_series.values, dtype=torch.long)
    def __len__(self):
        return len(self.y)
    def __getitem__(self, idx):
        return self.X[idx], self.y[idx]


class ConvClassifier(nn.Module):
    def __init__(self, total_dim: int, seq_len: int, num_classes: int):
        super().__init__()
        if seq_len > total_dim:
            raise ValueError('seq_len cannot exceed total feature dimension')
        self.seq_len = seq_len
        self.extra_dim = total_dim - seq_len
        self.conv = nn.Sequential(
            nn.Conv1d(1,16,3,padding=1),
            nn.ReLU(),
            nn.Conv1d(16,32,3,padding=1),
            nn.ReLU()
        )
        self.classifier = nn.Sequential(
            nn.Linear(32 + self.extra_dim, 64),
            nn.ReLU(),
            nn.Linear(64, num_classes)
        )
    def forward(self, x):
        grades = x[:, :self.seq_len].unsqueeze(1)
        feats = self.conv(grades).mean(dim=2)
        if self.extra_dim > 0:
            feats = torch.cat([feats, x[:, self.seq_len:]], dim=1)
        return self.classifier(feats)


def build_loaders(X, y, batch_size: int, test_size: float, seed: int = 42) -> Tuple[DataLoader, DataLoader]:
    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=test_size, random_state=seed, stratify=y)
    return (
        DataLoader(GradesDataset(X_train, y_train), batch_size=batch_size, shuffle=True),
        DataLoader(GradesDataset(X_val, y_val), batch_size=batch_size, shuffle=False)
    )


def train(model, train_loader, val_loader, device, epochs: int, lr: float):
    criterion = nn.CrossEntropyLoss()
    optimiz = optim.Adam(model.parameters(), lr=lr)
    model.to(device)
    history: Dict[str, List[float]] = {k: [] for k in ['train_loss','val_loss','val_acc','val_f1']}
    best_acc = 0.0
    for ep in range(1, epochs+1):
        model.train()
        total_loss = 0.0
        for xb, yb in train_loader:
            xb, yb = xb.to(device), yb.to(device)
            optimiz.zero_grad()
            logits = model(xb)
            loss = criterion(logits, yb)
            loss.backward()
            optimiz.step()
            total_loss += loss.item() * xb.size(0)
        train_loss = total_loss / len(train_loader.dataset)

        # Validation pass with loss
        model.eval()
        val_loss_sum = 0.0
        preds_collect = []
        true_collect = []
        with torch.no_grad():
            for xb, yb in val_loader:
                xb, yb = xb.to(device), yb.to(device)
                logits = model(xb)
                loss = criterion(logits, yb)
                val_loss_sum += loss.item() * xb.size(0)
                preds_collect.append(logits.argmax(dim=1).cpu())
                true_collect.append(yb.cpu())
        val_loss = val_loss_sum / len(val_loader.dataset)
        preds_cat = torch.cat(preds_collect)
        true_cat = torch.cat(true_collect)
        acc = accuracy_score(true_cat.numpy(), preds_cat.numpy())
        f1m = f1_score(true_cat.numpy(), preds_cat.numpy(), average='macro')

        history['train_loss'].append(train_loss)
        history['val_loss'].append(val_loss)
        history['val_acc'].append(acc)
        history['val_f1'].append(f1m)

        print(f'Epoch {ep:03d} | TrainLoss {train_loss:.4f} | ValLoss {val_loss:.4f} | ValAcc {acc*100:.2f}% | F1_macro {f1m:.3f}')
        if acc > best_acc:
            best_acc = acc
    return best_acc, history


def main():
    parser = argparse.ArgumentParser(description='Grade bucket classifier (MLP or Conv1D)')
    parser.add_argument('--limit', type=int, default=0)
    parser.add_argument('--scale-grades', action='store_true')
    parser.add_argument('--add-difficulty', action='store_true')
    parser.add_argument('--ten-class', action='store_true')
    parser.add_argument('--bucket-5', action='store_true')
    parser.add_argument('--model-type', type=str, default='mlp', choices=['mlp','conv'])
    parser.add_argument('--seq-len', type=int, default=10)
    parser.add_argument('--epochs', type=int, default=50)
    parser.add_argument('--lr', type=float, default=1e-3)
    parser.add_argument('--batch-size', type=int, default=32)
    parser.add_argument('--test-size', type=float, default=0.2)
    parser.add_argument('--device', type=str, default='auto')
    parser.add_argument('--save-path', type=str, default='')
    args = parser.parse_args()

    device = 'cuda' if (args.device=='auto' and torch.cuda.is_available()) else ('cpu' if args.device=='auto' else args.device)
    print(f'Using device: {device}')

    raw = data_mod.fetch_raw(args.limit)
    X_df, y_series = data_mod.build_features(raw, scale_grades=args.scale_grades, add_difficulty=args.add_difficulty, ten_class=args.ten_class, bucket_5=args.bucket_5)

    if args.bucket_5:
        num_classes = 5
    elif args.ten_class:
        num_classes = 10
    else:
        raise SystemExit('Specify --ten-class or --bucket-5')

    train_loader, val_loader = build_loaders(X_df, y_series, batch_size=args.batch_size, test_size=args.test_size)
    model = ConvClassifier(total_dim=X_df.shape[1], seq_len=args.seq_len, num_classes=num_classes)

    best_acc, history = train(model, train_loader, val_loader, device, epochs=args.epochs, lr=args.lr)
    print(f'Best validation accuracy: {best_acc*100:.2f}%')

    if args.save_path:
        ckpt = {
            'model_state': model.state_dict(),
            'input_dim': X_df.shape[1],
            'num_classes': num_classes,
            'seq_len': args.seq_len,
            'feature_columns': list(X_df.columns),
            'args': vars(args)
        }
        torch.save(ckpt, args.save_path)
        print(f'Saved model to {args.save_path}')

    # Plot if matplotlib available (already imported) and interactive/CLI use-case
    try:
        plt.figure(figsize=(8,4))
        plt.subplot(1,2,1)
        plt.plot(history['train_loss'], label='train')
        plt.plot(history['val_loss'], label='val')
        plt.title('Loss')
        plt.legend()
        plt.subplot(1,2,2)
        plt.plot([a*100 for a in history['val_acc']], label='val_acc')
        plt.plot(history['val_f1'], label='val_f1')
        plt.title('Validation Metrics')
        plt.legend()
        plt.tight_layout()
        plt.show()
    except Exception:
        pass


def load_model(path: str):
    ckpt = torch.load(path, map_location='cpu')
    model = ConvClassifier(total_dim=ckpt['input_dim'], seq_len=ckpt.get('seq_len',10), num_classes=ckpt['num_classes'])
    model.load_state_dict(ckpt['model_state'])
    model.eval()
    return model, ckpt


if __name__ == '__main__':
    main()
