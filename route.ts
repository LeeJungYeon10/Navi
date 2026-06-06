import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateBond, bondToLevel } from "@/lib/bond";

// POST /api/bond
// 하루 1회 유대감 + 발자국(소프트 화폐)을 서버에서 계산·저장합니다.
// 기존 Vanilla의 updateBondSimple()을 안전한 서버 엔드포인트로 옮긴 것.
export async function POST(req: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const today = new Date().toISOString().split("T")[0];

  // 현재 상태 읽기 (테이블/컬럼명은 기존 스키마에 맞게 조정하세요)
  const { data: state } = await supabase
    .from("user_bond")
    .select("bond_level, current_level, streak_days, last_active_date, last_bond_update_date, footprint_coins")
    .eq("user_id", user.id)
    .single();

  // 하루 1회 제한 (중복 적립 방지)
  if (state?.last_bond_update_date === today) {
    return NextResponse.json({ skipped: true, reason: "already_updated_today" });
  }

  const lastActive = state?.last_active_date
    ? new Date(state.last_active_date)
    : new Date();
  const inactiveDays = Math.floor(
    (Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24)
  );

  const result = calculateBond({
    loggedInToday: true,
    sentMessageToday: Boolean(body.sentMessageToday),
    wroteFootprintToday: Boolean(body.wroteFootprintToday),
    streakDays: state?.streak_days ?? 0,
    inactiveDays,
    currentBond: state?.bond_level ?? 0,
  });

  const newLevel = bondToLevel(result.newBond);
  const leveledUp = newLevel > (state?.current_level ?? 1);

  await supabase.from("user_bond").upsert({
    user_id: user.id,
    bond_level: result.newBond,
    current_level: newLevel,
    last_active_date: today,
    last_bond_update_date: today,
    footprint_coins: (state?.footprint_coins ?? 0) + result.footprintCoins,
  });

  return NextResponse.json({
    bond: result.newBond,
    increase: result.increase,
    level: newLevel,
    leveledUp,
    footprintEarned: result.footprintCoins,
  });
}
