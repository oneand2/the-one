// 八字命理逻辑引擎
import { Lunar } from 'lunar-typescript';
// @ts-ignore
import { Solar, Lunar as LunarJS, EightChar, LunarUtil, SixtyCycle } from 'lunar-javascript';

const TRUE_SOLAR_BASE_LONGITUDE = 120;

/**
 * 根据经度计算真太阳时修正后的时辰
 * 注意：只修正时辰，不改变日期
 */
const getBaziFromSolar = (solar: any, longitude?: number) => {
  const baseBazi = solar.getLunar().getEightChar();
  let timeGan = baseBazi.getTimeGan();
  let timeZhi = baseBazi.getTimeZhi();

  // 如果提供了经度，则计算真太阳时修正
  if (typeof longitude === 'number' && !Number.isNaN(longitude)) {
    const longitudeDiff = longitude - TRUE_SOLAR_BASE_LONGITUDE;
    
    // 只有经度差异显著时才进行修正
    if (Math.abs(longitudeDiff) >= 0.0001) {
      // 每15度经度对应1小时，计算时间差（单位：分钟）
      const minutesDiff = (longitudeDiff / 15) * 60;
      
      // 计算修正后的时间（用于判定时辰）
      const originalHour = solar.getHour();
      const originalMinute = solar.getMinute();
      const totalMinutes = originalHour * 60 + originalMinute + minutesDiff;
      
      // 修正后的小时和分钟（可能会超过24小时或小于0）
      let correctedHour = Math.floor(totalMinutes / 60);
      let correctedMinute = Math.floor(totalMinutes % 60);
      
      // 处理分钟的负数情况
      if (correctedMinute < 0) {
        correctedMinute += 60;
        correctedHour -= 1;
      }
      
      // 处理小时的跨日情况（但保持在同一天内，因为真太阳时修正最多±2小时）
      // 用于排时柱时，只需要知道是哪个时辰，不需要改变日期
      correctedHour = ((correctedHour % 24) + 24) % 24;
      
      // 用修正后的时间创建新的Solar对象（日期不变，只改时间）
      const correctedSolar = Solar.fromYmdHms(
        solar.getYear(),
        solar.getMonth(),
        solar.getDay(),
        correctedHour,
        correctedMinute,
        0
      );
      
      const correctedBazi = correctedSolar.getLunar().getEightChar();
      timeGan = correctedBazi.getTimeGan();
      timeZhi = correctedBazi.getTimeZhi();
    }
  }

  return {
    yearGan: baseBazi.getYearGan(),
    yearZhi: baseBazi.getYearZhi(),
    monthGan: baseBazi.getMonthGan(),
    monthZhi: baseBazi.getMonthZhi(),
    dayGan: baseBazi.getDayGan(),
    dayZhi: baseBazi.getDayZhi(),
    hourGan: timeGan,
    hourZhi: timeZhi
  };
};

/**
 * 验证lunar-typescript库的基本功能
 */
export function validateLunarLibrary(): boolean {
  try {
    const lunar = Lunar.fromYmdHms(1990, 1, 1, 12, 0, 0);
    const bazi = lunar.getEightChar();

    // 检查八字信息
    const checks = [
      bazi.getYearGan().length === 1,
      bazi.getYearZhi().length === 1,
      bazi.getMonthGan().length === 1,
      bazi.getMonthZhi().length === 1,
      bazi.getDayGan().length === 1,
      bazi.getDayZhi().length === 1
    ];

    return checks.every(c => c);
  } catch (error) {
    console.error('lunar-typescript库验证失败:', error);
    return false;
  }
}

/**
 * 测试getSs函数的边界情况
 */
export function testGetSsFunction(): boolean {
  try {
    const swDict: Record<string, string> = {
      '甲': '木', '乙': '木', '丙': '火', '丁': '火',
      '戊': '土', '己': '土', '庚': '金', '辛': '金',
      '壬': '水', '癸': '水'
    };

    const relDict: Record<string, Record<string, string>> = {
      '木': { '生': '火', '克': '土' },
      '火': { '生': '土', '克': '金' },
      '土': { '生': '金', '克': '水' },
      '金': { '生': '水', '克': '木' },
      '水': { '生': '木', '克': '火' }
    };

    const getSs = (dm: string, target: string, swDict: Record<string, string>, relDict: Record<string, Record<string, string>>): string => {
      // 严格检查输入参数
      const sw = swDict[dm];
      const tw = swDict[target];

      // 如果日主五行或目标五行不存在，返回未知
      if (!sw || !tw) return "未知";

      // 如果五行关系字典中没有对应的关系，返回未知
      if (!relDict[sw] || !relDict[tw]) return "未知";

      const stemsYy: Record<string, number> = {
        '甲': 1, '丙': 1, '戊': 1, '庚': 1, '壬': 1,
        '乙': 0, '丁': 0, '己': 0, '辛': 0, '癸': 0
      };

      const isSame = stemsYy[dm] === stemsYy[target];

      if (sw === tw) return isSame ? "比肩" : "劫财";
      if (relDict[sw]['生'] === tw) return isSame ? "食神" : "伤官";
      if (relDict[tw]['生'] === sw) return isSame ? "枭神" : "正印";
      if (relDict[sw]['克'] === tw) return isSame ? "偏财" : "正财";
      if (relDict[tw]['克'] === sw) return isSame ? "七杀" : "正官";
      return "未知";
    };

    // 测试边界情况
    const tests = [
      // 正常情况
      { dm: '甲', target: '乙', expected: '比肩' }, // 都是木，阴阳相同
      { dm: '甲', target: '庚', expected: '正官' }, // 木生金，阴阳不同
      // 边界情况 - 不存在的五行
      { dm: '不存在', target: '甲', expected: '未知' },
      { dm: '甲', target: '不存在', expected: '未知' },
      // 边界情况 - 不存在的关系
      { dm: '甲', target: '乙', expected: '比肩' } // 正常情况
    ];

    return tests.every(test => {
      const result = getSs(test.dm, test.target, swDict, relDict);
      return result === test.expected;
    });
  } catch (error) {
    console.error('getSs函数测试失败:', error);
    return false;
  }
}

/**
 * 测试八字转换中转层是否有效
 */
export function testBaziConversion(): boolean {
  try {
    // 测试一个正常的输入
    const testInput = {
      year: 1990,
      month: 1,
      day: 1,
      hour: 12
    };

    const result = analyzeBazi(testInput);

    // 检查八字转换结果是否正确
    const checks = [
      // 检查pillars是否包含正确的数据
      result.pillars.year.gan && result.pillars.year.gan.length === 1,
      result.pillars.year.zhi && result.pillars.year.zhi.length === 1,
      result.pillars.month.gan && result.pillars.month.gan.length === 1,
      result.pillars.month.zhi && result.pillars.month.zhi.length === 1,
      result.pillars.day.gan && result.pillars.day.gan.length === 1,
      result.pillars.day.zhi && result.pillars.day.zhi.length === 1,
      result.pillars.hour.gan && result.pillars.hour.gan.length === 1,
      result.pillars.hour.zhi && result.pillars.hour.zhi.length === 1,
      // 检查八字是否在预期的汉字范围内
      ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'].includes(result.pillars.day.gan),
      ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'].includes(result.pillars.day.zhi)
    ];

    return checks.every(check => check === true);
  } catch (error) {
    console.error('八字转换测试失败:', error);
    return false;
  }
}

/**
 * 测试NaN修复是否有效
 */
export function testNaNFix(): boolean {
  try {
    // 创建一个可能导致NaN的情况
    const testInput = {
      year: 1990,
      month: 1,
      day: 1,
      hour: 12
    };

    const result = analyzeBazi(testInput);

    // 检查所有数值字段是否都有效（不为NaN）
    const checks = [
      !isNaN(result.peerEnergyPercent),
      Object.values(result.ssDistribution).every(v => !isNaN(v)),
      Object.values(result.energyDistribution).every(v => !isNaN(v)),
      Object.values(result.stemDetails).every(stem => !isNaN(stem.pct || 0))
    ];

    return checks.every(check => check);
  } catch (error) {
    console.error('NaN修复测试失败:', error);
    return false;
  }
}

/**
 * 测试八字命理分析功能是否正常工作
 */
export function testBaziAnalysis(): boolean {
  try {
    // 测试一个正常的输入
    const testInput = {
      year: 1990,
      month: 1,
      day: 1,
      hour: 12
    };

    const result = analyzeBazi(testInput);

    // 检查结果是否包含必要字段
    const requiredFields = [
      'pillars', 'mbti', 'dominantFunction', 'auxiliaryFunction',
      'inferiorFunction', 'pattern', 'strength', 'peerEnergyPercent',
      'climateGod', 'trueGod', 'ssDistribution', 'energyDistribution',
      'stemDetails', 'report'
    ];

    return requiredFields.every(field => field in result);
  } catch (error) {
    console.error('八字命理分析测试失败:', error);
    return false;
  }
}

// 定义输入输出接口
export interface BaziInput {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute?: number;
  directBazi?: {
    gans: string[];
    zhis: string[];
  };
  location?: {
    province: string;
    city: string;
    longitude: number; // 经度，用于真太阳时校正
  };
}

export interface BaziPillar {
  gan: string;
  zhi: string;
}

export interface BaziResult {
  pillars: {
    year: BaziPillar;
    month: BaziPillar;
    day: BaziPillar;
    hour: BaziPillar;
  };
  mbti: string;
  dominantFunction: string;
  auxiliaryFunction: string;
  inferiorFunction: string;
  pattern: string;
  strength: string;
  peerEnergyPercent: number;
  climateGod: string;
  trueGod: string;
  ssDistribution: Record<string, number>;
  energyDistribution: Record<string, number>;
  stemDetails: Record<string, any>;
  report: string;
}

/**
 * 将公历日期转换为八字命理分析结果
 * @param input 公历年月日时
 * @returns 完整的八字命理分析结果
 */
