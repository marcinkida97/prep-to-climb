import type { InjuryOptionId } from "@/lib/injury-options";
import type { RecommendedExerciseInput } from "@/lib/plan-types";

interface ExerciseSubstitution {
  replacement: RecommendedExerciseInput;
  note: string;
}

export interface InjuryRule {
  heading: string;
  substitutions: Partial<Record<string, ExerciseSubstitution>>;
}

export const INJURY_RULES: Record<InjuryOptionId, InjuryRule> = {
  "left-shoulder-strain": {
    heading: "Reduce aggressive shoulder loading and overhead pulling.",
    substitutions: {
      "Weighted pull-ups": {
        replacement: { exerciseName: "Scapular wall slides", sets: "3", reps: "10 reps" },
        note: "Shoulder strain substitution: replace heavy pulling with controlled scapular stability work.",
      },
      "Assisted pull-ups": {
        replacement: { exerciseName: "Scapular wall slides", sets: "3", reps: "10 reps" },
        note: "Shoulder strain substitution: replace loaded pulling with lower-risk shoulder stability work.",
      },
      "Project attempts": {
        replacement: { exerciseName: "Technique footwork drills", sets: "4", reps: "4 boulders" },
        note: "Shoulder strain substitution: trade maximal climbing for technique-focused movement.",
      },
    },
  },
  "right-shoulder-strain": {
    heading: "Reduce aggressive shoulder loading and overhead pulling.",
    substitutions: {
      "Weighted pull-ups": {
        replacement: { exerciseName: "Scapular wall slides", sets: "3", reps: "10 reps" },
        note: "Shoulder strain substitution: replace heavy pulling with controlled scapular stability work.",
      },
      "Assisted pull-ups": {
        replacement: { exerciseName: "Scapular wall slides", sets: "3", reps: "10 reps" },
        note: "Shoulder strain substitution: replace loaded pulling with lower-risk shoulder stability work.",
      },
      "Project attempts": {
        replacement: { exerciseName: "Technique footwork drills", sets: "4", reps: "4 boulders" },
        note: "Shoulder strain substitution: trade maximal climbing for technique-focused movement.",
      },
    },
  },
  "left-fingers-pulley": {
    heading: "Avoid high finger-force gripping and crimp intensity.",
    substitutions: {
      "Half-crimp repeaters": {
        replacement: { exerciseName: "Forearm extensors", sets: "3", reps: "15 reps" },
        note: "Finger pulley substitution: unload high-force finger work and reinforce the antagonist side.",
      },
      "Max hangs": {
        replacement: { exerciseName: "Forearm extensors", sets: "3", reps: "15 reps" },
        note: "Finger pulley substitution: remove max finger loading while keeping forearm support work.",
      },
      "Open-hand repeaters": {
        replacement: { exerciseName: "Grip recovery squeezes", sets: "3", reps: "12 reps" },
        note: "Finger pulley substitution: use low-load recovery grip work instead of repeaters.",
      },
    },
  },
  "right-fingers-pulley": {
    heading: "Avoid high finger-force gripping and crimp intensity.",
    substitutions: {
      "Half-crimp repeaters": {
        replacement: { exerciseName: "Forearm extensors", sets: "3", reps: "15 reps" },
        note: "Finger pulley substitution: unload high-force finger work and reinforce the antagonist side.",
      },
      "Max hangs": {
        replacement: { exerciseName: "Forearm extensors", sets: "3", reps: "15 reps" },
        note: "Finger pulley substitution: remove max finger loading while keeping forearm support work.",
      },
      "Open-hand repeaters": {
        replacement: { exerciseName: "Grip recovery squeezes", sets: "3", reps: "12 reps" },
        note: "Finger pulley substitution: use low-load recovery grip work instead of repeaters.",
      },
    },
  },
  "left-elbow-tendon": {
    heading: "Reduce heavy pulling and repeated lock-off strain.",
    substitutions: {
      "Weighted pull-ups": {
        replacement: { exerciseName: "Isometric row holds", sets: "3", reps: "20 sec" },
        note: "Elbow tendon substitution: swap heavy pull-ups for lower-load isometric pulling.",
      },
      "Assisted pull-ups": {
        replacement: { exerciseName: "Isometric row holds", sets: "3", reps: "20 sec" },
        note: "Elbow tendon substitution: reduce repeated flexion strain with controlled isometrics.",
      },
      "Limit bouldering": {
        replacement: { exerciseName: "Technique footwork drills", sets: "4", reps: "4 boulders" },
        note: "Elbow tendon substitution: replace high-tension climbing with technical movement practice.",
      },
    },
  },
  "right-elbow-tendon": {
    heading: "Reduce heavy pulling and repeated lock-off strain.",
    substitutions: {
      "Weighted pull-ups": {
        replacement: { exerciseName: "Isometric row holds", sets: "3", reps: "20 sec" },
        note: "Elbow tendon substitution: swap heavy pull-ups for lower-load isometric pulling.",
      },
      "Assisted pull-ups": {
        replacement: { exerciseName: "Isometric row holds", sets: "3", reps: "20 sec" },
        note: "Elbow tendon substitution: reduce repeated flexion strain with controlled isometrics.",
      },
      "Limit bouldering": {
        replacement: { exerciseName: "Technique footwork drills", sets: "4", reps: "4 boulders" },
        note: "Elbow tendon substitution: replace high-tension climbing with technical movement practice.",
      },
    },
  },
  // The entries below cover the injury ids added to INJURY_OPTIONS during the taxonomy
  // expansion (see research.md). None of today's PLAN_TEMPLATES reference these ids in their
  // exerciseInjuryConflicts, so no substitution ever fires for them yet — they exist only to
  // keep INJURY_RULES a total Record over InjuryOptionId. Phase 3 replaces this whole
  // template+substitution mechanism with the tagged exercise_library exclusion rules, at which
  // point this file (and these placeholders) is deleted.
  "left-shoulder-labral": { heading: "Avoid dynamic overhead and campus-style loading.", substitutions: {} },
  "right-shoulder-labral": { heading: "Avoid dynamic overhead and campus-style loading.", substitutions: {} },
  "left-fingers-trigger": { heading: "Avoid high-volume repetitive gripping.", substitutions: {} },
  "right-fingers-trigger": { heading: "Avoid high-volume repetitive gripping.", substitutions: {} },
  "left-wrist-tfcc": { heading: "Avoid mantling and wrist-extension-loaded moves.", substitutions: {} },
  "right-wrist-tfcc": { heading: "Avoid mantling and wrist-extension-loaded moves.", substitutions: {} },
  "left-elbow-lateral": { heading: "Limit heavy gripping and pulling volume.", substitutions: {} },
  "right-elbow-lateral": { heading: "Limit heavy gripping and pulling volume.", substitutions: {} },
  "lower-back-strain": { heading: "Reduce steep-overhang volume without core support.", substitutions: {} },
  "left-knee-meniscus": { heading: "Avoid aggressive heel-hooking and high-ball bouldering.", substitutions: {} },
  "right-knee-meniscus": { heading: "Avoid aggressive heel-hooking and high-ball bouldering.", substitutions: {} },
  "left-ankle-sprain": { heading: "Avoid high-ball bouldering and poor-mat landings.", substitutions: {} },
  "right-ankle-sprain": { heading: "Avoid high-ball bouldering and poor-mat landings.", substitutions: {} },
  "skin-issue": { heading: "Reduce session volume this week.", substitutions: {} },
};
