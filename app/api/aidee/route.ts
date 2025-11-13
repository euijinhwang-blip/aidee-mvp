"use client";

import { useState } from "react";

/** ---------- 타입 ---------- */
type Phase = {
  goals?: string[];
  tasks?: { title: string; owner: string }[]; // eta_days 제거
  deliverables?: string[];
};

type ExpertPack = { risks?: string[]; asks?: string[]; checklist?: string[] };

type RFP = {
  target_and_problem?: { summary?: string; details?: string };
  key_features?: { name?: string; description?: string }[];
  differentiation?: { point?: string; strategy?: string }[];
  concept_and_references?: { concept_summary?: string; reference_keywords?: string[] };
  visual_rfp?: {
    project_title?: string;
    background?: string;
    objective?: string;
    target_users?: string;
    core_requirements?: string[];
    design_direction?: string;
    deliverables?: string[];
  };

  /** 프로세스(더블다이아몬드 확장) */
  double_diamond?: {
    discover?: Phase;
    define?: Phase;
    develop?: Phase;
    deliver?: Phase;
    /** 추가(선택): 전체 예산/기간 가이드 */
    overall_budget_time?: {
      total_budget_krw?: string; // "약 3천만~5천만원"
      total_time_weeks?: string;  // "약 10~16주"
      ratio?: { discover?: string; define?: string; develop?: string; deliver?: string }; // "20%" 등
      notes?: string;
    };
    purpose_notes?: {
      discover?: string;
      define?: string;
      develop?: string;
      deliver?: string;
    };
  };

  /** 만나야 할 전문가 */
  experts_to_meet?: { role?: string; why?: string }[];

  /** 전문가 관점 리뷰 */
  expert_reviews?: {
    pm?: ExpertPack;
    designer?: ExpertPack;
    engineer?: ExpertPack;
    marketer?: ExpertPack;
  };
};

/** ---------- 유틸 ---------- */
const A = <T,>(x: T[] | undefined | null) => x ?? [];
const S = (x: string | undefined | null) => x ?? "";

