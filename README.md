# Балтик Драйв 4.0

Node.js 24 + Neon Functions/PostgreSQL, Telegram webhook и GitHub Pages.

Сайт: https://pronovichiok.github.io/my_first_app/

Полная инструкция, лимиты Free и публикация: [docs/NEON-4.md](docs/NEON-4.md).

```text
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run build
```

Учебный проект: настоящие паспорт и права не принимаются. Пароли и токены хранятся в секретах Neon и локальном .env.node, в GitHub их нет.

Текущий сервер находится в server/ и functions/. Старые версии доступны в истории GitHub. Фронтенд редактируется в public/; pages/ создаётся scripts/build-pages.py для публикации.
