import { describe, expect, it } from "vitest";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { createFirebaseVerifier } from "./firebase";

const PROJECT = "smashpoint-test";

async function setup() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256", use: "sig" };
  const verify = createFirebaseVerifier({ projectId: PROJECT, keys: createLocalJWKSet({ keys: [jwk] }) });
  const sign = (claims: Record<string, unknown>, opts: { iss?: string; aud?: string; exp?: string | number } = {}) =>
    new SignJWT({ auth_time: Math.floor(Date.now() / 1000) - 10, firebase: { sign_in_provider: "password" }, ...claims })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(opts.iss ?? `https://securetoken.google.com/${PROJECT}`)
      .setAudience(opts.aud ?? PROJECT)
      .setSubject("uid-123")
      .setIssuedAt()
      .setExpirationTime(opts.exp ?? "1h")
      .sign(privateKey);
  return { verify, sign };
}

describe("Firebase ID token verification", () => {
  it("accepts a valid token and normalises the identity", async () => {
    const { verify, sign } = await setup();
    const identity = await verify(await sign({ email: "Rohan@Example.com", email_verified: true, name: "Rohan" }));
    expect(identity).toEqual({ uid: "uid-123", email: "rohan@example.com", emailVerified: true, name: "Rohan", picture: null, provider: "password" });
  });

  it("rejects tokens for another project", async () => {
    const { verify, sign } = await setup();
    await expect(verify(await sign({}, { aud: "other-project" }))).rejects.toThrow(/could not be verified/);
    await expect(verify(await sign({}, { iss: "https://securetoken.google.com/other-project" }))).rejects.toThrow(/could not be verified/);
  });

  it("rejects expired and tampered tokens", async () => {
    const { verify, sign } = await setup();
    await expect(verify(await sign({}, { exp: Math.floor(Date.now() / 1000) - 60 }))).rejects.toThrow();
    const token = await sign({ email: "a@b.in" });
    const [h, , sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "admin", aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}` })).toString("base64url");
    await expect(verify(`${h}.${forged}.${sig}`)).rejects.toThrow();
  });

  it("rejects tokens signed by an unknown key", async () => {
    const { verify } = await setup();
    const other = await setup();
    await expect(verify(await other.sign({}))).rejects.toThrow();
  });

  it("treats unverified emails as unverified", async () => {
    const { verify, sign } = await setup();
    expect((await verify(await sign({ email: "x@y.in" }))).emailVerified).toBe(false);
  });
});
