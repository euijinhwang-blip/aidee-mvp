// app/api/metrics/visit/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST() {
  try {
    const { error } = await supabase.from("metrics").insert({
      type: "visit",
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[metrics] insert error", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[metrics] unexpected error", err);
    return NextResponse.json(
      { ok: false, error: err.message || "unknown" },
      { status: 500 }
    );
  }
}
