"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/** ---------- 타입 ---------- */
type Phase = {
  goals: string[];
  tasks: { title: string; owner: string }[];
  deliverables: string[];
};

type ExpertPackFriendly = {
  plain_summary: string;
  top_risks: string[];
  next_actions: string[];
  checklist: string[];
  famous_examples: string[];
};

type Survey = {
  budget_krw?: string;
  launch_plan?: string;
  market?: string;
  priority?: string;
  risk_tolerance?: string;
  compliance?: string;
};

type RFP = {
  target_and_problem: { summary: string; details: string };
  key_features: { name: string; description: string }[];
  differentiation: { point: string; strategy: string }[];
  concept_and_references: { concept_summary: string; reference_keywords: string[] };
  visual_rfp: {
    project_title: string;
    background: string;
    objective: string;
    target_users: string;
    core_requirements: string[];
    design_direction: string;
    deliverables: string[];
  };
  double_diamond?: {
    overall_budget_time?: {
      total_budget_krw?: string;
      total_time_weeks?: string;
      ratio?: { discover: string; define: string; develop: string; deliver: string };
      notes?: string;
    };
    purpose_notes?: {
      discover: string;
      define: string;
      develop: string;
      deliver: string;
    };
    discover: Phase;
    define: Phase;
    develop: Phase;
    deliver: Phase;
  };
  experts_to_meet?: { role: string; why: string }[];
  expert_reviews?: {
    pm: ExpertPackFriendly;
    designer: ExpertPackFriendly;
    engineer: ExpertPackFriendly;
    marketer: ExpertPackFriendly;
  };
};

