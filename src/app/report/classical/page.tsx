'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { generateClassicalBaziData, ClassicalBaziData, BaziInput, inferDateFromBazi, calculateLuckCycles, LuckCycle } from '@/utils/baziLogic';
import CircuitGraph from '@/components/CircuitGraph';
import EnergySection from '@/components/EnergySection';
import LuckTimeline from '@/components/LuckTimeline';

export const dynamic = 'force-dynamic';

// 新中式莫兰迪配色 - 传统国色（优化对比度版）
const wuxingColors: { [key: string]: string } = {
  '木': '#5E7F63', // 淡竹叶青
  '火': '#BA5D4F', // 丹砂
  '土': '#8B5F45', // 深赭石（增强厚重感）
  '金': '#B09F73', // 哑光黄铜（提升明度）
  '水': '#4F7EA8'  // 黛蓝
};

// 获取五行
const getWuxing = (char: string): string => {
  const wuxingMap: { [key: string]: string } = {
    '甲': '木', '乙': '木',
    '丙': '火', '丁': '火',
    '戊': '土', '己': '土',
    '庚': '金', '辛': '金',
    '壬': '水', '癸': '水',
    '子': '水', '丑': '土', '寅': '木', '卯': '木',
    '辰': '土', '巳': '火', '午': '火', '未': '土',
    '申': '金', '酉': '金', '戌': '土', '亥': '水'
  };
  return wuxingMap[char] || '';
};

// 获取五行颜色
const getWuxingColor = (char: string): string => {
  const wx = getWuxing(char);
  return wuxingColors[wx] || '#44403C';
};

// Pillar 组件 - 地支显示，带神煞列表
const Pillar = ({
  pillar,
  zhi,
  shenSha,
  getWuxingColor
}: {
  pillar: string;
  zhi: string;
  shenSha: string[];
  getWuxingColor: (char: string) => string;
}) => {
  return (
    <div className="flex flex-col items-center space-y-3">
      {/* 地支汉字 */}
      <span
        className="text-4xl font-serif tracking-wider"
        style={{ color: getWuxingColor(zhi) }}
      >
        {zhi}
      </span>

      {/* 神煞列表 */}
      {shenSha.length > 0 && (
        <div className="flex flex-col items-center space-y-0.5 min-h-[40px]">
          {shenSha.map((sha, index) => (
            <span
              key={index}
              className="text-xs font-sans text-stone-400 leading-tight tracking-wider px-2 py-0.5 bg-stone-50/30 rounded-full"
            >
              {sha}
            </span>
          ))}
        </div>
      )}

      {/* 当没有神煞时，保持占位空间 */}
      {shenSha.length === 0 && (
        <div className="min-h-[40px]"></div>
      )}
    </div>
  );
};

