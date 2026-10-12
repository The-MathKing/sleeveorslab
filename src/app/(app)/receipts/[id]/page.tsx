import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getPrediction } from "@/lib/db";
import type { Prediction } from "@/lib/types";
import { ReceiptCard } from "@/components/scan/Receipt";
import { ReceiptToolbar, ReportOutcome } from "@/components/scan/ReceiptActions";
import { ErrorNote } from "@/components/scan/parts";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

async function load(id: string): Promise<{ p: Prediction | null; error?: string }> {
  try {
    const p = await getPrediction(safeDecode(id));
    return { p: p && p.isPublic ? p : null };
  } catch (e) {
    return { p: null, error: e instanceof Error ? e.message : "lookup failed" };
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const { p } = await load(id);
  if (!p) return { title: `Receipt ${safeDecode(id)}` };
  const title = `${p.id}: ${p.card.name} → ${p.verdict}`;
  const description = p.outcome
    ? `Predicted ${p.verdict} with ${p.grader}; graded ${p.grader} ${p.outcome.grade}.`
    : `Predicted ${p.verdict} with ${p.grader}, logged before the grade came back.`;
  return { title, description, openGraph: { title, description }, twitter: { card: "summary", title, description } };
}

export default async function ReceiptPage({ params }: Params) {
  const { id } = await params;
  const { p, error } = await load(id);
  if (!p && !error) notFound();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <Link href="/receipts" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-ink-2 print:hidden">
        <ArrowLeft className="size-4" aria-hidden /> All receipts
      </Link>
      {!p ? (
        <ErrorNote>Couldn&apos;t load this receipt right now ({error}). Try again in a minute.</ErrorNote>
      ) : (
        <>
          <ReceiptCard p={p} full />
          <p className="text-xs text-ink-3">
            Logged {p.createdAt.slice(0, 10)}, before any grade was known. Predictions are never edited after logging; outcomes
            are appended. PSA-style grade estimate, not affiliated with PSA, CGC, or The Pokémon Company.
          </p>
          <ReceiptToolbar id={p.id} title={`${p.id}: ${p.card.name} → ${p.verdict}`} />
          {!p.outcome ? <ReportOutcome id={p.id} grader={p.grader} /> : null}
        </>
      )}
    </div>
  );
}
