"""POST /summary — grounded pollution/fire-data narrative with Bedrock fallback."""
import json
import os

import boto3
from botocore.config import Config
from app import CITY, THRESHOLD
from db import get_table, json_default

LANGUAGES = {"en": "English", "hi": "Hindi", "pa": "Punjabi"}
MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "amazon.nova-micro-v1:0").strip()


def handler(event, context):
    method = event.get("httpMethod") or event.get("requestContext", {}).get("http", {}).get("method")
    if method == "OPTIONS":
        return _response(204, "")
    try:
        body = event.get("body") or "{}"
        if len(body) > 4096:
            return _response(413, {"error": "summary context too large"})
        data = json.loads(body) if isinstance(body, str) else body
        lang = data.get("lang", "en")
        if lang not in LANGUAGES:
            return _response(400, {"error": "lang must be en, hi or pa"})
        fire = data.get("fire") if isinstance(data.get("fire"), dict) else {}
        fire_metrics = {
            "date": str(fire.get("date", ""))[:10],
            "detections": _integer(fire.get("detections")),
            "high_confidence": _integer(fire.get("high_confidence")),
            "frp_sum_mw": _number(fire.get("frp_sum_mw")),
            "fire_source": "historical_archive" if fire.get("historical") is True else "NASA FIRMS NRT",
        }
        season = data.get("season") if isinstance(data.get("season"), dict) else {}
        season_year = _integer(season.get("year"))
        if season_year is not None and not 2000 <= season_year <= 2100:
            season_year = None
        season_metrics = {
            "year": season_year,
            "detections": _integer(season.get("detections")),
            "peak_date": str(season.get("peak_date", ""))[:10],
            "peak_count": _integer(season.get("peak_count")),
        }
        table = get_table()
        forecast = table.get_item(Key={"pk": f"LATEST#{CITY}", "sk": 0}).get("Item")
        if not forecast:
            return _response(404, {"error": "no_forecast_yet"})
        history = table.query(
            KeyConditionExpression=_history_key().eq(f"HISTORY#{CITY}"),
            ScanIndexForward=False, Limit=10,
        ).get("Items", [])
        context_data = {
            "forecast": {key: _number(forecast.get(key)) for key in ("pm25_now", "24h_q10", "24h_q50", "24h_q90", "48h_q10", "48h_q50", "48h_q90")},
            "generated_at": str(forecast.get("generated_at", ""))[:40],
            "history": [_number(x.get("24h_q50")) for x in reversed(history) if _number(x.get("24h_q50")) is not None],
            "threshold_pm25": THRESHOLD,
            "fire": fire_metrics,
            "season": season_metrics,
        }
        fallback = _fallback(context_data, lang)
        text = fallback
        source = "data-grounded fallback"
        if MODEL_ID:
            try:
                text = _generate(context_data, LANGUAGES[lang])
                source = "Amazon Bedrock Nova Micro"
            except Exception as exc:
                print(f"Bedrock summary unavailable; using grounded fallback: {type(exc).__name__}: {exc}")
        return _response(200, {"summary": text, "source": source, "generated_at": context_data["generated_at"], "data": context_data})
    except Exception as exc:
        print(f"Summary request failed: {exc}")
        return _response(500, {"error": "summary_unavailable"})


def _generate(data, language):
    prompt = (
        "Summarize this structured Delhi pollution forecast and satellite fire-detection data in " + language + ". "
        "Use 2-4 concise sentences. State that pm25_now is a CPCB model-based baseline, not a sensor observation. "
        "Do not claim fires caused pollution or that detections are crop burning. Explain uncertainty, compare 24h vs 48h q50/q90 if available, and describe latest stored q24 history direction only if at least two history values exist. "
        "If season metrics exist, mention the archive's Oct-Nov total as limited-coverage historical context and note cross-sensor/coverage differences; do not attribute causes. "
        "Do not invent facts, health advice, geographic causes, or numbers; only use supplied fields. "
        "Data: " + json.dumps(data, separators=(",", ":"), ensure_ascii=False)
    )
    response = boto3.client("bedrock-runtime", config=Config(connect_timeout=3, read_timeout=18, retries={"max_attempts": 1})).converse(
        modelId=MODEL_ID,
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={"maxTokens": 220, "temperature": 0.2},
    )
    return " ".join(response["output"]["message"]["content"][0]["text"].split())[:1200]