/** ---------- 프레젠테이션 컴포넌트 ---------- */
function PhaseCard({ title, phase }: { title: string; phase?: Phase }) {
  if (!phase) return null;
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm space-y-2">
      <h3 className="font-semibold">{title}</h3>

      <div className="text-sm">
        <p className="mb-1"><strong>🎯 Goals</strong></p>
        <ul className="list-disc list-inside text-gray-700">
          {A(phase.goals).map((g, i) => <li key={i}>{g}</li>)}
        </ul>
      </div>

      <div className="text-sm">
        <p className="mb-1"><strong>🛠️ Tasks</strong></p>
        <ul className="space-y-1 text-gray-700">
          {A(phase.tasks).map((t, i) => (
            <li key={i} className="border rounded-lg px-2 py-1">
              <span className="font-medium">{t.title}</span>{" "}
              <span className="text-xs text-gray-500">({t.owner})</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="text-sm">
        <p className="mb-1"><strong>🧾 Deliverables</strong></p>
        <p className="text-gray-700">{A(phase.deliverables).join(", ")}</p>
      </div>
    </div>
  );
}

function ExpertTab({ pack }: { pack?: ExpertPack }) {
  if (!pack) return <p className="text-sm text-gray-500">리뷰 정보가 없습니다.</p>;
  return (
    <div className="grid md:grid-cols-3 gap-3 text-sm">
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h4 className="font-semibold mb-2">⚠️ Risks</h4>
        <ul className="list-disc list-inside text-gray-700">
          {A(pack.risks).map((x, i) => <li key={i}>{x}</li>)}
        </ul>
      </div>
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h4 className="font-semibold mb-2">📌 Asks</h4>
        <ul className="list-disc list-inside text-gray-700">
          {A(pack.asks).map((x, i) => <li key={i}>{x}</li>)}
        </ul>
      </div>
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h4 className="font-semibold mb-2">✅ Checklist</h4>
        <ul className="list-disc list-inside text-gray-700">
          {A(pack.checklist).map((x, i) => <li key={i}>{x}</li>)}
        </ul>
      </div>
    </div>
  );
}

function ExpertTabs({ data }: { data?: RFP["expert_reviews"] }) {
  const [tab, setTab] = useState<"pm" | "designer" | "engineer" | "marketer">("pm");

  const Btn = ({ k, label }: { k: typeof tab; label: string }) => (
    <button
      onClick={() => setTab(k)}
      className={
        "px-3 py-1 rounded-full text-sm border mr-2 " +
        (tab === k ? "bg-black text-white" : "bg-white")
      }
    >
      {label}
    </button>
  );

  if (!data) return <p className="text-sm text-gray-500">리뷰 정보가 없습니다.</p>;

  return (
    <div className="space-y-4">
      <div className="mb-2">
        <Btn k="pm" label="PM/기획" />
        <Btn k="designer" label="디자이너" />
        <Btn k="engineer" label="엔지니어" />
        <Btn k="marketer" label="마케터" />
      </div>

      {tab === "pm" && <ExpertTab pack={data.pm} />}
      {tab === "designer" && <ExpertTab pack={data.designer} />}
      {tab === "engineer" && <ExpertTab pack={data.engineer} />}
      {tab === "marketer" && <ExpertTab pack={data.marketer} />}
    </div>
  );
}

/** ---------- 페이지 ---------- */
export default function Home() {
  const [idea, setIdea] = useState("");
  const [rfp, setRfp] = useState<RFP | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setRfp(null);

    try {
      const res = await fetch("/api/aidee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });

      const text = await res.text();
      let data: any = null;

      try {
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        throw new Error("서버 응답이 JSON 형식이 아닙니다: " + text.slice(0, 200));
      }

      if (!res.ok) {
        const msg = (data && (data.error || data.detail)) || `요청 실패 (status ${res.status})`;
        setError(msg);
      } else {
        setRfp(data as RFP);
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || "네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const dd = rfp?.double_diamond;
  const ddRatio = dd?.overall_budget_time?.ratio;

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-3xl font-semibold">Aidee MVP · 아이디어를 구조화된 비주얼 RFP로</h1>

        <p className="text-sm text-gray-600">
          제품 아이디어를 입력하면, 타겟/문제 정의부터 전문가 리뷰, 프로세스 가이드까지 자동으로 구조화해 줍니다.
        </p>

        <textarea
          className="w-full p-4 border rounded-lg bg-white"
          rows={4}
          placeholder='예: "야외 러너를 위한 미니 공기청정 웨어러블 디바이스"'
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
        />

        <button
          onClick={handleGenerate}
          disabled={loading || !idea}
          className="px-6 py-3 rounded-lg border bg-white disabled:opacity-50"
        >
          {loading ? "분석 및 RFP 생성 중..." : "RFP 생성하기"}
        </button>

        {error && <div className="text-red-500 text-sm">{error}</div>}

        {rfp && (
          <div className="grid md:grid-cols-2 gap-4 mt-6">
            {/* ① 타겟/문제 정의 */}
            <section className="bg-white p-4 rounded-2xl shadow-sm">
              <h2 className="font-semibold mb-2">① 타겟 & 문제 정의</h2>
              <p className="font-medium mb-1">{S(rfp.target_and_problem?.summary)}</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {S(rfp.target_and_problem?.details)}
              </p>
            </section>

            {/* ② 핵심 기능 제안 */}
            <section className="bg-white p-4 rounded-2xl shadow-sm">
              <h2 className="font-semibold mb-2">② 핵심 기능 제안</h2>
              <ul className="space-y-1 text-sm">
                {A(rfp.key_features).map((f, i) => (
                  <li key={i}>
                    <strong>{S(f.name)}</strong> — {S(f.description)}
                  </li>
                ))}
              </ul>
            </section>

            {/* ③ 차별화 포인트 & 전략 */}
            <section className="bg-white p-4 rounded-2xl shadow-sm">
              <h2 className="font-semibold mb-2">③ 차별화 포인트 & 전략</h2>
              <ul className="space-y-1 text-sm">
                {A(rfp.differentiation).map((d, i) => (
                  <li key={i}>
                    <strong>{S(d.point)}</strong>: {S(d.strategy)}
                  </li>
                ))}
              </ul>
            </section>

            {/* ④ 컨셉 & 레퍼런스 키워드 */}
            <section className="bg-white p-4 rounded-2xl shadow-sm">
              <h2 className="font-semibold mb-2">④ 컨셉 & 레퍼런스 키워드</h2>
              <p className="text-sm mb-2">{S(rfp.concept_and_references?.concept_summary)}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                {A(rfp.concept_and_references?.reference_keywords).map((k, i) => (
                  <span key={i} className="px-2 py-1 rounded-full border">{k}</span>
                ))}
              </div>
            </section>

            {/* ⑤ 누구를 만나야 할까 */}
            <section className="bg-white p-4 rounded-2xl shadow-sm md:col-span-2">
              <h2 className="font-semibold mb-2">⑤ 누구를 만나야 할까</h2>
              <ul className="flex flex-wrap gap-2">
                {A(rfp.experts_to_meet).map((e, i) => (
                  <li key={i} className="border rounded-xl px-3 py-2 text-sm bg-white">
                    <span className="font-medium">{S(e.role)}</span>{" "}
                    <span className="text-gray-600">— {S(e.why)}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* ⑥ 전문가 관점 리뷰 */}
            <section className="bg-white p-4 rounded-2xl shadow-sm md:col-span-2">
              <h2 className="font-semibold mb-3">⑥ 전문가 관점 리뷰</h2>
              <ExpertTabs data={rfp.expert_reviews} />
            </section>

            {/* ⑦ 디자인 및 사업화 프로세스(안) */}
            <section className="md:col-span-2 space-y-3">
              <h2 className="font-semibold">⑦ 디자인 및 사업화 프로세스(안)</h2>

              {/* 단계 목적 한 줄 설명 */}
              {dd?.purpose_notes && (
                <div className="text-sm text-gray-700 bg-white p-4 rounded-2xl shadow-sm">
                  <p><strong>Discover:</strong> {S(dd.purpose_notes.discover)}</p>
                  <p><strong>Define:</strong> {S(dd.purpose_notes.define)}</p>
                  <p><strong>Develop:</strong> {S(dd.purpose_notes.develop)}</p>
                  <p><strong>Deliver:</strong> {S(dd.purpose_notes.deliver)}</p>
                </div>
              )}

              {/* 예산/기간 요약 */}
              {dd?.overall_budget_time && (
                <div className="text-sm text-gray-700 bg-white p-4 rounded-2xl shadow-sm">
                  <p><strong>예상 총 예산:</strong> {S(dd.overall_budget_time.total_budget_krw)}</p>
                  <p><strong>예상 총 기간:</strong> {S(dd.overall_budget_time.total_time_weeks)}</p>
                  {ddRatio && (
                    <p className="mt-1">
                      <strong>단계별 비율:</strong>{" "}
                      Discover {S(ddRatio.discover)} · Define {S(ddRatio.define)} ·
                      Develop {S(ddRatio.develop)} · Deliver {S(ddRatio.deliver)}
                    </p>
                  )}
                  {S(dd.overall_budget_time.notes) && <p className="mt-1">{dd.overall_budget_time?.notes}</p>}
                </div>
              )}

              <div className="grid md:grid-cols-4 gap-3">
                <PhaseCard title="DISCOVER" phase={dd?.discover} />
                <PhaseCard title="DEFINE"   phase={dd?.define} />
                <PhaseCard title="DEVELOP"  phase={dd?.develop} />
                <PhaseCard title="DELIVER"  phase={dd?.deliver} />
              </div>
            </section>

            {/* ⑧ 비주얼 RFP / 브리프 초안 — 항상 마지막 */}
            <section className="bg-white p-4 rounded-2xl shadow-sm md:col-span-2">
              <h2 className="font-semibold mb-2">⑧ 비주얼 RFP / 브리프 초안</h2>
              <div className="text-sm space-y-1">
                <p><strong>프로젝트명:</strong> {S(rfp.visual_rfp?.project_title)}</p>
                <p><strong>배경:</strong> {S(rfp.visual_rfp?.background)}</p>
                <p><strong>목표:</strong> {S(rfp.visual_rfp?.objective)}</p>
                <p><strong>타겟 사용자:</strong> {S(rfp.visual_rfp?.target_users)}</p>
                <p><strong>핵심 요구사항:</strong> {A(rfp.visual_rfp?.core_requirements).join(", ")}</p>
                <p><strong>디자인 방향:</strong> {S(rfp.visual_rfp?.design_direction)}</p>
                <p><strong>납품물:</strong> {A(rfp.visual_rfp?.deliverables).join(", ")}</p>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
