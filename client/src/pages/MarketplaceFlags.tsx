/**
 * Legacy alias — Session B renamed this page to `marketplace/ThemesPage`.
 * The /marketplace/flags route now redirects to /marketplace/themes via
 * App.tsx; this re-export keeps any code that imported the old path
 * working (we don't grep the codebase for old imports because the
 * redirect covers the user-facing concern; this is just defensive).
 */
export { default } from "./marketplace/ThemesPage";
