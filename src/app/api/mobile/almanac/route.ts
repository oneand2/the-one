import { NextRequest, NextResponse } from 'next/server';
import { LunarUtil, Solar as SolarLib } from 'lunar-javascript';

export const runtime = 'nodejs';

const WEEK_DAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const ZHI_NAMES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'] as const;
const ZHI_RANGES = [
  '00:00–00:59','01:00–02:59','03:00–04:59','05:00–06:59',
  '07:00–08:59','09:00–10:59','11:00–12:59','13:00–14:59',
  '15:00–16:59','17:00–18:59','19:00–20:59','21:00–22:59',
];
const RITUAL_TERMS = new Set([
  '祭祀', '安香', '酬神', '开光', '普渡', '祈福', '造庙', '斋醮',
  '安葬', '成服', '除服', '合寿木', '开生坟', '立碑', '启钻', '入殓',
  '行丧', '修坟', '移柩',
]);

function formatItems(items: string[]) {
  return Array.from(new Set(items.map((item) => RITUAL_TERMS.has(item) ? '礼俗' : item)));
}

const YANG_REN_BY_DAY_GAN: Record<number, number[]> = {
  0: [3], 2: [6], 4: [6], 6: [9], 8: [0],
};
const LU_SHEN_BY_DAY_GAN: Record<number, number[]> = {
  0: [2], 1: [3], 2: [5], 3: [6], 4: [5],
  5: [6], 6: [8], 7: [9], 8: [11], 9: [0],
};
const TIAN_YI_BY_DAY_GAN: Record<number, number[]> = {
  0: [1, 7], 4: [1, 7], 6: [1, 7], 1: [0, 8], 5: [0, 8],
  2: [11, 9], 3: [11, 9], 8: [3, 5], 9: [3, 5], 7: [6, 2],
};
const JIE_LU_BY_DAY_GAN: Record<number, number[]> = {
  0: [8, 9], 5: [8, 9], 1: [6, 7], 6: [6, 7], 2: [4, 5],
  7: [4, 5], 3: [2, 3], 8: [2, 3], 4: [0, 1], 9: [0, 1],
};
const GAN_WU_XING = ['木','木','火','火','土','土','金','金','水','水'] as const;

type LuckReason = '日破'|'月破'|'羊刃'|'五不遇'|'日禄'|'天乙贵人'|'截路空亡'|'旬空'|'黄道'|'黑道';

function isGanKe(attackerGanIndex: number, victimGanIndex: number) {
  const attacker = GAN_WU_XING[attackerGanIndex];
  const victim = GAN_WU_XING[victimGanIndex];
  return (attacker === '木' && victim === '土') ||
    (attacker === '土' && victim === '水') ||
    (attacker === '水' && victim === '火') ||
    (attacker === '火' && victim === '金') ||
    (attacker === '金' && victim === '木');
}

// Keep this rule order identical to LunarCalendarCard.getComprehensiveTimeLuck.
function getComprehensiveTimeLuck(
  lunar: { getDayZhi(): string; getMonthZhi(): string; getDayGanIndex(): number },
  dayXunKong: string,
  time: { getGanIndex(): number; getZhiIndex(): number; getChong(): string; getZhi(): string; getTianShenType(): string },
): { luck: '吉'|'凶'; reason: LuckReason } {
  const dayGanIndex = lunar.getDayGanIndex();
  const dayZhi = lunar.getDayZhi();
  const monthZhi = lunar.getMonthZhi();
  const timeGanIndex = time.getGanIndex();
  const timeZhiIndex = time.getZhiIndex();
  const chong = time.getChong();

  if (chong === dayZhi) return { luck: '凶', reason: '日破' };
  if (chong === monthZhi) return { luck: '凶', reason: '月破' };
  if ((YANG_REN_BY_DAY_GAN[dayGanIndex] ?? []).includes(timeZhiIndex)) return { luck: '凶', reason: '羊刃' };
  const diff = (timeGanIndex - dayGanIndex + 10) % 10;
  if (diff === 6 && isGanKe(timeGanIndex, dayGanIndex)) return { luck: '凶', reason: '五不遇' };

  const hasRiLu = (LU_SHEN_BY_DAY_GAN[dayGanIndex] ?? []).includes(timeZhiIndex);
  const hasTianYi = (TIAN_YI_BY_DAY_GAN[dayGanIndex] ?? []).includes(timeZhiIndex);
  if ((JIE_LU_BY_DAY_GAN[dayGanIndex] ?? []).includes(timeZhiIndex)) return { luck: '凶', reason: '截路空亡' };
  if (dayXunKong && dayXunKong.includes(time.getZhi())) return { luck: '凶', reason: '旬空' };

  const huang = time.getTianShenType() === '黄道';
  let reason: LuckReason = huang ? '黄道' : '黑道';
  if (hasRiLu) reason = '日禄';
  else if (hasTianYi) reason = '天乙贵人';
  return { luck: huang ? '吉' : '凶', reason };
}

export async function GET(request: NextRequest) {
  const year = Number(request.nextUrl.searchParams.get('year'));
  const month = Number(request.nextUrl.searchParams.get('month'));
  const day = Number(request.nextUrl.searchParams.get('day'));
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return NextResponse.json({ error: '日期格式无效' }, { status: 400 });
  }

  try {
    const hour = new Date().getHours();
    const noon = SolarLib.fromYmdHms(year, month, day, 12, 0, 0);
    const lunar = noon.getLunar();
    const currentLunar = SolarLib.fromYmdHms(year, month, day, hour, 0, 0).getLunar();
    const dayXunKong = LunarUtil.getXunKong(lunar.getDayInGanZhi()) || '';
    const shiChen = lunar.getTimes().slice(0, 12).map((time: any, index: number) => {
      const { luck, reason } = getComprehensiveTimeLuck(lunar, dayXunKong, time);
      return {
        ganZhi: time.getGanZhi(),
        zhi: ZHI_NAMES[index],
        luck,
        reason,
        range: ZHI_RANGES[index],
      };
    });
    return NextResponse.json({
      lunarTitle: `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
      yearGanZhi: `${lunar.getYearInGanZhi()}年`,
      monthGanZhi: `${lunar.getMonthInGanZhi()}月`,
      dayGanZhi: `${lunar.getDayInGanZhi()}日`,
      zodiac: lunar.getYearShengXiao(),
      weekDay: WEEK_DAYS[new Date(year, month - 1, day).getDay()],
      yi: formatItems(lunar.getDayYi() ?? []),
      ji: formatItems(lunar.getDayJi() ?? []),
      yearPillar: lunar.getYearInGanZhi(),
      monthPillar: lunar.getMonthInGanZhi(),
      dayPillar: lunar.getDayInGanZhi(),
      timePillar: currentLunar.getTimeInGanZhi(),
      currentZhi: currentLunar.getTimeZhi(),
      tianShen: lunar.getDayTianShen(),
      tianShenType: lunar.getDayTianShenType(),
      zhiXing: lunar.getZhiXing(),
      dayNaYin: lunar.getDayNaYin(),
      xiu: lunar.getXiu(),
      xiuGong: lunar.getGong(),
      xiuZheng: lunar.getZheng(),
      xiuAnimal: lunar.getAnimal(),
      chongShengXiao: lunar.getDayChongShengXiao(),
      sha: lunar.getDaySha(),
      shiChen,
    });
  } catch (error) {
    console.error('native almanac calculation failed:', error);
    return NextResponse.json({ error: '历法计算失败' }, { status: 400 });
  }
}
