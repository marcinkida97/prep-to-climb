import { AlertTriangle, ChevronDown, Dumbbell, HeartPulse } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { INJURY_OPTIONS, type InjuryOptionId, type InjuryStatus } from "@/lib/injury-options";
import type { DashboardQuestionnaireValue, PlanQuestionnaireRequest } from "@/lib/plan-flow-types";
import {
  CLIMBING_GRADES,
  EQUIPMENT_OPTIONS,
  PRIMARY_GOALS,
  TRAINING_AGES,
  type EquipmentOption,
  type PrimaryGoal,
  type TrainingAge,
} from "@/lib/plan-types";

interface QuestionnaireFormProps {
  error: string | null;
  pending: boolean;
  value: DashboardQuestionnaireValue["questionnaire"];
  onChange: (value: DashboardQuestionnaireValue["questionnaire"]) => void;
  onSubmit: (value: PlanQuestionnaireRequest["questionnaire"]) => Promise<void>;
}

interface FormErrors {
  climbingGrade?: string;
  trainingAge?: string;
  sessionsPerWeek?: string;
  primaryGoal?: string;
}

const TRAINING_AGE_LABELS: Record<TrainingAge, string> = {
  under_6_months: "Under 6 months",
  "6_24_months": "6-24 months",
  "2_plus_years": "2+ years",
};

const EQUIPMENT_LABELS: Record<EquipmentOption, string> = {
  hangboard: "Hangboard",
  campus_board: "Campus board",
  gym: "Climbing gym",
};

const PRIMARY_GOAL_LABELS: Record<PrimaryGoal, string> = {
  send_grade: "Send a specific grade",
  endurance: "Endurance / multi-pitch",
  power: "Bouldering power",
  general_fitness: "General fitness",
  return_from_injury: "Return from injury",
};

