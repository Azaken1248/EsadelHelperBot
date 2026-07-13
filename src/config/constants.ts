// Structural roles (ROLE_MAPPING.md §4 / §6.1).
// Replace these placeholders with the real Esadel server role IDs, or override
// them at runtime via the ROLE_*_ID environment variables (see env.ts).
export const DEFAULT_ROLE_IDS = {
  owners: "REPLACE_WITH_ESADEL_OWNER_ROLE_ID",
  mods: "REPLACE_WITH_ESADEL_MOD_ROLE_ID",
  crew: "REPLACE_WITH_ESADEL_CREW_ROLE_ID",
} as const;

// Specialized roles (ROLE_MAPPING.md §5 / §6.1).
// Intentionally empty: Esadel's specialized roles are added here as their server
// role IDs are retrieved. Adding a key automatically enables an env override of
// the form ROLE_<UPPER_SNAKE>_ID (see buildSpecializedRoleConfig in env.ts) and a
// matching label below.
//
// Example:
//   artist: "1360465893573922907",
export const DEFAULT_SPECIALIZED_ROLE_IDS = {
  // artist: "ROLE_ID",
} as const;

export type SpecializedRoleKey = keyof typeof DEFAULT_SPECIALIZED_ROLE_IDS;

export const SPECIALIZED_ROLE_LABELS: Readonly<Record<SpecializedRoleKey, string>> = {
  // artist: "Artist",
};
