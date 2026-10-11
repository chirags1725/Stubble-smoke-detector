"""Build compact day-by-grid historical FIRMS archive from data/fires_YYYY.csv.

Inputs are the project-supplied NASA FIRMS CSVs. The output stores detections
aggregated to 0.1-degree grid cells for the historical map, plus per-day counts
for season charts. It is not a crop-residue-burning classifier.
"""
from collections import defaultdict
from datetime import datetime, timezone
import gzip
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUTPUT = ROOT / "web" / "public" / "data" / "fire-archive.json"
BBOX = (74.0, 28.0, 77.5, 32.5)


def confidence_is_high(value):
    text = str(value).strip().lower()
    if text in {"h", "high", "n", "nominal"}:
        return True
    try:
        return float(text) >= 80
    except ValueError:
        return False


def build():
    grids = defaultdict(lambda: {"n": 0, "frp": 0.0, "max": 0.0, "high": 0})
    daily = defaultdict(lambda: {"count": 0, "high": 0, "frp": 0.0})
    years = []
    for path in sorted(DATA.glob("fires_*.csv")):
        try:
            year = int(path.stem.split("_")[-1])
        except ValueError:
            continue
        if year > datetime.now(timezone.utc).year or year < 2000:
            continue
        try:
            df = pd.read_csv(path)
        except (pd.errors.EmptyDataError, UnicodeDecodeError):
            continue
        needed = {"latitude", "longitude", "acq_date", "frp", "confidence"}
        if not needed.issubset(df.columns) or df.empty:
            continue
        df = df.dropna(subset=["latitude", "longitude", "acq_date"])
        df = df[df.longitude.between(BBOX[0], BBOX[2]) & df.latitude.between(BBOX[1], BBOX[3])]
        if df.empty:
            continue
        years.append(year)
        df["frp"] = pd.to_numeric(df["frp"], errors="coerce").fillna(0).clip(lower=0)
        for row in df.itertuples(index=False):
            date = str(row.acq_date)[:10]
            lat_cell = int(float(row.latitude) * 10)
            lon_cell = int(float(row.longitude) * 10)
            key = (date, lat_cell, lon_cell)
            g = grids[key]
            g["n"] += 1
            g["frp"] += float(row.frp)
            g["max"] = max(g["max"], float(row.frp))
            high = confidence_is_high(row.confidence)
            g["high"] += int(high)
            d = daily[date]
            d["count"] += 1
            d["high"] += int(high)
            d["frp"] += float(row.frp)
    by_date = defaultdict(list)
    for (date, lat_cell, lon_cell), v in grids.items():
        by_date[date].append({
            "lat": round((lat_cell + 0.5) / 10, 2),
            "lon": round((lon_cell + 0.5) / 10, 2),
            "count": v["n"], "frp_sum_mw": round(v["frp"], 2),
            "max_frp_mw": round(v["max"], 2), "high_confidence_count": v["high"],
        })
    payload = {
        "metadata": {
            "source": "Project-supplied NASA FIRMS historical CSVs in data/fires_YYYY.csv",
            "years": sorted(set(years)),
            "date_coverage": "October 1 through November 30 in years with source files; missing dates are not zero-fire days",
            "bbox_wsen": list(BBOX), "grid_degrees": 0.1,
            "map_note": "Historical detections aggregated to 0.1-degree cells; not individual pixel locations.",
            "interpretation": "Satellite active-fire detections are not a specific attribution to crop-residue burning.",
        },
        "daily": {date: {"count": v["count"], "high_confidence_count": v["high"], "frp_sum_mw": round(v["frp"], 2)} for date, v in sorted(daily.items())},
        "grid_by_date": {date: sorted(cells, key=lambda x: x["frp_sum_mw"], reverse=True) for date, cells in sorted(by_date.items())},
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    with gzip.open(str(OUTPUT) + ".gz", "wb", compresslevel=8) as compressed:
        compressed.write(OUTPUT.read_bytes())
    print(f"Wrote {len(daily)} dates, {len(grids)} grid cells, years={sorted(set(years))} -> {OUTPUT} ({OUTPUT.stat().st_size:,} bytes; gzip {Path(str(OUTPUT) + '.gz').stat().st_size:,} bytes)")


if __name__ == "__main__":
    build()
