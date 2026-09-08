import type { PersistedCurrentPlan } from "@/lib/plan-types";

interface WeeklyPlanViewProps {
  plan: PersistedCurrentPlan;
}

export default function WeeklyPlanView({ plan }: WeeklyPlanViewProps) {
  return (
    <section className="space-y-6">
      <div className="border-secondary/20 bg-secondary/10 rounded-[1.75rem] border p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <p className="text-secondary text-sm font-medium tracking-[0.24em] uppercase">Saved weekly plan</p>
            <h2 className="text-foreground text-2xl font-semibold sm:text-3xl">Your current seven-day structure</h2>
            <p className="text-muted-foreground max-w-2xl text-sm leading-6">
              {plan.weeklyPlan.summary ??
                "Your dashboard reopens on this saved seven-day week until you explicitly regenerate it from the questionnaire."}
            </p>
          </div>
          <dl className="border-border bg-muted text-muted-foreground grid gap-3 rounded-2xl border p-4 text-sm sm:grid-cols-2">
            <div>
              <dt>Climbing grade</dt>
              <dd className="text-foreground mt-1 font-medium">{plan.questionnaire.climbingGrade}</dd>
            </div>
            <div>
              <dt>Generated</dt>
              <dd className="text-foreground mt-1 font-medium">{formatGeneratedAt(plan.weeklyPlan.createdAt)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt>Injury limitations</dt>
              <dd className="text-foreground mt-1 font-medium">
                {plan.questionnaire.injuryLimitations.length > 0
                  ? plan.questionnaire.injuryLimitations.map((injury) => `${injury.id} (${injury.status})`).join(", ")
                  : "None selected"}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plan.weeklyPlan.days.map((day) => (
          <article key={day.id} className="border-border bg-muted rounded-[1.5rem] border p-5 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-secondary text-xs font-medium tracking-[0.24em] uppercase">Day {day.dayNumber}</p>
                <h3 className="text-foreground mt-2 text-xl font-semibold">{day.dayLabel}</h3>
              </div>
              <span className="border-secondary/20 bg-secondary/10 text-secondary rounded-full border px-3 py-1 text-xs font-medium">
                {day.focusArea}
              </span>
            </div>

            {day.notes ? <p className="text-muted-foreground mt-4 text-sm leading-6">{day.notes}</p> : null}

            <div className="mt-5 space-y-3">
              <p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
                Recommended exercises
              </p>
              <ul className="space-y-3">
                {day.recommendedExercises.map((exercise) => (
                  <li key={exercise.id} className="border-border bg-card rounded-2xl border p-4">
                    <p className="text-foreground font-medium">{exercise.exerciseName}</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {formatPrescription(exercise.sets, exercise.reps)}
                    </p>
                    {exercise.notes ? (
                      <p className="text-muted-foreground mt-2 text-sm leading-6">{exercise.notes}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </section>
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

function formatPrescription(sets: string | null, reps: string | null) {
  if (sets && reps) {
    return `${sets} x ${reps}`;
  }

  if (sets) {
    return `Sets: ${sets}`;
  }

  if (reps) {
    return `Target: ${reps}`;
  }

  return "Prescription available in the saved plan.";
}
