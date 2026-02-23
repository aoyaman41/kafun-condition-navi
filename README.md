# 花粉コンディション・ナビ

花粉症の人向けに、当日の花粉リスク推定とセルフケア管理をまとめた Web アプリです。

## 主な機能

- 地域選択 / 現在地取得によるリスク表示
- 気象データ + PM 情報を使った花粉リスク推定（0-100）
- 3日先までの簡易リスク予測
- 症状ログ（つらさ / 服薬 / メモ）の保存（ブラウザの localStorage）
- 毎日の対策チェックリスト

## 技術スタック

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Open-Meteo API（天気）
- Open-Meteo Air Quality API（PM2.5 / PM10）

## ローカル開発

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開いて確認してください。

## 品質確認

```bash
npm run lint
npm run build
```

## GitHub への push

以下は CLI 例です（`gh` ログイン済み前提）。

```bash
git add .
git commit -m "feat: build pollen-care dashboard"
gh repo create <your-repo-name> --public --source=. --remote=origin --push
```

既存の GitHub リポジトリに接続する場合:

```bash
git remote add origin git@github.com:<user>/<repo>.git
git push -u origin main
```

## Vercel デプロイ

```bash
npm i -g vercel
vercel
vercel --prod
```

または `npx vercel --prod` でもデプロイできます。

## 注意

- 花粉リスクは一般的な傾向を使った推定値です。医療的な診断には使わないでください。
- 症状が強い場合や長引く場合は医療機関に相談してください。
