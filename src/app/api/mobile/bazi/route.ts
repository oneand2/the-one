import { NextRequest, NextResponse } from 'next/server';
import { Lunar, Solar } from 'lunar-javascript';
import {
  analyzeBazi,
  generateClassicalBaziData,
  calculateInteractions,
  getBaziTextualAnalysis,
  calculateEnergyProfile,
  calculateLuckCycles,
  inferDateFromBazi,
  type BaziInput,
} from '@/utils/baziLogic';
import { buildBaziImportData } from '@/utils/baziImport';
import { domesticProvinces, getCityLongitude, provinceData } from '@/utils/baziLocation';

export const runtime = 'nodejs';

type NativeBaziAction = 'classical' | 'analyze' | 'fortune-record' | 'report';

interface NativeBaziRequest {
  action?: NativeBaziAction;
  input?: BaziInput;
  params?: Record<string, unknown>;
  calendarType?: 'solar' | 'lunar';
  lunar?: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute?: number;
    isLeapMonth?: boolean;
    location?: BaziInput['location'];
  };
  context?: { name?: string; gender?: string; birthDate?: string };
}

const numberValue = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const textValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

function inputFromParams(params: Record<string, unknown>): BaziInput | null {
  const direct = params.mode === 'bazi' || (params.gans && params.zhis);
  if (direct) {
    const gans = String(params.gans ?? '').split(',').map((item) => item.trim()).filter(Boolean);
    const zhis = String(params.zhis ?? '').split(',').map((item) => item.trim()).filter(Boolean);
    if (gans.length !== 4 || zhis.length !== 4) return null;
    return { year: 2000, month: 1, day: 1, hour: 0, minute: 0, directBazi: { gans, zhis } };
  }

  const year = numberValue(params.year ?? params.birthYear ?? params.solarYear);
  const month = numberValue(params.month ?? params.birthMonth ?? params.solarMonth);
  const day = numberValue(params.day ?? params.birthDay ?? params.solarDay);
  if (!year || !month || !day) return null;

  let location: BaziInput['location'];
  const province = textValue(params.province);
  const city = textValue(params.city);
  if (province && city) {
    location = { province, city, longitude: numberValue(params.longitude) ?? getCityLongitude(city) };
  }
  return {
    year,
    month,
    day,
    hour: numberValue(params.hour) ?? 12,
    minute: numberValue(params.minute) ?? 0,
    location,
  };
}

function normalizeInput(body: NativeBaziRequest | BaziInput): BaziInput | null {
  const wrapped = body as NativeBaziRequest;
  if (wrapped.calendarType === 'lunar' && wrapped.lunar) {
    const value = wrapped.lunar;
    const solar = Lunar.fromYmd(value.year, value.month, value.day, value.isLeapMonth ?? false).getSolar();
    const location = value.location;
    if (location && !Number.isFinite(location.longitude)) location.longitude = getCityLongitude(location.city);
    return {
      year: solar.getYear(),
      month: solar.getMonth(),
      day: solar.getDay(),
      hour: value.hour,
      minute: value.minute ?? 0,
      location,
    };
  }
  if (wrapped.input) {
    const input = wrapped.input;
    if (input.location && !Number.isFinite(input.location.longitude)) {
      input.location.longitude = getCityLongitude(input.location.city);
    }
    return input;
  }
  if (wrapped.params) return inputFromParams(wrapped.params);
  const legacy = body as BaziInput;
  if (legacy.location && !Number.isFinite(legacy.location.longitude)) {
    legacy.location.longitude = getCityLongitude(legacy.location.city);
  }
  return typeof legacy.year === 'number' ? legacy : null;
}

function validateInput(input: BaziInput | null): input is BaziInput {
  if (!input) return false;
  if (input.directBazi) {
    return input.directBazi.gans.length === 4 && input.directBazi.zhis.length === 4;
  }
  const values = [input.year, input.month, input.day, input.hour, input.minute ?? 0];
  return values.every(Number.isFinite) && input.year >= 1900 && input.year <= 2100;
}

export async function GET() {
  return NextResponse.json({ provinces: domesticProvinces, cities: provinceData });
}

