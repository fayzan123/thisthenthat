import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Persistent rate limiter backed by Supabase.
 * Survives serverless cold starts and redeploys.
 */
export async function rateLimit(
  supabase: SupabaseClient,
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const windowStart = new Date(Date.now() - windowMs).toISOString();

  // Count recent requests within the window
  const { count, error: countError } = await supabase
    .from("rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("key", key)
    .gte("timestamp", windowStart);

  if (countError) {
    // If rate limit check fails, allow the request (fail open)
    console.error("Rate limit check failed:", countError);
    return { allowed: true, retryAfterMs: 0 };
  }

  if ((count ?? 0) >= limit) {
    // Find the oldest entry in the window to calculate retry time
    const { data: oldest } = await supabase
      .from("rate_limits")
      .select("timestamp")
      .eq("key", key)
      .gte("timestamp", windowStart)
      .order("timestamp", { ascending: true })
      .limit(1)
      .single();

    const retryAfterMs = oldest
      ? windowMs - (Date.now() - new Date(oldest.timestamp).getTime())
      : windowMs;

    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) };
  }

  // Record this request
  await supabase.from("rate_limits").insert({ key });

  return { allowed: true, retryAfterMs: 0 };
}