/** ---------- 공통 컴포넌트 ---------- */
function PhaseCard({ title, phase }: { title: string; phase?: Phase }) {
  if (!phase) return null;
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm space-y-2">
      <h3 className="font-semibold">{title}</h3>
      <div className="text-sm">
        <p className="mb-1"><strong>🎯 Goals</strong></p>
        <ul className="list-disc list-inside text-gray-700">
          {phase.goals?.map((g, i) => <li key={i}>{g}</li>)}
        </ul>
      </div>
      <div className="text-sm">
        <p className="mb-1"><strong>🛠️ Tasks</strong></p>
        <ul className="space-y-1 text-gray-700">
          {phase.tasks?.map((t, i) => (
            <li key={i} className="border rounded-lg px-2 py-1">
              <span className="font-medium">{t.title}</span>{" "}
              <span className="text-xs text-gray-500">({t.owner})</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="text-sm">
        <p className="mb-1"><strong>🧾 Deliverables</strong></p>
        <p className="text-gray-700">{phase.deliverables?.join(", ")}</p>
      </div>
    </div>
  );
}

function ExpertBlock({ title, pack }: { title: string; pack?: ExpertPackFriendly }) {
  if (!pack) return null;
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-gray-800 whitespace-pre-wrap">{pack.plain_summary}</p>
      <div className="grid md:grid-cols-3 gap-3 text-sm">
        <div>
          <h4 className="font-medium mb-1">⚠️ Top 3 Risks</h4>
          <ul className="list-disc list-inside text-gray-700">
            {pack.top_risks?.map((x, i) => <li key={i}>{x}</li>)}
          </ul>
        </div>
        <div>
          <h4 className="font-medium mb-1">▶️ Next Actions</h4>
          <ul className="list-disc list-inside text-gray-700">
            {pack.next_actions?.map((x, i) => <li key={i}>{x}</li>)}
          </ul>
        </div>
        <div>
          <h4 className="font-medium mb-1">✅ Checklist</h4>
          <ul className="list-disc list-inside text-gray-700">
            {pack.checklist?.map((x, i) => <li key={i}>{x}</li>)}
          </ul>
        </div>
      </div>
      {pack.famous_examples?.length ? (
        <p className="text-xs text-gray-500">
          예시: {pack.famous_examples.join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

/** ---------- 설문 폼 ---------- */
function SurveyForm({ value, onChange }: { value: Survey; onChange: (s: Survey) => void }) {
  const update = (k: keyof Survey, v: string) => onChange({ ...value, [k]: v });
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm space-y-3">
      <h2 className="font-semibold mb-1">🧮 사용자 설문 (예산/기간/시장)</h2>
      <div className="grid md:grid-cols-2 gap-3 text-sm">
        <input className="border rounded-lg px-3 py-2" placeholder="예산(예: 3000만~5000만원)"
               value={value.budget_krw || ""} onChange={(e) => update("budget_krw", e.target.value)} />
        <input className="border rounded-lg px-3 py-2" placeholder="희망 일정(예: 올해 10월 출시 / 6개월 내)"
               value={value.launch_plan || ""} onChange={(e) => update("launch_plan", e.target.value)} />
        <input className="border rounded-lg px-3 py-2" placeholder="타겟 시장(예: 국내 B2C, 1차 채널 자사몰/쿠팡)"
               value={value.market || ""} onChange={(e) => update("market", e.target.value)} />
        <input className="border rounded-lg px-3 py-2" placeholder="우선순위 2개(예: 원가, 리드타임)"
               value={value.priority || ""} onChange={(e) => update("priority", e.target.value)} />
        <input className="border rounded-lg px-3 py-2" placeholder="리스크 허용도(보수/중간/공격)"
               value={value.risk_tolerance || ""} onChange={(e) => update("risk_tolerance", e.target.value)} />
        <input className="border rounded-lg px-3 py-2" placeholder="규제·인증 우려(예: 전기/전파/생활제품/의료)"
               value={value.compliance || ""} onChange={(e) => update("compliance", e.target.value)} />
      </div>
      <p className="text-xs text-gray-500">
        입력값은 로드맵/리스크/전략 가중치에 반영됩니다(예산/기간 제약 시 스펙 축소·단순화 등).
      </p>
    </div>
  );
}

/** ---------- Unsplash ---------- */
type UnsplashPhoto = {
  id: string;
  alt_description: string | null;
  urls: { small: string };
  links: { html: string };
};

function RefImageGrid({ keywords }: { keywords?: string[] }) {
  const [imgs, setImgs] = useState<UnsplashPhoto[]>([]);
  const accessKey = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY;
  const query = useMemo(() => (keywords && keywords.length ? keywords[0] : ""), [keywords]);

  useEffect(() => {
    let ignore = false;
    async function run() {
      setImgs([]);
      if (!accessKey || !query) return;
      try {
        const url =
          `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=12&client_id=${accessKey}`;
        const res = await fetch(url);
        const json = await res.json();
        if (!ignore && json?.results) setImgs(json.results);
      } catch {
        // 무시
      }
    }
    run();
    return () => { ignore = true; };
  }, [query, accessKey]);

  return (
    <section className="bg-white p-4 rounded-2xl shadow-sm md:col-span-2">
      <h2 className="font-semibold mb-2">⑤ 레퍼런스 이미지 (Unsplash)</h2>
      {!accessKey ? (
        <p className="text-sm text-red-500">
          NEXT_PUBLIC_UNSPLASH_ACCESS_KEY 환경변수가 없습니다.
        </p>
      ) : null}
      {accessKey && query && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {imgs.map((p) => (
            <a key={p.id} href={p.links.html} target="_blank" rel="noreferrer"
               className="block overflow-hidden rounded-lg border">
              <img src={p.urls.small} alt={p.alt_description || ""} className="w-full h-full object-cover" />
            </a>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-500 mt-2">이미지 제공: Unsplash (학습용·참고용)</p>
    </section>
  );
}

/** ---------- 페이지 ---------- */
export default function Home() {
  const [idea, setIdea] = useState("");
  const [survey, setSurvey] = useState<Survey>({});
  const [rfp, setRfp] = useState<RFP | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setRfp(null);
    try {
      const res = await fetch("/api/aidee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, survey }),
      });
      const text = await res.text();
      let data: any = null;
      try { data = text ? JSON.parse(text) : null; }
      catch { throw new Error("서버 응답이 JSON 형식이 아닙니다: " + text.slice(0, 200)); }

      if (!res.ok) {
        const msg = (data && (data.error || data.detail)) || `요청 실패 (status ${res.status})`;
        setError(msg);
      } else {
        setRfp(data as RFP);
      }
    } catch (e: any) {
      setError(e.message || "네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPDF = () => {
    window.print(); // 브라우저의 PDF 저장
  };

  const handleEmail = async () => {
    const to = prompt("받을 이메일 주소를 입력하세요 (예: you@example.com)");
    if (!to) return;
    if (!rfp) return alert("먼저 RFP를 생성해 주세요.");

    // 간단한 HTML 본문
    const html = `
      <div style="font-family:system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
        <h2>Aidee 결과물</h2>
        <p><b>프로젝트명:</b> ${rfp.visual_rfp?.project_title || "-"}</p>
        <p><b>요약:</b> ${rfp.target_and_problem?.summary || "-"}</p>
        <p><b>목표:</b> ${rfp.visual_rfp?.objective || "-"}</p>
        <p style="color:#666;font-size:12px;">* 첨부 PDF 대신 본문 요약을 전송합니다. (RESEND_API_KEY 설정 시 메일 발송)</p>
      </div>
    `;

    try {
      const res = await fetch("/api/aidee?action=send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, html, subject: "Aidee 결과물" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "메일 전송 실패");
      alert("메일 전송 완료!");
    } catch (e: any) {
      alert(e.message || "메일 전송 실패");
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8 print:bg-white">
      <div className="max-w-5xl mx-auto space-y-6" ref={printRef}>
        <h1 className="text-3xl font-semibold">
          제품디자인 기획부터 디자인까지, 텍스트 한 줄로 완성
        </h1>

        <p className="text-sm text-gray-600">
          아이디어 한 줄을 입력하면, 기획·전략·프로세스·전문가 리뷰·레퍼런스 이미지까지 자동 구성됩니다.
        </p>

        <textarea
          className="w-full p-4 border rounded-lg bg-white"
          rows={4}
          placeholder='예: "야외 러너를 위한 미니 공기청정 웨어러블 디바이스"'
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
        />

        <SurveyForm value={survey} onChange={setSurvey} />

        <div className="flex gap-2 print:hidden">
          <button
            onClick={handleGenerate}
            disabled={loading || !idea}
            className="px-6 py-3 rounded-lg border bg-white disabled:opacity-50"
          >
            {loading ? "분석/생성 중..." : "RFP 생성하기"}
          </button>
          <button onClick={handlePrintPDF} className="px-6 py-3 rounded-lg border bg-white">
            PDF 저장
          </button>
          <button onClick={handleEmail} className="px-6 py-3 rounded-lg border bg-white">
            이메일로 받기(옵션)
          </button>
        </div>

        {error && <div className="text-red-500 text-sm">{error}</div>}

        {rfp && (
          <div className="grid md:grid-cols-2 gap-4 mt-6">
            {/* 1 */}
            <section className="bg-white p-4 rounded-2xl shadow-sm">
              <h2 className="font-semibold mb-2">① 타겟 & 문제 정의</h2>
              <p className="font-medium mb-1">{rfp.target_and_problem.summary}</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {rfp.target_and_problem.details}
              </p>
            </section>

            {/* 2 */}
            <section className="bg-white p-4 rounded-2xl shadow-sm">
              <h2 className="font-semibold mb-2">② 핵심 기능 제안</h2>
              <ul className="space-y-1 text-sm">
                {rfp.key_features.map((f, i) => (
                  <li key={i}><strong>{f.name}</strong> — {f.description}</li>
                ))}
              </ul>
            </section>

            {/* 3 */}
            <section className="bg-white p-4 rounded-2xl shadow-sm">
              <h2 className="font-semibold mb-2">③ 차별화 포인트 & 전략</h2>
              <ul className="space-y-1 text-sm">
                {rfp.differentiation.map((d, i) => (
                  <li key={i}><strong>{d.point}</strong>: {d.strategy}</li>
                ))}
              </ul>
            </section>

            {/* 4 */}
            <section className="bg-white p-4 rounded-2xl shadow-sm">
              <h2 className="font-semibold mb-2">④ 컨셉 & 레퍼런스 키워드</h2>
              <p className="text-sm mb-2">{rfp.concept_and_references.concept_summary}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                {rfp.concept_and_references.reference_keywords.map((k, i) => (
                  <span key={i} className="px-2 py-1 rounded-full border">{k}</span>
                ))}
              </div>
            </section>

            {/* 5 */}
            <RefImageGrid keywords={rfp.concept_and_references.reference_keywords} />

            {/* 6 */}
            <section className="md:col-span-2 space-y-3">
              <h2 className="font-semibold">⑥ 디자인 및 사업화 프로세스(안)</h2>

              {rfp.double_diamond?.overall_budget_time && (
                <div className="bg-white p-4 rounded-2xl shadow-sm text-sm">
                  <p><strong>총 예산:</strong> {rfp.double_diamond.overall_budget_time.total_budget_krw || "-"}</p>
                  <p><strong>총 기간:</strong> {rfp.double_diamond.overall_budget_time.total_time_weeks || "-"}</p>
                  {rfp.double_diamond.overall_budget_time.ratio && (
                    <p>
                      <strong>비율:</strong>{" "}
                      Discover(탐색) {rfp.double_diamond.overall_budget_time.ratio.discover} /{" "}
                      Define(정의) {rfp.double_diamond.overall_budget_time.ratio.define} /{" "}
                      Develop(개발) {rfp.double_diamond.overall_budget_time.ratio.develop} /{" "}
                      Deliver(배포) {rfp.double_diamond.overall_budget_time.ratio.deliver}
                    </p>
                  )}
                  {rfp.double_diamond.overall_budget_time.notes && (
                    <p className="text-gray-600 mt-1"><strong>메모:</strong> {rfp.double_diamond.overall_budget_time.notes}</p>
                  )}
                </div>
              )}

              {rfp.double_diamond?.purpose_notes && (
                <div className="bg-white p-4 rounded-2xl shadow-sm text-sm">
                  <p><strong>Discover(탐색):</strong> {rfp.double_diamond.purpose_notes.discover}</p>
                  <p><strong>Define(정의):</strong> {rfp.double_diamond.purpose_notes.define}</p>
                  <p><strong>Develop(개발):</strong> {rfp.double_diamond.purpose_notes.develop}</p>
                  <p><strong>Deliver(배포):</strong> {rfp.double_diamond.purpose_notes.deliver}</p>
                </div>
              )}

              <div className="grid md:grid-cols-4 gap-3">
                <PhaseCard title="Discover(탐색)" phase={rfp.double_diamond?.discover} />
                <PhaseCard title="Define(정의)"   phase={rfp.double_diamond?.define} />
                <PhaseCard title="Develop(개발)"  phase={rfp.double_diamond?.develop} />
                <PhaseCard title="Deliver(배포)"  phase={rfp.double_diamond?.deliver} />
              </div>
            </section>

            {/* 7 */}
            <section className="bg-white p-4 rounded-2xl shadow-sm md:col-span-2">
              <h2 className="font-semibold mb-2">⑦ 누구를 만나야 할까</h2>
              <ul className="flex flex-wrap gap-2">
                {rfp.experts_to_meet?.map((e, i) => (
                  <li key={i} className="border rounded-xl px-3 py-2 text-sm bg-white">
                    <span className="font-medium">{e.role}</span>{" "}
                    <span className="text-gray-600">— {e.why}</span>
                  </li>
                )) || <li className="text-sm text-gray-500">추천 전문가 정보가 없습니다.</li>}
              </ul>
            </section>

            {/* 8 */}
            <section className="bg-white p-4 rounded-2xl shadow-sm md:col-span-2 space-y-3">
              <h2 className="font-semibold">⑧ 전문가 관점 리뷰</h2>
              <ExpertBlock title="PM/기획" pack={rfp.expert_reviews?.pm} />
              <ExpertBlock title="디자이너" pack={rfp.expert_reviews?.designer} />
              <ExpertBlock title="엔지니어" pack={rfp.expert_reviews?.engineer} />
              <ExpertBlock title="마케터" pack={rfp.expert_reviews?.marketer} />
            </section>

            {/* 9 (항상 마지막) */}
            <section className="bg-white p-4 rounded-2xl shadow-sm md:col-span-2">
              <h2 className="font-semibold mb-2">⑨ 비주얼 RFP / 브리프 초안</h2>
              <div className="text-sm space-y-1">
                <p><strong>프로젝트명:</strong> {rfp.visual_rfp.project_title}</p>
                <p><strong>배경:</strong> {rfp.visual_rfp.background}</p>
                <p><strong>목표:</strong> {rfp.visual_rfp.objective}</p>
                <p><strong>타겟 사용자:</strong> {rfp.visual_rfp.target_users}</p>
                <p><strong>핵심 요구사항:</strong> {rfp.visual_rfp.core_requirements.join(", ")}</p>
                <p><strong>디자인 방향:</strong> {rfp.visual_rfp.design_direction}</p>
                <p><strong>납품물:</strong> {rfp.visual_rfp.deliverables.join(", ")}</p>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* 프린트(=PDF) 스타일 */}
      <style jsx global>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: #fff !important; }
        }
      `}</style>
    </main>
  );
}
