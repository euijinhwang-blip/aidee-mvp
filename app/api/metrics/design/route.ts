import { NextResponse } from "next/server";
import supabase from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { count, model, meta } = await req.json();

    await supabase.from("design_logs").insert({
      count,
      model: model || "",
      type: "design",
      meta: meta || {},
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Design log error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
