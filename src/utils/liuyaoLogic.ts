/**
 * 六爻占卜核心逻辑
 */

/**
 * 铜钱结果类型
 * 正面（字）= 2
 * 反面（背）= 3
 */
type CoinResult = 2 | 3;

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
 * 卦象信息
 */
export interface GuaInfo {
  yaos: YaoInfo[]; // 从下到上的6个爻
  benGua: string; // 本卦名称
  bianGua?: string; // 变卦名称（如果有变爻）
}

/**
 * 模拟扔一枚铜钱
 * 返回 2（正面/字）或 3（反面/背）
 */
function tossCoin(): CoinResult {
  return Math.random() < 0.5 ? 2 : 3;
}

/**
 * 模拟一次摇卦（扔3枚铜钱）
 * 
 * 返回值及概率：
 * - 6（老阴，三正）: 1/8 = 12.5%
 * - 7（少阳，二正一反）: 3/8 = 37.5%
 * - 8（少阴，一正二反）: 3/8 = 37.5%
 * - 9（老阳，三反）: 1/8 = 12.5%
 * 
 * @returns 6, 7, 8, 或 9
 */
export function tossOnce(): YaoValue {
  const coin1 = tossCoin();
  const coin2 = tossCoin();
  const coin3 = tossCoin();
  
  const sum = coin1 + coin2 + coin3;
  
  // sum 可能是: 6 (2+2+2), 7 (2+2+3), 8 (2+3+3), 9 (3+3+3)
  return sum as YaoValue;
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
 * 起卦（摇6次，得到6个爻）
 * 从下到上：初爻 -> 二爻 -> 三爻 -> 四爻 -> 五爻 -> 上爻
 */
export function castGua(): GuaInfo {
  const yaos: YaoInfo[] = [];
  
  // 摇6次卦，从下到上
  for (let i = 0; i < 6; i++) {
    const yaoValue = tossOnce();
    yaos.push(getYaoInfo(yaoValue));
  }
  
  return {
    yaos,
    benGua: '待解析', // 后续可以添加卦象解析
    bianGua: yaos.some(y => y.isChanging) ? '待解析' : undefined,
  };
}

/**
 * 测试概率分布是否正确
 * 运行10000次，统计各个结果的出现次数
 */
export function testProbability(): Record<YaoValue, number> {
  const counts: Record<YaoValue, number> = { 6: 0, 7: 0, 8: 0, 9: 0 };
  const iterations = 10000;
  
  for (let i = 0; i < iterations; i++) {
    const result = tossOnce();
    counts[result]++;
  }
  
  // 转换为百分比
  const percentages: Record<YaoValue, number> = {
    6: (counts[6] / iterations) * 100,
    7: (counts[7] / iterations) * 100,
    8: (counts[8] / iterations) * 100,
    9: (counts[9] / iterations) * 100,
  };
  
  return percentages;
}
