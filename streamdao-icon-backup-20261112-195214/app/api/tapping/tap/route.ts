import { NextRequest, NextResponse, connection } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";

const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const SESSION_TAPS = 100;
const MIN_TAP_INTERVAL_MS = 80;

export async function POST(request: NextRequest) {
  await connection();
  let requestedTaps = 1;
  try {
    const body = await request.json();
    if (body?.count !== undefined) requestedTaps = Number(body.count);
  } catch {}
  if (!Number.isInteger(requestedTaps) || requestedTaps < 1 || requestedTaps > 25) {
    return NextResponse.json({ error: "Invalid tap batch." }, { status: 400 });
  }

  const token = request.cookies.get("streamdao_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }

  const userId = await verifySession(token);
  if (!userId) {
    return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  }

  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await prisma.$transaction(
          async (tx) => {
            const now = new Date();

            const progress = await tx.tappingProgress.upsert({
              where: { userId },
              create: { userId },
              update: {},
            });

            if (progress.lastClaimedAt) {
              const nextAvailableAt = new Date(
                progress.lastClaimedAt.getTime() + COOLDOWN_MS
              );

              if (now < nextAvailableAt) {
                throw new Error("COOLDOWN_ACTIVE");
              }
            }

            if (progress.taps >= SESSION_TAPS) {
              throw new Error("SESSION_COMPLETE");
            }

            if (
              progress.lastTapAt &&
              now.getTime() - progress.lastTapAt.getTime() < MIN_TAP_INTERVAL_MS
            ) {
              throw new Error("TAP_TOO_FAST");
            }

            const updated = await tx.tappingProgress.update({
              where: { userId },
              data: {
                taps: { increment: requestedTaps },
                lastTapAt: now,
              },
            });

            return {
              taps: updated.taps,
              remainingTaps: SESSION_TAPS - updated.taps,
              sessionComplete: updated.taps >= SESSION_TAPS,
            };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );

        return NextResponse.json({ success: true, ...result });
      } catch (error) {
        const code = (error as { code?: string }).code;

        if (error instanceof Error) {
          if (error.message === "COOLDOWN_ACTIVE") {
            return NextResponse.json(
              { error: "Your next tapping session is not available yet." },
              { status: 403 }
            );
          }
          if (error.message === "SESSION_COMPLETE") {
            return NextResponse.json(
              { error: "You have completed all 100 taps. Claim your reward." },
              { status: 409 }
            );
          }
          if (error.message === "TAP_TOO_FAST") {
            return NextResponse.json(
              { error: "Please slow down and tap naturally." },
              { status: 429 }
            );
          }
        }

        if ((code === "P2034" || code === "P2002") && attempt < 2) {
          continue;
        }

        if (code === "P2034" || code === "P2002") {
          return NextResponse.json(
            { error: "Your tap could not be recorded. Please try again." },
            { status: 409 }
          );
        }

        throw error;
      }
    }

    return NextResponse.json(
      { error: "Unable to record your tap." },
      { status: 500 }
    );
  } catch (error) {
    console.error("Tapping tap error:", error);
    return NextResponse.json(
      { error: "Something went wrong while recording your tap." },
      { status: 500 }
    );
  }
}