export function analyzeBazi(input: BaziInput): BaziResult {
  // ================= PART 1: 中转层 - 将输入转换为八字干支 =================
  let gans: string[];
  let zhis: string[];
  let pillars: { year: BaziPillar; month: BaziPillar; day: BaziPillar; hour: BaziPillar };

  // 分支 A: 直接八字输入模式
  if (input.directBazi) {
    gans = input.directBazi.gans;
    zhis = input.directBazi.zhis;

    // 构建pillars对象用于返回结果
    pillars = {
      year: { gan: gans[0], zhi: zhis[0] },
      month: { gan: gans[1], zhi: zhis[1] },
      day: { gan: gans[2], zhi: zhis[2] },
      hour: { gan: gans[3], zhi: zhis[3] }
    };

    console.log('直接输入的八字:', { gans, zhis });
  }
  // 分支 B: 日期计算模式
  else {
    // 真太阳时校正
    const solarTime = Solar.fromYmdHms(input.year, input.month, input.day, input.hour, input.minute || 0, 0);
    const { yearGan, monthGan, dayGan, hourGan, yearZhi, monthZhi, dayZhi, hourZhi } =
      getBaziFromSolar(solarTime, input.location?.longitude);

    // 构建gans和zhis数组，与Python原代码期望的格式完全一致
    gans = [yearGan, monthGan, dayGan, hourGan];  // ['甲', '乙', '丙', '丁']
    zhis = [yearZhi, monthZhi, dayZhi, hourZhi];  // ['子', '丑', '寅', '卯']

    // 构建pillars对象用于返回结果
    pillars = {
      year: { gan: yearGan, zhi: yearZhi },
      month: { gan: monthGan, zhi: monthZhi },
      day: { gan: dayGan, zhi: dayZhi },
      hour: { gan: hourGan, zhi: hourZhi }
    };

    // 调试输出：验证八字转换结果
    console.log('转换出的八字:', { gans, zhis });
  }

  const dayMaster = gans[2];  // 日主（日干）
  const monthZhiForCalc = zhis[1];  // 月支用于后续计算

  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const stemWuxing: Record<string, string> = {
    '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土', '己': '土',
    '庚': '金', '辛': '金', '壬': '水', '癸': '水'
  };
  const dmWx = stemWuxing[dayMaster];

  // 藏干比例
  const zanggan: Record<string, Record<string, number>> = {
    '子': { '癸': 1.0 },
    '丑': { '己': 0.7, '癸': 0.2, '辛': 0.1 },
    '寅': { '甲': 0.7, '丙': 0.2, '戊': 0.1 },
    '卯': { '乙': 1.0 },
    '辰': { '戊': 0.7, '乙': 0.2, '癸': 0.1 },
    '巳': { '丙': 0.7, '戊': 0.2, '庚': 0.1 },
    '午': { '丁': 0.7, '己': 0.3 },
    '未': { '己': 0.7, '丁': 0.2, '乙': 0.1 },
    '申': { '庚': 0.7, '壬': 0.2, '戊': 0.1 },
    '酉': { '辛': 1.0 },
    '戌': { '戊': 0.7, '辛': 0.2, '丁': 0.1 },
    '亥': { '壬': 0.8, '甲': 0.2 }
  };

  const relationships: Record<string, Record<string, string>> = {
    '木': { '生': '火', '克': '土' },
    '火': { '生': '土', '克': '金' },
    '土': { '生': '金', '克': '水' },
    '金': { '生': '水', '克': '木' },
    '水': { '生': '木', '克': '火' }
  };

  const tempCoef: Record<string, number> = {
    '甲': 1, '乙': -1, '丙': 7, '丁': 4, '戊': 2, '己': -2,
    '庚': -1, '辛': -2, '壬': -6, '癸': -4
  };

  // 八字→MBTI 运行参数（测算 MBTI 时使用，冲合补偿在 PART 2 即用到）
  const BAZI_MBTI_PARAMS = {
    ss_mbti_weights: {
      "比肩": { Fi: 1.1272976009264932, Si: 0.1863814102337426, Te: 0.028233847020994463, Ti: 0.12619025142351841, Fe: 0.5063539735489445, Se: 0.04750643927511244, Ne: 0.2288940331477292, Ni: 0.04914244442346482 },
      "劫财": { Fe: 0.8339904239001248, Se: 0.06029630481607141, Te: 1.0130032077342419, Ti: 0.05798032519810626, Fi: 0.19419929116536636, Si: 0.2362482447450704, Ne: 0.012221296472533116, Ni: 0.10981074479289557 },
      "食神": { Fi: 0.1029270997261323, Ne: 1.221423597947489, Te: 0.04766758744569931, Ti: 0.05280170002818327, Fe: 0.04766758744569931, Se: 0.4319447873943418, Si: 0.04766758744569931, Ni: 0.34790005256675566 },
      "伤官": { Ne: 0.79796184802047398, Ti: 0.28655711351256824, Te: 0.2818667704815759, Fe: 0.14872303509699475, Fi: 0.21097103135364315, Se: 0.275566927839208, Si: 0.01410779346566536, Ni: 0.28424548022987056 },
      "正财": { Si: 0.024871628298928253, Te: 0.03509236761285633, Ti: 0.06691772068474677, Fe: 0.97818821086778849, Fi: 0.3338385057178014, Se: 0.30552734730653086, Ne: 0.012054959274314703, Ni: 0.38132758954048074 },
      "偏财": { Se: 0.03587249683594573, Te: 0.05819893761991663, Ti: 0.2037534413146295, Fe: 0.8885894448223746, Fi: 0.38539252468549157, Si: 0.392482885691753, Ne: 0.27890853876984056, Ni: 0.25680173026004824 },
      "正官": { Te: 0.1551263704367319, Si: 0.08258775257666712, Ti: 0.47380419949607714, Fe: 0.12062779895453588, Fi: 0.30291872466162323, Se: 0.17155420488198786, Ne: 0.1293404928680672, Ni: 0.2640404561243095 },
      "七杀": { Te: 1.1981982935867653, Ni: 0.27345584792093314, Ti: 0.20382434748257502, Fe: 0.1154865347587994, Fi: 0.3834705261339111, Se: 0.27971544615187427, Si: 0.0695817306275623, Ne: 0.27626727333757944 },
      "正印": { Fe: 0.323119860391175234, Si: 0.901, Te: 0.01, Ti: 0.46249674766753607, Fi: 0.46824057318480844, Se: 0.0574045921798849, Ne: 0.5142061485396071, Ni: 0.4546286479879464 },
      "偏印": { Ni: 1.1805814560431654, Ti: 0.42394974063064682, Te: 0.38310783939831905, Fe: 0.07846294257978004, Fi: 0.01, Se: 0.04011878709778267, Si: 0.021715675876722566, Ne: 0.08555030011239435 },
      "枭神": { Ni: 1.08635681486845135, Ti: 0.70653056793881817, Te: 0.37557265582184295, Fe: 0.23260374691260582, Fi: 0.29208527021925743, Se: 0.1907372166472286, Si: 0.12731811769642984, Ne: 0.06986605626648905 },
      "偏官": { Te: 0.3655983972900388, Ni: 0.22532898641572194, Ti: 0.03953476103120464, Fe: 0.07253845811981734, Fi: 0.317999603683743, Se: 0.35598394857604154, Si: 0.32809227137502583, Ne: 0.01 }
    } as Record<string, Record<string, number>>,
    mbti_map: {
      "甲": { Te: 1.23443572403728782, Fi: 0.11558796533816014, Ti: 0.4705620975440448, Fe: 0.39039223063983824, Se: 0.13461286964025437, Si: 0.42334614852425073, Ne: 0.06316765745248096, Ni: 0.1678953068236827 },
      "乙": { Fe: 0.019109492919350074, Ne: 0.84997368212982486, Te: 0.019109492919350074, Ti: 0.019109492919350074, Fi: 0.4293462356642604, Se: 0.5251326176091642, Si: 0.019109492919350074, Ni: 0.019109492919350074 },
      "丙": { Se: 0.3385567918127332, Fe: 0.932900260388142, Te: 0.1357445326217361, Ti: 0.35005209408935034, Fi: 0.19134510715211622, Si: 0.25764531259723134, Ne: 0.24882441702507285, Ni: 0.2845417186629456 },
      "丁": { Ni: 0.8323136404142509, Ti: 0.34844479540108608, Te: 0.42193120919253135, Fe: 0.21713693915072724, Fi: 0.05294770841273588, Se: 0.13390283848689524, Si: 0.17571483747196412, Ne: 0.217608031469809 },
      "戊": { Si: 0.1646142330072045, Fi: 0.43352232958956973, Te: 0.01, Ti: 0.0738253677436321, Fe: 0.029956046665663438, Se: 0.777169585895979, Ne: 0.1009124370979512, Ni: 0.01 },
      "己": { Fe: 0.35376642945774667, Si: 0.011410580113885635, Te: 0.20044601524216302, Ti: 0.01, Fi: 0.23514572700265327, Se: 0.01, Ne: 0.7918762834307395, Ni: 0.38740775000610733 },
      "庚": { Te: 0.07824165322191358, Se: 0.11822277122885805, Ti: 0.045576763108743874, Fe: 0.32122859430813045, Fi: 0.03568392486829501, Si: 0.13897162832005802, Ne: 0.13507411483174242, Ni: 0.22700055011225867 },
      "辛": { Fi: 0.012163335020735355, Se: 0.2033122035640154, Te: 0.37347197450292086, Ti: 0.3312058990673226, Fe: 0.3706127341175688, Si: 0.04050120842915505, Ne: 0.3273704302101597, Ni: 0.3413622150881224 },
      "壬": { Ne: 0.01, Te: 0.1403790152254841, Ti: 0.41, Fe: 0.011488081163630292, Fi: 0.08487703714549497, Se: 0.1932207156040188, Si: 0.22656173822587852, Ni: 0.3234828444663765 },
      "癸": { Ni: 0.31, Fi: 0.01, Te: 0.07630995265459674, Ti: 1.2181176253833563, Fe: 0.2, Se: 0.6370981307431082, Si: 0.4438727233693656, Ne: 0.29460156784957303 }
    } as Record<string, Record<string, number>>,
    fitness: 50.0,
    compensation_params: { adjacent_clash_boost: 30.0, remote_clash_boost: 5.0, full_clash_boost: 130.0, six_combine_boost: 6.658452162258187, full_combine_boost: 100.0 },
    contribution_params: { phys_contribution_ratio: 0.50042442849570757, ss_contribution_ratio: 0.6155755715042924, activation_base: 8.322594297471033 },
    multiplier_params: { geju_mult: 2.075067010340313, day_master_mult: 2.5 },
    defense_params: { weak_defense_threshold: 23.254319515436514, strong_attack_threshold: 97.0, weak_defense_weights: { Fi: 0.9091873223445278 }, weak_defense_mult: 0.4615850087516475, strong_attack_weights: { Fi: 2.8162545768225424 }, strong_attack_mult: 1.2000000000000002 }
  };

  // ================= PART 2: 八字物理引擎 =================

  // 1. 寻找真神与合局
  let trueSeason = '';
  let seasonSource = "月令本气";
  const structureGroup = new Set<string>();
  let isBureau = false;

  const sanHui: [string[], string][] = [
    [['寅', '卯', '辰'], '木'],
    [['巳', '午', '未'], '火'],
    [['申', '酉', '戌'], '金'],
    [['亥', '子', '丑'], '水']
  ];

  const sanHe: [string[], string][] = [
    [['亥', '卯', '未'], '木'],
    [['寅', '午', '戌'], '火'],
    [['巳', '酉', '丑'], '金'],
    [['申', '子', '辰'], '水']
  ];

  const zhiSet = new Set(zhis);

  for (const [group, wx] of sanHui) {
    if (group.every(z => zhiSet.has(z))) {
      trueSeason = wx;
      seasonSource = `三会${wx}局`;
      structureGroup.clear();
      group.forEach(z => structureGroup.add(z));
      isBureau = true;
      break;
    }
  }

  if (!trueSeason) {
    for (const [group, wx] of sanHe) {
      if (group.every(z => zhiSet.has(z))) {
        trueSeason = wx;
        seasonSource = `三合${wx}局`;
        structureGroup.clear();
        group.forEach(z => structureGroup.add(z));
        isBureau = true;
        break;
      }
    }
  }

  const monthZhiData = zanggan[monthZhiForCalc] || {};
  const monthZhiKeys = Object.keys(monthZhiData);
  const monthMainStem = monthZhiKeys.length > 0 ? monthZhiKeys.reduce((a, b) =>
    (monthZhiData[a] || 0) > (monthZhiData[b] || 0) ? a : b
  ) : '';

  if (!trueSeason) {
    trueSeason = stemWuxing[monthMainStem];
    seasonSource = `月令${monthZhiForCalc}`;
  }

  // 2. 物理合冲判定
  const interactionLogs: string[] = [];
  const ganMods: number[] = [1.0, 1.0, 1.0, 1.0];
  const zhiMods: number[] = [1.0, 1.0, 1.0, 1.0];
  const isGanBound: boolean[] = [false, false, false, false];
  const isZhiBound: boolean[] = [false, false, false, false];

  // 天干合
  const ganHeMap = new Map([
    ['甲己', '土'], ['乙庚', '金'], ['丙辛', '水'], ['丁壬', '木'], ['戊癸', '火']
  ]);

  for (let i = 0; i < 3; i++) {
    const pair = gans[i] + gans[i + 1];
    if (ganHeMap.has(pair)) {
      const target = ganHeMap.get(pair)!;
      if (target === trueSeason) {
        interactionLogs.push(`✅ [合化成功] 天干 ${gans[i]}+${gans[i + 1]} -> 化为${target}`);
      } else {
        ganMods[i] *= 0.7;
        ganMods[i + 1] *= 0.7;
        isGanBound[i] = true;
        isGanBound[i + 1] = true;
        interactionLogs.push(`❌ [合化失败] 天干 ${gans[i]}+${gans[i + 1]} -> 合绊`);
      }
    }
  }

  // 地支合冲逻辑
  const comp = BAZI_MBTI_PARAMS.compensation_params;
  let clashNeBoost = 0.0;
  const liuHe = new Map([
    ['子丑', '土'], ['寅亥', '木'], ['卯戌', '火'], ['辰酉', '金'], ['午未', '土'], ['巳申', '水']
  ]);

  const chongs = [
    new Set(['子', '午']), new Set(['丑', '未']), new Set(['寅', '申']),
    new Set(['卯', '酉']), new Set(['辰', '戌']), new Set(['巳', '亥'])
  ];

  // A. 优先处理地支六合
  const combinedIndices = new Set<number>();
  let tempNiBoostSum = 0.0;

  for (let i = 0; i < 3; i++) {
    const pair = zhis[i] + zhis[i + 1];
    if (liuHe.has(pair)) {
      combinedIndices.add(i);
      combinedIndices.add(i + 1);
      tempNiBoostSum += comp.six_combine_boost;

      const target = liuHe.get(pair)!;
      if (target === trueSeason || target === stemWuxing[monthMainStem]) {
        interactionLogs.push(`✅ [合化成功] 地支 ${zhis[i]}+${zhis[i + 1]} -> 化为${target}`);
      } else {
        if (!isZhiBound[i]) {
          zhiMods[i] *= 0.7;
          isZhiBound[i] = true;
        }
        if (!isZhiBound[i + 1]) {
          zhiMods[i + 1] *= 0.7;
          isZhiBound[i + 1] = true;
        }
        interactionLogs.push(`❌ [合化失败] 地支 ${zhis[i]}+${zhis[i + 1]} -> 合绊 (保护机制：不重复扣分)`);
      }
    }
  }

  // 地支全合判定
  let combineNiBoost = 0.0;
  if (combinedIndices.size === 4) {
    combineNiBoost = comp.full_combine_boost;
    interactionLogs.push("🔒 [地支全合] 检测到四个地支全部卷入相合，触发极度内敛效应，Ni补偿强行设定");
  } else {
    combineNiBoost = tempNiBoostSum;
    if (combineNiBoost > 0) {
      interactionLogs.push(`🔗 [局部相合] 累计 Ni 补偿: +${combineNiBoost}%`);
    }
  }

  // B. 全局扫描地支相冲
  const clashedIndices = new Set<number>();
  let tempBoostSum = 0.0;

  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const pairSet = new Set([zhis[i], zhis[j]]);
      const isClash = chongs.some(chong => {
        return [...chong].every(c => pairSet.has(c));
      });

      if (isClash) {
        clashedIndices.add(i);
        clashedIndices.add(j);

        if (!structureGroup.has(zhis[i]) && !structureGroup.has(zhis[j])) {
          const dist = j - i;
          if (dist === 1) {
            zhiMods[i] *= 0.6;
            zhiMods[j] *= 0.6;
            tempBoostSum += comp.adjacent_clash_boost;
            interactionLogs.push(`⚔️ [相邻相冲] ${zhis[i]}与${zhis[j]}相邻，能量*0.6`);
          } else {
            zhiMods[i] *= 0.85;
            zhiMods[j] *= 0.85;
            tempBoostSum += comp.remote_clash_boost;
            interactionLogs.push(`⚔️ [不相邻冲] ${zhis[i]}与${zhis[j]}遥冲，能量*0.85`);
          }
        }
      }
    }
  }

  // 地支全冲判定
  if (clashedIndices.size === 4) {
    clashNeBoost = comp.full_clash_boost;
    interactionLogs.push("🌪️ [地支全冲] 检测到四个地支全部卷入相冲，触发极度动荡效应，Ne补偿强行设定");
  } else {
    clashNeBoost = tempBoostSum;
    if (clashNeBoost > 0) {
      interactionLogs.push(`✨ [局部相冲] 累计 Ne 补偿: +${clashNeBoost}%`);
    }
  }

  // 3. 能量物理计算
  const baseScoresGan: number[] = [100.0, 100.0, 100.0, 100.0];
  const baseScoresZhi: number[] = [100.0, 300.0, 100.0, 100.0];
  const ganScores: number[] = ganMods.map((mod, i) => baseScoresGan[i] * mod);

  const transmutationMap: Record<string, Record<string, number>> = {
    '木': { '甲': 0.5, '乙': 0.5 },
    '火': { '丙': 0.5, '丁': 0.5 },
    '土': { '戊': 0.5, '己': 0.5 },
    '金': { '庚': 0.5, '辛': 0.5 },
    '水': { '壬': 0.5, '癸': 0.5 }
  };

  const zhiStemScores: Record<string, number>[] = [];
  for (let i = 0; i < 4; i++) {
    const zhi = zhis[i];
    let breakdown: Record<string, number>;
    if (structureGroup.has(zhi) && trueSeason in transmutationMap) {
      breakdown = transmutationMap[trueSeason];
      interactionLogs.push(`🌀 [黑洞效应] ${zhi} 卷入${seasonSource} -> 变性为50%阳+50%阴`);
    } else {
      breakdown = zanggan[zhi] || {};
    }
    const stemScore: Record<string, number> = {};
    for (const [s, r] of Object.entries(breakdown)) {
      stemScore[s] = baseScoresZhi[i] * (r || 0) * zhiMods[i];
    }
    zhiStemScores.push(stemScore);
  }

  // 宏观季节修正
  const els = ['木', '火', '土', '金', '水'];
  const idx = els.indexOf(trueSeason);
  const seasonMult: Record<string, number> = {
    [els[idx]]: 1.5,
    [els[(idx + 1) % 5]]: 1.2,
    [els[(idx - 1 + 5) % 5]]: 0.9,
    [els[(idx + 2) % 5]]: 0.7,
    [els[(idx - 2 + 5) % 5]]: 0.8
  };

  for (let i = 0; i < 4; i++) {
    ganScores[i] *= seasonMult[stemWuxing[gans[i]]] || 1;
  }
  for (const zDict of zhiStemScores) {
    for (const s in zDict) {
      zDict[s] = (zDict[s] || 0) * (seasonMult[stemWuxing[s]] || 1);
    }
  }

  // 通根判定
  for (let i = 0; i < 4; i++) {
    const g = gans[i];
    const hasRoot = zhiStemScores.some(d => g in d && (d[g] || 0) > 0);
    if (!hasRoot) {
      ganScores[i] *= 0.6;
      interactionLogs.push(`🍃 [虚浮无根] 天干${g} 能量减损`);
    }
  }

  // 流通模型：根据干支生克修正能量
  for (let i = 0; i < 4; i++) {
    if (!zhiStemScores[i]) continue;

    const gWx = stemWuxing[gans[i]];
    const currentZhiStem = zhiStemScores[i] || {};
    const zhiStemKeys = Object.keys(currentZhiStem);

    // 检查是否有藏干，如果没有则跳过当前循环
    if (zhiStemKeys.length === 0) continue;

    const zMainStem = zhiStemKeys.reduce((a, b) =>
      (currentZhiStem[a] || 0) > (currentZhiStem[b] || 0) ? a : b
    );
    const zWx = stemWuxing[zMainStem];

    // 月柱独立计算规则
    if (i === 1) {
      if (gWx === zWx) {
        ganScores[i] *= 1.2;
        for (const s in currentZhiStem) currentZhiStem[s] = (currentZhiStem[s] || 0) * 1.05;
        interactionLogs.push(`👑 [月令主宰-同气] 月柱${gans[i]}${zhis[i]}，天干*1.2，地支*1.05`);
      } else if (relationships[zWx]['生'] === gWx) {
        ganScores[i] *= 1.2;
        interactionLogs.push(`👑 [月令主宰-得生] 月支${zhis[i]}生天干${gans[i]}，天干*1.2`);
      } else if (relationships[gWx]['生'] === zWx) {
        ganScores[i] *= 0.8;
        for (const s in currentZhiStem) currentZhiStem[s] = (currentZhiStem[s] || 0) * 1.1;
        interactionLogs.push(`👑 [月令主宰-泄秀] 天干${gans[i]}生月支${zhis[i]}，天干*0.8，月支*1.1`);
      } else if (relationships[zWx]['克'] === gWx) {
        ganScores[i] *= 0.65;
        for (const s in currentZhiStem) currentZhiStem[s] = (currentZhiStem[s] || 0) * 0.95;
        interactionLogs.push(`👑 [月令主宰-截脚] 月支${zhis[i]}克天干${gans[i]}，天干受重挫*0.65，月支*0.95`);
      } else if (relationships[gWx]['克'] === zWx) {
        ganScores[i] *= 0.8;
        for (const s in currentZhiStem) currentZhiStem[s] = (currentZhiStem[s] || 0) * 0.9;
        interactionLogs.push(`👑 [月令主宰-盖头] 天干${gans[i]}克月支${zhis[i]}，天干耗力*0.8，月支*0.9`);
      }
    } else {
      // 其他三柱保留原规则
      if (gWx === zWx) {
        ganScores[i] *= 1.3;
        interactionLogs.push(`🌲 [同气] ${gans[i]}坐${zhis[i]}，天干强根*1.3`);
      } else if (relationships[zWx]['生'] === gWx) {
        ganScores[i] *= 1.2;
        for (const s in currentZhiStem) currentZhiStem[s] = (currentZhiStem[s] || 0) * 0.9;
        interactionLogs.push(`💧 [得生] ${zhis[i]}生${gans[i]}，天干*1.2，地支泄气*0.9`);
      } else if (relationships[gWx]['生'] === zWx) {
        ganScores[i] *= 0.8;
        for (const s in currentZhiStem) currentZhiStem[s] = (currentZhiStem[s] || 0) * 1.1;
        interactionLogs.push(`🔥 [泄秀] ${gans[i]}生${zhis[i]}，天干泄气*0.8，地支受生*1.1`);
      } else if (relationships[zWx]['克'] === gWx) {
        ganScores[i] *= 0.7;
        for (const s in currentZhiStem) currentZhiStem[s] = (currentZhiStem[s] || 0) * 0.9;
        interactionLogs.push(`⚔️ [截脚] ${zhis[i]}克${gans[i]}，天干受制*0.7，地支耗力*0.9`);
      } else if (relationships[gWx]['克'] === zWx) {
        ganScores[i] *= 0.8;
        for (const s in currentZhiStem) currentZhiStem[s] = (currentZhiStem[s] || 0) * 0.8;
        interactionLogs.push(`🔨 [盖头] ${gans[i]}克${zhis[i]}，天干耗力*0.8，地支受制*0.8`);
      }
    }
  }

  // 汇总能量
  const finalScores: Record<string, number> = {};
  for (const s of stems) finalScores[s] = 0.0;

  for (let i = 0; i < 4; i++) {
    finalScores[gans[i]] += ganScores[i];
  }

  for (const zDict of zhiStemScores) {
    for (const [s, v] of Object.entries(zDict)) {
      const isBureauElem = isBureau && stemWuxing[s] === trueSeason;
      const discount = (gans.includes(s) || isBureauElem) ? 1.0 : 0.8;
      finalScores[s] += (v || 0) * discount;
    }
  }

  const totalEnergy = Object.values(finalScores).reduce((sum, v) => sum + v, 0);

  // 计算环境气候指数
  const tempScore = Object.entries(finalScores).reduce((sum, [s, v]) =>
    sum + v * (tempCoef[s] || 0), 0
  );

  // ================= PART 3: 格局辨析与双重判定用神引擎 =================

  const contrib = BAZI_MBTI_PARAMS.contribution_params;
  const mult = BAZI_MBTI_PARAMS.multiplier_params;
  const defense = BAZI_MBTI_PARAMS.defense_params;
  const ssMbtiWeights = BAZI_MBTI_PARAMS.ss_mbti_weights;
  const mbtiMapWeights = BAZI_MBTI_PARAMS.mbti_map;
  // 从 mbti_map 派生「主、次」功能，供成局变性等仍用双功能时的回退
  const mbtiMap: Record<string, [string, string]> = Object.fromEntries(
    (['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const).map(gan => {
      const w = mbtiMapWeights[gan];
      if (!w) return [gan, ['Ne', 'Ni'] as [string, string]];
      const sorted = (Object.entries(w) as [string, number][]).sort((a, b) => b[1] - a[1]);
      const top2 = sorted.slice(0, 2).map(([f]) => f);
      return [gan, [top2[0] || 'Ne', top2[1] || 'Ni'] as [string, string]];
    })
  ) as Record<string, [string, string]>;

  // 3. 十神判定与能量统计工具
  const getSs = (dm: string, target: string, swDict: Record<string, string>, relDict: Record<string, Record<string, string>>): string => {
    // 严格检查输入参数
    const sw = swDict[dm];
    const tw = swDict[target];

    // 如果日主五行或目标五行不存在，返回未知
    if (!sw || !tw) return "未知";

    // 如果五行关系字典中没有对应的关系，返回未知
    if (!relDict[sw] || !relDict[tw]) return "未知";

    const stemsYy: Record<string, number> = {
      '甲': 1, '丙': 1, '戊': 1, '庚': 1, '壬': 1,
      '乙': 0, '丁': 0, '己': 0, '辛': 0, '癸': 0
    };

    const isSame = stemsYy[dm] === stemsYy[target];

    if (sw === tw) return isSame ? "比肩" : "劫财";
    if (relDict[sw]['生'] === tw) return isSame ? "食神" : "伤官";
    if (relDict[tw]['生'] === sw) return isSame ? "枭神" : "正印";
    if (relDict[sw]['克'] === tw) return isSame ? "偏财" : "正财";
    if (relDict[tw]['克'] === sw) return isSame ? "七杀" : "正官";
    return "未知";
  };

  const ssToCat: Record<string, string> = {
    "比肩": "比劫", "劫财": "比劫", "食神": "食伤", "伤官": "食伤",
    "正财": "财星", "偏财": "财星", "正官": "官杀", "七杀": "官杀",
    "正印": "印枭", "枭神": "印枭"
  };

  const wuxingScores: Record<string, number> = {};
  for (const wx of ['木', '火', '土', '金', '水']) {
    wuxingScores[wx] = Object.entries(finalScores)
      .filter(([s]) => stemWuxing[s] === wx)
      .reduce((sum, [, v]) => sum + v, 0);
  }

  // 计算日主同党占比
  const selfEnergy = Object.entries(finalScores)
    .filter(([s]) => ssToCat[getSs(dayMaster, s, stemWuxing, relationships)] === "比劫")
    .reduce((sum, [, v]) => sum + v, 0);

  const indEnergy = Object.entries(finalScores)
    .filter(([s]) => ssToCat[getSs(dayMaster, s, stemWuxing, relationships)] === "印枭")
    .reduce((sum, [, v]) => sum + v, 0);

  const peerPct = totalEnergy > 0 ? ((selfEnergy + indEnergy) / totalEnergy) * 100 : 0;

  // 4. 强弱判定
  let status: string;
  let isStrong: boolean;

  if (peerPct > 90) {
    status = "专旺格";
    isStrong = true;
  } else if (peerPct < 24) {
    status = "身弱格";
    isStrong = false;
  } else {
    status = peerPct >= 72 ? "身强" : "中和";
    isStrong = peerPct >= 50;
  }

  // 5. 格局辨析逻辑
  let gegu = "普通格";
  let patternBaseSs = "未知";

  // 获取月令藏干及其属性
  const monthCang = zanggan[monthZhiForCalc] || {};
  const monthCangKeys = Object.keys(monthCang);
  const mainQiStem = monthCangKeys.length > 0 ? monthCangKeys.reduce((a, b) =>
    (monthCang[a] || 0) > (monthCang[b] || 0) ? a : b
  ) : '';
  const mainQiSs = getSs(dayMaster, mainQiStem, stemWuxing, relationships);

  if (isBureau) {
    // 成局逻辑优先
    let rawSs = "劫财";
    if (relationships[dmWx]['生'] === trueSeason) rawSs = "伤官";
    else if (relationships[trueSeason]['生'] === dmWx) rawSs = "枭神";
    else if (relationships[dmWx]['克'] === trueSeason) rawSs = "偏财";
    else if (relationships[trueSeason]['克'] === dmWx) rawSs = "七杀";

    patternBaseSs = { "比肩": "建禄", "劫财": "月劫" }[rawSs] || rawSs;
    gegu = `${trueSeason}${patternBaseSs}局`;
  } else {
    // 寻找透干定格
    const isLuJieMonth = mainQiSs === "比肩" || mainQiSs === "劫财";
    let foundPattern = false;

    const sortedCang = Object.entries(monthCang).sort(([, a], [, b]) => b - a);

    for (const [sItem, ratio] of sortedCang) {
      if (gans.includes(sItem)) {
        const ssTemp = getSs(dayMaster, sItem, stemWuxing, relationships);
        if (!["比肩", "劫财"].includes(ssTemp)) {
          patternBaseSs = ssTemp;
          gegu = `${patternBaseSs}格`;
          foundPattern = true;
          break;
        }
      }
    }

    // 若无他神透干，则看月令本气
    if (!foundPattern) {
      if (isLuJieMonth) {
        patternBaseSs = mainQiSs === "比肩" ? "建禄" : "月劫";
        gegu = `${patternBaseSs}格`;
      } else {
        patternBaseSs = mainQiSs;
        gegu = `${patternBaseSs}格(月令本气)`;
      }
    }
  }

  // 6. 格局喜忌与用神裁定
  const patternRules: Record<string, Record<string, [string[], string[]]>> = {
    "正官": {
      "Strong": [["财星", "食伤"], ["印枭"]],
      "Weak": [["印枭", "比劫"], ["财星", "食伤"]]
    },
    "七杀": {
      "Strong": [["食伤", "印枭"], ["财星"]],
      "Weak": [["印枭", "比劫"], ["财星", "食伤"]]
    },
    "正印": {
      "Strong": [["财星", "食伤"], ["印枭", "比劫"]],
      "Weak": [["官杀", "比劫"], ["财星"]]
    },
    "枭神": {
      "Strong": [["财星", "食伤"], ["印枭"]],
      "Weak": [["比劫", "官杀"], ["食伤"]]
    },
    "偏印": {
      "Strong": [["财星", "食伤"], ["印枭"]],
      "Weak": [["比劫", "官杀"], ["食伤"]]
    },
    "食神": {
      "Strong": [["财星", "官杀"], ["印枭"]],
      "Weak": [["印枭", "比劫"], ["财星", "食伤"]]
    },
    "伤官": {
      "Strong": [["财星", "印枭"], ["官杀"]],
      "Weak": [["印枭", "比劫"], ["官杀", "财星"]]
    },
    "正财": {
      "Strong": [["食伤", "官杀"], ["比劫"]],
      "Weak": [["比劫", "印枭"], ["食伤", "财星"]]
    },
    "偏财": {
      "Strong": [["食伤", "官杀"], ["比劫"]],
      "Weak": [["比劫", "印枭"], ["食伤", "财星"]]
    },
    "建禄": {
      "Strong": [["官杀", "财星", "食伤"], ["印枭"]],
      "Weak": [["印枭", "比劫"], ["官杀", "食伤"]]
    },
    "月劫": {
      "Strong": [["官杀", "财星", "食伤"], ["印枭"]],
      "Weak": [["印枭", "比劫"], ["官杀", "财星"]]
    }
  };

  let baseKey = "正官";
  for (const k of Object.keys(patternRules)) {
    if (gegu.includes(k)) {
      baseKey = k;
      break;
    }
  }

  const strengthKey = isStrong ? "Strong" : "Weak";
  const [prefCats, tabooCats] = patternRules[baseKey][strengthKey];

  // 用神引擎
  let climateGod = "无";
  let balanceGod = "无";
  let yongShen = "无";
  let decisionLog = "";

  const isHot = ['巳', '午', '未'].includes(monthZhiForCalc) ||
                 (['寅', '戌'].includes(monthZhiForCalc) && tempScore > 350);
  const isCold = ['亥', '子', '丑'].includes(monthZhiForCalc) ||
                  (['申', '辰'].includes(monthZhiForCalc) && tempScore < -350);

  let cTarget: string | null = null;
  if (isHot) cTarget = '水';
  else if (isCold) cTarget = '火';

  if (cTarget) {
    const existC = Object.keys(stemWuxing)
      .filter(s => stemWuxing[s] === cTarget && finalScores[s] > 0)
      .sort((a, b) => finalScores[b] - finalScores[a]);
    climateGod = existC.length > 0 ? existC[0] : `无(${cTarget})`;
  }

  // 扶抑字
  const godNatureRank: Record<string, number> = {
    "正官": 1, "正印": 1, "食神": 1, "正财": 1,
    "比肩": 2, "偏财": 2,
    "七杀": 3, "伤官": 3, "枭神": 3, "劫财": 3, "偏印": 3
  };

  const rawBalCats = isStrong ? ["官杀", "食伤", "财星"] : ["印枭", "比劫"];
  const filtBalCats = rawBalCats.filter(cat => !tabooCats.includes(cat));
  const finalBalCats = filtBalCats.length > 0 ? filtBalCats : prefCats;

  const candidatePool: Array<{
    stem: string;
    isPref: number;
    nature: number;
    score: number;
    name: string;
  }> = [];

  for (const s of stems) {
    if (finalScores[s] <= 0) continue;
    const ssName = getSs(dayMaster, s, stemWuxing, relationships);
    const ssCat = ssToCat[ssName];
    if (finalBalCats.includes(ssCat) || prefCats.includes(ssCat)) {
      candidatePool.push({
        stem: s,
        isPref: prefCats.includes(ssCat) ? 1 : 0,
        nature: godNatureRank[ssName] || 4,
        score: finalScores[s],
        name: ssName
      });
    }
  }

  if (candidatePool.length > 0) {
    candidatePool.sort((a, b) => {
      if (a.isPref !== b.isPref) return b.isPref - a.isPref;
      if (a.nature !== b.nature) return a.nature - b.nature;
      return b.score - a.score;
    });
    balanceGod = candidatePool[0].stem;
    decisionLog += ` | 综合选优: [${candidatePool[0].name}${balanceGod}]`;
  } else {
    balanceGod = "无";
  }

  // 真神裁定
  if (peerPct >= 24 && peerPct <= 72 && cTarget && !climateGod.includes("无")) {
    const cPct = totalEnergy > 0 ? (wuxingScores[cTarget] / totalEnergy) * 100 : 0;
    if (cPct > 25) {
      yongShen = balanceGod;
      decisionLog = "调候已足转向扶抑";
    } else {
      yongShen = climateGod;
      decisionLog = "气候优先";
    }
  } else {
    yongShen = balanceGod;
    decisionLog += " | 依强弱/喜忌定用";
  }

  // ================= PART 3.5: 传统能量基准（古典排盘） =================
  const classicalData = generateClassicalBaziData(input);
  const classicalProfile = calculateEnergyProfile(classicalData);
  const mbtiBaseScores = classicalProfile.core.finalScores;
  const mbtiBaseTotalEnergy = classicalProfile.core.totalEnergy;
  const mbtiPeerPct = classicalProfile.core.peerPct;
  const mbtiPatternBaseSs = classicalProfile.core.patternBaseSs;
  const mbtiTrueSeason = classicalProfile.core.trueSeason || trueSeason;
  const mbtiIsBureau = classicalProfile.core.isBureau;
  const {
    adjacent_clash_boost,
    remote_clash_boost,
    full_clash_boost,
    six_combine_boost,
    full_combine_boost
  } = BAZI_MBTI_PARAMS.compensation_params;

  const calcMbtiInteractionBoosts = (inputZhis: string[], group: Set<string>) => {
    const liuHe = new Map([
      ['子丑', '土'], ['寅亥', '木'], ['卯戌', '火'], ['辰酉', '金'], ['午未', '土'], ['巳申', '水']
    ]);
    const chongs = [
      new Set(['子', '午']), new Set(['丑', '未']), new Set(['寅', '申']),
      new Set(['卯', '酉']), new Set(['辰', '戌']), new Set(['巳', '亥'])
    ];

    const combinedIndices = new Set<number>();
    let tempNiBoostSum = 0.0;
    for (let i = 0; i < 3; i++) {
      const pair = inputZhis[i] + inputZhis[i + 1];
      if (liuHe.has(pair)) {
        combinedIndices.add(i);
        combinedIndices.add(i + 1);
        tempNiBoostSum += six_combine_boost;
      }
    }

    const combineNiBoost = combinedIndices.size === 4 ? full_combine_boost : tempNiBoostSum;

    const clashedIndices = new Set<number>();
    let tempBoostSum = 0.0;
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const pairSet = new Set([inputZhis[i], inputZhis[j]]);
        const isClash = chongs.some(chong => [...chong].every(c => pairSet.has(c)));
        if (isClash) {
          clashedIndices.add(i);
          clashedIndices.add(j);
          if (!group.has(inputZhis[i]) && !group.has(inputZhis[j])) {
            const dist = j - i;
            tempBoostSum += dist === 1 ? adjacent_clash_boost : remote_clash_boost;
          }
        }
      }
    }

    const clashNeBoost = clashedIndices.size === 4 ? full_clash_boost : tempBoostSum;
    return { clashNeBoost, combineNiBoost };
  };

  const { clashNeBoost: mbtiClashNeBoost, combineNiBoost: mbtiCombineNiBoost } =
    calcMbtiInteractionBoosts(zhis, structureGroup);

  // ================= PART 4: 初始化与显化模式设定 =================
  const sortedStemsByEnergy = Object.entries(mbtiBaseScores).sort(([, a], [, b]) => b - a);
  const domStemGlobal = sortedStemsByEnergy[0][0];

  const forcedModes: Record<string, number> = {};
  for (const [sName, sVal] of Object.entries(mbtiBaseScores)) {
    const sPct = mbtiBaseTotalEnergy > 0 ? (sVal / mbtiBaseTotalEnergy) * 100 : 0;
    if (sName === domStemGlobal) {
      forcedModes[sName] = 0; // 强显
    } else if (sPct < 10) {
      forcedModes[sName] = 1; // 强隐
    } else {
      forcedModes[sName] = sPct >= 15 ? 0 : 1;
    }
  }

  // 初始化能量池
  const mbtiWeightScores = { ...mbtiBaseScores };
  if (dayMaster in mbtiWeightScores) {
    mbtiWeightScores[dayMaster] *= mult.day_master_mult;
  }

  const mbtiTotalEnergy = Object.values(mbtiWeightScores).reduce((sum, v) => sum + v, 0);
  const eightFunctions: Record<string, number> = {
    'Te': 0.0, 'Ti': 0.0, 'Fe': 0.0, 'Fi': 0.0, 'Se': 0.0, 'Si': 0.0, 'Ne': 0.0, 'Ni': 0.0
  };
  const stemModes: Record<string, any> = {};

  // ================= PART 5: MBTI 映射与结算 =================
  const activationBase = contrib.activation_base;
  const bureauPhysMap: Record<string, [string, string]> = {
    "七杀": ["Te", "Fi"],
    "枭神": ["Ni", "Ni"],
    "伤官": ["Ne", "Ne"]
  };

  for (const [s, v] of Object.entries(mbtiWeightScores)) {
    if (v <= 0) continue;
    const pct = mbtiTotalEnergy > 0 ? (v / mbtiTotalEnergy) * 100 : 0;

    // 确定显化模式与变性基础判定
    const isTransformed = mbtiIsBureau && stemWuxing[s] === mbtiTrueSeason;
    const targetIdx = isTransformed ? 1 : forcedModes[s];

    // 十神变性逻辑
    let rawSs = getSs(dayMaster, s, stemWuxing, relationships);
    let physFuncs: [string, string];

    if (isTransformed) {
      if (["正官", "七杀"].includes(rawSs)) rawSs = "七杀";
      else if (["正印", "枭神"].includes(rawSs)) rawSs = "枭神";
      else if (["食神", "伤官"].includes(rawSs)) rawSs = "伤官";
      physFuncs = bureauPhysMap[rawSs] || mbtiMap[s] || ['Ne', 'Ni'];
    } else {
      physFuncs = mbtiMap[s] || ['Ne', 'Ni'];
    }

    // 十神权重分发与情感拆分
    let ssWeights: Record<string, number> = { ...(ssMbtiWeights[rawSs] || {}) };

    // 判定 A：身弱下的防御机制（参数：weak_defense_threshold / weak_defense_weights / weak_defense_mult）
    if (mbtiPeerPct < defense.weak_defense_threshold && ["七杀", "偏官", "伤官"].includes(rawSs)) {
      ssWeights = { ...defense.weak_defense_weights };
      for (const [func, weight] of Object.entries(ssMbtiWeights[rawSs] || {})) {
        ssWeights[func] = (ssWeights[func] || 0) + weight * defense.weak_defense_mult;
      }
    }
    // 判定 B：专旺下的内化机制（参数：strong_attack_threshold / strong_attack_weights / strong_attack_mult）
    else if (mbtiPeerPct > defense.strong_attack_threshold && ["偏印", "枭神", "劫财"].includes(rawSs)) {
      ssWeights = { ...defense.strong_attack_weights };
      for (const [func, weight] of Object.entries(ssMbtiWeights[rawSs] || {})) {
        ssWeights[func] = (ssWeights[func] || 0) + weight * defense.strong_attack_mult;
      }
    }

    // 核心权重解耦逻辑（contrib.phys_contribution_ratio / ss_contribution_ratio，格局用 geju_mult）
    const physContributionBase = pct;
    const ssContributionBase = rawSs === mbtiPatternBaseSs ?
      Math.max(pct, activationBase) * mult.geju_mult : pct;

    // 填充八维：物理部分按 mbti_map 八维权重 * phys_contribution_ratio；社会部分按 ss_contribution_ratio
    const ganWeights = mbtiMapWeights[s];
    if (ganWeights) {
      for (const [fName, w] of Object.entries(ganWeights)) {
        eightFunctions[fName] = (eightFunctions[fName] || 0) + (physContributionBase * contrib.phys_contribution_ratio) * (w || 0);
      }
    } else {
      const fPPhys = physFuncs[targetIdx];
      const fSPhys = physFuncs[1 - targetIdx];
      eightFunctions[fPPhys] += (physContributionBase * contrib.phys_contribution_ratio) * 0.9;
      eightFunctions[fSPhys] += (physContributionBase * contrib.phys_contribution_ratio) * 0.1;
    }

    for (const [fName, wRatio] of Object.entries(ssWeights)) {
      eightFunctions[fName] = (eightFunctions[fName] || 0) + (ssContributionBase * contrib.ss_contribution_ratio) * wRatio;
    }

    // 主功能用于 stemModes.func：优先取 mbti_map 中权重最高的维度
    const fPPhys = (ganWeights && Object.keys(ganWeights).length > 0)
      ? (Object.entries(ganWeights) as [string, number][]).sort((a, b) => b[1] - a[1])[0][0]
      : physFuncs[targetIdx];
    const modeLabel = targetIdx === 0 ? "显化" : "潜藏";
    const totalContribution = physContributionBase * contrib.phys_contribution_ratio + ssContributionBase * contrib.ss_contribution_ratio;
    stemModes[s] = {
      rawEnergy: totalContribution,
      displayPctRaw: pct,
      ss: rawSs,
      func: fPPhys,
      mode: modeLabel
    };
  }

  // ================= PART 6: 归一化与 MBTI 判定 =================
  eightFunctions['Ne'] += mbtiClashNeBoost;
  eightFunctions['Ni'] += mbtiCombineNiBoost;

  const totalMbtiScore = Object.values(eightFunctions).reduce((sum, v) => sum + v, 0);
  if (totalMbtiScore > 0) {
    for (const f of Object.keys(eightFunctions)) {
      eightFunctions[f] = (eightFunctions[f] / totalMbtiScore) * 100;
    }
  } else {
    // 如果总分为0，将所有函数设为0
    for (const f of Object.keys(eightFunctions)) {
      eightFunctions[f] = 0;
    }
  }

  // 物理占比归一化
  const totalPhysicalEnergy = Object.values(stemModes).reduce((sum, m) => sum + (m.displayPctRaw || 0), 0);
  if (totalPhysicalEnergy > 0) {
    for (const s of Object.keys(stemModes)) {
      stemModes[s].pct = Math.round(((stemModes[s].displayPctRaw || 0) / totalPhysicalEnergy) * 100 * 10) / 10;
    }
  } else {
    // 如果总物理能量为0，将所有pct设为0
    for (const s of Object.keys(stemModes)) {
      stemModes[s].pct = 0;
    }
  }

  // 判定 MBTI 标签
  const sortedF = Object.entries(eightFunctions).sort(([, a], [, b]) => b - a);
  const domFunc = sortedF[0][0];

  const mbtiStacks: Record<string, [string, string, string, string]> = {
    'INTJ': ['Ni', 'Te', 'Fi', 'Se'], 'INFJ': ['Ni', 'Fe', 'Ti', 'Se'],
    'ENTJ': ['Te', 'Ni', 'Se', 'Fi'], 'ENFJ': ['Fe', 'Ni', 'Se', 'Ti'],
    'ISTJ': ['Si', 'Te', 'Fi', 'Ne'], 'ISFJ': ['Si', 'Fe', 'Ti', 'Ne'],
    'ESTJ': ['Te', 'Si', 'Ne', 'Fi'], 'ESFJ': ['Fe', 'Si', 'Ne', 'Ti'],
    'INTP': ['Ti', 'Ne', 'Si', 'Fe'], 'ISTP': ['Ti', 'Se', 'Ni', 'Fe'],
    'ENTP': ['Ne', 'Ti', 'Fe', 'Si'], 'ESTP': ['Se', 'Ti', 'Fe', 'Si'],
    'INFP': ['Fi', 'Ne', 'Si', 'Te'], 'ISFP': ['Fi', 'Se', 'Ni', 'Te'],
    'ENFP': ['Ne', 'Fi', 'Te', 'Si'], 'ESFP': ['Se', 'Fi', 'Te', 'Si']
  };

  let mbtiLabel = "未知";
  const candidates = Object.keys(mbtiStacks).filter(name => mbtiStacks[name][0] === domFunc);
  if (candidates.length >= 2) {
    candidates.sort((a, b) => eightFunctions[mbtiStacks[b][1]] - eightFunctions[mbtiStacks[a][1]]);
    mbtiLabel = candidates[0];
  } else if (candidates.length === 1) {
    mbtiLabel = candidates[0];
  }

  // 结果追溯
  const finalStack = mbtiStacks[mbtiLabel] || [domFunc, "未知", "未知", "未知"];
  const [domFuncResult, auxFunc, , infAnchor] = finalStack;

  const domCandidates = Object.keys(stemModes).filter(s => stemModes[s].func === domFuncResult);
  const domStem = domCandidates.length > 0 ?
    domCandidates.reduce((a, b) => mbtiBaseScores[a] > mbtiBaseScores[b] ? a : b) : "混合";

  const auxCandidates = Object.keys(stemModes).filter(s => stemModes[s].func === auxFunc);
  const auxStem = auxCandidates.length > 0 ?
    auxCandidates.reduce((a, b) => mbtiBaseScores[a] > mbtiBaseScores[b] ? a : b) : "混合";

  // ================= PART 7: 报告生成 =================
  const ssDistribution: Record<string, number> = {};
  for (const [s, v] of Object.entries(stemModes)) {
    const ssName = v.ss;
    const pctValue = isNaN(v.pct) ? 0 : v.pct;
    ssDistribution[ssName] = (ssDistribution[ssName] || 0) + pctValue;
  }

  // 清理ssDistribution中的NaN值
  for (const key in ssDistribution) {
    if (isNaN(ssDistribution[key])) {
      ssDistribution[key] = 0;
    }
  }

  const sortedSs = Object.entries(ssDistribution).sort(([, a], [, b]) => b - a);
  const ssDistStr = sortedSs.filter(([, v]) => v > 0).map(([k, v]) => `- ${k}: ${v.toFixed(1)}%`);

  const energyDist = sortedF.filter(([, v]) => v > 0 && !isNaN(v)).map(([k, v]) => `- ${k}: ${v.toFixed(1)}%`);

  const stemDetailsEntries = Object.entries(stemModes).filter(([, v]) => v.pct > 0);
  const stemDetails = stemDetailsEntries.map(([k, v]) =>
    `- ${k} (${v.pct}%): ${v.ss} | ${v.mode} -> ${v.func}`
  );

  // 最终清理所有可能的NaN值
  const cleanValue = (val: any): number => isNaN(val) || val === undefined || val === null ? 0 : val;

  // 清理数值字段
  const cleanedPeerEnergyPercent = cleanValue(peerPct);
  const cleanedSsDistribution: Record<string, number> = {};
  for (const [key, value] of Object.entries(ssDistribution)) {
    cleanedSsDistribution[key] = cleanValue(value);
  }
  const cleanedEnergyDistribution: Record<string, number> = {};
  for (const [key, value] of Object.entries(eightFunctions)) {
    cleanedEnergyDistribution[key] = cleanValue(value);
  }

  const report = `
# 命理逻辑与性格画像报告

## 1. 核心性格结论
- **MBTI 判定**: **${mbtiLabel}**
- **主导功能 (Dom)**: ${domFuncResult} (${domStem} 能量主导)
- **辅助功能 (Aux)**: ${auxFunc} (${auxStem} 能量辅助)
- **劣势功能 (Inf)**: ${infAnchor}

## 2. 基础命盘与环境
- **格局判定**: ${gegu}
- **日主强弱**: ${status} (同党能量占比: ${cleanedPeerEnergyPercent.toFixed(1)}%)
- **调候用神**: ${climateGod}
- **最终真神**: **${yongShen}** (*${decisionLog}*)

## 3. 十神能量分布 (社会角色)
${ssDistStr.join('\n')}

## 4. 八维总能分布 (混合计算结果)
${energyDist.join('\n')}

## 5. 天干映射明细
${stemDetails.join('\n')}
`.trim();

  return {
    pillars,
    mbti: mbtiLabel,
    dominantFunction: domFuncResult,
    auxiliaryFunction: auxFunc,
    inferiorFunction: infAnchor,
    pattern: gegu,
    strength: status,
    peerEnergyPercent: cleanedPeerEnergyPercent,
    climateGod,
    trueGod: yongShen,
    ssDistribution: cleanedSsDistribution,
    energyDistribution: cleanedEnergyDistribution,
    stemDetails: stemModes,
    report
  };
}

