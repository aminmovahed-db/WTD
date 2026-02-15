# Daily Kanban Desktop

Local-first personal Kanban app built with Electron, React, TypeScript, and SQLite.

## Features

- Fixed daily workflow columns: Backlog, Today, Doing, Done
- Drag and drop card movement
- Inline quick-add per column
- Edit task title and notes
- Archive/restore flow for completed tasks
- Manual JSON export and import (merge or replace)

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## macOS DMG

```bash
npm run dist:mac
```

## Tests

```bash
npm test
```

## Release Notes

### 0.1.0

- Fixed packaged macOS app blank screen by using relative renderer asset paths (`base: './'` in Vite config).
- Verified packaged app behavior with manual smoke checks (persistence, drag/drop, archive/restore, export/import, and layout stress).
