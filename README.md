# Visua — Image Search App

Wyszukiwarka obrazów z backendem tRPC + Express i frontendem React + Vite.

## Instalacja i uruchomienie

```bash
# 1. Zainstaluj zależności
npm install

# 2. Skopiuj plik env i opcjonalnie dodaj klucz SerpApi
cp .env.example .env

# 3. Zbuduj frontend i uruchom serwer
npm run build && npm start
```

Aplikacja będzie dostępna pod http://localhost:3000

## Tryb developerski (dwa terminale)

```bash
# Terminal 1 — backend
npx tsx server/index.ts

# Terminal 2 — frontend z hot-reload
npx vite --config vite.config.ts
```

Frontend będzie pod http://localhost:5173, proxy API → port 3000.

## Źródła obrazów

| Źródło | Wymaga klucza | Jakość |
|--------|---------------|--------|
| Google Images (SerpApi) | Tak (SERPAPI_KEY) | Najlepsza |
| Bing Images | Nie | Dobra |
| Yandex Images | Nie | Dobra |

W trybie "Auto" aplikacja próbuje po kolei: Google → Bing → Yandex.

## Struktura projektu

```
visua/
├── server/           # Backend Express + tRPC
│   ├── imageSearch.ts   # Logika wyszukiwania (SerpApi/Bing/Yandex)
│   ├── routers.ts       # tRPC router
│   └── index.ts         # Punkt wejściowy serwera
├── client/           # Frontend React + Vite
│   ├── src/
│   │   ├── pages/Home.tsx      # Główna strona
│   │   ├── components/ui/      # Komponenty UI (shadcn-style)
│   │   ├── lib/trpc.ts         # Klient tRPC
│   │   └── hooks/useMobile.ts  # Hook mobile
│   └── index.css     # Style globalne
├── shared/           # Współdzielone typy/stałe
└── .env.example      # Przykład konfiguracji
```
