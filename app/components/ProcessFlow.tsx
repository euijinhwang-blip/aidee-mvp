"use client";

export default function ProcessFlow() {
  return (
    <div className="w-full overflow-x-auto py-6">
      <div className="flex gap-6 min-w-max">

        {/* Discover */}
        <div className="bg-white rounded-xl shadow-md p-5 w-[350px] flex-shrink-0">
          <h2 className="text-xl font-bold mb-3">Discover (탐색)</h2>
          <div className="mb-4">
            <h3 className="font-semibold text-gray-700">🔎 Goals</h3>
            <ul className="text-sm text-gray-600 list-disc ml-5">
              <li>시장 니즈 및 경쟁사 분석</li>
              <li>소비자 인터뷰 및 리서치</li>
            </ul>
          </div>
          <div className="mb-4">
            <h3 className="font-semibold text-gray-700">🛠 Tasks</h3>
            <ul className="text-sm text-gray-600 list-disc ml-5">
              <li>소비자 연구 및 인터뷰 진행 (PM)</li>
              <li>경쟁 제품 분석 (디자이너)</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-700">📦 Deliverables</h3>
            <ul className="text-sm text-gray-600 list-disc ml-5">
              <li>인터뷰 결과 요약</li>
              <li>경쟁사 분석 보고서</li>
            </ul>
          </div>
        </div>

        {/* Define */}
        <div className="bg-white rounded-xl shadow-md p-5 w-[350px] flex-shrink-0">
          <h2 className="text-xl font-bold mb-3">Define (정의)</h2>
          <div className="mb-4">
            <h3 className="font-semibold text-gray-700">🎯 Goals</h3>
            <ul className="text-sm text-gray-600 list-disc ml-5">
              <li>핵심 요구사항 및 성공 기준 정의</li>
            </ul>
          </div>
          <div className="mb-4">
            <h3 className="font-semibold text-gray-700">🛠 Tasks</h3>
            <ul className="text-sm text-gray-600 list-disc ml-5">
              <li>요구사항 및 성능 정리 (PM)</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-700">📦 Deliverables</h3>
            <ul className="text-sm text-gray-600 list-disc ml-5">
              <li>요구사항 문서(PRD)</li>
            </ul>
          </div>
        </div>

        {/* Develop */}
        <div className="bg-white rounded-xl shadow-md p-5 w-[350px] flex-shrink-0">
          <h2 className="text-xl font-bold mb-3">Develop (개발)</h2>
          <div className="mb-4">
            <h3 className="font-semibold text-gray-700">⚙ Goals</h3>
            <ul className="text-sm text-gray-600 list-disc ml-5">
              <li>프로토타입 설계 및 검증</li>
            </ul>
          </div>
          <div className="mb-4">
            <h3 className="font-semibold text-gray-700">🛠 Tasks</h3>
            <ul className="text-sm text-gray-600 list-disc ml-5">
              <li>디자인 콘셉트 개발 (디자이너)</li>
              <li>프로토타입 제작 및 테스트 (엔지니어)</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-700">📦 Deliverables</h3>
            <ul className="text-sm text-gray-600 list-disc ml-5">
              <li>샘플 및 테스트 보고서</li>
            </ul>
          </div>
        </div>

        {/* Deliver */}
        <div className="bg-white rounded-xl shadow-md p-5 w-[350px] flex-shrink-0">
          <h2 className="text-xl font-bold mb-3">Deliver (배포)</h2>
          <div className="mb-4">
            <h3 className="font-semibold text-gray-700">🚀 Goals</h3>
            <ul className="text-sm text-gray-600 list-disc ml-5">
              <li>양산 + 마케팅 준비</li>
            </ul>
          </div>
          <div className="mb-4">
            <h3 className="font-semibold text-gray-700">🛠 Tasks</h3>
            <ul className="text-sm text-gray-600 list-disc ml-5">
              <li>양산 협력사 선정 (PM)</li>
              <li>런칭 전략 수립 (마케팅)</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-700">📦 Deliverables</h3>
            <ul className="text-sm text-gray-600 list-disc ml-5">
              <li>생산 일정표, 패키지 디자인</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}
