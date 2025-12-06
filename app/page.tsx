"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Phase = {
  goals: string[];
  tasks: { title: string; owner: string }[];
  deliverables: string[];
};

type ExpertPack = { risks: string[]; asks: string[]; checklist: string[] };

type RFP = {
  id: string;
  target_and_problem: { summary: string; details: string };
  key_features: { name: string; description: string }[];
  differentiation: { point: string; strategy: string }[];
  concept_and_references: {
    concept_summary: string;
    reference_keywords: string[];
  };
  visual_rfp: {
    project_title: string;
    background: string;
    objective: string;
    target_users: string;
    core_requirements: string[];
    design_direction: string;
    deliverables: string[];
  };
  double_diamond?: { discover: Phase; define: Phase; develop: Phase; deliver: Phase };
  experts_to_meet?: { role: string; why: string }[];
  expert_reviews?: {
    pm: ExpertPack & { summary_line?: string };
    designer: ExpertPack & { summary_line?: string };
    engineer: ExpertPack & { summary_line?: string };
    marketer: ExpertPack & { summary_line?: string };
  };
};

function PhaseCard({
  title,
  caption,
  phase,
}: {
  title: string;
  caption: string;
  phase?: Phase;
}) {
  if (!phase) return null;
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm space-y-2 h-full">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-xs text-gray-500">{caption}</p>

      <div className="text-sm">
        <p className="mb-1">
          <strong>🎯 Goals</strong>
        </p>
        <ul className="list-disc list-inside text-gray-700">
          {phase.goals?.map((g, i) => (
            <li key={i}>{g}</li>
          ))}
        </ul>
      </div>

      {!!phase.tasks?.length && (
        <div className="text-sm">
          <p className="mb-1">
            <strong>🛠️ Tasks</strong>
          </p>
          <ul className="space-y-1 text-gray-700">
            {phase.tasks.map((t, i) => (
              <li key={i} className="border rounded-lg px-2 py-1">
                <span className="font-medium">{t.title}</span>{" "}
                <span className="text-xs text-gray-500">({t.owner})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!!phase.deliverables?.length && (
        <div className="text-sm">
          <p className="mb-1">
            <strong>🧾 Deliverables</strong>
          </p>
          <p className="text-gray-700">{phase.deliverables?.join(", ")}</p>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [idea, setIdea] = useState("");
  const [emailTo, setEmailTo] = useState("");

  // 설문 값들
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [targetMarket, setTargetMarket] = useState("");
  const [priority, setPriority] = useState("");
  const [riskTolerance, setRiskTolerance] = useState("");
  const [regulationFocus, setRegulationFocus] = useState("");

  const [rfp, setRfp] = useState<RFP | null>(null);
  const [loading, setLoading] = useState(false);
  const [refining, setRefining] = useState(false); // 🔥 RFP 다시 정리하기
  const [error, setError] = useState<any>(null);
  const [emailMsg, setEmailMsg] = useState("");

  // 진행 시간(초)
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 최종 디자인 시안(DALL·E)
  const [designImages, setDesignImages] = useState<string[]>([]);
  const [designLoading, setDesignLoading] = useState(false);
  const [designError, setDesignError] = useState<any>(null);

  // 컨셉 / 비주얼 방향(Stability)
  const [conceptImages, setConceptImages] = useState<string[]>([]);
  const [conceptLoading, setConceptLoading] = useState(false);
  const [conceptError, setConceptError] = useState<string | null>(null);
  const [selectedConceptIndexes, setSelectedConceptIndexes] = useState<number[]>(
    []
  );

  // 카드별 사용자 메모
  const [userNotes, setUserNotes] = useState<{
    target_problem: string;
    key_features: string;
    differentiation: string;
    concept: string;
  }>({
    target_problem: "",
    key_features: "",
    differentiation: "",
    concept: "",
  });

  // 컨셉 이미지 생성에 사용된 프롬프트 (최종 디자인 프롬프트에 반영)
  const [conceptPrompt, setConceptPrompt] = useState<string | null>(null);

  const processCaptions = useMemo(
    () => ({
      discover: "문제/사용자/맥락을 넓게 탐색하여 ‘무엇을 만들지’를 열어 보는 단계",
      define: "요구사항·성공 기준을 좁혀 ‘무엇을 만들지’를 명확히 정의",
      develop: "설계·시작품 제작·검증/인증 준비",
      deliver: "양산·런칭·판매 및 피드백 수렴",
    }),
    []
  );

  // 페이지 최초 방문 기록
  useEffect(() => {
    fetch("/api/metrics/visit", { method: "POST" }).catch(() => {});
  }, []);

  // 컨셉 이미지 선택/해제
  function toggleSelectConcept(idx: number) {
    setSelectedConceptIndexes((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  }

  function buildSurveyPayload() {
    return {
      budget,
      timeline,
      target_market: targetMarket,
      priority,
      risk_tolerance: riskTolerance,
      regulation_focus: regulationFocus,
    };
  }

  // RFP 생성
  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setRfp(null);
    setEmailMsg("");

    // 디자인/컨셉 시안 & 메모 초기화
    setDesignImages([]);
    setDesignError("");
    setConceptImages([]);
    setConceptError(null);
    setSelectedConceptIndexes([]);
    setConceptPrompt(null);
    setUserNotes({
      target_problem: "",
      key_features: "",
      differentiation: "",
      concept: "",
    });

    // 타이머 초기화
    if (timerRef.current) clearInterval(timerRef.current);
    setElapsedSec(0);
    timerRef.current = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);

    try {
      const survey = buildSurveyPayload();

      const res = await fetch("/api/aidee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 🔥 설문을 처음 생성부터 같이 보냄
        body: JSON.stringify({ idea, survey }),
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(
          "서버 응답이 JSON 형식이 아닙니다: " + text.slice(0, 120)
        );
      }

      if (!res.ok) {
        throw new Error(data?.error || data?.detail || `요청 실패 (${res.status})`);
      }

      const newRfp = data as RFP;
      setRfp(newRfp);

      // ✅ RFP 생성 메트릭 기록
      await fetch("/api/metrics/rfp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rfpId: newRfp.id,
          meta: {
            surveyUsed:
              !!budget ||
              !!timeline ||
              !!targetMarket ||
              !!priority ||
              !!riskTolerance ||
              !!regulationFocus,
          },
        }),
      });
    } catch (e: any) {
      console.error("RFP generate error:", e);
      const msg =
        typeof e === "string"
          ? e
          : e?.message || e?.error || e?.detail || "네트워크 오류";
      setError(msg);
    } finally {
      setLoading(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }

  // 🔥 메모·설문을 반영해서 RFP를 다시 정리하는 함수
  async function handleRefineRfp() {
    if (!rfp || !idea) return;
    setRefining(true);
    setError(null);

    try {
      const survey = buildSurveyPayload();

      const res = await fetch("/api/aidee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea,
          survey,
          user_notes: userNotes, // 서버 systemPrompt에서 강하게 반영
          prev_rfp: rfp, // 이전 버전 참고용(선택)
          mode: "refine",
        }),
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(
          "서버 응답이 JSON 형식이 아닙니다: " + text.slice(0, 120)
        );
      }

      if (!res.ok) {
        throw new Error(data?.error || data?.detail || `요청 실패 (${res.status})`);
      }

      const newRfp = data as RFP;
      setRfp(newRfp);
    } catch (e: any) {
      console.error("RFP refine error:", e);
      const msg =
        typeof e === "string"
          ? e
          : e?.message || e?.error || e?.detail || "RFP 재생성 중 오류가 발생했습니다.";
      setError(msg);
    } finally {
      setRefining(false);
    }
  }

  // 이메일 보내기 (/api/email 사용)
  async function handleEmail() {
    if (!rfp || !emailTo) return;
    setEmailMsg("");

    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo,
          subject: "Aidee · 비주얼 RFP & 프로세스(안)",
          rfp,
          images: designImages.map((url, i) => ({
            full: url,
            alt: `design ${i + 1}`,
          })),
        }),
      });

      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "이메일 전송 실패");
      setEmailMsg("이메일을 보냈습니다.");

      // ✅ 이메일 메트릭 기록
      await fetch("/api/metrics/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo,
          meta: { rfpId: rfp.id },
        }),
      });
    } catch (e: any) {
      setEmailMsg(e?.message || "이메일 전송 중 오류가 발생했습니다.");
    }
  }

  // 최종 제품 디자인 이미지 (DALL·E)
  async function handleGenerateDesign() {
    if (!idea || !rfp) {
      setDesignError("먼저 아이디어를 입력하고 RFP를 생성해 주세요.");
      return;
    }

    setDesignError("");
    setDesignLoading(true);
    setDesignImages([]);

    try {
      const userNotesText = [
        userNotes.target_problem &&
          `Problem/goal notes: ${userNotes.target_problem}`,
        userNotes.key_features &&
          `Feature notes: ${userNotes.key_features}`,
        userNotes.differentiation &&
          `Differentiation notes: ${userNotes.differentiation}`,
        userNotes.concept && `Visual concept notes: ${userNotes.concept}`,
      ]
        .filter(Boolean)
        .join(" ");

      const selectedConceptImages =
        conceptImages.length && selectedConceptIndexes.length
          ? selectedConceptIndexes
              .map((i) => conceptImages[i])
              .filter(Boolean)
          : [];

      const res = await fetch("/api/design-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea,
          rfp,
          provider: "dalle",
          conceptPrompt: conceptPrompt ?? undefined,
          userNotesText: userNotesText || undefined,
          selectedConceptImages:
            selectedConceptImages.length > 0 ? selectedConceptImages : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "디자인 시안 생성 실패");

      const images: string[] = data.images || [];
      setDesignImages(images);

      // ✅ 디자인 메트릭 기록
      await fetch("/api/metrics/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: images.length,
          model: "dalle_gpt-image-1",
          meta: { rfpId: rfp.id, idea, kind: "final_render" },
        }),
      });
    } catch (e: any) {
      console.error("design image error:", e);
      setDesignError(e?.message || "디자인 시안 생성 중 오류가 발생했습니다.");
    } finally {
      setDesignLoading(false);
    }
  }

  // 컨셉 / 비주얼 방향 이미지 (Stable Diffusion via /api/concept-images)
  async function handleGenerateConceptImages() {
    if (!rfp) {
      setConceptError("먼저 RFP를 생성해 주세요.");
      return;
    }

    setConceptError(null);
    setConceptLoading(true);
    setConceptImages([]);
    setSelectedConceptIndexes([]);
    setConceptPrompt(null);

    try {
      const conceptNotes = userNotes.concept
        ? `Concept notes: ${userNotes.concept}`
        : "";

      const res = await fetch("/api/concept-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rfp,
          userNotesText: conceptNotes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok)
        throw new Error(data?.error || "컨셉 이미지 생성에 실패했습니다.");

      const images: string[] = data.images || [];
      setConceptImages(images);
      setConceptPrompt(data.conceptPrompt || null);

      await fetch("/api/metrics/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: images.length,
          model: "stability_sdxl_concept",
          meta: { rfpId: rfp.id, idea, kind: "concept_reference" },
        }),
      });
    } catch (e: any) {
      console.error("concept image error:", e);
      setConceptError(
        e?.message || "컨셉 이미지 생성 중 오류가 발생했습니다."
      );
    } finally {
      setConceptLoading(false);
    }
  }

  // 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-3xl text-gray-600 font-semibold">
          Aidee: 제품디자인 기획안, 텍스트 한 줄로 완성
        </h1>

        <p className="text-sm text-gray-600">
          제품 아이디어를 입력하고, 예산·기간·시장 정보를 간단히 선택하면 문제 정의부터
          디자인 컨셉 도출, 수행프로세스, 전문가 가이드, RFP 요약까지 자동으로
          정리합니다.
        </p>

        {/* 아이디어 입력 */}
        <textarea
          className="w-full p-4 border rounded-lg bg-white text-gray-400"
          rows={3}
          placeholder='예: "야외 러너를 위한 미니 공기청정 웨어러블 디바이스"'
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
        />

        {/* 설문 영역 */}
        <section className="bg-white p-4 rounded-2xl shadow-sm space-y-3">
          <h2 className="font-semibold text-gray-600 mb-1 text-sm">
            간단 설문 · 예산/기간/시장 정보
          </h2>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div className="space-y-2">
              <label className="block">
                <span className="text-xs text-gray-600">예산(총/개발)</span>
                <select
                  className="mt-1 w-full text-gray-300 border rounded-lg px-3 py-2 bg-white"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                >
                  <option value="">선택 안 함</option>
                  <option value="5천만 미만">5천만 미만</option>
                  <option value="5천만~1억">5천만~1억</option>
                  <option value="1~3억">1~3억</option>
                  <option value="3억 이상">3억 이상</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-gray-600">희망 일정</span>
                <select
                  className="mt-1 w-full text-gray-300 border rounded-lg px-3 py-2 bg-white"
                  value={timeline}
                  onChange={(e) => setTimeline(e.target.value)}
                >
                  <option value="">선택 안 함</option>
                  <option value="3개월 이내">3개월 이내</option>
                  <option value="6개월 이내">6개월 이내</option>
                  <option value="1년 이내">1년 이내</option>
                  <option value="1년 이상">1년 이상</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-gray-600">타겟 시장/채널</span>
                <input
                  className="mt-1 w-full text-gray-300 border rounded-lg px-3 py-2 bg-white"
                  placeholder="예: 국내 B2C, 북미 아마존, 국내 B2B 등"
                  value={targetMarket}
                  onChange={(e) => setTargetMarket(e.target.value)}
                />
              </label>
            </div>

            <div className="space-y-2">
              <label className="block">
                <span className="text-xs text-gray-600">우선순위</span>
                <select
                  className="mt-1 w-full text-gray-300 border rounded-lg px-3 py-2 bg-white"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="">선택 안 함</option>
                  <option value="원가">원가</option>
                  <option value="품질">품질</option>
                  <option value="리드타임">리드타임</option>
                  <option value="디자인 임팩트">디자인 임팩트</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-gray-600">리스크 허용도</span>
                <select
                  className="mt-1 w-full text-gray-300 border rounded-lg px-3 py-2 bg-white"
                  value={riskTolerance}
                  onChange={(e) => setRiskTolerance(e.target.value)}
                >
                  <option value="">선택 안 함</option>
                  <option value="보수적">보수적</option>
                  <option value="중간">중간</option>
                  <option value="공격적">공격적</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-gray-600">규제/인증 이슈 (선택)</span>
                <input
                  className="mt-1 w-full text-gray-300 border rounded-lg px-3 py-2 bg-white"
                  placeholder="예: 전기용품, 생활제품 위생, 의료기기 가능성 등"
                  value={regulationFocus}
                  onChange={(e) => setRegulationFocus(e.target.value)}
                />
              </label>
            </div>
          </div>
        </section>

        {/* 상단 버튼 + 진행상황 */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={loading || !idea}
            className="px-6 text-gray-600 py-3 rounded-lg border bg-white disabled:opacity-50"
          >
            {loading ? "분석 및 RFP 생성 중..." : "RFP 생성하기"}
          </button>

          <input
            type="email"
            placeholder="이메일 주소"
            className="border text-gray-300 rounded-lg px-3 py-2 bg-white"
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
          />
          <button
            onClick={handleEmail}
            disabled={!rfp || !emailTo}
            className="px-4 text-gray-600 py-2 rounded-lg border bg-white disabled:opacity-50"
          >
            이메일로 받기
          </button>

          {loading && (
            <span className="text-xs text-gray-500">
              분석 중… {elapsedSec}
              초 경과
            </span>
          )}

          {emailMsg && (
            <span className="text-sm text-gray-600">{emailMsg}</span>
          )}
        </div>

        {/* 에러/로딩 */}
        {designError && (
          <p className="text-red-500 text-sm mt-2">{designError}</p>
        )}
        {designLoading && (
          <p className="text-sm text-gray-500 mt-2">디자인 시안 생성 중...</p>
        )}

        {error && (
          <div className="text-red-500 text-sm">
            {typeof error === "string" ? error : JSON.stringify(error)}
          </div>
        )}

        {rfp && (
          <div className="grid md:grid-cols-2 gap-4 mt-6">
            {/* ① 목표 설정 및 문제 정의 */}
            <section className="bg-white p-4 rounded-2xl shadow-sm">
              <h2 className="font-semibold text-gray-600 mb-2">
                ① 목표 설정 및 문제 정의
              </h2>
              <p className="font-medium text-gray-600 mb-1">
                {rfp.target_and_problem.summary}
              </p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                {rfp.target_and_problem.details}
              </p>

              {/* 사용자 메모 입력 */}
              <div className="mt-3">
                <label className="text-xs text-gray-500 block mb-1">
                  추가하고 싶은 점이 있나요?
                </label>
                <textarea
                  rows={3}
                  className="w-full border rounded-lg px-2 py-1 text-xs text-gray-600"
                  placeholder="예: 실제로 겪고 있는 상황이나 더 강조하고 싶은 문제를 적어 주세요."
                  value={userNotes.target_problem}
                  onChange={(e) =>
                    setUserNotes((prev) => ({
                      ...prev,
                      target_problem: e.target.value,
                    }))
                  }
                />
              </div>
            </section>

            {/* ② 핵심 기능 제안 */}
            <section className="bg-white p-4 rounded-2xl shadow-sm">
              <h2 className="font-semibold text-gray-600 mb-2">
                ② 핵심 기능 제안
              </h2>
              <ul className="space-y-1 text-gray-600 text-sm">
                {rfp.key_features.map((f, i) => (
                  <li key={i}>
                    <strong>{f.name}</strong> — {f.description}
                  </li>
                ))}
              </ul>

              <div className="mt-3">
                <label className="text-xs text-gray-500 block mb-1">
                  추가하고 싶은 기능/제안이 있나요?
                </label>
                <textarea
                  rows={3}
                  className="w-full border rounded-lg px-2 py-1 text-xs text-gray-600"
                  placeholder="예: 꼭 포함하고 싶은 기능이나 제외하고 싶은 기능을 적어 주세요."
                  value={userNotes.key_features}
                  onChange={(e) =>
                    setUserNotes((prev) => ({
                      ...prev,
                      key_features: e.target.value,
                    }))
                  }
                />
              </div>
            </section>

            {/* ③ 차별화 포인트 */}
            <section className="bg-white p-4 rounded-2xl shadow-sm">
              <h2 className="font-semibold text-gray-600 mb-2">
                ③ 차별화 포인트 & 전략
              </h2>
              <ul className="space-y-1 text-gray-600 text-sm">
                {rfp.differentiation.map((d, i) => (
                  <li key={i}>
                    <strong>{d.point}</strong>: {d.strategy}
                  </li>
                ))}
              </ul>

              <div className="mt-3">
                <label className="text-xs text-gray-500 block mb-1">
                  우리만의 차별점에 대해 더 하고 싶은 말이 있나요?
                </label>
                <textarea
                  rows={3}
                  className="w-full border rounded-lg px-2 py-1 text-xs text-gray-600"
                  placeholder="예: 경쟁사와 비교했을 때 더 강조하고 싶은 부분을 적어 주세요."
                  value={userNotes.differentiation}
                  onChange={(e) =>
                    setUserNotes((prev) => ({
                      ...prev,
                      differentiation: e.target.value,
                    }))
                  }
                />
              </div>
            </section>

            {/* ④ 컨셉 & 레퍼런스 키워드 */}
            <section className="bg-white text-gray-600 p-4 rounded-2xl shadow-sm">
              <h2 className="font-semibold text-gray-600 mb-2">
                ④ 컨셉 & 레퍼런스 키워드
              </h2>
              <p className="text-sm text-gray-600 mb-2">
                {rfp.concept_and_references.concept_summary}
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                {rfp.concept_and_references.reference_keywords.map((k, i) => (
                  <span key={i} className="px-2 py-1 rounded-full border">
                    {k}
                  </span>
                ))}
              </div>

              <div className="mt-3">
                <label className="text-xs text-gray-500 block mb-1">
                  비주얼/컨셉에 대해 더 남기고 싶은 메모가 있나요?
                </label>
                <textarea
                  rows={3}
                  className="w-full border rounded-lg px-2 py-1 text-xs text-gray-600"
                  placeholder='예: "좀 더 미니멀하고 차분한 톤이면 좋겠어요"처럼 적어 주세요.'
                  value={userNotes.concept}
                  onChange={(e) =>
                    setUserNotes((prev) => ({
                      ...prev,
                      concept: e.target.value,
                    }))
                  }
                />
              </div>
            </section>

            {/* 🔥 메모/설문을 반영해 RFP 재생성 버튼 */}
            <section className="bg-white p-4 rounded-2xl shadow-sm md:col-span-2 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-600 text-sm">
                  내 의견을 반영해서 RFP 다시 정리하기
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  위 카드들에 적은 메모와 상단의 예산·기간·우선순위 설문을 바탕으로
                  RFP와 전문가 피드백을 한 번 더 다듬습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRefineRfp}
                disabled={refining}
                className="px-4 py-2 text-xs rounded-lg border bg-gray-900 text-white disabled:opacity-50"
              >
                {refining ? "RFP 다시 정리 중..." : "RFP 다시 정리하기"}
              </button>
            </section>

            {/* ⑤ 디자인 및 사업화 프로세스(안) */}
            <section className="text-gray-600 md:col-span-2 space-y-3">
              <h2 className="font-semibold text-gray-600">
                ⑤ 디자인 및 사업화 프로세스(안)
              </h2>
              <p className="text-xs text-gray-500">
                Discover → Define → Develop → Deliver 순서로, 왼쪽에서 오른쪽으로
                흐르며 전체 여정을 한 번에 볼 수 있도록 정리했습니다. 카드들을
                가로로 스크롤하면서 각 단계의 목표와 해야 할 일을 확인해 보세요.
              </p>

              <div className="mt-2 -mx-4 px-4 md:mx-0 md:px-0">
                <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory">
                  <div className="min-w-[260px] md:min-w-[280px] flex-shrink-0 snap-start">
                    <PhaseCard
                      title="1. Discover(탐색)"
                      caption={processCaptions.discover}
                      phase={rfp.double_diamond?.discover}
                    />
                  </div>
                  <div className="min-w-[260px] md:min-w-[280px] flex-shrink-0 snap-start">
                    <PhaseCard
                      title="2. Define(정의)"
                      caption={processCaptions.define}
                      phase={rfp.double_diamond?.define}
                    />
                  </div>
                  <div className="min-w-[260px] md:min-w-[280px] flex-shrink-0 snap-start">
                    <PhaseCard
                      title="3. Develop(개발)"
                      caption={processCaptions.develop}
                      phase={rfp.double_diamond?.develop}
                    />
                  </div>
                  <div className="min-w-[260px] md:min-w-[280px] flex-shrink-0 snap-start">
                    <PhaseCard
                      title="4. Deliver(배포)"
                      caption={processCaptions.deliver}
                      phase={rfp.double_diamond?.deliver}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* ⑥ 나의 협력 파트너 추천 */}
            <section className="bg-white p-4 text-gray-600 rounded-2xl shadow-sm md:col-span-2">
              <h2 className="font-semibold text-gray-600 mb-2">
                ⑥ 나의 협력 파트너 추천
              </h2>
              <ul className="flex flex-wrap gap-2">
                {rfp.experts_to_meet?.map((e, i) => (
                  <li
                    key={i}
                    className="border rounded-xl px-3 py-2 text-sm bg-white"
                  >
                    <span className="font-medium">{e.role}</span>{" "}
                    <span className="text-gray-600">— {e.why}</span>
                  </li>
                )) || (
                  <li className="text-sm text-gray-500">
                    추천 전문가 정보가 없습니다.
                  </li>
                )}
              </ul>
            </section>

            {/* ⑦ 전문가 관점 리뷰 */}
            <section className="bg-white p-4 text-gray-600 rounded-2xl shadow-sm md:col-span-2">
              <h2 className="font-semibold text-gray-600 mb-3">
                ⑦ 전문가 관점 리뷰
              </h2>
              <div className="grid md:grid-cols-2 gap-3 text-gray-600 text-sm">
                {["pm", "designer", "engineer", "marketer"].map((k) => {
                  const pack = (rfp.expert_reviews as any)?.[k];
                  if (!pack) return null;
                  const label =
                    k === "pm"
                      ? "PM/기획"
                      : k === "designer"
                      ? "디자이너"
                      : k === "engineer"
                      ? "엔지니어"
                      : "마케터";
                  return (
                    <div key={k} className="rounded-2xl p-4 border space-y-2">
                      <h4 className="font-semibold">{label}</h4>

                      {pack.summary_line && (
                        <p className="text-xs text-gray-500 italic">
                          “{pack.summary_line}”
                        </p>
                      )}

                      <div>
                        <p className="text-gray-700 font-medium text-xs">
                          주의할 점
                        </p>
                        <ul className="list-disc list-inside mb-2">
                          {pack.risks?.map((x: string, i: number) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <p className="text-gray-700 font-medium text-xs">
                          지금 당장 할 일
                        </p>
                        <ul className="list-disc list-inside mb-2">
                          {pack.asks?.map((x: string, i: number) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <p className="text-gray-700 font-medium text-xs">
                          체크리스트
                        </p>
                        <ul className="list-disc list-inside">
                          {pack.checklist?.map((x: string, i: number) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ⑧ RFP 요약 */}
            <section className="bg-white p-4 rounded-2xl text-gray-600 shadow-sm md:col-span-2">
              <h2 className="font-semibold text-gray-600 mb-2">⑧ RFP 요약</h2>
              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  <strong>프로젝트명:</strong> {rfp.visual_rfp.project_title}
                </p>
                <p>
                  <strong>배경:</strong> {rfp.visual_rfp.background}
                </p>
                <p>
                  <strong>목표:</strong> {rfp.visual_rfp.objective}
                </p>
                <p>
                  <strong>타겟 사용자:</strong> {rfp.visual_rfp.target_users}
                </p>
                <p>
                  <strong>핵심 요구사항:</strong>{" "}
                  {rfp.visual_rfp.core_requirements.join(", ")}
                </p>
                <p>
                  <strong>디자인 방향:</strong> {rfp.visual_rfp.design_direction}
                </p>
                <p>
                  <strong>납품물:</strong>{" "}
                  {rfp.visual_rfp.deliverables.join(", ")}
                </p>
              </div>
            </section>

            {/* ⑨ 비주얼 방향 탐색 (컨셉 이미지) */}
            <section className="bg-white p-4 rounded-2xl text-gray-600 shadow-sm md:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-gray-600">
                  ⑨ 비주얼 방향 탐색 (컨셉 이미지)
                </h2>
                <button
                  type="button"
                  onClick={handleGenerateConceptImages}
                  disabled={conceptLoading}
                  className="px-3 py-1 text-xs rounded-lg border bg-white text-gray-600 disabled:opacity-50"
                >
                  {conceptLoading
                    ? "컨셉 이미지 생성 중..."
                    : "컨셉 이미지 생성하기"}
                </button>
              </div>

              <p className="text-xs text-gray-500 mb-2">
                컨셉 요약과 키워드를 기반으로 생성한 비주얼 레퍼런스입니다. 마음에
                드는 이미지를 선택하면, 디자인시안의 비주얼 방향에 적용됩니다.
              </p>

              {conceptError && (
                <p className="text-red-500 text-sm mt-1">{conceptError}</p>
              )}

              {!!conceptImages.length && (
                <div className="mt-3 grid grid-cols-3 md:grid-cols-5 gap-2">
                  {conceptImages.map((url, idx) => {
                    const selected = selectedConceptIndexes.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleSelectConcept(idx)}
                        className={`relative rounded-xl overflow-hidden border bg-white focus:outline-none ${
                          selected ? "ring-2 ring-gray-900 border-gray-900" : "border-gray-200"
                        }`}
                      >
                        {/* 컨셉 이미지는 세로 살짝 넉넉하게 */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`concept-${idx}`}
                          className="w-full h-40 object-cover"
                        />
                        {selected && (
                          <span className="absolute top-1 right-1 bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                            선택
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {!!conceptImages.length && (
                <p className="mt-2 text-[11px] text-gray-500">
                  선택된 이미지: {selectedConceptIndexes.length}개 · 선택된 이미지는
                  3D 렌더 디자인 시안 프롬프트의 비주얼 방향에 보조 정보로 반영됩니다.
                </p>
              )}
            </section>

            {/* ⑩ AI 생성 제품 디자인 시안 (DALL·E) */}
            {(designError || designLoading || designImages.length > 0) && (
              <section className="bg-white p-4 rounded-2xl text-gray-600 shadow-sm md:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold text-gray-600">
                    ⑩ AI 생성 제품 디자인 시안 (3D 렌더)
                  </h2>
                  {/* 🔥 여기로 버튼 위치 이동 */}
                  <button
                    onClick={handleGenerateDesign}
                    disabled={!rfp || designLoading}
                    className="px-3 py-1 text-xs rounded-lg border bg-white text-gray-600 disabled:opacity-50"
                  >
                    {designLoading
                      ? "디자인 시안 생성 중..."
                      : "3D 렌더 이미지 생성"}
                  </button>
                </div>

                {designError && (
                  <p className="text-red-500 text-sm mt-2">{designError}</p>
                )}

                {designLoading && (
                  <p className="text-sm text-gray-500 mt-2">
                    디자인 시안 생성 중...
                  </p>
                )}

                {!!designImages.length && (
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {designImages.map((url, i) => (
                      <div
                        key={i}
                        className="rounded-xl overflow-hidden border bg-white flex flex-col"
                      >
                        {/* 🔥 정사각형 포맷 + 세로 영역 확장: aspect-square */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`design-${i}`}
                          className="w-full aspect-square object-cover"
                        />
                        <a
                          href={url}
                          download={`aidee-design-${i + 1}.png`}
                          className="text-[11px] text-blue-600 underline px-2 py-1 self-end"
                        >
                          이미지 다운로드
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