// 古典排盘详细数据接口
export interface ClassicalBaziData {
  // 基础四柱
  pillars: {
    year: { gan: string; zhi: string; wuxing: string };
    month: { gan: string; zhi: string; wuxing: string };
    day: { gan: string; zhi: string; wuxing: string };
    hour: { gan: string; zhi: string; wuxing: string };
  };

  // 日主（日干）
  dayMaster: {
    gan: string;
    wuxing: string;
    tenGod: string; // 日干的十神（比肩、劫财等）
  };

  // 地支藏干
  hiddenStems: {
    [key: string]: { gan: string; wuxing: string; tenGod: string }[];
  };

  // 纳音五行
  nayin: {
    year: string;
    month: string;
    day: string;
    hour: string;
  };

  // 十神分析
  tenGods: {
    stems: { [key: string]: string }; // 天干十神
    hidden: { [key: string]: string[] }; // 藏干十神
  };

  // 神煞
  shenSha: {
    year: string[];
    month: string[];
    day: string[];
    hour: string[];
  };

  // 十二长生（星运）
  lifeCycle: {
    [key: string]: string; // 地支 -> 长生状态
  };

  // 自坐（地支自坐的十二长生状态）
  selfSeat: {
    [key: string]: string; // 地支 -> 自坐状态
  };

  // 空亡
  kongWang: {
    year: string;
    month: string;
    day: string;
    hour: string;
  };
}

/**
 * 生成古典排盘详细数据
 */
