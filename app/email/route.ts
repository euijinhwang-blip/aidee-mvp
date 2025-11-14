import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  try {
    const { to, subject, rfp, images } = await req.json();

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "RESEND_API_KEY 환경변수가 없습니다." },
        { status: 500 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const html = `
      <h2>${rfp.visual_rfp.project_title}</h2>
      <p>${rfp.target_and_problem.summary}</p>
      <p>${rfp.target_and_problem.details}</p>

      <h3>이미지</h3>
      ${images
        .map((im: any) => `<img src="${im.thumb}" width="200" style="margin-right:8px"/>`)
        .join("")}
    `;

    const result = await resend.emails.send({
      from: "Aidee <no-reply@aidee.ai>",
      to,
      subject,
      html,
    });

    return NextResponse.json({ ok: true, id: result.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
