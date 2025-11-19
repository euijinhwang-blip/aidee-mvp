import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST() {
  try {
    await supabase.from("metrics").insert({
      type: "rfp",
      count: 1,
      meta: {}
    });

    return NextResponse.json({ ok: true });
 } catch (err: any) {
  return NextResponse.json({ error: err.message }, { status: 500 });
}

}

