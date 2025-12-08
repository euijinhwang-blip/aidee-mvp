// app/api/email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabase } from "@/lib/supabase";

// metrics 기록 함수
async function logMetric(event_type: string, meta: any = null) {
  try {
    const { error } = await supabase
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

// 만족도 조사 링크
const SURVEY_URL =
  process.env.NEXT_PUBLIC_SURVEY_URL ||
  "https://docs.google.com/forms/d/e/1FAIpQLSdZwwqFkVnfnpisVqqIhesE2VbFKTrA3gA1SuYAAn8zBitK4w/viewform?usp=header";

export async function POST(req: NextRequest) {
  try {
    // API KEY 체크
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "RESEND_API_KEY 환경변수가 없습니다." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { to, subject, rfp, images } = body;

    // 수신자 전처리
    let recipients: string[] = [];
    if (typeof to === "string") {
      recipients = to
        .split(/[;,]/)
        .map((x) => x.trim())
        .filter((x) => x.length > 0);
    } else if (Array.isArray(to)) {
      recipients = to
        .map((x) => String(x).trim())
        .filter((x) => x.length > 0);
    }

    if (!recipients.length) {
      return NextResponse.json(
        { error: "수신 이메일이 비어 있습니다." },
        { status: 400 }
      );
    }

    const mailSubject =
      subject || "Aidee · 비주얼 RFP & 프로세스(안) 결과 요약";

    // ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
    //  RFP 없는 경우 단순 메일 전송
    // ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
    if (!rfp) {
      const { data, error } = await resend.emails.send({
        from: "Aidee <onboarding@resend.dev>",   // ⭐ 안전한 기본 도메인
        to: recipients,
        subject: mailSubject,
        html: `<p>RFP 데이터가 전달되지 않았습니다. 다시 시도해 주세요.</p>`,
      });

      if (error) {
        return NextResponse.json(
          { error: error.message || "이메일 전송 중 오류가 발생했습니다." },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true, id: data?.id });
    }

    // 이미지 링크 목록
    const imgList = Array.isArray(images)
      ? images
          .slice(0, 4)
          .map(
            (im: any) =>
              `<li><a href="${im.full || im.link}" target="_blank">${im.alt || im.full}</a></li>`
          )
          .join("")
      : "";

    // HTML 본문
    const html = `
      <h1>Aidee · 비주얼 RFP 결과 요약</h1>
      <p>아래는 생성된 RFP의 주요 요약 정보입니다.</p>

      <h2>1. 타겟 & 문제 정의</h2>
      <p><strong>${rfp.target_and_problem?.summary}</strong></p>
      <p>${rfp.target_and_problem?.details}</p>

      <h2>2. 핵심 기능 제안</h2>
      <ul>
        ${(rfp.key_features || [])
          .map((f: any) => `<li><strong>${f.name}</strong> — ${f.description}</li>`)
          .join("")}
      </ul>

      <h2>3. 차별화 포인트</h2>
      <ul>
        ${(rfp.differentiation || [])
          .map((d: any) => `<li><strong>${d.point}</strong> — ${d.strategy}</li>`)
          .join("")}
      </ul>

      <h2>4. RFP 요약</h2>
      <p><strong>프로젝트명:</strong> ${rfp.visual_rfp?.project_title}</p>
      <p><strong>배경:</strong> ${rfp.visual_rfp?.background}</p>
      <p><strong>목표:</strong> ${rfp.visual_rfp?.objective}</p>
      <p><strong>타겟:</strong> ${rfp.visual_rfp?.target_users}</p>
      <p><strong>핵심 요구사항:</strong> ${(rfp.visual_rfp?.core_requirements || []).join(", ")}</p>
      <p><strong>디자인 방향:</strong> ${rfp.visual_rfp?.design_direction}</p>
      <p><strong>납품물:</strong> ${(rfp.visual_rfp?.deliverables || []).join(", ")}</p>

      ${
        imgList
          ? `<h2>5. 참고 이미지 링크</h2><ul>${imgList}</ul>`
          : ""
      }

      <hr style="margin-top:24px;margin-bottom:16px;" />
      <p style="font-size:14px;color:#555;">서비스 개선을 위한 30초 설문</p>
      <a href="${SURVEY_URL}" target="_blank"
        style="padding:10px 16px;background:#111827;color:white;border-radius:8px;text-decoration:none;">
        만족도 조사 참여하기
      </a>
    `;

    // ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
    //  실제 이메일 발송 (가장 중요)
    // ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
    const { data, error } = await resend.emails.send({
      from: "Aidee <onboarding@resend.dev>",   // ⭐ 반드시 이걸 사용해야 즉시 발송됨
      to: recipients,
      subject: mailSubject,
      html,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || "이메일 전송 오류" },
        { status: 500 }
      );
    }

    await logMetric("email_sent", {
      to: recipients,
      subject: mailSubject,
      project_title: rfp.visual_rfp?.project_title || null,
    });

    return NextResponse.json({ ok: true, id: data?.id });
  } catch (e: any) {
    console.error("[Email Route Error]:", e);
    return NextResponse.json(
      { error: e?.message || "이메일 전송 중 알 수 없는 오류" },
      { status: 500 }
    );
  }
}
