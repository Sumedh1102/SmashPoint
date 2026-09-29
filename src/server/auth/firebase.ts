import "server-only";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { firebaseConfig } from "@/lib/firebase/config";

/** Google's public keys for Firebase Auth ID tokens (rotated by Google; cached by jose). */
const GOOGLE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

export type FirebaseIdentity = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
  /** password | google.com | … */
  provider: string;
};

export class FirebaseTokenError extends Error {}

export function createFirebaseVerifier(opts: { projectId: string; keys: JWTVerifyGetKey }) {
  return async function verify(idToken: string): Promise<FirebaseIdentity> {
    if (!opts.projectId) throw new FirebaseTokenError("Firebase is not configured.");
    let payload;
    try {
      ({ payload } = await jwtVerify(idToken, opts.keys, {
        issuer: `https://securetoken.google.com/${opts.projectId}`,
        audience: opts.projectId,
        algorithms: ["RS256"],
        clockTolerance: 5,
      }));
    } catch {
      throw new FirebaseTokenError("Your sign-in could not be verified. Please try again.");
    }
    const authTime = typeof payload.auth_time === "number" ? payload.auth_time : 0;
    if (!payload.sub || authTime > Math.floor(Date.now() / 1000) + 5) throw new FirebaseTokenError("Invalid sign-in token.");
    const firebase = (payload.firebase ?? {}) as { sign_in_provider?: string };
    return {
      uid: payload.sub,
      email: typeof payload.email === "string" ? payload.email.toLowerCase() : null,
      emailVerified: payload.email_verified === true,
      name: typeof payload.name === "string" ? payload.name : null,
      picture: typeof payload.picture === "string" ? payload.picture : null,
      provider: firebase.sign_in_provider ?? "unknown",
    };
  };
}

let verifier: ReturnType<typeof createFirebaseVerifier> | null = null;

/** Verifies a Firebase ID token against Google's keys, issuer, audience and expiry. */
export function verifyFirebaseIdToken(idToken: string) {
  verifier ??= createFirebaseVerifier({ projectId: firebaseConfig.projectId, keys: createRemoteJWKSet(new URL(GOOGLE_JWKS_URL)) });
  return verifier(idToken);
}
