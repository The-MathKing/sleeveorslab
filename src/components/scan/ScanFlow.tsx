"use client";
import clsx from "clsx";
import { ArrowLeft, Check, ChevronRight, ScanText } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getCollectionItem } from "@/lib/store";
import type { CardRef, CenteringMeasurement, CenteringResult, CollectionItem } from "@/lib/types";
import { CardSearch } from "./CardSearch";
import { CenteringTool } from "./CenteringTool";
import { ConditionCheck, conditionRating, ratingLabel, type ConditionAnswers } from "./ConditionCheck";
import { readCardNumber } from "./ocr";
import { PhoneHandoff } from "./PhoneHandoff";
import { Btn, CardThumb, Skeleton } from "./parts";
import { VerdictView } from "./VerdictView";

const STEPS = ["Front", "Back", "Card", "Condition", "Verdict"] as const;
type StepIdx = 0 | 1 | 2 | 3 | 4;

export function ScanFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const rerunId = params.get("rerun");

  const [step, setStep] = useState<StepIdx>(0);
  const [front, setFront] = useState<{ m: CenteringMeasurement; thumb: string } | null>(null);
  const [back, setBack] = useState<CenteringMeasurement | null>(null);
  const [card, setCard] = useState<CardRef | null>(null);
  const [query, setQuery] = useState("");
  const [answers, setAnswers] = useState<ConditionAnswers>({});
  const [ocr, setOcr] = useState<"idle" | "reading" | "found" | "miss">("idle");
  const [ocrText, setOcrText] = useState("");
  const [rerun, setRerun] = useState<CollectionItem | null>(null);
  const [rerunLoading, setRerunLoading] = useState(!!rerunId);
  const [runKey, setRunKey] = useState(0);
  const frontCanvas = useRef<HTMLCanvasElement | null>(null);
  const [hasFrontImage, setHasFrontImage] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  // Re-run a saved card with fresh prices: /scan?rerun=<collection id>
  useEffect(() => {
    if (!rerunId) return;
    let alive = true;
    getCollectionItem(rerunId).then((item) => {
      if (!alive) return;
      setRerunLoading(false);
      if (!item) return;
      setRerun(item);
      setCard(item.card);
      if (item.centering?.front) setFront({ m: item.centering.front, thumb: item.frontThumb ?? "" });
      if (item.centering?.back) setBack(item.centering.back);
      setStep(4);
    });
    return () => {
      alive = false;
    };
  }, [rerunId]);

  const go = useCallback((s: StepIdx) => {
    setStep(s);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, []);

  const reset = useCallback(() => {
    setFront(null);
    setBack(null);
    setCard(null);
    setQuery("");
    setAnswers({});
    setOcr("idle");
    setRerun(null);
    frontCanvas.current = null;
    setHasFrontImage(false);
    setRunKey((k) => k + 1);
    if (rerunId) router.replace("/scan");
    go(0);
  }, [go, rerunId, router]);

  const runOcr = async () => {
    if (!frontCanvas.current) return;
    setOcr("reading");
    const hit = await readCardNumber(frontCanvas.current, front?.m);
    if (hit) {
      setOcr("found");
      setOcrText(hit.total ? `${hit.number}/${hit.total}` : hit.number);
      setQuery((q) => {
        const name = q.replace(/\b[\w]*\d[\w/]*\b/g, "").trim();
        return `${name ? `${name} ` : ""}${hit.number}`.trim();
      });
    } else {
      setOcr("miss");
    }
  };

  const centering: CenteringResult | undefined =
    front || back ? { front: front?.m, back: back ?? undefined } : undefined;
  const rating = conditionRating(answers);

  if (rerunLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }

  return (
    <div ref={topRef} className="scroll-mt-20">
      <Stepper step={step} onJump={(i) => i < step && step !== 4 && go(i)} canJump={step !== 4} />

      {step === 0 ? (
        <section aria-labelledby="s-front">
          <h1 id="s-front" className="font-display text-2xl font-bold tracking-tight">
            Front photo
          </h1>
          <p className="mb-4 mt-1 text-[15px] text-ink-2">
            Centering is the one grade killer we can measure from a photo. We find the edges; you check them.
          </p>
          <CenteringTool
            key={`front-${runKey}`}
            side="front"
            onResult={(m, thumb) => setFront({ m, thumb })}
            onImage={(c) => {
              frontCanvas.current = c;
              setHasFrontImage(true);
            }}
          />
          <StepNav
            onNext={() => go(1)}
            nextDisabled={!front}
            nextLabel="Next: back"
            skipLabel={front ? undefined : "Skip photo"}
            onSkip={() => go(2)}
          />
          {!front ? <PhoneHandoff /> : null}
          {!front ? (
            <p className="mt-2 text-xs text-ink-3">Skipping the photo means we assume typical centering, and confidence drops.</p>
          ) : null}
        </section>
      ) : null}

      {step === 1 ? (
        <section aria-labelledby="s-back">
          <h1 id="s-back" className="font-display text-2xl font-bold tracking-tight">
            Back photo <span className="text-base font-normal text-ink-3">optional</span>
          </h1>
          <p className="mb-4 mt-1 text-[15px] text-ink-2">
            Back tolerances are looser, but a bad back still caps the grade. Thirty seconds, worth it on anything pricey.
          </p>
          <CenteringTool key={`back-${runKey}`} side="back" onResult={(m) => setBack(m)} />
          <StepNav onBack={() => go(0)} onNext={() => go(2)} nextLabel={back ? "Next: identify" : "Skip back"} />
        </section>
      ) : null}

      {step === 2 ? (
        <section aria-labelledby="s-card">
          <h1 id="s-card" className="font-display text-2xl font-bold tracking-tight">
            Which card?
          </h1>
          <p className="mb-4 mt-1 text-[15px] text-ink-2">Name plus the number at the bottom gets you there fastest.</p>
          {card ? (
            <div className="mb-4 flex items-center gap-3 rounded-[var(--radius)] border border-good/40 bg-card p-3">
              <CardThumb src={card.imageSmall} alt={card.name} className="w-12" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{card.name}</p>
                <p className="truncate font-mono text-xs text-ink-3">
                  {card.number} · {card.setName}
                </p>
              </div>
              <Btn size="sm" onClick={() => go(3)}>
                Use this <ChevronRight className="size-4" aria-hidden />
              </Btn>
            </div>
          ) : null}
          {hasFrontImage ? (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Btn size="sm" onClick={runOcr} loading={ocr === "reading"}>
                <ScanText className="size-4" aria-hidden /> {ocr === "reading" ? "Reading…" : "Read number from photo"}
              </Btn>
              {ocr === "found" ? (
                <span className="font-mono text-sm text-good">Found {ocrText}. Add the name if results are noisy.</span>
              ) : ocr === "miss" ? (
                <span className="text-sm text-ink-3">Couldn&apos;t read it. Type it in.</span>
              ) : null}
            </div>
          ) : null}
          <CardSearch
            query={query}
            onQueryChange={setQuery}
            autoFocus={!card}
            onPick={(c) => {
              setCard(c);
              go(3);
            }}
          />
          <StepNav onBack={() => go(front ? 1 : 0)} />
        </section>
      ) : null}

      {step === 3 && card ? (
        <section aria-labelledby="s-cond">
          <h1 id="s-cond" className="font-display text-2xl font-bold tracking-tight">
            Honest condition check
          </h1>
          <p className="mb-4 mt-1 text-[15px] text-ink-2">
            Graders see what photos miss. Answer fast and honestly; skip anything you&apos;re unsure about.
          </p>
          <ConditionCheck value={answers} onChange={setAnswers} />
          <p className="mt-4 rounded-xl bg-paper-2 px-3 py-2 font-mono text-sm">
            Self-rating: {rating !== undefined ? `${rating}/5` : "—"} · {ratingLabel(rating)}
          </p>
          <StepNav onBack={() => go(2)} onNext={() => go(4)} nextLabel="See verdict" />
        </section>
      ) : null}

      {step === 4 && card ? (
        <section aria-label="Verdict">
          {rerun ? (
            <p className="mb-3 rounded-xl bg-paper-2 px-3 py-2 text-sm text-ink-2">
              Re-running your saved card with fresh prices. Saving updates the same entry.
            </p>
          ) : null}
          <VerdictView
            key={`${card.id}-${runKey}`}
            card={card}
            centering={centering}
            conditionSelfRating={rating}
            frontThumb={front?.thumb || rerun?.frontThumb}
            savedId={rerun?.id}
            notes={rerun?.notes}
            countsTowardLimit={!rerun}
            onScanAnother={reset}
          />
          {!rerun ? (
            <button type="button" onClick={() => go(3)} className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-ink-2">
              <ArrowLeft className="size-4" aria-hidden /> Change condition answers
            </button>
          ) : null}
        </section>
      ) : null}

      {step === 4 && !card ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-ink-2">That saved card wasn&apos;t found on this device.</p>
          <Btn variant="primary" onClick={reset}>
            Start a new scan
          </Btn>
        </div>
      ) : null}
    </div>
  );
}

