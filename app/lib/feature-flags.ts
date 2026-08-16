// Build-time public flag: set to "false" to stop post-render provider
// refreshes immediately while retaining the fast stored-data Today page.
export const backgroundSectionRefreshEnabled = process.env.NEXT_PUBLIC_BACKGROUND_SECTION_REFRESH !== "false";
