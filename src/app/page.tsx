"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type RiskLevel = "低い" | "やや高い" | "高い" | "非常に高い";

type LocationOption = {
  id: string;
  name: string;
  lat: number;
  lon: number;
};

type WeatherSnapshot = {
  temperature: number;
  humidity: number;
  wind: number;
  precipitation: number;
  pm10: number;
  pm25: number;
};

type RiskResult = {
  score: number;
  level: RiskLevel;
  advice: string;
};

type ForecastDay = {
  date: string;
  score: number;
  level: RiskLevel;
};

type SymptomLog = {
  date: string;
  severity: number;
  tookMedicine: boolean;
  memo: string;
};

type DailyActionKey =
  | "mask"
  | "glasses"
  | "laundryInside"
  | "shower"
  | "roomClean";

type PollenTypeId = "cedar" | "cypress" | "grass" | "ragweed" | "birch";

type PollenType = {
  id: PollenTypeId;
  name: string;
  seasonMonths: number[];
  peakMonths: number[];
  description: string;
  care: string;
};

type PollenTypeStatus = PollenType & {
  score: number;
  level: RiskLevel;
};

type MapCity = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  region: string;
  pollenSuitability: number;
};

type CityRiskPoint = MapCity & {
  score: number;
  level: RiskLevel;
  temperature: number;
  humidity: number;
  wind: number;
  precipitation: number;
};

type GeoPoint = {
  lat: number;
  lon: number;
};

const STORAGE_LOG_KEY = "kafun-symptom-log-v1";
const STORAGE_ACTION_KEY = "kafun-action-check-v1";

const defaultLocations: LocationOption[] = [
  { id: "tokyo", name: "東京", lat: 35.6764, lon: 139.65 },
  { id: "osaka", name: "大阪", lat: 34.6937, lon: 135.5023 },
  { id: "nagoya", name: "名古屋", lat: 35.1815, lon: 136.9066 },
  { id: "sapporo", name: "札幌", lat: 43.0618, lon: 141.3545 },
  { id: "fukuoka", name: "福岡", lat: 33.5902, lon: 130.4017 },
];

const mapCities: MapCity[] = [
  {
    id: "sapporo",
    name: "札幌",
    lat: 43.0618,
    lon: 141.3545,
    region: "北海道",
    pollenSuitability: 0.64,
  },
  {
    id: "sendai",
    name: "仙台",
    lat: 38.2682,
    lon: 140.8694,
    region: "東北",
    pollenSuitability: 0.95,
  },
  {
    id: "tokyo",
    name: "東京",
    lat: 35.6764,
    lon: 139.65,
    region: "関東",
    pollenSuitability: 1,
  },
  {
    id: "niigata",
    name: "新潟",
    lat: 37.9161,
    lon: 139.0364,
    region: "甲信越",
    pollenSuitability: 0.9,
  },
  {
    id: "nagoya",
    name: "名古屋",
    lat: 35.1815,
    lon: 136.9066,
    region: "中部",
    pollenSuitability: 0.93,
  },
  {
    id: "osaka",
    name: "大阪",
    lat: 34.6937,
    lon: 135.5023,
    region: "関西",
    pollenSuitability: 0.88,
  },
  {
    id: "hiroshima",
    name: "広島",
    lat: 34.3853,
    lon: 132.4553,
    region: "中国",
    pollenSuitability: 0.84,
  },
  {
    id: "kochi",
    name: "高知",
    lat: 33.5597,
    lon: 133.5311,
    region: "四国",
    pollenSuitability: 0.82,
  },
  {
    id: "fukuoka",
    name: "福岡",
    lat: 33.5902,
    lon: 130.4017,
    region: "九州",
    pollenSuitability: 0.78,
  },
  {
    id: "kagoshima",
    name: "鹿児島",
    lat: 31.5966,
    lon: 130.5571,
    region: "南九州",
    pollenSuitability: 0.66,
  },
  {
    id: "naha",
    name: "那覇",
    lat: 26.2125,
    lon: 127.6811,
    region: "沖縄",
    pollenSuitability: 0.22,
  },
];

const mapGuides: GeoPoint[][] = [
  [
    { lat: 31.3, lon: 130.2 },
    { lat: 32.3, lon: 131.1 },
    { lat: 33.0, lon: 132.0 },
    { lat: 33.7, lon: 133.7 },
    { lat: 34.4, lon: 134.8 },
    { lat: 35.1, lon: 136.1 },
    { lat: 35.7, lon: 139.2 },
    { lat: 36.6, lon: 140.2 },
    { lat: 38.1, lon: 141.2 },
    { lat: 40.9, lon: 141.4 },
  ],
  [
    { lat: 41.2, lon: 139.2 },
    { lat: 43.2, lon: 141.5 },
    { lat: 44.0, lon: 144.8 },
    { lat: 43.0, lon: 145.5 },
    { lat: 41.7, lon: 142.8 },
    { lat: 41.2, lon: 139.2 },
  ],
  [
    { lat: 33.9, lon: 133.2 },
    { lat: 33.8, lon: 134.6 },
    { lat: 33.9, lon: 132.1 },
    { lat: 33.8, lon: 133.2 },
  ],
  [
    { lat: 31.1, lon: 130.2 },
    { lat: 32.9, lon: 129.9 },
    { lat: 33.8, lon: 131.7 },
    { lat: 31.1, lon: 130.2 },
  ],
  [
    { lat: 24.8, lon: 127.1 },
    { lat: 25.7, lon: 127.5 },
    { lat: 26.2, lon: 127.8 },
    { lat: 26.8, lon: 128.3 },
  ],
];

