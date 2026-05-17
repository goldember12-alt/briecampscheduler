# Start Here: Camp Activity Assignments

This tool helps counselors assign campers to activities during camp. It runs on one camp computer and counselors connect to it from browsers on the same local Wi-Fi/network.

You do not need to know TypeScript, Prisma, Vite, Express, Git, or npm internals to use it.

## What This Tool Does

- Loads camp setup data from strict CSV files.
- Shows schedule blocks by date.
- Lets counselors assign campers to activity offerings.
- Prevents camper double-booking, overfilled activities, and restricted activity assignments.
- Lets admins assign counselors/staff to offerings.
- Exports a CSV schedule.
- Runs locally, using a SQLite database on the camp computer.

## Which Computer Should Run It

Use one reliable Windows computer on the same Wi-Fi or local network as the counselor devices.

Keep that computer awake and plugged in during signups. Do not close the server window while counselors are using the app.

## Step 0: Install Node.js LTS Once

1. Go to https://nodejs.org/
2. Download and install the LTS version.
3. Restart the computer if Windows asks.

After downloading or cloning this repository, open this folder and run this once:

```bat
npm install
```

After that, use the `.bat` files in this folder.

## Files You Should Care About

- `README-FIRST.md`: this guide.
- `data/import`: edit these CSV files for your camp.
- `data/templates`: examples of the required CSV format.
- `CHECK-DATA.bat`: checks CSV files without changing the database.
- `LOAD-DATA.bat`: loads CSV files into the app database.
- `START-SERVER.bat`: starts the local app.
- `BACKUP-DATA.bat`: creates a database backup.
- `RESET-ASSIGNMENTS.bat`: clears assignments only.

## Folders To Ignore Unless A Developer Tells You Otherwise

Do not edit these folders unless instructed:

- `client`
- `server`
- `prisma`
- `node_modules`

## CSV Files To Edit

Edit the files in `data/import`.

Required files:

- `campers.csv`
- `counselors.csv`
- `users.csv`
- `activities.csv`
- `schedule_blocks.csv`
- `activity_offerings.csv`

Optional file:

- `camper_activity_rules.csv`

The app uses strict canonical CSVs, not arbitrary historical spreadsheets. Column names must match exactly. IDs must match across files.

Use `data/templates` as examples.

## Checking CSV Files

Double-click:

```text
CHECK-DATA.bat
```

This validates the CSV files and prints any row-level errors. It does not modify the database.

## Loading CSV Files

Double-click:

```text
LOAD-DATA.bat
```

This validates the CSV files first. If validation passes, it replaces setup data and clears existing camper/counselor assignments for this local MVP.

If validation fails, the database is not changed.

## Starting The Server

Double-click:

```text
START-SERVER.bat
```

The window will print:

- A local computer URL, such as `http://localhost:3001`
- One or more network URLs, such as `http://192.168.x.x:3001`

Counselors should use the network URL.

Keep the server window open during signups.

## Wi-Fi / Local Network Requirements

- The server computer and counselor devices must be on the same local network.
- If counselors cannot connect, check Windows Firewall and Wi-Fi isolation settings.
- Some guest Wi-Fi networks block devices from seeing each other. Use a staff/admin network if possible.

## How Counselors Connect

1. Start the server with `START-SERVER.bat`.
2. Give counselors the network URL printed in the server window.
3. Counselors open that URL in Chrome, Edge, Safari, or another browser.

## Exporting The Schedule

Open the app in the browser and go to `CSV Export`.

Click `Download Schedule CSV`.

## Backing Up Data

Double-click:

```text
BACKUP-DATA.bat
```

Backups are saved in `backups`.

Backups are local files and are not meant to be committed to GitHub.

## Resetting Assignments

Double-click:

```text
RESET-ASSIGNMENTS.bat
```

This clears only:

- camper assignments
- counselor/staff assignments

It does not delete setup data such as campers, counselors, activities, schedule blocks, offerings, users, or camper activity rules.

## Stopping The Server

Go to the server window and press:

```text
Ctrl+C
```

Then confirm if Windows asks. Closing the window also stops the app.

## Common Troubleshooting

`Node.js was not found`

Install Node.js LTS from https://nodejs.org/

`Required app packages are not installed`

Run this once in the repo folder:

```bat
npm install
```

`The local database was not found`

Run:

```text
LOAD-DATA.bat
```

`CSV validation failed`

Read the row-level errors in the window. Fix the CSV file and row listed, then run `CHECK-DATA.bat` again.

`Counselors cannot open the network URL`

Check that devices are on the same Wi-Fi, the server window is still open, and Windows Firewall is not blocking Node.js.

## What To Send The Developer If Something Breaks

Send:

- A screenshot of the error.
- The text printed in the `.bat` window.
- The CSV validation error text.
- The CSV file and row number mentioned in the error.
- What you clicked right before it happened.

Do not send private camper data unless your camp has approved sharing it.
