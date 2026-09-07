export const INJURY_OPTIONS = [
  {
    id: "left-shoulder-strain",
    bodyPart: "Left shoulder",
    label: "Strain or instability",
    summary: "Reduce pulling load and overhead volume.",
  },
  {
    id: "right-shoulder-strain",
    bodyPart: "Right shoulder",
    label: "Strain or instability",
    summary: "Reduce pulling load and overhead volume.",
  },
  {
    id: "left-shoulder-labral",
    bodyPart: "Left shoulder",
    label: "Labral tear or impingement",
    summary: "Avoid dynamic overhead and campus-style loading; favor controlled scapular stability work.",
  },
  {
    id: "right-shoulder-labral",
    bodyPart: "Right shoulder",
    label: "Labral tear or impingement",
    summary: "Avoid dynamic overhead and campus-style loading; favor controlled scapular stability work.",
  },
  {
    id: "left-fingers-pulley",
    bodyPart: "Left fingers",
    label: "Pulley irritation",
    summary: "Avoid hard crimping and high finger-load sessions.",
  },
  {
    id: "right-fingers-pulley",
    bodyPart: "Right fingers",
    label: "Pulley irritation",
    summary: "Avoid hard crimping and high finger-load sessions.",
  },
  {
    id: "left-fingers-trigger",
    bodyPart: "Left fingers",
    label: "Trigger finger (flexor tendon catching)",
    summary: "Avoid high-volume repetitive gripping; favor lower-intensity, varied grip positions.",
  },
  {
    id: "right-fingers-trigger",
    bodyPart: "Right fingers",
    label: "Trigger finger (flexor tendon catching)",
    summary: "Avoid high-volume repetitive gripping; favor lower-intensity, varied grip positions.",
  },
  {
    id: "left-wrist-tfcc",
    bodyPart: "Left wrist",
    label: "TFCC irritation",
    summary: "Avoid mantling and wrist-extension-loaded moves; favor neutral-wrist holds.",
  },
  {
    id: "right-wrist-tfcc",
    bodyPart: "Right wrist",
    label: "TFCC irritation",
    summary: "Avoid mantling and wrist-extension-loaded moves; favor neutral-wrist holds.",
  },
  {
    id: "left-elbow-tendon",
    bodyPart: "Left elbow",
    label: "Tendon pain",
    summary: "Limit aggressive lock-offs and campus-style loading.",
  },
  {
    id: "right-elbow-tendon",
    bodyPart: "Right elbow",
    label: "Tendon pain",
    summary: "Limit aggressive lock-offs and campus-style loading.",
  },
  {
    id: "left-elbow-lateral",
    bodyPart: "Left elbow",
    label: "Lateral tendon pain (tennis elbow)",
    summary: "Limit heavy gripping and pulling volume; favor antagonist/extensor work.",
  },
  {
    id: "right-elbow-lateral",
    bodyPart: "Right elbow",
    label: "Lateral tendon pain (tennis elbow)",
    summary: "Limit heavy gripping and pulling volume; favor antagonist/extensor work.",
  },
  {
    id: "lower-back-strain",
    bodyPart: "Lower back",
    label: "Strain or overuse ache",
    summary: "Reduce steep-overhang volume without core support; favor technique-focused sessions.",
  },
  {
    id: "left-knee-meniscus",
    bodyPart: "Left knee",
    label: "Meniscus or ligament strain",
    summary: "Avoid aggressive heel-hooking and high-ball bouldering without conditioning.",
  },
  {
    id: "right-knee-meniscus",
    bodyPart: "Right knee",
    label: "Meniscus or ligament strain",
    summary: "Avoid aggressive heel-hooking and high-ball bouldering without conditioning.",
  },
  {
    id: "left-ankle-sprain",
    bodyPart: "Left ankle",
    label: "Sprain",
    summary: "Avoid high-ball bouldering and poor-mat landings; favor stability work.",
  },
  {
    id: "right-ankle-sprain",
    bodyPart: "Right ankle",
    label: "Sprain",
    summary: "Avoid high-ball bouldering and poor-mat landings; favor stability work.",
  },
  {
    id: "skin-issue",
    bodyPart: "Skin",
    label: "Flappers, calluses, or splits",
    summary: "Reduce session volume this week; no specific exercise substitution needed.",
  },
] as const;

export type InjuryOption = (typeof INJURY_OPTIONS)[number];
export type InjuryOptionId = InjuryOption["id"];

export function isInjuryOptionId(value: string): value is InjuryOptionId {
  return INJURY_OPTIONS.some((option) => option.id === value);
}

export type InjuryStatus = "acute" | "chronic";

export function isInjuryStatus(value: string): value is InjuryStatus {
  return value === "acute" || value === "chronic";
}

export interface DeclaredInjury {
  id: InjuryOptionId;
  status: InjuryStatus;
}
