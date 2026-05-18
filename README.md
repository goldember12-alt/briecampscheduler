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

## Developer Scripts

The Node app lives in `app/` so the repository root can stay clean for camp admins.

```bash
cd app
npm run prepare-release
npm run migrate
npm run seed
npm run load:csv
npm run dev
npm test
npm run build
```

From `app/`, `npm run dev` starts the API on `http://localhost:3001` and Vite on `http://localhost:5173`.

From the repository root, camp admins should use the `.bat` files instead.

## Release Preparation

Before packaging this app for a Windows admin, run:

```bash
cd app
npm run prepare-release
```

This runs `prisma generate` and `npm run build` before the package is handed off. `LOAD-DATA.bat` expects the generated Prisma client and Windows query engine to already be present in the release package, so normal data loading does not need to download Prisma engines from `binaries.prisma.sh`.

If `LOAD-DATA.bat` prints `This app package is missing generated Prisma files`, rebuild the release package on a machine with internet access, or run:

```bash
cd app
npm run prisma:generate
```

Some managed networks, VPNs, proxies, or antivirus tools inspect HTTPS traffic with an organization certificate. In that environment, `prisma generate` may fail with `self-signed certificate in certificate chain` while downloading Prisma engines. The preferred fix is to run release preparation on an allowed network. If generation must happen on the managed network, ask IT for the organization's root certificate and set `NODE_EXTRA_CA_CERTS` to that certificate file before running `npm run prisma:generate`.

Do not use `NODE_TLS_REJECT_UNAUTHORIZED=0` or disable SSL verification.

## Notes

The local migration script creates the SQLite schema from TypeScript because the Prisma schema engine failed silently in this Windows sandbox. Prisma Client is still the ORM used by the backend, seed script, and tests.

Setup data comes from strict canonical CSV files, not arbitrary historical spreadsheets. Templates live in `data/templates`; filled files live in `data/import`.

`npm run load:csv` validates every canonical CSV before writing anything. If validation succeeds, it replaces setup data and clears existing camper/counselor assignments for the local MVP. If validation fails, it prints all row-level errors and leaves the database unchanged.

`npm run seed` remains available for demo/testing data. `npm run load:csv` is the camp-admin setup workflow.
