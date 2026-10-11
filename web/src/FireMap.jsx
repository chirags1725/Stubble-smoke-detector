import {
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip as MapTooltip,
  ZoomControl,
} from "react-leaflet";

function fmt(value, digits = 1) {
  return value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
    ? "—"
    : Number(value).toFixed(digits);
}
function stamp(value, lang) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleString(lang, { dateStyle: "short", timeStyle: "short" });
}
function heatColor(value) {
  return value >= 80
    ? "#ef4444"
    : value >= 30
      ? "#f97316"
      : value >= 8
        ? "#eab308"
        : "#84cc16";
}
function radius(value, max = 120) {
  return Math.max(
    5,
    Math.min(
      18,
      4 + Math.sqrt(Math.max(0, value || 0) / Math.max(1, max)) * 14,
    ),
  );
}

export default function FireMap({ detections, lang, t }) {
  const max = Math.max(
    1,
    ...detections.map((x) => Number(x.frp_mw || x.frp_sum_mw || x.count || 0)),
  );
  return (
    <MapContainer
      center={[30.25, 76.1]}
      zoom={7}
      scrollWheelZoom
      className="fire-map"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomControl position="bottomright" />
      {detections.map((item, index) => {
        const val = Number(item.frp_mw ?? item.frp_sum_mw ?? item.count ?? 0);
        const color = heatColor(val);
        return (
          <CircleMarker
            key={`${item.latitude ?? item.lat}-${item.longitude ?? item.lon}-${index}`}
            center={[
              Number(item.latitude ?? item.lat),
              Number(item.longitude ?? item.lon),
            ]}
            radius={radius(val, max)}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.68,
              weight: 1.2,
            }}
          >
            <MapTooltip>
              <div className="map-pop">
                <b>
                  {item.count
                    ? `${item.count} ${t.detection}`
                    : `${t.frpIntensity} ${fmt(val)} MW`}
                </b>
                <span>
                  {t.confidenceLabel}:{" "}
                  {item.confidence ||
                    (item.high_confidence_count
                      ? `${item.high_confidence_count} ${t.confidenceHigh}`
                      : t.unknown)}
                </span>
                {item.brightness_kelvin != null && (
                  <span>
                    {t.brightness}: {fmt(item.brightness_kelvin)} K
                  </span>
                )}
                <span>
                  {item.acq_datetime_utc
                    ? `${stamp(item.acq_datetime_utc, lang)} ${t.utc}`
                    : t.source}
                </span>
              </div>
            </MapTooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
