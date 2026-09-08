import { HeartPulse } from "lucide-react";
import { INJURY_OPTIONS, type DeclaredInjury, type InjuryOptionId, type InjuryStatus } from "@/lib/injury-options";

interface QuestionnaireStepInjuriesProps {
  injuryLimitations: DeclaredInjury[];
  onToggleInjury: (optionId: InjuryOptionId) => void;
  onSetInjuryStatus: (optionId: InjuryOptionId, status: InjuryStatus) => void;
}

export default function QuestionnaireStepInjuries({
  injuryLimitations,
  onToggleInjury,
  onSetInjuryStatus,
}: QuestionnaireStepInjuriesProps) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <HeartPulse className="size-4 text-cyan-200" />
        <p className="text-sm text-blue-100/80">Injury limitations</p>
      </div>
      <p className="mb-4 text-xs leading-5 text-blue-100/60">
        These options are selected, not free-typed, so the generator and persistence layer can use the same injury
        vocabulary later in the flow. Mark a declared injury &ldquo;acute&rdquo; only if it&rsquo;s currently active and
        undiagnosed — acute injuries get conservative guidance instead of specific substitutions.
      </p>
      <div className="grid gap-3">
        {INJURY_OPTIONS.map((option) => {
          const declared = injuryLimitations.find((injury) => injury.id === option.id);
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
                    onToggleInjury(option.id);
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
                        onSetInjuryStatus(option.id, status);
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
  );
}
