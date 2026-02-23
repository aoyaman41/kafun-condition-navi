"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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

const STORAGE_LOG_KEY = "kafun-symptom-log-v1";
const STORAGE_ACTION_KEY = "kafun-action-check-v1";

const defaultLocations: LocationOption[] = [
  { id: "tokyo", name: "東京", lat: 35.6764, lon: 139.65 },
  { id: "osaka", name: "大阪", lat: 34.6937, lon: 135.5023 },
  { id: "nagoya", name: "名古屋", lat: 35.1815, lon: 136.9066 },
  { id: "sapporo", name: "札幌", lat: 43.0618, lon: 141.3545 },
  { id: "fukuoka", name: "福岡", lat: 33.5902, lon: 130.4017 },
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

function parseNumber(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
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
    <div className="min-h-screen px-4 py-8 sm:px-6">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="glass-card p-6 sm:p-8">
          <p className="mb-3 text-sm font-semibold tracking-[0.18em] text-teal-700">
            POLLEN CARE DASHBOARD
          </p>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            花粉コンディション・ナビ
          </h1>
          <p className="mt-4 max-w-3xl text-sm text-slate-700 sm:text-base">
            現在地の気象情報と大気情報から、花粉の飛散リスクを推定します。あわせて症状と対策の記録を残し、悪化しやすい日を先回りで管理できます。
          </p>
          <p className="mt-3 text-xs text-slate-500">
            ※ 本アプリのリスクは一般的な傾向に基づく参考値です。診断や治療判断は医療機関にご相談ください。
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
          <div className="glass-card p-6">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <label
                  htmlFor="location"
                  className="mb-2 block text-xs font-semibold tracking-[0.13em] text-slate-600"
                >
                  地域
                </label>
                <select
                  id="location"
                  className="w-full rounded-xl border border-slate-300 bg-white/80 px-4 py-3 text-slate-900 outline-none transition focus:border-teal-500"
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
                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                onClick={() => setSelectedId(selectedLocation.id)}
              >
                再取得
              </button>
              <button
                type="button"
                className="rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:bg-teal-400"
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

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                <p className="text-xs font-semibold text-slate-500">気温</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {weather ? `${weather.temperature.toFixed(1)}°C` : "--"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                <p className="text-xs font-semibold text-slate-500">湿度</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {weather ? `${Math.round(weather.humidity)}%` : "--"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                <p className="text-xs font-semibold text-slate-500">風速</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {weather ? `${weather.wind.toFixed(1)} m/s` : "--"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                <p className="text-xs font-semibold text-slate-500">PM2.5</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {weather ? `${Math.round(weather.pm25)} µg/m³` : "--"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                <p className="text-xs font-semibold text-slate-500">PM10</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {weather ? `${Math.round(weather.pm10)} µg/m³` : "--"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                <p className="text-xs font-semibold text-slate-500">降水量</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {weather ? `${weather.precipitation.toFixed(1)} mm` : "--"}
                </p>
              </div>
            </div>
          </div>

          <aside className="glass-card p-6">
            <p className="text-xs font-semibold tracking-[0.13em] text-slate-600">
              今日の花粉リスク
            </p>
            <div className="mt-4 flex items-center gap-5">
              <div className="relative h-28 w-28 rounded-full bg-slate-200 p-2">
                <div
                  className="h-full w-full rounded-full"
                  style={{
                    background: `conic-gradient(#0f766e ${
                      (todayRisk?.score ?? 0) * 3.6
                    }deg, #d5dde5 0deg)`,
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
          <div className="glass-card p-6">
            <h2 className="font-heading text-2xl font-bold text-slate-900">
              3日先までのリスク予測
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {forecast.map((day) => (
                <div
                  key={day.date}
                  className="rounded-2xl border border-slate-200 bg-white/75 p-4"
                >
                  <p className="text-xs font-semibold text-slate-500">
                    {toDayLabel(day.date)}
                  </p>
                  <p className="mt-2 text-2xl font-black text-slate-900">
                    {day.score}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-teal-700">
                    {day.level}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-6">
            <h2 className="font-heading text-2xl font-bold text-slate-900">
              今日の予防アクション
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              実施率 <strong>{completionRate}%</strong>
            </p>
            <div className="mt-4 space-y-2">
              {actionItems.map((item) => (
                <label
                  key={item.key}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-800"
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

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="glass-card p-6">
            <h2 className="font-heading text-2xl font-bold text-slate-900">
              症状ログ
            </h2>
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

              <label className="flex items-center gap-3 text-sm text-slate-700">
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
                  className="min-h-[88px] w-full rounded-xl border border-slate-300 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500"
                />
              </div>

              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                今日のログを保存
              </button>
            </form>
          </div>

          <div className="glass-card p-6">
            <h2 className="font-heading text-2xl font-bold text-slate-900">
              直近の傾向
            </h2>
            <div className="mt-3 rounded-xl border border-slate-200 bg-white/70 p-4 text-sm text-slate-700">
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
                <p className="text-sm text-slate-500">
                  ログがまだありません。今日の状態を記録してみてください。
                </p>
              ) : (
                logs.slice(0, 7).map((log) => (
                  <article
                    key={log.date}
                    className="rounded-xl border border-slate-200 bg-white/75 p-3"
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