export function generateClassicalBaziData(input: BaziInput): ClassicalBaziData {
  let pillars: {
    year: { gan: string; zhi: string; wuxing: string };
    month: { gan: string; zhi: string; wuxing: string };
    day: { gan: string; zhi: string; wuxing: string };
    hour: { gan: string; zhi: string; wuxing: string };
  };
  let dayMasterGan: string;

  if (input.directBazi) {
    // 直接使用用户提供的八字
    const { gans, zhis } = input.directBazi;
    
    pillars = {
      year: {
        gan: gans[0],
        zhi: zhis[0],
        wuxing: getWuxingForGanZhi(gans[0] + zhis[0])
      },
      month: {
        gan: gans[1],
        zhi: zhis[1],
        wuxing: getWuxingForGanZhi(gans[1] + zhis[1])
      },
      day: {
        gan: gans[2],
        zhi: zhis[2],
        wuxing: getWuxingForGanZhi(gans[2] + zhis[2])
      },
      hour: {
        gan: gans[3],
        zhi: zhis[3],
        wuxing: getWuxingForGanZhi(gans[3] + zhis[3])
      }
    };
    
    dayMasterGan = gans[2]; // 日干
  } else {
    // 根据日期计算八字
    const solar = Solar.fromYmdHms(
      input.year,
      input.month,
      input.day,
      input.hour,
      input.minute || 0,
      0
    );
    const { yearGan, monthGan, dayGan, hourGan, yearZhi, monthZhi, dayZhi, hourZhi } =
      getBaziFromSolar(solar, input.location?.longitude);
    
    pillars = {
      year: {
        gan: yearGan,
        zhi: yearZhi,
        wuxing: getWuxingForGanZhi(yearGan + yearZhi)
      },
      month: {
        gan: monthGan,
        zhi: monthZhi,
        wuxing: getWuxingForGanZhi(monthGan + monthZhi)
      },
      day: {
        gan: dayGan,
        zhi: dayZhi,
        wuxing: getWuxingForGanZhi(dayGan + dayZhi)
      },
      hour: {
        gan: hourGan,
        zhi: hourZhi,
        wuxing: getWuxingForGanZhi(hourGan + hourZhi)
      }
    };
    dayMasterGan = dayGan;
  }

  // 日主
  const dayMaster = {
    gan: dayMasterGan,
    wuxing: getWuxingForGan(dayMasterGan),
    tenGod: getTenGod(dayMasterGan, dayMasterGan) // 日干对自己的十神是比肩
  };

  // 地支藏干
  const hiddenStems: { [key: string]: { gan: string; wuxing: string; tenGod: string }[] } = {};
  const allZhis = [pillars.year.zhi, pillars.month.zhi, pillars.day.zhi, pillars.hour.zhi];

  allZhis.forEach(zhi => {
    hiddenStems[zhi] = getHiddenStems(zhi).map(gan => ({
      gan,
      wuxing: getWuxingForGan(gan),
      tenGod: getTenGod(gan, dayMasterGan)
    }));
  });

  // 纳音
  const nayin = {
    year: getNayin(pillars.year.gan + pillars.year.zhi),
    month: getNayin(pillars.month.gan + pillars.month.zhi),
    day: getNayin(pillars.day.gan + pillars.day.zhi),
    hour: getNayin(pillars.hour.gan + pillars.hour.zhi)
  };

  // 十神分析
  const tenGods = {
    stems: {
      [pillars.year.gan]: getTenGod(pillars.year.gan, dayMasterGan),
      [pillars.month.gan]: getTenGod(pillars.month.gan, dayMasterGan),
      [pillars.day.gan]: getTenGod(pillars.day.gan, dayMasterGan),
      [pillars.hour.gan]: getTenGod(pillars.hour.gan, dayMasterGan)
    },
    hidden: Object.fromEntries(
      Object.entries(hiddenStems).map(([zhi, stems]) => [
        zhi,
        stems.map(stem => stem.tenGod)
      ])
    )
  };

  // 神煞（扩展为四柱）- 以日干为基准，增加位置参数和月支
  const yearZhi = pillars.year.zhi;
  const monthZhi = pillars.month.zhi;
  const allGans = [pillars.year.gan, pillars.month.gan, pillars.day.gan, pillars.hour.gan];
  const shenSha = {
    year: getShenSha('year', pillars.year.gan, pillars.year.zhi, dayMasterGan, monthZhi, yearZhi, pillars.day.zhi, pillars.year.gan, allGans),
    month: getShenSha('month', pillars.month.gan, pillars.month.zhi, dayMasterGan, monthZhi, yearZhi, pillars.day.zhi, pillars.year.gan, allGans),
    day: getShenSha('day', pillars.day.gan, pillars.day.zhi, dayMasterGan, monthZhi, yearZhi, pillars.day.zhi, pillars.year.gan, allGans),
    hour: getShenSha('hour', pillars.hour.gan, pillars.hour.zhi, dayMasterGan, monthZhi, yearZhi, pillars.day.zhi, pillars.year.gan, allGans)
  };

  // 十二长生（星运）
  const lifeCycle: { [key: string]: string } = {};
  const lifeCycleZhis = [pillars.year.zhi, pillars.month.zhi, pillars.day.zhi, pillars.hour.zhi];

  lifeCycleZhis.forEach(zhi => {
    lifeCycle[zhi] = getLifeCycle(dayMasterGan, zhi);
  });

  // 自坐
  const selfSeat: { [key: string]: string } = {};
  lifeCycleZhis.forEach(zhi => {
    selfSeat[zhi] = getSelfSeat(zhi);
  });

  // 空亡
  const kongWang = {
    year: getKongWang(pillars.year.gan + pillars.year.zhi),
    month: getKongWang(pillars.month.gan + pillars.month.zhi),
    day: getKongWang(pillars.day.gan + pillars.day.zhi),
    hour: getKongWang(pillars.hour.gan + pillars.hour.zhi)
  };

  return {
    pillars,
    dayMaster,
    hiddenStems,
    nayin,
    tenGods,
    shenSha,
    lifeCycle,
    selfSeat,
    kongWang
  };
}

// 辅助函数：获取天干五行
function getWuxingForGan(gan: string): string {
  const wuxingMap: { [key: string]: string } = {
    '甲': '木', '乙': '木',
    '丙': '火', '丁': '火',
    '戊': '土', '己': '土',
    '庚': '金', '辛': '金',
    '壬': '水', '癸': '水'
  };
  return wuxingMap[gan] || '未知';
}

// 辅助函数：获取干支组合五行（以天干为主）
function getWuxingForGanZhi(ganZhi: string): string {
  if (ganZhi.length >= 1) {
    return getWuxingForGan(ganZhi[0]);
  }
  return '未知';
}

// 辅助函数：获取十神
function getTenGod(targetGan: string, dayMasterGan: string): string {
  // 完整的十神映射表
  const tenGodMap: { [key: string]: { [key: string]: string } } = {
    '甲': {
      '甲': '比肩', '乙': '劫财', '丙': '食神', '丁': '伤官',
      '戊': '偏财', '己': '正财', '庚': '七杀', '辛': '正官',
      '壬': '偏印', '癸': '正印'
    },
    '乙': {
      '甲': '劫财', '乙': '比肩', '丙': '伤官', '丁': '食神',
      '戊': '正财', '己': '偏财', '庚': '正官', '辛': '七杀',
      '壬': '正印', '癸': '偏印'
    },
    '丙': {
      '甲': '偏印', '乙': '正印', '丙': '比肩', '丁': '劫财',
      '戊': '食神', '己': '伤官', '庚': '偏财', '辛': '正财',
      '壬': '七杀', '癸': '正官'
    },
    '丁': {
      '甲': '正印', '乙': '偏印', '丙': '劫财', '丁': '比肩',
      '戊': '伤官', '己': '食神', '庚': '正财', '辛': '偏财',
      '壬': '正官', '癸': '七杀'
    },
    '戊': {
      '甲': '七杀', '乙': '正官', '丙': '偏印', '丁': '正印',
      '戊': '比肩', '己': '劫财', '庚': '食神', '辛': '伤官',
      '壬': '偏财', '癸': '正财'
    },
    '己': {
      '甲': '正官', '乙': '七杀', '丙': '正印', '丁': '偏印',
      '戊': '劫财', '己': '比肩', '庚': '伤官', '辛': '食神',
      '壬': '正财', '癸': '偏财'
    },
    '庚': {
      '甲': '偏财', '乙': '正财', '丙': '七杀', '丁': '正官',
      '戊': '偏印', '己': '正印', '庚': '比肩', '辛': '劫财',
      '壬': '食神', '癸': '伤官'
    },
    '辛': {
      '甲': '正财', '乙': '偏财', '丙': '正官', '丁': '七杀',
      '戊': '正印', '己': '偏印', '庚': '劫财', '辛': '比肩',
      '壬': '伤官', '癸': '食神'
    },
    '壬': {
      '甲': '食神', '乙': '伤官', '丙': '偏财', '丁': '正财',
      '戊': '七杀', '己': '正官', '庚': '偏印', '辛': '正印',
      '壬': '比肩', '癸': '劫财'
    },
    '癸': {
      '甲': '伤官', '乙': '食神', '丙': '正财', '丁': '偏财',
      '戊': '正官', '己': '七杀', '庚': '正印', '辛': '偏印',
      '壬': '劫财', '癸': '比肩'
    }
  };

  return tenGodMap[dayMasterGan]?.[targetGan] || '未知';
}

// 辅助函数：获取地支藏干
function getHiddenStems(zhi: string): string[] {
  const hiddenStemMap: { [key: string]: string[] } = {
    '子': ['癸'],
    '丑': ['己', '癸', '辛'],
    '寅': ['甲', '丙', '戊'],
    '卯': ['乙'],
    '辰': ['戊', '乙', '癸'],
    '巳': ['丙', '庚', '戊'],
    '午': ['丁', '己'],
    '未': ['己', '丁', '乙'],
    '申': ['庚', '壬', '戊'],
    '酉': ['辛'],
    '戌': ['戊', '辛', '丁'],
    '亥': ['壬', '甲']
  };
  return hiddenStemMap[zhi] || [];
}

// 辅助函数：获取纳音（完整60甲子纳音表）
function getNayin(ganZhi: string): string {
  // 60甲子纳音完整映射表（100%准确）
  const nayinMap: { [key: string]: string } = {
    // 第一旬：甲子到癸酉（10个）
    '甲子': '海中金', '乙丑': '海中金',
    '丙寅': '炉中火', '丁卯': '炉中火',
    '戊辰': '大林木', '己巳': '大林木',
    '庚午': '路旁土', '辛未': '路旁土',
    '壬申': '剑锋金', '癸酉': '剑锋金',
    
    // 第二旬：甲戌到癸未（10个）
    '甲戌': '山头火', '乙亥': '山头火',
    '丙子': '涧下水', '丁丑': '涧下水',
    '戊寅': '城头土', '己卯': '城头土',
    '庚辰': '白蜡金', '辛巳': '白蜡金',
    '壬午': '杨柳木', '癸未': '杨柳木',
    
    // 第三旬：甲申到癸巳（10个）
    '甲申': '泉中水', '乙酉': '泉中水',
    '丙戌': '屋上土', '丁亥': '屋上土',
    '戊子': '霹雳火', '己丑': '霹雳火',
    '庚寅': '松柏木', '辛卯': '松柏木',
    '壬辰': '长流水', '癸巳': '长流水',
    
    // 第四旬：甲午到癸卯（10个）
    '甲午': '砂石金', '乙未': '砂石金',
    '丙申': '山下火', '丁酉': '山下火',
    '戊戌': '平地木', '己亥': '平地木',
    '庚子': '壁上土', '辛丑': '壁上土',
    '壬寅': '金箔金', '癸卯': '金箔金',
    
    // 第五旬：甲辰到癸丑（10个）
    '甲辰': '覆灯火', '乙巳': '覆灯火',
    '丙午': '天河水', '丁未': '天河水',
    '戊申': '大驿土', '己酉': '大驿土',
    '庚戌': '钗钏金', '辛亥': '钗钏金',
    '壬子': '桑柘木', '癸丑': '桑柘木',
    
    // 第六旬：甲寅到癸亥（10个）
    '甲寅': '大溪水', '乙卯': '大溪水',
    '丙辰': '沙中土', '丁巳': '沙中土',
    '戊午': '天上火', '己未': '天上火',
    '庚申': '石榴木', '辛酉': '石榴木',
    '壬戌': '大海水', '癸亥': '大海水'
  };
  
  return nayinMap[ganZhi] || '未知';
}

// 定义神煞字典 (方便扩展)
const SHEN_SHA_RULES = {
  // 十灵日 (日柱专有)
  tenSpirit: ['甲辰', '乙亥', '丙辰', '丁酉', '戊午', '庚戌', '庚寅', '辛亥', '壬寅', '癸未'],
  // 魁罡 (日柱专有)
  kuiGang: ['戊戌', '庚辰', '庚戌', '壬辰'],
  // 进神 (日柱专有)
  jinShen: ['甲子', '甲午', '己卯', '己酉'],
  // 阴阳差错 (日柱专有)
  yinYangChaCuo: ['丙子', '丙午', '丁丑', '丁未', '戊寅', '戊申', '辛卯', '辛酉', '壬辰', '壬戌', '癸巳', '癸亥'],
  // 孤鸾煞 (日柱专有)
  guLuan: ['丁巳', '戊申', '戊午', '辛亥', '壬子', '丙午', '壬辰', '癸巳']
};

// 辅助函数：获取神煞（完整版）
// @param location 当前柱位置 'year' | 'month' | 'day' | 'hour'
// @param gan 当前柱的天干
// @param zhi 当前柱的地支
// @param dayGan 日干（查贵人用）
// @param monthZhi 月支（查德贵人用）
// @param yearZhi 年支（查桃花/将星/华盖用）
type ShenShaMatch = { name: string; reason: string };

function getShenShaResult(
  location: 'year' | 'month' | 'day' | 'hour',
  gan: string,
  zhi: string,
  dayGan: string,
  monthZhi: string,
  yearZhi: string,
  dayZhi: string,
  yearGan?: string,
  allGans?: string[]
): { list: string[]; audit: ShenShaMatch[] } {
  const shenShaSet = new Set<string>();
  const audit: ShenShaMatch[] = [];
  const ganZhi = gan + zhi;

  const pushSha = (name: string, reason: string) => {
    if (!shenShaSet.has(name)) {
      shenShaSet.add(name);
      audit.push({ name, reason });
    }
  };

  const baseZhis = Array.from(new Set([yearZhi, dayZhi].filter(Boolean)));
  const yearBase = yearZhi ? [yearZhi] : [];
  const dayBase = dayZhi ? [dayZhi] : [];
  const sanHeRules = [
    { group: ['申', '子', '辰'], peach: '酉', yima: '寅', huagai: '辰', jiang: '子', jiesha: '巳', zaisha: '午', wangshen: '亥' },
    { group: ['寅', '午', '戌'], peach: '卯', yima: '申', huagai: '戌', jiang: '午', jiesha: '亥', zaisha: '子', wangshen: '巳' },
    { group: ['巳', '酉', '丑'], peach: '午', yima: '亥', huagai: '丑', jiang: '酉', jiesha: '寅', zaisha: '卯', wangshen: '申' },
    { group: ['亥', '卯', '未'], peach: '子', yima: '巳', huagai: '未', jiang: '卯', jiesha: '申', zaisha: '酉', wangshen: '寅' }
  ];

  const matchSanHeRule = (ruleKey: keyof (typeof sanHeRules)[number]) => {
    for (const base of baseZhis) {
      const rule = sanHeRules.find(item => item.group.includes(base));
      if (rule && rule[ruleKey] === zhi) {
        return base;
      }
    }
    return null;
  };

  const matchSanHeRuleByYear = (ruleKey: keyof (typeof sanHeRules)[number]) => {
    for (const base of yearBase) {
      const rule = sanHeRules.find(item => item.group.includes(base));
      if (rule && rule[ruleKey] === zhi) {
        return base;
      }
    }
    return null;
  };

  const matchSanHeRuleByDay = (ruleKey: keyof (typeof sanHeRules)[number]) => {
    for (const base of dayBase) {
      const rule = sanHeRules.find(item => item.group.includes(base));
      if (rule && rule[ruleKey] === zhi) {
        return base;
      }
    }
    return null;
  };

  // ==========================================
  // 1. 日柱专有神煞 (Strictly Day Pillar Only)
  // ==========================================
  if (location === 'day') {
    if (SHEN_SHA_RULES.tenSpirit.includes(ganZhi)) pushSha('十灵日', '日柱专有');
    if (SHEN_SHA_RULES.kuiGang.includes(ganZhi)) pushSha('魁罡格', '日柱专有');
    if (SHEN_SHA_RULES.jinShen.includes(ganZhi)) pushSha('进神', '日柱专有');
    if (SHEN_SHA_RULES.yinYangChaCuo.includes(ganZhi)) pushSha('阴阳差错', '日柱专有');
    if (SHEN_SHA_RULES.guLuan.includes(ganZhi)) pushSha('孤鸾煞', '日柱专有');
  }

  // ==========================================
  // 2. 通用神煞 (以日干查地支) - 天乙/文昌/羊刃/禄等
  // ==========================================

  // 天乙贵人（仅以日干查地支）
  const tianYiMatch = (baseGan?: string) => {
    if (!baseGan) return false;
    if ((baseGan === '甲' || baseGan === '戊' || baseGan === '庚') && (zhi === '丑' || zhi === '未')) return true;
    if ((baseGan === '乙' || baseGan === '己') && (zhi === '子' || zhi === '申')) return true;
    if ((baseGan === '丙' || baseGan === '丁') && (zhi === '亥' || zhi === '酉')) return true;
    if ((baseGan === '壬' || baseGan === '癸') && (zhi === '卯' || zhi === '巳')) return true;
    if (baseGan === '辛' && (zhi === '寅' || zhi === '午')) return true;
    return false;
  };
  if (tianYiMatch(dayGan)) pushSha('天乙贵人', `日干${dayGan}查贵人`);

  // 禄神（以日干查地支）
  const luShen: { [key: string]: string } = {
    '甲': '寅', '乙': '卯', '丙': '巳', '丁': '午',
    '戊': '巳', '己': '午', '庚': '申', '辛': '酉',
    '壬': '亥', '癸': '子'
  };
  if (luShen[dayGan] === zhi) pushSha('禄神', '以日干查地支');

  // 文昌贵人
  const wenChang: { [key: string]: string } = {
    '甲': '巳', '乙': '午', '丙': '申', '丁': '酉',
    '戊': '申', '己': '酉', '庚': '亥', '辛': '子',
    '壬': '寅', '癸': '卯'
  };
  if (wenChang[dayGan] === zhi) pushSha('文昌贵人', '以日干查地支');

  // 国印贵人
  const guoYin: { [key: string]: string } = {
    '甲': '戌', '乙': '亥', '丙': '丑', '丁': '丑',
    '戊': '丑', '己': '丑', '庚': '辰', '辛': '辰',
    '壬': '未', '癸': '未'
  };
  if (guoYin[dayGan] === zhi) pushSha('国印贵人', '以日干查地支');

  // 金舆（禄前二位：以日干/年干查地支）
  const jinYu: { [key: string]: string } = {
    '甲': '辰', '乙': '巳', '丙': '未', '丁': '未',
    '戊': '未', '己': '申', '庚': '戌', '辛': '亥',
    '壬': '丑', '癸': '寅'
  };
  if (jinYu[dayGan] === zhi) pushSha('金舆', `以日干${dayGan}查地支`);
  if (yearGan && jinYu[yearGan] === zhi) pushSha('金舆', `以年干${yearGan}查地支`);

  // 羊刃
  const yangRen: { [key: string]: string } = {
    '甲': '卯', '乙': '寅', '丙': '午', '丁': '巳',
    '戊': '午', '己': '巳', '庚': '酉', '辛': '申',
    '壬': '子', '癸': '亥'
  };
  if (yangRen[dayGan] === zhi) pushSha('羊刃', '以日干查地支');

  // 红艳
  const hongYan: { [key: string]: string } = {
    '甲': '午', '乙': '申', '丙': '寅', '丁': '未',
    '戊': '辰', '己': '辰', '庚': '戌', '辛': '酉',
    '壬': '子', '癸': '申'
  };
  if (hongYan[dayGan] === zhi) pushSha('红艳', '以日干查地支');

  // ==========================================
  // 3. 月令相关神煞 (以月支查天干/地支) - 天德/月德
  // ==========================================

  // 天德贵人 (正丁二申宫，三壬四辛同...)
  const tianDe: { [key: string]: string } = {
    '寅': '丁', '卯': '申', '辰': '壬', '巳': '辛',
    '午': '亥', '未': '甲', '申': '癸', '酉': '寅',
    '戌': '丙', '亥': '乙', '子': '巳', '丑': '庚'
  };
  const tianDeValue = tianDe[monthZhi];
  if (tianDeValue === gan || tianDeValue === zhi) pushSha('天德贵人', '以月令查天干/地支');

  // 月德贵人 (寅午戌月在丙...)
  const yueDe: { [key: string]: string } = {
    '寅': '丙', '午': '丙', '戌': '丙',
    '申': '壬', '子': '壬', '辰': '壬',
    '亥': '甲', '卯': '甲', '未': '甲',
    '巳': '庚', '酉': '庚', '丑': '庚'
  };
  const yueDeGan = yueDe[monthZhi];
  if (yueDeGan === gan) pushSha('月德贵人', '以月令查天干');

  // 天德合/月德合 (五合)
  const fiveCombine: { [key: string]: string } = {
    '甲': '己', '己': '甲', '乙': '庚', '庚': '乙',
    '丙': '辛', '辛': '丙', '丁': '壬', '壬': '丁',
    '戊': '癸', '癸': '戊'
  };
  if (tianDeValue && fiveCombine[tianDeValue] === gan) pushSha('天德合', '天德五合');
  if (yueDeGan && fiveCombine[yueDeGan] === gan) pushSha('月德合', '月德五合');

  // ==========================================
  // 4. 年/日支查桃花驿马 (以年支或日支查其他地支)
  // ==========================================

  const peachBase = matchSanHeRule('peach');
  if (peachBase) pushSha('桃花', `以${peachBase}支查桃花`);

  const yiMaBase = matchSanHeRule('yima');
  if (yiMaBase) pushSha('驿马', `以${yiMaBase}支查驿马`);

  const huaGaiBaseYear = matchSanHeRuleByYear('huagai');
  if (huaGaiBaseYear) pushSha('华盖', `以${huaGaiBaseYear}支查华盖`);
  const huaGaiBaseDay = matchSanHeRuleByDay('huagai');
  if (huaGaiBaseDay) pushSha('华盖', `以${huaGaiBaseDay}支查华盖`);

  const jiangBase = matchSanHeRule('jiang');
  if (jiangBase) pushSha('将星', `以${jiangBase}支查将星`);

  const jieShaBase = matchSanHeRule('jiesha');
  if (jieShaBase) pushSha('劫煞', `以${jieShaBase}支查劫煞`);

  const zaiShaBase = matchSanHeRule('zaisha');
  if (zaiShaBase) pushSha('灾煞', `以${zaiShaBase}支查灾煞`);

  const wangShenBase = matchSanHeRule('wangshen');
  if (wangShenBase) pushSha('亡神', `以${wangShenBase}支查亡神`);

  // 红鸾/天喜（以年支为准，天喜为红鸾对冲）
  const yearOrder = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const hongLuanOrder = ['卯', '寅', '丑', '子', '亥', '戌', '酉', '申', '未', '午', '巳', '辰'];
  const hongLuanMap: { [key: string]: string } = Object.fromEntries(
    yearOrder.map((y, i) => [y, hongLuanOrder[i]])
  );
  const chongMap: { [key: string]: string } = {
    '子': '午', '午': '子', '丑': '未', '未': '丑',
    '寅': '申', '申': '寅', '卯': '酉', '酉': '卯',
    '辰': '戌', '戌': '辰', '巳': '亥', '亥': '巳'
  };
  const hongLuanZhi = yearZhi ? hongLuanMap[yearZhi] : undefined;
  if (hongLuanZhi === zhi) pushSha('红鸾', `以年支${yearZhi}查红鸾`);
  const tianXiZhi = hongLuanZhi ? chongMap[hongLuanZhi] : undefined;
  if (tianXiZhi === zhi) pushSha('天喜', `以年支${yearZhi}查天喜`);

  // 寡宿（只以年支查地支）
  const guaXiu: { [key: string]: string } = {
    '亥': '戌', '子': '戌', '丑': '戌',
    '寅': '丑', '卯': '丑', '辰': '丑',
    '巳': '辰', '午': '辰', '未': '辰',
    '申': '未', '酉': '未', '戌': '未'
  };
  if (yearZhi && guaXiu[yearZhi] === zhi) pushSha('寡宿', `以年支${yearZhi}查寡宿`);

  // 去重并返回
  return { list: Array.from(shenShaSet), audit };
}

