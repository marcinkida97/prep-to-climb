import { useState } from "react";
import QuestionnaireForm from "@/components/plans/QuestionnaireForm";
import WeeklyPlanView from "@/components/plans/WeeklyPlanView";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  DashboardInitialState,
  DashboardQuestionnaireValue,
  PlanDeleteResponse,
  PlanQuestionnaireRequest,
  PlanQuestionnaireResponse,
} from "@/lib/plan-flow-types";
import { createEmptyQuestionnaireDraft, type PersistedCurrentPlan } from "@/lib/plan-types";

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
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
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

  async function handleDeletePlan() {
    setIsDeleting(true);

    try {
      const response = await fetch("/api/plans/delete", {
        method: "POST",
      });

      const data: unknown = await response.json();

      if (response.ok && isPlanDeleteSuccessResponse(data)) {
        setCurrentPlan(null);
        setDraftQuestionnaire(createEmptyQuestionnaireDraft());
        setShowQuestionnaire(true);
        setRecoveryMessage(null);
        setSubmissionError(null);
        setIsDeleteDialogOpen(false);
        return;
      }

      const errorMessage = getPlanRouteErrorMessage(data);

      setSubmissionError(errorMessage);
    } catch {
      setSubmissionError("The protected plan route could not be reached. Please retry.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="border-border bg-card text-foreground w-full rounded-[2rem] border p-6 shadow-2xl sm:p-8">
      <div className="grid gap-8 md:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="text-secondary text-sm font-medium tracking-[0.28em] uppercase">Protected planning space</p>
          <h1 className="text-foreground mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            {hasSavedPlan
              ? "Your saved weekly plan is ready to train from."
              : recoveryMessage
                ? "Review your answers and rebuild your saved weekly plan."
                : "Your first weekly plan starts with a short check-in."}
          </h1>
          <p className="text-muted-foreground mt-4 max-w-2xl text-base leading-7">
            PrepToClimb keeps the questionnaire, saved week, and regenerate path on the same protected dashboard. When a
            saved plan is available, the dashboard opens there first; if recovery is needed, you can regenerate from the
            same page without leaving <code>/dashboard</code>.
          </p>
          <div className="text-muted-foreground mt-6 flex flex-wrap gap-3 text-sm">
            <span className="border-border bg-muted rounded-full border px-3 py-1">
              Signed in as {userEmail ?? "your account"}
            </span>
            <span className="border-secondary/20 bg-secondary/10 rounded-full border px-3 py-1">
              {hasSavedPlan
                ? "Saved-plan-first dashboard"
                : recoveryMessage
                  ? "Recovery fallback state"
                  : "Questionnaire entry state"}
            </span>
          </div>
        </div>

        <aside className="border-border bg-muted rounded-[1.5rem] border p-5">
          {hasSavedPlan && currentPlan && !showQuestionnaire ? (
            <SavedPlanActions
              onRegenerate={() => {
                setSubmissionError(null);
                setShowQuestionnaire(true);
              }}
              onDelete={() => {
                setSubmissionError(null);
                setIsDeleteDialogOpen(true);
              }}
              isDeleting={isDeleting}
              plan={currentPlan}
            />
          ) : (
            <div className="space-y-4">
              {recoveryMessage ? (
                <div className="border-chart-3/30 bg-chart-3/10 text-foreground rounded-2xl border p-4 text-sm leading-6">
                  <p className="text-chart-3 text-sm font-medium tracking-[0.24em] uppercase">Saved-plan recovery</p>
                  <p className="mt-2">{recoveryMessage}</p>
                </div>
              ) : null}
              {hasSavedPlan ? (
                <div className="border-accent bg-accent/40 flex items-start justify-between gap-3 rounded-2xl border p-4">
                  <div>
                    <p className="text-accent-foreground text-sm font-medium tracking-[0.24em] uppercase">Regenerate</p>
                    <p className="text-accent-foreground/85 mt-2 text-sm leading-6">
                      Adjust your grade or limitations, then submit again to replace the current saved plan.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
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
        <div className="border-border mt-8 border-t pt-8">
          <WeeklyPlanView plan={currentPlan} />
        </div>
      ) : null}

      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!isDeleting) {
            setIsDeleteDialogOpen(open);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this weekly plan?</DialogTitle>
            <DialogDescription>
              You&rsquo;ll need to answer the questionnaire again to generate a new plan. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => {
                setIsDeleteDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={() => {
                void handleDeletePlan();
              }}
            >
              Delete this weekly plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function SavedPlanActions({
  onRegenerate,
  onDelete,
  isDeleting,
  plan,
}: {
  onRegenerate: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  plan: PersistedCurrentPlan;
}) {
  return (
    <div className="space-y-4">
      <p className="text-secondary text-sm font-medium tracking-[0.24em] uppercase">Returning user</p>
      <h2 className="text-foreground text-2xl font-semibold">Saved-plan-first state</h2>
      <p className="text-muted-foreground text-sm leading-6">
        This dashboard reopens on your current saved plan first and keeps regenerate as the explicit way to replace the
        week with a new questionnaire submission.
      </p>
      <dl className="border-border bg-muted text-muted-foreground grid gap-3 rounded-2xl border p-4 text-sm">
        <div className="flex items-start justify-between gap-4">
          <dt>Climbing grade</dt>
          <dd className="text-foreground text-right font-medium">{plan.questionnaire.climbingGrade}</dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt>Injury limitations</dt>
          <dd className="text-foreground text-right font-medium">
            {plan.questionnaire.injuryLimitations.length > 0
              ? `${plan.questionnaire.injuryLimitations.length} selected`
              : "None selected"}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt>Plan cadence</dt>
          <dd className="text-foreground text-right font-medium">{plan.weeklyPlan.days.length} saved days</dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt>Last generated</dt>
          <dd className="text-foreground text-right font-medium">{formatGeneratedAt(plan.weeklyPlan.createdAt)}</dd>
        </div>
      </dl>
      <Button type="button" className="w-full rounded-xl" onClick={onRegenerate}>
        Regenerate this weekly plan
      </Button>
      <Button type="button" variant="destructive" className="w-full" disabled={isDeleting} onClick={onDelete}>
        Delete this weekly plan
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

function isPlanDeleteSuccessResponse(data: unknown): data is Extract<PlanDeleteResponse, { ok: true }> {
  if (!data || typeof data !== "object") {
    return false;
  }

  return "ok" in data && data.ok === true;
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