const ClassicalReportContent: React.FC = () => {
  const searchParams = useSearchParams();
  const [baziData, setBaziData] = useState<ClassicalBaziData | null>(null);
  const [luckCycles, setLuckCycles] = useState<LuckCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayInfo, setDisplayInfo] = useState({
    name: '命主',
    gender: '乾造',
    solarDate: '',
    lunarDate: '',
    isInferred: false // 是否是推测的日期
  });

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    // 每次 URL 参数变化都清空旧数据、进入 loading，避免仍显示上一次排盘
    setLoading(true);
    setBaziData(null);
    setLuckCycles([]);
    setDisplayInfo({ name: '命主', gender: '乾造', solarDate: '', lunarDate: '', isInferred: false });
    setSaveStatus('idle');

    const loadBaziData = async () => {
      try {
        const mode = searchParams.get('mode');
        const name = searchParams.get('name') || '命主';
        const gender = searchParams.get('gender') || '乾造';
        const calendarType = searchParams.get('calendarType') || 'gregorian';
        
        let input: BaziInput;
        let solarDate = '';
        let lunarDate = '';
        let solarObj: any = null; // Solar对象，用于计算大运流年

        // 获取日期信息（date 模式和 bazi 模式都可能有）
        const year = parseInt(searchParams.get('year') || '2000');
        const month = parseInt(searchParams.get('month') || '1');
        const day = parseInt(searchParams.get('day') || '1');
        const hour = parseInt(searchParams.get('hour') || '12');
        const minute = parseInt(searchParams.get('minute') || '0');

        let isInferred = false;

        // @ts-ignore
        const { Solar } = await import('lunar-javascript');

        if (mode === 'date') {
          input = {
            year, month, day, hour, minute,
            location: searchParams.get('province') && searchParams.get('city') ? {
              province: searchParams.get('province') || '',
              city: searchParams.get('city') || '',
              longitude: parseFloat(searchParams.get('longitude') || '116.4')
            } : undefined
          };
          
          // date 模式：直接计算日期
          const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
          solarObj = solar; // 保存Solar对象
          const lunar = solar.getLunar();
          
          solarDate = `${year}年${month}月${day}日 ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          
          const lunarYear = lunar.getYear();
          const lunarMonthChinese = lunar.getMonthInChinese();
          const lunarDayChinese = lunar.getDayInChinese();
          
          lunarDate = `${lunarYear}年${lunarMonthChinese}月${lunarDayChinese} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        } else {
          // bazi 模式：尝试反推日期
          const gans = (searchParams.get('gans') || '').split(',');
          const zhis = (searchParams.get('zhis') || '').split(',');
          
          // 尝试反推日期
          const inferredDate = await inferDateFromBazi(gans, zhis);
          
          if (inferredDate) {
            // 反推成功
            solarDate = inferredDate.solarDateString;
            lunarDate = inferredDate.lunarDateString;
            isInferred = true;
            
            // 保存Solar对象（从反推结果中获取）
            solarObj = inferredDate.solar;
            
            // 更新 input 的日期信息
            input = {
              year: inferredDate.year,
              month: inferredDate.month,
              day: inferredDate.day,
              hour: inferredDate.hour,
              minute: inferredDate.minute,
              directBazi: { gans, zhis }
            };
          } else {
            // 反推失败，使用默认日期创建Solar对象
            solarDate = '未知日期';
            lunarDate = '';
            solarObj = Solar.fromYmdHms(year, month, day, hour, minute, 0);
            
            input = {
              year, month, day, hour, minute,
              directBazi: { gans, zhis }
            };
          }
        }

        const data = generateClassicalBaziData(input);
        setBaziData(data);
        
        // 【关键修复】计算大运流年：传入Solar对象与原局数据
        const genderNum = gender === '乾造' ? 1 : 0;
        const cycles = calculateLuckCycles(solarObj, genderNum, data);
        setLuckCycles(cycles);
        
        setDisplayInfo({
          name,
          gender,
          solarDate,
          lunarDate,
          isInferred
        });
      } catch (error) {
        console.error('加载八字数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBaziData();
  }, [searchParams]);

  const handleSaveBazi = async () => {
    setSaveStatus('saving');
    const params: Record<string, string> = {};
    searchParams.forEach((v, k) => {
      params[k] = v;
    });
    try {
      const res = await fetch('/api/records/classical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ params }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 401) throw new Error('请先登录');
        throw new Error((body as { error?: string })?.error || '保存失败');
      }
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus('error');
      console.error('保存八字失败:', e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBF9F4] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#44403C] mx-auto mb-4"></div>
          <p className="text-[#44403C] font-sans text-sm">正在排盘...</p>
        </div>
      </div>
    );
  }

  if (!baziData) {
    return (
      <div className="min-h-screen bg-[#FBF9F4] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#44403C] font-sans">加载失败，请重试</p>
        </div>
      </div>
    );
  }

  const pillars = ['year', 'month', 'day', 'hour'] as const;
  const pillarNames = ['年柱', '月柱', '日柱', '时柱'];

  return (
    <div className="min-h-screen bg-[#FBF9F4] px-6 py-12">
      {/* 头部信息卡片 - 传统名帖风格 */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto mb-16"
      >
        {/* 主容器 - 信笺质感 */}
        <div className="bg-[#FAF8F5] border-t-2 border-b-2 border-stone-300 relative">
          {/* 顶部极细线 */}
          <div className="absolute top-0 left-0 right-0 h-px bg-stone-200 mt-[3px]"></div>
          {/* 底部极细线 */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-stone-200 mb-[3px]"></div>

          {/* 内容区 */}
          <div className="py-10 px-8">
            {/* 第一行：身份区 (The Identity) */}
            <div className="flex items-center justify-center mb-6">
              {/* 姓名 (The Name) - 视觉焦点 */}
              <h1 className="text-5xl font-serif text-[#4A403A] tracking-wide leading-none">
                {displayInfo.name}
              </h1>
              {/* 分隔符 - 垂直细线 */}
              <div className="mx-4 h-6 w-px bg-stone-300"></div>
              {/* 造式 (乾造/坤造) - 纯文字 */}
              <span className="text-xl font-serif text-stone-500 tracking-wide">
                {displayInfo.gender}
              </span>
            </div>

            {/* 分割线 (The Divider) */}
            <div className="flex justify-center my-6">
              <div className="w-10 h-px bg-stone-300"></div>
            </div>

            {/* 第二行：时间区 (The Timeline) */}
            {(displayInfo.solarDate || displayInfo.lunarDate) && displayInfo.solarDate !== '未知日期' && (
              <div className="space-y-3">
                {/* 推测日期标签（如果需要） */}
                {displayInfo.isInferred && (
                  <div className="flex items-center justify-center">
                    <span className="text-[10px] font-sans text-[#B09F73] tracking-[0.3em] px-2 py-0.5 border border-[#B09F73]/30 rounded-sm">
                      推测日期
                    </span>
                  </div>
                )}
                
                {/* 日期信息 */}
                <div className="flex flex-col items-center space-y-2">
                  {/* 阳历 */}
                  <div className="flex items-baseline space-x-2">
                    <span className="text-xs font-sans text-stone-400 tracking-wider">阳历</span>
                    <span className="text-base font-sans text-stone-600 tracking-wide">
                      {displayInfo.solarDate}
                    </span>
                  </div>
                  
                  {/* 农历 */}
                  <div className="flex items-baseline space-x-2">
                    <span className="text-xs font-sans text-stone-400 tracking-wider">农历</span>
                    <span className="text-base font-serif text-stone-600 tracking-wide">
                      {(() => {
                        // 将农历日期转换为完全汉字格式
                        const lunarText = displayInfo.lunarDate;
                        // 提取年份、月份、日期、时辰
                        const match = lunarText.match(/(\d+)年(.+?)月(.+?)\s+(.+)/);
                        if (match) {
                          const [, year, month, day, time] = match;
                          // 数字转汉字
                          const numToHan = (num: string) => {
                            const hanMap: Record<string, string> = {
                              '0': '零', '1': '一', '2': '二', '3': '三', '4': '四',
                              '5': '五', '6': '六', '7': '七', '8': '八', '9': '九'
                            };
                            return num.split('').map(d => hanMap[d] || d).join('');
                          };
                          return `${numToHan(year)}年${month}月${day}${time}`;
                        }
                        return lunarText;
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 未知日期提示 */}
            {displayInfo.solarDate === '未知日期' && (
              <div className="text-center">
                <div className="text-sm font-sans text-stone-400 tracking-wider">
                  未找到匹配的日期（1960-2030）
                </div>
              </div>
            )}

            {/* 底部提示 (免责声明) */}
            {displayInfo.isInferred && displayInfo.solarDate !== '未知日期' && (
              <div className="text-center mt-6">
                <p className="text-[9px] font-sans text-stone-300 tracking-wide">
                  注：此日期为根据八字反推的最近匹配日期（1960-2030范围内）
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* 核心排盘 - 去框化设计 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="max-w-5xl mx-auto"
      >
        <div className="bg-white/40 backdrop-blur-sm rounded-2xl overflow-hidden shadow-sm">
          {/* 表头 - 极淡背景 */}
          <div className="bg-stone-50/50 py-6 px-8">
            <div className="grid grid-cols-5 gap-6">
              <div className="text-center">
                <span className="text-xs font-sans text-[#A8A29E] tracking-widest">日期</span>
              </div>
              {pillarNames.map((name, index) => (
                <div key={index} className="text-center">
                  <span className="text-sm font-serif text-[#44403C] tracking-wider">{name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 1. 主星（十神） */}
          <div className="py-4 px-8">
            <div className="grid grid-cols-5 gap-6 items-center">
              <div className="text-center">
                <span className="text-xs font-sans text-[#A8A29E]">主星</span>
              </div>
              {pillars.map((pillar) => (
                <div key={pillar} className="text-center">
                  <span className="text-sm font-sans text-[#57534E]">
                    {pillar === 'day' ? '日主' : baziData.tenGods.stems[baziData.pillars[pillar].gan]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 2. 天干 - 重点突出 */}
          <div className="bg-stone-50/30 py-6 px-8">
            <div className="grid grid-cols-5 gap-6 items-center">
              <div className="text-center">
                <span className="text-xs font-sans text-[#A8A29E]">天干</span>
              </div>
              {pillars.map((pillar) => {
                const gan = baziData.pillars[pillar].gan;
                return (
                  <div key={pillar} className="text-center">
                    <span 
                      className="text-4xl font-serif tracking-wider"
                      style={{ color: getWuxingColor(gan) }}
                    >
                      {gan}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. 地支 - 重点突出 */}
          <div className="py-8 px-8">
            <div className="grid grid-cols-5 gap-6 items-start">
              <div className="text-center pt-2">
                <span className="text-xs font-sans text-[#A8A29E]">地支</span>
              </div>
              {pillars.map((pillar) => (
                <Pillar
                  key={pillar}
                  pillar={pillar}
                  zhi={baziData.pillars[pillar].zhi}
                  shenSha={baziData.shenSha[pillar] || []}
                  getWuxingColor={getWuxingColor}
                />
              ))}
            </div>
          </div>

          {/* 4. 藏干 - 垂直堆叠，精致排版 */}
          <div className="bg-stone-50/30 py-6 px-8">
            <div className="grid grid-cols-5 gap-6">
              <div className="text-center self-start pt-2">
                <span className="text-xs font-sans text-[#A8A29E]">藏干</span>
              </div>
              {pillars.map((pillar) => {
                const zhi = baziData.pillars[pillar].zhi;
                const hiddenStems = baziData.hiddenStems[zhi] || [];
                const tenGods = baziData.tenGods.hidden[zhi] || [];
                
                return (
                  <div key={pillar} className="flex flex-col items-center space-y-3">
                    {hiddenStems.map((stem, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        {/* 副星在左 */}
                        <span className="text-[10px] font-sans text-[#A8A29E] w-12 text-right">
                          {tenGods[index]}
                        </span>
                        {/* 天干在右 */}
                        <span 
                          className="text-lg font-serif"
                          style={{ color: getWuxingColor(stem.gan) }}
                        >
                          {stem.gan}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. 星运 */}
          <div className="py-4 px-8">
            <div className="grid grid-cols-5 gap-6 items-center">
              <div className="text-center">
                <span className="text-xs font-sans text-[#A8A29E]">星运</span>
              </div>
              {pillars.map((pillar) => {
                const zhi = baziData.pillars[pillar].zhi;
                return (
                  <div key={pillar} className="text-center">
                    <span className="text-xs font-sans text-[#57534E]">
                      {baziData.lifeCycle[zhi]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 6. 自坐 */}
          <div className="bg-stone-50/30 py-4 px-8">
            <div className="grid grid-cols-5 gap-6 items-center">
              <div className="text-center">
                <span className="text-xs font-sans text-[#A8A29E]">自坐</span>
              </div>
              {pillars.map((pillar) => {
                const zhi = baziData.pillars[pillar].zhi;
                return (
                  <div key={pillar} className="text-center">
                    <span className="text-xs font-sans text-[#57534E]">
                      {baziData.selfSeat[zhi]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 7. 空亡 */}
          <div className="py-4 px-8">
            <div className="grid grid-cols-5 gap-6 items-center">
              <div className="text-center">
                <span className="text-xs font-sans text-[#A8A29E]">空亡</span>
              </div>
              {pillars.map((pillar) => (
                <div key={pillar} className="text-center">
                  <span className="text-xs font-sans text-[#57534E]">
                    {baziData.kongWang[pillar]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 8. 纳音 */}
          <div className="bg-stone-50/30 py-4 px-8">
            <div className="grid grid-cols-5 gap-6 items-center">
              <div className="text-center">
                <span className="text-xs font-sans text-[#A8A29E]">纳音</span>
              </div>
              {pillars.map((pillar) => (
                <div key={pillar} className="text-center">
                  <span className="text-xs font-sans text-[#57534E]">
                    {baziData.nayin[pillar]}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </motion.div>

      {/* 能量流向图谱 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="max-w-5xl mx-auto"
      >
        <CircuitGraph baziData={baziData} />
      </motion.div>

      {/* 能量分布板块 */}
      <EnergySection baziData={baziData} />

      {/* 大运流年区块 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="max-w-5xl mx-auto mt-16 mb-12"
      >
        {/* 分割标题 */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-stone-300"></div>
          <h2 className="px-6 text-2xl font-serif text-[#4A403A] tracking-wider">
            大运 · 流年
          </h2>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-stone-300"></div>
        </div>

        {/* 大运流年卷轴 */}
        <LuckTimeline data={luckCycles} baziData={baziData} />
      </motion.div>

      {/* 保存该八字 + 返回 - 底部操作 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="max-w-5xl mx-auto mt-12 flex flex-col sm:flex-row items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveBazi}
            disabled={saveStatus === 'saving'}
            className="px-6 py-3 text-sm font-sans text-white bg-[#44403C] hover:bg-[#57534E] rounded-full transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saveStatus === 'saving' ? '保存中…' : saveStatus === 'saved' ? '已保存' : '保存该八字'}
          </button>
          {saveStatus === 'error' && (
            <span className="text-sm text-amber-600 font-sans">保存失败，请先登录或稍后重试</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-8 py-3 text-sm font-sans text-[#57534E] bg-transparent hover:bg-stone-100/50 rounded-full transition-all duration-300"
        >
          ← 返回
        </button>
      </motion.div>
    </div>
  );
};

const ClassicalReport: React.FC = () => {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FBF9F4] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#44403C] mx-auto mb-4"></div>
          <p className="text-[#44403C] font-sans text-sm">正在加载...</p>
        </div>
      </div>
    }>
      <ClassicalReportContent />
    </Suspense>
  );
};

export default ClassicalReport;
