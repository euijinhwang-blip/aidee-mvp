// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

// .env.local 에 넣어둔 환경변수들을 가져옴
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// 서버(관리자용, 통계용)에서 사용할 클라이언트
export const supabaseServer = () =>
  createClient(url, service, {
    auth: { persistSession: false },
  });

// 클라이언트/일반 API에서 INSERT만 할 때 사용할 클라이언트
export const supabaseAnon = () =>
  createClient(url, anon, {
    auth: { persistSession: false },
  });

