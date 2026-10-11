/**
 * Our Clerk instance asks for a username, which Google does not give and our forms do not ask for. Instead of sending
 * the student to Clerk's own page to type one, we make it from the e-mail (or the name) and retry if it is taken.
 * Clerk usernames: 4 to 64 characters, letters, digits, "-" and "_".
 */
export function usernameFrom(source: string | null | undefined, random: () => number = Math.random): string {
  const base = (source ?? "")
    .split("@")[0]
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // é -> e
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "")
    .slice(0, 40);
  const suffix = String(Math.floor(random() * 9000) + 1000); // 4 digits: avoids most collisions on common names
  return `${base || "student"}_${suffix}`;
}

type SignUpLike = {
  status: string | null;
  missingFields: string[];
  emailAddress: string | null;
  firstName: string | null;
  createdSessionId: string | null;
  update: (params: { username: string }) => Promise<SignUpLike>;
};

/**
 * Completes a sign-up that only misses a username. Returns the session id to activate, or null when something else is
 * missing (the caller shows an error). Retries with another suffix when the username is taken.
 */
export async function completeUsername(signUp: SignUpLike, attempts = 3): Promise<string | null> {
  let current = signUp;
  for (let i = 0; i < attempts; i++) {
    if (current.status === "complete") return current.createdSessionId;
    const missing = current.missingFields ?? [];
    if (current.status !== "missing_requirements" || missing.some((f) => f !== "username")) return null;
    try {
      current = await current.update({ username: usernameFrom(current.emailAddress ?? current.firstName) });
    } catch (err) {
      const code = (err as { errors?: { code?: string }[] })?.errors?.[0]?.code;
      if (code !== "form_identifier_exists" && code !== "form_username_invalid_character") throw err;
    }
  }
  return current.status === "complete" ? current.createdSessionId : null;
}
