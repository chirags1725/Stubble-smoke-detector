import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BellRing, BrainCircuit,
  CalendarDays, CheckCircle2, ChevronRight, Clock3, Database, Flame, Info,
  Languages, Layers3, MapPin, Moon, RefreshCw, Satellite, Sun, Wind,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { LANGUAGES, translations, useLanguage, useTheme } from "./i18n";
import "leaflet/dist/leaflet.css";
import "./App.css";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const FireMap = lazy(() => import("./FireMap.jsx"));
const FIRMS_EARLIEST_DATE = "2000-11-01";
const NO_FIRES_TEXT = {
  en: "No fire detections were reported by the available FIRMS products for this date.",
  hi: "इस तारीख के लिए उपलब्ध FIRMS उत्पादों में आग की पहचान नहीं मिली।",
  pa: "ਇਸ ਤਾਰੀਖ ਲਈ ਉਪਲਬਧ FIRMS ਉਤਪਾਦਾਂ ਵਿੱਚ ਅੱਗ ਦੀ ਕੋਈ ਪਛਾਣ ਨਹੀਂ ਮਿਲੀ।",
};
const MAP_DATE_HINT = {
  en: "Choose any date covered by NASA FIRMS. Recent dates use near-real-time products; older dates use archived standard products when available.",
  hi: "NASA FIRMS में उपलब्ध कोई भी तारीख चुनें। हाल की तारीखों के लिए निकट-वास्तविक-समय और पुरानी तारीखों के लिए उपलब्ध आर्काइव उत्पाद दिखेंगे।",
  pa: "NASA FIRMS ਵਿੱਚ ਉਪਲਬਧ ਕੋਈ ਵੀ ਤਾਰੀਖ ਚੁਣੋ। ਤਾਜ਼ਾ ਤਾਰੀਖਾਂ ਲਈ near-real-time ਅਤੇ ਪੁਰਾਣੀਆਂ ਲਈ ਉਪਲਬਧ archive ਉਤਪਾਦ ਵਰਤੇ ਜਾਣਗੇ।",
};
const UI = {
  en: {
    tabs: ["Overview", "Fire activity", "Forecast trends", "Season monitor", "Email alerts"],
    eyebrow: "DELHI · AIR & FIRE INTELLIGENCE", title: "A clearer view of the season", subtitle: "Satellite fire activity, model outlooks, and historical context — with sources kept distinct.",
    live: "LIVE DATA", overview: "OVERVIEW", fire: "FIRE ACTIVITY", trends: "FORECAST TRENDS", season: "SEASON MONITOR", alerts: "ALERT CENTER",
    updated: "Updated", update: "Refresh forecast", loading: "Loading…", viewMap: "Open fire map", explore: "Explore trends", noForecast: "No forecast yet. Start SAM, DynamoDB Local and the local runner, then refresh.",
    camBaseline: "CPCB model input", forecast24: "24h median outlook", forecast48: "48h median outlook", fireCount: "Satellite detections", confidence: "High / nominal confidence", latest: "Forecast generated", range: "Model range q10–q90", frp: "FRP total", mw: "MW", notObservation: "PM2.5 baseline is a CPCB model value — not a ground-monitor observation.",
    summary: "AI data brief", summarize: "Generate summary", summarizing: "Reading the data…", summaryHint: "A concise narrative grounded in the latest forecast, history and selected fire data. Bedrock is used when enabled; otherwise a transparent rules-based summary is shown.", summarySource: "Summary method", noSummary: "Generate a brief when the dashboard has data.", summaryCaveat: "Not official public-health advice. Fire detections do not prove a cause or establish that crop residue was burned.",
    mapTitle: "Satellite fire detections", mapSubtitle: "Select a date to view NASA FIRMS near-real-time detections or the project's gridded historical archive.", date: "Observation date", mapRefresh: "Refresh map", source: "Data source", liveSource: "Live NASA FIRMS", archiveSource: "Project historical archive", mapped: "Shown on map", total: "Total detections", selected: "Selected day", mapNote: "Circle size/color reflect fire radiative power (FRP), not a measured flame size. Historical archive markers aggregate detections within ~0.1° cells.", causeNote: "Hotspots are satellite thermal anomalies. They can include crop fires, other fires and false positives; they are not proof of stubble burning.", confidenceLow: "Lower confidence", confidenceHigh: "High / nominal", noMap: "No fire records for this date in the available archive.", mapLoading: "Loading map data…", recentLimit: "Recent dates use near-real-time products; older dates query FIRMS archived products when available. The project archive is a limited fallback.", mapError: "Fire data is unavailable. Check the FIRMS key and retry.", lastPass: "Latest satellite pass", detection: "detections", allSources: "Sensors", frpIntensity: "FRP intensity", brightness: "Brightness", utc: "UTC",
    trendTitle: "Forecasts over time", trendSubtitle: "Stored model outputs; each point is a forecast run, not an hourly observation.", baselineSeries: "CPCB baseline (model input)", q24: "24h q50", q48: "48h q50", q90_24: "24h q90", q90_48: "48h q90", historyCount: "Stored forecast runs", changeTitle: "Latest forecast revisions", changeSub: "How the last saved prediction compares with the previous run.", previous: "Previous run", current: "Latest run", delta24: "24h median change", delta48: "48h median change", noHistory: "History appears after forecast runs are saved.", comparison: "Horizon comparison", uncertainty: "Quantile spread by horizon", interval: "q90 − q10 spread", history: "Forecast history",
    seasonTitle: "Stubble-burning season monitor", seasonSubtitle: "Historical NASA FIRMS detections from project CSVs, summarized by day and year.", yearly: "Oct–Nov detections by year", daily: "Daily FIRMS detections · selected year", chooseYear: "Season year", seasonalAvg: "Average per recorded date", dailyChartNote: "Bars show hotspots counted on each date in the selected year. Line shows the median count for that same calendar date across other archive years. Dates missing from a source are excluded, not treated as zero.", unusual: "Unusually active dates", baselineYear: "Same-date median · other years", coverage: "Archive coverage", years: "years", coverageNote: "The included archive spans Oct 1–Nov 30 for years with source files (2016–2025). Missing days are unknown, not zero. Counts depend on source/product coverage and are not directly comparable across sensors or processing versions.", noYear: "No historical records are included for this year.", peakDay: "Peak day", dailyCounts: "Detections on selected date", annualTotal: "Season total", fireAttribution: "Seasonal activity cannot by itself identify crop-residue burning. Use independent validation before attributing detections.",
    emailTitle: "Email alerts that stay useful", emailSub: "SNS sends one message on a low-to-high q90 threshold crossing, then waits for a below-threshold run before alerting again.", enabled: "SNS configured", notEnabled: "SNS not configured", threshold: "Threshold", trigger: "Trigger condition", triggerText: "Either the 24-hour or 48-hour q90 reaches the configured PM2.5 threshold.", cadence: "Evaluation cadence", cadenceText: "At each completed forecast run (hourly schedule by default, or manual refresh).", recipient: "Recipients", recipientText: "Confirmed email subscribers to the existing SNS topic.", pending: "Subscription confirmation required", pendingText: "Pending subscriptions receive no email until the recipient confirms from their inbox.", testCommand: "Safe connectivity test", testText: "Your AWS CLI publish command already proves the topic can accept a message. For live forecasts, verify Lambda SNS permissions and CloudWatch logs.", ops: "Troubleshooting checklist", noSpam: "Repeat high runs are deduplicated", belowReset: "A forecast below threshold resets the episode", failureRetry: "Publish failures are logged and the claim is released for a later retry", destination: "Topic", emailDisclaimer: "Email describes a forecast, not an official reading. Tune the threshold to your use case; 150 µg/m³ is an app default, not a universal health standard.",
    sources: "Data lineage", sourceFirms: "NASA FIRMS VIIRS · active-fire satellite detections", sourceCPCB: "CPCB via Open-Meteo · current PM2.5 model input", sourceModel: "Six LightGBM quantile models · 24h / 48h", sourceHistory: "DynamoDB · saved forecast runs", sourceArchive: "Project CSV archive · gridded to 0.1° for historical map", confidenceLabel: "Confidence", low: "Low", nominal: "Nominal", high: "High", noValue: "—", retry: "Retry", fireUnavailable: "Live FIRMS request did not succeed. Historical archive is available for dates in its coverage.", askDate: "Pick a date to inspect", summaryFailed: "Could not create summary", unknown: "Unknown",
  },
  hi: {
    tabs: ["सारांश", "आग गतिविधि", "पूर्वानुमान रुझान", "मौसम मॉनिटर", "ईमेल अलर्ट"],
    eyebrow: "दिल्ली · वायु और आग विश्लेषण", title: "मौसम का स्पष्ट दृश्य", subtitle: "उपग्रह आग गतिविधि, मॉडल पूर्वानुमान और ऐतिहासिक संदर्भ — अलग-अलग स्रोतों के साथ।",
    live: "लाइव डेटा", overview: "सारांश", fire: "आग गतिविधि", trends: "पूर्वानुमान रुझान", season: "मौसम मॉनिटर", alerts: "अलर्ट केंद्र",
    updated: "अपडेट", update: "पूर्वानुमान रीफ़्रेश", loading: "लोड हो रहा है…", viewMap: "आग का नक्शा खोलें", explore: "रुझान देखें", noForecast: "अभी पूर्वानुमान नहीं है। SAM, DynamoDB Local और लोकल रनर शुरू करके रीफ़्रेश करें।",
    camBaseline: "CPCB मॉडल इनपुट", forecast24: "24 घंटे का माध्यिका पूर्वानुमान", forecast48: "48 घंटे का माध्यिका पूर्वानुमान", fireCount: "उपग्रह पहचानें", confidence: "उच्च / सामान्य विश्वास", latest: "पूर्वानुमान बनाया", range: "मॉडल सीमा q10–q90", frp: "कुल FRP", mw: "MW", notObservation: "PM2.5 आधार CPCB मॉडल मान है — ग्राउंड मॉनिटर की रीडिंग नहीं।",
    summary: "AI डेटा सार", summarize: "सारांश बनाएँ", summarizing: "डेटा पढ़ रहा है…", summaryHint: "नवीनतम पूर्वानुमान, इतिहास और चुने गए अग्नि डेटा पर आधारित संक्षिप्त विवरण। Bedrock उपलब्ध होने पर उपयोग होगा; अन्यथा स्पष्ट नियम-आधारित सारांश।", summarySource: "सारांश विधि", noSummary: "डेटा उपलब्ध होने पर सारांश बनाएँ।", summaryCaveat: "यह आधिकारिक स्वास्थ्य सलाह नहीं है। आग की पहचान कारण या पराली जलाना सिद्ध नहीं करती।",
    mapTitle: "उपग्रह आग पहचानें", mapSubtitle: "तारीख चुनकर NASA FIRMS का निकट-वास्तविक-समय डेटा या परियोजना का ग्रिडेड ऐतिहासिक संग्रह देखें।", date: "अवलोकन तिथि", mapRefresh: "नक्शा रीफ़्रेश", source: "डेटा स्रोत", liveSource: "लाइव NASA FIRMS", archiveSource: "परियोजना ऐतिहासिक संग्रह", mapped: "नक्शे पर दिखाया", total: "कुल पहचानें", selected: "चुना दिन", mapNote: "वृत्त का आकार/रंग FRP दिखाते हैं, आग का मापा आकार नहीं। ऐतिहासिक संकेत लगभग 0.1° ग्रिड में कई पहचानों को जोड़ते हैं।", causeNote: "हॉटस्पॉट उपग्रह तापीय संकेत हैं। इनमें फसल और अन्य आग या गलत संकेत हो सकते हैं; ये पराली जलाना सिद्ध नहीं करते।", confidenceLow: "कम विश्वास", confidenceHigh: "उच्च / सामान्य", noMap: "इस तारीख के लिए उपलब्ध संग्रह में रिकॉर्ड नहीं हैं।", mapLoading: "नक्शा डेटा लोड हो रहा है…", recentLimit: "निकट-वास्तविक-समय दृश्य नवीनतम पाँच दिनों तक है; पुरानी तारीखों के लिए उपलब्ध संग्रह दिखेगा।", mapError: "आग डेटा उपलब्ध नहीं। FIRMS key जाँचकर पुनः प्रयास करें।", lastPass: "नवीनतम उपग्रह पास", detection: "पहचानें", allSources: "सेंसर", frpIntensity: "FRP तीव्रता", brightness: "चमक", utc: "UTC",
    trendTitle: "समय के साथ पूर्वानुमान", trendSubtitle: "सहेजे गए मॉडल आउटपुट; हर बिंदु एक पूर्वानुमान रन है, प्रति घंटा मापन नहीं।", baselineSeries: "CPCB आधार (मॉडल इनपुट)", q24: "24h q50", q48: "48h q50", q90_24: "24h q90", q90_48: "48h q90", historyCount: "सहेजे गए रन", changeTitle: "नवीनतम पूर्वानुमान संशोधन", changeSub: "नवीनतम सहेजे गए पूर्वानुमान की पिछले रन से तुलना।", previous: "पिछला रन", current: "नवीनतम रन", delta24: "24h माध्यिका बदलाव", delta48: "48h माध्यिका बदलाव", noHistory: "पूर्वानुमान रन सहेजने के बाद इतिहास दिखेगा।", comparison: "अवधि तुलना", uncertainty: "अवधि अनुसार क्वांटाइल अंतर", interval: "q90 − q10 अंतर", history: "पूर्वानुमान इतिहास",
    seasonTitle: "पराली मौसम मॉनिटर", seasonSubtitle: "परियोजना CSV से ऐतिहासिक NASA FIRMS पहचानें, दिन और वर्ष के अनुसार।", yearly: "अक्टूबर–नवंबर पहचानें प्रति वर्ष", daily: "चुने वर्ष की दैनिक FIRMS पहचानें", chooseYear: "मौसम वर्ष", seasonalAvg: "रिकॉर्ड वाली तारीखों पर औसत पहचानें", dailyChartNote: "बार चुने वर्ष की हर तारीख पर गिने गए उपग्रह हॉटस्पॉट दिखाते हैं। रेखा दूसरे संग्रह-वर्षों में उसी कैलेंडर तारीख की पहचान-गिनती का माध्यिका है। स्रोत में अनुपलब्ध तारीखें तुलना से छोड़ी जाती हैं, शून्य नहीं मानी जातीं।", unusual: "असामान्य सक्रिय दिन", baselineYear: "अन्य वर्षों में उसी तारीख का माध्यिका", coverage: "संग्रह कवरेज", years: "वर्ष", coverageNote: "संग्रह में स्रोत फ़ाइलों वाले वर्षों (2016–2025) के 1 अक्टूबर–30 नवंबर शामिल हैं। अनुपलब्ध दिन अज्ञात हैं, शून्य नहीं। सेंसर/प्रोसेसिंग के कारण गिनती सीधे तुलना योग्य नहीं हो सकती।", noYear: "इस वर्ष का ऐतिहासिक रिकॉर्ड उपलब्ध नहीं।", peakDay: "सबसे सक्रिय दिन", dailyCounts: "चुनी तारीख की पहचानें", annualTotal: "मौसम कुल", fireAttribution: "मौसमी गतिविधि अकेले पराली जलाना नहीं बताती। कारण के लिए स्वतंत्र पुष्टि करें।",
    emailTitle: "उपयोगी बने रहने वाले ईमेल अलर्ट", emailSub: "SNS q90 सीमा कम से अधिक होने पर एक संदेश भेजता है, फिर अगली चेतावनी से पहले सीमा से कम पूर्वानुमान की प्रतीक्षा करता है।", enabled: "SNS कॉन्फ़िगर", notEnabled: "SNS कॉन्फ़िगर नहीं", threshold: "सीमा", trigger: "ट्रिगर शर्त", triggerText: "24 या 48 घंटे का q90 निर्धारित PM2.5 सीमा तक पहुँचे।", cadence: "जाँच आवृत्ति", cadenceText: "हर पूर्ण पूर्वानुमान रन पर (डिफ़ॉल्ट प्रति घंटा या मैनुअल रीफ़्रेश)।", recipient: "प्राप्तकर्ता", recipientText: "मौजूदा SNS विषय के पुष्टि किए गए ईमेल सदस्य।", pending: "सदस्यता पुष्टि आवश्यक", pendingText: "प्राप्तकर्ता इनबॉक्स में पुष्टि करने तक लंबित सदस्यता को ईमेल नहीं मिलता।", testCommand: "कनेक्शन जाँच", testText: "AWS CLI publish कमांड विषय की पहुँच जाँचता है। लाइव पूर्वानुमान के लिए Lambda SNS अनुमति और CloudWatch लॉग जाँचें।", ops: "समस्या जाँच", noSpam: "लगातार उच्च रन पर दोहराव नहीं", belowReset: "सीमा से कम पूर्वानुमान एपिसोड रीसेट करता है", failureRetry: "भेजने में विफलता लॉग होती है और बाद में पुनः प्रयास के लिए दावा मुक्त होता है", destination: "विषय", emailDisclaimer: "ईमेल पूर्वानुमान है, आधिकारिक रीडिंग नहीं। 150 µg/m³ ऐप डिफ़ॉल्ट है, सार्वभौमिक स्वास्थ्य सीमा नहीं।",
    sources: "डेटा स्रोत", sourceFirms: "NASA FIRMS VIIRS · उपग्रह आग पहचानें", sourceCPCB: "CPCB via Open-Meteo · PM2.5 मॉडल इनपुट", sourceModel: "छह LightGBM क्वांटाइल मॉडल · 24h / 48h", sourceHistory: "DynamoDB · सहेजे पूर्वानुमान रन", sourceArchive: "परियोजना CSV · ऐतिहासिक नक्शा 0.1° ग्रिड में", confidenceLabel: "विश्वास", low: "कम", nominal: "सामान्य", high: "उच्च", noValue: "—", retry: "पुनः प्रयास", fireUnavailable: "लाइव FIRMS अनुरोध विफल हुआ। संग्रह में उपलब्ध तारीखों का ऐतिहासिक डेटा देखें।", askDate: "देखने के लिए तारीख चुनें", summaryFailed: "सारांश नहीं बन सका", unknown: "अज्ञात",
  },
  pa: {
    tabs: ["ਸੰਖੇਪ", "ਅੱਗ ਸਰਗਰਮੀ", "ਪੂਰਵ-ਅਨੁਮਾਨ ਰੁਝਾਨ", "ਮੌਸਮ ਮਾਨੀਟਰ", "ਈਮੇਲ ਚੇਤਾਵਨੀਆਂ"],
    eyebrow: "ਦਿੱਲੀ · ਹਵਾ ਅਤੇ ਅੱਗ ਜਾਣਕਾਰੀ", title: "ਮੌਸਮ ਦੀ ਸਪਸ਼ਟ ਤਸਵੀਰ", subtitle: "ਸੈਟੇਲਾਈਟ ਅੱਗ ਸਰਗਰਮੀ, ਮਾਡਲ ਅਨੁਮਾਨ ਅਤੇ ਇਤਿਹਾਸਕ ਸੰਦਰਭ — ਵੱਖਰੇ ਸਰੋਤਾਂ ਨਾਲ।",
    live: "ਲਾਈਵ ਡੇਟਾ", overview: "ਸੰਖੇਪ", fire: "ਅੱਗ ਸਰਗਰਮੀ", trends: "ਅਨੁਮਾਨ ਰੁਝਾਨ", season: "ਮੌਸਮ ਮਾਨੀਟਰ", alerts: "ਚੇਤਾਵਨੀ ਕੇਂਦਰ",
    updated: "ਅੱਪਡੇਟ", update: "ਅਨੁਮਾਨ ਤਾਜ਼ਾ ਕਰੋ", loading: "ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…", viewMap: "ਅੱਗ ਦਾ ਨਕਸ਼ਾ ਖੋਲ੍ਹੋ", explore: "ਰੁਝਾਨ ਵੇਖੋ", noForecast: "ਹਾਲੇ ਅਨੁਮਾਨ ਨਹੀਂ। SAM, DynamoDB Local ਅਤੇ ਲੋਕਲ ਰਨਰ ਚਲਾ ਕੇ ਤਾਜ਼ਾ ਕਰੋ।",
    camBaseline: "CPCB ਮਾਡਲ ਇਨਪੁੱਟ", forecast24: "24 ਘੰਟੇ ਮੱਧਮਾਨ ਅਨੁਮਾਨ", forecast48: "48 ਘੰਟੇ ਮੱਧਮਾਨ ਅਨੁਮਾਨ", fireCount: "ਸੈਟੇਲਾਈਟ ਪਛਾਣਾਂ", confidence: "ਉੱਚ / ਆਮ ਭਰੋਸਾ", latest: "ਅਨੁਮਾਨ ਬਣਿਆ", range: "ਮਾਡਲ ਦਾਇਰਾ q10–q90", frp: "ਕੁੱਲ FRP", mw: "MW", notObservation: "PM2.5 ਬੇਸਲਾਈਨ CPCB ਮਾਡਲ ਮੁੱਲ ਹੈ — ਗਰਾਊਂਡ ਮਾਨੀਟਰ ਰੀਡਿੰਗ ਨਹੀਂ।",
    summary: "AI ਡੇਟਾ ਸੰਖੇਪ", summarize: "ਸੰਖੇਪ ਬਣਾਓ", summarizing: "ਡੇਟਾ ਪੜ੍ਹ ਰਿਹਾ ਹੈ…", summaryHint: "ਨਵੇਂ ਅਨੁਮਾਨ, ਇਤਿਹਾਸ ਅਤੇ ਚੁਣੇ ਅੱਗ ਡੇਟਾ 'ਤੇ ਆਧਾਰਿਤ ਛੋਟਾ ਵੇਰਵਾ। Bedrock ਉਪਲਬਧ ਹੋਵੇ ਤਾਂ ਵਰਤਿਆ ਜਾਵੇਗਾ; ਨਹੀਂ ਤਾਂ ਨਿਯਮ-ਅਧਾਰਿਤ ਸੰਖੇਪ।", summarySource: "ਸੰਖੇਪ ਢੰਗ", noSummary: "ਡੇਟਾ ਆਉਣ 'ਤੇ ਸੰਖੇਪ ਬਣਾਓ।", summaryCaveat: "ਇਹ ਅਧਿਕਾਰਤ ਸਿਹਤ ਸਲਾਹ ਨਹੀਂ। ਅੱਗ ਦੀਆਂ ਪਛਾਣਾਂ ਕਾਰਨ ਜਾਂ ਪਰਾਲੀ ਸਾੜਨ ਦੀ ਪੁਸ਼ਟੀ ਨਹੀਂ ਕਰਦੀਆਂ।",
    mapTitle: "ਸੈਟੇਲਾਈਟ ਅੱਗ ਪਛਾਣਾਂ", mapSubtitle: "NASA FIRMS ਦੇ ਤਾਜ਼ਾ ਡੇਟਾ ਜਾਂ ਪ੍ਰੋਜੈਕਟ ਦੇ ਗ੍ਰਿਡ ਕੀਤੇ ਇਤਿਹਾਸਕ ਆਰਕਾਈਵ ਲਈ ਤਾਰੀਖ ਚੁਣੋ।", date: "ਨਿਰੀਖਣ ਤਾਰੀਖ", mapRefresh: "ਨਕਸ਼ਾ ਤਾਜ਼ਾ ਕਰੋ", source: "ਡੇਟਾ ਸਰੋਤ", liveSource: "ਲਾਈਵ NASA FIRMS", archiveSource: "ਪ੍ਰੋਜੈਕਟ ਇਤਿਹਾਸਕ ਆਰਕਾਈਵ", mapped: "ਨਕਸ਼ੇ 'ਤੇ", total: "ਕੁੱਲ ਪਛਾਣਾਂ", selected: "ਚੁਣਿਆ ਦਿਨ", mapNote: "ਚੱਕਰ ਦਾ ਆਕਾਰ/ਰੰਗ FRP ਦਿਖਾਉਂਦੇ ਹਨ, ਅੱਗ ਦਾ ਮਾਪਿਆ ਆਕਾਰ ਨਹੀਂ। ਇਤਿਹਾਸਕ ਨਿਸ਼ਾਨ ਲਗਭਗ 0.1° ਗ੍ਰਿਡ ਵਿੱਚ ਜੋੜੇ ਹਨ।", causeNote: "ਹੌਟਸਪੌਟ ਸੈਟੇਲਾਈਟ ਤਾਪ ਸੰਕੇਤ ਹਨ। ਇਹ ਫਸਲ, ਹੋਰ ਅੱਗ ਜਾਂ ਗਲਤ ਸੰਕੇਤ ਹੋ ਸਕਦੇ ਹਨ; ਇਹ ਪਰਾਲੀ ਸਾੜਨ ਦਾ ਸਬੂਤ ਨਹੀਂ।", confidenceLow: "ਘੱਟ ਭਰੋਸਾ", confidenceHigh: "ਉੱਚ / ਆਮ", noMap: "ਇਸ ਤਾਰੀਖ ਲਈ ਆਰਕਾਈਵ ਵਿੱਚ ਕੋਈ ਰਿਕਾਰਡ ਨਹੀਂ।", mapLoading: "ਨਕਸ਼ਾ ਡੇਟਾ ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…", recentLimit: "ਤਾਜ਼ਾ ਦ੍ਰਿਸ਼ ਨਵੇਂ ਪੰਜ ਦਿਨਾਂ ਤੱਕ ਹੈ; ਪੁਰਾਣੀਆਂ ਤਾਰੀਖਾਂ ਲਈ ਉਪਲਬਧ ਆਰਕਾਈਵ ਵਰਤੋ।", mapError: "ਅੱਗ ਡੇਟਾ ਉਪਲਬਧ ਨਹੀਂ। FIRMS ਕੁੰਜੀ ਜਾਂਚ ਕੇ ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", lastPass: "ਨਵੀਂ ਸੈਟੇਲਾਈਟ ਪਾਸ", detection: "ਪਛਾਣਾਂ", allSources: "ਸੈਂਸਰ", frpIntensity: "FRP ਤੀਬਰਤਾ", brightness: "ਚਮਕ", utc: "UTC",
    trendTitle: "ਸਮੇਂ ਨਾਲ ਅਨੁਮਾਨ", trendSubtitle: "ਸੰਭਾਲੇ ਮਾਡਲ ਨਤੀਜੇ; ਹਰ ਬਿੰਦੂ ਇੱਕ ਅਨੁਮਾਨ ਰਨ ਹੈ, ਘੰਟਾਵਾਰ ਨਿਰੀਖਣ ਨਹੀਂ।", baselineSeries: "CPCB ਬੇਸਲਾਈਨ (ਮਾਡਲ ਇਨਪੁੱਟ)", q24: "24h q50", q48: "48h q50", q90_24: "24h q90", q90_48: "48h q90", historyCount: "ਸੰਭਾਲੇ ਰਨ", changeTitle: "ਨਵੇਂ ਅਨੁਮਾਨ ਸੋਧ", changeSub: "ਨਵੇਂ ਸੰਭਾਲੇ ਅਨੁਮਾਨ ਦੀ ਪਿਛਲੇ ਰਨ ਨਾਲ ਤੁਲਨਾ।", previous: "ਪਿਛਲਾ ਰਨ", current: "ਨਵਾਂ ਰਨ", delta24: "24h ਮੱਧਮਾਨ ਬਦਲਾਅ", delta48: "48h ਮੱਧਮਾਨ ਬਦਲਾਅ", noHistory: "ਅਨੁਮਾਨ ਰਨ ਸੰਭਾਲਣ ਤੋਂ ਬਾਅਦ ਇਤਿਹਾਸ ਦਿਖੇਗਾ।", comparison: "ਮਿਆਦ ਤੁਲਨਾ", uncertainty: "ਮਿਆਦ ਅਨੁਸਾਰ ਕੁਆਂਟਾਈਲ ਫਰਕ", interval: "q90 − q10 ਫਰਕ", history: "ਅਨੁਮਾਨ ਇਤਿਹਾਸ",
    seasonTitle: "ਪਰਾਲੀ ਮੌਸਮ ਮਾਨੀਟਰ", seasonSubtitle: "ਪ੍ਰੋਜੈਕਟ CSV ਤੋਂ ਇਤਿਹਾਸਕ NASA FIRMS ਪਛਾਣਾਂ, ਦਿਨ ਅਤੇ ਸਾਲ ਅਨੁਸਾਰ।", yearly: "ਅਕਤੂਬਰ–ਨਵੰਬਰ ਪਛਾਣਾਂ ਪ੍ਰਤੀ ਸਾਲ", daily: "ਚੁਣੇ ਸਾਲ ਦੀਆਂ ਰੋਜ਼ਾਨਾ FIRMS ਪਛਾਣਾਂ", chooseYear: "ਮੌਸਮ ਸਾਲ", seasonalAvg: "ਰਿਕਾਰਡ ਵਾਲੀਆਂ ਤਾਰੀਖਾਂ ਦੀ ਔਸਤ", dailyChartNote: "ਬਾਰ ਚੁਣੇ ਸਾਲ ਦੀ ਹਰ ਤਾਰੀਖ ਲਈ ਗਿਣੀਆਂ ਸੈਟੇਲਾਈਟ ਹੌਟਸਪੌਟ ਪਛਾਣਾਂ ਦਿਖਾਉਂਦੇ ਹਨ। ਲਾਈਨ ਹੋਰ archive ਸਾਲਾਂ ਵਿੱਚ ਉਸੇ ਕੈਲੰਡਰ ਤਾਰੀਖ ਦੀ ਪਛਾਣਾਂ ਦਾ median (ਮੱਧਿਕਾ) ਹੈ। ਸਰੋਤ ਵਿੱਚ ਨਾ ਮਿਲਣ ਵਾਲੀਆਂ ਤਾਰੀਖਾਂ ਤੁਲਨਾ ਤੋਂ ਛੱਡੀਆਂ ਜਾਂਦੀਆਂ ਹਨ, zero ਨਹੀਂ ਮੰਨੀਆਂ ਜਾਂਦੀਆਂ।", unusual: "ਅਸਧਾਰਨ ਸਰਗਰਮ ਦਿਨ", baselineYear: "ਹੋਰ ਸਾਲਾਂ ਵਿੱਚ ਉਸੇ ਤਾਰੀਖ ਦਾ median", coverage: "ਆਰਕਾਈਵ ਕਵਰੇਜ", years: "ਸਾਲ", coverageNote: "ਆਰਕਾਈਵ ਵਿੱਚ ਸਰੋਤ ਫਾਈਲਾਂ ਵਾਲੇ ਸਾਲਾਂ (2016–2025) ਦਾ 1 ਅਕਤੂਬਰ–30 ਨਵੰਬਰ ਹੈ। ਗੈਰ-ਮੌਜੂਦ ਦਿਨ ਅਣਜਾਣ ਹਨ, ਜ਼ੀਰੋ ਨਹੀਂ। ਸੈਂਸਰ/ਪ੍ਰੋਸੈਸਿੰਗ ਕਰਕੇ ਗਿਣਤੀ ਦੀ ਤੁਲਨਾ ਸਿੱਧੀ ਨਹੀਂ ਹੋ ਸਕਦੀ।", noYear: "ਇਸ ਸਾਲ ਦੇ ਇਤਿਹਾਸਕ ਰਿਕਾਰਡ ਨਹੀਂ।", peakDay: "ਸਭ ਤੋਂ ਸਰਗਰਮ ਦਿਨ", dailyCounts: "ਚੁਣੀ ਤਾਰੀਖ ਦੀਆਂ ਪਛਾਣਾਂ", annualTotal: "ਮੌਸਮ ਕੁੱਲ", fireAttribution: "ਮੌਸਮੀ ਸਰਗਰਮੀ ਇਕੱਲੀ ਪਰਾਲੀ ਸਾੜਨ ਦੀ ਪਛਾਣ ਨਹੀਂ ਕਰ ਸਕਦੀ। ਕਾਰਨ ਲਈ ਵੱਖਰੀ ਪੁਸ਼ਟੀ ਕਰੋ।",
    emailTitle: "ਲਾਭਦਾਇਕ ਈਮੇਲ ਚੇਤਾਵਨੀਆਂ", emailSub: "q90 ਹੱਦ ਘੱਟ ਤੋਂ ਵੱਧ ਹੋਣ 'ਤੇ SNS ਇੱਕ ਸੁਨੇਹਾ ਭੇਜਦਾ ਹੈ, ਫਿਰ ਅਗਲੀ ਚੇਤਾਵਨੀ ਤੋਂ ਪਹਿਲਾਂ ਹੱਦ ਤੋਂ ਘੱਟ ਅਨੁਮਾਨ ਦੀ ਉਡੀਕ ਕਰਦਾ ਹੈ।", enabled: "SNS ਕਨਫਿਗਰ ਹੈ", notEnabled: "SNS ਕਨਫਿਗਰ ਨਹੀਂ", threshold: "ਹੱਦ", trigger: "ਚਾਲੂ ਸ਼ਰਤ", triggerText: "24 ਜਾਂ 48 ਘੰਟਿਆਂ ਦਾ q90 ਨਿਰਧਾਰਤ PM2.5 ਹੱਦ 'ਤੇ ਪਹੁੰਚੇ।", cadence: "ਜਾਂਚ ਸਮਾਂ", cadenceText: "ਹਰ ਪੂਰੇ ਅਨੁਮਾਨ ਰਨ 'ਤੇ (ਮੂਲ ਰੂਪ ਵਿੱਚ ਘੰਟਾਵਾਰ ਜਾਂ ਹੱਥੀਂ ਤਾਜ਼ਾ)।", recipient: "ਪ੍ਰਾਪਤਕਰਤਾ", recipientText: "ਮੌਜੂਦਾ SNS ਵਿਸ਼ੇ ਦੇ ਪੁਸ਼ਟੀ ਕੀਤੇ ਈਮੇਲ ਮੈਂਬਰ।", pending: "ਸਬਸਕ੍ਰਿਪਸ਼ਨ ਪੁਸ਼ਟੀ ਲੋੜੀਂਦੀ", pendingText: "ਪ੍ਰਾਪਤਕਰਤਾ ਇਨਬਾਕਸ ਵਿੱਚ ਪੁਸ਼ਟੀ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਈਮੇਲ ਨਹੀਂ ਆਉਂਦੀ।", testCommand: "ਕਨੈਕਸ਼ਨ ਜਾਂਚ", testText: "AWS CLI publish ਕਮਾਂਡ ਵਿਸ਼ੇ ਦੀ ਪਹੁੰਚ ਜਾਂਚਦੀ ਹੈ। ਲਾਈਵ ਅਨੁਮਾਨ ਲਈ Lambda SNS ਇਜਾਜ਼ਤ ਅਤੇ CloudWatch ਲੌਗ ਵੇਖੋ।", ops: "ਸਮੱਸਿਆ ਜਾਂਚ", noSpam: "ਲਗਾਤਾਰ ਉੱਚ ਰਨ ਲਈ ਦੁਹਰਾਅ ਨਹੀਂ", belowReset: "ਹੱਦ ਤੋਂ ਘੱਟ ਅਨੁਮਾਨ ਚੱਕਰ ਮੁੜ ਸੈੱਟ ਕਰਦਾ ਹੈ", failureRetry: "ਭੇਜਣ ਦੀ ਨਾਕਾਮੀ ਲੌਗ ਹੁੰਦੀ ਹੈ ਅਤੇ ਬਾਅਦ ਦੀ ਕੋਸ਼ਿਸ਼ ਲਈ ਦਾਅਵਾ ਛੱਡਿਆ ਜਾਂਦਾ ਹੈ", destination: "ਵਿਸ਼ਾ", emailDisclaimer: "ਈਮੇਲ ਅਨੁਮਾਨ ਹੈ, ਅਧਿਕਾਰਤ ਰੀਡਿੰਗ ਨਹੀਂ। 150 µg/m³ ਐਪ ਦੀ ਮੂਲ ਹੱਦ ਹੈ, ਸਰਬਵਿਆਪੀ ਸਿਹਤ ਮਿਆਰ ਨਹੀਂ।",
    sources: "ਡੇਟਾ ਲੜੀ", sourceFirms: "NASA FIRMS VIIRS · ਸੈਟੇਲਾਈਟ ਅੱਗ ਪਛਾਣਾਂ", sourceCPCB: "CPCB via Open-Meteo · PM2.5 ਮਾਡਲ ਇਨਪੁੱਟ", sourceModel: "ਛੇ LightGBM ਕੁਆਂਟਾਈਲ ਮਾਡਲ · 24h / 48h", sourceHistory: "DynamoDB · ਸੰਭਾਲੇ ਅਨੁਮਾਨ ਰਨ", sourceArchive: "ਪ੍ਰੋਜੈਕਟ CSV · ਇਤਿਹਾਸਕ ਨਕਸ਼ਾ 0.1° ਗ੍ਰਿਡ", confidenceLabel: "ਭਰੋਸਾ", low: "ਘੱਟ", nominal: "ਆਮ", high: "ਉੱਚ", noValue: "—", retry: "ਮੁੜ ਕੋਸ਼ਿਸ਼", fireUnavailable: "ਲਾਈਵ FIRMS ਬੇਨਤੀ ਸਫਲ ਨਹੀਂ ਹੋਈ। ਕਵਰ ਕੀਤੀਆਂ ਤਾਰੀਖਾਂ ਲਈ ਆਰਕਾਈਵ ਵੇਖੋ।", askDate: "ਵੇਖਣ ਲਈ ਤਾਰੀਖ ਚੁਣੋ", summaryFailed: "ਸੰਖੇਪ ਨਹੀਂ ਬਣਿਆ", unknown: "ਅਣਜਾਣ",
  },
};