def _fallback(data, lang):
    f, fire = data["forecast"], data["fire"]
    q24, q48 = f["24h_q50"], f["48h_q50"]
    change = ""
    if q24 is not None and q48 is not None:
        if q48 > q24:
            change = {"en": "The 48-hour median is higher than the 24-hour median.", "hi": "48 घंटे की माध्यिका, 24 घंटे की माध्यिका से अधिक है।", "pa": "48 ਘੰਟਿਆਂ ਦਾ ਮੱਧਮਾਨ 24 ਘੰਟਿਆਂ ਦੇ ਮੱਧਮਾਨ ਤੋਂ ਵੱਧ ਹੈ।"}[lang]
        elif q48 < q24:
            change = {"en": "The 48-hour median is lower than the 24-hour median.", "hi": "48 घंटे की माध्यिका, 24 घंटे की माध्यिका से कम है।", "pa": "48 ਘੰਟਿਆਂ ਦਾ ਮੱਧਮਾਨ 24 ਘੰਟਿਆਂ ਦੇ ਮੱਧਮਾਨ ਤੋਂ ਘੱਟ ਹੈ।"}[lang]
        else:
            change = {"en": "The 24-hour and 48-hour medians are similar.", "hi": "24 और 48 घंटे की माध्यिकाएँ समान हैं।", "pa": "24 ਅਤੇ 48 ਘੰਟਿਆਂ ਦੇ ਮੱਧਮਾਨ ਲਗਭਗ ਇੱਕੋ ਜਿਹੇ ਹਨ।"}[lang]
    history = data.get("history") or []
    revision = ""
    if len(history) >= 2 and history[-1] is not None and history[-2] is not None:
        delta = history[-1] - history[-2]
        if abs(delta) < 0.05:
            revision = {"en": "The latest stored 24-hour median is similar to the preceding forecast run.", "hi": "नवीनतम सहेजी गई 24-घंटे की माध्यिका पिछले पूर्वानुमान रन के समान है।", "pa": "ਨਵਾਂ ਸੰਭਾਲਿਆ 24-ਘੰਟੇ ਦਾ ਮੱਧਮਾਨ ਪਿਛਲੇ ਅਨੁਮਾਨ ਰਨ ਦੇ ਲਗਭਗ ਸਮਾਨ ਹੈ।"}[lang]
        else:
            direction = {"en": "rose" if delta > 0 else "fell", "hi": "बढ़ी" if delta > 0 else "घटी", "pa": "ਵਧਿਆ" if delta > 0 else "ਘਟਿਆ"}[lang]
            revision = {"en": f"The latest stored 24-hour median {direction} by {abs(delta):.1f} µg/m³ versus the preceding forecast run.", "hi": f"नवीनतम सहेजी गई 24-घंटे की माध्यिका पिछले रन की तुलना में {abs(delta):.1f} µg/m³ {direction}।", "pa": f"ਨਵਾਂ ਸੰਭਾਲਿਆ 24-ਘੰਟੇ ਦਾ ਮੱਧਮਾਨ ਪਿਛਲੇ ਰਨ ਨਾਲੋਂ {abs(delta):.1f} µg/m³ {direction}।"}[lang]
    high = any(f[k] is not None and f[k] >= data["threshold_pm25"] for k in ("24h_q90", "48h_q90"))
    threshold_text = _fmt(data["threshold_pm25"])
    risk = {
        "en": f"At least one q90 reaches the configured alert threshold ({threshold_text} µg/m³)." if high else f"Neither q90 reaches the configured alert threshold ({threshold_text} µg/m³).",
        "hi": f"कम से कम एक q90 निर्धारित अलर्ट सीमा ({threshold_text} µg/m³) तक पहुँचता है।" if high else f"कोई भी q90 निर्धारित अलर्ट सीमा ({threshold_text} µg/m³) तक नहीं पहुँचता।",
        "pa": f"ਘੱਟੋ-ਘੱਟ ਇੱਕ q90 ਨਿਰਧਾਰਤ ਚੇਤਾਵਨੀ ਹੱਦ ({threshold_text} µg/m³) ਤੱਕ ਪਹੁੰਚਦਾ ਹੈ।" if high else f"ਕੋਈ ਵੀ q90 ਨਿਰਧਾਰਤ ਚੇਤਾਵਨੀ ਹੱਦ ({threshold_text} µg/m³) ਤੱਕ ਨਹੀਂ ਪਹੁੰਚਦਾ।",
    }[lang]
    base = {"en": f"The current CPCB-based PM2.5 input is {_fmt(f['pm25_now'])} µg/m³; it is a model-based baseline, not a sensor observation.", "hi": f"वर्तमान CPCB-आधारित PM2.5 इनपुट {_fmt(f['pm25_now'])} µg/m³ है; यह मॉडल-आधारित आधार है, सेंसर रीडिंग नहीं।", "pa": f"ਮੌਜੂਦਾ CPCB-ਅਧਾਰਿਤ PM2.5 ਇਨਪੁੱਟ {_fmt(f['pm25_now'])} µg/m³ ਹੈ; ਇਹ ਮਾਡਲ-ਅਧਾਰਿਤ ਬੇਸਲਾਈਨ ਹੈ, ਸੈਂਸਰ ਰੀਡਿੰਗ ਨਹੀਂ।"}[lang]
    bits = [base, change, risk]
    if revision:
        bits.append(revision)
    if fire["detections"] is not None:
        firetext = {"en": f"The selected satellite dataset contains {fire['detections']} active-fire detections" + (f" ({fire['high_confidence']} high/nominal confidence)" if fire["high_confidence"] is not None else "") + ". These detections do not establish cause or prove crop-residue burning.", "hi": f"चुने गए उपग्रह डेटा में {fire['detections']} सक्रिय-अग्नि पहचानें हैं। ये पहचान कारण सिद्ध नहीं करतीं और न ही पराली जलाना प्रमाणित करती हैं।", "pa": f"ਚੁਣੇ ਸੈਟੇਲਾਈਟ ਡੇਟਾ ਵਿੱਚ {fire['detections']} ਸਰਗਰਮ-ਅੱਗ ਦੀਆਂ ਪਛਾਣਾਂ ਹਨ। ਇਹ ਪਛਾਣਾਂ ਕਾਰਨ ਜਾਂ ਪਰਾਲੀ ਸਾੜਨ ਦੀ ਪੁਸ਼ਟੀ ਨਹੀਂ ਕਰਦੀਆਂ।"}[lang]
        bits.append(firetext)
    season = data.get("season") or {}
    if season.get("detections") is not None:
        seasontext = {
            "en": f"The project FIRMS archive records {season['detections']} detections for Oct–Nov {season.get('year') or 'in the selected season'} on available dates only; coverage and sensors vary, and the count does not identify the fire cause.",
            "hi": f"परियोजना FIRMS संग्रह में उपलब्ध तारीखों पर Oct–Nov {season.get('year') or ''} के लिए {season['detections']} पहचानें हैं; कवरेज और सेंसर बदलते हैं, और गिनती आग का कारण नहीं बताती।",
            "pa": f"ਪ੍ਰੋਜੈਕਟ FIRMS ਆਰਕਾਈਵ ਵਿੱਚ ਉਪਲਬਧ ਤਾਰੀਖਾਂ 'ਤੇ Oct–Nov {season.get('year') or ''} ਲਈ {season['detections']} ਪਛਾਣਾਂ ਹਨ; ਕਵਰੇਜ ਅਤੇ ਸੈਂਸਰ ਵੱਖਰੇ ਹਨ, ਅਤੇ ਗਿਣਤੀ ਅੱਗ ਦਾ ਕਾਰਨ ਨਹੀਂ ਦੱਸਦੀ।",
        }[lang]
        bits.append(seasontext)
    return " ".join(x for x in bits if x)


def _history_key():
    from boto3.dynamodb.conditions import Key
    return Key("pk")


def _number(value):
    try:
        n = float(value)
        return round(n, 2) if n == n and abs(n) != float("inf") else None
    except (ValueError, TypeError):
        return None


def _integer(value):
    try:
        n = int(value)
        return max(0, min(n, 10000000))
    except (ValueError, TypeError):
        return None


def _fmt(value):
    return "not available" if value is None else f"{value:.1f}"


def _headers():
    return {"Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": os.environ.get("ALLOWED_ORIGIN", "*"), "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,Authorization", "Cache-Control": "no-store"}


def _response(status, payload):
    body = payload if isinstance(payload, str) else json.dumps(payload, default=json_default, ensure_ascii=False)
    return {"statusCode": status, "headers": _headers(), "body": body}
