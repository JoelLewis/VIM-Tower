// Prerender /play as an empty client-rendered shell (build/play.html).
// The stage comes from the query string, which only exists in the browser.
// A real play.html means static hosts serve this page for /play instead of
// falling back to the menu's index.html.
export const prerender = true;
export const ssr = false;
