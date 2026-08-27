/**
 * 六爻占卜核心逻辑 —— 大衍筮法（蓍草法）
 *
 * 《系辞传》：「大衍之数五十，其用四十有九。分而为二以象两，
 * 挂一以象三，揲之以四以象四时，归奇于扐以象闰。」
 *
 * 每爻经三变而成，每变：分二 → 挂一 → 揲四 → 归奇。
 * 三变之后余策 36/32/28/24，除以四得 9/8/7/6。
 *
 * 经典概率（与逐步模拟一致，已用 20 万次蒙特卡洛验证）：
 * - 9（老阳）: 3/16 = 18.75%
 * - 7（少阳）: 5/16 = 31.25%
 * - 8（少阴）: 7/16 = 43.75%
 * - 6（老阴）: 1/16 = 6.25%
 */

/**
 * 爻的类型
 * 6 = 老阴（- -×）变阳
 * 7 = 少阳（—）不变
 * 8 = 少阴（- -）不变
 * 9 = 老阳（—○）变阴
 */
export type YaoValue = 6 | 7 | 8 | 9;

/**
 * 爻的详细信息
 */
export interface YaoInfo {
  value: YaoValue;
  name: string;
  symbol: string;
  isChanging: boolean; // 是否是变爻
  description: string;
}

/**
 * 大衍筮法「一变」的完整记录（分二、挂一、揲四、归奇）
 */
export interface DayanChange {
  change: 1 | 2 | 3; // 第几变
  before: number; // 本变开始时蓍草数（49 → 44/40 → …）
  leftCount: number; // 分二后左堆策数
  rightCount: number; // 分二后右堆策数
  remLeft: number; // 左堆揲四余数（1~4，余 0 计为 4）
  remRight: number; // 右堆挂一后揲四余数（1~4）
  setAside: number; // 归奇总数 = 挂一 + 左余 + 右余（首变 5/9，二三变 4/8）
  after: number; // 本变结束后余策
}

/**
 * 一爻的大衍筮法结果（三变之总）
 */
export interface DayanResult {
  value: YaoValue; // finalStalks / 4 → 6/7/8/9
  finalStalks: number; // 三变后余策：36/32/28/24
  changes: DayanChange[]; // 三变过程，供动画逐步重演
}

/**
 * 卦象信息
 */
export interface GuaInfo {
  yaos: YaoInfo[]; // 从下到上的6个爻
  benGua: string; // 本卦名称
  bianGua?: string; // 变卦名称（如果有变爻）
}

/**
 * 模拟大衍筮法的「一变」
 *
 * 分二挂一之后，左右两堆各自揲四，余数之和必满足同余约束：
 *   左余 + 右余 ≡ before - 1 (mod 4)
 * 因此先均匀随机左余（1~4），右余由约束唯一确定，
 * 这与「随机分二再揲四」的真实过程同分布：
 *   首变归奇 5（概率 3/4）或 9（概率 1/4）；
 *   二、三变归奇 4（概率 1/2）或 8（概率 1/2）。
 *
 * 分二的具体分点不影响概率，仅用于动画呈现，
 * 取在 35%~65% 之间且满足揲四余数的随机位置。
 */
function dayanChangeOnce(before: number, change: 1 | 2 | 3): DayanChange {
  // 左堆揲四余数：1、2、3、4 等可能（揲四余 0 计为 4）
  const remLeft = 1 + Math.floor(Math.random() * 4);
  // 右堆挂一后揲四余数，由同余约束 remLeft + remRight ≡ before - 1 (mod 4) 决定
  let remRight = (before - 1 - remLeft) % 4;
  if (remRight === 0) remRight = 4;

  const setAside = 1 + remLeft + remRight; // 挂一 + 两堆余数
  const after = before - setAside;

  // 分二：leftCount ≡ remLeft (mod 4)，且右堆须够挂一与余数
  const lo = Math.max(remLeft, Math.ceil(before * 0.35));
  const hi = Math.min(before - remRight - 1, Math.floor(before * 0.65));
  const kMin = Math.ceil((lo - remLeft) / 4);
  const kMax = Math.floor((hi - remLeft) / 4);
  const k = kMin + Math.floor(Math.random() * (kMax - kMin + 1));
  const leftCount = remLeft + 4 * k;
  const rightCount = before - leftCount;

  return { change, before, leftCount, rightCount, remLeft, remRight, setAside, after };
}

/**
 * 模拟大衍筮法起一爻（三变）
 *
 * 五十策去一不用（太极），以四十九策行三变：
 * - 第一变：49 → 44（归奇 5）或 40（归奇 9）
 * - 第二变：→ 40/36（归奇 4）或 36/32（归奇 8）
 * - 第三变：→ 36/32/28/24
 *
 * 余策除以四即爻值：36→9 老阳，32→8 少阴，28→7 少阳，24→6 老阴。
 */
export function dayanOnce(): DayanResult {
  let before = 49; // 大衍之数五十，其用四十有九
  const changes: DayanChange[] = [];

  for (let c = 1; c <= 3; c++) {
    const ch = dayanChangeOnce(before, c as 1 | 2 | 3);
    changes.push(ch);
    before = ch.after;
  }

  return {
    value: (before / 4) as YaoValue,
    finalStalks: before,
    changes,
  };
}

/**
 * 获取爻的详细信息
 */
export function getYaoInfo(value: YaoValue): YaoInfo {
  const infoMap: Record<YaoValue, YaoInfo> = {
    6: {
      value: 6,
      name: '老阴',
      symbol: '- -×',
      isChanging: true,
      description: '变爻，阴极生阳',
    },
    7: {
      value: 7,
      name: '少阳',
      symbol: '—',
      isChanging: false,
      description: '阳爻不变',
    },
    8: {
      value: 8,
      name: '少阴',
      symbol: '- -',
      isChanging: false,
      description: '阴爻不变',
    },
    9: {
      value: 9,
      name: '老阳',
      symbol: '—○',
      isChanging: true,
      description: '变爻，阳极生阴',
    },
  };

  return infoMap[value];
}

/**
 * 起卦（大衍筮法行十八变，得六爻）
 * 从下到上：初爻 -> 二爻 -> 三爻 -> 四爻 -> 五爻 -> 上爻
 */
export function castGua(): GuaInfo {
  const yaos: YaoInfo[] = [];

  for (let i = 0; i < 6; i++) {
    yaos.push(getYaoInfo(dayanOnce().value));
  }

  return {
    yaos,
    benGua: '待解析', // 后续可以添加卦象解析
    bianGua: yaos.some(y => y.isChanging) ? '待解析' : undefined,
  };
}

/**
 * 测试大衍筮法概率分布是否正确
 * 运行10000次，统计各个结果的出现次数
 */
export function testProbability(): Record<YaoValue, number> {
  const counts: Record<YaoValue, number> = { 6: 0, 7: 0, 8: 0, 9: 0 };
  const iterations = 10000;

  for (let i = 0; i < iterations; i++) {
    const result = dayanOnce();
    counts[result.value]++;
  }

  // 转换为百分比（理论值：9→18.75%，7→31.25%，8→43.75%，6→6.25%）
  const percentages: Record<YaoValue, number> = {
    6: (counts[6] / iterations) * 100,
    7: (counts[7] / iterations) * 100,
    8: (counts[8] / iterations) * 100,
    9: (counts[9] / iterations) * 100,
  };

  return percentages;
}