function getShenSha(
  location: 'year' | 'month' | 'day' | 'hour',
  gan: string,
  zhi: string,
  dayGan: string,
  monthZhi: string,
  yearZhi: string,
  dayZhi: string,
  yearGan?: string,
  allGans?: string[]
): string[] {
  return getShenShaResult(location, gan, zhi, dayGan, monthZhi, yearZhi, dayZhi, yearGan, allGans).list;
}

export function auditShenShaForPillars(baziData: ClassicalBaziData) {
  const yearGan = baziData.pillars.year.gan;
  const yearZhi = baziData.pillars.year.zhi;
  const monthZhi = baziData.pillars.month.zhi;
  const dayGan = baziData.pillars.day.gan;
  const dayZhi = baziData.pillars.day.zhi;
  const allGans = [
    baziData.pillars.year.gan,
    baziData.pillars.month.gan,
    baziData.pillars.day.gan,
    baziData.pillars.hour.gan
  ];
  const pillars = (['year', 'month', 'day', 'hour'] as const).reduce((acc, key) => {
    const pillar = baziData.pillars[key];
    acc[key] = getShenShaResult(
      key,
      pillar.gan,
      pillar.zhi,
      dayGan,
      monthZhi,
      yearZhi,
      dayZhi,
      yearGan,
      allGans
    );
    return acc;
  }, {} as Record<'year' | 'month' | 'day' | 'hour', { list: string[]; audit: ShenShaMatch[] }>);

  return pillars;
}
// 兼容旧接口：按柱计算神煞
function calculateShenShaForPillar(
  location: 'year' | 'month' | 'day' | 'hour',
  gan: string,
  zhi: string,
  dayGan: string,
  monthZhi: string,
  yearZhi: string,
  dayZhi: string,
  yearGan?: string,
  allGans?: string[]
): string[] {
  return getShenSha(location, gan, zhi, dayGan, monthZhi, yearZhi, dayZhi, yearGan, allGans);
}

// 辅助函数：获取十二长生
function getLifeCycle(dayMasterGan: string, zhi: string): string {
  // 完整的十二长生映射表
  const lifeCycleMap: { [key: string]: { [key: string]: string } } = {
    '甲': {
      '亥': '长生', '子': '沐浴', '丑': '冠带', '寅': '临官', '卯': '帝旺',
      '辰': '衰', '巳': '病', '午': '死', '未': '墓', '申': '绝', '酉': '胎', '戌': '养'
    },
    '乙': {
      '午': '长生', '巳': '沐浴', '辰': '冠带', '卯': '临官', '寅': '帝旺',
      '丑': '衰', '子': '病', '亥': '死', '戌': '墓', '酉': '绝', '申': '胎', '未': '养'
    },
    '丙': {
      '寅': '长生', '卯': '沐浴', '辰': '冠带', '巳': '临官', '午': '帝旺',
      '未': '衰', '申': '病', '酉': '死', '戌': '墓', '亥': '绝', '子': '胎', '丑': '养'
    },
    '丁': {
      '酉': '长生', '申': '沐浴', '未': '冠带', '午': '临官', '巳': '帝旺',
      '辰': '衰', '卯': '病', '寅': '死', '丑': '墓', '子': '绝', '亥': '胎', '戌': '养'
    },
    '戊': {
      '寅': '长生', '卯': '沐浴', '辰': '冠带', '巳': '临官', '午': '帝旺',
      '未': '衰', '申': '病', '酉': '死', '戌': '墓', '亥': '绝', '子': '胎', '丑': '养'
    },
    '己': {
      '酉': '长生', '申': '沐浴', '未': '冠带', '午': '临官', '巳': '帝旺',
      '辰': '衰', '卯': '病', '寅': '死', '丑': '墓', '子': '绝', '亥': '胎', '戌': '养'
    },
    '庚': {
      '巳': '长生', '午': '沐浴', '未': '冠带', '申': '临官', '酉': '帝旺',
      '戌': '衰', '亥': '病', '子': '死', '丑': '墓', '寅': '绝', '卯': '胎', '辰': '养'
    },
    '辛': {
      '子': '长生', '亥': '沐浴', '戌': '冠带', '酉': '临官', '申': '帝旺',
      '未': '衰', '午': '病', '巳': '死', '辰': '墓', '卯': '绝', '寅': '胎', '丑': '养'
    },
    '壬': {
      '申': '长生', '酉': '沐浴', '戌': '冠带', '亥': '临官', '子': '帝旺',
      '丑': '衰', '寅': '病', '卯': '死', '辰': '墓', '巳': '绝', '午': '胎', '未': '养'
    },
    '癸': {
      '卯': '长生', '寅': '沐浴', '丑': '冠带', '子': '临官', '亥': '帝旺',
      '戌': '衰', '酉': '病', '申': '死', '未': '墓', '午': '绝', '巳': '胎', '辰': '养'
    }
  };

  return lifeCycleMap[dayMasterGan]?.[zhi] || '未知';
}

// 辅助函数：计算空亡
function getKongWang(ganZhi: string): string {
  // 空亡查询表：根据日柱或年柱的干支组合查询空亡的地支
  const kongWangMap: { [key: string]: string } = {
    // 甲子旬（甲子、乙丑、丙寅、丁卯、戊辰、己巳、庚午、辛未、壬申、癸酉）空戌亥
    '甲子': '戌亥', '乙丑': '戌亥', '丙寅': '戌亥', '丁卯': '戌亥', '戊辰': '戌亥',
    '己巳': '戌亥', '庚午': '戌亥', '辛未': '戌亥', '壬申': '戌亥', '癸酉': '戌亥',
    // 甲戌旬（甲戌、乙亥、丙子、丁丑、戊寅、己卯、庚辰、辛巳、壬午、癸未）空申酉
    '甲戌': '申酉', '乙亥': '申酉', '丙子': '申酉', '丁丑': '申酉', '戊寅': '申酉',
    '己卯': '申酉', '庚辰': '申酉', '辛巳': '申酉', '壬午': '申酉', '癸未': '申酉',
    // 甲申旬（甲申、乙酉、丙戌、丁亥、戊子、己丑、庚寅、辛卯、壬辰、癸巳）空午未
    '甲申': '午未', '乙酉': '午未', '丙戌': '午未', '丁亥': '午未', '戊子': '午未',
    '己丑': '午未', '庚寅': '午未', '辛卯': '午未', '壬辰': '午未', '癸巳': '午未',
    // 甲午旬（甲午、乙未、丙申、丁酉、戊戌、己亥、庚子、辛丑、壬寅、癸卯）空辰巳
    '甲午': '辰巳', '乙未': '辰巳', '丙申': '辰巳', '丁酉': '辰巳', '戊戌': '辰巳',
    '己亥': '辰巳', '庚子': '辰巳', '辛丑': '辰巳', '壬寅': '辰巳', '癸卯': '辰巳',
    // 甲辰旬（甲辰、乙巳、丙午、丁未、戊申、己酉、庚戌、辛亥、壬子、癸丑）空寅卯
    '甲辰': '寅卯', '乙巳': '寅卯', '丙午': '寅卯', '丁未': '寅卯', '戊申': '寅卯',
    '己酉': '寅卯', '庚戌': '寅卯', '辛亥': '寅卯', '壬子': '寅卯', '癸丑': '寅卯',
    // 甲寅旬（甲寅、乙卯、丙辰、丁巳、戊午、己未、庚申、辛酉、壬戌、癸亥）空子丑
    '甲寅': '子丑', '乙卯': '子丑', '丙辰': '子丑', '丁巳': '子丑', '戊午': '子丑',
    '己未': '子丑', '庚申': '子丑', '辛酉': '子丑', '壬戌': '子丑', '癸亥': '子丑'
  };

  return kongWangMap[ganZhi] || '无';
}

// 辅助函数：计算自坐（地支的自身十二运状态）
function getSelfSeat(zhi: string): string {
  // 自坐十二运状态表 - 地支对自身的运势状态
  const selfSeatMap: { [key: string]: string } = {
    '子': '帝旺',  // 水旺于子
    '丑': '衰',    // 土在丑为衰
    '寅': '长生',  // 木长生于寅
    '卯': '帝旺',  // 木旺于卯
    '辰': '墓',    // 土在辰为墓
    '巳': '临官',  // 火临官于巳
    '午': '帝旺',  // 火旺于午
    '未': '墓',    // 土在未为墓
    '申': '长生',  // 金长生于申
    '酉': '帝旺',  // 金旺于酉
    '戌': '墓',    // 土在戌为墓
    '亥': '长生'   // 水长生于亥
  };

  return selfSeatMap[zhi] || '未知';
}

// ==================== 八字关系与能量流向计算 ====================

// 能量流向类型
export interface EnergyFlow {
  from: string;
  to: string;
  type: 'Sheng' | 'Ke'; // 生或克
  label: string;
  fromPillar: string; // 'year' | 'month' | 'day' | 'hour'
  toPillar: string;
  fromType: 'gan' | 'zhi'; // 天干或地支
  toType: 'gan' | 'zhi';
  sourceIndex?: number; // 节点索引（0-7）
  targetIndex?: number; // 节点索引（0-7）
}

// 特殊关系类型
export interface SpecialRelationship {
  chars: string[];
  type: 'TianGanHe' | 'DiZhiHe' | 'SanHe' | 'SanHui' | 'Chong' | 'Xing' | 'Hai' | 'He' | 'LiuHe';
  label: string;
  resultingElement?: string; // 合化后的五行
  pillars: string[]; // 涉及的柱位
  charTypes: ('gan' | 'zhi')[]; // 字符类型
  sourceIndex?: number; // 源节点索引（0-7）
  targetIndex?: number; // 目标节点索引（0-7）
  distance?: number; // 跨度（相隔的柱数）
}

// 八字关系分析结果
export interface BaziNode {
  id: string;
  text: string;
  wuxing: string;
  pillar: string;
  type: 'gan' | 'zhi';
}

export interface BaziInteractions {
  nodes: BaziNode[];
  flows: EnergyFlow[];
  relationships: SpecialRelationship[];
}

/**
 * 计算八字之间的复杂关系（生克、合冲刑害）
 */
export function calculateInteractions(baziData: ClassicalBaziData): BaziInteractions {
  const flows: EnergyFlow[] = [];
  const relationships: SpecialRelationship[] = [];

  const pillars = ['year', 'month', 'day', 'hour'] as const;
  
  // 提取所有天干和地支
  const gans = pillars.map(p => baziData.pillars[p].gan);
  const zhis = pillars.map(p => baziData.pillars[p].zhi);

  // ========== 1. 五行生克流向 ==========
  
  // 获取五行
  const getWx = (char: string): string => {
    const map: Record<string, string> = {
      '甲': '木', '乙': '木', '丙': '火', '丁': '火',
      '戊': '土', '己': '土', '庚': '金', '辛': '金',
      '壬': '水', '癸': '水',
      '子': '水', '丑': '土', '寅': '木', '卯': '木',
      '辰': '土', '巳': '火', '午': '火', '未': '土',
      '申': '金', '酉': '金', '戌': '土', '亥': '水'
    };
    return map[char] || '';
  };

  // 五行生克关系
  const wxRelations: Record<string, { sheng: string; ke: string }> = {
    '木': { sheng: '火', ke: '土' },
    '火': { sheng: '土', ke: '金' },
    '土': { sheng: '金', ke: '水' },
    '金': { sheng: '水', ke: '木' },
    '水': { sheng: '木', ke: '火' }
  };

  // 计算天干之间的生克
  for (let i = 0; i < gans.length; i++) {
    for (let j = 0; j < gans.length; j++) {
      if (i === j) continue;
      
      const from = gans[i];
      const to = gans[j];
      const fromWx = getWx(from);
      const toWx = getWx(to);
      
      if (wxRelations[fromWx]?.sheng === toWx) {
        flows.push({
          from,
          to,
          type: 'Sheng',
          label: '生',
          fromPillar: pillars[i],
          toPillar: pillars[j],
          fromType: 'gan',
          toType: 'gan'
        });
      } else if (wxRelations[fromWx]?.ke === toWx) {
        flows.push({
          from,
          to,
          type: 'Ke',
          label: '克',
          fromPillar: pillars[i],
          toPillar: pillars[j],
          fromType: 'gan',
          toType: 'gan'
        });
      }
    }
  }

  // 计算地支之间的生克
  for (let i = 0; i < zhis.length; i++) {
    for (let j = 0; j < zhis.length; j++) {
      if (i === j) continue;
      
      const from = zhis[i];
      const to = zhis[j];
      const fromWx = getWx(from);
      const toWx = getWx(to);
      
      if (wxRelations[fromWx]?.sheng === toWx) {
        flows.push({
          from,
          to,
          type: 'Sheng',
          label: '生',
          fromPillar: pillars[i],
          toPillar: pillars[j],
          fromType: 'zhi',
          toType: 'zhi'
        });
      } else if (wxRelations[fromWx]?.ke === toWx) {
        flows.push({
          from,
          to,
          type: 'Ke',
          label: '克',
          fromPillar: pillars[i],
          toPillar: pillars[j],
          fromType: 'zhi',
          toType: 'zhi'
        });
      }
    }
  }

  // 计算同一柱的天干与地支之间的生克
  for (let i = 0; i < pillars.length; i++) {
    const gan = gans[i];
    const zhi = zhis[i];
    const ganWx = getWx(gan);
    const zhiWx = getWx(zhi);
    
    // 天干生地支
    if (wxRelations[ganWx]?.sheng === zhiWx) {
      flows.push({
        from: gan,
        to: zhi,
        type: 'Sheng',
        label: '生',
        fromPillar: pillars[i],
        toPillar: pillars[i],
        fromType: 'gan',
        toType: 'zhi'
      });
    }
    // 天干克地支
    else if (wxRelations[ganWx]?.ke === zhiWx) {
      flows.push({
        from: gan,
        to: zhi,
        type: 'Ke',
        label: '克',
        fromPillar: pillars[i],
        toPillar: pillars[i],
        fromType: 'gan',
        toType: 'zhi'
      });
    }
    
    // 地支生天干
    if (wxRelations[zhiWx]?.sheng === ganWx) {
      flows.push({
        from: zhi,
        to: gan,
        type: 'Sheng',
        label: '生',
        fromPillar: pillars[i],
        toPillar: pillars[i],
        fromType: 'zhi',
        toType: 'gan'
      });
    }
    // 地支克天干
    else if (wxRelations[zhiWx]?.ke === ganWx) {
      flows.push({
        from: zhi,
        to: gan,
        type: 'Ke',
        label: '克',
        fromPillar: pillars[i],
        toPillar: pillars[i],
        fromType: 'zhi',
        toType: 'gan'
      });
    }
  }

  // ========== 2. 天干五合 ==========
  const tianGanHe: Record<string, { pair: string; result: string }> = {
    '甲': { pair: '己', result: '土' },
    '己': { pair: '甲', result: '土' },
    '乙': { pair: '庚', result: '金' },
    '庚': { pair: '乙', result: '金' },
    '丙': { pair: '辛', result: '水' },
    '辛': { pair: '丙', result: '水' },
    '丁': { pair: '壬', result: '木' },
    '壬': { pair: '丁', result: '木' },
    '戊': { pair: '癸', result: '火' },
    '癸': { pair: '戊', result: '火' }
  };

  for (let i = 0; i < gans.length; i++) {
    for (let j = i + 1; j < gans.length; j++) {
      const gan1 = gans[i];
      const gan2 = gans[j];
      
      if (tianGanHe[gan1]?.pair === gan2) {
        relationships.push({
          chars: [gan1, gan2],
          type: 'TianGanHe',
          label: '合',
          resultingElement: tianGanHe[gan1].result,
          pillars: [pillars[i], pillars[j]],
          charTypes: ['gan', 'gan']
        });
      }
    }
  }

  // ========== 3. 地支六合 ==========
  const diZhiLiuHe: Record<string, { pair: string; result: string }> = {
    '子': { pair: '丑', result: '土' },
    '丑': { pair: '子', result: '土' },
    '寅': { pair: '亥', result: '木' },
    '亥': { pair: '寅', result: '木' },
    '卯': { pair: '戌', result: '火' },
    '戌': { pair: '卯', result: '火' },
    '辰': { pair: '酉', result: '金' },
    '酉': { pair: '辰', result: '金' },
    '巳': { pair: '申', result: '水' },
    '申': { pair: '巳', result: '水' },
    '午': { pair: '未', result: '土' },
    '未': { pair: '午', result: '土' }
  };

  for (let i = 0; i < zhis.length; i++) {
    for (let j = i + 1; j < zhis.length; j++) {
      const zhi1 = zhis[i];
      const zhi2 = zhis[j];
      
      if (diZhiLiuHe[zhi1]?.pair === zhi2) {
        relationships.push({
          chars: [zhi1, zhi2],
          type: 'DiZhiHe',
          label: '合',
          resultingElement: diZhiLiuHe[zhi1].result,
          pillars: [pillars[i], pillars[j]],
          charTypes: ['zhi', 'zhi']
        });
      }
    }
  }

  // ========== 4. 地支三合 ==========
  const sanHeGroups = [
    { zhis: ['亥', '卯', '未'], result: '木', label: '三合木局' },
    { zhis: ['寅', '午', '戌'], result: '火', label: '三合火局' },
    { zhis: ['巳', '酉', '丑'], result: '金', label: '三合金局' },
    { zhis: ['申', '子', '辰'], result: '水', label: '三合水局' }
  ];

  sanHeGroups.forEach(group => {
    const indices: number[] = [];
    group.zhis.forEach(zhi => {
      const idx = zhis.indexOf(zhi);
      if (idx !== -1) indices.push(idx);
    });
    
    if (indices.length >= 2) {
      const involvedZhis = indices.map(i => zhis[i]);
      const involvedPillars = indices.map(i => pillars[i]);
      
      relationships.push({
        chars: involvedZhis,
        type: 'SanHe',
        label: indices.length === 3 ? group.label : `${group.label.slice(0, 2)}半合`,
        resultingElement: group.result,
        pillars: involvedPillars,
        charTypes: involvedZhis.map(() => 'zhi' as const)
      });
    }
  });

  // ========== 5. 地支三会 ==========
  const sanHuiGroups = [
    { zhis: ['寅', '卯', '辰'], result: '木', label: '三会木局' },
    { zhis: ['巳', '午', '未'], result: '火', label: '三会火局' },
    { zhis: ['申', '酉', '戌'], result: '金', label: '三会金局' },
    { zhis: ['亥', '子', '丑'], result: '水', label: '三会水局' }
  ];

  sanHuiGroups.forEach(group => {
    const indices: number[] = [];
    group.zhis.forEach(zhi => {
      const idx = zhis.indexOf(zhi);
      if (idx !== -1) indices.push(idx);
    });
    
    if (indices.length === 3) {
      const involvedZhis = indices.map(i => zhis[i]);
      const involvedPillars = indices.map(i => pillars[i]);
      
      relationships.push({
        chars: involvedZhis,
        type: 'SanHui',
        label: group.label,
        resultingElement: group.result,
        pillars: involvedPillars,
        charTypes: involvedZhis.map(() => 'zhi' as const)
      });
    }
  });

  // ========== 6. 地支相冲 ==========
  const chongPairs: [string, string][] = [
    ['子', '午'], ['丑', '未'], ['寅', '申'],
    ['卯', '酉'], ['辰', '戌'], ['巳', '亥']
  ];

  chongPairs.forEach(([zhi1, zhi2]) => {
    for (let i = 0; i < zhis.length; i++) {
      for (let j = i + 1; j < zhis.length; j++) {
        if ((zhis[i] === zhi1 && zhis[j] === zhi2) || (zhis[i] === zhi2 && zhis[j] === zhi1)) {
          relationships.push({
            chars: [zhis[i], zhis[j]],
            type: 'Chong',
            label: '冲',
            pillars: [pillars[i], pillars[j]],
            charTypes: ['zhi', 'zhi']
          });
        }
      }
    }
  });

  // ========== 7. 地支相刑 ==========
  const xingGroups = [
    { zhis: ['寅', '巳', '申'], label: '三刑' },
    { zhis: ['丑', '未', '戌'], label: '三刑' },
    { zhis: ['子', '卯'], label: '相刑' },
    { zhis: ['辰', '辰'], label: '自刑' },
    { zhis: ['午', '午'], label: '自刑' },
    { zhis: ['酉', '酉'], label: '自刑' },
    { zhis: ['亥', '亥'], label: '自刑' }
  ];

  xingGroups.forEach(group => {
    if (group.zhis.length === 2 && group.zhis[0] === group.zhis[1]) {
      // 自刑
      const count = zhis.filter(z => z === group.zhis[0]).length;
      if (count >= 2) {
        const indices = zhis.map((z, i) => z === group.zhis[0] ? i : -1).filter(i => i !== -1);
        if (indices.length >= 2) {
          relationships.push({
            chars: [group.zhis[0], group.zhis[0]],
            type: 'Xing',
            label: group.label,
            pillars: indices.slice(0, 2).map(i => pillars[i]),
            charTypes: ['zhi', 'zhi']
          });
        }
      }
    } else {
      // 普通相刑
      const indices: number[] = [];
      group.zhis.forEach(zhi => {
        const idx = zhis.indexOf(zhi);
        if (idx !== -1) indices.push(idx);
      });
      
      if (indices.length >= 2) {
        const involvedZhis = indices.map(i => zhis[i]);
        const involvedPillars = indices.map(i => pillars[i]);
        
        relationships.push({
          chars: involvedZhis,
          type: 'Xing',
          label: group.label,
          pillars: involvedPillars,
          charTypes: involvedZhis.map(() => 'zhi' as const)
        });
      }
    }
  });

  // ========== 8. 地支相害 ==========
  const haiPairs: [string, string][] = [
    ['子', '未'], ['丑', '午'], ['寅', '巳'],
    ['卯', '辰'], ['申', '亥'], ['酉', '戌']
  ];

  haiPairs.forEach(([zhi1, zhi2]) => {
    for (let i = 0; i < zhis.length; i++) {
      for (let j = i + 1; j < zhis.length; j++) {
        if ((zhis[i] === zhi1 && zhis[j] === zhi2) || (zhis[i] === zhi2 && zhis[j] === zhi1)) {
          relationships.push({
            chars: [zhis[i], zhis[j]],
            type: 'Hai',
            label: '害',
            pillars: [pillars[i], pillars[j]],
            charTypes: ['zhi', 'zhi']
          });
        }
      }
    }
  });

  // ========== 9. 构建节点数据 ==========
  const nodes = [
    // 天干节点 (索引 0-3)
    { id: 'year-gan', text: gans[0], wuxing: getWuxingForGan(gans[0]), pillar: 'year', type: 'gan' as const },
    { id: 'month-gan', text: gans[1], wuxing: getWuxingForGan(gans[1]), pillar: 'month', type: 'gan' as const },
    { id: 'day-gan', text: gans[2], wuxing: getWuxingForGan(gans[2]), pillar: 'day', type: 'gan' as const },
    { id: 'hour-gan', text: gans[3], wuxing: getWuxingForGan(gans[3]), pillar: 'hour', type: 'gan' as const },
    // 地支节点 (索引 4-7)
    { id: 'year-zhi', text: zhis[0], wuxing: getWuxingForGan(zhis[0]), pillar: 'year', type: 'zhi' as const },
    { id: 'month-zhi', text: zhis[1], wuxing: getWuxingForGan(zhis[1]), pillar: 'month', type: 'zhi' as const },
    { id: 'day-zhi', text: zhis[2], wuxing: getWuxingForGan(zhis[2]), pillar: 'day', type: 'zhi' as const },
    { id: 'hour-zhi', text: zhis[3], wuxing: getWuxingForGan(zhis[3]), pillar: 'hour', type: 'zhi' as const }
  ];

  // ========== 10. 为关系添加节点索引和跨度 ==========
  const pillarIndexMap: Record<string, number> = { 'year': 0, 'month': 1, 'day': 2, 'hour': 3 };
  
  const enhancedRelationships = relationships.map(rel => {
    // 计算节点索引
    const indices = rel.pillars.map(pillar => {
      const pillarIdx = pillarIndexMap[pillar];
      const typeOffset = rel.charTypes[0] === 'gan' ? 0 : 4;
      return pillarIdx + typeOffset;
    });
    
    // 计算跨度（相隔的柱数）
    const pillarIndices = rel.pillars.map(p => pillarIndexMap[p]);
    const distance = Math.abs(pillarIndices[0] - pillarIndices[1] || 0);
    
    return {
      ...rel,
      sourceIndex: indices[0],
      targetIndex: indices[1] || indices[0],
      distance
    };
  });

  // ========== 11. 增强能量流向数据 ==========
  const enhancedFlows = flows.map(flow => {
    const fromPillarIdx = pillarIndexMap[flow.fromPillar];
    const toPillarIdx = pillarIndexMap[flow.toPillar];
    const fromTypeOffset = flow.fromType === 'gan' ? 0 : 4;
    const toTypeOffset = flow.toType === 'gan' ? 0 : 4;
    
    return {
      ...flow,
      sourceIndex: fromPillarIdx + fromTypeOffset,
      targetIndex: toPillarIdx + toTypeOffset
    };
  });

  return {
    nodes,
    flows: enhancedFlows,
    relationships: enhancedRelationships
  };
}

