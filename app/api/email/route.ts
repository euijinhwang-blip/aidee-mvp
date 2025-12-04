// app/api/email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAnon } from "@/lib/supabase";

// 공통 metrics 로깅 헬퍼 (aidee/route.ts의 것과 동일하게 맞춰도 됨)
async function logMetric(event_type: string, meta: any = null) {
  try {
    const { error } = await supabaseAnon
      .from("metrics")
      .insert([{ event_type, meta }]);
    if (error) {
      console.error("[Supabase] metrics insert error:", error);
    }
  } catch (e) {
    console.error("[Supabase] metrics unexpected error:", e);
  }
}

const resendApiKey = process.env.RESEND_API_KEY || "";
const resend = new Resend(resendApiKey);

// 만족도 조사 링크 (환경변수 없으면 기본 Google Form 사용)
const SURVEY_URL =
  process.env.NEXT_PUBLIC_SURVEY_URL ||
  "https://docs.google.com/forms/d/e/1FAIpQLSdZwwqFkVnfnpisVqqIhesE2VbFKTrA3gA1SuYAAn8zBitK4w/viewform?usp=header";

export async function POST(req: NextRequest) {
  try {
    // 1) 환경변수 체크
    if (!process.env.RESEND_API_KEY) {
      console.error("[Email] RESEND_API_KEY is missing");
      return NextResponse.json(
        { error: "RESEND_API_KEY 환경변수가 없습니다." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { to, subject, rfp, images } = body;

    // 2) 수신자(to) 전처리: string | string[] 둘 다 허용 + 공백/콤마 정리
    let recipients: string[] = [];

    if (typeof to === "string") {
      recipients = to
        .split(/[;,]/) // 콤마나 세미콜론으로 여러 개 입력해도 되도록
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    } else if (Array.isArray(to)) {
      recipients = to
        .map((item) => String(item).trim())
        .filter((item) => item.length > 0);
    }

    if (!recipients.length) {
      return NextResponse.json(
        { error: "수신 이메일(to)이 비어 있거나 형식이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const mailSubject =
      subject || "Aidee · 비주얼 RFP & 프로세스(안) 결과 요약";

    // 3) RFP가 없을 때 대비
    if (!rfp) {
      const { data, error } = await resend.emails.send({
        from: "Aidee <onboarding@resend.dev>", // 테스트 도메인
        to: recipients,
        subject: mailSubject,
        html: `<p>RFP 데이터가 전달되지 않았습니다. 다시 한 번 시도해 주세요.</p>`,
      });

      if (error) {
        console.error("[Email] Resend error (no RFP):", error);
        return NextResponse.json(
          { error: error.message || "이메일 전송 중 오류가 발생했습니다." },
          { status: 500 }
        );
      }

      console.log("[Email] sent without RFP:", {
        id: data?.id,
        to: recipients,
      });
      return NextResponse.json({ ok: true, id: data?.id });
    }

    // 4) 간단한 HTML 본문 만들기 (요약)
    const imgList = Array.isArray(images)
      ? images
          .slice(0, 4)
          .map(
            (im: any) =>
              `<li><a href="${im.full || im.link}" target="_blank" rel="noreferrer">${im.alt || im.full}</a></li>`
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
        <a href="${SURVEY_URL}"
           target="_blank"
           rel="noreferrer"
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

    // 5) 메일 발송 + 에러 체크
    const { data, error } = await resend.emails.send({
      from: "Aidee <hello@aidee-studio.com>",
      to: recipients,
      subject: mailSubject,
      html,
    });

    if (error) {
      console.error("[Email] Resend error:", error);
      return NextResponse.json(
        { error: error.message || "이메일 전송 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }
   
    // ✅ 이메일 전송 성공 시 metrics에 기록
    await logMetric("email_sent", {
      to,
      subject: mailSubject,
      project_title: rfp?.visual_rfp?.project_title ?? null,
    });

    console.log("[Email] sent successfully:", {
      id: data?.id,
      to: recipients,
    });

    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err: any) {
    console.error("Email route error (unexpected):", err);
    return NextResponse.json(
      { error: err?.message || "이메일 전송 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
