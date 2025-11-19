import { NextResponse } from "next/server";
import supabase from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    await supabase.from("email_logs").insert({
      to: body.to,
      type: "email",
      meta: body.meta || {},
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Email log error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
