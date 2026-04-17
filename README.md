# WMS Special Ops MVP

Production-like MVP веб-приложения для внутреннего логистического учёта специальных складских операций.

## Что это
Система для учёта специальных складских акций:
- регистрация машин и заданий
- гибкая система типов акций
- роли `superadmin | admin | worker`
- частичное выполнение одной акции несколькими работниками
- история Work Sessions + Audit Log
- базовая аналитика и отчётность

## Технологии
- Frontend: React + TypeScript
- Build: Vite
- Стили: CSS Modules (+ глобальные utility-стили)
- Data: Firebase Firestore (опционально)
- Fallback: Mock mode на localStorage
- Auth для MVP: custom auth layer поверх коллекции `users` в Firestore / mock

## Важный компромисс по Auth
В MVP реализован **практичный custom auth layer** (`login + passwordHash`) через Firestore/mock.
Это сделано для простого управления внутренними логинами работников (создание/редактирование/сброс) без backend-функций.

Для production рекомендуется перейти на:
1. Firebase Authentication (email/password или SSO)
2. Cloud Functions / backend для административного user-management
3. Хранение ролей через custom claims + проверка в security rules

## Запуск
```bash
npm install
npm run dev
```

Build:
```bash
npm run build
npm run preview
```

## Переменные окружения
Скопируйте `.env.example` в `.env`.

### Mock mode (по умолчанию)
```env
VITE_DATA_MODE=mock
```

### Firebase mode
```env
VITE_DATA_MODE=firebase
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Если выбран `firebase`, но env не заполнен, приложение завершится с ошибкой и подсказкой по настройке `.env`.
Это сделано специально, чтобы избежать “тихого” запуска в `mock` в production-среде.

Опционально можно включить автосидирование Firebase:
```env
VITE_ENABLE_FIREBASE_SEED=true
```

## Seed / demo data
Seed выполняется автоматически при первом запуске репозитория (`seedIfEmpty`):
- перевозчики
- 4 типа акций
- пользователи (superadmin/admin/worker)
- задачи в разных статусах
- work sessions

Mock seed сохраняется в localStorage (`wms_mock_db_v1`).
Firebase seed выполняется только если включен `VITE_ENABLE_FIREBASE_SEED=true`.

## Тестовые логины
- `superadmin / superadmin123`
- `admin1 / admin123`
- `worker1 / worker123`
- `worker2 / worker123`
- `worker3 / worker123`

## Реализованные разделы
- LoginPage
- Dashboard (разный UX для worker и admin)
- WorkerWorkCardPage (`/worker-work-card`) — "Моя карта працы"
- ActionsPage (фильтры + создание)
- ActionDetailsPage (редактирование, work sessions, аудит)
- CompletedActionsPage
- AdminWorkCardsPage (`/work-cards`) — контроль карт работы + словарь типов работ
- VehiclesPage
- WorkersPage
- CarriersPage
- ActionTypesPage
- ReportsPage

## Модуль "Моя карта працы"
Добавлено:
- старт рабочего дня с обязательными полями:
  - фактический старт
  - планируемый конец
  - интервалы "до przyjęcia" (много интервалов)
- таймлайн дня (ручные + action-based записи)
- ручное добавление и редактирование записей (для worker только в открытом дне)
- закрытие дня с ранним предупреждением (>15 минут до планового конца)
- округление countedEnd до планового конца при завершении в пределах 15 минут
- предупреждения:
  - пересечения (блокирующие)
  - активная незакрытая активность (блокирующая)
  - пропуски > 5 минут (warning)
- серверные проверки:
  - `end > start`
  - без пересечений
  - ручные записи не раньше старта дня
  - ручные записи не выходят за границы закрытого дня
  - запрет ручных записей "в будущем" для текущего дня

Интеграция с текущим workflow акций:
- при `startActionExecution` автоматически создаётся action-entry в Work Card
- при `createWorkSession` обновляется/закрывается action-entry (время, длительность, палеты)
- при запуске новой активности предыдущая открытая auto-запись закрывается автоматически

## Бизнес-логика частичного выполнения
Реализовано:
- одна акция поддерживает много work sessions
- несколько исполнителей
- учёт `total/completed/remaining`
- защита от выполнения сверх остатка
- авто-статус:
  - `completed` при остатке `0`
  - `partial` при частичном выполнении
  - `draft` при `totalPallets = null`
- запись изменений в Audit Log

## Права
- `worker`: видит задачи, создаёт только свои work sessions
- `admin/superadmin`: CRUD акций, workers, carriers, action types, отчёты
- Route guards реализованы в роутинге

## Локализация
Реализована мультиязычность с переключением:
1. Польский (главный)
2. Русский
3. Украинский

Базовая архитектура i18n: `src/shared/i18n`.

## Структура проекта
```text
src/
  app/
    providers/
    routes/
  components/
    layout/
    ui/
  constants/
  entities/
  features/
    actions/
    auth/
    work/
  hooks/
  pages/
  services/
    firebase/
    mock/
    repositories/
    seed/
  shared/
    styles/
    utils/
  types/
```

## Что можно улучшить next
1. Полноценный переход на Firebase Auth + claims + правила безопасности Firestore.
2. Реактивные подписки (`onSnapshot`) вместо pull-загрузки.
3. Оптимистичные обновления и toast-уведомления.
4. E2E/UI тесты и unit-тесты доменной логики.
5. Экспорт отчётов в CSV/PDF.
6. Полноценный i18n (RU/PL) и таблица переводов.
7. Расширенный аудит (дифф по полям, фильтр по actor/entity/action).
