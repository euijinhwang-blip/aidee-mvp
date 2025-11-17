// app/api/email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    // 1) 환경변수 체크
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "RESEND_API_KEY 환경변수가 없습니다." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { to, subject, rfp, images } = body;

    if (!to || typeof to !== "string") {
      return NextResponse.json(
        { error: "수신 이메일(to)이 비어 있습니다." },
        { status: 400 }
      );
    }

    // 2) 메일 제목
    const mailSubject =
      subject || "Aidee · 비주얼 RFP & 프로세스(안) 결과 요약";

    // 3) RFP가 없을 때 대비
    if (!rfp) {
      await resend.emails.send({
        from: "Aidee <onboarding@resend.dev>", // Testing 도메인
        to,
        subject: mailSubject,
        html: `<p>RFP 데이터가 전달되지 않았습니다. 다시 한 번 시도해 주세요.</p>`,
      });

      return NextResponse.json({ ok: true });
    }

    // 4) 간단한 HTML 본문 만들기 (너무 길지 않게 요약)
    const imgList = Array.isArray(images)
      ? images
          .slice(0, 4)
          .map(
            (im: any) =>
              `<li><a href="${im.full || im.link}" target="_blank">${im.alt || im.full}</a></li>`
          )
          .join("")
      : "";

    const html = `
      <h1>Aidee · 비주얼 RFP 결과 요약</h1>
      <p>아래 내용은 웹에서 생성한 결과의 요약입니다.</p>

      <h2>1. 타겟 & 문제 정의</h2>
      <p><strong>${rfp.target_and_problem?.summary || ""}</strong></p>
      <p>${rfp.target_and_problem?.details || ""}</p>

      <h2>2. 핵심 기능 제안</h2>
      <ul>
        ${(rfp.key_features || [])
          .map(
            (f: any) =>
              `<li><strong>${f.name}</strong> — ${f.description}</li>`
          )
          .join("")}
      </ul>

      <h2>3. 차별화 포인트 & 전략</h2>
      <ul>
        ${(rfp.differentiation || [])
          .map(
            (d: any) =>
              `<li><strong>${d.point}</strong> — ${d.strategy}</li>`
          )
          .join("")}
      </ul>

      <h2>4. RFP 요약</h2>
      <p><strong>프로젝트명:</strong> ${rfp.visual_rfp?.project_title || ""}</p>
      <p><strong>배경:</strong> ${rfp.visual_rfp?.background || ""}</p>
      <p><strong>목표:</strong> ${rfp.visual_rfp?.objective || ""}</p>
      <p><strong>타겟 사용자:</strong> ${rfp.visual_rfp?.target_users || ""}</p>
      <p><strong>핵심 요구사항:</strong> ${(rfp.visual_rfp?.core_requirements || []).join(
        ", "
      )}</p>
      <p><strong>디자인 방향:</strong> ${rfp.visual_rfp?.design_direction || ""}</p>
      <p><strong>납품물:</strong> ${(rfp.visual_rfp?.deliverables || []).join(
        ", "
      )}</p>

      ${
        imgList
          ? `
      <h2>5. 참고 이미지 링크 (최대 4장)</h2>
      <ul>${imgList}</ul>`
          : ""
      }

      <hr style="margin-top:24px;margin-bottom:16px;" />
  <p style="font-size:14px;color:#555;">
    ✏️ 마지막으로, 서비스 개선을 위해
    <strong>30초 정도의 간단한 만족도 조사</strong>를 남겨주실 수 있을까요?
  </p>
  <p style="margin:8px 0 24px;">
    <a href="https://docs.google.com/forms/d/e/1FAIpQLSdZwwqFkVnfnpisVqqIhesE2VbFKTrA3gA1SuYAAn8zBitK4w/viewform?usp=header
"
       target="_blank"
       style="
         display:inline-block;
         padding:10px 16px;
         background:#111827;
         color:#ffffff;
         text-decoration:none;
         border-radius:999px;
         font-size:14px;
       ">
      만족도 조사 참여하기
    </a>
  </p>
`;

    // 5) 메일 발송
    await resend.emails.send({
      from: "Aidee <onboarding@resend.dev>", // Resend Testing Domain
      to,
      subject: mailSubject,
      html,
    });

    // result.id 를 굳이 쓰지 않고, 타입 에러도 피함
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Email route error:", err);
    return NextResponse.json(
      { error: err?.message || "이메일 전송 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
