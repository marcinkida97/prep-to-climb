import type { PersistedCurrentPlan } from "@/lib/plan-types";

interface WeeklyPlanViewProps {
  plan: PersistedCurrentPlan;
}

export default function WeeklyPlanView({ plan }: WeeklyPlanViewProps) {
  return (
    <section className="space-y-6">
      <div className="rounded-[1.75rem] border border-emerald-300/20 bg-emerald-400/10 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <p className="text-sm font-medium tracking-[0.24em] text-emerald-100/80 uppercase">Saved weekly plan</p>
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">Your current seven-day structure</h2>
            <p className="max-w-2xl text-sm leading-6 text-emerald-50/85">
              {plan.weeklyPlan.summary ??
                "Your dashboard reopens on this saved seven-day week until you explicitly regenerate it from the questionnaire."}
            </p>
          </div>
          <dl className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/25 p-4 text-sm text-blue-50/90 sm:grid-cols-2">
            <div>
              <dt className="text-blue-100/60">Climbing grade</dt>
              <dd className="mt-1 font-medium text-white">{plan.questionnaire.climbingGrade}</dd>
            </div>
            <div>
              <dt className="text-blue-100/60">Generated</dt>
              <dd className="mt-1 font-medium text-white">{formatGeneratedAt(plan.weeklyPlan.createdAt)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-blue-100/60">Injury limitations</dt>
              <dd className="mt-1 font-medium text-white">
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
          <article
            key={day.id}
            className="rounded-[1.5rem] border border-white/10 bg-slate-950/25 p-5 shadow-lg shadow-slate-950/20"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium tracking-[0.24em] text-cyan-200/75 uppercase">Day {day.dayNumber}</p>
                <h3 className="mt-2 text-xl font-semibold text-white">{day.dayLabel}</h3>
              </div>
              <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-50">
                {day.focusArea}
              </span>
            </div>

            {day.notes ? <p className="mt-4 text-sm leading-6 text-blue-100/75">{day.notes}</p> : null}

            <div className="mt-5 space-y-3">
              <p className="text-xs font-medium tracking-[0.2em] text-blue-100/60 uppercase">Recommended exercises</p>
              <ul className="space-y-3">
                {day.recommendedExercises.map((exercise) => (
                  <li key={exercise.id} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                    <p className="font-medium text-white">{exercise.exerciseName}</p>
                    <p className="mt-1 text-sm text-blue-100/70">{formatPrescription(exercise.sets, exercise.reps)}</p>
                    {exercise.notes ? (
                      <p className="mt-2 text-sm leading-6 text-blue-100/60">{exercise.notes}</p>
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
