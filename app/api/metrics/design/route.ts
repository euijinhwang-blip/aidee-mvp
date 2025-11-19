import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json(); // { count, model, meta? }

    const { error } = await supabase.from("metrics").insert({
      type: "design",
      count: body.count ?? 1,
      meta: {
        model: body.model ?? null,
        ...(body.meta ?? {}),
      },
    });

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unknown error" }, { status: 500 });
  }
}
