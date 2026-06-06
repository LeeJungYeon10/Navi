// 유대감(Bond) 계산 로직.
// 노션 기획서의 updateBondSimple() 의사코드를 서버 전용 TypeScript로 포팅했습니다.
// 클라이언트가 아닌 서버(API Route)에서 호출해야 어뷰징(임의 +100 등)을 막을 수 있습니다.

export type BondInputs = {
  loggedInToday: boolean;
  sentMessageToday: boolean;
  wroteFootprintToday: boolean; // "오늘의 발자국" 작성 여부
  streakDays: number; // 연속 접속 일수
  inactiveDays: number; // 마지막 접속 이후 경과 일수
  currentBond: number; // 0~100
};

export type BondResult = {
  increase: number;
  newBond: number;
  footprintCoins: number; // 소프트 화폐(발자국 🐾) 적립량 — 유료 아이템 경제와 연동
};

// 레벨업 기준: 20 / 40 / 60 / 80 / 100
export function bondToLevel(bond: number): number {
  return Math.min(5, Math.floor(bond / 20) + 1);
}

export function calculateBond(input: BondInputs): BondResult {
  let increase = 0;

  // === 기본 점수 ===
  if (input.loggedInToday) increase += 1;
  if (input.sentMessageToday) increase += 2;

  // === 질적 보너스 ===
  if (input.wroteFootprintToday) increase += 3;

  // === 연속 보너스 ===
  if (input.streakDays >= 7) increase += 2;

  // 하루 최대 증가량 제한 (+8)
  increase = Math.min(increase, 8);

  let newBond = Math.min(100, input.currentBond + increase);

  // 3일 이상 미접속 시 감소 (최소 0)
  if (input.inactiveDays >= 3) {
    newBond = Math.max(0, newBond - 1);
  }

  // === 소프트 화폐(발자국) 적립 — 유료 아이템 경제 설계와 연동 ===
  // 매일 대화 +5 / 발자국 일기 +10 / 7일 스트릭 +20 (일일 상한 ~30, 레벨업 보상은 별도)
  let footprintCoins = 0;
  if (input.sentMessageToday) footprintCoins += 5;
  if (input.wroteFootprintToday) footprintCoins += 10;
  if (input.streakDays >= 7) footprintCoins += 20;
  footprintCoins = Math.min(footprintCoins, 30);

  return { increase, newBond, footprintCoins };
}
