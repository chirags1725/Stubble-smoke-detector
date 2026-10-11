"""Build features for 2019-2025, train LightGBM quantile models, evaluate, plot a backtest.

Run: python train.py     (needs data/ from fetch_data.py; pip install matplotlib)
"""
import os
import numpy as np
import pandas as pd
import lightgbm as lgb
import matplotlib.pyplot as plt
from features import build_feature_table, FEATURES

SEVERE = 250          # ug/m3 threshold used in the app; adjust to your level definitions
TRAIN_YEARS, TEST_YEARS = range(2016, 2024), (2024, 2025)


def load_year(y):
    fires = pd.read_csv(f"data/fires_{y}.csv")
    wx = pd.read_csv(f"data/wx_{y}.csv", index_col=0)
    wx.index = pd.to_datetime(wx.index, utc=True)
    pm = pd.read_csv(f"data/pm_{y}.csv", index_col=0).iloc[:, 0]
    pm.index = pd.to_datetime(pm.index, utc=True)
    times = pd.date_range(f"{y}-10-08", f"{y}-11-28", freq="3h", tz="UTC")
    return build_feature_table(fires, wx, pm, times)


def main():
    tables = {y: load_year(y) for y in range(2016, 2026)}
    train = pd.concat([tables[y] for y in TRAIN_YEARS])
    test = pd.concat([tables[y] for y in TEST_YEARS])
    os.makedirs("models", exist_ok=True)
    out = {}

    for h in (24, 48):
        tr, te = train.dropna(subset=[f"y{h}"]), test.dropna(subset=[f"y{h}"])
        preds = {}
        for a in (0.1, 0.5, 0.9):
            m = lgb.LGBMRegressor(objective="quantile", alpha=a, n_estimators=400,
                                  learning_rate=0.05, num_leaves=15, min_child_samples=20,
                                  subsample=0.8, subsample_freq=1, colsample_bytree=0.8, verbose=-1)
            m.fit(tr[FEATURES], tr[f"y{h}"])
            m.booster_.save_model(f"models/model_q{int(a*100)}_{h}h.txt")
            preds[a] = m.predict(te[FEATURES])
        p = np.sort(np.vstack([preds[0.1], preds[0.5], preds[0.9]]), axis=0)  # avoid quantile crossing
        y = te[f"y{h}"].values
        persist = te["pm_now"].values
        ok = ~np.isnan(persist)

        def sev_scores(pred, truth):
            tp = ((pred > SEVERE) & (truth > SEVERE)).sum()
            prec = tp / max((pred > SEVERE).sum(), 1)
            rec = tp / max((truth > SEVERE).sum(), 1)
            return round(prec, 2), round(rec, 2)

        print(f"\n=== +{h} h ===  n={len(y)}")
        print("MAE model      :", round(np.abs(p[1] - y).mean(), 1))
        print("MAE persistence:", round(np.abs(persist[ok] - y[ok]).mean(), 1))
        print("Severe precision/recall model      :", sev_scores(p[1], y))
        print("Severe precision/recall persistence:", sev_scores(persist[ok], y[ok]))
        print("Coverage of 10-90 band (target ~0.80):", round(((y >= p[0]) & (y <= p[2])).mean(), 2))
        out[h] = pd.DataFrame({"p10": p[0], "p50": p[1], "p90": p[2], "actual": y}, index=te.index + pd.Timedelta(hours=h))

    # Backtest plot for the last season at +24 h
    d = out[24]
    d = d[d.index.year == 2025]
    plt.figure(figsize=(11, 4))
    plt.fill_between(d.index, d.p10, d.p90, alpha=0.25, label="10-90% range")
    plt.plot(d.index, d.p50, label="forecast (made 24 h earlier)")
    plt.plot(d.index, d.actual, "k", lw=1, label="actual PM2.5")
    plt.axhline(SEVERE, color="r", ls="--", lw=0.8, label="severe threshold")
    plt.ylabel("PM2.5 (ug/m3)"); plt.legend(); plt.tight_layout()
    plt.savefig("backtest_2025.png", dpi=150)
    print("saved backtest_2025.png")


if __name__ == "__main__":
    main()
