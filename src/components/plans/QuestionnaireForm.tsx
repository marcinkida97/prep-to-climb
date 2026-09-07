import { AlertTriangle, ChevronDown, Dumbbell, HeartPulse } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { INJURY_OPTIONS, type InjuryOptionId } from "@/lib/injury-options";
import type { DashboardQuestionnaireValue, PlanQuestionnaireRequest } from "@/lib/plan-flow-types";
import { CLIMBING_GRADES } from "@/lib/plan-types";

interface QuestionnaireFormProps {
  error: string | null;
  pending: boolean;
  value: DashboardQuestionnaireValue["questionnaire"];
  onChange: (value: DashboardQuestionnaireValue["questionnaire"]) => void;
  onSubmit: (value: PlanQuestionnaireRequest["questionnaire"]) => Promise<void>;
}

interface FormErrors {
  climbingGrade?: string;
}

export default function QuestionnaireForm({ error, pending, value, onChange, onSubmit }: QuestionnaireFormProps) {
  const [errors, setErrors] = useState<FormErrors>({});

  function handleGradeChange(nextGrade: string) {
    onChange({
      ...value,
      climbingGrade: nextGrade,
    });

    if (errors.climbingGrade) {
      setErrors((current) => ({ ...current, climbingGrade: undefined }));
    }
  }

  function toggleInjuryOption(optionId: InjuryOptionId) {
    const isSelected = value.injuryLimitations.some((injury) => injury.id === optionId);
    // Defaults to "chronic" (at-risk area, not currently acute) until the acute/chronic toggle
    // control ships alongside the rest of the extended questionnaire fields.
    const nextInjuries = isSelected
      ? value.injuryLimitations.filter((injury) => injury.id !== optionId)
      : [...value.injuryLimitations, { id: optionId, status: "chronic" as const }];

    onChange({
      ...value,
      injuryLimitations: nextInjuries,
    });
  }

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!value.climbingGrade) {
      setErrors({
        climbingGrade: "Choose your current climbing grade before generating a plan.",
      });
      return;
    }

    // trainingAge/sessionsPerWeek/equipmentAccess/primaryGoal have no form controls yet — the
    // extended questionnaire UI ships in a later rollout phase. These placeholders keep today's
    // grade + injuries flow working against the widened questionnaire contract in the meantime.
    await onSubmit({
      climbingGrade: value.climbingGrade,
      injuryLimitations: value.injuryLimitations,
      trainingAge: value.trainingAge || "under_6_months",
      sessionsPerWeek: value.sessionsPerWeek || 3,
      equipmentAccess: value.equipmentAccess,
      primaryGoal: value.primaryGoal || "general_fitness",
    });
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      <div className="space-y-2">
        <p className="text-sm font-medium tracking-[0.24em] text-emerald-200/75 uppercase">First run</p>
        <h2 className="text-2xl font-semibold text-white">Build your first weekly plan</h2>
        <p className="text-sm leading-6 text-blue-100/75">
          Answer one training-context question and optionally flag injuries that should change the exercise choices. The
          full plan still stays on <code>/dashboard</code>.
        </p>
      </div>

      <div>
        <label htmlFor="climbing-grade" className="mb-1 block text-sm text-blue-100/80">
          Current climbing grade
        </label>
        <div className="relative">
          <span className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40">
            <Dumbbell className="size-4" />
          </span>
          <select
            id="climbing-grade"
            value={value.climbingGrade}
            onChange={(event) => {
              handleGradeChange(event.target.value);
            }}
            className={`w-full appearance-none rounded-lg border bg-white/10 py-2 pr-10 pl-10 text-white ring-2 transition-colors focus:outline-none ${
              errors.climbingGrade ? "border-red-400/60 focus:ring-red-400" : "border-white/20 focus:ring-purple-400"
            }`}
          >
            <option value="" className="text-slate-950">
              Select your current level
            </option>
            {CLIMBING_GRADES.map((grade) => (
              <option key={grade} value={grade} className="text-slate-950">
                {grade}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-white/40">
            <ChevronDown className="size-4" />
          </span>
        </div>
        {errors.climbingGrade ? <p className="mt-1 text-xs text-red-300">{errors.climbingGrade}</p> : null}
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <HeartPulse className="size-4 text-cyan-200" />
          <p className="text-sm text-blue-100/80">Injury limitations</p>
        </div>
        <p className="mb-4 text-xs leading-5 text-blue-100/60">
          These options are selected, not free-typed, so the generator and persistence layer can use the same injury
          vocabulary later in the flow.
        </p>
        <div className="grid gap-3">
          {INJURY_OPTIONS.map((option) => {
            const selected = value.injuryLimitations.some((injury) => injury.id === option.id);

            return (
              <label
                key={option.id}
                className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors ${
                  selected
                    ? "border-cyan-300/40 bg-cyan-400/10"
                    : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => {
                    toggleInjuryOption(option.id);
                  }}
                  className="mt-1 size-4 rounded border-white/20 accent-cyan-300"
                />
                <span className="block">
                  <span className="block text-sm font-medium text-white">
                    {option.bodyPart}: {option.label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-blue-100/65">{option.summary}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 text-sm leading-6 text-amber-50/90">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-200" />
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-medium text-slate-950 transition-colors hover:bg-cyan-300"
      >
        {pending ? (
          <span className="flex items-center gap-2">
            <span className="size-4 animate-spin rounded-full border-2 border-slate-950/25 border-t-slate-950" />
            Generating your weekly plan...
          </span>
        ) : (
          "Generate weekly plan"
        )}
      </Button>
    </form>
  );
}
