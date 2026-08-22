/**
 * Replaces a server fault's message on the wire. The app has its own copy for the render layer;
 * `lib/trpc` cannot import the application, and one shared string is not worth a package.
 */
export const GENERIC_API_ERROR_MESSAGE = "Something went wrong. Please try again."
