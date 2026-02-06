# Идеи и Напоминания (PWA)

Mobile-first офлайн приложение для быстрых заметок с локальным хранением (IndexedDB) и экспортом напоминаний в календарь через `.ics`.

## Стек

- Vite + React + TypeScript
- Dexie (IndexedDB)
- vite-plugin-pwa (offline app shell)

## Локальный запуск

```bash
npm install
npm run dev
```

Открыть: `http://localhost:5173`

## Production build

```bash
npm run build
npm run previewWorkflow `.
```

## Деплой на GitHub Pages

1. Запушить репозиторий на GitHub.
2. Убедиться, что default branch = `main`.
3. В Settings -> Pages выбрать **Build and deployment: GitHub Actions**.
4. Workflow `.github/workflows/deploy.yml` соберет и задеплоит сайт.

`VITE_BASE_PATH` задается автоматически как `/<repo-name>/` в CI.

## Установка PWA

### Android (Chrome)

1. Открыть сайт.
2. Нажать "Установить" в браузере или в подсказке внутри Settings.

### iOS (Safari)

1. Открыть сайт в Safari.
2. Нажать Share.
3. Выбрать "На экран Домой".

## Архитектура

- `src/components` - UI-компоненты (карточки, фильтры, FAB, reminder sheet)
- `src/pages` - экраны Inbox / Note / Settings
- `src/db` - Dexie database и типы
- `src/utils/ics.ts` - генерация iCalendar `.ics` + escape
- `src/hooks` - live query заметок и PWA install hook
- `src/styles` - переменные, glass-эффекты, grid фон

## Данные и backup

Данные хранятся локально в IndexedDB (Dexie), без серверов.

В Settings:
- **Экспорт JSON**: сохраняет `notes + settings + schemaVersion`
- **Импорт JSON**: с подтверждением полностью заменяет локальные данные

## iCalendar реализация

Формат `.ics`:
- `SUMMARY`: первые 60 символов заметки
- `DESCRIPTION`: полный текст
- `DTSTART`: выбранные локальные дата/время
- `DTEND`: +15 минут
- `UID`: уникальный
- `DTSTAMP`: UTC
- `VALARM`: поддержка `-PT5M/-PT10M/-PT30M/-PT1H/-P1D`

Escape спецсимволов:
- `\\` -> `\\\\`
- `;` -> `\\;`
- `,` -> `\\,`
- перенос строки -> `\\n`
- line endings: `\r\n`

## Особенности iOS

- Полноценный системный prompt `beforeinstallprompt` на iOS отсутствует.
- Поэтому в Settings есть отдельная инструкция по установке через Share menu.
- Импорт `.ics` может открываться через календарь/файлы в зависимости от настроек iOS.
