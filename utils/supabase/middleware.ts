import { type NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const createClient = async (request: NextRequest) => {
  // Default response (no-op) — return immediately if Supabase isn't configured
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers
    }
  });

  if (!supabaseUrl || !supabaseKey) {
    return {
      supabase: null,
      response: () => supabaseResponse
    };
  }

  // Lazy-load the Supabase SSR client to avoid importing Node-specific
  // modules at the top-level which can break the Edge runtime.
  const { createServerClient } = await import("@supabase/ssr");

  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Do not mutate `request.cookies` — the Edge `NextRequest` is immutable.
          // Apply cookies only to the outgoing response.
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        }
      }
    }
  );

  return {
    supabase,
    response: () => supabaseResponse
  };
};

export async function updateSession(request: NextRequest) {
  const { supabase, response } = await createClient(request);
  if (!supabase) return response();

  try {
    await supabase.auth.getUser();
  } catch (err) {
    // If Supabase call fails, don't break the middleware — return next()
    return response();
  }

  return response();
}
