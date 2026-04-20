/**
 * POST /api/track — fire-and-forget usage event collector.
 *
 * Body: { event, account?, salesforceId?, userId?, metadata? }
 * Writes to the `events` MongoDB collection.
 * Never returns PII — userId is an opaque identifier only.
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface TrackEvent {
  event: string;
  account?: string;
  salesforceId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TrackEvent;
    if (!body.event) {
      return NextResponse.json({ ok: false, error: "Missing event" }, { status: 400 });
    }
    const db = await getDb();
    await db.collection("events").insertOne({
      ...body,
      ts: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch {
    // Tracking must never break the caller — swallow errors silently
    return NextResponse.json({ ok: true });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "500"), 2000);
    const account = url.searchParams.get("account");
    const db = await getDb();
    const filter = account ? { account } : {};
    const events = await db
      .collection("events")
      .find(filter)
      .sort({ ts: -1 })
      .limit(limit)
      .toArray();
    return NextResponse.json({ ok: true, events });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
