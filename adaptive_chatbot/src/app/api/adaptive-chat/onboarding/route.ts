import { NextRequest, NextResponse } from "next/server";

const GENERATIONS = new Set(["Gen Z", "Millennial"]);

export async function POST(req: NextRequest) {
  try {
    const { generation } = await req.json();

    if (typeof generation !== "string" || !GENERATIONS.has(generation)) {
      return NextResponse.json({ error: "Invalid generation" }, { status: 400 });
    }

    // console.info("[adaptive-chat][onboarding] User selected generation", {
    //   generation,
    // });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[adaptive-chat][onboarding] Failed to log generation selection", error);
    return NextResponse.json({ error: "Failed to log generation selection" }, { status: 500 });
  }
}
