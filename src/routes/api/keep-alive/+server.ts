import { json, error } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

/**
 * Keep-alive ping for the free-plan Supabase project.
 *
 * Supabase pauses free projects after 7 days of low database activity. This
 * endpoint is invoked by a Vercel Cron job (see vercel.json) every ~3 days and
 * runs a tiny query so the project keeps registering activity and stays awake.
 *
 * It hits the PostgREST REST endpoint directly with the anon key instead of the
 * supabase-js client: lighter, no realtime/WebSocket init, and runs on any Node
 * version. RLS returns no rows for the anon role, but the query still executes
 * against Postgres, which is what counts as activity.
 */
export const GET: RequestHandler = async ({ request, fetch }) => {
  // If CRON_SECRET is configured, only allow calls carrying it. Vercel Cron
  // attaches it automatically as `Authorization: Bearer <CRON_SECRET>`.
  // When unset (e.g. local dev), the check is skipped.
  const cronSecret = env.CRON_SECRET;
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    throw error(401, 'Unauthorized');
  }

  const res = await fetch(`${PUBLIC_SUPABASE_URL}/rest/v1/trades?select=id&limit=1`, {
    headers: {
      apikey: PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${PUBLIC_SUPABASE_ANON_KEY}`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[keep-alive] Supabase query failed: ${res.status} ${body}`);
    throw error(502, 'Keep-alive query failed');
  }

  return json({ ok: true, ts: new Date().toISOString() });
};