function n(data, keys) {
  for (const k of keys) if (data?.[k] !== null && data?.[k] !== undefined && Number.isFinite(Number(data[k]))) return Number(data[k]);
  return null;
}
function fmt(value, digits = 1) { return value === null || value === undefined || !Number.isFinite(Number(value)) ? "—" : Number(value).toFixed(digits); }
function stamp(value, lang) { if (!value) return "—"; const d = new Date(value); return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString(lang, { dateStyle: "short", timeStyle: "short" }); }
function isoToday() { return new Date().toISOString().slice(0, 10); }
function isoAgo(days) { const d = new Date(); d.setUTCDate(d.getUTCDate() - days); return d.toISOString().slice(0, 10); }
function heatColor(value) { return value >= 80 ? "#ef4444" : value >= 30 ? "#f97316" : value >= 8 ? "#eab308" : "#84cc16"; }
async function getJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, { cache: "no-store", ...options });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}

function Panel({ title, kicker, subtitle, action, children, className = "" }) {
  return <section className={`panel ${className}`}><div className="panel-head"><div>{kicker && <span className="section-kicker">{kicker}</span>}<h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>;
}
function Stat({ label, value, suffix, note, icon, tone = "" }) {
  return <article className={`stat ${tone}`}><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><strong>{value}{suffix && <small>{suffix}</small>}</strong>{note && <p>{note}</p>}</article>;
}
function SimpleTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><b>{label}</b>{payload.filter(x => x.value !== null && x.value !== undefined).map(x => <div key={x.dataKey}><i style={{ background: x.color }} />{x.name}: <b>{fmt(x.value)}</b></div>)}</div>;
}
function Empty({ text }) { return <div className="empty"><Database size={22} /><span>{text}</span></div>; }
export default function App() {
  const [lang, setLang] = useLanguage();
  const [theme, toggleTheme] = useTheme();
  const t = translations[lang] || translations.en;
  const x = UI[lang] || UI.en;
  const [tab, setTab] = useState(0);
  const [forecast, setForecast] = useState(null);
  const [history, setHistory] = useState([]);
  const [archive, setArchive] = useState(null);
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [archiveError, setArchiveError] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastChecked, setLastChecked] = useState(null);
  const [selectedDate, setSelectedDate] = useState(isoToday());
  const [fireData, setFireData] = useState(null);
  const [fireBusy, setFireBusy] = useState(false);
  const [fireError, setFireError] = useState("");
  const [year, setYear] = useState(new Date().getUTCFullYear() - 1);
  const [summary, setSummary] = useState(null);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const fireRequestId = useRef(0);

  const loadDashboard = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [latest, recent] = await Promise.all([
        getJson("/latest"), getJson("/history?limit=100").catch(() => []),
      ]);
      setForecast(latest);
      setHistory(Array.isArray(recent) ? recent : []);
      setLastChecked(new Date());
      setError("");
    } catch (e) { setError(e.message || x.noForecast); }
    finally { if (!quiet) setLoading(false); }
  }, [x.noForecast]);

  const reloadArchive = useCallback(async () => {
    setArchiveLoading(true);
    setArchiveError("");
    try {
      const data = await loadArchive();
      const years = data?.metadata?.years || [];
      if (!years.length || !data?.daily) throw new Error("Archive JSON has no daily fire records.");
      setArchive(data);
      setYear(current => years.includes(current) ? current : Math.max(...years));
    } catch (e) {
      setArchive(null);
      setArchiveError(e.message || "Could not load historical fire archive.");
    } finally {
      setArchiveLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => loadDashboard(), 0);
    const interval = window.setInterval(() => loadDashboard(true), 300000);
    const archiveTimer = window.setTimeout(() => reloadArchive(), 0);
    return () => { window.clearTimeout(timer); window.clearInterval(interval); window.clearTimeout(archiveTimer); };
  }, [loadDashboard, reloadArchive]);

  const loadFireData = useCallback(async (date) => {
    const requestId = ++fireRequestId.current;
    setFireBusy(true);
    setFireError("");
    setFireData(null);
    setSummary(null);
    const archiveValue = archive?.grid_by_date?.[date];
    try {
      const result = await getJson(`/fires?date=${encodeURIComponent(date)}&days=1`, { signal: AbortSignal.timeout(40000) });
      if (requestId === fireRequestId.current) {
        setFireData({ ...result, records: result.records || [] });
      }
    } catch (e) {
      if (requestId === fireRequestId.current) {
        if (archiveValue) setFireData(archivePayload(archive, date, x));
        else setFireError(e.message || x.fireUnavailable);
      }
    }
    if (requestId === fireRequestId.current) setFireBusy(false);
  }, [archive, x]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadFireData(selectedDate), 0);
    const recent = selectedDate >= isoAgo(4) && selectedDate <= isoToday();
    const interval = recent ? window.setInterval(() => loadFireData(selectedDate), 900000) : null;
    return () => { window.clearTimeout(timer); if (interval) window.clearInterval(interval); };
  }, [archive, loadFireData, selectedDate]);

  const refreshForecast = async () => {
    if (refreshing) return;
    setRefreshing(true); setError("");
    const previous = forecast?.generated_at;
    try {
      const result = await getJson("/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(125000) });
      if (result.status === "queued") {
        const until = Date.now() + 125000;
        while (Date.now() < until) {
          await new Promise(resolve => window.setTimeout(resolve, 2500));
          const latest = await getJson("/latest");
          if (latest.generated_at && latest.generated_at !== previous) {
            setForecast(latest); setHistory(await getJson("/history?limit=100").catch(() => [])); setLastChecked(new Date()); return;
          }
        }
        throw new Error("Forecast still processing. Try again shortly.");
      }
      await loadDashboard();
    } catch (e) { setError(e.message || "Forecast refresh failed"); }
    finally { setRefreshing(false); }
  };

  const p24 = { q10: n(forecast, ["24h_q10"]), q50: n(forecast, ["24h_q50"]), q90: n(forecast, ["24h_q90"]) };
  const p48 = { q10: n(forecast, ["48h_q10"]), q50: n(forecast, ["48h_q50"]), q90: n(forecast, ["48h_q90"]) };
  const baseline = n(forecast, ["pm25_now"]);
  const alert = forecast?.alert || {};
  const threshold = Number(alert.threshold_pm25 || 150);
  const predictedHigh = alert.predicted_high ?? [p24.q90, p48.q90].some(v => v !== null && v >= threshold);

  const sortedHistory = useMemo(() => [...history].sort((a, b) => new Date(a.generated_at || 0) - new Date(b.generated_at || 0)), [history]);
  const historyChart = useMemo(() => sortedHistory.map((item, i) => ({
    run: `${i + 1} · ${stamp(item.generated_at, lang)}`,
    camBaseline: n(item, ["pm25_now"]), q24: n(item, ["24h_q50"]), q48: n(item, ["48h_q50"]),
    q90_24: n(item, ["24h_q90"]), q90_48: n(item, ["48h_q90"]),
  })), [sortedHistory, lang]);
  const latestPrev = sortedHistory.length > 1 ? sortedHistory.at(-2) : null;
  const latestNow = sortedHistory.at(-1) || forecast;
  const difference = (a, b, key) => {
    const current = n(a, [key]); const previous = n(b, [key]);
    return current === null || previous === null ? null : current - previous;
  };
  const del24 = latestPrev && latestNow ? difference(latestNow, latestPrev, "24h_q50") : null;
  const del48 = latestPrev && latestNow ? difference(latestNow, latestPrev, "48h_q50") : null;

  const seasonal = useMemo(() => makeSeasonData(archive, year), [archive, year]);
  const annual = seasonal.annual;
  const selectedDay = archive?.daily?.[selectedDate];
  const fireMetrics = fireData ? {
    count: fireData.detections_total ?? selectedDay?.count ?? 0,
    high: fireData.high_confidence_count ?? selectedDay?.high_confidence_count ?? 0,
    frp: fireData.frp_sum_mw ?? selectedDay?.frp_sum_mw ?? 0,
    historical: Boolean(fireData.historical),
  } : null;
  const fireList = fireData?.records || [];

  const requestSummary = async () => {
    setSummaryBusy(true); setSummaryError("");
    try {
      const result = await getJson("/summary", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lang,
          fire: fireMetrics ? { date: selectedDate, detections: fireMetrics.count, high_confidence: fireMetrics.high, frp_sum_mw: fireMetrics.frp, historical: fireMetrics.historical } : {},
          season: { year, detections: selectedYearTotal ?? null, peak_date: seasonal.peak?.date ?? null, peak_count: seasonal.peak?.count ?? null },
        }),
        signal: AbortSignal.timeout(35000),
      });
      setSummary(result);
    } catch (e) { setSummaryError(e.message || x.summaryFailed); }
    finally { setSummaryBusy(false); }
  };

  const fireForSummary = fireMetrics?.count ?? null;
  const selectedYearTotal = annual.find(a => a.year === Number(year))?.count;
  const themeColor = theme === "dark" ? "#61c7a2" : "#17866b";
  const minDate = FIRMS_EARLIEST_DATE;
  const selectedFireSource = fireData?.source_label || (fireData?.historical ? x.archiveSource : x.liveSource);
  const mapDateHint = MAP_DATE_HINT[lang] || MAP_DATE_HINT.en;

  return <div className="app-shell">
    <header className="app-header">
      <a className="brand" href="#home" onClick={() => setTab(0)}><span className="brand-mark"><Wind size={21} /></span><span><b>Stubble<span>Smoke</span></b><small>FORECAST · FIRE · HISTORY</small></span></a>
      <div className="header-tools">
        <span className="live-pill"><i /> {x.live}</span>
        <label className="language-select" title={t.language}><Languages size={15} /><select aria-label={t.language} value={lang} onChange={e => setLang(e.target.value)}>{LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}</select></label>
        <button className="square-btn" onClick={toggleTheme} title={t.theme} aria-label={t.theme}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>
        <button className="refresh-btn" onClick={refreshForecast} disabled={refreshing || loading}><RefreshCw size={15} className={refreshing ? "spin" : ""} />{refreshing ? x.loading : x.update}</button>
      </div>
    </header>

    <div className="workspace">
      <aside className="sidebar">
        <div className="side-top"><span className="side-kicker">AIR INTELLIGENCE</span><b>DELHI REGION</b><small><MapPin size={13} /> Punjab · Haryana · Delhi</small></div>
        <nav className="side-nav" aria-label="Dashboard sections">
          {x.tabs.map((name, i) => <button key={name} className={tab === i ? "active" : ""} onClick={() => setTab(i)}><span className="nav-icon">{[<Activity size={17} />, <Flame size={17} />, <Layers3 size={17} />, <CalendarDays size={17} />, <BellRing size={17} />][i]}</span><span>{name}</span>{tab === i && <ChevronRight size={15} className="nav-arrow" />}</button>)}
        </nav>
        <div className="side-status"><div><i className="status-dot" /><span>{t.latest}</span></div><b>{stamp(forecast?.generated_at, lang)}</b><small>{lastChecked ? `${x.updated} ${lastChecked.toLocaleTimeString(lang)}` : x.noValue}</small></div>
        <div className="side-source"><Satellite size={17} /><b>{x.sources}</b><span>FIRMS · CPCB · LightGBM</span></div>
      </aside>

      <main className="main-area" id="home">
        <div className="page-heading"><div><div className="breadcrumbs"><span>{x.overview}</span><b>/</b><strong>{x.tabs[tab]}</strong></div><span className="section-kicker">{x.eyebrow}</span><h1>{tab === 0 ? x.title : x.tabs[tab]}</h1><p>{tab === 0 ? x.subtitle : pageSubtitle(tab, x)}</p></div><div className="heading-date"><CalendarDays size={15} /><span>{new Date().toLocaleDateString(lang, { dateStyle: "medium" })}</span></div></div>
        {error && <div className="error-banner"><AlertTriangle size={18} /><span>{error}</span><button onClick={() => loadDashboard()}>{x.retry}</button></div>}

        {tab === 0 && <>
          <div className="stat-grid">
            <Stat label={x.camBaseline} value={fmt(baseline)} suffix="µg/m³" note={x.notObservation} icon={<Activity size={16} />} tone="stat-dark" />
            <Stat label={x.forecast24} value={fmt(p24.q50)} suffix="µg/m³" note={`${x.range}: ${fmt(p24.q10)} – ${fmt(p24.q90)}`} icon={<Clock3 size={16} />} />
            <Stat label={x.forecast48} value={fmt(p48.q50)} suffix="µg/m³" note={`${x.range}: ${fmt(p48.q10)} – ${fmt(p48.q90)}`} icon={<Wind size={16} />} />
            <Stat label={x.fireCount} value={fireForSummary === null ? "—" : fireForSummary.toLocaleString(lang)} suffix={fireForSummary === null ? "" : x.detection} note={fireMetrics ? `${fmt(fireMetrics.frp)} ${x.mw} · ${selectedDate}` : x.askDate} icon={<Flame size={16} />} />
          </div>
          <div className="notice"><Info size={15} /><span>{x.notObservation}</span><button onClick={() => setTab(1)}>{x.viewMap}<ChevronRight size={14} /></button></div>
          <div className="two-col overview-grid">
            <Panel kicker={x.history} title={x.trendTitle} subtitle={x.trendSubtitle} action={<button className="text-action" onClick={() => setTab(2)}>{x.explore}<ChevronRight size={14} /></button>}>
              {historyChart.length ? <div className="chart-box tall"><ResponsiveContainer><ComposedChart data={historyChart} margin={{ top: 8, right: 12, left: -12, bottom: 5 }}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="run" tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={18} /><YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip content={<SimpleTooltip />} /><Legend /><Line type="monotone" dataKey="camBaseline" name={x.baselineSeries} stroke="#8290a0" strokeWidth={2} dot={false} connectNulls={false} /><Line type="monotone" dataKey="q24" name={x.q24} stroke={themeColor} strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} /><Line type="monotone" dataKey="q48" name={x.q48} stroke="#e69345" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} /></ComposedChart></ResponsiveContainer></div> : <Empty text={x.noHistory} />}
            </Panel>
            <SummaryCard title={x.summary} kicker="BEDROCK · GROUNDED" text={summary?.summary} source={summary?.source} hint={x.summaryHint} caveat={x.summaryCaveat} busy={summaryBusy} error={summaryError} onGenerate={requestSummary} t={x} />
          </div>
          <div className="two-col secondary-grid">
            <Panel kicker={x.comparison} title={x.horizonCompare || "24h vs 48h model outlook"} subtitle={x.uncertainty}>
              <div className="chart-box compact"><ResponsiveContainer><BarChart data={[{ label: "24 hours", q10: p24.q10, q50: p24.q50, q90: p24.q90 }, { label: "48 hours", q10: p48.q10, q50: p48.q50, q90: p48.q90 }]} margin={{ top: 8, right: 10, left: -12, bottom: 0 }}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip content={<SimpleTooltip />} /><Legend /><Bar dataKey="q10" name="q10" fill="#8ecab5" radius={[4, 4, 0, 0]} /><Bar dataKey="q50" name="q50" fill={themeColor} radius={[4, 4, 0, 0]} /><Bar dataKey="q90" name="q90" fill="#eaa04c" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
            </Panel>
            <SourcesCard t={x} />
          </div>
          <div className="footnote"><Info size={14} />{t.disclaimer}</div>
        </>}

        {tab === 1 && <>
          <div className="map-controls panel"><div className="date-input"><CalendarDays size={16} /><label>{x.date}<input type="date" value={selectedDate} min={minDate} max={isoToday()} onChange={e => setSelectedDate(e.target.value)} /></label></div><div className="map-source-pill"><span className={fireData?.historical ? "archive-dot" : "live-dot"} />{selectedFireSource}</div><span className="map-date-note">{mapDateHint}</span><button className="outline-button map-refresh" onClick={() => loadFireData(selectedDate)} disabled={fireBusy}><RefreshCw size={13} className={fireBusy ? "spin" : ""} /> {x.mapRefresh}</button></div>
          <div className="map-metrics"><Stat label={x.total} value={fireData ? Number(fireData.detections_total || 0).toLocaleString(lang) : "—"} note={x.selected + ` · ${selectedDate}`} icon={<Flame size={16} />} /><Stat label={x.confidenceHigh} value={fireData ? Number(fireData.high_confidence_count || 0).toLocaleString(lang) : "—"} note={fireData?.historical ? x.archiveSource : x.liveSource} icon={<CheckCircle2 size={16} />} /><Stat label={x.frp} value={fireData ? fmt(fireData.frp_sum_mw) : "—"} suffix={x.mw} note={x.frpIntensity} icon={<Activity size={16} />} /><Stat label={x.lastPass} value={fireData?.latest_observation_utc ? stamp(fireData.latest_observation_utc, lang) : "—"} note={fireData?.source?.join(", ") || ""} icon={<Satellite size={16} />} />
          </div>
          <div className="map-layout">
            <Panel kicker={selectedFireSource} title={x.mapTitle} subtitle={mapDateHint} className="map-panel">
              {fireBusy ? <div className="map-placeholder"><RefreshCw className="spin" />{x.mapLoading}</div> : fireError ? <div className="map-placeholder map-error"><AlertTriangle />{fireError}<button className="outline-button" onClick={() => loadFireData(selectedDate)}>{x.retry}</button></div> : fireList.length ? <Suspense fallback={<div className="map-placeholder"><RefreshCw className="spin" />{x.mapLoading}</div>}><FireMap detections={fireList} lang={lang} t={x} /></Suspense> : <div className="map-placeholder"><Flame />{NO_FIRES_TEXT[lang] || NO_FIRES_TEXT.en}</div>}
              <div className="map-legend"><b>{x.frpIntensity}</b><span><i style={{ background: "#84cc16" }} /> &lt;8 MW</span><span><i style={{ background: "#eab308" }} /> 8–30</span><span><i style={{ background: "#f97316" }} /> 30–80</span><span><i style={{ background: "#ef4444" }} /> &gt;80</span></div>
            </Panel>
            <div className="map-side">
              <Panel kicker={x.selected} title={selectedDate} subtitle={fireData?.source?.join(" · ") || x.source}>
                <div className="side-stat-row"><span>{x.total}</span><b>{fireData ? Number(fireData.detections_total || 0).toLocaleString(lang) : "—"}</b></div><div className="side-stat-row"><span>{x.confidenceHigh}</span><b>{fireData ? Number(fireData.high_confidence_count || 0).toLocaleString(lang) : "—"}</b></div><div className="side-stat-row"><span>{x.frp}</span><b>{fmt(fireData?.frp_sum_mw)} {x.mw}</b></div>
                {fireData?.truncated && <p className="small-note">Map draws the highest-FRP {fireData.mapped_detections} of {fireData.detections_total} detections. Counts and FRP total include all returned detections.</p>}
                {fireData?.source_label === "Aggregated historical satellite detections" && <p className="small-note">{archive?.metadata?.map_note}</p>}
              </Panel>
              <div className="caution-card"><AlertTriangle size={17} /><b>{x.causeNote}</b><p>{x.mapNote}</p></div>
              {fireData && <SummaryCard title={x.summary} kicker="SELECTED FIRE DATA" text={summary?.summary} source={summary?.source} hint={x.summaryHint} caveat={x.summaryCaveat} busy={summaryBusy} error={summaryError} onGenerate={requestSummary} t={x} compact />}
            </div>
          </div>
        </>}

        {tab === 2 && <>
          <div className="stat-grid trend-stats"><Stat label={x.historyCount} value={history.length} note={x.latest + ` · ${stamp(forecast?.generated_at, lang)}`} icon={<Database size={16} />} /><ChangeStat label={x.delta24} value={del24} suffix="µg/m³" /><ChangeStat label={x.delta48} value={del48} suffix="µg/m³" /><Stat label={x.threshold} value={fmt(threshold)} suffix="µg/m³" note={predictedHigh ? x.alertHigh : x.alertReady} icon={<BellRing size={16} />} /></div>
          <Panel kicker={x.history} title={x.trendTitle} subtitle={x.trendSubtitle}>
            {historyChart.length ? <div className="chart-box big"><ResponsiveContainer><ComposedChart data={historyChart} margin={{ top: 12, right: 16, left: -10, bottom: 16 }}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="run" tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={16} /><YAxis domain={["auto", "auto"]} label={{ value: "PM2.5 µg/m³", angle: -90, position: "insideLeft", style: { fill: "var(--muted)", fontSize: 11 } }} tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip content={<SimpleTooltip />} /><Legend /><ReferenceLine y={threshold} stroke="#e35d50" strokeDasharray="5 5" label={{ value: `${x.threshold} ${fmt(threshold)}`, fill: "#e35d50", fontSize: 11 }} /><Line type="monotone" dataKey="camBaseline" name={x.baselineSeries} stroke="#8894a5" strokeWidth={2} dot={false} connectNulls={false} /><Line type="monotone" dataKey="q24" name={x.q24} stroke={themeColor} strokeWidth={2.7} dot={{ r: 3 }} connectNulls={false} /><Line type="monotone" dataKey="q48" name={x.q48} stroke="#e79b48" strokeWidth={2.7} dot={{ r: 3 }} connectNulls={false} /><Line type="monotone" dataKey="q90_24" name={x.q90_24} stroke="#48a58b" strokeDasharray="4 5" dot={false} connectNulls={false} /><Line type="monotone" dataKey="q90_48" name={x.q90_48} stroke="#c78237" strokeDasharray="4 5" dot={false} connectNulls={false} /></ComposedChart></ResponsiveContainer></div> : <Empty text={x.noHistory} />}
          </Panel>
          <div className="two-col trend-lower">
            <Panel kicker={x.changeTitle} title={x.changeTitle} subtitle={x.changeSub}>
              <div className="revision-grid"><Revision label={x.previous} item={latestPrev} lang={lang} /><Revision label={x.current} item={latestNow} lang={lang} /></div>
              <div className="delta-grid"><Delta label={x.delta24} value={del24} /><Delta label={x.delta48} value={del48} /></div>
            </Panel>
            <Panel kicker={x.comparison} title={x.uncertainty} subtitle={x.interval}>
              <div className="chart-box compact"><ResponsiveContainer><BarChart data={[{ label: "24h", spread: p24.q10 !== null && p24.q90 !== null ? p24.q90 - p24.q10 : null }, { label: "48h", spread: p48.q10 !== null && p48.q90 !== null ? p48.q90 - p48.q10 : null }]}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip content={<SimpleTooltip />} /><Bar dataKey="spread" name={x.interval} fill={themeColor} radius={[7, 7, 0, 0]} /></BarChart></ResponsiveContainer></div>
            </Panel>
          </div>
          <p className="footnote"><Info size={14} />{x.notObservation} {x.trendSubtitle}</p>
        </>}

        {tab === 3 && <>
          <div className="season-toolbar panel"><div><span className="section-kicker">{x.coverage}</span><h2>{archive?.metadata?.years?.length || "—"} {x.years}</h2><p>{archive?.metadata?.date_coverage || x.coverageNote}</p></div><label>{x.chooseYear}<select value={year} onChange={e => setYear(Number(e.target.value))}>{(archive?.metadata?.years || []).map(y => <option key={y} value={y}>{y}</option>)}</select></label></div>
          <div className="season-kpis"><Stat label={x.annualTotal} value={selectedYearTotal == null ? "—" : selectedYearTotal.toLocaleString(lang)} note={`${year} · Oct–Nov`} icon={<Flame size={16} />} /><Stat label={x.peakDay} value={seasonal.peak ? seasonal.peak.date : "—"} note={seasonal.peak ? `${seasonal.peak.count.toLocaleString(lang)} ${x.detection}` : x.noYear} icon={<Activity size={16} />} /><Stat label={x.seasonalAvg} value={fmt(seasonal.mean, 0)} note={`${year} · available days only`} icon={<CalendarDays size={16} />} /><Stat label={x.unusual} value={seasonal.unusual.length} note="≥ 1.5× same-date historical median" icon={<AlertTriangle size={16} />} /></div>
          {archiveLoading && <div className="empty"><Database size={22} /><span>{x.loading} · historical FIRMS archive</span></div>}
          {archiveError && <div className="caution-card season-caution"><AlertTriangle size={18} /><b>Historical archive failed to load</b><p>{archiveError}</p><button className="outline-button" onClick={reloadArchive}>{x.retry}</button></div>}
          <div className="two-col season-charts">
            <Panel kicker="2016–2025" title={x.yearly} subtitle={x.coverageNote}><div className="chart-box tall"><ResponsiveContainer><BarChart data={annual} margin={{ top: 8, right: 12, left: -12, bottom: 5 }}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="year" tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip content={<SimpleTooltip />} /><Bar dataKey="count" name={x.total} fill={themeColor} radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></Panel>
            <Panel kicker={String(year)} title={x.daily} subtitle={x.dailyChartNote}><div className="chart-box tall"><ResponsiveContainer><ComposedChart data={seasonal.daily} margin={{ top: 8, right: 12, left: -12, bottom: 5 }}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="day" tick={{ fill: "var(--muted)", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={16} /><YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip content={<SimpleTooltip />} /><Legend /><Bar dataKey="count" name={x.dailyCounts} fill={themeColor} radius={[3, 3, 0, 0]} /><Line dataKey="baseline" name={x.baselineYear} stroke="#e49b45" strokeWidth={2} dot={false} connectNulls={false} /></ComposedChart></ResponsiveContainer></div></Panel>
          </div>
          <Panel kicker={x.unusual} title={`${x.unusual} · ${year}`} subtitle="Relative to same calendar dates available in the other included seasons; this is a screening signal, not a cause classification.">
            {seasonal.unusual.length ? <div className="unusual-list">{seasonal.unusual.slice(0, 10).map(row => <div key={row.date}><span className="heat-dot" style={{ background: heatColor(row.count / Math.max(1, row.baseline) * 10) }} /><b>{row.date}</b><span>{row.count.toLocaleString(lang)} {x.detection}</span><small>{fmt(row.ratio, 1)}× {x.baselineYear.toLowerCase()}</small></div>)}</div> : <Empty text={x.noYear} />}
          </Panel>
          <div className="caution-card season-caution"><AlertTriangle size={18} /><b>{x.fireAttribution}</b><p>{x.coverageNote}</p></div>
        </>}

        {tab === 4 && <>
          <div className="alert-hero"><div className="alert-hero-icon"><BellRing size={22} /></div><div><span className="section-kicker">{x.alerts}</span><h2>{x.emailTitle}</h2><p>{x.emailSub}</p></div><span className={`alert-chip ${alert.enabled ? "on" : "off"}`}><i />{alert.enabled ? x.enabled : x.notEnabled}</span></div>
          <div className="alert-cards">
            <article className="alert-rule-card"><div className="rule-icon"><Activity size={17} /></div><h3>{x.trigger}</h3><p>{x.triggerText}</p><div className="threshold-display"><span>{x.threshold}</span><b>{fmt(threshold)} <small>µg/m³</small></b></div></article>
            <article className="alert-rule-card"><div className="rule-icon"><Clock3 size={17} /></div><h3>{x.cadence}</h3><p>{x.cadenceText}</p><div className="threshold-display"><span>{x.current}</span><b>{predictedHigh ? t.alertHigh : t.alertReady}</b></div></article>
            <article className="alert-rule-card"><div className="rule-icon"><BellRing size={17} /></div><h3>{x.recipient}</h3><p>{x.recipientText}</p><div className="threshold-display"><span>{x.pending}</span><b>{x.pendingText}</b></div></article>
          </div>
          <div className="two-col alert-lower">
            <Panel kicker="SNS · EMAIL" title={x.ops}>
              <div className="check-list"><div><CheckCircle2 size={17} /><span>{x.noSpam}</span></div><div><CheckCircle2 size={17} /><span>{x.belowReset}</span></div><div><CheckCircle2 size={17} /><span>{x.failureRetry}</span></div></div>
              <div className="topic-box"><span>{x.destination}</span><code>{alert.topic_arn || "SNS_TOPIC_ARN · ap-southeast-2"}</code></div>
              <p className="small-note">{x.emailDisclaimer}</p>
            </Panel>
            <Panel kicker={x.testCommand} title={x.testCommand} subtitle={x.testText}>
              <pre className="code-block">{`aws sns list-subscriptions-by-topic \\\n  --topic-arn "arn:aws:sns:ap-southeast-2:704660346960:stubble" \\\n  --region ap-southeast-2`}</pre>
              <p className="small-note">Check that each email subscription has a confirmed ARN. CloudWatch logs show the SNS ` + "`MessageId`" + ` after forecast-triggered sends. Avoid manually publishing a “test” to a production topic if subscribers should not receive test mail.</p>
            </Panel>
          </div>
        </>}

        <footer className="page-footer"><div><span className="footer-mark"><Wind size={14} /></span> STUBBLESMOKE <i /> {x.sources}</div><span>{x.summaryCaveat}</span><span>{lastChecked ? `${x.updated} ${lastChecked.toLocaleTimeString(lang)}` : x.noValue}</span></footer>
      </main>
    </div>
  </div>;
}

function archivePayload(archive, date, x) {
  const cells = archive?.grid_by_date?.[date] || [];
  const day = archive?.daily?.[date] || {};
  return {
    date, historical: true, source: ["Project FIRMS archive"], source_label: "Aggregated historical satellite detections",
    detections_total: day.count || 0, high_confidence_count: day.high_confidence_count || 0, frp_sum_mw: day.frp_sum_mw || 0,
    records: cells.map(c => ({ lat: c.lat, lon: c.lon, count: c.count, frp_sum_mw: c.frp_sum_mw, max_frp_mw: c.max_frp_mw, high_confidence_count: c.high_confidence_count })),
    attribution_note: x.causeNote,
  };
}
async function loadArchive() {
  let compressedError;
  try {
    const response = await fetch("/data/fire-archive.json.gz", { cache: "no-store" });
    if (!response.ok) throw new Error(`compressed archive returned HTTP ${response.status}`);
    const bytes = await response.arrayBuffer();
    // Some dev/proxy servers transparently decompress .gz; try JSON before gzip.
    try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { /* raw gzip; decompress below */ }
    if (typeof DecompressionStream !== "undefined") {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
      return await new Response(stream).json();
    }
  } catch (e) {
    compressedError = e;
  }
  try {
    const fallback = await fetch("/data/fire-archive.json", { cache: "no-store" });
    if (!fallback.ok) throw new Error(`plain archive returned HTTP ${fallback.status}`);
    return await fallback.json();
  } catch (e) {
    throw new Error(`Historical archive could not be loaded (${e.message || compressedError?.message || "unknown error"}).`, { cause: e });
  }
}
function makeSeasonData(archive, year) {
  const dailyMap = archive?.daily || {};
  const dates = Object.keys(dailyMap).filter(d => Number(d.slice(0, 4)) === Number(year)).sort();
  const years = archive?.metadata?.years || [];
  const annual = years.map(y => ({ year: y, count: Object.entries(dailyMap).filter(([d]) => Number(d.slice(0, 4)) === y).reduce((sum, [, v]) => sum + (v.count || 0), 0) }));
  const selectedDates = dates.map(date => ({ date, day: date.slice(5), count: dailyMap[date].count || 0, high: dailyMap[date].high_confidence_count || 0 }));
  const daily = selectedDates.map(row => {
    const peers = years.filter(y => y !== Number(year)).map(y => dailyMap[`${y}-${row.day}`]?.count).filter(Number.isFinite).sort((a, b) => a - b);
    const middle = Math.floor(peers.length / 2);
    const baseline = !peers.length ? null : peers.length % 2 ? peers[middle] : (peers[middle - 1] + peers[middle]) / 2;
    return { ...row, baseline };
  });
  const peak = [...selectedDates].sort((a, b) => b.count - a.count)[0] || null;
  const mean = selectedDates.length ? selectedDates.reduce((s, d) => s + d.count, 0) / selectedDates.length : null;
  const unusual = daily.filter(d => d.baseline > 0 && d.count >= 1.5 * d.baseline && d.count > 0).map(d => ({ ...d, ratio: d.count / d.baseline })).sort((a, b) => b.ratio - a.ratio);
  return { annual, daily, peak, mean, unusual };
}
function SummaryCard({ title, kicker, text, source, hint, caveat, busy, error, onGenerate, t, compact = false }) {
  return <section className={`panel summary-card ${compact ? "summary-compact" : ""}`}><div className="summary-head"><div className="ai-mark"><BrainCircuit size={17} /></div><div><span className="section-kicker">{kicker}</span><h2>{title}</h2></div><button className="generate-btn" onClick={onGenerate} disabled={busy}>{busy ? <RefreshCw size={14} className="spin" /> : <BrainCircuit size={14} />}{busy ? t.summarizing : t.summarize}</button></div>{text ? <><p className="summary-text">{text}</p><span className="summary-source">{t.summarySource}: {source}</span></> : <p className="summary-hint">{error || hint}</p>}<small className="summary-caveat">{caveat}</small></section>;
}
function SourcesCard({ t }) {
  return <Panel kicker={t.sources} title="Know what each number means"><div className="source-list"><div><Satellite size={16} /><span>{t.sourceFirms}</span></div><div><Activity size={16} /><span>{t.sourceCPCB}</span></div><div><Layers3 size={16} /><span>{t.sourceModel}</span></div><div><Database size={16} /><span>{t.sourceHistory}</span></div><div><MapPin size={16} /><span>{t.sourceArchive}</span></div></div></Panel>;
}
function ChangeStat({ label, value, suffix = "" }) {
  const positive = value !== null && value > 0;
  return <article className="stat"><div className="stat-top"><span>{label}</span><span className="stat-icon">{value === null ? <Activity size={16} /> : positive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}</span></div><strong>{value === null ? "—" : `${positive ? "+" : ""}${fmt(value)}`}<small>{suffix}</small></strong><p>Latest minus previous saved run</p></article>;
}
function Revision({ label, item, lang }) {
  return <div className="revision"><span>{label}</span><b>{stamp(item?.generated_at, lang)}</b><small>24h q50 {fmt(n(item, ["24h_q50"]))} · 48h q50 {fmt(n(item, ["48h_q50"]))}</small></div>;
}
function Delta({ label, value }) { return <div className="delta"><span>{label}</span><b className={value > 0 ? "up" : value < 0 ? "down" : ""}>{value == null ? "—" : `${value > 0 ? "+" : ""}${fmt(value)} µg/m³`}</b></div>; }
function pageSubtitle(index, x) { return ["", x.mapSubtitle, x.trendSubtitle, x.seasonSubtitle, x.emailSub][index] || ""; }
