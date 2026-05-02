"""ml package public API.

The training data utilities require pandas. For minimal inference images where
only model loading and serving are needed, pandas (and transitive heavy deps)
are omitted. We therefore guard the import of data so the package still loads.
"""

try:  # Optional heavy dependency path
	from . import data  # type: ignore  # noqa: F401
except Exception:  # pragma: no cover - acceptable in minimal image
	data = None  # type: ignore

from .model import load_model, ConvClassifier  # noqa: F401

__all__ = [name for name in ["data", "load_model", "ConvClassifier"] if name]
