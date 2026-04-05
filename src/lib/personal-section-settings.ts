import type { PersonalActivitySection } from "@/lib/types/database";

/** נשמר ב-JSON בעמודת settings */
export type PersonalSectionSettingsPayload = {
  headline?: string;
  why?: string;
  titleLabel?: string;
  titlePlaceholder?: string;
  durationHint?: string;
  notesPlaceholder?: string;
  logButton?: string;
  emptyHint?: string;
  unitPlural?: string;
  showDuration?: boolean;
  showNotes?: boolean;
  /** ספורט: שדות מרוחק מהשעון (מרחק / דופק / קלוריות) */
  sportShowWatchFields?: boolean;
};

export type SectionCopy = {
  headline: string;
  why: string;
  titleLabel: string;
  titlePlaceholder: string;
  durationHint: string;
  notesPlaceholder: string;
  logButton: string;
  emptyHint: string;
  unitPlural: string;
};

const DEFAULT_FLAGS: Required<
  Pick<
    PersonalSectionSettingsPayload,
    "showDuration" | "showNotes" | "sportShowWatchFields"
  >
> = {
  showDuration: true,
  showNotes: true,
  sportShowWatchFields: true,
};

export function mergeSectionCopy(
  section: PersonalActivitySection,
  base: SectionCopy,
  raw: PersonalSectionSettingsPayload | null | undefined,
): SectionCopy & {
  showDuration: boolean;
  showNotes: boolean;
  sportShowWatchFields: boolean;
} {
  const s = raw || {};
  return {
    headline: s.headline?.trim() || base.headline,
    why: s.why?.trim() || base.why,
    titleLabel: s.titleLabel?.trim() || base.titleLabel,
    titlePlaceholder: s.titlePlaceholder?.trim() || base.titlePlaceholder,
    durationHint: s.durationHint?.trim() || base.durationHint,
    notesPlaceholder: s.notesPlaceholder?.trim() || base.notesPlaceholder,
    logButton: s.logButton?.trim() || base.logButton,
    emptyHint: s.emptyHint?.trim() || base.emptyHint,
    unitPlural: s.unitPlural?.trim() || base.unitPlural,
    showDuration: s.showDuration !== false,
    showNotes: s.showNotes !== false,
    sportShowWatchFields:
      section === "sport" ? s.sportShowWatchFields !== false : DEFAULT_FLAGS.sportShowWatchFields,
  };
}
