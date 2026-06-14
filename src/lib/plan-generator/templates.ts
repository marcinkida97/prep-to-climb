import type { InjuryOptionId } from "@/lib/injury-options";
import type { QuestionnaireResponseInput, WeeklyPlanDayInput } from "@/lib/plan-types";

interface PlanTemplateDay extends WeeklyPlanDayInput {
  exerciseInjuryConflicts?: Partial<Record<number, InjuryOptionId[]>>;
}

export interface PlanTemplate {
  id: string;
  title: string;
  gradeMatches: QuestionnaireResponseInput["climbingGrade"][];
  summary: string;
  days: PlanTemplateDay[];
}

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: "base-builder",
    title: "Base Builder",
    gradeMatches: ["5C", "6A"],
    summary:
      "A steady week that builds movement quality, pulling strength, and recovery habits for emerging intermediate climbers.",
    days: [
      {
        dayNumber: 1,
        dayLabel: "Monday",
        focusArea: "Technique",
        notes: "Keep effort moderate and prioritize precise footwork.",
        recommendedExercises: [
          { exerciseName: "Footwork circuit", sets: "4", reps: "4 boulders" },
          { exerciseName: "Easy bouldering mileage", sets: "1 session", reps: "45 min" },
        ],
      },
      {
        dayNumber: 2,
        dayLabel: "Tuesday",
        focusArea: "Strength",
        notes: "Build general pulling strength without max intensity.",
        recommendedExercises: [
          { exerciseName: "Assisted pull-ups", sets: "4", reps: "5 reps" },
          { exerciseName: "Tempo goblet squats", sets: "3", reps: "8 reps" },
        ],
        exerciseInjuryConflicts: {
          0: ["left-shoulder-strain", "right-shoulder-strain", "left-elbow-tendon", "right-elbow-tendon"],
        },
      },
      {
        dayNumber: 3,
        dayLabel: "Wednesday",
        focusArea: "Recovery",
        notes: "Keep the body moving but unload irritated tissues.",
        recommendedExercises: [
          { exerciseName: "Shoulder mobility", sets: "3", reps: "8 reps" },
          { exerciseName: "Walking", sets: "1", reps: "30 min" },
        ],
      },
      {
        dayNumber: 4,
        dayLabel: "Thursday",
        focusArea: "Finger strength",
        notes: "Use open-hand grips and avoid pain.",
        recommendedExercises: [
          { exerciseName: "Open-hand repeaters", sets: "5", reps: "7 sec" },
          { exerciseName: "Scapular pulls", sets: "3", reps: "8 reps" },
        ],
        exerciseInjuryConflicts: {
          0: ["left-fingers-pulley", "right-fingers-pulley"],
        },
      },
      {
        dayNumber: 5,
        dayLabel: "Friday",
        focusArea: "Power endurance",
        notes: "Link easy problems and stop before form breaks down.",
        recommendedExercises: [
          { exerciseName: "4x4 traverses", sets: "4", reps: "4 laps" },
          { exerciseName: "Breathing reset", sets: "3", reps: "60 sec" },
        ],
      },
      {
        dayNumber: 6,
        dayLabel: "Saturday",
        focusArea: "Climb day",
        notes: "Aim for high-quality attempts, not max difficulty.",
        recommendedExercises: [
          { exerciseName: "Route mileage", sets: "1 session", reps: "60 min" },
          { exerciseName: "Cooldown stretching", sets: "1", reps: "10 min" },
        ],
      },
      {
        dayNumber: 7,
        dayLabel: "Sunday",
        focusArea: "Rest",
        notes: "Full rest or gentle mobility only.",
        recommendedExercises: [{ exerciseName: "Thoracic rotations", sets: "2", reps: "8 reps" }],
      },
    ],
  },
  {
    id: "strength-skill",
    title: "Strength and Skill",
    gradeMatches: ["6B", "6C"],
    summary:
      "A balanced week for intermediate climbers who need structured strength, finger work, and purposeful recovery.",
    days: [
      {
        dayNumber: 1,
        dayLabel: "Monday",
        focusArea: "Limit bouldering",
        notes: "Long rests between attempts and clean movement patterns.",
        recommendedExercises: [
          { exerciseName: "Limit bouldering", sets: "1 session", reps: "75 min" },
          { exerciseName: "Scapular stability", sets: "3", reps: "10 reps" },
        ],
      },
      {
        dayNumber: 2,
        dayLabel: "Tuesday",
        focusArea: "Strength",
        notes: "Use controlled pulling volume and stop before pain.",
        recommendedExercises: [
          { exerciseName: "Weighted pull-ups", sets: "5", reps: "3 reps" },
          { exerciseName: "Rear-foot elevated split squats", sets: "3", reps: "6 reps" },
        ],
        exerciseInjuryConflicts: {
          0: ["left-shoulder-strain", "right-shoulder-strain", "left-elbow-tendon", "right-elbow-tendon"],
        },
      },
      {
        dayNumber: 3,
        dayLabel: "Wednesday",
        focusArea: "Recovery",
        notes: "Flush fatigue and reinforce easy movement.",
        recommendedExercises: [
          { exerciseName: "Band external rotations", sets: "3", reps: "12 reps" },
          { exerciseName: "Walking", sets: "1", reps: "30 min" },
        ],
      },
      {
        dayNumber: 4,
        dayLabel: "Thursday",
        focusArea: "Finger strength",
        notes: "Maintain quality grips and cut the session if any finger pain appears.",
        recommendedExercises: [
          { exerciseName: "Half-crimp repeaters", sets: "6", reps: "7 sec" },
          { exerciseName: "Core hollow holds", sets: "3", reps: "25 sec" },
        ],
        exerciseInjuryConflicts: {
          0: ["left-fingers-pulley", "right-fingers-pulley"],
        },
      },
      {
        dayNumber: 5,
        dayLabel: "Friday",
        focusArea: "Power endurance",
        notes: "Keep the pump manageable and movement sharp.",
        recommendedExercises: [
          { exerciseName: "Linked boulder circuits", sets: "4", reps: "3 circuits" },
          { exerciseName: "Breathing reset", sets: "3", reps: "60 sec" },
        ],
      },
      {
        dayNumber: 6,
        dayLabel: "Saturday",
        focusArea: "Climb day",
        notes: "Project with long rests and a clear stop rule.",
        recommendedExercises: [
          { exerciseName: "Project attempts", sets: "1 session", reps: "90 min" },
          { exerciseName: "Cooldown stretching", sets: "1", reps: "10 min" },
        ],
      },
      {
        dayNumber: 7,
        dayLabel: "Sunday",
        focusArea: "Rest",
        notes: "Use this day to absorb the work from earlier in the week.",
        recommendedExercises: [{ exerciseName: "Gentle mobility flow", sets: "1", reps: "15 min" }],
      },
    ],
  },
  {
    id: "power-performance",
    title: "Power Performance",
    gradeMatches: ["7A", "7B"],
    summary: "A higher-intensity week that alternates quality power work with finger strength and deliberate recovery.",
    days: [
      {
        dayNumber: 1,
        dayLabel: "Monday",
        focusArea: "Power",
        notes: "Few attempts, long rests, and full commitment on each effort.",
        recommendedExercises: [
          { exerciseName: "Limit bouldering", sets: "1 session", reps: "80 min" },
          { exerciseName: "Box jumps", sets: "4", reps: "4 reps" },
        ],
      },
      {
        dayNumber: 2,
        dayLabel: "Tuesday",
        focusArea: "Strength",
        notes: "Heavy pulling volume stays low and controlled.",
        recommendedExercises: [
          { exerciseName: "Weighted pull-ups", sets: "5", reps: "3 reps" },
          { exerciseName: "Front squat", sets: "4", reps: "4 reps" },
        ],
        exerciseInjuryConflicts: {
          0: ["left-shoulder-strain", "right-shoulder-strain", "left-elbow-tendon", "right-elbow-tendon"],
        },
      },
      {
        dayNumber: 3,
        dayLabel: "Wednesday",
        focusArea: "Recovery",
        notes: "Keep total load light and restore range of motion.",
        recommendedExercises: [
          { exerciseName: "Band external rotations", sets: "3", reps: "12 reps" },
          { exerciseName: "Walking", sets: "1", reps: "30 min" },
        ],
      },
      {
        dayNumber: 4,
        dayLabel: "Thursday",
        focusArea: "Finger strength",
        notes: "Prioritize quality contact strength and stop if fingers feel tweaky.",
        recommendedExercises: [
          { exerciseName: "Max hangs", sets: "6", reps: "10 sec" },
          { exerciseName: "Core tension lifts", sets: "3", reps: "6 reps" },
        ],
        exerciseInjuryConflicts: {
          0: ["left-fingers-pulley", "right-fingers-pulley"],
        },
      },
      {
        dayNumber: 5,
        dayLabel: "Friday",
        focusArea: "Capacity",
        notes: "Sustain effort without turning the day into a full project session.",
        recommendedExercises: [
          { exerciseName: "Linked boulder circuits", sets: "5", reps: "3 circuits" },
          { exerciseName: "Forearm cooldown", sets: "2", reps: "90 sec" },
        ],
      },
      {
        dayNumber: 6,
        dayLabel: "Saturday",
        focusArea: "Climb day",
        notes: "Use the best energy on your priority project or route style.",
        recommendedExercises: [
          { exerciseName: "Project attempts", sets: "1 session", reps: "100 min" },
          { exerciseName: "Cooldown stretching", sets: "1", reps: "10 min" },
        ],
      },
      {
        dayNumber: 7,
        dayLabel: "Sunday",
        focusArea: "Rest",
        notes: "Absorb the week and stay out of high-load pulling.",
        recommendedExercises: [{ exerciseName: "Gentle mobility flow", sets: "1", reps: "15 min" }],
      },
    ],
  },
];