/**
 * 从八字反推阳历日期
 * 采用分层过滤策略：年→日→时
 * 在1930-2030年范围内查找匹配的日期
 */
export interface InferredDate {
  year: number;
  month: number;
  day: number;
  solar: any; // Solar对象（用于计算大运流年）
  hour: number;
  minute: number;
  solarDateString: string;
  lunarDateString: string;
}

export async function inferDateFromBazi(
  gans: string[],
  zhis: string[]
): Promise<InferredDate | null> {
  try {
    // @ts-ignore
    const { Solar } = await import('lunar-javascript');
    
    const targetYearGan = gans[0];
    const targetYearZhi = zhis[0];
    const targetMonthGan = gans[1];
    const targetMonthZhi = zhis[1];
    const targetDayGan = gans[2];
    const targetDayZhi = zhis[2];
    const targetHourGan = gans[3];
    const targetHourZhi = zhis[3];
    
    // 遍历1930-2030年（优先找最接近2000年的）
    const years: number[] = [];
    for (let year = 1930; year <= 2030; year++) {
      years.push(year);
    }
    
    // 按照距离2000年的远近排序
    years.sort((a, b) => Math.abs(a - 2000) - Math.abs(b - 2000));
    
    // 第一层过滤：锁定年份
    for (const year of years) {
      // 检查该年的年柱（使用年中某一天）
      const yearMid = Solar.fromYmd(year, 6, 15);
      const yearLunar = yearMid.getLunar();
      const yearBazi = yearLunar.getEightChar();
      
      const yearGan = yearBazi.getYearGan();
      const yearZhi = yearBazi.getYearZhi();
      
      // 年柱不匹配，跳过整年
      if (yearGan !== targetYearGan || yearZhi !== targetYearZhi) {
        continue;
      }
      
      console.log(`年柱匹配: ${year}年 ${yearGan}${yearZhi}`);
      
      // 第二层过滤：遍历该年的每一天，匹配月柱和日柱
      const daysInYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365;
      
      for (let dayOfYear = 1; dayOfYear <= daysInYear; dayOfYear++) {
        const currentDate = Solar.fromYmd(year, 1, 1).next(dayOfYear - 1);
        const currentMonth = currentDate.getMonth();
        const currentDay = currentDate.getDay();
        
        // 使用中午12点获取该日的年月日三柱（时柱暂不考虑）
        const solar = Solar.fromYmdHms(year, currentMonth, currentDay, 12, 0, 0);
        const lunar = solar.getLunar();
        const bazi = lunar.getEightChar();
        
        const monthGan = bazi.getMonthGan();
        const monthZhi = bazi.getMonthZhi();
        const dayGan = bazi.getDayGan();
        const dayZhi = bazi.getDayZhi();
        
        // 检查月柱和日柱是否匹配
        if (monthGan === targetMonthGan && 
            monthZhi === targetMonthZhi && 
            dayGan === targetDayGan && 
            dayZhi === targetDayZhi) {
          
          console.log(`月日柱匹配: ${year}-${currentMonth}-${currentDay}`);
          
          // 第三层过滤：遍历12个时辰，找出匹配的时柱
          const zhiHours = [
            { zhi: '子', hour: 0 },
            { zhi: '丑', hour: 1 },
            { zhi: '寅', hour: 3 },
            { zhi: '卯', hour: 5 },
            { zhi: '辰', hour: 7 },
            { zhi: '巳', hour: 9 },
            { zhi: '午', hour: 11 },
            { zhi: '未', hour: 13 },
            { zhi: '申', hour: 15 },
            { zhi: '酉', hour: 17 },
            { zhi: '戌', hour: 19 },
            { zhi: '亥', hour: 21 }
          ];
          
          for (const { zhi, hour } of zhiHours) {
            const hourSolar = Solar.fromYmdHms(year, currentMonth, currentDay, hour, 0, 0);
            const hourLunar = hourSolar.getLunar();
            const hourBazi = hourLunar.getEightChar();
            
            const hourGan = hourBazi.getTimeGan();
            const hourZhi = hourBazi.getTimeZhi();
            
            // 检查时柱是否匹配
            if (hourGan === targetHourGan && hourZhi === targetHourZhi) {
              console.log(`时柱匹配: ${hourGan}${hourZhi} (${hour}:00)`);
              
              // 找到完全匹配的八字！
              // 格式化阳历日期
              const solarDateString = `${year}年${currentMonth}月${currentDay}日 ${hour.toString().padStart(2, '0')}:00`;
              
              // 格式化农历日期
              const lunarYear = hourLunar.getYear();
              const lunarMonthChinese = hourLunar.getMonthInChinese();
              const lunarDayChinese = hourLunar.getDayInChinese();
              const lunarDateString = `${lunarYear}年${lunarMonthChinese}月${lunarDayChinese} ${hour.toString().padStart(2, '0')}:00`;
              
              return {
                year,
                month: currentMonth,
                day: currentDay,
                hour,
                minute: 0,
                solar: hourSolar, // 保存Solar对象（用于计算大运流年）
                solarDateString,
                lunarDateString
              };
            }
          }
          
          // 如果前三柱匹配但时柱都不匹配（理论上不应该发生）
          console.warn('找到年月日柱匹配，但时柱都不匹配');
        }
      }
    }
    
    // 没有找到匹配的日期
    console.log('未找到匹配的八字');
    return null;
  } catch (error) {
    console.error('反推日期失败:', error);
    return null;
  }
}

/**
 * 生成原局关系断语（盖头截脚、妒合等）
 */
export interface BaziTextualAnalysis {
  stems: string[];      // 原局天干断语
  branches: string[];   // 原局地支断语
  pillars: string[];    // 原局整柱断语（盖头截脚）
}

export function getBaziTextualAnalysis(baziData: ClassicalBaziData): BaziTextualAnalysis {
  const stems: string[] = [];
  const branches: string[] = [];
  const pillars: string[] = [];

  const gans = [
    baziData.pillars.year.gan,
    baziData.pillars.month.gan,
    baziData.pillars.day.gan,
    baziData.pillars.hour.gan
  ];
  
  const zhis = [
    baziData.pillars.year.zhi,
    baziData.pillars.month.zhi,
    baziData.pillars.day.zhi,
    baziData.pillars.hour.zhi
  ];

  // 五行映射
  const wuxingMap: { [key: string]: string } = {
    '甲': '木', '乙': '木', '丙': '火', '丁': '火',
    '戊': '土', '己': '土', '庚': '金', '辛': '金',
    '壬': '水', '癸': '水',
    '子': '水', '丑': '土', '寅': '木', '卯': '木',
    '辰': '土', '巳': '火', '午': '火', '未': '土',
    '申': '金', '酉': '金', '戌': '土', '亥': '水'
  };

  // 五行生克关系
  const wxRelations: { [key: string]: { sheng: string; ke: string } } = {
    '木': { sheng: '火', ke: '土' },
    '火': { sheng: '土', ke: '金' },
    '土': { sheng: '金', ke: '水' },
    '金': { sheng: '水', ke: '木' },
    '水': { sheng: '木', ke: '火' }
  };

  // ==========================================
  // 1. 原局天干分析（生克合冲 + 妒合）
  // ==========================================
  
  // 天干五合
  const ganHeMap: { [key: string]: { he: string; result: string } } = {
    '甲': { he: '己', result: '土' },
    '乙': { he: '庚', result: '金' },
    '丙': { he: '辛', result: '水' },
    '丁': { he: '壬', result: '木' },
    '戊': { he: '癸', result: '火' },
    '己': { he: '甲', result: '土' },
    '庚': { he: '乙', result: '金' },
    '辛': { he: '丙', result: '水' },
    '壬': { he: '丁', result: '木' },
    '癸': { he: '戊', result: '火' }
  };

  // 天干相冲
  const ganChongPairs = [
    ['甲', '庚'], ['乙', '辛'], ['丙', '壬'], ['丁', '癸']
  ];

  // 检查天干合化
  const heRecords: { [key: string]: string[] } = {}; // 记录每个天干被哪些天干合
  for (let i = 0; i < gans.length; i++) {
    for (let j = i + 1; j < gans.length; j++) {
      const gan1 = gans[i];
      const gan2 = gans[j];
      
      if (ganHeMap[gan1]?.he === gan2) {
        // 记录合化关系
        if (!heRecords[gan2]) heRecords[gan2] = [];
        heRecords[gan2].push(gan1);
        if (!heRecords[gan1]) heRecords[gan1] = [];
        heRecords[gan1].push(gan2);
        
        const result = ganHeMap[gan1].result;
        stems.push(`${gan1}${gan2}合化${result}`);
      }
    }
  }

  // 检查妒合（多对一）
  for (const [target, hers] of Object.entries(heRecords)) {
    if (hers.length > 1) {
      // 发现妒合
      const hersStr = hers.join(target);
      stems.push(`${hersStr}妒合`);
    }
  }

  // 检查天干相克
  for (let i = 0; i < gans.length; i++) {
    for (let j = i + 1; j < gans.length; j++) {
      const gan1 = gans[i];
      const gan2 = gans[j];
      const wx1 = wuxingMap[gan1];
      const wx2 = wuxingMap[gan2];
      
      if (wxRelations[wx1]?.ke === wx2) {
        stems.push(`${gan1}${gan2}相克`);
      } else if (wxRelations[wx2]?.ke === wx1) {
        stems.push(`${gan2}${gan1}相克`);
      }
    }
  }

  // 检查天干相冲
  for (const [gan1, gan2] of ganChongPairs) {
    if (gans.includes(gan1) && gans.includes(gan2)) {
      stems.push(`${gan1}${gan2}相冲`);
    }
  }

  // ==========================================
  // 2. 原局地支分析（刑冲合害破）
  // ==========================================

  // 地支六合
  const zhiHePairs: { [key: string]: { zhi: string; result: string } } = {
    '子': { zhi: '丑', result: '土' },
    '寅': { zhi: '亥', result: '木' },
    '卯': { zhi: '戌', result: '火' },
    '辰': { zhi: '酉', result: '金' },
    '巳': { zhi: '申', result: '水' },
    '午': { zhi: '未', result: '火' }
  };

  // 地支相冲
  const zhiChongPairs = [
    ['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']
  ];

  // 地支相刑
  const zhiXingGroups = [
    ['寅', '巳', '申'], // 无恩之刑
    ['丑', '戌', '未'], // 恃势之刑
    ['子', '卯']        // 无礼之刑
  ];

  // 地支相害
  const zhiHaiPairs = [
    ['子', '未'], ['丑', '午'], ['寅', '巳'], ['卯', '辰'], ['申', '亥'], ['酉', '戌']
  ];

  // 地支相破
  const zhiPoPairs = [
    ['子', '酉'], ['丑', '辰'], ['寅', '亥'], ['卯', '午'], ['巳', '申'], ['未', '戌']
  ];

  // 检查地支六合
  for (const [zhi1, info] of Object.entries(zhiHePairs)) {
    const zhi2 = info.zhi;
    if (zhis.includes(zhi1) && zhis.includes(zhi2)) {
      branches.push(`${zhi1}${zhi2}合化${info.result}`);
    }
  }

  // 检查地支相冲
  for (const [zhi1, zhi2] of zhiChongPairs) {
    if (zhis.includes(zhi1) && zhis.includes(zhi2)) {
      branches.push(`${zhi1}${zhi2}相冲`);
    }
  }

  // 检查地支相刑
  for (const group of zhiXingGroups) {
    const inBazi = group.filter(z => zhis.includes(z));
    if (inBazi.length >= 2) {
      branches.push(`${inBazi.join('')}相刑`);
    }
  }

  // 检查地支相害
  for (const [zhi1, zhi2] of zhiHaiPairs) {
    if (zhis.includes(zhi1) && zhis.includes(zhi2)) {
      branches.push(`${zhi1}${zhi2}相害`);
    }
  }

  // 检查地支相破
  for (const [zhi1, zhi2] of zhiPoPairs) {
    if (zhis.includes(zhi1) && zhis.includes(zhi2)) {
      branches.push(`${zhi1}${zhi2}相破`);
    }
  }

  // ==========================================
  // 3. 原局整柱分析（盖头 & 截脚）
  // ==========================================

  const pillarNames = ['年', '月', '日', '时'];
  
  for (let i = 0; i < 4; i++) {
    const gan = gans[i];
    const zhi = zhis[i];
    const ganZhi = gan + zhi;
    const ganWx = wuxingMap[gan];
    const zhiWx = wuxingMap[zhi];

    // 盖头：天干克地支
    if (wxRelations[ganWx]?.ke === zhiWx) {
      pillars.push(`${ganZhi}盖头`);
    }

    // 截脚：地支克天干
    if (wxRelations[zhiWx]?.ke === ganWx) {
      pillars.push(`${ganZhi}截脚`);
    }
  }

  return { stems, branches, pillars };
}

/**
 * 大运流年数据结构
 */
export interface LuckCycle {
  startAge: number;   // 起运年龄
  startYear: number;  // 起运年份
  ganZhi: string;     // 大运干支
  gan: string;        // 天干
  zhi: string;        // 地支
  gods: { gan: string; zhi: string }; // 大运十神
  years: {            // 流年列表
    age: number;
    year: number;
    ganZhi: string;
    gan: string;
    zhi: string;
    gods: string;
  }[];
}

/**
 * 计算大运与流年
 * @param solarDate Solar对象（阳历日期）
 * @param gender 性别 1=男/乾造, 0=女/坤造
 * @param dayMaster 日主天干
 */
