"""Download raw data for the Stubble Smoke Forecaster.

Run locally:   python fetch_data.py          (reads FIRMS_KEY and OPENAQ_KEY from .env)
Also imported by the Lambda, so it uses only the standard library + pandas (no `requests`).

VERIFY before relying on it: FIRMS source names, Open-Meteo variable availability for
historical boundary_layer_height, and OpenAQ v3 parameter id / endpoints. APIs change.
"""
import io, json, os, time, urllib.parse, urllib.request, urllib.error
from datetime import datetime, timezone, timedelta
import pandas as pd

BBOX = (74.0, 28.0, 77.5, 32.5)          # west, south, east, north (Punjab + Haryana box)
DELHI = (28.6139, 77.2090)
WX_VARS = "wind_speed_10m,wind_direction_10m,boundary_layer_height,relative_humidity_2m,precipitation"



def _get(url, params=None, headers=None, timeout=60):
    if params:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"HTTP {e.code} from {e.url}: {detail}"
        ) from e



# ---------------------------------------------------------------- fires (NASA FIRMS)
def fetch_firms(map_key, start=None, days=5, source="VIIRS_NOAA21_NRT"):
    """Fetch an area from FIRMS. For NRT, omit start to request the latest days.

    `start` selects an explicit archive date. FIRMS limits a single request to
    five days. Sources are sensor-specific, e.g. VIIRS_NOAA21_NRT or
    VIIRS_NOAA20_NRT; older project archive inputs may use an SP product.
    """
    w, s, e, n = BBOX
    if not 1 <= int(days) <= 5:
        raise ValueError("FIRMS Area API requests support 1 to 5 days")
    url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{map_key}/{source}/{w},{s},{e},{n}/{int(days)}"
    if start:
        url += f"/{start}"
    txt = _get(url)
    if not txt.strip() or txt.lstrip().startswith("<"):
        return pd.DataFrame(columns=["latitude", "longitude", "acq_date", "acq_time", "frp", "confidence"])
    return pd.read_csv(io.StringIO(txt))


def fetch_firms_season(map_key, year, source="VIIRS_SNPP_SP"):
    frames = []
    d = date(year, 10, 1)
    end = date(year, 10, 8)

    while d <= end:
        n = min(5, (end - d).days + 1)

        try:
            df = fetch_firms(map_key, d.isoformat(), n, source=source)
            frames.append(df)
        except urllib.error.HTTPError as e:
            print(f"FIRMS request failed for {d}, days={n}")
            print(f"HTTP status: {e.code}")
            print(e.read().decode("utf-8", errors="replace"))
            raise

        d += timedelta(days=n)
        time.sleep(0.5)

    if not frames:
        return pd.DataFrame()

    return pd.concat(frames, ignore_index=True).drop_duplicates()


# ---------------------------------------------------------------- weather (Open-Meteo)
def _wx_frame(js):
    h = js["hourly"]
    df = pd.DataFrame(h).set_index("time")
    df.index = pd.to_datetime(df.index, utc=True)
    return df


def fetch_weather_hist(start, end):
    """start/end 'YYYY-MM-DD'. Falls back to no boundary-layer-height if the archive lacks it."""
    base = dict(latitude=DELHI[0], longitude=DELHI[1], start_date=start, end_date=end,
                timezone="GMT", wind_speed_unit="ms")
    try:
        js = json.loads(_get("https://archive-api.open-meteo.com/v1/archive", {**base, "hourly": WX_VARS}))
    except urllib.error.HTTPError:
        js = json.loads(_get("https://archive-api.open-meteo.com/v1/archive",
                             {**base, "hourly": WX_VARS.replace("boundary_layer_height,", "")}))
    df = _wx_frame(js)
    if "boundary_layer_height" not in df:
        df["boundary_layer_height"] = float("nan")   # LightGBM handles NaN; try historical-forecast-api for 2022+
    return df


def fetch_weather_live(past_days=3, forecast_days=3):
    js = json.loads(_get("https://api.open-meteo.com/v1/forecast", dict(
        latitude=DELHI[0], longitude=DELHI[1], hourly=WX_VARS, past_days=past_days,
        forecast_days=forecast_days, timezone="GMT", wind_speed_unit="ms")))
    return _wx_frame(js)


def fetch_cams_pm25(start=None, end=None, past_days=3, forecast_days=3):
    """CAMS PM2.5 from Open-Meteo Air Quality. Baseline for comparison (and a fallback target)."""
    p = dict(latitude=DELHI[0], longitude=DELHI[1], hourly="pm2_5", timezone="GMT")
    if start:
        p.update(start_date=start, end_date=end)
    else:
        p.update(past_days=past_days, forecast_days=forecast_days)
    js = json.loads(_get("https://air-quality-api.open-meteo.com/v1/air-quality", p))
    return _wx_frame(js)["pm2_5"].rename("cams_pm25")


# ---------------------------------------------------------------- PM2.5 truth (OpenAQ v3)
OAQ = "https://api.openaq.org/v3"


def _oaq(path, key, **params):
    return json.loads(_get(OAQ + path, params, {"X-API-Key": key}))


def delhi_pm25_sensor_ids(key):
    r = _oaq("/locations", key, bbox="76.8,28.4,77.4,28.9", parameters_id=2, limit=1000)  # 2 = pm25 (verify)
    ids = []
    for loc in r.get("results", []):
        for s in loc.get("sensors", []):
            if (s.get("parameter") or {}).get("id") == 2:
                ids.append(s["id"])
    return ids


def fetch_openaq_pm25(key, start, end):
    """start/end: tz-aware pd.Timestamp. Returns hourly city-mean Series named 'pm25' (UTC index)."""
    rows = []
    for sid in delhi_pm25_sensor_ids(key):
        t0 = start
        while t0 < end:
            t1 = min(t0 + pd.Timedelta(days=30), end)
            try:
                r = _oaq(f"/sensors/{sid}/hours", key, datetime_from=t0.isoformat(),
                         datetime_to=t1.isoformat(), limit=1000)
            except urllib.error.HTTPError:
                r = {"results": []}
            for x in r.get("results", []):
                rows.append((x["period"]["datetimeFrom"]["utc"], x["value"]))
            t0 = t1
            time.sleep(0.3)
    if not rows:
        return pd.Series(dtype=float, name="pm25")
    df = pd.DataFrame(rows, columns=["t", "pm25"])
    df["t"] = pd.to_datetime(df["t"], utc=True)
    df = df[(df.pm25 >= 0) & (df.pm25 < 1500)]          # drop sensor garbage
    return df.groupby(df.t.dt.floor("1h"))["pm25"].mean().rename("pm25")


# ---------------------------------------------------------------- CLI
def _load_env(path=".env"):
    if os.path.exists(path):
        for line in open(path):
            if "=" in line and not line.startswith("#"):
                k, v = line.strip().split("=", 1)
                os.environ.setdefault(k, v)


if __name__ == "__main__":
    _load_env()
    os.makedirs("data", exist_ok=True)
    for y in range(2016, 2027):
        if not os.path.exists(f"data/pm_{y}.csv"):
            fetch_cams_pm25(f"{y}-10-01", f"{y}-10-08").to_csv(f"data/pm_{y}.csv")

        print("done", y)
