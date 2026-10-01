import type { MiddlewareHandler } from 'hono';

/**
 * Auth seam. v1 has no auth because the app is only reachable over the
 * tailnet. To add it later, check the request here (e.g. Tailscale identity
 * headers from `tailscale serve`, a session cookie, or basic auth) and return
 * `c.json({ error: 'Unauthorized' }, 401)` when it fails. Every /api route
 * except /api/health passes through this.
 */
export function auth(): MiddlewareHandler {
  return async (_c, next) => {
    await next();
  };
}