export default function QuestionnaireForm({ error, pending, value, onChange, onSubmit }: QuestionnaireFormProps) {
  const [errors, setErrors] = useState<FormErrors>({});

  function clearError(field: keyof FormErrors) {
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  }

  function handleGradeChange(nextGrade: string) {
    onChange({ ...value, climbingGrade: nextGrade });
    clearError("climbingGrade");
  }

  function handleTrainingAgeChange(nextTrainingAge: string) {
    onChange({ ...value, trainingAge: nextTrainingAge as DashboardQuestionnaireValue["questionnaire"]["trainingAge"] });
    clearError("trainingAge");
  }

  function handleSessionsPerWeekChange(nextValue: string) {
    onChange({ ...value, sessionsPerWeek: nextValue === "" ? "" : Number(nextValue) });
    clearError("sessionsPerWeek");
  }

  function handlePrimaryGoalChange(nextGoal: string) {
    onChange({ ...value, primaryGoal: nextGoal as DashboardQuestionnaireValue["questionnaire"]["primaryGoal"] });
    clearError("primaryGoal");
  }

  function toggleEquipmentOption(optionId: EquipmentOption) {
    const nextEquipment = value.equipmentAccess.includes(optionId)
      ? value.equipmentAccess.filter((equipment) => equipment !== optionId)
      : [...value.equipmentAccess, optionId];

    onChange({ ...value, equipmentAccess: nextEquipment });
  }

  function toggleInjuryOption(optionId: InjuryOptionId) {
    const isSelected = value.injuryLimitations.some((injury) => injury.id === optionId);
    const nextInjuries = isSelected
      ? value.injuryLimitations.filter((injury) => injury.id !== optionId)
      : [...value.injuryLimitations, { id: optionId, status: "chronic" as const }];

    onChange({ ...value, injuryLimitations: nextInjuries });
  }

  function setInjuryStatus(optionId: InjuryOptionId, status: InjuryStatus) {
    onChange({
      ...value,
      injuryLimitations: value.injuryLimitations.map((injury) =>
        injury.id === optionId ? { ...injury, status } : injury,
      ),
    });
  }

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: FormErrors = {};
    if (!value.climbingGrade) {
      nextErrors.climbingGrade = "Choose your current climbing grade before generating a plan.";
    }
    if (!value.trainingAge) {
      nextErrors.trainingAge = "Choose how long you've been training before generating a plan.";
    }
    if (value.sessionsPerWeek === "" || value.sessionsPerWeek < 1 || value.sessionsPerWeek > 7) {
      nextErrors.sessionsPerWeek = "Choose how many sessions per week you can train (1-7).";
    }
    if (!value.primaryGoal) {
      nextErrors.primaryGoal = "Choose your primary training goal before generating a plan.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    await onSubmit({
      climbingGrade: value.climbingGrade as (typeof CLIMBING_GRADES)[number],
      injuryLimitations: value.injuryLimitations,
      trainingAge: value.trainingAge as TrainingAge,
      sessionsPerWeek: value.sessionsPerWeek as number,
      equipmentAccess: value.equipmentAccess,
      primaryGoal: value.primaryGoal as PrimaryGoal,
    });
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      <div className="space-y-2">
        <p className="text-sm font-medium tracking-[0.24em] text-emerald-200/75 uppercase">First run</p>
        <h2 className="text-2xl font-semibold text-white">Build your first weekly plan</h2>
        <p className="text-sm leading-6 text-blue-100/75">
          Answer a few training-context questions and flag any injuries that should change the exercise choices. The
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="training-age" className="mb-1 block text-sm text-blue-100/80">
            Training age
          </label>
          <select
            id="training-age"
            value={value.trainingAge}
            onChange={(event) => {
              handleTrainingAgeChange(event.target.value);
            }}
            className={`w-full rounded-lg border bg-white/10 px-3 py-2 text-white ring-2 transition-colors focus:outline-none ${
              errors.trainingAge ? "border-red-400/60 focus:ring-red-400" : "border-white/20 focus:ring-purple-400"
            }`}
          >
            <option value="" className="text-slate-950">
              Select training age
            </option>
            {TRAINING_AGES.map((trainingAge) => (
              <option key={trainingAge} value={trainingAge} className="text-slate-950">
                {TRAINING_AGE_LABELS[trainingAge]}
              </option>
            ))}
          </select>
          {errors.trainingAge ? <p className="mt-1 text-xs text-red-300">{errors.trainingAge}</p> : null}
        </div>

        <div>
          <label htmlFor="sessions-per-week" className="mb-1 block text-sm text-blue-100/80">
            Sessions per week
          </label>
          <input
            id="sessions-per-week"
            type="number"
            min={1}
            max={7}
            value={value.sessionsPerWeek}
            onChange={(event) => {
              handleSessionsPerWeekChange(event.target.value);
            }}
            className={`w-full rounded-lg border bg-white/10 px-3 py-2 text-white ring-2 transition-colors focus:outline-none ${
              errors.sessionsPerWeek ? "border-red-400/60 focus:ring-red-400" : "border-white/20 focus:ring-purple-400"
            }`}
          />
          {errors.sessionsPerWeek ? <p className="mt-1 text-xs text-red-300">{errors.sessionsPerWeek}</p> : null}
        </div>
      </div>

      <div>
        <label htmlFor="primary-goal" className="mb-1 block text-sm text-blue-100/80">
          Primary goal
        </label>
        <select
          id="primary-goal"
          value={value.primaryGoal}
          onChange={(event) => {
            handlePrimaryGoalChange(event.target.value);
          }}
          className={`w-full rounded-lg border bg-white/10 px-3 py-2 text-white ring-2 transition-colors focus:outline-none ${
            errors.primaryGoal ? "border-red-400/60 focus:ring-red-400" : "border-white/20 focus:ring-purple-400"
          }`}
        >
          <option value="" className="text-slate-950">
            Select your primary goal
          </option>
          {PRIMARY_GOALS.map((goal) => (
            <option key={goal} value={goal} className="text-slate-950">
              {PRIMARY_GOAL_LABELS[goal]}
            </option>
          ))}
        </select>
        {errors.primaryGoal ? <p className="mt-1 text-xs text-red-300">{errors.primaryGoal}</p> : null}
      </div>

      <div>
        <p className="mb-2 text-sm text-blue-100/80">Equipment access</p>
        <div className="flex flex-wrap gap-3">
          {EQUIPMENT_OPTIONS.map((equipment) => {
            const selected = value.equipmentAccess.includes(equipment);

            return (
              <label
                key={equipment}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                  selected
                    ? "border-cyan-300/40 bg-cyan-400/10 text-white"
                    : "border-white/10 bg-white/5 text-blue-100/80 hover:border-white/20"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => {
                    toggleEquipmentOption(equipment);
                  }}
                  className="size-4 rounded border-white/20 accent-cyan-300"
                />
                {EQUIPMENT_LABELS[equipment]}
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-xs leading-5 text-blue-100/60">
          Leave all unchecked if you only train bodyweight or outdoors.
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <HeartPulse className="size-4 text-cyan-200" />
          <p className="text-sm text-blue-100/80">Injury limitations</p>
        </div>
        <p className="mb-4 text-xs leading-5 text-blue-100/60">
          These options are selected, not free-typed, so the generator and persistence layer can use the same injury
          vocabulary later in the flow. Mark a declared injury &ldquo;acute&rdquo; only if it&rsquo;s currently active
          and undiagnosed — acute injuries get conservative guidance instead of specific substitutions.
        </p>
        <div className="grid gap-3">
          {INJURY_OPTIONS.map((option) => {
            const declared = value.injuryLimitations.find((injury) => injury.id === option.id);
            const selected = Boolean(declared);

            return (
              <div
                key={option.id}
                className={`flex flex-col gap-3 rounded-2xl border p-4 transition-colors sm:flex-row sm:items-start sm:justify-between ${
                  selected
                    ? "border-cyan-300/40 bg-cyan-400/10"
                    : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8"
                }`}
              >
                <label className="flex flex-1 cursor-pointer gap-3">
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
                {declared ? (
                  <div className="flex shrink-0 gap-1 self-start rounded-lg border border-white/10 bg-slate-950/30 p-1 text-xs">
                    {(["acute", "chronic"] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => {
                          setInjuryStatus(option.id, status);
                        }}
                        className={`rounded-md px-2 py-1 capitalize transition-colors ${
                          declared.status === status ? "bg-cyan-400/30 text-white" : "text-blue-100/60 hover:text-white"
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
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
