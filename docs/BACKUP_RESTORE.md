# Database & Private Storage Backup and Restore

## 1. PostgreSQL + PostGIS Backup

### Automated Daily Dump
Use `pg_dump` with custom directory or compressed archive format. Custom format (`-Fc`) allows flexible multi-threaded restoration:

```bash
#!/bin/bash
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/kaam-db"
DB_NAME="kaam"
DB_USER="kaam"

mkdir -p "$BACKUP_DIR"

# Dump entire database with PostGIS geometry tables and schema
pg_dump -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -Fc -f "$BACKUP_DIR/kaam_${TIMESTAMP}.dump"

# Retain local dumps for 14 days
find "$BACKUP_DIR" -type f -name "kaam_*.dump" -mtime +14 -delete
```

### Point-In-Time Recovery (PITR)
For managed cloud databases (AWS RDS PostgreSQL, Google Cloud SQL, DigitalOcean Managed Databases), enable automated daily snapshots and 7-day minimum WAL archiving for point-in-time recovery.

---

## 2. PostgreSQL Restore Procedure

### Restoring to a Fresh Database
1. Create the database and install extensions:
   ```bash
   createdb -h 127.0.0.1 -U postgres kaam_restore
   psql -h 127.0.0.1 -U postgres -d kaam_restore -c "CREATE EXTENSION IF NOT EXISTS postgis;"
   psql -h 127.0.0.1 -U postgres -d kaam_restore -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
   ```

2. Restore from custom archive dump:
   ```bash
   pg_restore -h 127.0.0.1 -U postgres -d kaam_restore --no-owner --role=kaam -v /var/backups/kaam-db/kaam_YYYYMMDD_HHMMSS.dump
   ```

3. Run migrations to verify consistency:
   ```bash
   DATABASE_URL="postgres://kaam:password@127.0.0.1:5432/kaam_restore" npm run migrate
   ```

---

## 3. Private File Storage Backup

The `storage-private/` directory contains:
- `job-photos/`: Resized job images uploaded by customers.
- `worker-photos/`: Work samples uploaded by workers.
- `identity/`: Short-retention CNIC verification images (pending or within retention period).

### Backup Guidelines
- Encrypt storage backups at rest using AES-256 (e.g. `gpg` or encrypted cloud storage bucket).
- Never back up private identity documents to publicly readable storage.
- Synchronize to cold encrypted storage using `rclone` or cloud CLI tools:
  ```bash
  rclone sync /opt/kaam-lahore/storage-private/ remote-encrypted-backup:kaam-storage-private/
  ```

---

## 4. Disaster Recovery & Data Deletion Compliance

- **Account Deletion Sync:** When a user requests account deletion, the system wipes phone, display name, and deletes private files on disk immediately. If a backup is restored that predates a user deletion, the `deletion_requests` log in an append-only archive should be cross-referenced to re-anonymize restored rows.
- **Identity Document Shredding:** The automated maintenance cron (`npm run maintenance`) automatically purges identity documents past `IDENTITY_RETENTION_DAYS`. Backups older than the retention window should be destroyed systematically according to your data retention schedule.
