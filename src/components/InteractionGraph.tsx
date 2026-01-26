'use client';

import React from 'react';
import { ClassicalBaziData, BaziInteractions, calculateInteractions } from '@/utils/baziLogic';

interface InteractionGraphProps {
  baziData: ClassicalBaziData;
}

// 五行颜色（新中式莫兰迪配色 - 优化对比度版）
const wuxingColors: { [key: string]: string } = {
  '木': '#5E7F63',
  '火': '#BA5D4F',
  '土': '#8B5F45', // 深赭石（增强厚重感）
  '金': '#B09F73', // 哑光黄铜（提升明度）
  '水': '#4F7EA8'
};

// 获取五行
const getWuxing = (char: string): string => {
  const wuxingMap: { [key: string]: string } = {
    '甲': '木', '乙': '木', '丙': '火', '丁': '火',
    '戊': '土', '己': '土', '庚': '金', '辛': '金',
    '壬': '水', '癸': '水',
    '子': '水', '丑': '土', '寅': '木', '卯': '木',
    '辰': '土', '巳': '火', '午': '火', '未': '土',
    '申': '金', '酉': '金', '戌': '土', '亥': '水'
  };
  return wuxingMap[char] || '';
};

const InteractionGraph: React.FC<InteractionGraphProps> = ({ baziData }) => {
  const interactions = calculateInteractions(baziData);
  
  // SVG 尺寸
  const width = 900;
  const height = 350;
  const padding = 120;
  
  // 计算节点位置
  const pillars = ['year', 'month', 'day', 'hour'] as const;
  const nodeSpacing = (width - 2 * padding) / 3;
  
  // 获取节点坐标
  const getNodePos = (pillarIndex: number, type: 'gan' | 'zhi') => {
    const x = padding + pillarIndex * nodeSpacing;
    const y = type === 'gan' ? 140 : 260;
    return { x, y };
  };
  
  // 为每个柱位收集关系文字标注
  const pillarRelations: { [key: string]: string[] } = {
    year: [], month: [], day: [], hour: []
  };
  
  interactions.relationships.forEach(rel => {
    if (rel.chars.length === 2) {
      const label = rel.label + (rel.resultingElement ? `化${rel.resultingElement}` : '');
      rel.pillars.forEach(p => {
        if (!pillarRelations[p].includes(label)) {
          pillarRelations[p].push(label);
        }
      });
    }
  });
  
  return (
    <div className="bg-white/40 backdrop-blur-sm rounded-2xl p-8 mt-8">
      <div className="mb-6">
        <h3 className="text-lg font-serif text-[#44403C] text-center tracking-wider">
          能量流向 · 刑冲合害
        </h3>
        <p className="text-xs font-sans text-[#A8A29E] text-center mt-2">
          八字之间的复杂关系可视化
        </p>
      </div>
      
      {/* 关系文字标注区（上方） */}
      <div className="mb-6">
        <div className="grid grid-cols-4 gap-4 max-w-4xl mx-auto">
          {pillars.map((pillar) => (
            <div key={`rel-text-${pillar}`} className="text-center space-y-1">
              {pillarRelations[pillar].length > 0 ? (
                pillarRelations[pillar].map((rel, idx) => (
                  <div key={idx} className="text-[10px] font-sans text-[#8C7658] bg-stone-50/50 rounded-full px-2 py-1 inline-block">
                    {rel}
                  </div>
                ))
              ) : (
                <div className="text-[10px] font-sans text-[#D6D3D1]">-</div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      <div className="flex justify-center">
        <svg 
          width={width} 
          height={height} 
          className="overflow-visible"
        >
          {/* 定义箭头标记 */}
          <defs>
            {/* 生 - 绿色箭头 */}
            <marker
              id="arrow-sheng"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,6 L6,3 z" fill="#7FA68A" />
            </marker>
            
            {/* 克 - 红色箭头 */}
            <marker
              id="arrow-ke"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,6 L6,3 z" fill="#BA5D4F" />
            </marker>
          </defs>
          
          {/* 绘制生克关系箭头 - 只显示相邻柱之间 */}
          <g className="flows">
            {interactions.flows
              .filter(flow => {
                const pillarIndex1 = pillars.indexOf(flow.fromPillar as any);
                const pillarIndex2 = pillars.indexOf(flow.toPillar as any);
                // 只显示相邻柱的生克关系
                return Math.abs(pillarIndex1 - pillarIndex2) === 1;
              })
              .map((flow, index) => {
                const pillarIndex1 = pillars.indexOf(flow.fromPillar as any);
                const pillarIndex2 = pillars.indexOf(flow.toPillar as any);
                
                const pos1 = getNodePos(pillarIndex1, flow.fromType);
                const pos2 = getNodePos(pillarIndex2, flow.toType);
                
                const isSheng = flow.type === 'Sheng';
                
                // 调整起点和终点以避免覆盖圆圈
                const dx = pos2.x - pos1.x;
                const dy = pos2.y - pos1.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const offset = 30;
                
                const x1 = pos1.x + (dx / distance) * offset;
                const y1 = pos1.y + (dy / distance) * offset;
                const x2 = pos2.x - (dx / distance) * offset;
                const y2 = pos2.y - (dy / distance) * offset;
                
                return (
                  <g key={`flow-${index}`}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={isSheng ? '#7FA68A' : '#BA5D4F'}
                      strokeWidth={1.5}
                      strokeDasharray={isSheng ? 'none' : '4,4'}
                      markerEnd={isSheng ? 'url(#arrow-sheng)' : 'url(#arrow-ke)'}
                      opacity={0.5}
                    />
                  </g>
                );
              })}
          </g>
          
          {/* 绘制天干节点 */}
          <g className="gan-nodes">
            <text
              x={padding - 50}
              y={140}
              textAnchor="end"
              className="text-xs font-sans fill-[#A8A29E]"
            >
              天干
            </text>
            {pillars.map((pillar, index) => {
              const gan = baziData.pillars[pillar].gan;
              const pos = getNodePos(index, 'gan');
              const wx = getWuxing(gan);
              const color = wuxingColors[wx] || '#44403C';
              
              return (
                <g key={`gan-${pillar}`}>
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={28}
                    fill="white"
                    stroke={color}
                    strokeWidth={2.5}
                  />
                  <text
                    x={pos.x}
                    y={pos.y + 8}
                    textAnchor="middle"
                    className="text-2xl font-serif"
                    fill={color}
                  >
                    {gan}
                  </text>
                </g>
              );
            })}
          </g>
          
          {/* 绘制地支节点 */}
          <g className="zhi-nodes">
            <text
              x={padding - 50}
              y={260}
              textAnchor="end"
              className="text-xs font-sans fill-[#A8A29E]"
            >
              地支
            </text>
            {pillars.map((pillar, index) => {
              const zhi = baziData.pillars[pillar].zhi;
              const pos = getNodePos(index, 'zhi');
              const wx = getWuxing(zhi);
              const color = wuxingColors[wx] || '#44403C';
              
              return (
                <g key={`zhi-${pillar}`}>
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={28}
                    fill="white"
                    stroke={color}
                    strokeWidth={2.5}
                  />
                  <text
                    x={pos.x}
                    y={pos.y + 8}
                    textAnchor="middle"
                    className="text-2xl font-serif"
                    fill={color}
                  >
                    {zhi}
                  </text>
                </g>
              );
            })}
          </g>
          
          {/* 柱位标签 */}
          <g className="pillar-labels">
            {pillars.map((pillar, index) => {
              const pos = getNodePos(index, 'gan');
              const labels = ['年柱', '月柱', '日柱', '时柱'];
              
              return (
                <text
                  key={`label-${pillar}`}
                  x={pos.x}
                  y={60}
                  textAnchor="middle"
                  className="text-xs font-serif fill-[#A8A29E]"
                >
                  {labels[index]}
                </text>
              );
            })}
          </g>
        </svg>
      </div>
      
      {/* 图例 */}
      <div className="mt-6 flex flex-wrap justify-center gap-6 text-xs font-sans text-[#A8A29E]">
        <div className="flex items-center gap-2">
          <svg width="24" height="12">
            <line x1="0" y1="6" x2="24" y2="6" stroke="#7FA68A" strokeWidth="1.5" markerEnd="url(#arrow-sheng-legend)" />
            <defs>
              <marker id="arrow-sheng-legend" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="#7FA68A" />
              </marker>
            </defs>
          </svg>
          <span>生</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="24" height="12">
            <line x1="0" y1="6" x2="24" y2="6" stroke="#BA5D4F" strokeWidth="1.5" strokeDasharray="4,4" markerEnd="url(#arrow-ke-legend)" />
            <defs>
              <marker id="arrow-ke-legend" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="#BA5D4F" />
              </marker>
            </defs>
          </svg>
          <span>克</span>
        </div>
      </div>
    </div>
  );
};

export default InteractionGraph;
