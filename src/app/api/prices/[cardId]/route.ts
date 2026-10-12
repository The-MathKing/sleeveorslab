import { NextResponse } from "next/server";
import { CardProviderError, getCard } from "@/lib/cards";
import { getPrice } from "@/lib/prices";
import { jsonError, serverError } from "../../_lib/http";
import { LIMITS, rateLimit } from "../../_lib/rateLimit";
import { cardIdSchema } from "../../_lib/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const limited = rateLimit(req, LIMITS.read);
  if (limited) return limited;

  const { cardId } = await params;
  const parsed = cardIdSchema.safeParse(cardId);
  if (!parsed.success) return jsonError(400, "Invalid card id");

  try {
    const card = await getCard(parsed.data);
    if (!card) return jsonError(404, "Card not found");
    const price = await getPrice(card);
    return NextResponse.json({ price }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } });
  } catch (err) {
    if (err instanceof CardProviderError) return jsonError(502, "Card lookup is temporarily unavailable");
    return serverError(err);
  }
}