export function calculateLuckCycles(
  dateObj: any | null,
  gender: number = 1,
  baziData: any = null
) {
  if (!dateObj) return [];

  try {
    let validSolar = dateObj;
    if (typeof dateObj.getLunar !== 'function') {
      // @ts-ignore
      validSolar = Solar.fromYmd(dateObj.year, dateObj.month, dateObj.day);
    }

    const lunar = validSolar.getLunar();
    const bazi = lunar.getEightChar();
    const yun = bazi.getYun(gender);

    // 1. 获取大运列表 (Index 0 就是第一步大运，不要切片)
    const daYunList = yun.getDaYun();
    const birthYear = validSolar.getYear();
    /** 周岁：某年年底(12月31日)时的实足年龄 = year - birthYear */
    const zhouSuiAtYear = (year: number) => Math.max(0, year - birthYear);
    let startAge = 1;
    let startYear = birthYear;
    let firstValidIndex = 0;

    const firstGanZhi = daYunList && daYunList[0] ? daYunList[0].getGanZhi() : '';
    if (!firstGanZhi || firstGanZhi.trim() === '') {
      if (daYunList && daYunList[1]) {
        startAge = daYunList[1].getStartAge();
        startYear = daYunList[1].getStartYear();
        firstValidIndex = 1;
      }
    } else if (daYunList && daYunList[0]) {
      startAge = daYunList[0].getStartAge();
      startYear = daYunList[0].getStartYear();
      firstValidIndex = 0;
    }

    const calcShenSha = typeof calculateShenShaForPillar === 'function'
      ? calculateShenShaForPillar
      : getShenSha;

    // ==========================================
    // A. 构建“小运” (Xiao Yun)
    // ==========================================
    const preLuckYears = [];
    for (let age = 1; age < startAge; age++) {
      const currentYear = birthYear + (age - 1);
      const xiaoYunList = typeof yun.getXiaoYun === 'function' ? yun.getXiaoYun() : [];
      const xyIndex = age - 1;
      const xiaoYunGanZhi = (xiaoYunList && xiaoYunList[xyIndex]) ? xiaoYunList[xyIndex].getGanZhi() : "";

      const noteSolar = Solar.fromYmd(currentYear, 6, 1);
      const noteLunar = noteSolar.getLunar();
      const liunianGanZhi = noteLunar.getYearInGanZhi();

      const shenshas = baziData
        ? calcShenSha(
            'year',
            liunianGanZhi[0],
            liunianGanZhi[1],
            baziData.pillars?.day?.gan,
            baziData.pillars?.month?.zhi,
            baziData.pillars?.year?.zhi,
            baziData.pillars?.day?.zhi,
            baziData.pillars?.year?.gan,
            [
              baziData.pillars?.year?.gan,
              baziData.pillars?.month?.gan,
              baziData.pillars?.day?.gan,
              baziData.pillars?.hour?.gan
            ]
          )
        : [];

      preLuckYears.push({
        year: currentYear,
        age: age,
        ageZhouSui: zhouSuiAtYear(currentYear),
        ganZhi: liunianGanZhi,
        xiaoYunGanZhi: xiaoYunGanZhi,
        gods: "小运",
        shensha: shenshas,
        isXiaoYun: true
      });
    }

    const xiaoYunCycle = {
      isPreLuck: true,
      startAge: 1,
      startAgeZhouSui: zhouSuiAtYear(birthYear),
      startYear: birthYear,
      endYear: startYear - 1,
      ganZhi: "小运",
      gan: "小",
      zhi: "运",
      gods: { gan: "", zhi: "" },
      years: preLuckYears
    };

    // ==========================================
    // B. 构建“正式大运” (Da Yun)
    // ==========================================
    const normalCycles = daYunList
      .slice(firstValidIndex)
      .map((dy: any) => {
      const dyGanZhi = dy.getGanZhi();
      if (!dyGanZhi || dyGanZhi.trim() === '') return null;
      const dyShenshas = baziData
        ? calcShenSha(
            'month',
            dyGanZhi[0],
            dyGanZhi[1],
            baziData.pillars?.day?.gan,
            baziData.pillars?.month?.zhi,
            baziData.pillars?.year?.zhi,
            baziData.pillars?.day?.zhi,
            baziData.pillars?.year?.gan,
            [
              baziData.pillars?.year?.gan,
              baziData.pillars?.month?.gan,
              baziData.pillars?.day?.gan,
              baziData.pillars?.hour?.gan
            ]
          )
        : [];

      const liuNianList = dy.getLiuNian(10);
      const years = liuNianList.map((ln: any) => {
        const lnGanZhi = ln.getGanZhi();
        const lnShenshas = baziData
          ? calcShenSha(
              'year',
              lnGanZhi[0],
              lnGanZhi[1],
              baziData.pillars?.day?.gan,
              baziData.pillars?.month?.zhi,
              baziData.pillars?.year?.zhi,
              baziData.pillars?.day?.zhi,
              baziData.pillars?.year?.gan,
              [
                baziData.pillars?.year?.gan,
                baziData.pillars?.month?.gan,
                baziData.pillars?.day?.gan,
                baziData.pillars?.hour?.gan
              ]
            )
          : [];

        const y = ln.getYear();
        return {
          year: y,
          age: ln.getAge(),
          ageZhouSui: zhouSuiAtYear(y),
          ganZhi: lnGanZhi,
          gods: "流年",
          shensha: lnShenshas
        };
      });

      const dyStartYear = dy.getStartYear();
      return {
        isPreLuck: false,
        startAge: dy.getStartAge(),
        startAgeZhouSui: zhouSuiAtYear(dyStartYear),
        startYear: dyStartYear,
        ganZhi: dyGanZhi,
        gan: dyGanZhi[0],
        zhi: dyGanZhi[1],
        gods: { gan: "大运", zhi: "" },
        shensha: dyShenshas,
        years
      };
    })
    .filter(Boolean);

    return preLuckYears.length > 0 ? [xiaoYunCycle, ...normalCycles] : normalCycles;
  } catch (e) {
    console.error("大运计算错误:", e);
    return [];
  }
}

// 藏干配置（用于大运十神计算）
const ZANG_GAN: { [key: string]: { [key: string]: number } } = {
  '子': { '癸': 1.0 },
  '丑': { '己': 0.7, '癸': 0.2, '辛': 0.1 },
  '寅': { '甲': 0.7, '丙': 0.2, '戊': 0.1 },
  '卯': { '乙': 1.0 },
  '辰': { '戊': 0.7, '乙': 0.2, '癸': 0.1 },
  '巳': { '丙': 0.7, '戊': 0.2, '庚': 0.1 },
  '午': { '丁': 0.7, '己': 0.3 },
  '未': { '己': 0.7, '丁': 0.2, '乙': 0.1 },
  '申': { '庚': 0.7, '壬': 0.2, '戊': 0.1 },
  '酉': { '辛': 1.0 },
  '戌': { '戊': 0.7, '辛': 0.2, '丁': 0.1 },
  '亥': { '壬': 0.8, '甲': 0.2 }
};

// 十神判定函数（用于大运流年）
function getSs(dm: string, target: string): string {
  const stemWuxing: { [key: string]: string } = {
    '甲': '木', '乙': '木', '丙': '火', '丁': '火',
    '戊': '土', '己': '土', '庚': '金', '辛': '金',
    '壬': '水', '癸': '水'
  };
  
  const relationships: { [key: string]: { 生: string; 克: string } } = {
    '木': { 生: '火', 克: '土' },
    '火': { 生: '土', 克: '金' },
    '土': { 生: '金', 克: '水' },
    '金': { 生: '水', 克: '木' },
    '水': { 生: '木', 克: '火' }
  };
  
  const stemsYy: { [key: string]: number } = {
    '甲': 1, '丙': 1, '戊': 1, '庚': 1, '壬': 1,
    '乙': 0, '丁': 0, '己': 0, '辛': 0, '癸': 0
  };
  
  // 防御性检查：确保dm和target都是天干
  if (!stemWuxing[dm] || !stemWuxing[target]) {
    console.error(`getSs参数错误: dm=${dm}, target=${target}`);
    return "未知";
  }
  
  const sw = stemWuxing[dm];
  const tw = stemWuxing[target];
  
  // 防御性检查：确保五行存在
  if (!sw || !tw || !relationships[sw] || !relationships[tw]) {
    console.error(`五行映射错误: sw=${sw}, tw=${tw}`);
    return "未知";
  }
  
  const isSame = stemsYy[dm] === stemsYy[target];

  if (sw === tw) return isSame ? "比肩" : "劫财";
  if (relationships[sw].生 === tw) return isSame ? "食神" : "伤官";
  if (relationships[tw].生 === sw) return isSame ? "枭神" : "正印";
  if (relationships[sw].克 === tw) return isSame ? "偏财" : "正财";
  if (relationships[tw].克 === sw) return isSame ? "七杀" : "正官";
  return "未知";
}

/**
 * 八字能量与十神计算（基于物理引擎）
 */
export interface EnergyProfile {
  wuxing: { [key: string]: number };      // 五行能量分布
  shishen: { [key: string]: number };     // 十神能量分布（五大类）
  shishenDetailed: { [key: string]: number }; // 十神详细分布（十个具体十神）
  ganDetailed: { [key: string]: number }; // 天干详细分布（十个天干）
  percentages: {
    wuxing: { [key: string]: number };    // 五行百分比
    shishen: { [key: string]: number };   // 十神百分比
    shishenDetailed: { [key: string]: number }; // 十神详细百分比
    ganDetailed: { [key: string]: number }; // 天干详细百分比
  };
  status: {
    level: string;      // "身强" | "身弱" | "专旺" | "中和"
    score: number;      // 同党得分
    percent: number;    // 同党占比
    pattern: string;    // 格局名称
  };
  climate: {
    tempScore: number;  // 气候指数
    isDry: boolean;     // 是否燥
    isWet: boolean;     // 是否湿
    level: string;      // "燥" | "湿" | "中和"
    needGod: string;    // 需要的调候神
  };
  yongshen: {
    climate: string;    // 调候用神
    balance: string;    // 扶抑用神
    final: string;      // 最终真神
    reason: string;     // 裁定理由
  };
  core: {
    gans: string[];
    zhis: string[];
    dayMaster: string;
    trueSeason: string | null;
    isBureau: boolean;
    monthMainStem: string;
    finalScores: { [key: string]: number };
    totalEnergy: number;
    peerPct: number;
    patternBaseSs: string;
  };
  interactionBoosts: {
    combineNiBoost: number;
    clashNeBoost: number;
  };
  maxEnergy: number;    // 最大能量值（用于图表归一化）
  logs: string[];       // 计算日志
}

