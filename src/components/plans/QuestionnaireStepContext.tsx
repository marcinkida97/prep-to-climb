import { EQUIPMENT_OPTIONS, PRIMARY_GOALS, type EquipmentOption, type PrimaryGoal } from "@/lib/plan-types";
import type { QuestionnaireFieldErrors } from "@/lib/questionnaire-wizard-validation";

interface QuestionnaireStepContextProps {
  primaryGoal: PrimaryGoal | "";
  equipmentAccess: EquipmentOption[];
  errors: Pick<QuestionnaireFieldErrors, "primaryGoal">;
  onPrimaryGoalChange: (nextGoal: string) => void;
  onToggleEquipment: (optionId: EquipmentOption) => void;
}

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

export default function QuestionnaireStepContext({
  primaryGoal,
  equipmentAccess,
  errors,
  onPrimaryGoalChange,
  onToggleEquipment,
}: QuestionnaireStepContextProps) {
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="primary-goal" className="text-muted-foreground mb-1 block text-sm">
          Primary goal
        </label>
        <select
          id="primary-goal"
          value={primaryGoal}
          onChange={(event) => {
            onPrimaryGoalChange(event.target.value);
          }}
          className={`bg-card text-foreground w-full rounded-lg border px-3 py-2 ring-2 transition-colors focus:outline-none ${
            errors.primaryGoal ? "border-destructive focus:ring-destructive" : "border-input focus:ring-ring"
          }`}
        >
          <option value="" className="text-foreground">
            Select your primary goal
          </option>
          {PRIMARY_GOALS.map((goal) => (
            <option key={goal} value={goal} className="text-foreground">
              {PRIMARY_GOAL_LABELS[goal]}
            </option>
          ))}
        </select>
        {errors.primaryGoal ? <p className="text-destructive mt-1 text-xs">{errors.primaryGoal}</p> : null}
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">Equipment access</p>
        <div className="flex flex-wrap gap-3">
          {EQUIPMENT_OPTIONS.map((equipment) => {
            const selected = equipmentAccess.includes(equipment);

            return (
              <label
                key={equipment}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                  selected
                    ? "border-secondary/40 bg-secondary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-input"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => {
                    onToggleEquipment(equipment);
                  }}
                  className="border-input accent-secondary size-4 rounded"
                />
                {EQUIPMENT_LABELS[equipment]}
              </label>
            );
          })}
        </div>
        <p className="text-muted-foreground mt-2 text-xs leading-5">
          Leave all unchecked if you only train bodyweight or outdoors.
        </p>
      </div>
    </div>
  );
}
