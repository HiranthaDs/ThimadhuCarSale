# Render login cookie setup

The browser must call the API through the frontend origin. The production
frontend now requests `/api/...`; the existing backend service still exposes
`/...` on `https://thimadhucarsale.onrender.com`.

In the Render dashboard for the frontend static site
`thimadhucarsale-1.onrender.com`, add this **Rewrite** rule before the SPA
fallback (`/*` to `/index.html`):

| Source | Destination | Action |
| --- | --- | --- |
| `/api/*` | `https://thimadhucarsale.onrender.com/*` | Rewrite |

The destination must omit `/api`, because the backend routes start with
`/auth`, `/clients`, and so on. Keep the rule as a rewrite, not a redirect.
Render's [rewrite documentation](https://render.com/docs/redirects-rewrites)
describes external destinations and wildcard substitution.

Set the frontend build variable `VITE_API_URL=/api` in Render if it is present.
The production code always selects `/api`, even if an older build variable
still points at the backend domain. On the API service, use
`COOKIE_SECURE=true`, `COOKIE_SAMESITE=lax`, and keep
`https://thimadhucarsale-1.onrender.com` in `CORS_ORIGINS` for the login
Origin check. Both services need to be redeployed after changing their
settings.

Check the deployed route before asking users to sign in:

1. `https://thimadhucarsale-1.onrender.com/api/health` returns the API health
   JSON without redirecting to the backend host or returning `index.html`.
2. In the browser Network panel, the login request is sent to the frontend
   host at `/api/auth/login`, returns `200`, and sets `thimadhu_session`.
3. `/api/auth/me` on the same host returns `200` after login and still returns
   `200` after a page reload. Test in Safari, Android Chrome, and desktop.

Keep the existing frontend URL as the only link shared with users. A private
browser window is useful for testing without an older installed PWA cache.
