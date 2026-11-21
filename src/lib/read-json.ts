/**
 * A reply's body as JSON, or null when the server sent something else.
 *
 * A crashed request comes back as an empty body or a plain "Internal Server
 * Error". `res.json()` throws on those, and the member sees "Unexpected end
 * of JSON input" in place of anything they can act on. Callers check for
 * null and show their own message.
 */
export async function readJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
