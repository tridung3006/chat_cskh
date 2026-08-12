# Security deployment checklist

Before deploying this version:

1. Revoke any DeepSeek API key that has been shared outside the server and create a new key.
2. Generate independent random values of at least 32 bytes for `ADMIN_TOKEN` and `SETTINGS_ENCRYPTION_KEY`.
3. Keep `.env` only on the server with owner-only file permissions.
4. Set `NODE_ENV=production` and configure `TRUST_PROXY=true` only behind a trusted reverse proxy.
5. Optionally set `ADMIN_ALLOWED_IPS` to a comma-separated list after verifying the proxy/client IP configuration.
6. Require reviews and status checks for the GitHub `main` branch and approvals for the `production` environment.
7. Apply an edge/WAF rate limit to `/api/chat` and a stricter rule to `/api/admin/*`.

Relevant environment variables:

```env
CHAT_RATE_LIMIT=15
ADMIN_RATE_LIMIT=10
ADMIN_ALLOWED_IPS=
SETTINGS_ENCRYPTION_KEY=use_a_random_secret_different_from_admin_token
```

The first startup with a separate `SETTINGS_ENCRYPTION_KEY` automatically migrates legacy settings encrypted with `ADMIN_TOKEN`. Back up the persistent `data` directory before rotating either secret.
