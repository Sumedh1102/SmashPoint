"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, getAuth, setPersistence, type Auth } from "firebase/auth";
import { firebaseConfig, isFirebaseConfigured } from "./config";

let auth: Auth | null = null;

/** Lazily initialised Firebase Auth (browser only). Null when Firebase isn't configured. */
export async function getFirebaseAuth(): Promise<Auth | null> {
  if (!isFirebaseConfigured) return null;
  if (auth) return auth;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  await setPersistence(auth, browserLocalPersistence);
  return auth;
}
