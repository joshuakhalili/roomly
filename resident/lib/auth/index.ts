import "server-only";
import { cookies } from "next/headers";
import { environment } from "../env";
import { demoSession } from "../demo/store";
import { hashToken } from "../demo/seed";
import { supabase } from "../supabase/server";
import type { Actor } from "../model";
export async function currentActor(): Promise<Actor | null> {
  if (environment().demo) {
    const token = (await cookies()).get("roomly_session")?.value;
    const id = token ? demoSession(hashToken(token)) : undefined;
    return id ? { id } : null;
  }
  const {
    data: { user },
  } = await (await supabase()).auth.getUser();
  return user ? { id: user.id, email: user.email } : null;
}
