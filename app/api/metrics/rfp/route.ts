import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json(); // { rfpId?, meta? }

    const { error } = await supabase.from("metrics").insert({
      type: "rfp",
      count: 1,
      meta: {
        rfpId: body.rfpId ?? null,
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
