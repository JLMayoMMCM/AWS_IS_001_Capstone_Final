// Theme constants shared by the server layout and the client ThemeProvider.
//
// The resolved theme is mirrored into a cookie so the root layout (a Server
// Component) can set the `.dark` class on <html> directly — no inline <script>
// is rendered, which React 19 / Next.js 16 disallow inside the component tree.

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/** Cookie holding the last resolved theme ("light" | "dark"), read on the server. */
export const THEME_COOKIE = "cc-theme";

/** localStorage key holding the user's explicit choice ("light" | "dark" | "system"). */
export const THEME_STORAGE_KEY = "cloudcampus-theme";
