const PERMISSION_BYPASS_USER_IDS = new Set<string>([
  "1213817849693478972", // Developer user ID (Aza) — ROLE_MAPPING.md §6.2
]);

export const hasPermissionBypass = (userId: string): boolean => {
  return PERMISSION_BYPASS_USER_IDS.has(userId);
};
