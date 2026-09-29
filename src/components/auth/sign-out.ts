"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";

/** Ends the Firebase browser session too, then the app session (server action). */
export async function signOutEverywhere(logoutAction: () => Promise<void>) {
  try {
    const auth = await getFirebaseAuth();
    if (auth?.currentUser) {
      const { signOut } = await import("firebase/auth");
      await signOut(auth);
    }
  } catch {
    // The app session is what matters; never block sign-out on Firebase.
  }
  await logoutAction();
}
