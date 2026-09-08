import { AlertTriangle, ChevronLeft } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import QuestionnaireStepContext from "@/components/plans/QuestionnaireStepContext";
import QuestionnaireStepInjuries from "@/components/plans/QuestionnaireStepInjuries";
import QuestionnaireStepProfile from "@/components/plans/QuestionnaireStepProfile";
import type { InjuryOptionId, InjuryStatus } from "@/lib/injury-options";
import type { DashboardQuestionnaireValue, PlanQuestionnaireRequest } from "@/lib/plan-flow-types";
import type { ClimbingGrade, EquipmentOption, PrimaryGoal, TrainingAge } from "@/lib/plan-types";
import {
  getStepErrors,
  WIZARD_STEPS,
  type QuestionnaireFieldErrors,
  type WizardStepId,
} from "@/lib/questionnaire-wizard-validation";

interface QuestionnaireFormProps {
  error: string | null;
  pending: boolean;
  value: DashboardQuestionnaireValue["questionnaire"];
  onChange: (value: DashboardQuestionnaireValue["questionnaire"]) => void;
  onSubmit: (value: PlanQuestionnaireRequest["questionnaire"]) => Promise<void>;
}

const STEP_TITLES: Record<WizardStepId, string> = {
  profile: "Climbing profile",
  context: "Training context",
  injuries: "Injuries",
};

export default function QuestionnaireForm({ error, pending, value, onChange, onSubmit }: QuestionnaireFormProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<QuestionnaireFieldErrors>({});
  const currentStep = WIZARD_STEPS[stepIndex];
  const isLastStep = stepIndex === WIZARD_STEPS.length - 1;

  function clearError(field: keyof QuestionnaireFieldErrors) {
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  }

  function handleGradeChange(nextGrade: string) {
    onChange({ ...value, climbingGrade: nextGrade as DashboardQuestionnaireValue["questionnaire"]["climbingGrade"] });
    clearError("climbingGrade");
  }

  function handleTrainingAgeChange(nextTrainingAge: string) {
    onChange({
      ...value,
      trainingAge: nextTrainingAge as DashboardQuestionnaireValue["questionnaire"]["trainingAge"],
    });
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

  function goBack() {
    setStepIndex((current) => Math.max(0, current - 1));
  }

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pending) {
      return;
    }

    const stepErrors = getStepErrors(currentStep, value);
    if (Object.keys(stepErrors).length > 0) {
      setErrors((current) => ({ ...current, ...stepErrors }));
      return;
    }

    if (!isLastStep) {
      setStepIndex((current) => current + 1);
      return;
    }

    await onSubmit({
      climbingGrade: value.climbingGrade as ClimbingGrade,
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
        <p aria-live="polite" className="pt-2 text-xs font-medium tracking-[0.18em] text-blue-100/60 uppercase">
          Step {stepIndex + 1} of {WIZARD_STEPS.length}: {STEP_TITLES[currentStep]}
        </p>
      </div>

      {currentStep === "profile" ? (
        <QuestionnaireStepProfile
          climbingGrade={value.climbingGrade}
          trainingAge={value.trainingAge}
          sessionsPerWeek={value.sessionsPerWeek}
          errors={errors}
          onGradeChange={handleGradeChange}
          onTrainingAgeChange={handleTrainingAgeChange}
          onSessionsPerWeekChange={handleSessionsPerWeekChange}
        />
      ) : null}

      {currentStep === "context" ? (
        <QuestionnaireStepContext
          primaryGoal={value.primaryGoal}
          equipmentAccess={value.equipmentAccess}
          errors={errors}
          onPrimaryGoalChange={handlePrimaryGoalChange}
          onToggleEquipment={toggleEquipmentOption}
        />
      ) : null}

      {currentStep === "injuries" ? (
        <QuestionnaireStepInjuries
          injuryLimitations={value.injuryLimitations}
          onToggleInjury={toggleInjuryOption}
          onSetInjuryStatus={setInjuryStatus}
        />
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 text-sm leading-6 text-amber-50/90">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-200" />
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        {stepIndex > 0 ? (
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={pending}
            className="rounded-xl border-white/20 bg-white/5 px-4 py-3 font-medium text-white hover:bg-white/10"
          >
            <ChevronLeft className="size-4" />
            Back
          </Button>
        ) : null}

        <Button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-xl bg-cyan-500 px-4 py-3 font-medium text-slate-950 transition-colors hover:bg-cyan-300"
        >
          {pending ? (
            <span className="flex items-center gap-2">
              <span className="size-4 animate-spin rounded-full border-2 border-slate-950/25 border-t-slate-950" />
              Generating your weekly plan...
            </span>
          ) : isLastStep ? (
            "Generate weekly plan"
          ) : (
            "Next"
          )}
        </Button>
      </div>
    </form>
  );
}
