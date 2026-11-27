const ACCEPTED_RETURN_PATHS = ["/checkout", "/cart"];

export const acceptedReturnPath = (next: string | null | undefined): string =>
  next && ACCEPTED_RETURN_PATHS.includes(next) ? next : "/";
