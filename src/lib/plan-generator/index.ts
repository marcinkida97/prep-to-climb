import type { InjuryOptionId } from "@/lib/injury-options";
import { INJURY_RULES } from "@/lib/plan-generator/injury-rules";
import { PLAN_TEMPLATES, type PlanTemplate } from "@/lib/plan-generator/templates";
import type { QuestionnaireResponseInput, SaveCurrentPlanInput, WeeklyPlanDayInput } from "@/lib/plan-types";

export function generateWeeklyPlan(questionnaire: QuestionnaireResponseInput): SaveCurrentPlanInput["weeklyPlan"] {
  const template = selectTemplate(questionnaire.climbingGrade);
  const days = template.days.map((day) => applyInjuryRules(day, questionnaire.injuryLimitations));

  return {
    summary: buildSummary(template, questionnaire.injuryLimitations),
    days,
  };
}

function selectTemplate(climbingGrade: QuestionnaireResponseInput["climbingGrade"]): PlanTemplate {
  const matchedTemplate = PLAN_TEMPLATES.find((template) => template.gradeMatches.includes(climbingGrade));
  if (!matchedTemplate) {
    return PLAN_TEMPLATES[0];
  }

  return matchedTemplate;
}

function applyInjuryRules(day: PlanTemplate["days"][number], injuryLimitations: InjuryOptionId[]): WeeklyPlanDayInput {
  const notes = new Set<string>();
  const adjustedExercises = day.recommendedExercises.map((exercise, index) => {
    const conflictingInjuries = day.exerciseInjuryConflicts?.[index] ?? [];
    const activeInjury = conflictingInjuries.find((injury) => injuryLimitations.includes(injury));

    if (!activeInjury) {
      return exercise;
    }

    const substitution = INJURY_RULES[activeInjury].substitutions[exercise.exerciseName];
    if (!substitution) {
      return exercise;
    }

    notes.add(substitution.note);
    return substitution.replacement;
  });

  return {
    dayNumber: day.dayNumber,
    dayLabel: day.dayLabel,
    focusArea: day.focusArea,
    notes: [day.notes, ...notes].filter(Boolean).join(" "),
    recommendedExercises: adjustedExercises,
  };
}

function buildSummary(template: PlanTemplate, injuryLimitations: InjuryOptionId[]) {
  if (injuryLimitations.length === 0) {
    return template.summary;
  }

  return `${template.summary} Adjusted for ${injuryLimitations.length} declared injury limitation${injuryLimitations.length === 1 ? "" : "s"}.`;
}
