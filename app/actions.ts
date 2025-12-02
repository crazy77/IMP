"use server";

import { signIn } from "@/lib/auth";

export async function signInAction() {
  await signIn("google");
}

