import argparse
import os
import sys
from typing import Tuple, Dict, List

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score

try:
    from . import data as data_mod  # type: ignore
except ImportError:  # pragma: no cover
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    if parent_dir not in sys.path:
        sys.path.append(parent_dir)
    import ml.data as data_mod  # type: ignore


class StudentPerformanceModel(nn.Module):
    """LSTM-based regression model predicting continuous current grade.

    Assumes fixed-length history (seq_len) of past grades and one difficulty feature.
    """
    def __init__(self, seq_len: int = 10, hidden_size: int = 32, fc_hidden: int = 64, use_difficulty: bool = True):
        super().__init__()
        self.seq_len = seq_len
        self.use_difficulty = use_difficulty
        self.lstm = nn.LSTM(input_size=1, hidden_size=hidden_size, num_layers=1, batch_first=True)
        in_dim = hidden_size + (1 if use_difficulty else 0)
        self.fc = nn.Sequential(
            nn.Linear(in_dim, fc_hidden),
            nn.ReLU(),
            nn.Linear(fc_hidden, fc_hidden // 2),
            nn.ReLU(),
            nn.Linear(fc_hidden // 2, 1)
        )

    def forward(self, past_grades: torch.Tensor, difficulty: torch.Tensor | None = None):
        # past_grades: (B, seq_len)
        x = past_grades.unsqueeze(-1)  # (B, seq_len, 1)
        _, (h, _) = self.lstm(x)       # h: (1,B,H)
        feat = h[-1]                   # (B,H)
        if self.use_difficulty:
            if difficulty is None:
                raise ValueError("difficulty tensor required but missing")
            if difficulty.dim() == 1:
                difficulty = difficulty.unsqueeze(1)
            feat = torch.cat([feat, difficulty], dim=1)
        out = self.fc(feat).squeeze(1)
        return out


class RegressionGradesDataset(Dataset):
    def __init__(self, df, seq_len: int = 10, scale_grades: bool = True, use_difficulty: bool = True):
        self.seq_len = seq_len
        self.use_difficulty = use_difficulty
        grades = np.stack(df.past_grades.values).astype(np.float32)  # (N,10)
        if grades.shape[1] != seq_len:
            raise ValueError(f"Expected seq_len={seq_len} but got {grades.shape[1]}")
        if scale_grades:
            grades = grades / 100.0
        self.past = torch.from_numpy(grades)
        self.scale_grades = scale_grades
        if use_difficulty:
            self.difficulty = torch.tensor(((df.difficulty.values.astype(np.float32) - 1) / 9.0))
        else:
            self.difficulty = None
        targets = df.current_grade.values.astype(np.float32)
        if scale_grades:
            targets = targets / 100.0
        self.targets = torch.tensor(targets)

    def __len__(self):
        return len(self.targets)

    def __getitem__(self, idx):
        past = self.past[idx]
        diff = self.difficulty[idx] if self.difficulty is not None else torch.tensor(0.0)
        y = self.targets[idx]
        return past, diff, y


def build_loaders(df, seq_len: int, batch_size: int, test_size: float, scale_grades: bool, use_difficulty: bool, seed: int = 42) -> Tuple[DataLoader, DataLoader]:
    train_df, val_df = train_test_split(df, test_size=test_size, random_state=seed)
    train_ds = RegressionGradesDataset(train_df, seq_len=seq_len, scale_grades=scale_grades, use_difficulty=use_difficulty)
    val_ds = RegressionGradesDataset(val_df, seq_len=seq_len, scale_grades=scale_grades, use_difficulty=use_difficulty)
    return (
        DataLoader(train_ds, batch_size=batch_size, shuffle=True),
        DataLoader(val_ds, batch_size=batch_size, shuffle=False),
    )


def train(model, train_loader, val_loader, device: str, epochs: int, lr: float, scale_grades: bool, tolerance_acc: float | None, want_val_acc: bool, rel_acc: float | None):
    criterion = nn.SmoothL1Loss()
    optimiz = optim.Adam(model.parameters(), lr=lr)
    model.to(device)
    keys = ['train_loss','val_loss','val_mae','val_r2']
    if tolerance_acc is not None:
        keys.append('val_tol_acc')
    if want_val_acc:
        keys.append('val_acc')
    if rel_acc is not None:
        keys.append('val_rel_acc')
    history: Dict[str, List[float]] = {k: [] for k in keys}
    best_mae = float('inf')
    for ep in range(1, epochs+1):
        model.train()
        total_loss = 0.0
        for past, diff, y in train_loader:
            past, diff, y = past.to(device), diff.to(device), y.to(device)
            optimiz.zero_grad()
            pred = model(past, diff)
            loss = criterion(pred, y)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 5.0)
            optimiz.step()
            total_loss += loss.item() * past.size(0)
        train_loss = total_loss / len(train_loader.dataset)

        # Validation
        model.eval()
        val_loss_sum = 0.0
        preds_all, targets_all = [], []
        with torch.no_grad():
            for past, diff, y in val_loader:
                past, diff, y = past.to(device), diff.to(device), y.to(device)
                pred = model(past, diff)
                loss = criterion(pred, y)
                val_loss_sum += loss.item() * past.size(0)
                preds_all.append(pred.cpu())
                targets_all.append(y.cpu())
        val_loss = val_loss_sum / len(val_loader.dataset)
        preds = torch.cat(preds_all)
        targets = torch.cat(targets_all)
        # Convert back to grade points if scaled for metrics readability
        if scale_grades:
            preds_points = preds * 100.0
            targets_points = targets * 100.0
        else:
            preds_points = preds
            targets_points = targets
        mae = mean_absolute_error(targets_points.numpy(), preds_points.numpy())
        # r2 on unscaled domain
        r2 = r2_score(targets_points.numpy(), preds_points.numpy())

        if tolerance_acc is not None:
            diff_abs = (preds_points - targets_points).abs()
            tol_hits = (diff_abs <= tolerance_acc).float().mean().item()
            history['val_tol_acc'].append(tol_hits)

        if want_val_acc:
            # Exact match after rounding to nearest integer in 0-100 range
            pred_int = torch.clamp(preds_points.round(), 0, 100).to(torch.int)
            target_int = torch.clamp(targets_points.round(), 0, 100).to(torch.int)
            acc_exact = (pred_int == target_int).float().mean().item()
            history['val_acc'].append(acc_exact)

        if rel_acc is not None:
            # relative accuracy: within rel_acc fraction (if rel_acc>1 treat as percent /100)
            thr = rel_acc / 100.0 if rel_acc > 1 else rel_acc
            denom = torch.clamp(targets_points.abs(), min=1.0)  # avoid div by zero, treat very small as 1
            rel_err = (preds_points - targets_points).abs() / denom
            rel_hits = (rel_err <= thr).float().mean().item()
            history['val_rel_acc'].append(rel_hits)

        history['train_loss'].append(train_loss)
        history['val_loss'].append(val_loss)
        history['val_mae'].append(mae)
        history['val_r2'].append(r2)

        components = [
            f"Epoch {ep:03d}",
            f"TrainLoss {train_loss:.4f}",
            f"ValLoss {val_loss:.4f}",
            f"ValMAE {mae:.2f}",
            f"R2 {r2:.3f}"
        ]
        if tolerance_acc is not None:
            components.append(f"TolAcc(±{tolerance_acc:.1f}) {tol_hits*100:.2f}%")
        if want_val_acc:
            components.append(f"ValAcc {acc_exact*100:.2f}%")
        if rel_acc is not None:
            if rel_acc > 1:
                components.append(f"RelAcc(±{rel_acc:.0f}%) {rel_hits*100:.2f}%")
            else:
                components.append(f"RelAcc(±{rel_acc*100:.0f}%) {rel_hits*100:.2f}%")
        print(" | ".join(components))
        if mae < best_mae:
            best_mae = mae
    return best_mae, history


def main():
    parser = argparse.ArgumentParser(description='LSTM regression for current grade prediction')
    parser.add_argument('--limit', type=int, default=0, help='Number of synthetic samples (0 -> default 1000)')
    parser.add_argument('--seq-len', type=int, default=10)
    parser.add_argument('--hidden-size', type=int, default=32)
    parser.add_argument('--fc-hidden', type=int, default=64)
    parser.add_argument('--no-difficulty', action='store_true', help='Exclude difficulty feature')
    parser.add_argument('--scale-grades', action='store_true', help='Scale grades & target to 0-1')
    parser.add_argument('--epochs', type=int, default=60)
    parser.add_argument('--lr', type=float, default=1e-3)
    parser.add_argument('--batch-size', type=int, default=32)
    parser.add_argument('--test-size', type=float, default=0.2)
    parser.add_argument('--device', type=str, default='auto')
    parser.add_argument('--save-path', type=str, default='', help='Where to save model checkpoint')
    parser.add_argument('--plot', action='store_true', help='Show training curves if matplotlib available')
    parser.add_argument('--tolerance-acc', type=float, default=None, help='If set (e.g. 5), report accuracy within ±tolerance grade points.')
    parser.add_argument('--val-accuracy', action='store_true', help='Also compute exact integer grade match accuracy (%)')
    parser.add_argument('--relative-acc', type=float, default=None, help='Relative accuracy threshold (e.g. 0.1 or 10 for 10%).')
    args = parser.parse_args()

    device = 'cuda' if (args.device == 'auto' and torch.cuda.is_available()) else ('cpu' if args.device == 'auto' else args.device)
    print(f'Using device: {device}')

    raw = data_mod.fetch_raw(args.limit)
    # raw already has past_grades, difficulty, current_grade

    loaders = build_loaders(raw, seq_len=args.seq_len, batch_size=args.batch_size, test_size=args.test_size, scale_grades=args.scale_grades, use_difficulty=not args.no_difficulty)
    train_loader, val_loader = loaders

    model = StudentPerformanceModel(seq_len=args.seq_len, hidden_size=args.hidden_size, fc_hidden=args.fc_hidden, use_difficulty=not args.no_difficulty)

    best_mae, history = train(model, train_loader, val_loader, device, epochs=args.epochs, lr=args.lr, scale_grades=args.scale_grades, tolerance_acc=args.tolerance_acc, want_val_acc=args.val_accuracy, rel_acc=args.relative_acc)

    print(f'Best Val MAE: {best_mae:.2f}')

    if args.save_path:
        ckpt = {
            'model_state': model.state_dict(),
            'model_type': 'lstm_regression',
            'seq_len': args.seq_len,
            'hidden_size': args.hidden_size,
            'fc_hidden': args.fc_hidden,
            'use_difficulty': not args.no_difficulty,
            'scale_grades': args.scale_grades,
            'best_val_mae': best_mae,
            'args': vars(args),
            'tolerance_acc': args.tolerance_acc,
            'val_accuracy': args.val_accuracy,
            'relative_acc': args.relative_acc
        }
        torch.save(ckpt, args.save_path)
        print(f'Saved checkpoint to {args.save_path}')

    if args.plot:
        try:
            import matplotlib.pyplot as plt
            has_tol = 'val_tol_acc' in history
            has_acc = 'val_acc' in history
            has_rel = 'val_rel_acc' in history
            # determine subplot count
            extra = sum([has_tol, has_acc, has_rel])
            if extra == 0:
                plt.figure(figsize=(8,4))
                plt.subplot(1,2,1)
            elif extra == 1:
                plt.figure(figsize=(12,4))
                plt.subplot(1,3,1)
            elif extra == 2:
                plt.figure(figsize=(14,4))
                plt.subplot(1,4,1)
            else:
                plt.figure(figsize=(18,4))
                plt.subplot(1,5,1)
            plt.plot(history['train_loss'], label='train')
            plt.plot(history['val_loss'], label='val')
            plt.title('Loss')
            plt.legend()
            if extra == 0:
                plt.subplot(1,2,2)
            elif extra == 1:
                plt.subplot(1,3,2)
            elif extra == 2:
                plt.subplot(1,4,2)
            else:
                plt.subplot(1,5,2)
            plt.plot(history['val_mae'], label='Val MAE')
            plt.plot(history['val_r2'], label='R2')
            plt.title('Regression Metrics')
            plt.legend()
            subplot_index = 3
            def next_subplot():
                nonlocal subplot_index
                if extra == 1:
                    plt.subplot(1,3,subplot_index)
                elif extra == 2:
                    plt.subplot(1,4,subplot_index)
                elif extra == 3:
                    plt.subplot(1,5,subplot_index)
                subplot_index += 1
            if has_tol:
                next_subplot()
                plt.plot([v*100 for v in history['val_tol_acc']], label=f'Tol Acc % (±{args.tolerance_acc})')
                plt.ylim(0,100)
                plt.title('Tolerance Acc')
                plt.legend()
            if has_acc:
                next_subplot()
                plt.plot([v*100 for v in history['val_acc']], label='Val Acc %')
                plt.ylim(0,100)
                plt.title('Exact Acc')
                plt.legend()
            if has_rel:
                next_subplot()
                plt.plot([v*100 for v in history['val_rel_acc']], label='Rel Acc %')
                plt.ylim(0,100)
                if args.relative_acc is not None:
                    disp_thr = f"±{args.relative_acc if args.relative_acc>1 else args.relative_acc*100:.0f}%"
                else:
                    disp_thr = ''
                plt.title(f'Rel Acc {disp_thr}')
                plt.legend()
            plt.tight_layout()
            plt.show()
        except Exception:
            pass


def load_regression_model(path: str):
    ckpt = torch.load(path, map_location='cpu')
    model = StudentPerformanceModel(seq_len=ckpt['seq_len'], hidden_size=ckpt['hidden_size'], fc_hidden=ckpt['fc_hidden'], use_difficulty=ckpt['use_difficulty'])
    model.load_state_dict(ckpt['model_state'])
    model.eval()
    return model, ckpt


if __name__ == '__main__':
    main()
