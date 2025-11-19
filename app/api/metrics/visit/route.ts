// app/api/metrics/visit/route.ts
import { NextResponse } from "next/server";
import { supabaseAnon } from "@/lib/supabase";

export async function POST() {
  try {
    const { error } = await supabaseAnon
      .from("metrics")
      .insert([{ event_type: "visit", meta: null }]);

    if (error) {
      console.error("[Supabase] visit metrics insert error:", error);
      return NextResponse.json({ error: "insert failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[Supabase] visit metrics unexpected error:", e);
    return NextResponse.json(
      { error: e?.message || "unexpected error" },
      { status: 500 }
    );
  }
}
