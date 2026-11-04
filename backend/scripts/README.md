This folder is split by purpose:

- `migrations/`: database schema or data backfill scripts that may be needed when setting up or upgrading the project.
- `manual/`: one-off operational helpers that are not part of the backend runtime.

Current scripts:

- `manual/create-admin-user.js`: create a default admin user in the database.
- `migrations/add-date-limite-column.js`: add `date_limite` to `objectiv` and `realise`.
- `migrations/add-description-column.js`: add `Description` to `Indicateur`.
- `migrations/create-indicator-assignments-table.js`: create and backfill `indicator_assignments`.
- `migrations/create-notifications-tables.js`: create notification-related tables.
- `migrations/create-objective-deadlines-table.js`: create `objective_deadlines`.
- `migrations/create-permissions-table.js`: create `user_permissions`.
