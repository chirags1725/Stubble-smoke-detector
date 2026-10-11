from functools import lru_cache
import os
from pathlib import Path

import lightgbm as lgb

MODEL_FILES = {
    "24h_q10": "model_q10_24h.txt",
    "24h_q50": "model_q50_24h.txt",
    "24h_q90": "model_q90_24h.txt",
    "48h_q10": "model_q10_48h.txt",
    "48h_q50": "model_q50_48h.txt",
    "48h_q90": "model_q90_48h.txt",
}


def model_dir():
    configured = os.environ.get("MODEL_DIR")
    if configured:
        return Path(configured)
    here = Path(__file__).resolve()
    # In the repository the model directory is two levels above this file;
    # in the Lambda image it is directly under /var/task.
    candidates = (here.parents[2] / "models", here.parents[1] / "models")
    for candidate in candidates:
        if candidate.is_dir():
            return candidate
    raise FileNotFoundError("Could not find the trained models/ directory")


@lru_cache(maxsize=1)
def load_models():
    directory = model_dir()
    models = {}

    for name, filename in MODEL_FILES.items():
        path = directory / filename

        if not path.is_file():
            raise FileNotFoundError(f"Missing model file: {path}")

        models[name] = lgb.Booster(model_file=str(path))

    return models


if __name__ == "__main__":
    loaded = load_models()

    for name, model in loaded.items():
        print(f"{name}: loaded ({model.num_feature()} features)")
