"""GET /fires?date=YYYY-MM-DD — NASA FIRMS detections for an available date."""
import csv
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timezone, timedelta
import io
import json
import os
import urllib.parse
import urllib.request

BBOX = (74.0, 28.0, 77.5, 32.5)  # Punjab + Haryana region used by the model
MAX_MAP_RECORDS = 1800
MAX_DAY_RANGE = 5
# Products whose CSV schema includes the fields parsed below. Availability is
# checked per request so dates before/after product coverage return accurately.
SUPPORTED_SOURCES = (
    "VIIRS_NOAA21_NRT", "VIIRS_NOAA20_NRT", "VIIRS_SNPP_NRT", "MODIS_NRT",
    "VIIRS_NOAA21_SP", "VIIRS_NOAA20_SP", "VIIRS_SNPP_SP", "MODIS_SP",
)


def handler(event, context):
    method = event.get("httpMethod") or event.get("requestContext", {}).get("http", {}).get("method")
    if method == "OPTIONS":
        return _response(204, "")
    params = event.get("queryStringParameters") or {}
    key = os.environ.get("FIRMS_KEY", "").strip()
    if not key:
        return _response(503, {"error": "FIRMS_KEY is not configured for the fire map."})
    raw_date = params.get("date") or datetime.now(timezone.utc).date().isoformat()
    try:
        selected = date.fromisoformat(raw_date)
        if selected.isoformat() != raw_date:
            raise ValueError
        days = int(params.get("days", "1"))
        if days < 1 or days > MAX_DAY_RANGE:
            raise ValueError
    except (TypeError, ValueError):
        return _response(400, {"error": "Use date=YYYY-MM-DD and days=1..5."})

    today = datetime.now(timezone.utc).date()
    if selected > today:
        return _response(400, {"error": "A future date cannot have FIRMS observations."})
    if selected + timedelta(days=days - 1) > today:
        days = (today - selected).days + 1

    try:
        sources = _available_sources(key, selected, days)
    except Exception as exc:
        print(f"FIRMS availability lookup failed: {type(exc).__name__}: {exc}")
        return _response(502, {"error": "NASA FIRMS date availability could not be checked. Retry later."})
    if not sources:
        return _response(404, {
            "error": "NASA FIRMS has no supported product covering this date and region request.",
            "date": selected.isoformat(),
        })

    results, warnings = [], []
    # Bound parallelism: usually one or two products cover a date. Parallel
    # fetches keep multiple available products within the API Gateway timeout.
    with ThreadPoolExecutor(max_workers=min(4, len(sources))) as pool:
        future_sources = {pool.submit(_fetch, key, source, selected, days): source for source in sources}
        for future in as_completed(future_sources):
            source = future_sources[future]
            try:
                results.extend(future.result())
            except Exception as exc:
                warnings.append(f"{source}: {type(exc).__name__}")
    if not results and warnings:
        return _response(502, {"error": "NASA FIRMS products were available, but their data could not be fetched.", "warnings": warnings})

    results.sort(key=lambda item: item["frp_mw"], reverse=True)
    total = len(results)
    limited = results[:MAX_MAP_RECORDS]
    historical = any(source.endswith("_SP") for source in sources)
    has_nrt = any(source.endswith("_NRT") for source in sources)
    source_label = (
        "NASA FIRMS standard archived and near-real-time products" if historical and has_nrt
        else "NASA FIRMS standard archived products" if historical
        else "NASA FIRMS near-real-time products"
    )
    return _response(200, {
        "date": selected.isoformat(), "days": days, "source": sources,
        "source_label": source_label, "historical": historical,
        "detections_total": total,
        "mapped_detections": len(limited), "truncated": total > len(limited),
        "high_confidence_count": sum(_high_confidence(x["confidence"]) for x in results),
        "frp_sum_mw": round(sum(x["frp_mw"] for x in results), 2),
        "latest_observation_utc": max((x["acq_datetime_utc"] for x in results if x.get("acq_datetime_utc")), default=None),
        "records": limited, "warnings": warnings,
        "attribution_note": "Satellite detections indicate thermal anomalies; a detection is not proof of a fire's cause or crop-residue burning.",
    })


def _available_sources(key, selected, days=1):
    """Return supported NASA FIRMS products whose published date range covers the request."""
    encoded = urllib.parse.quote(key, safe="")
    url = f"https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv/{encoded}/all"
    request = urllib.request.Request(url, headers={"User-Agent": "StubbleSmokeForecaster/1.0"})
    with urllib.request.urlopen(request, timeout=8) as response:
        text = response.read().decode("utf-8-sig", errors="replace")
    rows = csv.DictReader(io.StringIO(text))
    if not rows.fieldnames or not {"data_id", "min_date", "max_date"}.issubset(rows.fieldnames):
        raise RuntimeError("Unexpected FIRMS availability response")
    end = selected + timedelta(days=days - 1)
    availability = {}
    for row in rows:
        source = (row.get("data_id") or "").strip()
        if source not in SUPPORTED_SOURCES:
            continue
        try:
            first = date.fromisoformat(row["min_date"][:10])
            last = date.fromisoformat(row["max_date"][:10])
        except (TypeError, ValueError, KeyError):
            continue
        if first <= selected and end <= last:
            availability[source] = True
    # Prefer VIIRS fine-resolution products; include other covering sensors
    # so older dates remain queryable when a VIIRS product is not available.
    return [source for source in SUPPORTED_SOURCES if availability.get(source)]


def _fetch(key, source, selected, days):
    west, south, east, north = BBOX
    area = f"{west},{south},{east},{north}"
    url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{urllib.parse.quote(key, safe='')}/{source}/{area}/{days}/{selected.isoformat()}"
    req = urllib.request.Request(url, headers={"User-Agent": "StubbleSmokeForecaster/1.0"})
    with urllib.request.urlopen(req, timeout=14) as response:
        text = response.read().decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames or "latitude" not in reader.fieldnames:
        raise RuntimeError("Unexpected NASA FIRMS response")
    rows = []
    for row in reader:
        try:
            lat, lon = float(row["latitude"]), float(row["longitude"])
            frp = max(0.0, float(row.get("frp") or 0))
        except (TypeError, ValueError, KeyError):
            continue
        if not (BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]):
            continue
        acq_date = row.get("acq_date", selected.isoformat())
        hhmm = str(row.get("acq_time", "0000")).zfill(4)
        try:
            stamp = datetime.strptime(f"{acq_date} {hhmm}", "%Y-%m-%d %H%M").replace(tzinfo=timezone.utc).isoformat()
        except ValueError:
            stamp = None
        rows.append({
            "latitude": lat, "longitude": lon, "frp_mw": round(frp, 2),
            "confidence": str(row.get("confidence", "unknown")),
            "brightness_kelvin": _float(row.get("bright_ti4") or row.get("bright_t31")),
            "acq_datetime_utc": stamp,
            "satellite": str(row.get("satellite", source)),
            "instrument": str(row.get("instrument", "VIIRS")),
            "product": source,
        })
    return rows


def _float(value):
    try:
        return round(float(value), 1) if value not in (None, "") else None
    except (ValueError, TypeError):
        return None


def _high_confidence(value):
    value = str(value).strip().lower()
    if value in {"h", "high"}:
        return True
    try:
        return float(value) >= 80
    except ValueError:
        return False


def _response(status, payload):
    return {"statusCode": status, "headers": _headers(), "body": payload if isinstance(payload, str) else json.dumps(payload)}


def _headers():
    return {"Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": os.environ.get("ALLOWED_ORIGIN", "*"), "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,Authorization", "Cache-Control": "no-store"}
