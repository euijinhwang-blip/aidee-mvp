import { NextRequest, NextResponse } from "next/server";
import Resend from "resend";

export async function POST(req: NextRequest) {
  try {
    const { to, subject, rfp, images } = await req.json();

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "RESEND_API_KEY 환경변수가 없습니다." },
        { status: 500 }
      );
    }

    if (!to) {
      return NextResponse.json(
        { error: "이메일 주소가 없습니다." },
        { status: 400 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const html = `
      <h2>Aidee · 비주얼 RFP</h2>
      <pre>${JSON.stringify(rfp, null, 2)}</pre>
      <h3>이미지</h3>
      ${images
        ?.map((i: any) => `<img src="${i.full}" width="300" style="margin:8px 0;" />`)
        .join("")}
    `;

    const result = await resend.emails.send({
      from: "Aidee <no-reply@aidee.ai>",
      to,
      subject: subject || "Aidee RFP 결과",
      html,
    });

    return NextResponse.json({
      ok: true,
      id: result.data?.id || null,
      status: "sent",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "서버 오류" },
      { status: 500 }
    );
  }
}
