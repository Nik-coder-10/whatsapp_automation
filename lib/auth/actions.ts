"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin auth actions (email + password, Supabase Auth).
 * Admin rights still come from profiles.is_admin — signing in alone
 * grants nothing; the protected layout enforces the role server-side.
 */
export async function signInAdmin(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  let errorMessage: string | null = null;
  if (email !== "" && password !== "") {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    errorMessage = error ? "Invalid email or password." : null;
  } else {
    errorMessage = "Enter your email and password.";
  }
  if (errorMessage) {
    redirect(`/admin/login?error=${encodeURIComponent(errorMessage)}`);
  }
  redirect("/admin");
}

export async function signOutAdmin(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
