// Client-safe metadata for the admin "Categories" lookup tables.
//
// This module has NO server-only imports, so both the data layer
// (lib/queries.ts) and client components can import it. The actual CRUD
// queries live in lib/queries.ts.

/**
 * Lookup tables the admin Categories page manages. The key is the URL slug;
 * the value is the real table name. This map is the ONLY source of table
 * names for the generic CRUD — keys are validated against it, so a table name
 * interpolated into SQL is always one of these literals, never user input.
 */
export const LOOKUP_TABLES = {
  courses: "courses",
  "year-levels": "year_levels",
  "resource-categories": "resource_categories",
  "project-categories": "project_categories",
  "member-statuses": "member_statuses",
  "form-providers": "form_providers",
  "officer-positions": "officer_positions",
} as const;

/** URL slug identifying a managed lookup table. */
export type LookupKey = keyof typeof LOOKUP_TABLES;

/** Lookup keys in display order. */
export const LOOKUP_KEYS = Object.keys(LOOKUP_TABLES) as LookupKey[];

/** Human-readable name for each lookup table. */
export const LOOKUP_LABELS: Record<LookupKey, string> = {
  courses: "Courses",
  "year-levels": "Year levels",
  "resource-categories": "Resource categories",
  "project-categories": "Project categories",
  "member-statuses": "Member statuses",
  "form-providers": "Form providers",
  "officer-positions": "Officer positions",
};

/** True when `value` names one of the managed lookup tables. */
export function isLookupKey(value: string): value is LookupKey {
  return value in LOOKUP_TABLES;
}

/** One row of a lookup table. */
export interface LookupRow {
  id: string;
  name: string;
}