const pollenCatalog: PollenType[] = [
  {
    id: "cedar",
    name: "スギ",
    seasonMonths: [2, 3, 4],
    peakMonths: [2, 3],
    description: "日本で最も患者数が多い代表的な花粉。早春から急増します。",
    care: "朝の飛散ピーク前に洗濯・換気を済ませると悪化を防ぎやすいです。",
  },
  {
    id: "cypress",
    name: "ヒノキ",
    seasonMonths: [3, 4, 5],
    peakMonths: [4],
    description: "スギの後に飛散が強まり、症状が長引く要因になりやすい花粉です。",
    care: "4月以降も自己判断で薬をやめず、就寝前の鼻洗浄を継続しましょう。",
  },
  {
    id: "grass",
    name: "イネ科",
    seasonMonths: [4, 5, 6, 7, 8],
    peakMonths: [5, 6],
    description: "河川敷や草地の近くで反応しやすく、初夏まで長く続きます。",
    care: "草地に近いルートを避け、帰宅時に靴と裾の花粉を落としてください。",
  },
  {
    id: "ragweed",
    name: "ブタクサ",
    seasonMonths: [8, 9, 10],
    peakMonths: [9],
    description: "秋に増える代表花粉で、朝夕の散歩で症状が出る方が多いです。",
    care: "秋は窓開け換気の時間帯を昼に寄せると吸入量を減らしやすいです。",
  },
  {
    id: "birch",
    name: "シラカンバ",
    seasonMonths: [4, 5, 6],
    peakMonths: [5],
    description: "北海道・東北で注意される花粉。地域により体感差が大きいです。",
    care: "目のかゆみが強い日は防風メガネと人工涙液を併用してください。",
  },
];

const actionItems: { key: DailyActionKey; label: string }[] = [
  { key: "mask", label: "高性能マスクを着用する" },
  { key: "glasses", label: "メガネ・ゴーグルで目を守る" },
  { key: "laundryInside", label: "洗濯物は室内干しにする" },
  { key: "shower", label: "帰宅後にシャワーで花粉を落とす" },
  { key: "roomClean", label: "寝室の掃除・空気清浄を行う" },
];

const defaultActionState: Record<DailyActionKey, boolean> = {
  mask: false,
  glasses: false,
  laundryInside: false,
  shower: false,
  roomClean: false,
};

const monthList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const mapBounds = {
  latMin: 24,
  latMax: 46,
  lonMin: 127,
  lonMax: 146,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function riskLevel(score: number): RiskLevel {
  if (score >= 75) return "非常に高い";
  if (score >= 55) return "高い";
  if (score >= 35) return "やや高い";
  return "低い";
}

function riskAdvice(level: RiskLevel): string {
  if (level === "非常に高い") {
    return "外出は短時間にし、マスク・メガネ・上着の花粉対策を徹底してください。";
  }
  if (level === "高い") {
    return "長時間の外出後は衣類をはらい、洗顔・うがいを早めに行いましょう。";
  }
  if (level === "やや高い") {
    return "油断せず、窓開け時間を短くして室内の花粉侵入を抑えると安心です。";
  }
  return "比較的穏やかですが、症状が出やすい方は予防薬を継続してください。";
}

function seasonalBase(month: number): number {
  if (month >= 2 && month <= 4) return 48;
  if (month === 5) return 36;
  if (month >= 6 && month <= 9) return 16;
  return 10;
}

function estimateRisk(input: {
  date: Date;
  temperature: number;
  humidity: number;
  wind: number;
  precipitation: number;
  pm10: number;
  pm25: number;
}): RiskResult {
  const month = input.date.getMonth() + 1;
  let score = seasonalBase(month);
  score += clamp((input.temperature - 12) * 1.8, -6, 22);
  score += clamp((input.wind - 2) * 2.9, 0, 20);
  score += clamp((48 - input.humidity) * 0.6, 0, 15);
  score += clamp((input.pm25 - 15) * 0.4, 0, 9);
  score += clamp((input.pm10 - 30) * 0.25, 0, 8);

  if (input.precipitation > 0) score -= 16;
  if (input.humidity >= 70) score -= 6;

  const normalized = Math.round(clamp(score, 0, 100));
  const level = riskLevel(normalized);

  return { score: normalized, level, advice: riskAdvice(level) };
}

function toDayLabel(dateString: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(dateString));
}

