from datetime import datetime, timezone

import requests

# Approximate coordinates for Delhi
DELHI_LAT = 28.6139
DELHI_LON = 77.2090

WEATHER_URL = "https://api.open-meteo.com/v1/forecast"


def fetch_weather():
    params = {
        "latitude": DELHI_LAT,
        "longitude": DELHI_LON,
        "hourly": (
            "temperature_2m,"
            "relative_humidity_2m,"
            "precipitation,"
            "wind_speed_10m,"
            "wind_direction_10m,"
            "boundary_layer_height"
        ),
        "forecast_days": 2,
        "timezone": "Asia/Kolkata",
    }

    response = requests.get(
        WEATHER_URL,
        params=params,
        timeout=20,
    )
    response.raise_for_status()
    data = response.json()

    hourly = data.get("hourly", {})
    times = hourly.get("time", [])

    if not times:
        raise RuntimeError("Weather API returned no hourly data")

    now = datetime.now(timezone.utc).astimezone()

    return {
        "source": "Open-Meteo",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "timezone": data.get("timezone"),
        "latitude": data.get("latitude"),
        "longitude": data.get("longitude"),
        "hourly": hourly,
    }


if __name__ == "__main__":
    weather = fetch_weather()
    print("Source:", weather["source"])
    print("Timezone:", weather["timezone"])
    print("Forecast hours:", len(weather["hourly"]["time"]))
    print("First forecast time:", weather["hourly"]["time"][0])
    print("First wind speed:", weather["hourly"]["wind_speed_10m"][0])
    print("Weather fetch successful.")
