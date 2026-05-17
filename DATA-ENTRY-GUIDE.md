# Data Entry Guide

Use this guide when filling out the CSV files in `data/import`.

The app is strict on purpose. It will not guess what you meant, because guessing can put campers in the wrong activities. If something is wrong, `CHECK-DATA.bat` will tell you the file and row to fix.

## Before You Start

- Edit only the CSV files in `data/import`.
- Keep the first row exactly as it is. That row contains the column names.
- Do not rename, remove, or reorder columns.
- Use `true` or `false` only for yes/no fields.
- Use dates like `2026-06-15`.
- Use times like `09:15` or `13:30`.
- Do not use commas inside a cell unless your spreadsheet program handles CSV quoting correctly.
- Save files as CSV, not Excel `.xlsx`.
- After editing, run `CHECK-DATA.bat`.

## Recommended Order

Fill out the files in this order:

1. `campers.csv`
2. `counselors.csv`
3. `users.csv`
4. `activities.csv`
5. `schedule_blocks.csv`
6. `activity_offerings.csv`
7. `camper_activity_rules.csv`, if needed

This order matters because later files refer to IDs from earlier files.

## ID Rules

IDs are how files connect to each other. They are not shown to campers or counselors.

Good ID examples:

```text
camper_001
counselor_avery
user_admin_morgan
activity_archery
slot_2026_06_15_a1
offer_001
rule_001
```

Avoid:

```text
Alex
Activity 1
Monday 9am
001, extra note
```

Once an ID is used in another file, spelling must match exactly.

## campers.csv

Purpose: lists campers who can be assigned to activities.

Columns:

```text
camperId,name,active
```

Example:

```text
camper_001,Alex Rivera,true
camper_002,Jordan Kim,true
camper_003,Inactive Example,false
```

Field guide:

- `camperId`: unique ID for this camper.
- `name`: camper name shown in the app.
- `active`: `true` if the camper should appear in searches, `false` if not.

Common mistakes:

- Using `yes` instead of `true`.
- Reusing the same `camperId`.
- Leaving old example campers in the file by accident.

## counselors.csv

Purpose: lists staff members who can be assigned to staff activities.

Columns:

```text
counselorId,name,active
```

Example:

```text
counselor_001,Avery Johnson,true
counselor_002,Morgan Smith,true
counselor_003,Inactive Staff,false
```

Field guide:

- `counselorId`: unique ID for this staff member.
- `name`: staff name shown in the app.
- `active`: `true` if this counselor can be assigned, `false` if not.

Common mistakes:

- Confusing counselors with app users. A counselor is a staff person; a user is someone logging into or using the app.

## users.csv

Purpose: lists people who use the app.

Columns:

```text
userId,name,role
```

Allowed roles:

```text
counselor
admin
```

Example:

```text
user_001,Avery Johnson,counselor
user_002,Morgan Smith,admin
```

Field guide:

- `userId`: unique ID for this app user.
- `name`: name shown in the current-user selector.
- `role`: use `counselor` or `admin`.

Common mistakes:

- Using `staff`, `director`, or `administrator` instead of `admin`.
- Forgetting to include at least one admin user.

## activities.csv

Purpose: defines the activity types available at camp.

Columns:

```text
activityId,name,defaultCamperCapacity,defaultCounselorCapacity,active,activityFamily
```

Example:

```text
activity_archery,Archery,12,2,true,Archery
activity_horses,Horses,6,2,true,Horses
activity_high_ropes,High Ropes,10,3,true,High Ropes
```

Field guide:

- `activityId`: unique ID for this activity.
- `name`: activity name shown in the app.
- `defaultCamperCapacity`: normal camper capacity for this activity.
- `defaultCounselorCapacity`: normal staffing capacity for this activity.
- `active`: `true` if this activity is available, `false` if not.
- `activityFamily`: used for restrictions, such as `Horses`, `Canoes`, or `High Ropes`.

Common mistakes:

- Putting a blank capacity. Use `0` if the capacity is truly zero.
- Using different family names for the same thing, such as `Ropes`, `HighRopes`, and `High Ropes`. Pick one and use it consistently.

## schedule_blocks.csv

