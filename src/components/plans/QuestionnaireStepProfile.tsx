import { ChevronDown, Dumbbell } from "lucide-react";
import { CLIMBING_GRADES, TRAINING_AGES, type ClimbingGrade, type TrainingAge } from "@/lib/plan-types";
import type { QuestionnaireFieldErrors } from "@/lib/questionnaire-wizard-validation";

interface QuestionnaireStepProfileProps {
  climbingGrade: ClimbingGrade | "";
  trainingAge: TrainingAge | "";
  sessionsPerWeek: number | "";
  errors: Pick<QuestionnaireFieldErrors, "climbingGrade" | "trainingAge" | "sessionsPerWeek">;
  onGradeChange: (nextGrade: string) => void;
  onTrainingAgeChange: (nextTrainingAge: string) => void;
  onSessionsPerWeekChange: (nextValue: string) => void;
}

const TRAINING_AGE_LABELS: Record<TrainingAge, string> = {
  under_6_months: "Under 6 months",
  "6_24_months": "6-24 months",
  "2_plus_years": "2+ years",
};

export default function QuestionnaireStepProfile({
  climbingGrade,
  trainingAge,
  sessionsPerWeek,
  errors,
  onGradeChange,
  onTrainingAgeChange,
  onSessionsPerWeekChange,
}: QuestionnaireStepProfileProps) {
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="climbing-grade" className="text-muted-foreground mb-1 block text-sm">
          Current climbing grade
        </label>
        <div className="relative">
          <span className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2">
            <Dumbbell className="size-4" />
          </span>
          <select
            id="climbing-grade"
            value={climbingGrade}
            onChange={(event) => {
              onGradeChange(event.target.value);
            }}
            className={`bg-card text-foreground w-full appearance-none rounded-lg border py-2 pr-10 pl-10 ring-2 transition-colors focus:outline-none ${
              errors.climbingGrade ? "border-destructive focus:ring-destructive" : "border-input focus:ring-ring"
            }`}
          >
            <option value="" className="text-foreground">
              Select your current level
            </option>
            {CLIMBING_GRADES.map((grade) => (
              <option key={grade} value={grade} className="text-foreground">
                {grade}
              </option>
            ))}
          </select>
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2">
            <ChevronDown className="size-4" />
          </span>
        </div>
        {errors.climbingGrade ? <p className="text-destructive mt-1 text-xs">{errors.climbingGrade}</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="training-age" className="text-muted-foreground mb-1 block text-sm">
            Training age
          </label>
          <select
            id="training-age"
            value={trainingAge}
            onChange={(event) => {
              onTrainingAgeChange(event.target.value);
            }}
            className={`bg-card text-foreground w-full rounded-lg border px-3 py-2 ring-2 transition-colors focus:outline-none ${
              errors.trainingAge ? "border-destructive focus:ring-destructive" : "border-input focus:ring-ring"
            }`}
          >
            <option value="" className="text-foreground">
              Select training age
            </option>
            {TRAINING_AGES.map((age) => (
              <option key={age} value={age} className="text-foreground">
                {TRAINING_AGE_LABELS[age]}
              </option>
            ))}
          </select>
          {errors.trainingAge ? <p className="text-destructive mt-1 text-xs">{errors.trainingAge}</p> : null}
        </div>

        <div>
          <label htmlFor="sessions-per-week" className="text-muted-foreground mb-1 block text-sm">
            Sessions per week
          </label>
          <input
            id="sessions-per-week"
            type="number"
            min={1}
            max={7}
            value={sessionsPerWeek}
            onChange={(event) => {
              onSessionsPerWeekChange(event.target.value);
            }}
            className={`bg-card text-foreground w-full rounded-lg border px-3 py-2 ring-2 transition-colors focus:outline-none ${
              errors.sessionsPerWeek ? "border-destructive focus:ring-destructive" : "border-input focus:ring-ring"
            }`}
          />
          {errors.sessionsPerWeek ? <p className="text-destructive mt-1 text-xs">{errors.sessionsPerWeek}</p> : null}
        </div>
      </div>
    </div>
  );
}
