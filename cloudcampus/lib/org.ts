// Organization profile.
//
// The live values are stored in the `site_settings` table and edited from the
// admin Content page — read them with `getOrg()` from lib/queries.ts. The
// constant below is the fallback used when the database is unreachable or the
// row is missing, and the seed for migration 0003.

export interface OrgInfo {
  name: string;
  shortName: string;
  tagline: string;
  term: string;
  about: string[];
  contact: { email: string; address: string; hours: string };
}

/** Fallback organization info — see the note above. */
export const defaultOrg: OrgInfo = {
  name: "CloudCampus",
  shortName: "CloudCampus",
  tagline: "Where the campus tech community builds together.",
  term: "AY 2025–2026",
  about: [
    "CloudCampus is the student organization for developers, designers, and " +
      "cloud enthusiasts on campus. We run hands-on workshops, hackathons, and " +
      "study groups that turn classroom theory into shippable projects.",
    "Whether you are writing your first line of code or preparing for an AWS " +
      "certification, you will find a place here — and a team that ships with you.",
  ],
  contact: {
    email: "hello@cloudcampus.example",
    address: "Innovation Hub, 2nd Floor, Tech Building",
    hours: "Mon–Fri, 9:00 AM – 5:00 PM",
  },
};

/** Past academic terms, for the officers-page term selector. */
export const pastTerms = ["AY 2024–2025", "AY 2023–2024"];
