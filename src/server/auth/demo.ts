import "server-only";

/** One-click demo sign-in is available on the public demo and in local development only. */
export function demoSignInEnabled() {
  return process.env.DEMO_MODE === "true" || process.env.NODE_ENV === "development";
}
