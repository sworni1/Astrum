/** The only places a sign in may land on: a page that needs the account. */
const ACCEPTED_RETURN_PATHS = ["/checkout", "/cart"];

/**
 * `next` is a query parameter, so anything may arrive in it. An unlisted value,
 * an absolute URL included, falls back to the home page (spec 0028, AC-15).
 */
export const acceptedReturnPath = (
  next: string | null | undefined,
): string =>
  next && ACCEPTED_RETURN_PATHS.includes(next) ? next : "/";