export async function POST(request: NextRequest) {
  let body: NativeBaziRequest | BaziInput;
  try {
    body = (await request.json()) as NativeBaziRequest | BaziInput;
  } catch {
    return NextResponse.json({ error: '出生信息格式无效' }, { status: 400 });
  }

  let input: BaziInput | null;
  try {
    input = normalizeInput(body);
  } catch {
    return NextResponse.json({ error: '农历日期无效，请重新选择' }, { status: 400 });
  }
  if (!validateInput(input)) {
    return NextResponse.json({ error: '请选择有效的出生日期和时间' }, { status: 400 });
  }

  const wrapped = body as NativeBaziRequest;
  const action = wrapped.action ?? 'classical';
  const params = wrapped.params ?? {};
  const context = {
    name: textValue(wrapped.context?.name ?? params.name),
    gender: textValue(wrapped.context?.gender ?? params.gender),
    birthDate: textValue(wrapped.context?.birthDate) ?? (input.directBazi
      ? undefined
      : `${input.year}年${input.month}月${input.day}日 ${String(input.hour).padStart(2, '0')}:${String(input.minute ?? 0).padStart(2, '0')}`),
  };

  try {
    if (action === 'classical') return NextResponse.json(generateClassicalBaziData(input));

    // 原生报告页：与网页 /report/classical 完全同源的数据（排盘 + 合冲 + 能量 + 大运 + 名帖日期）。
    if (action === 'report') {
      const classical = generateClassicalBaziData(input);
      const genderNum = context.gender === '坤造' ? 0 : 1;

      let solarObj: ReturnType<typeof Solar.fromYmdHms> | null = null;
      let solarDate = '';
      let lunarDate = '';
      let isInferred = false;

      if (input.directBazi) {
        const inferred = await inferDateFromBazi(input.directBazi.gans, input.directBazi.zhis);
        if (inferred) {
          solarDate = inferred.solarDateString;
          lunarDate = inferred.lunarDateString;
          isInferred = true;
          solarObj = inferred.solar;
        } else {
          solarDate = '未知日期';
          solarObj = Solar.fromYmdHms(input.year, input.month, input.day, input.hour, input.minute ?? 0, 0);
        }
      } else {
        solarObj = Solar.fromYmdHms(input.year, input.month, input.day, input.hour, input.minute ?? 0, 0);
        const lunar = solarObj.getLunar();
        const hh = String(input.hour).padStart(2, '0');
        const mm = String(input.minute ?? 0).padStart(2, '0');
        solarDate = `${input.year}年${input.month}月${input.day}日 ${hh}:${mm}`;
        lunarDate = `${lunar.getYear()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()} ${hh}:${mm}`;
      }

      const analysis = analyzeBazi(input);
      const importData = buildBaziImportData(input, context);
      const recordParams: Record<string, string | number> = input.directBazi ? {
        mode: 'bazi',
        gans: input.directBazi.gans.join(','),
        zhis: input.directBazi.zhis.join(','),
        name: context.name ?? '',
        gender: context.gender ?? '',
      } : {
        mode: 'date', year: input.year, month: input.month, day: input.day,
        hour: input.hour, minute: input.minute ?? 0,
        name: context.name ?? '', gender: context.gender ?? '',
        province: input.location?.province ?? '', city: input.location?.city ?? '',
        longitude: input.location?.longitude ?? 120,
      };

      return NextResponse.json({
        classical,
        interactions: calculateInteractions(classical),
        textual: getBaziTextualAnalysis(classical),
        energyProfile: calculateEnergyProfile(classical),
        luckCycles: calculateLuckCycles(solarObj, genderNum, classical),
        displayInfo: {
          name: context.name ?? '命主',
          gender: context.gender ?? '乾造',
          solarDate,
          lunarDate,
          isInferred,
        },
        analysis,
        importData,
        recordParams,
      });
    }

    const analysis = analyzeBazi(input);
    const importData = buildBaziImportData(input, context);
    const recordParams: Record<string, string | number> = input.directBazi ? {
      mode: 'bazi',
      gans: input.directBazi.gans.join(','),
      zhis: input.directBazi.zhis.join(','),
      name: context.name ?? '',
      gender: context.gender ?? '',
    } : {
      mode: 'date', year: input.year, month: input.month, day: input.day,
      hour: input.hour, minute: input.minute ?? 0,
      name: context.name ?? '', gender: context.gender ?? '',
      province: input.location?.province ?? '', city: input.location?.city ?? '',
      longitude: input.location?.longitude ?? 120,
    };
    const result = {
      analysis,
      classical: generateClassicalBaziData(input),
      importData,
      recordParams,
    };

    if (action === 'fortune-record') {
      return NextResponse.json({
        ...result,
        yongshen: analysis.trueGod,
        pillars: analysis.pillars,
        hasHour: input.directBazi ? true : params.hour !== undefined && params.hour !== null && params.hour !== '',
        name: context.name,
      });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('native bazi calculation failed:', error);
    return NextResponse.json({ error: '排盘计算失败，请检查出生信息' }, { status: 400 });
  }
}
