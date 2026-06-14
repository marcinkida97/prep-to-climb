import { useState } from "react";
import QuestionnaireForm from "@/components/plans/QuestionnaireForm";
import type { PlanQuestionnaireRequest } from "@/lib/plan-flow-types";
import type { PersistedCurrentPlan } from "@/lib/plan-types";

interface DashboardPlanShellProps {
  initialPlan: PersistedCurrentPlan | null;
  userEmail: string | null;
}

export default function DashboardPlanShell({ initialPlan, userEmail }: DashboardPlanShellProps) {
  const hasSavedPlan = Boolean(initialPlan);
  const [draftQuestionnaire, setDraftQuestionnaire] = useState<PlanQuestionnaireRequest["questionnaire"]>({
    climbingGrade: initialPlan?.questionnaire.climbingGrade ?? "",
    injuryLimitations: initialPlan?.questionnaire.injuryLimitations ?? [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  async function handleQuestionnaireSubmit(nextQuestionnaire: PlanQuestionnaireRequest["questionnaire"]) {
    setDraftQuestionnaire(nextQuestionnaire);
    setIsSubmitting(true);
    setSubmissionError(null);

    await new Promise((resolve) => {
      window.setTimeout(resolve, 700);
    });

    setIsSubmitting(false);
    setSubmissionError(
      "The protected generation endpoint is not wired yet. Your answers are still here, so you can retry once the route lands in the next phase.",
    );
  }

  return (
    <section className="w-full rounded-[2rem] border border-white/10 bg-white/10 p-6 text-white shadow-2xl shadow-slate-950/30 backdrop-blur-xl sm:p-8">
      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="text-sm font-medium tracking-[0.28em] text-cyan-200/75 uppercase">Protected planning space</p>
          <h1 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {hasSavedPlan ? "Your saved weekly plan is ready." : "Your first weekly plan starts with a short check-in."}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-blue-100/78">
            PrepToClimb keeps the planning flow in one protected place. This dashboard now decides whether you should
            continue from a saved plan or start from the questionnaire entry state.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm text-blue-100/70">
            <span className="rounded-full border border-white/10 bg-slate-950/30 px-3 py-1">
              Signed in as {userEmail ?? "your account"}
            </span>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1">
              {hasSavedPlan ? "Saved-plan-first state" : "Questionnaire entry state"}
            </span>
          </div>
        </div>

        <aside className="rounded-[1.5rem] border border-white/10 bg-slate-950/25 p-5">
          {hasSavedPlan && initialPlan ? (
            <SavedPlanSnapshot plan={initialPlan} />
          ) : (
            <QuestionnaireForm
              error={submissionError}
              pending={isSubmitting}
              value={draftQuestionnaire}
              onChange={setDraftQuestionnaire}
              onSubmit={handleQuestionnaireSubmit}
            />
          )}
        </aside>
      </div>
    </section>
  );
}

function SavedPlanSnapshot({ plan }: { plan: PersistedCurrentPlan }) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium tracking-[0.24em] text-fuchsia-200/75 uppercase">Returning user</p>
      <h2 className="text-2xl font-semibold text-white">Saved-plan-first state</h2>
      <p className="text-sm leading-6 text-blue-100/75">
        This account already has a persisted plan, so the dashboard starts from the saved state instead of dropping the
        user back into an empty questionnaire.
      </p>
      <dl className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-blue-50/90">
        <div className="flex items-start justify-between gap-4">
          <dt className="text-blue-100/60">Climbing grade</dt>
          <dd className="text-right font-medium text-white">{plan.questionnaire.climbingGrade}</dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="text-blue-100/60">Injury limitations</dt>
          <dd className="text-right font-medium text-white">
            {plan.questionnaire.injuryLimitations.length > 0
              ? `${plan.questionnaire.injuryLimitations.length} selected`
              : "None selected"}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="text-blue-100/60">Plan cadence</dt>
          <dd className="text-right font-medium text-white">{plan.weeklyPlan.days.length} saved days</dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="text-blue-100/60">Last generated</dt>
          <dd className="text-right font-medium text-white">{formatGeneratedAt(plan.weeklyPlan.createdAt)}</dd>
        </div>
      </dl>
      <p className="rounded-2xl border border-fuchsia-300/20 bg-fuchsia-400/10 p-4 text-sm leading-6 text-fuchsia-50/85">
        Full day-by-day rendering and regeneration controls land in the next phases. For now, the dashboard correctly
        branches into the returning-user state as soon as a saved plan exists.
      </p>
    </div>
  );
}

function formatGeneratedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Saved plan available";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
