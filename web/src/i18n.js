import { useCallback, useEffect, useState } from "react";

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "pa", label: "ਪੰਜਾਬੀ" },
];

export const translations = {
  en: {
    appName: "Stubble Smoke",
    tagline: "FORECASTING & AIR QUALITY",
    eyebrow: "LOCAL FORECAST MONITOR",
    title: "Delhi air outlook",
    subtitle: "Particulate pollution predictions for the next 48 hours.",
    location: "Delhi, India",
    refresh: "Refresh",
    loading: "Loading",
    retry: "Retry",
    errorTitle: "Could not load the forecast",
    errorHint: "Ensure the SAM API is running on port 3000.",
    currentPm: "Current PM2.5",
    unitBaseline: "µg/m³ · model input baseline",
    latest: "Latest available",
    median24: "24-hour median",
    median48: "48-hour median",
    unitQ50: "µg/m³ · q50 prediction",
    range: "Range",
    category: "Forecast category",
    unavailable: "Unavailable",
    trendTitle: "Predicted PM2.5 trend",
    trendSub: "Median estimate and q10–q90 model range",
    chartTag: "0–48 HOURS",
    now: "Now",
    h24: "24 hours",
    h48: "48 hours",
    median: "Median / current",
    band: "q10–q90 range",
    chartLoading: "Loading forecast data…",
    chartEmpty: "Forecast data will appear here when available.",
    details: "Forecast details",
    generated: "Forecast generated",
    featureTime: "Feature timestamp",
    source: "Model source",
    disclaimer:
      "Predictions are model estimates, not official air-quality readings or medical advice. Quantile ranges represent model outputs and are not guaranteed confidence intervals.",
    footer: "STUBBLE SMOKE FORECASTER",
    footerNote: "MODEL-BASED FORECASTS",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    language: "Language",
    alertTitle: "High pollution expected",
    alertBody:
      "PM2.5 is forecast to reach {value} µg/m³ ({level}) in about {hours} hours. Limit outdoor activity, wear an N95 mask outside, and keep children and the elderly indoors.",
    alertOk: "Air quality is forecast to stay in an acceptable range.",
    alertsKicker: "SNS EMAIL NOTIFICATIONS",
    alertDescription:
      "The backend checks each new forecast and emails topic subscribers when the q90 estimate crosses the configured limit.",
    model: "MODEL DETAILS",
    alertReady: "SNS alerts are enabled",
    alertHigh: "High-pollution threshold reached",
    alertDisabled: "SNS alerts are not configured",
    alertThreshold: "Threshold",
    alertTopicNote:
      "Email is sent by the forecast service to confirmed addresses subscribed to your SNS topic. Repeated high forecasts do not send repeated messages.",
    alertSetupNote:
      "Set SNS_TOPIC_ARN in the server configuration and subscribe/confirm your email on the SNS topic.",
    historyTitle: "Forecast history points",
    lastChecked: "Dashboard last checked",
    refreshMode: "Data refresh",
    autoEveryFiveMinutes: "Automatic · 5 minutes",
    levels: {
      good: "Good",
      satisfactory: "Satisfactory",
      moderate: "Moderate",
      poor: "Poor",
      veryPoor: "Very Poor",
      severe: "Severe",
    },
  },
  hi: {
    appName: "स्टबल स्मोक",
    tagline: "पूर्वानुमान और वायु गुणवत्ता",
    eyebrow: "स्थानीय पूर्वानुमान मॉनिटर",
    title: "दिल्ली की वायु स्थिति",
    subtitle: "अगले 48 घंटों के लिए कण प्रदूषण का पूर्वानुमान।",
    location: "दिल्ली, भारत",
    refresh: "रीफ़्रेश",
    loading: "लोड हो रहा है",
    retry: "पुनः प्रयास",
    errorTitle: "पूर्वानुमान लोड नहीं हो सका",
    errorHint: "सुनिश्चित करें कि SAM API पोर्ट 3000 पर चल रहा है।",
    currentPm: "वर्तमान PM2.5",
    unitBaseline: "µg/m³ · मॉडल इनपुट आधार",
    latest: "नवीनतम उपलब्ध",
    median24: "24 घंटे का माध्यिका",
    median48: "48 घंटे का माध्यिका",
    unitQ50: "µg/m³ · q50 पूर्वानुमान",
    range: "सीमा",
    category: "पूर्वानुमानित श्रेणी",
    unavailable: "उपलब्ध नहीं",
    trendTitle: "PM2.5 पूर्वानुमान रुझान",
    trendSub: "माध्यिका अनुमान और q10–q90 मॉडल सीमा",
    chartTag: "0–48 घंटे",
    now: "अभी",
    h24: "24 घंटे",
    h48: "48 घंटे",
    median: "माध्यिका / वर्तमान",
    band: "q10–q90 सीमा",
    chartLoading: "पूर्वानुमान डेटा लोड हो रहा है…",
    chartEmpty: "पूर्वानुमान डेटा उपलब्ध होने पर यहाँ दिखेगा।",
    details: "पूर्वानुमान विवरण",
    generated: "पूर्वानुमान बनाया गया",
    featureTime: "फ़ीचर समय",
    source: "मॉडल स्रोत",
    disclaimer:
      "ये पूर्वानुमान मॉडल के अनुमान हैं, आधिकारिक वायु-गुणवत्ता रीडिंग या चिकित्सा सलाह नहीं। क्वांटाइल सीमाएँ मॉडल के आउटपुट हैं, गारंटीशुदा विश्वास अंतराल नहीं।",
    footer: "स्टबल स्मोक फ़ोरकास्टर",
    footerNote: "मॉडल आधारित पूर्वानुमान",
    theme: "थीम",
    light: "लाइट",
    dark: "डार्क",
    language: "भाषा",
    alertTitle: "उच्च प्रदूषण की आशंका",
    alertBody:
      "लगभग {hours} घंटे में PM2.5 {value} µg/m³ ({level}) तक पहुँचने का अनुमान है। बाहरी गतिविधि सीमित रखें, बाहर N95 मास्क पहनें, और बच्चों व बुज़ुर्गों को घर के अंदर रखें।",
    alertOk: "वायु गुणवत्ता स्वीकार्य सीमा में रहने का अनुमान है।",
    alertsKicker: "SNS ईमेल सूचनाएँ",
    alertDescription:
      "बैकएंड हर नए पूर्वानुमान की जाँच करता है और q90 अनुमान तय सीमा पार करने पर विषय-सदस्यों को ईमेल करता है।",
    model: "मॉडल विवरण",
    alertReady: "SNS अलर्ट चालू हैं",
    alertHigh: "अधिक प्रदूषण की सीमा पार",
    alertDisabled: "SNS अलर्ट कॉन्फ़िगर नहीं हैं",
    alertThreshold: "सीमा",
    alertTopicNote:
      "पूर्वानुमान सेवा आपके SNS विषय पर पुष्टि किए गए ईमेल पतों को संदेश भेजती है। लगातार उच्च पूर्वानुमानों पर बार-बार संदेश नहीं भेजे जाते।",
    alertSetupNote:
      "सर्वर कॉन्फ़िगरेशन में SNS_TOPIC_ARN सेट करें और SNS विषय पर अपने ईमेल की सदस्यता लेकर पुष्टि करें।",
    historyTitle: "पूर्वानुमान इतिहास बिंदु",
    lastChecked: "डैशबोर्ड ने जाँचा",
    refreshMode: "डेटा रीफ़्रेश",
    autoEveryFiveMinutes: "स्वचालित · 5 मिनट",
    levels: {
      good: "अच्छा",
      satisfactory: "संतोषजनक",
      moderate: "मध्यम",
      poor: "खराब",
      veryPoor: "बहुत खराब",
      severe: "गंभीर",
    },
  },
  pa: {
    appName: "ਸਟੱਬਲ ਸਮੋਕ",
    tagline: "ਪੂਰਵ-ਅਨੁਮਾਨ ਅਤੇ ਹਵਾ ਦੀ ਗੁਣਵੱਤਾ",
    eyebrow: "ਸਥਾਨਕ ਪੂਰਵ-ਅਨੁਮਾਨ ਮਾਨੀਟਰ",
    title: "ਦਿੱਲੀ ਦੀ ਹਵਾ ਦੀ ਸਥਿਤੀ",
    subtitle: "ਅਗਲੇ 48 ਘੰਟਿਆਂ ਲਈ ਕਣ ਪ੍ਰਦੂਸ਼ਣ ਦਾ ਪੂਰਵ-ਅਨੁਮਾਨ।",
    location: "ਦਿੱਲੀ, ਭਾਰਤ",
    refresh: "ਰਿਫ੍ਰੈਸ਼",
    loading: "ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ",
    retry: "ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ",
    errorTitle: "ਪੂਰਵ-ਅਨੁਮਾਨ ਲੋਡ ਨਹੀਂ ਹੋ ਸਕਿਆ",
    errorHint: "ਯਕੀਨੀ ਬਣਾਓ ਕਿ SAM API ਪੋਰਟ 3000 'ਤੇ ਚੱਲ ਰਿਹਾ ਹੈ।",
    currentPm: "ਮੌਜੂਦਾ PM2.5",
    unitBaseline: "µg/m³ · ਮਾਡਲ ਇਨਪੁੱਟ ਆਧਾਰ",
    latest: "ਤਾਜ਼ਾ ਉਪਲਬਧ",
    median24: "24 ਘੰਟੇ ਦਾ ਮੱਧਮਾਨ",
    median48: "48 ਘੰਟੇ ਦਾ ਮੱਧਮਾਨ",
    unitQ50: "µg/m³ · q50 ਪੂਰਵ-ਅਨੁਮਾਨ",
    range: "ਦਾਇਰਾ",
    category: "ਪੂਰਵ-ਅਨੁਮਾਨਿਤ ਸ਼੍ਰੇਣੀ",
    unavailable: "ਉਪਲਬਧ ਨਹੀਂ",
    trendTitle: "PM2.5 ਪੂਰਵ-ਅਨੁਮਾਨ ਰੁਝਾਨ",
    trendSub: "ਮੱਧਮਾਨ ਅਨੁਮਾਨ ਅਤੇ q10–q90 ਮਾਡਲ ਦਾਇਰਾ",
    chartTag: "0–48 ਘੰਟੇ",
    now: "ਹੁਣ",
    h24: "24 ਘੰਟੇ",
    h48: "48 ਘੰਟੇ",
    median: "ਮੱਧਮਾਨ / ਮੌਜੂਦਾ",
    band: "q10–q90 ਦਾਇਰਾ",
    chartLoading: "ਪੂਰਵ-ਅਨੁਮਾਨ ਡੇਟਾ ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…",
    chartEmpty: "ਪੂਰਵ-ਅਨੁਮਾਨ ਡੇਟਾ ਉਪਲਬਧ ਹੋਣ 'ਤੇ ਇੱਥੇ ਦਿਖਾਈ ਦੇਵੇਗਾ।",
    details: "ਪੂਰਵ-ਅਨੁਮਾਨ ਵੇਰਵੇ",
    generated: "ਪੂਰਵ-ਅਨੁਮਾਨ ਬਣਾਇਆ ਗਿਆ",
    featureTime: "ਫੀਚਰ ਸਮਾਂ",
    source: "ਮਾਡਲ ਸਰੋਤ",
    disclaimer:
      "ਇਹ ਪੂਰਵ-ਅਨੁਮਾਨ ਮਾਡਲ ਦੇ ਅਨੁਮਾਨ ਹਨ, ਅਧਿਕਾਰਤ ਹਵਾ-ਗੁਣਵੱਤਾ ਰੀਡਿੰਗ ਜਾਂ ਡਾਕਟਰੀ ਸਲਾਹ ਨਹੀਂ। ਕੁਆਂਟਾਈਲ ਦਾਇਰੇ ਮਾਡਲ ਦੇ ਆਊਟਪੁੱਟ ਹਨ, ਗਾਰੰਟੀਸ਼ੁਦਾ ਭਰੋਸਾ ਅੰਤਰਾਲ ਨਹੀਂ।",
    footer: "ਸਟੱਬਲ ਸਮੋਕ ਫੋਰਕਾਸਟਰ",
    footerNote: "ਮਾਡਲ-ਅਧਾਰਿਤ ਪੂਰਵ-ਅਨੁਮਾਨ",
    theme: "ਥੀਮ",
    light: "ਲਾਈਟ",
    dark: "ਡਾਰਕ",
    language: "ਭਾਸ਼ਾ",
    alertTitle: "ਉੱਚ ਪ੍ਰਦੂਸ਼ਣ ਦੀ ਸੰਭਾਵਨਾ",
    alertBody:
      "ਲਗਭਗ {hours} ਘੰਟਿਆਂ ਵਿੱਚ PM2.5 {value} µg/m³ ({level}) ਤੱਕ ਪਹੁੰਚਣ ਦਾ ਅਨੁਮਾਨ ਹੈ। ਬਾਹਰੀ ਸਰਗਰਮੀ ਸੀਮਤ ਰੱਖੋ, ਬਾਹਰ N95 ਮਾਸਕ ਪਹਿਨੋ, ਅਤੇ ਬੱਚਿਆਂ ਤੇ ਬਜ਼ੁਰਗਾਂ ਨੂੰ ਘਰ ਅੰਦਰ ਰੱਖੋ।",
    alertOk: "ਹਵਾ ਦੀ ਗੁਣਵੱਤਾ ਮਨਜ਼ੂਰ ਦਾਇਰੇ ਵਿੱਚ ਰਹਿਣ ਦਾ ਅਨੁਮਾਨ ਹੈ।",
    alertsKicker: "SNS ਈਮੇਲ ਸੂਚਨਾਵਾਂ",
    alertDescription:
      "ਬੈਕਐਂਡ ਹਰ ਨਵੇਂ ਅਨੁਮਾਨ ਦੀ ਜਾਂਚ ਕਰਦਾ ਹੈ ਅਤੇ q90 ਅਨੁਮਾਨ ਨਿਰਧਾਰਤ ਹੱਦ ਪਾਰ ਕਰਨ 'ਤੇ ਵਿਸ਼ੇ ਦੇ ਮੈਂਬਰਾਂ ਨੂੰ ਈਮੇਲ ਕਰਦਾ ਹੈ।",
    model: "ਮਾਡਲ ਵੇਰਵੇ",
    alertReady: "SNS ਚੇਤਾਵਨੀਆਂ ਚਾਲੂ ਹਨ",
    alertHigh: "ਵੱਧ ਪ੍ਰਦੂਸ਼ਣ ਦੀ ਹੱਦ ਪਾਰ ਹੋਈ",
    alertDisabled: "SNS ਚੇਤਾਵਨੀਆਂ ਕਨਫ਼ਿਗਰ ਨਹੀਂ ਹਨ",
    alertThreshold: "ਹੱਦ",
    alertTopicNote:
      "ਪੂਰਵ-ਅਨੁਮਾਨ ਸੇਵਾ ਤੁਹਾਡੇ SNS ਵਿਸ਼ੇ 'ਤੇ ਪੁਸ਼ਟੀ ਕੀਤੇ ਈਮੇਲ ਪਤਿਆਂ ਨੂੰ ਸੁਨੇਹਾ ਭੇਜਦੀ ਹੈ। ਲਗਾਤਾਰ ਉੱਚ ਅਨੁਮਾਨਾਂ 'ਤੇ ਮੁੜ-ਮੁੜ ਸੁਨੇਹੇ ਨਹੀਂ ਭੇਜੇ ਜਾਂਦੇ।",
    alertSetupNote:
      "ਸਰਵਰ ਸੈਟਿੰਗ ਵਿੱਚ SNS_TOPIC_ARN ਸੈੱਟ ਕਰੋ ਅਤੇ SNS ਵਿਸ਼ੇ 'ਤੇ ਆਪਣੀ ਈਮੇਲ ਦੀ ਸਬਸਕ੍ਰਿਪਸ਼ਨ ਕਰਕੇ ਪੁਸ਼ਟੀ ਕਰੋ।",
    historyTitle: "ਪੂਰਵ-ਅਨੁਮਾਨ ਇਤਿਹਾਸ ਬਿੰਦੂ",
    lastChecked: "ਡੈਸ਼ਬੋਰਡ ਨੇ ਜਾਂਚਿਆ",
    refreshMode: "ਡੇਟਾ ਤਾਜ਼ਾ",
    autoEveryFiveMinutes: "ਆਟੋਮੈਟਿਕ · 5 ਮਿੰਟ",
    levels: {
      good: "ਚੰਗੀ",
      satisfactory: "ਤਸੱਲੀਬਖਸ਼",
      moderate: "ਦਰਮਿਆਨੀ",
      poor: "ਮਾੜੀ",
      veryPoor: "ਬਹੁਤ ਮਾੜੀ",
      severe: "ਗੰਭੀਰ",
    },
  },
};

// CPCB India PM2.5 bands
const BANDS = [
  [30, "good"],
  [60, "satisfactory"],
  [90, "moderate"],
  [120, "poor"],
  [250, "veryPoor"],
  [Infinity, "severe"],
];

export function categoryOf(pm25) {
  if (pm25 === null || pm25 === undefined || !Number.isFinite(pm25))
    return null;
  const i = BANDS.findIndex(([upper]) => pm25 <= upper);
  return { key: BANDS[i][1], index: i };
}

export function format(str, vars) {
  return str.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

function safeGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function useLanguage() {
  const [lang, setLang] = useState(() => {
    const saved = safeGet("stubble-lang");
    return translations[saved] ? saved : "en";
  });
  useEffect(() => {
    safeSet("stubble-lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);
  return [lang, setLang, translations[lang]];
}

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = safeGet("stubble-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    safeSet("stubble-theme", theme);
  }, [theme]);
  const toggle = useCallback(
    () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    [],
  );
  return [theme, toggle];
}
