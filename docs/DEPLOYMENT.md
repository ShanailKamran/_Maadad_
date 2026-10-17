# Production Deployment Checklist & Guide

## 1. Prerequisites

- **Compute:** Any modern Node.js container runtime or server running Node.js 20.6+ (e.g. Linux Ubuntu 22.04+, AWS ECS, Google Cloud Run, Railway, DigitalOcean App Platform).
- **Database:** PostgreSQL 15+ with the `postgis` (>= 3.3) and `pgcrypto` extensions enabled.
- **Reverse Proxy / TLS:** Nginx, Caddy, Cloudflare, or AWS ALB terminating TLS with HTTP/2 and modern cipher suites.

---

## 2. Environment Configuration Checklist

Create a secure `.env` on your production server. Reference `.env.example`:

| Variable | Requirement in Production | Notes |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables strict production security behaviors. |
| `NEXT_PUBLIC_APP_NAME` | `Kaam Lahore` (or brand name) | Publicly displayed in UI and PWA manifest. |
| `APP_URL` | `https://your-domain.com` | Base URL used for security origin checks. |
| `DATABASE_URL` | `postgres://user:pass@host:5432/dbname` | PostgreSQL connection string. |
| `DATABASE_SSL` | `true` | Enforces TLS connection to managed database. |
| `SESSION_SECRET` | 64-character random hex string | Used for HMAC signing of OTP codes and tokens. |
| `ENABLE_DEV_OTP` | `false` | Must be false in production (enforced in code). |
| `ADMIN_PHONES` | Comma-separated list of E.164 numbers | Users with these numbers become admins on login. |
| `STORAGE_DRIVER` | `local` (or S3-compatible adapter) | Private storage directory. |
| `STORAGE_LOCAL_DIR` | Dedicated encrypted volume path | Outside the web root, mode `0700`. |
| `ENABLE_IDENTITY_UPLOAD` | `false` (until S3 SSE is plugged in) | Safety gate preventing unencrypted CNIC storage. |
| `ALLOW_LOCAL_PHOTO_STORAGE_IN_PROD` | `true` (if using mounted persistent disk) | Allows local job/work photo storage. |
| `IDENTITY_RETENTION_DAYS` | `30` (or regulatory policy) | Days before reviewed documents are purged. |
| `CRON_SECRET` | 32+ character random secret | Bearer token for triggering maintenance endpoint. |
| `SUPPORT_EMAIL` | `support@your-domain.com` | Contact email for account and appeal requests. |

---

## 3. Database Preparation

1. Verify PostGIS extension is available:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   ```
2. Run database migrations:
   ```bash
   npm run migrate
   ```
3. Seed Lahore reference data (categories and 20 Lahore neighbourhoods):
   ```bash
   npm run seed
   ```
   *(Note: Do NOT set `SEED_DEMO=true` in production; the seed script automatically refuses to create fictional demo users in production).*

---

## 4. Reverse Proxy & Security Headers

The application ships with strict Security Headers in `next.config.mjs`:
- `Content-Security-Policy`: Disallows untrusted scripts, prevents frame embedding (`frame-ancestors 'none'`), disallows object embeds.
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

### Nginx Configuration Snippet
```nginx
server {
    server_name kaam.lahore.example.pk;
    listen 443 ssl http2;
    
    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/kaam.lahore/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kaam.lahore/privkey.pem;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 5. Connecting a Pakistan SMS Gateway

In `src/lib/otp/provider.ts`, implement `OtpProvider` for your chosen provider:
```typescript
class JazzSmsProvider implements OtpProvider {
  readonly name = "jazz_sms";
  async send(phoneE164: string, code: string) {
    // Call telco API via fetch using API credentials stored in process.env
    return {};
  }
}
```
Update `getOtpProvider()` to return an instance of your provider when `!devOtpEnabled()`.

---

## 6. Maintenance & Cron Automation

Schedule the maintenance runner every 15 minutes to handle job expiration, low-bid radius expansion, and document retention purges:

### Option A: System Crontab
```crontab
*/15 * * * * cd /opt/kaam-lahore && npm run maintenance >> /var/log/kaam-maintenance.log 2>&1
```

### Option B: HTTP Cron (e.g. Cloudflare Worker or AWS EventBridge)
```bash
curl -X GET "https://kaam.lahore.example.pk/api/cron/maintenance" \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
```