Purpose: defines the dates and time blocks when activities happen.

Columns:

```text
timeSlotId,date,label,startTime,endTime,sortOrder,displayTitle,description
```

Example:

```text
slot_2026_06_15_a1,2026-06-15,Activity 1,09:15,10:30,1,Monday Activity 1,Morning activity block
slot_2026_06_15_a2,2026-06-15,Activity 2,10:45,12:00,2,Monday Activity 2,Late morning activity block
```

Field guide:

- `timeSlotId`: unique ID for this schedule block.
- `date`: use `YYYY-MM-DD`.
- `label`: short block name, such as `Activity 1`.
- `startTime`: use 24-hour `HH:mm`.
- `endTime`: use 24-hour `HH:mm`.
- `sortOrder`: order shown on that date. Use `1`, `2`, `3`, etc.
- `displayTitle`: friendly title shown to admins and counselors.
- `description`: optional note shown on the schedule screen.

Common mistakes:

- Using `9:15` instead of `09:15`.
- Using `6/15/2026` instead of `2026-06-15`.
- Reusing the same `timeSlotId`.

## activity_offerings.csv

Purpose: defines which activities are offered during each schedule block.

Columns:

```text
offeringId,timeSlotId,activityId,camperCapacity,counselorCapacity,location,notes
```

Example:

```text
offer_001,slot_2026_06_15_a1,activity_archery,12,2,Archery Range,
offer_002,slot_2026_06_15_a1,activity_games,20,2,Pavilion,
offer_003,slot_2026_06_15_a2,activity_horses,6,2,Stables,Horses shuttle required
```

Field guide:

- `offeringId`: unique ID for this specific offering.
- `timeSlotId`: must match a `timeSlotId` in `schedule_blocks.csv`.
- `activityId`: must match an `activityId` in `activities.csv`.
- `camperCapacity`: camper spots for this specific offering.
- `counselorCapacity`: staff spots for this specific offering.
- `location`: where the activity happens.
- `notes`: optional notes for this offering.

Important:

- Camper capacity and counselor capacity are separate.
- Use the specific offering capacity here, even if it differs from the activity default.

Common mistakes:

- Typing a `timeSlotId` that does not exist.
- Typing an `activityId` that does not exist.
- Putting counselor capacity in the camper capacity column.

## camper_activity_rules.csv

Purpose: optional file for camper-specific restrictions, review flags, notes, or imported signup information.

If you do not need any camper activity rules, this file can be omitted.

Columns:

```text
ruleId,camperId,activityFamily,ruleType,rawValue,notes
```

Allowed `ruleType` values:

```text
exclude
requires_review
preassigned_or_signed_up
note
```

Example:

```text
rule_001,camper_001,Horses,exclude,NO Horses,
rule_002,camper_002,Canoes,exclude,NO Canoes,
rule_003,camper_003,High Ropes,requires_review,needs waivers,
```

Field guide:

- `ruleId`: unique ID for this rule.
- `camperId`: must match a `camperId` in `campers.csv`.
- `activityFamily`: must match an `activityFamily` in `activities.csv`.
- `ruleType`: one of the allowed values above.
- `rawValue`: original note or restriction text.
- `notes`: optional admin note.

Rule type meanings:

- `exclude`: camper cannot be assigned to that activity family.
- `requires_review`: camper is hidden from normal counselor assignment for that activity family.
- `preassigned_or_signed_up`: preserves signup information but does not automatically assign the camper.
- `note`: stores information without blocking assignment.

Common mistakes:

- Using `blocked` or `no` instead of `exclude`.
- Using `HighRopes` when `activities.csv` says `High Ropes`.
- Adding a rule for a camperId that does not exist.

## Final Checklist Before Loading

Before running `LOAD-DATA.bat`, run `CHECK-DATA.bat` and confirm:

- No validation errors appear.
- Dates are correct.
- Schedule blocks are in the right order.
- Activity offerings use the right time blocks.
- Camper capacities and counselor capacities are in the correct columns.
- Restrictions use the same activity family names as `activities.csv`.

If `CHECK-DATA.bat` finds errors, fix those first. `LOAD-DATA.bat` should only be used after the check passes.