function toJstDateString(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function toJstTimeString(date: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function parseNumber(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function monthDistance(a: number, b: number) {
  const distance = Math.abs(a - b);
  return Math.min(distance, 12 - distance);
}

function seasonalFactor(currentMonth: number, seasonMonths: number[]) {
  if (seasonMonths.includes(currentMonth)) return 1;
  if (seasonMonths.some((month) => monthDistance(month, currentMonth) === 1)) {
    return 0.44;
  }
  if (seasonMonths.some((month) => monthDistance(month, currentMonth) === 2)) {
    return 0.2;
  }
  return 0;
}

function estimatePollenTypeScore(
  type: PollenType,
  currentMonth: number,
  weather: WeatherSnapshot | null,
  overallRiskScore: number,
) {
  const season = seasonalFactor(currentMonth, type.seasonMonths);
  const windBoost = weather ? clamp((weather.wind - 2) * 6, 0, 18) : 6;
  const dryBoost = weather ? clamp((50 - weather.humidity) * 0.35, 0, 12) : 4;
  const rainPenalty = weather && weather.precipitation > 0 ? 12 : 0;

  const score = Math.round(
    clamp(season * 72 + overallRiskScore * 0.22 + windBoost + dryBoost - rainPenalty, 0, 100),
  );

  return score;
}

function levelChipClass(level: RiskLevel) {
  if (level === "非常に高い") return "bg-rose-100 text-rose-700";
  if (level === "高い") return "bg-orange-100 text-orange-700";
  if (level === "やや高い") return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

function levelDotClass(level: RiskLevel) {
  if (level === "非常に高い") return "bg-rose-600";
  if (level === "高い") return "bg-orange-500";
  if (level === "やや高い") return "bg-amber-500";
  return "bg-emerald-500";
}

function geoToPercent(lat: number, lon: number) {
  const x = ((lon - mapBounds.lonMin) / (mapBounds.lonMax - mapBounds.lonMin)) * 100;
  const y = ((mapBounds.latMax - lat) / (mapBounds.latMax - mapBounds.latMin)) * 100;
  return {
    x: clamp(x, 0, 100),
    y: clamp(y, 0, 100),
  };
}

function adjustMapRiskScore(rawScore: number, suitability: number, month: number) {
  const monthScale =
    month >= 2 && month <= 4 ? 1 : month === 5 ? 0.78 : month >= 8 && month <= 10 ? 0.55 : 0.35;
  const effectiveSuitability = clamp(suitability * monthScale, 0.15, 1);
  const baseline = 14;

  return Math.round(
    clamp(rawScore * effectiveSuitability + baseline * (1 - effectiveSuitability), 0, 100),
  );
}

export default function Home() {
  const [selectedId, setSelectedId] = useState(defaultLocations[0].id);
  const [customLocation, setCustomLocation] = useState<LocationOption | null>(
    null,
  );
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [todayRisk, setTodayRisk] = useState<RiskResult | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mapRisks, setMapRisks] = useState<CityRiskPoint[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapUpdatedAt, setMapUpdatedAt] = useState<string | null>(null);
  const [activeMapCityId, setActiveMapCityId] = useState<string | null>(null);

  const [symptomSeverity, setSymptomSeverity] = useState(4);
  const [tookMedicine, setTookMedicine] = useState(false);
  const [memo, setMemo] = useState("");
  const [logs, setLogs] = useState<SymptomLog[]>([]);
  const [actions, setActions] =
    useState<Record<DailyActionKey, boolean>>(defaultActionState);

  const options = customLocation
    ? [customLocation, ...defaultLocations]
    : defaultLocations;

  const selectedLocation =
    options.find((item) => item.id === selectedId) ?? options[0];

  const completionRate = useMemo(() => {
    const done = Object.values(actions).filter(Boolean).length;
    return Math.round((done / actionItems.length) * 100);
  }, [actions]);

  const weeklyAverage = useMemo(() => {
    if (logs.length === 0) return null;
    const list = logs.slice(0, 7);
    const avg = list.reduce((sum, item) => sum + item.severity, 0) / list.length;
    return Number(avg.toFixed(1));
  }, [logs]);

  const trend = useMemo(() => {
    if (logs.length < 6) return null;
    const latest = logs.slice(0, 3);
    const previous = logs.slice(3, 6);
    const latestAvg = latest.reduce((sum, item) => sum + item.severity, 0) / 3;
    const previousAvg = previous.reduce((sum, item) => sum + item.severity, 0) / 3;
    const delta = Number((latestAvg - previousAvg).toFixed(1));
    return delta;
  }, [logs]);

  const pollenTypeStatus = useMemo<PollenTypeStatus[]>(() => {
    const month = new Date().getMonth() + 1;
    const overall = todayRisk?.score ?? 40;

    return pollenCatalog
      .map((type) => {
        const score = estimatePollenTypeScore(type, month, weather, overall);
        return {
          ...type,
          score,
          level: riskLevel(score),
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [todayRisk, weather]);

  const activeMapCity = useMemo(() => {
    if (!activeMapCityId) return null;
    return mapRisks.find((city) => city.id === activeMapCityId) ?? null;
  }, [mapRisks, activeMapCityId]);

  const highAttentionPollen = useMemo(() => {
    const list = pollenTypeStatus
      .filter((item) => item.score >= 35)
      .slice(0, 2)
      .map((item) => item.name);

    return list.length > 0 ? list.join("・") : "現時点では目立つ種類は少なめ";
  }, [pollenTypeStatus]);

  const todayLabel = useMemo(() => {
    return new Intl.DateTimeFormat("ja-JP", {
      month: "long",
      day: "numeric",
      weekday: "short",
    }).format(new Date());
  }, []);

  const mapAverageScore = useMemo(() => {
    if (mapRisks.length === 0) return null;
    const total = mapRisks.reduce((sum, city) => sum + city.score, 0);
    return Math.round(total / mapRisks.length);
  }, [mapRisks]);

  const mapHighestCity = useMemo(() => {
    return mapRisks.length > 0 ? mapRisks[0] : null;
  }, [mapRisks]);

  const loadMapRisk = useCallback(async () => {
    setMapLoading(true);
    setMapError(null);

    try {
      const settled = await Promise.allSettled(
        mapCities.map(async (city): Promise<CityRiskPoint> => {
          const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&timezone=Asia%2FTokyo&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation`;
          const response = await fetch(weatherUrl);

          if (!response.ok) {
            throw new Error(`failed to load ${city.name}`);
          }

          const data = (await response.json()) as {
            current?: {
              temperature_2m?: number;
              relative_humidity_2m?: number;
              wind_speed_10m?: number;
              precipitation?: number;
            };
          };

          const temperature = parseNumber(data.current?.temperature_2m, 12);
          const humidity = parseNumber(data.current?.relative_humidity_2m, 50);
          const wind = parseNumber(data.current?.wind_speed_10m, 2);
          const precipitation = parseNumber(data.current?.precipitation, 0);
          const risk = estimateRisk({
            date: new Date(),
            temperature,
            humidity,
            wind,
            precipitation,
            pm10: 24,
            pm25: 13,
          });
          const adjustedScore = adjustMapRiskScore(
            risk.score,
            city.pollenSuitability,
            new Date().getMonth() + 1,
          );
          const level = riskLevel(adjustedScore);

          return {
            ...city,
            score: adjustedScore,
            level,
            temperature,
            humidity,
            wind,
            precipitation,
          };
        }),
      );

      const succeeded = settled
        .filter(
          (result): result is PromiseFulfilledResult<CityRiskPoint> =>
            result.status === "fulfilled",
        )
        .map((result) => result.value)
        .sort((a, b) => b.score - a.score);

      if (succeeded.length === 0) {
        throw new Error("map fetch failed");
      }

      setMapRisks(succeeded);
      setMapUpdatedAt(toJstTimeString(new Date()));
      setActiveMapCityId((prev) => {
        if (prev && succeeded.some((city) => city.id === prev)) return prev;
        return succeeded[0].id;
      });

      if (succeeded.length < mapCities.length) {
        setMapError("一部地域の取得に失敗しました。表示できた地域のみ反映しています。");
      }
    } catch {
      setMapError("花粉マップの取得に失敗しました。少し時間をおいて再試行してください。");
    } finally {
      setMapLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const rawLogs = localStorage.getItem(STORAGE_LOG_KEY);
      if (rawLogs) {
        const parsed = JSON.parse(rawLogs) as SymptomLog[];
        setLogs(parsed);
      }
    } catch {
      setLogs([]);
    }

    try {
      const rawActions = localStorage.getItem(STORAGE_ACTION_KEY);
      if (rawActions) {
        const parsed = JSON.parse(rawActions) as Record<DailyActionKey, boolean>;
        setActions({ ...defaultActionState, ...parsed });
      }
    } catch {
      setActions(defaultActionState);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_LOG_KEY, JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_ACTION_KEY, JSON.stringify(actions));
  }, [actions]);

  useEffect(() => {
    async function loadRisk() {
      setIsLoading(true);
      setError(null);

      try {
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${selectedLocation.lat}&longitude=${selectedLocation.lon}&timezone=Asia%2FTokyo&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation&daily=temperature_2m_max,wind_speed_10m_max,precipitation_probability_max&forecast_days=3`;
        const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${selectedLocation.lat}&longitude=${selectedLocation.lon}&timezone=Asia%2FTokyo&current=pm10,pm2_5`;

        const [weatherRes, airRes] = await Promise.all([
          fetch(weatherUrl),
          fetch(airUrl),
        ]);

        if (!weatherRes.ok || !airRes.ok) {
          throw new Error("データ取得に失敗しました");
        }

        const weatherData = (await weatherRes.json()) as {
          current?: {
            temperature_2m?: number;
            relative_humidity_2m?: number;
            wind_speed_10m?: number;
            precipitation?: number;
          };
          daily?: {
            time?: string[];
            temperature_2m_max?: number[];
            wind_speed_10m_max?: number[];
            precipitation_probability_max?: number[];
          };
        };

        const airData = (await airRes.json()) as {
          current?: {
            pm10?: number;
            pm2_5?: number;
          };
        };

        const snapshot: WeatherSnapshot = {
          temperature: parseNumber(weatherData.current?.temperature_2m, 12),
          humidity: parseNumber(weatherData.current?.relative_humidity_2m, 50),
          wind: parseNumber(weatherData.current?.wind_speed_10m, 2),
          precipitation: parseNumber(weatherData.current?.precipitation, 0),
          pm10: parseNumber(airData.current?.pm10, 20),
          pm25: parseNumber(airData.current?.pm2_5, 10),
        };

        setWeather(snapshot);
        setTodayRisk(
          estimateRisk({
            date: new Date(),
            temperature: snapshot.temperature,
            humidity: snapshot.humidity,
            wind: snapshot.wind,
            precipitation: snapshot.precipitation,
            pm10: snapshot.pm10,
            pm25: snapshot.pm25,
          }),
        );

        const times = weatherData.daily?.time ?? [];
        const maxTemps = weatherData.daily?.temperature_2m_max ?? [];
        const maxWinds = weatherData.daily?.wind_speed_10m_max ?? [];
        const precipProb = weatherData.daily?.precipitation_probability_max ?? [];

        const forecastData: ForecastDay[] = times.map((date, index) => {
          const result = estimateRisk({
            date: new Date(date),
            temperature: parseNumber(maxTemps[index], snapshot.temperature),
            humidity: snapshot.humidity,
            wind: parseNumber(maxWinds[index], snapshot.wind),
            precipitation: parseNumber(precipProb[index], 0) >= 40 ? 1 : 0,
            pm10: snapshot.pm10,
            pm25: snapshot.pm25,
          });
          return {
            date,
            score: result.score,
            level: result.level,
          };
        });

        setForecast(forecastData);
      } catch {
        setError("気象データの取得に失敗しました。少し時間をおいて再試行してください。");
      } finally {
        setIsLoading(false);
      }
    }

    void loadRisk();
  }, [selectedLocation]);

  useEffect(() => {
    void loadMapRisk();
  }, [loadMapRisk]);

  function toggleAction(key: DailyActionKey) {
    setActions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function submitLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const today = toJstDateString(new Date());
    const item: SymptomLog = {
      date: today,
      severity: symptomSeverity,
      tookMedicine,
      memo: memo.trim(),
    };

    setLogs((prev) => {
      const filtered = prev.filter((entry) => entry.date !== today);
      return [item, ...filtered].slice(0, 30);
    });
    setMemo("");
  }

  function currentTip() {
    if (!todayRisk) return "データ取得中です。";
    if (todayRisk.level === "非常に高い") {
      return "空気清浄機を強めに設定し、外干しを避けるのが有効です。";
    }
    if (todayRisk.level === "高い") {
      return "起床後に窓を開ける時間を短くして、室内への流入を減らしましょう。";
    }
    if (todayRisk.level === "やや高い") {
      return "帰宅時に衣類をはらってから入室すると夜の症状悪化を防ぎやすくなります。";
    }
    return "症状が軽い日でも、薬の自己中断は避けて医師の指示に従ってください。";
  }

  return (
    <div className="app-shell px-4 py-8 sm:px-6 lg:px-8">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section
          className="hero-card reveal rounded-[2rem] p-6 sm:p-8 lg:p-10"
          style={{ animationDelay: "20ms" }}
        >
          <div className="grid gap-7 lg:grid-cols-[1.5fr_1fr]">
            <div>
              <p className="kicker">SEASONAL RESPIRATORY CARE</p>
              <h1 className="font-heading mt-3 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
                花粉コンディション・ナビ
              </h1>
              <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-700 sm:text-base">
                天気・大気データから当日の花粉リスクを推定し、予防行動と症状ログを一つの画面で管理します。急に悪化しやすい日を先回りで把握できる、花粉症向けの実践ダッシュボードです。
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="info-pill bg-white/95 text-slate-700">{todayLabel}</span>
                <span className="info-pill bg-teal-100/90 text-teal-700">
                  注目花粉: {highAttentionPollen}
                </span>
                <span className="info-pill bg-cyan-100/90 text-cyan-700">
                  全国マップ平均: {mapAverageScore ?? "--"}
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-[0_15px_34px_rgba(15,23,42,0.08)]">
              <p className="text-xs font-semibold tracking-[0.14em] text-slate-500">
                TODAY SNAPSHOT
              </p>
              <div className="mt-4 flex items-center gap-4">
                <div className="relative h-24 w-24 rounded-full bg-slate-200 p-2">
                  <div
                    className="h-full w-full rounded-full"
                    style={{
                      background: `conic-gradient(#0f766e ${(todayRisk?.score ?? 0) * 3.6}deg, #dce4ea 0deg)`,
                    }}
                  />
                  <div className="absolute inset-[12px] grid place-items-center rounded-full bg-white">
                    <span className="text-xl font-black text-slate-900">
                      {todayRisk?.score ?? "--"}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">現在の判定</p>
                  <p className="font-heading mt-1 text-3xl font-extrabold text-slate-900">
                    {todayRisk?.level ?? "計算中"}
                  </p>
                  {todayRisk ? (
                    <span
                      className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${levelChipClass(todayRisk.level)}`}
                    >
                      スコア {todayRisk.score}
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-700">{currentTip()}</p>
            </div>
          </div>
          <p className="mt-5 text-xs text-slate-500">
            ※ 参考指標です。治療や服薬判断は必ず医療機関の指示に従ってください。
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
          <div
            className="panel-card reveal rounded-[1.65rem] p-6"
            style={{ animationDelay: "80ms" }}
          >
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <label
                  htmlFor="location"
                  className="mb-2 block text-xs font-semibold tracking-[0.13em] text-slate-600"
                >
                  観測地域
                </label>
                <select
                  id="location"
                  className="soft-field w-full rounded-xl px-4 py-3 text-slate-900 outline-none"
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                >
                  {options.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="action-btn action-btn-dark"
                onClick={() => setSelectedId(selectedLocation.id)}
              >
                再取得
              </button>
              <button
                type="button"
                className="action-btn action-btn-accent"
                onClick={() => {
                  if (!navigator.geolocation) {
                    setError("このブラウザは位置情報に対応していません。");
                    return;
                  }
                  setGeoLoading(true);
                  setError(null);
                  navigator.geolocation.getCurrentPosition(
                    (position) => {
                      const lat = position.coords.latitude;
                      const lon = position.coords.longitude;
                      const gpsLocation: LocationOption = {
                        id: "current-location",
                        name: "現在地",
                        lat,
                        lon,
                      };
                      setCustomLocation(gpsLocation);
                      setSelectedId(gpsLocation.id);
                      setGeoLoading(false);
                    },
                    () => {
                      setGeoLoading(false);
                      setError(
                        "位置情報を取得できませんでした。ブラウザの権限設定を確認してください。",
                      );
                    },
                    { enableHighAccuracy: true, timeout: 12000 },
                  );
                }}
                disabled={geoLoading}
              >
                {geoLoading ? "取得中..." : "現在地を使う"}
              </button>
            </div>

            {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="metric-card">
                <p className="metric-label">気温</p>
                <p className="metric-value">
                  {weather ? `${weather.temperature.toFixed(1)}°C` : "--"}
                </p>
              </div>
              <div className="metric-card">
                <p className="metric-label">湿度</p>
                <p className="metric-value">
                  {weather ? `${Math.round(weather.humidity)}%` : "--"}
                </p>
              </div>
              <div className="metric-card">
                <p className="metric-label">風速</p>
                <p className="metric-value">
                  {weather ? `${weather.wind.toFixed(1)} m/s` : "--"}
                </p>
              </div>
              <div className="metric-card">
                <p className="metric-label">PM2.5</p>
                <p className="metric-value">
                  {weather ? `${Math.round(weather.pm25)} µg/m³` : "--"}
                </p>
              </div>
              <div className="metric-card">
                <p className="metric-label">PM10</p>
                <p className="metric-value">
                  {weather ? `${Math.round(weather.pm10)} µg/m³` : "--"}
                </p>
              </div>
              <div className="metric-card">
                <p className="metric-label">降水量</p>
                <p className="metric-value">
                  {weather ? `${weather.precipitation.toFixed(1)} mm` : "--"}
                </p>
              </div>
            </div>
          </div>

          <aside
            className="panel-card reveal rounded-[1.65rem] p-6"
            style={{ animationDelay: "120ms" }}
          >
            <p className="text-xs font-semibold tracking-[0.13em] text-slate-600">
              今日の花粉リスク
            </p>
            <div className="mt-4 flex items-center gap-5">
              <div className="relative h-28 w-28 rounded-full bg-slate-200 p-2">
                <div
                  className="h-full w-full rounded-full"
                  style={{
                    background: `conic-gradient(#0f766e ${(todayRisk?.score ?? 0) * 3.6}deg, #d5dde5 0deg)`,
                  }}
                />
                <div className="absolute inset-[13px] grid place-items-center rounded-full bg-white">
                  <span className="text-xl font-black text-slate-900">
                    {todayRisk ? todayRisk.score : "--"}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">判定</p>
                <p className="font-heading mt-1 text-3xl font-extrabold text-slate-900">
                  {todayRisk?.level ?? "計算中"}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-700">
              {todayRisk?.advice ?? "気象データを取得しています。"}
            </p>
            <p className="mt-3 text-xs text-slate-500">補足: {currentTip()}</p>
            {isLoading ? (
              <p className="mt-4 text-xs font-semibold text-teal-700">
                最新データを取得しています...
              </p>
            ) : null}
          </aside>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div
            className="panel-card reveal rounded-[1.65rem] p-6"
            style={{ animationDelay: "160ms" }}
          >
            <h2 className="font-heading text-2xl font-bold text-slate-900">
              3日先までのリスク予測
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              天気変化をもとに、近い将来の悪化タイミングを確認できます。
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {forecast.map((day) => (
                <div
                  key={day.date}
                  className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-[0_10px_25px_rgba(15,23,42,0.05)]"
                >
                  <p className="text-xs font-semibold text-slate-500">
                    {toDayLabel(day.date)}
                  </p>
                  <p className="mt-2 text-2xl font-black text-slate-900">
                    {day.score}
                  </p>
                  <p
                    className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${levelChipClass(day.level)}`}
                  >
                    {day.level}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div
            className="panel-card reveal rounded-[1.65rem] p-6"
            style={{ animationDelay: "190ms" }}
          >
            <h2 className="font-heading text-2xl font-bold text-slate-900">
              今日の予防アクション
            </h2>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-[width] duration-500"
                style={{ width: `${completionRate}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-slate-700">
              実施率 <strong>{completionRate}%</strong>
            </p>
            <div className="mt-4 space-y-2">
              {actionItems.map((item) => (
                <label
                  key={item.key}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-800 transition hover:border-teal-300"
                >
                  <input
                    type="checkbox"
                    checked={actions[item.key]}
                    onChange={() => toggleAction(item.key)}
                    className="h-4 w-4 accent-teal-600"
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_1.5fr]">
          <div
            className="panel-card reveal rounded-[1.65rem] p-6"
            style={{ animationDelay: "230ms" }}
          >
            <h2 className="font-heading text-2xl font-bold text-slate-900">
              花粉の種類
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              いま注意したい種類: <strong>{highAttentionPollen}</strong>
            </p>
            <div className="mt-4 space-y-3">
              {pollenTypeStatus.map((type) => (
                <article
                  key={type.id}
                  className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-[0_10px_25px_rgba(15,23,42,0.04)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-lg font-bold text-slate-900">{type.name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-slate-900">{type.score}</p>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${levelChipClass(type.level)}`}
                      >
                        {type.level}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs leading-6 text-slate-600">{type.description}</p>
                  <p className="mt-2 text-xs leading-6 text-teal-700">対策: {type.care}</p>
                  <div className="mt-3 grid grid-cols-12 gap-1">
                    {monthList.map((month) => {
                      const inSeason = type.seasonMonths.includes(month);
                      const isPeak = type.peakMonths.includes(month);
                      return (
                        <div
                          key={`${type.id}-${month}`}
                          title={`${month}月`}
                          className={`h-2 rounded-full ${
                            isPeak
                              ? "bg-teal-600"
                              : inSeason
                                ? "bg-teal-300"
                                : "bg-slate-200"
                          }`}
                        />
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div
            className="panel-card reveal rounded-[1.65rem] p-6"
            style={{ animationDelay: "270ms" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-heading text-2xl font-bold text-slate-900">
                  花粉マップ（主要都市）
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  地域係数を加味した推定リスク分布
                  {mapUpdatedAt ? `・最終更新 ${mapUpdatedAt} JST` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void loadMapRisk();
                }}
                className="action-btn action-btn-dark"
                disabled={mapLoading}
              >
                {mapLoading ? "更新中..." : "マップ更新"}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                低い
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-amber-700">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                やや高い
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-1 text-orange-700">
                <span className="h-2 w-2 rounded-full bg-orange-500" />
                高い
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-rose-700">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                非常に高い
              </span>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white/65 p-3">
              <div className="relative h-[420px] overflow-hidden rounded-xl bg-[radial-gradient(circle_at_22%_20%,rgba(103,232,249,0.35),transparent_38%),linear-gradient(180deg,#dbeafe_0%,#cffafe_53%,#d1fae5_100%)]">
                <svg
                  className="absolute inset-0 h-full w-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  {mapGuides.map((line, index) => {
                    const points = line
                      .map((point) => {
                        const pos = geoToPercent(point.lat, point.lon);
                        return `${pos.x},${pos.y}`;
                      })
                      .join(" ");

                    return (
                      <polyline
                        key={`guide-${index}`}
                        points={points}
                        fill="none"
                        stroke="rgba(15, 23, 42, 0.3)"
                        strokeWidth={index === 0 ? 1.2 : 0.82}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    );
                  })}
                </svg>

                {mapRisks.map((city) => {
                  const pos = geoToPercent(city.lat, city.lon);
                  const active = city.id === activeMapCityId;

                  return (
                    <button
                      key={city.id}
                      type="button"
                      className="absolute -translate-x-1/2 -translate-y-1/2 text-left"
                      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                      onClick={() => setActiveMapCityId(city.id)}
                      title={`${city.name}: ${city.score}`}
                    >
                      <span
                        className={`block h-3.5 w-3.5 rounded-full ${levelDotClass(city.level)} transition ${active ? "ring-4 ring-slate-300" : "ring-2 ring-white"}`}
                      />
                      <span className="mt-1 block rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 shadow-sm">
                        {city.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {mapError ? <p className="mt-3 text-sm text-rose-700">{mapError}</p> : null}

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
                <p className="text-xs font-semibold tracking-[0.12em] text-slate-500">
                  最高リスク都市
                </p>
                <p className="mt-1 text-xl font-black text-slate-900">
                  {mapHighestCity ? mapHighestCity.name : "--"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {mapHighestCity ? `スコア ${mapHighestCity.score}` : "データ取得中"}
                </p>
              </div>
              {activeMapCity ? (
                <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-bold text-slate-900">
                      {activeMapCity.name}（{activeMapCity.region}）
                    </p>
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${levelChipClass(activeMapCity.level)}`}
                    >
                      {activeMapCity.level}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">
                    気温 {activeMapCity.temperature.toFixed(1)}°C / 湿度{" "}
                    {Math.round(activeMapCity.humidity)}% / 風速{" "}
                    {activeMapCity.wind.toFixed(1)} m/s / 降水{" "}
                    {activeMapCity.precipitation.toFixed(1)} mm
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {mapRisks.map((city) => (
                <button
                  key={`list-${city.id}`}
                  type="button"
                  onClick={() => setActiveMapCityId(city.id)}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
                    city.id === activeMapCityId
                      ? "border-cyan-300 bg-cyan-50"
                      : "border-slate-200 bg-white/75 hover:border-slate-300"
                  }`}
                >
                  <span className="font-semibold text-slate-800">{city.name}</span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${levelChipClass(city.level)}`}
                  >
                    {city.score}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div
            className="panel-card reveal rounded-[1.65rem] p-6"
            style={{ animationDelay: "310ms" }}
          >
            <h2 className="font-heading text-2xl font-bold text-slate-900">
              症状ログ
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              1日1回の記録で、症状変動と対策の効き方を見える化できます。
            </p>
            <form className="mt-4 space-y-4" onSubmit={submitLog}>
              <div>
                <label className="mb-2 block text-xs font-semibold tracking-[0.12em] text-slate-600">
                  今日のつらさ (0-10)
                </label>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={symptomSeverity}
                  onChange={(event) =>
                    setSymptomSeverity(parseInt(event.target.value, 10))
                  }
                  className="w-full accent-teal-600"
                />
                <p className="mt-1 text-sm font-semibold text-slate-700">
                  スコア: {symptomSeverity}
                </p>
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/75 px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={tookMedicine}
                  onChange={(event) => setTookMedicine(event.target.checked)}
                  className="h-4 w-4 accent-teal-600"
                />
                今日は服薬した
              </label>

              <div>
                <label
                  htmlFor="memo"
                  className="mb-2 block text-xs font-semibold tracking-[0.12em] text-slate-600"
                >
                  メモ
                </label>
                <textarea
                  id="memo"
                  value={memo}
                  onChange={(event) => setMemo(event.target.value)}
                  placeholder="外出時間や症状の特徴など"
                  className="soft-field min-h-[98px] w-full rounded-xl px-3 py-2 text-sm text-slate-900 outline-none"
                />
              </div>

              <button type="submit" className="action-btn action-btn-dark">
                今日のログを保存
              </button>
            </form>
          </div>

          <div
            className="panel-card reveal rounded-[1.65rem] p-6"
            style={{ animationDelay: "350ms" }}
          >
            <h2 className="font-heading text-2xl font-bold text-slate-900">
              直近の傾向
            </h2>
            <div className="mt-3 rounded-xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-700">
              <p>
                7日平均:{" "}
                <strong>{weeklyAverage !== null ? `${weeklyAverage}` : "--"}</strong>
              </p>
              <p className="mt-2">
                3日比較:{" "}
                <strong>
                  {trend === null
                    ? "--"
                    : trend > 0
                      ? `+${trend}（悪化傾向）`
                      : `${trend}（改善傾向）`}
                </strong>
              </p>
            </div>

            <div className="mt-4 space-y-2">
              {logs.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-white/75 px-3 py-4 text-sm text-slate-500">
                  ログがまだありません。今日の状態を記録してみてください。
                </p>
              ) : (
                logs.slice(0, 7).map((log) => (
                  <article
                    key={log.date}
                    className="rounded-xl border border-slate-200 bg-white/80 p-3"
                  >
                    <p className="text-xs font-semibold text-slate-500">{log.date}</p>
                    <p className="mt-1 text-sm text-slate-800">
                      つらさ: <strong>{log.severity}</strong> / 10 ・ 服薬:{" "}
                      <strong>{log.tookMedicine ? "あり" : "なし"}</strong>
                    </p>
                    {log.memo ? (
                      <p className="mt-1 text-xs leading-6 text-slate-600">
                        {log.memo}
                      </p>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
