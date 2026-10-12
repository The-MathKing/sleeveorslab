"use client";
import clsx from "clsx";

export interface ConditionAnswers {
  edges?: 0 | 1 | 2;
  corners?: 0 | 1 | 2;
  scratches?: 0 | 1 | 2;
  printLines?: 0 | 1 | 2;
  history?: 0 | 1 | 2;
}

type Key = keyof ConditionAnswers;

export const CONDITION_QUESTIONS: { key: Key; q: string; hint: string; options: [string, string, string] }[] = [
  { key: "edges", q: "Whitening on the back edges?", hint: "Tilt it under a lamp. Look along all four back edges.", options: ["None", "A fleck or two", "Obvious"] },
  { key: "corners", q: "Corners?", hint: "Check all four, front and back.", options: ["Sharp", "Slightly soft", "Rounded / dinged"] },
  { key: "scratches", q: "Surface scratches?", hint: "Angle it so light rakes across the holo and the back.", options: ["None", "Faint, angle-only", "Visible straight on"] },
  { key: "printLines", q: "Print lines or factory flaws?", hint: "Thin straight lines through the holo, ink spots, off-cuts.", options: ["None", "One faint", "Obvious"] },
  { key: "history", q: "How has it lived?", hint: "", options: ["Pack → sleeve", "Handled / binder", "Played"] },
];

// Deduction per answer level; rating starts at 5 (pack fresh).
const PENALTY = [0, 0.6, 1.6];

/** Maps the quick self-check to conditionSelfRating 1..5. Undefined when nothing was answered. */
export function conditionRating(a: ConditionAnswers): number | undefined {
  const vals = Object.values(a).filter((v): v is 0 | 1 | 2 => v !== undefined);
  if (vals.length === 0) return undefined;
  const r = 5 - vals.reduce<number>((s, v) => s + PENALTY[v], 0);
  return Math.max(1, Math.min(5, Math.round(r * 2) / 2));
}

export function ConditionCheck({ value, onChange }: { value: ConditionAnswers; onChange: (v: ConditionAnswers) => void }) {
  return (
    <ol className="flex flex-col gap-4">
      {CONDITION_QUESTIONS.map((item, idx) => (
        <li key={item.key}>
          <fieldset>
            <legend className="text-[15px] font-semibold">
              <span className="mr-2 font-mono text-ink-3">{idx + 1}.</span>
              {item.q}
            </legend>
            {item.hint ? <p className="mt-0.5 text-sm text-ink-3">{item.hint}</p> : null}
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {item.options.map((label, level) => {
                const on = value[item.key] === level;
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onChange({ ...value, [item.key]: on ? undefined : (level as 0 | 1 | 2) })}
                    className={clsx(
                      "min-h-12 rounded-xl border px-2 text-sm font-semibold leading-tight transition",
                      on
                        ? level === 0
                          ? "border-good bg-card text-good"
                          : level === 1
                            ? "border-borderline bg-borderline-soft text-ink"
                            : "border-bad bg-card text-bad"
                        : "border-line bg-card text-ink-2 hover:bg-paper-2",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </li>
      ))}
    </ol>
  );
}

export function ratingLabel(r: number | undefined): string {
  if (r === undefined) return "Not assessed (assumes typical NM)";
  if (r >= 4.75) return "Pack fresh";
  if (r >= 4) return "Near mint, minor";
  if (r >= 3) return "Light wear";
  if (r >= 2) return "Moderate wear";
  return "Heavy wear";
}