function Stepper({ step, onJump, canJump }: { step: number; onJump: (i: StepIdx) => void; canJump: boolean }) {
  return (
    <ol className="mb-5 grid grid-cols-5 gap-1" aria-label="Progress">
      {STEPS.map((label, i) => {
        const done = i < step;
        const on = i === step;
        return (
          <li key={label}>
            <button
              type="button"
              disabled={!done || !canJump}
              onClick={() => onJump(i as StepIdx)}
              aria-current={on ? "step" : undefined}
              className="flex w-full flex-col items-start gap-1 text-left disabled:cursor-default"
            >
              <span className={clsx("h-1.5 w-full rounded-full", done ? "bg-ink" : on ? "bg-ink/60" : "bg-line")} />
              <span className={clsx("flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide", on ? "text-ink" : "text-ink-3")}>
                {done ? <Check className="size-3" aria-hidden /> : null}
                {label}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function StepNav({
  onBack,
  onNext,
  nextLabel = "Next",
  nextDisabled,
  onSkip,
  skipLabel,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  onSkip?: () => void;
  skipLabel?: string;
}) {
  return (
    <div className="mt-6 flex items-center justify-between gap-2">
      {onBack ? (
        <Btn variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden /> Back
        </Btn>
      ) : (
        <span />
      )}
      <div className="flex gap-2">
        {skipLabel && onSkip ? (
          <Btn variant="ghost" onClick={onSkip}>
            {skipLabel}
          </Btn>
        ) : null}
        {onNext ? (
          <Btn variant="primary" size="lg" onClick={onNext} disabled={nextDisabled}>
            {nextLabel} <ChevronRight className="size-4" aria-hidden />
          </Btn>
        ) : null}
      </div>
    </div>
  );
}
