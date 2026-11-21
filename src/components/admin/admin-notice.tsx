/** The "Saved" line and the error line at the top of an admin editing page. */
export function AdminNotice({
  message,
  error,
}: {
  message: string | null;
  error: string | null;
}) {
  return (
    <>
      {message ? (
        <p
          role="status"
          className="mb-6 rounded-2xl border border-primary/40 bg-primary/15 px-4 py-3 text-brown"
        >
          {message}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mb-6 rounded-2xl border border-accent/40 bg-accent/15 px-4 py-3 text-brown"
        >
          {error}
        </p>
      ) : null}
    </>
  );
}