export function calculateEnergyProfile(baziData: ClassicalBaziData): EnergyProfile {
  const logs: string[] = [];
  
  // ================= PART 1: 数据解析与初始化 =================
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const stemWuxing: { [key: string]: string } = {
    '甲': '木', '乙': '木', '丙': '火', '丁': '火',
    '戊': '土', '己': '土', '庚': '金', '辛': '金',
    '壬': '水', '癸': '水'
  };

  // 藏干比例（与Python代码一致）
  const zanggan: { [key: string]: { [key: string]: number } } = {
    '子': { '癸': 1.0 },
    '丑': { '己': 0.7, '癸': 0.2, '辛': 0.1 },
    '寅': { '甲': 0.7, '丙': 0.2, '戊': 0.1 },
    '卯': { '乙': 1.0 },
    '辰': { '戊': 0.7, '乙': 0.2, '癸': 0.1 },
    '巳': { '丙': 0.7, '戊': 0.2, '庚': 0.1 },
    '午': { '丁': 0.7, '己': 0.3 },
    '未': { '己': 0.7, '丁': 0.2, '乙': 0.1 },
    '申': { '庚': 0.7, '壬': 0.2, '戊': 0.1 },
    '酉': { '辛': 1.0 },
    '戌': { '戊': 0.7, '辛': 0.2, '丁': 0.1 },
    '亥': { '壬': 0.8, '甲': 0.2 }  // 注意：亥与之前不同
  };

  const relationships: { [key: string]: { 生: string; 克: string } } = {
    '木': { 生: '火', 克: '土' },
    '火': { 生: '土', 克: '金' },
    '土': { 生: '金', 克: '水' },
    '金': { 生: '水', 克: '木' },
    '水': { 生: '木', 克: '火' }
  };

  const tempCoef: { [key: string]: number } = {
    '甲': 1, '乙': -1, '丙': 7, '丁': 4, '戊': 2,
    '己': -2, '庚': -1, '辛': -2, '壬': -6, '癸': -4
  };

  const gans = [
    baziData.pillars.year.gan,
    baziData.pillars.month.gan,
    baziData.pillars.day.gan,
    baziData.pillars.hour.gan
  ];

  const zhis = [
    baziData.pillars.year.zhi,
    baziData.pillars.month.zhi,
    baziData.pillars.day.zhi,
    baziData.pillars.hour.zhi
  ];

  const dayMaster = gans[2];
  const dmWx = stemWuxing[dayMaster];
  const monthZhi = zhis[1];

  // ================= PART 2: 八字物理引擎 =================
  
  // 1. 寻找真神与合局
  let trueSeason: string | null = null;
  let seasonSource = "月令本气";
  let structureGroup = new Set<string>();
  let isBureau = false;

  const sanHui = [
    [['寅', '卯', '辰'], '木'],
    [['巳', '午', '未'], '火'],
    [['申', '酉', '戌'], '金'],
    [['亥', '子', '丑'], '水']
  ] as [string[], string][];

  const sanHe = [
    [['亥', '卯', '未'], '木'],
    [['寅', '午', '戌'], '火'],
    [['巳', '酉', '丑'], '金'],
    [['申', '子', '辰'], '水']
  ] as [string[], string][];

  const zhiSet = new Set(zhis);

  // 检测三会局
  for (const [group, wx] of sanHui) {
    if (group.every(z => zhiSet.has(z))) {
      trueSeason = wx;
      seasonSource = `三会${wx}局`;
      structureGroup = new Set(group);
      isBureau = true;
      logs.push(`🌀 [三会局] 检测到${seasonSource}`);
      break;
    }
  }

  // 检测三合局
  if (!trueSeason) {
    for (const [group, wx] of sanHe) {
      if (group.every(z => zhiSet.has(z))) {
        trueSeason = wx;
        seasonSource = `三合${wx}局`;
        structureGroup = new Set(group);
        isBureau = true;
        logs.push(`🌀 [三合局] 检测到${seasonSource}`);
        break;
      }
    }
  }

  // 默认月令本气
  const monthCang = zanggan[monthZhi] || {};
  const monthMainStem = Object.keys(monthCang).reduce((a, b) => 
    (monthCang[a] || 0) > (monthCang[b] || 0) ? a : b, Object.keys(monthCang)[0] || '');
  
  if (!trueSeason) {
    trueSeason = stemWuxing[monthMainStem];
    seasonSource = `月令${monthZhi}`;
  }

  // 2. 物理合冲判定
  const ganMods = [1.0, 1.0, 1.0, 1.0];
  const zhiMods = [1.0, 1.0, 1.0, 1.0];
  const isZhiBound = [false, false, false, false];

  // 天干合
  const ganHeMap: { [key: string]: string } = {
    '甲己': '土', '乙庚': '金', '丙辛': '水', '丁壬': '木', '戊癸': '火'
  };

  for (let i = 0; i < 3; i++) {
    const pair1 = `${gans[i]}${gans[i + 1]}`;
    const pair2 = `${gans[i + 1]}${gans[i]}`;
    const target = ganHeMap[pair1] || ganHeMap[pair2];
    
    if (target) {
      if (target === trueSeason) {
        logs.push(`✅ [合化成功] 天干 ${gans[i]}+${gans[i + 1]} -> 化为${target}`);
      } else {
        ganMods[i] *= 0.7;
        ganMods[i + 1] *= 0.7;
        logs.push(`❌ [合化失败] 天干 ${gans[i]}+${gans[i + 1]} -> 合绊`);
      }
    }
  }

  // 地支六合
  const liuHe: { [key: string]: string } = {
    '子丑': '土', '寅亥': '木', '卯戌': '火',
    '辰酉': '金', '午未': '土', '巳申': '水'
  };

  const combinedIndices = new Set<number>();
  let tempNiBoostSum = 0.0;

  for (let i = 0; i < 3; i++) {
    const pair1 = `${zhis[i]}${zhis[i + 1]}`;
    const pair2 = `${zhis[i + 1]}${zhis[i]}`;
    const target = liuHe[pair1] || liuHe[pair2];

    if (target) {
      combinedIndices.add(i);
      combinedIndices.add(i + 1);
      tempNiBoostSum += 10.0;

      if (target === trueSeason || target === stemWuxing[monthMainStem]) {
        logs.push(`✅ [合化成功] 地支 ${zhis[i]}+${zhis[i + 1]} -> 化为${target}`);
      } else {
        if (!isZhiBound[i]) {
          zhiMods[i] *= 0.7;
          isZhiBound[i] = true;
        }
        if (!isZhiBound[i + 1]) {
          zhiMods[i + 1] *= 0.7;
          isZhiBound[i + 1] = true;
        }
        logs.push(`❌ [合化失败] 地支 ${zhis[i]}+${zhis[i + 1]} -> 合绊`);
      }
    }
  }

  // Ni补偿判定
  let combineNiBoost = 0.0;
  if (combinedIndices.size === 4) {
    combineNiBoost = 60.0;
    logs.push("🔒 [地支全合] 触发极度内敛效应");
  } else {
    combineNiBoost = tempNiBoostSum;
    if (combineNiBoost > 0) {
      logs.push(`🔗 [局部相合] 累计 Ni 补偿: +${combineNiBoost}%`);
    }
  }

  // 地支相冲
  const chongs = [
    ['子', '午'], ['丑', '未'], ['寅', '申'],
    ['卯', '酉'], ['辰', '戌'], ['巳', '亥']
  ];

  const clashedIndices = new Set<number>();
  let tempBoostSum = 0.0;

  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const isClash = chongs.some(pair => 
        (pair[0] === zhis[i] && pair[1] === zhis[j]) ||
        (pair[1] === zhis[i] && pair[0] === zhis[j])
      );

      if (isClash) {
        clashedIndices.add(i);
        clashedIndices.add(j);

        if (!structureGroup.has(zhis[i]) && !structureGroup.has(zhis[j])) {
          const dist = Math.abs(i - j);
          if (dist === 1) {
            zhiMods[i] *= 0.6;
            zhiMods[j] *= 0.6;
            tempBoostSum += 10.0;
            logs.push(`⚔️ [相邻相冲] ${zhis[i]}与${zhis[j]}相邻，能量*0.6`);
          } else {
            zhiMods[i] *= 0.85;
            zhiMods[j] *= 0.85;
            tempBoostSum += 5.0;
            logs.push(`⚔️ [不相邻冲] ${zhis[i]}与${zhis[j]}遥冲，能量*0.85`);
          }
        }
      }
    }
  }

  // Ne补偿判定
  let clashNeBoost = 0.0;
  if (clashedIndices.size === 4) {
    clashNeBoost = 60.0;
    logs.push("🌪️ [地支全冲] 触发极度动荡效应");
  } else {
    clashNeBoost = tempBoostSum;
    if (clashNeBoost > 0) {
      logs.push(`✨ [局部相冲] 累计 Ne 补偿: +${clashNeBoost}%`);
    }
  }

  // 3. 能量物理计算
  const baseScoresGan = [100.0, 100.0, 100.0, 100.0];
  const baseScoresZhi = [100.0, 300.0, 100.0, 100.0]; // 注意：月支是300！
  const ganScores = baseScoresGan.map((v, i) => v * ganMods[i]);

  // 黑洞效应：成局地支变性
  const transmutationMap: { [key: string]: { [key: string]: number } } = {
    '木': { '甲': 0.5, '乙': 0.5 },
    '火': { '丙': 0.5, '丁': 0.5 },
    '土': { '戊': 0.5, '己': 0.5 },
    '金': { '庚': 0.5, '辛': 0.5 },
    '水': { '壬': 0.5, '癸': 0.5 }
  };

  const zhiStemScores: { [key: string]: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const zhi = zhis[i];
    let breakdown: { [key: string]: number } = {};

    if (structureGroup.has(zhi) && trueSeason && transmutationMap[trueSeason]) {
      breakdown = transmutationMap[trueSeason];
      logs.push(`🌀 [黑洞效应] ${zhi} 卷入${seasonSource} -> 变性为50%阳+50%阴`);
    } else {
      breakdown = zanggan[zhi] || {};
    }

    const scores: { [key: string]: number } = {};
    for (const [s, r] of Object.entries(breakdown)) {
      scores[s] = baseScoresZhi[i] * r * zhiMods[i];
    }
    zhiStemScores.push(scores);
  }

  // 宏观季节修正
  const els = ['木', '火', '土', '金', '水'];
  const idx = els.indexOf(trueSeason || '木');
  const seasonMult: { [key: string]: number } = {
    [els[idx]]: 1.5,
    [els[(idx + 1) % 5]]: 1.2,
    [els[(idx - 1 + 5) % 5]]: 0.9,
    [els[(idx + 2) % 5]]: 0.7,
    [els[(idx - 2 + 5) % 5]]: 0.8
  };

  for (let i = 0; i < 4; i++) {
    ganScores[i] *= seasonMult[stemWuxing[gans[i]]];
    for (const s in zhiStemScores[i]) {
      zhiStemScores[i][s] *= seasonMult[stemWuxing[s]];
    }
  }

  // 通根判定
  for (let i = 0; i < 4; i++) {
    const g = gans[i];
    const hasRoot = zhiStemScores.some(d => g in d);
    if (!hasRoot) {
      ganScores[i] *= 0.6;
      logs.push(`🍃 [虚浮无根] 天干${g} 能量减损`);
    }
  }

  // 流通模型（月柱特殊化）
  for (let i = 0; i < 4; i++) {
    if (Object.keys(zhiStemScores[i]).length === 0) continue;

    const gWx = stemWuxing[gans[i]];
    const zMainStem = Object.keys(zhiStemScores[i]).reduce((a, b) =>
      zhiStemScores[i][a] > zhiStemScores[i][b] ? a : b
    );
    const zWx = stemWuxing[zMainStem];

    if (i === 1) {
      // 月柱独立规则
      if (gWx === zWx) {
        ganScores[i] *= 1.2;
        for (const s in zhiStemScores[i]) zhiStemScores[i][s] *= 1.05;
        logs.push(`👑 [月令主宰-同气] 月柱${gans[i]}${zhis[i]}，天干*1.2，地支*1.05`);
      } else if (relationships[zWx].生 === gWx) {
        ganScores[i] *= 1.2;
        logs.push(`👑 [月令主宰-得生] 月支${zhis[i]}生天干${gans[i]}，天干*1.2`);
      } else if (relationships[gWx].生 === zWx) {
        ganScores[i] *= 0.8;
        for (const s in zhiStemScores[i]) zhiStemScores[i][s] *= 1.1;
        logs.push(`👑 [月令主宰-泄秀] 天干${gans[i]}生月支${zhis[i]}，天干*0.8，月支*1.1`);
      } else if (relationships[zWx].克 === gWx) {
        ganScores[i] *= 0.65;
        for (const s in zhiStemScores[i]) zhiStemScores[i][s] *= 0.95;
        logs.push(`👑 [月令主宰-截脚] 月支${zhis[i]}克天干${gans[i]}，天干*0.65，月支*0.95`);
      } else if (relationships[gWx].克 === zWx) {
        ganScores[i] *= 0.8;
        for (const s in zhiStemScores[i]) zhiStemScores[i][s] *= 0.9;
        logs.push(`👑 [月令主宰-盖头] 天干${gans[i]}克月支${zhis[i]}，天干*0.8，月支*0.9`);
      }
    } else {
      // 其他三柱规则
      if (gWx === zWx) {
        ganScores[i] *= 1.3;
        logs.push(`🌲 [同气] ${gans[i]}坐${zhis[i]}，天干强根*1.3`);
      } else if (relationships[zWx].生 === gWx) {
        ganScores[i] *= 1.2;
        for (const s in zhiStemScores[i]) zhiStemScores[i][s] *= 0.9;
        logs.push(`💧 [得生] ${zhis[i]}生${gans[i]}，天干*1.2，地支泄气*0.9`);
      } else if (relationships[gWx].生 === zWx) {
        ganScores[i] *= 0.8;
        for (const s in zhiStemScores[i]) zhiStemScores[i][s] *= 1.1;
        logs.push(`🔥 [泄秀] ${gans[i]}生${zhis[i]}，天干泄气*0.8，地支受生*1.1`);
      } else if (relationships[zWx].克 === gWx) {
        ganScores[i] *= 0.7;
        for (const s in zhiStemScores[i]) zhiStemScores[i][s] *= 0.9;
        logs.push(`⚔️ [截脚] ${zhis[i]}克${gans[i]}，天干受制*0.7，地支耗力*0.9`);
      } else if (relationships[gWx].克 === zWx) {
        ganScores[i] *= 0.8;
        for (const s in zhiStemScores[i]) zhiStemScores[i][s] *= 0.8;
        logs.push(`🔨 [盖头] ${gans[i]}克${zhis[i]}，天干耗力*0.8，地支受制*0.8`);
      }
    }
  }

  // 汇总能量
  const finalScores: { [key: string]: number } = {};
  stems.forEach(s => finalScores[s] = 0);

  for (let i = 0; i < 4; i++) {
    finalScores[gans[i]] += ganScores[i];
  }

  for (const zDict of zhiStemScores) {
    for (const [s, v] of Object.entries(zDict)) {
      const isBureauElem = isBureau && stemWuxing[s] === trueSeason;
      // 藏干如果不在天干中且不是成局五行，打8折
      finalScores[s] += (gans.includes(s) || isBureauElem) ? v : v * 0.8;
    }
  }

  const totalEnergy = Object.values(finalScores).reduce((a, b) => a + b, 0);

  // 提前计算环境气候指数
  const tempScore = stems.reduce((sum, s) => 
    sum + finalScores[s] * (tempCoef[s] || 0), 0
  );

  // ================= PART 3: 格局辨析与用神引擎 =================
  
  // 十神判定工具函数
  const getSs = (dm: string, target: string): string => {
    const stemsYy: { [key: string]: number } = {
      '甲': 1, '丙': 1, '戊': 1, '庚': 1, '壬': 1,
      '乙': 0, '丁': 0, '己': 0, '辛': 0, '癸': 0
    };
    const sw = stemWuxing[dm];
    const tw = stemWuxing[target];
    const isSame = stemsYy[dm] === stemsYy[target];

    if (sw === tw) return isSame ? "比肩" : "劫财";
    if (relationships[sw].生 === tw) return isSame ? "食神" : "伤官";
    if (relationships[tw].生 === sw) return isSame ? "枭神" : "正印";
    if (relationships[sw].克 === tw) return isSame ? "偏财" : "正财";
    if (relationships[tw].克 === sw) return isSame ? "七杀" : "正官";
    return "未知";
  };

  const ssToCat: { [key: string]: string } = {
    "比肩": "比劫", "劫财": "比劫",
    "食神": "食伤", "伤官": "食伤",
    "正财": "财星", "偏财": "财星",
    "正官": "官杀", "七杀": "官杀",
    "正印": "印枭", "枭神": "印枭"
  };

  // 五行能量统计
  const wuxingScores: { [key: string]: number } = {
    '木': 0, '火': 0, '土': 0, '金': 0, '水': 0
  };
  for (const [s, v] of Object.entries(finalScores)) {
    const wx = stemWuxing[s];
    wuxingScores[wx] += v;
  }

  // 十神能量统计（五大类）
  const shishenEnergy: { [key: string]: number } = {
    '比劫': 0, '食伤': 0, '财星': 0, '官杀': 0, '印枭': 0
  };
  
  // 十神详细统计（十个具体十神）
  const shishenDetailed: { [key: string]: number } = {
    '比肩': 0, '劫财': 0, '食神': 0, '伤官': 0, '正财': 0,
    '偏财': 0, '正官': 0, '七杀': 0, '正印': 0, '枭神': 0
  };
  
  // 天干详细统计
  const ganDetailed: { [key: string]: number } = {};
  stems.forEach(s => ganDetailed[s] = 0);
  
  for (const [s, v] of Object.entries(finalScores)) {
    const ss = getSs(dayMaster, s);
    const cat = ssToCat[ss];
    if (cat) shishenEnergy[cat] += v;
    if (shishenDetailed[ss] !== undefined) shishenDetailed[ss] += v;
    ganDetailed[s] += v;
  }

  // 日主同党占比
  const peerPct = totalEnergy > 0 
    ? ((shishenEnergy['比劫'] + shishenEnergy['印枭']) / totalEnergy * 100) 
    : 0;

  // 强弱判定
  let status = "中和";
  let isStrong = false;
  if (peerPct > 90) {
    status = "专旺格";
    isStrong = true;
  } else if (peerPct < 24) {
    status = "身弱格";
    isStrong = false;
  } else if (peerPct >= 72) {
    status = "身强";
    isStrong = true;
  } else if (peerPct >= 50) {
    status = "中和";
    isStrong = true;
  }

  // 格局辨析
  let gegu = "普通格";
  let patternBaseSs = "未知";

  const mainQiStem = Object.keys(monthCang).reduce((a, b) =>
    (monthCang[a] || 0) > (monthCang[b] || 0) ? a : b, Object.keys(monthCang)[0] || ''
  );
  const mainQiSs = getSs(dayMaster, mainQiStem);

  if (isBureau) {
    let rawSs = "劫财";
    if (relationships[dmWx].生 === trueSeason) rawSs = "伤官";
    else if (trueSeason && relationships[trueSeason].生 === dmWx) rawSs = "枭神";
    else if (relationships[dmWx].克 === trueSeason) rawSs = "偏财";
    else if (trueSeason && relationships[trueSeason].克 === dmWx) rawSs = "七杀";

    patternBaseSs = rawSs === "比肩" ? "建禄" : (rawSs === "劫财" ? "月劫" : rawSs);
    gegu = `${trueSeason}${patternBaseSs}局`;
  } else {
    const isLuJieMonth = mainQiSs === "比肩" || mainQiSs === "劫财";
    let foundPattern = false;

    const sortedCang = Object.entries(monthCang).sort((a, b) => b[1] - a[1]);
    for (const [sItem] of sortedCang) {
      if (gans.includes(sItem)) {
        const ssTemp = getSs(dayMaster, sItem);
        if (ssTemp !== "比肩" && ssTemp !== "劫财") {
          patternBaseSs = ssTemp;
          gegu = `${patternBaseSs}格`;
          foundPattern = true;
          break;
        }
      }
    }

    if (!foundPattern) {
      if (isLuJieMonth) {
        patternBaseSs = mainQiSs === "比肩" ? "建禄" : "月劫";
        gegu = `${patternBaseSs}格`;
      } else {
        patternBaseSs = mainQiSs;
        gegu = `${patternBaseSs}格(月令本气)`;
      }
    }
  }

  // 用神裁定
  let climateGod = "无";
  let balanceGod = "无";
  let yongshen = "无";
  let decisionLog = "";

  // ================= 调候用神法则表（日主+月份） =================
  const climateGodTable: { [key: string]: { [key: string]: string[] } } = {
    '甲': {
      '寅': ['丙', '癸'], '卯': ['丙', '癸'], '辰': ['庚', '丁', '壬'],
      '巳': ['癸', '庚'], '午': ['癸', '庚'], '未': ['癸', '庚'],
      '申': ['庚', '丁', '壬'], '酉': ['庚', '丁', '壬'], '戌': ['庚', '丁', '壬'],
      '亥': ['丙', '庚'], '子': ['丙', '庚'], '丑': ['丙', '庚']
    },
    '乙': {
      '寅': ['丙', '癸'], '卯': ['丙', '癸'], '辰': ['癸', '丙'],
      '巳': ['癸', '丙'], '午': ['癸', '丙'], '未': ['癸', '丙'],
      '申': ['丙', '癸'], '酉': ['丙', '癸'], '戌': ['癸', '丙'],
      '亥': ['丙', '癸'], '子': ['丙', '癸'], '丑': ['丙', '癸']
    },
    '丙': {
      '寅': ['壬', '庚'], '卯': ['壬', '己'], '辰': ['壬', '甲'],
      '巳': ['壬', '庚'], '午': ['壬', '庚'], '未': ['壬', '庚'],
      '申': ['壬', '戊'], '酉': ['壬', '戊'], '戌': ['壬', '甲'],
      '亥': ['甲', '戊', '庚'], '子': ['壬', '戊'], '丑': ['壬', '甲']
    },
    '丁': {
      '寅': ['甲', '庚'], '卯': ['甲', '庚'], '辰': ['甲', '庚'],
      '巳': ['甲', '庚'], '午': ['壬', '庚'], '未': ['壬', '甲'],
      '申': ['甲', '庚', '丙'], '酉': ['甲', '庚', '丙'], '戌': ['甲', '庚', '戊'],
      '亥': ['甲', '庚', '戊'], '子': ['甲', '庚', '戊'], '丑': ['甲', '庚']
    },
    '戊': {
      '寅': ['丙', '甲', '癸'], '卯': ['丙', '甲', '癸'], '辰': ['丙', '甲', '癸'],
      '巳': ['癸', '丙'], '午': ['癸', '甲', '丙'], '未': ['癸', '丙', '甲'],
      '申': ['丙', '癸', '甲'], '酉': ['丙', '癸'], '戌': ['甲', '丙', '癸'],
      '亥': ['丙', '甲'], '子': ['丙', '甲'], '丑': ['丙', '甲']
    },
    '己': {
      '寅': ['丙', '癸', '甲'], '卯': ['丙', '癸'], '辰': ['丙', '癸', '甲'],
      '巳': ['癸', '丙'], '午': ['癸', '丙'], '未': ['癸', '丙'],
      '申': ['丙', '癸'], '酉': ['丙', '癸'], '戌': ['丙', '癸', '甲'],
      '亥': ['丙', '甲'], '子': ['丙', '甲'], '丑': ['丙', '甲']
    },
    '庚': {
      '寅': ['丁', '甲', '丙'], '卯': ['丁', '甲', '丙'], '辰': ['丁', '甲', '壬'],
      '巳': ['壬', '戊', '丙'], '午': ['壬', '癸', '丁'], '未': ['丁', '甲'],
      '申': ['丁', '甲'], '酉': ['丁', '甲'], '戌': ['甲', '壬'],
      '亥': ['丙', '丁', '甲'], '子': ['丙', '丁', '甲'], '丑': ['丙', '丁', '甲']
    },
    '辛': {
      '寅': ['壬', '甲'], '卯': ['壬', '甲'], '辰': ['壬', '甲'],
      '巳': ['壬', '甲', '癸'], '午': ['壬', '己', '癸'], '未': ['壬', '甲'],
      '申': ['壬', '甲'], '酉': ['壬', '甲'], '戌': ['壬', '甲'],
      '亥': ['丙', '壬', '甲'], '子': ['丙', '壬'], '丑': ['丙', '壬']
    },
    '壬': {
      '寅': ['戊', '庚', '丙'], '卯': ['戊', '辛', '庚'], '辰': ['甲', '庚'],
      '巳': ['壬', '庚', '戊'], '午': ['壬', '庚', '癸'], '未': ['辛', '甲'],
      '申': ['戊', '丁'], '酉': ['甲', '庚'], '戌': ['甲', '丙'],
      '亥': ['戊', '丙', '庚'], '子': ['戊', '丙'], '丑': ['丙', '丁', '甲']
    },
    '癸': {
      '寅': ['辛', '丙'], '卯': ['庚', '辛'], '辰': ['丙', '辛', '甲'],
      '巳': ['辛', '庚'], '午': ['庚', '辛'], '未': ['辛', '甲'],
      '申': ['丁', '甲'], '酉': ['辛', '丙'], '戌': ['辛', '甲'],
      '亥': ['庚', '辛', '戊'], '子': ['丙', '辛'], '丑': ['丙', '丁']
    }
  };

  // 根据日主和月支确定调候用神
  const climateCandidates = climateGodTable[dayMaster]?.[monthZhi] || [];
  if (climateCandidates.length > 0) {
    // 优先选择盘中存在且能量较高的
    const existingClimate = climateCandidates.filter(s => finalScores[s] > 0);
    if (existingClimate.length > 0) {
      climateGod = existingClimate.reduce((a, b) => finalScores[a] > finalScores[b] ? a : b);
      logs.push(`🌡️ [调候用神] 根据${dayMaster}生于${monthZhi}月，调候用神为${climateGod}（盘中存在）`);
    } else {
      // 如果盘中都不存在，取第一优先
      climateGod = climateCandidates[0];
      logs.push(`🌡️ [调候用神] 根据${dayMaster}生于${monthZhi}月，调候用神为${climateGod}（盘中缺失）`);
    }
  } else {
    // 兜底逻辑：按季节判定
    const isHot = ['巳', '午', '未'].includes(monthZhi);
    const isCold = ['亥', '子', '丑'].includes(monthZhi);
    climateGod = isHot ? '壬' : (isCold ? '丙' : '甲');
    logs.push(`🌡️ [调候用神] 使用季节兜底逻辑：${climateGod}`);
  }

  // 格局喜忌规则（完善版）
  const patternRules: { [key: string]: { Strong: [string[], string[]]; Weak: [string[], string[]] } } = {
    "正官": {
      "Strong": [["财星", "食伤"], ["印枭"]],
      "Weak": [["印枭", "比劫"], ["财星", "食伤"]]
    },
    "七杀": {
      "Strong": [["食伤", "印枭"], ["财星"]],
      "Weak": [["印枭", "比劫"], ["财星", "食伤"]]
    },
    "正印": {
      "Strong": [["财星", "食伤"], ["印枭", "比劫"]],
      "Weak": [["官杀", "比劫"], ["财星"]]
    },
    "枭神": {
      "Strong": [["财星", "食伤"], ["印枭"]],
      "Weak": [["比劫", "官杀"], ["食伤"]]
    },
    "偏印": {
      "Strong": [["食伤", "财星"], ["印枭"]],
      "Weak": [["比劫", "官杀"], ["食伤"]]
    },
    "食神": {
      "Strong": [["财星", "官杀"], ["印枭"]],
      "Weak": [["印枭", "比劫"], ["财星", "食伤"]]
    },
    "伤官": {
      "Strong": [["财星", "印枭"], ["官杀"]],
      "Weak": [["印枭", "比劫"], ["官杀", "财星"]]
    },
    "正财": {
      "Strong": [["食伤", "官杀"], ["比劫"]],
      "Weak": [["比劫", "印枭"], ["食伤", "财星"]]
    },
    "偏财": {
      "Strong": [["食伤", "官杀"], ["比劫"]],
      "Weak": [["比劫", "印枭"], ["食伤", "财星"]]
    },
    "建禄": {
      "Strong": [["官杀", "财星", "食伤"], ["印枭"]],
      "Weak": [["印枭", "比劫"], ["官杀", "食伤"]]
    },
    "月劫": {
      "Strong": [["官杀", "财星", "食伤"], ["印枭"]],
      "Weak": [["印枭", "比劫"], ["官杀", "财星"]]
    }
  };

  let baseKey = "正官";
  for (const k of Object.keys(patternRules)) {
    if (gegu.includes(k)) {
      baseKey = k;
      break;
    }
  }

  const strengthKey = isStrong ? "Strong" : "Weak";
  const [prefCats, tabooCats] = patternRules[baseKey][strengthKey];

  const godNatureRank: { [key: string]: number } = {
    "正官": 1, "正印": 1, "食神": 1, "正财": 1,
    "比肩": 2, "偏财": 2,
    "七杀": 3, "伤官": 3, "枭神": 3, "劫财": 3, "偏印": 3
  };

  const rawBalCats = isStrong ? ["官杀", "食伤", "财星"] : ["印枭", "比劫"];
  const filtBalCats = rawBalCats.filter(cat => !tabooCats.includes(cat));
  const finalBalCats = filtBalCats.length > 0 ? filtBalCats : prefCats;

  const candidatePool: Array<{ stem: string; isPref: number; nature: number; score: number; name: string }> = [];
  for (const s of stems) {
    if (finalScores[s] <= 0) continue;
    const ssName = getSs(dayMaster, s);
    const ssCat = ssToCat[ssName];
    if (finalBalCats.includes(ssCat) || prefCats.includes(ssCat)) {
      candidatePool.push({
        stem: s,
        isPref: prefCats.includes(ssCat) ? 1 : 0,
        nature: godNatureRank[ssName] || 4,
        score: finalScores[s],
        name: ssName
      });
    }
  }

  if (candidatePool.length > 0) {
    candidatePool.sort((a, b) => {
      if (a.isPref !== b.isPref) return b.isPref - a.isPref;
      if (a.nature !== b.nature) return a.nature - b.nature;
      return 0;
    });
    balanceGod = candidatePool[0].stem;
    decisionLog = `强弱喜忌+格局喜忌综合选优 | ${candidatePool[0].name}${balanceGod}`;
  } else {
    balanceGod = "无";
  }

  // 真神裁定
  if (peerPct >= 24 && peerPct <= 72 && climateGod !== '无') {
    // 检查调候用神在盘中的能量
    const climateEnergy = finalScores[climateGod] || 0;
    const climateWx = stemWuxing[climateGod];
    const climatePct = totalEnergy > 0 ? (wuxingScores[climateWx] / totalEnergy * 100) : 0;
    
    if (climatePct > 25) {
      // 调候已足，转向扶抑
      yongshen = balanceGod !== '无' ? balanceGod : climateGod;
      decisionLog = "调候已足转向扶抑";
    } else {
      // 气候优先
      yongshen = climateGod;
      decisionLog = "气候优先";
    }
  } else if (peerPct < 24 || peerPct > 72) {
    // 身太弱或太强，扶抑优先
    yongshen = balanceGod !== '无' ? balanceGod : climateGod;
    decisionLog = "依强弱定用";
  } else {
    // 兜底
    yongshen = balanceGod !== '无' ? balanceGod : climateGod;
    decisionLog = "依格局定用";
  }

  // 计算百分比
  const wuxingPercentages: { [key: string]: number } = {};
  const shishenPercentages: { [key: string]: number } = {};
  const shishenDetailedPercentages: { [key: string]: number } = {};
  const ganDetailedPercentages: { [key: string]: number } = {};
  
  for (const wx of ['木', '火', '土', '金', '水']) {
    wuxingPercentages[wx] = totalEnergy > 0 ? (wuxingScores[wx] / totalEnergy * 100) : 0;
  }
  
  for (const ss of ['比劫', '食伤', '财星', '官杀', '印枭']) {
    shishenPercentages[ss] = totalEnergy > 0 ? (shishenEnergy[ss] / totalEnergy * 100) : 0;
  }
  
  for (const ss of ['比肩', '劫财', '食神', '伤官', '正财', '偏财', '正官', '七杀', '正印', '枭神']) {
    shishenDetailedPercentages[ss] = totalEnergy > 0 ? (shishenDetailed[ss] / totalEnergy * 100) : 0;
  }
  
  for (const s of stems) {
    ganDetailedPercentages[s] = totalEnergy > 0 ? (ganDetailed[s] / totalEnergy * 100) : 0;
  }

  // 燥湿判定
  let isDry = false;
  let isWet = false;
  let climateLevel = "中和";
  let needGod = "";

  if (tempScore > 400) {
    isDry = true;
    climateLevel = "燥";
    needGod = "水";
    logs.push(`🔥 [气候判定] 燥热严重（气候指数${tempScore.toFixed(0)}），需用水调候`);
  } else if (tempScore > 200) {
    isDry = true;
    climateLevel = "偏燥";
    needGod = "水";
    logs.push(`🔥 [气候判定] 偏燥（气候指数${tempScore.toFixed(0)}），宜用水调候`);
  } else if (tempScore < -400) {
    isWet = true;
    climateLevel = "湿";
    needGod = "火";
    logs.push(`💧 [气候判定] 湿冷严重（气候指数${tempScore.toFixed(0)}），需用火调候`);
  } else if (tempScore < -200) {
    isWet = true;
    climateLevel = "偏湿";
    needGod = "火";
    logs.push(`💧 [气候判定] 偏湿（气候指数${tempScore.toFixed(0)}），宜用火调候`);
  } else {
    logs.push(`☀️ [气候判定] 寒温适中（气候指数${tempScore.toFixed(0)}）`);
  }

  const maxEnergy = Math.max(...Object.values(wuxingScores));

  return {
    wuxing: wuxingScores,
    shishen: shishenEnergy,
    shishenDetailed,
    ganDetailed,
    percentages: {
      wuxing: wuxingPercentages,
      shishen: shishenPercentages,
      shishenDetailed: shishenDetailedPercentages,
      ganDetailed: ganDetailedPercentages
    },
    status: {
      level: status,
      score: shishenEnergy['比劫'] + shishenEnergy['印枭'],
      percent: peerPct,
      pattern: gegu
    },
    climate: {
      tempScore,
      isDry,
      isWet,
      level: climateLevel,
      needGod
    },
    yongshen: {
      climate: climateGod,
      balance: balanceGod,
      final: yongshen,
      reason: decisionLog
    },
    core: {
      gans,
      zhis,
      dayMaster,
      trueSeason,
      isBureau,
      monthMainStem,
      finalScores,
      totalEnergy,
      peerPct,
      patternBaseSs
    },
    interactionBoosts: {
      combineNiBoost,
      clashNeBoost
    },
    maxEnergy,
    logs
  };
}