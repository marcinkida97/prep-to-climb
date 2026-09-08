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
        <label htmlFor="primary-goal" className="mb-1 block text-sm text-blue-100/80">
          Primary goal
        </label>
        <select
          id="primary-goal"
          value={primaryGoal}
          onChange={(event) => {
            onPrimaryGoalChange(event.target.value);
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
            const selected = equipmentAccess.includes(equipment);

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
                    onToggleEquipment(equipment);
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
    </div>
  );
}
