import { useState } from "react";
import QuestionnaireForm from "@/components/plans/QuestionnaireForm";
import WeeklyPlanView from "@/components/plans/WeeklyPlanView";
import { Button } from "@/components/ui/button";
import type {
  DashboardInitialState,
  DashboardQuestionnaireValue,
  PlanQuestionnaireRequest,
  PlanQuestionnaireResponse,
} from "@/lib/plan-flow-types";
import type { PersistedCurrentPlan } from "@/lib/plan-types";

interface DashboardPlanShellProps {
  initialState: DashboardInitialState;
  userEmail: string | null;
}

export default function DashboardPlanShell({ initialState, userEmail }: DashboardPlanShellProps) {
  const initialPlan = initialState.mode === "saved-plan" ? initialState.plan : null;
  const [currentPlan, setCurrentPlan] = useState(initialPlan);
  const hasSavedPlan = Boolean(currentPlan);
  const [showQuestionnaire, setShowQuestionnaire] = useState(initialState.mode !== "saved-plan");
  const [draftQuestionnaire, setDraftQuestionnaire] = useState<DashboardQuestionnaireValue["questionnaire"]>(
    initialState.draftQuestionnaire,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [recoveryMessage, setRecoveryMessage] = useState(
    initialState.mode === "recovery" ? initialState.recoveryMessage : null,
  );

  async function handleQuestionnaireSubmit(nextQuestionnaire: PlanQuestionnaireRequest["questionnaire"]) {
    setDraftQuestionnaire(nextQuestionnaire);
    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const response = await fetch("/api/plans/generate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          questionnaire: nextQuestionnaire,
        } satisfies PlanQuestionnaireRequest),
      });

      const data: unknown = await response.json();

      if (response.ok && isPlanQuestionnaireSuccessResponse(data)) {
        setCurrentPlan(data.plan);
        setDraftQuestionnaire(data.plan.questionnaire);
        setShowQuestionnaire(false);
        setRecoveryMessage(null);
        return;
      }

      const errorMessage = getPlanRouteErrorMessage(data);

      setSubmissionError(errorMessage);
    } catch {
      setSubmissionError("The protected plan route could not be reached. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="w-full rounded-[2rem] border border-white/10 bg-white/10 p-6 text-white shadow-2xl shadow-slate-950/30 backdrop-blur-xl sm:p-8">
      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="text-sm font-medium tracking-[0.28em] text-cyan-200/75 uppercase">Protected planning space</p>
          <h1 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {hasSavedPlan
              ? "Your saved weekly plan is ready to train from."
              : recoveryMessage
                ? "Review your answers and rebuild your saved weekly plan."
                : "Your first weekly plan starts with a short check-in."}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-blue-100/78">
            PrepToClimb keeps the questionnaire, saved week, and regenerate path on the same protected dashboard. When a
            saved plan is available, the dashboard opens there first; if recovery is needed, you can regenerate from the
            same page without leaving <code>/dashboard</code>.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm text-blue-100/70">
            <span className="rounded-full border border-white/10 bg-slate-950/30 px-3 py-1">
              Signed in as {userEmail ?? "your account"}
            </span>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1">
              {hasSavedPlan
                ? "Saved-plan-first dashboard"
                : recoveryMessage
                  ? "Recovery fallback state"
                  : "Questionnaire entry state"}
            </span>
          </div>
        </div>

        <aside className="rounded-[1.5rem] border border-white/10 bg-slate-950/25 p-5">
          {hasSavedPlan && currentPlan && !showQuestionnaire ? (
            <SavedPlanActions
              onRegenerate={() => {
                setSubmissionError(null);
                setShowQuestionnaire(true);
              }}
              plan={currentPlan}
            />
          ) : (
            <div className="space-y-4">
              {recoveryMessage ? (
                <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 text-sm leading-6 text-amber-50/90">
                  <p className="text-sm font-medium tracking-[0.24em] text-amber-100/80 uppercase">
                    Saved-plan recovery
                  </p>
                  <p className="mt-2">{recoveryMessage}</p>
                </div>
              ) : null}
              {hasSavedPlan ? (
                <div className="flex items-start justify-between gap-3 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-400/10 p-4">
                  <div>
                    <p className="text-sm font-medium tracking-[0.24em] text-fuchsia-100/80 uppercase">Regenerate</p>
                    <p className="mt-2 text-sm leading-6 text-fuchsia-50/85">
                      Adjust your grade or limitations, then submit again to replace the current saved plan.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="border border-white/15 text-white hover:bg-white/10 hover:text-white"
                    onClick={() => {
                      setShowQuestionnaire(false);
                      setSubmissionError(null);
                    }}
                  >
                    Back to saved plan
                  </Button>
                </div>
              ) : null}
              <QuestionnaireForm
                error={submissionError}
                pending={isSubmitting}
                value={draftQuestionnaire}
                onChange={setDraftQuestionnaire}
                onSubmit={handleQuestionnaireSubmit}
              />
            </div>
          )}
        </aside>
      </div>

      {hasSavedPlan && currentPlan ? (
        <div className="mt-8 border-t border-white/10 pt-8">
          <WeeklyPlanView plan={currentPlan} />
        </div>
      ) : null}
    </section>
  );
}

function SavedPlanActions({ onRegenerate, plan }: { onRegenerate: () => void; plan: PersistedCurrentPlan }) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium tracking-[0.24em] text-fuchsia-200/75 uppercase">Returning user</p>
      <h2 className="text-2xl font-semibold text-white">Saved-plan-first state</h2>
      <p className="text-sm leading-6 text-blue-100/75">
        This dashboard reopens on your current saved plan first and keeps regenerate as the explicit way to replace the
        week with a new questionnaire submission.
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
      <Button
        type="button"
        className="w-full rounded-xl bg-fuchsia-300 px-4 py-3 font-medium text-slate-950 transition-colors hover:bg-fuchsia-200"
        onClick={onRegenerate}
      >
        Regenerate this weekly plan
      </Button>
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

function isPlanQuestionnaireSuccessResponse(data: unknown): data is Extract<PlanQuestionnaireResponse, { ok: true }> {
  if (!data || typeof data !== "object") {
    return false;
  }

  return "ok" in data && data.ok === true && "plan" in data;
}

function getPlanRouteErrorMessage(data: unknown) {
  if (data && typeof data === "object" && "ok" in data && data.ok === false && "error" in data) {
    return typeof data.error === "string" ? data.error : "The protected plan route returned an invalid error payload.";
  }

  if (data && typeof data === "object" && "error" in data) {
    return typeof data.error === "string" ? data.error : "The protected plan route returned an invalid error payload.";
  }

  return "The protected plan route returned an unexpected response.";
}
