import { HeartPulse, Search } from "lucide-react";
import { useState } from "react";
import {
  INJURY_OPTIONS,
  type DeclaredInjury,
  type InjuryOption,
  type InjuryOptionId,
  type InjuryStatus,
} from "@/lib/injury-options";

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
  const [searchTerm, setSearchTerm] = useState("");

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredOptions = normalizedSearch
    ? INJURY_OPTIONS.filter(
        (option) =>
          option.bodyPart.toLowerCase().includes(normalizedSearch) ||
          option.label.toLowerCase().includes(normalizedSearch),
      )
    : INJURY_OPTIONS;
  const filteredIds = new Set(filteredOptions.map((option) => option.id));
  const selectedHiddenOptions = INJURY_OPTIONS.filter(
    (option) => !filteredIds.has(option.id) && injuryLimitations.some((injury) => injury.id === option.id),
  );

  function renderInjuryCard(option: InjuryOption) {
    const declared = injuryLimitations.find((injury) => injury.id === option.id);
    const selected = Boolean(declared);

    return (
      <div
        key={option.id}
        className={`flex flex-col gap-3 rounded-2xl border p-4 transition-colors sm:flex-row sm:items-start sm:justify-between ${
          selected ? "border-secondary/40 bg-secondary/10" : "border-border bg-card hover:border-input hover:bg-muted"
        }`}
      >
        <label className="flex flex-1 cursor-pointer gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => {
              onToggleInjury(option.id);
            }}
            className="border-input accent-secondary mt-1 size-4 rounded"
          />
          <span className="block">
            <span className="text-foreground block text-sm font-medium">
              {option.bodyPart}: {option.label}
            </span>
            <span className="text-muted-foreground mt-1 block text-xs leading-5">{option.summary}</span>
          </span>
        </label>
        {declared ? (
          <div className="border-border bg-muted flex shrink-0 gap-1 self-start rounded-lg border p-1 text-xs">
            {(["acute", "chronic"] as const).map((status) => (
              <button
                key={status}
                type="button"
                aria-pressed={declared.status === status}
                onClick={() => {
                  onSetInjuryStatus(option.id, status);
                }}
                className={`rounded-md px-2 py-1 capitalize transition-colors ${
                  declared.status === status
                    ? "bg-secondary/30 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <HeartPulse className="text-secondary size-4" />
        <p className="text-muted-foreground text-sm">Injury limitations</p>
      </div>
      <p className="text-muted-foreground mb-4 text-xs leading-5">
        These options are selected, not free-typed, so the generator and persistence layer can use the same injury
        vocabulary later in the flow. Mark a declared injury &ldquo;acute&rdquo; only if it&rsquo;s currently active and
        undiagnosed — acute injuries get conservative guidance instead of specific substitutions.
      </p>

      <div className="relative mb-4">
        <span className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2">
          <Search className="size-4" />
        </span>
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => {
            setSearchTerm(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
            }
          }}
          placeholder="Search by body part or injury..."
          aria-label="Search injuries"
          className="bg-card text-foreground placeholder:text-muted-foreground border-input focus:ring-ring w-full rounded-lg border py-2 pr-3 pl-10 ring-2 ring-transparent transition-colors focus:outline-none"
        />
      </div>

      <div className="grid gap-3">
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option) => renderInjuryCard(option))
        ) : (
          <p className="text-muted-foreground text-xs">No injuries match &ldquo;{searchTerm}&rdquo;.</p>
        )}
      </div>

      {selectedHiddenOptions.length > 0 ? (
        <div className="mt-4">
          <p className="text-muted-foreground mb-2 text-xs font-medium tracking-[0.18em] uppercase">Selected</p>
          <div className="grid gap-3">{selectedHiddenOptions.map((option) => renderInjuryCard(option))}</div>
        </div>
      ) : null}
    </div>
  );
}
