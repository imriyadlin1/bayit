import { safeNextPath } from "@/lib/auth/safeNext";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as
    | "signup" | "email" | "recovery" | "invite" | "magiclink" | "email_change"
    | undefined;
  const next = safeNextPath(searchParams.get("next"));

  const supabase = await createClient();
  let authenticated = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) authenticated = true;
  }

  if (!authenticated && tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) authenticated = true;
  }

  if (authenticated) {
    const successUrl = new URL(next, origin);
    successUrl.searchParams.set("confirmed", "1");
    return NextResponse.redirect(successUrl);
  }

  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", "auth");
  loginUrl.searchParams.set("next", next);
  return NextResponse.redirect(loginUrl);
}
