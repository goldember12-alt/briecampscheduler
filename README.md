# Camp Activity Assignments

Camp admins should start with [README-FIRST.md](README-FIRST.md).

Local MVP for real-time camper activity signup and later counselor staffing.

## Stack

- React + Vite frontend
- Node.js + Express backend
- Socket.IO camper assignment updates
- Prisma ORM
- SQLite local database
- TypeScript throughout

## Scripts

```bash
npm run migrate
npm run seed
npm run load:csv
npm run dev
npm test
npm run build
```

`npm run dev` starts the API on `http://localhost:3001` and Vite on `http://localhost:5173`.

## Notes

The local migration script creates the SQLite schema from TypeScript because the Prisma schema engine failed silently in this Windows sandbox. Prisma Client is still the ORM used by the backend, seed script, and tests.

Setup data comes from strict canonical CSV files, not arbitrary historical spreadsheets. Templates live in `data/templates`; filled files live in `data/import`.

`npm run load:csv` validates every canonical CSV before writing anything. If validation succeeds, it replaces setup data and clears existing camper/counselor assignments for the local MVP. If validation fails, it prints all row-level errors and leaves the database unchanged.

`npm run seed` remains available for demo/testing data. `npm run load:csv` is the camp-admin setup workflow.
