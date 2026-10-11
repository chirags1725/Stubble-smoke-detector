"""Feature engineering: upwind smoke score + feature table. Shared by training and the Lambda."""
import numpy as np
import pandas as pd

DELHI_LAT, DELHI_LON = 28.6139, 77.2090

FEATURES = ["upwind_now", "upwind_24h", "upwind_48h", "wind_speed", "wind_sin", "wind_cos",
            "blh", "rh", "rain_24h", "pm_now", "pm_trend_24h", "hour", "day_of_season"]


def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dphi, dl = p2 - p1, np.radians(lon2 - lon1)
    a = np.sin(dphi / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    return 2 * R * np.arcsin(np.sqrt(a))


def bearing_deg(lat1, lon1, lat2, lon2):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dl = np.radians(lon2 - lon1)
    x = np.sin(dl) * np.cos(p2)
    y = np.cos(p1) * np.sin(p2) - np.sin(p1) * np.cos(p2) * np.cos(dl)
    return (np.degrees(np.arctan2(x, y)) + 360) % 360


def prep_fires(fires):
    """Keep nominal/high confidence, add timestamp, distance and bearing to Delhi."""
    f = fires.copy()
    if f.empty:
        return pd.DataFrame(columns=["t", "frp", "dist", "bearing"])
    f = f[f["confidence"].astype(str).str.lower().isin(["n", "h", "nominal", "high"])]
    hhmm = f["acq_time"].astype(int).astype(str).str.zfill(4)
    f["t"] = pd.to_datetime(f["acq_date"].astype(str) + " " + hhmm, format="%Y-%m-%d %H%M", utc=True)
    f["dist"] = haversine_km(f["latitude"], f["longitude"], DELHI_LAT, DELHI_LON)
    f["bearing"] = bearing_deg(f["latitude"], f["longitude"], DELHI_LAT, DELHI_LON)
    return f.sort_values("t")[["t", "frp", "dist", "bearing"]]


def upwind_at(f, t, wind_from, scale_km=250, window_h=24):
    """Score of fires in the last `window_h` hours whose smoke the wind sends toward Delhi."""
    w = f[(f["t"] > t - pd.Timedelta(hours=window_h)) & (f["t"] <= t)]
    if w.empty:
        return 0.0
    if pd.isna(wind_from):
        return np.nan
    travel = (wind_from + 180) % 360                      # smoke goes opposite to "wind from"
    diff = np.abs((w["bearing"].values - travel + 180) % 360 - 180)
    align = np.clip(np.cos(np.radians(diff)), 0, None) ** 2
    return float((w["frp"].values * align * np.exp(-w["dist"].values / scale_km)).sum())


def build_feature_table(fires, wx, pm, times, with_targets=True):
    """times: regular 3-hourly tz-aware (UTC) DatetimeIndex. wx hourly df, pm hourly Series."""
    f = prep_fires(fires)
    wx = wx[~wx.index.duplicated()]
    pm = pm.resample("1h").mean().ffill(limit=6)          # fill short sensor gaps

    wind_dir = wx["wind_direction_10m"].reindex(times)
    score = pd.Series([upwind_at(f, t, wind_dir[t]) for t in times], index=times)

    df = pd.DataFrame(index=times)
    df["upwind_now"] = score
    df["upwind_24h"] = score.shift(8)                     # 8 steps x 3 h = 24 h
    df["upwind_48h"] = score.shift(16)
    df["wind_speed"] = wx["wind_speed_10m"].reindex(times)
    df["wind_sin"] = np.sin(np.radians(wind_dir))
    df["wind_cos"] = np.cos(np.radians(wind_dir))
    df["blh"] = wx["boundary_layer_height"].reindex(times)
    df["rh"] = wx["relative_humidity_2m"].reindex(times)
    df["rain_24h"] = wx["precipitation"].rolling(24, min_periods=12).sum().reindex(times)
    df["pm_now"] = pm.reindex(times)
    df["pm_trend_24h"] = df["pm_now"] - pm.reindex(times - pd.Timedelta(hours=24)).values
    df["hour"] = times.hour
    df["day_of_season"] = [(t - pd.Timestamp(year=t.year, month=10, day=1, tz="UTC")).days for t in times]

    if with_targets:
        df["y24"] = pm.reindex(times + pd.Timedelta(hours=24)).values
        df["y48"] = pm.reindex(times + pd.Timedelta(hours=48)).values
    return df


def _self_test():
    """Step 5 of the plan: score should be high for NW wind, ~0 for SE wind."""
    f = pd.DataFrame({"latitude": [30.5], "longitude": [75.5], "acq_date": ["2025-11-01"],
                      "acq_time": [600], "frp": [50.0], "confidence": ["n"]})
    p = prep_fires(f)
    t = pd.Timestamp("2025-11-01 09:00", tz="UTC")
    print("wind from NW (315):", round(upwind_at(p, t, 315), 3))
    print("wind from SE (135):", round(upwind_at(p, t, 135), 3))


if __name__ == "__main__":
    _self_test()
