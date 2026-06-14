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
] as const;

export type InjuryOption = (typeof INJURY_OPTIONS)[number];
export type InjuryOptionId = InjuryOption["id"];

export function isInjuryOptionId(value: string): value is InjuryOptionId {
  return INJURY_OPTIONS.some((option) => option.id === value);
}
