'use client';

import React from 'react';
import { ClassicalBaziData, calculateInteractions, getBaziTextualAnalysis } from '@/utils/baziLogic';

interface CircuitGraphProps {
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

// 获取五行（确保支持所有干支）
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

const CircuitGraph: React.FC<CircuitGraphProps> = ({ baziData }) => {
  const { nodes, flows, relationships } = calculateInteractions(baziData);
  const textualAnalysis = getBaziTextualAnalysis(baziData);
  
  // SVG 尺寸
  const width = 800;
  const height = 450;
  
  // 节点坐标（网格布局）
  const nodePositions = [
    // 天干 (Y = 120)
    { x: 150, y: 120 }, // 年干
    { x: 300, y: 120 }, // 月干
    { x: 450, y: 120 }, // 日干
    { x: 600, y: 120 }, // 时干
    // 地支 (Y = 300)
    { x: 150, y: 300 }, // 年支
    { x: 300, y: 300 }, // 月支
    { x: 450, y: 300 }, // 日支
    { x: 600, y: 300 }  // 时支
  ];

  // 判断是否相邻（同一行且相邻柱位，或同一柱的干支）
  const isAdjacent = (sourceIdx: number, targetIdx: number): boolean => {
    const isGan = sourceIdx < 4 && targetIdx < 4;
    const isZhi = sourceIdx >= 4 && targetIdx >= 4;
    
    // 同一行的相邻柱位
    if ((isGan || isZhi) && Math.abs(sourceIdx - targetIdx) === 1) {
      return true;
    }
    
    // 同一柱的干支（纵向相邻）
    if (Math.abs(sourceIdx - targetIdx) === 4 && sourceIdx % 4 === targetIdx % 4) {
      return true;
    }
    
    return false;
  };

  // 分离相邻和不相邻的关系
  const adjacentRelationships = relationships.filter(rel => 
    isAdjacent(rel.sourceIndex || 0, rel.targetIndex || 0)
  );
  
  const distantRelationships = relationships.filter(rel => 
    !isAdjacent(rel.sourceIndex || 0, rel.targetIndex || 0)
  );

  // 绘制正交折线（Manhattan路由）
  const drawOrthogonalPath = (
    sourceIdx: number,
    targetIdx: number,
    distance: number,
    type: string,
    index: number
  ): string => {
    const source = nodePositions[sourceIdx];
    const target = nodePositions[targetIdx];
    
    if (!source || !target) return '';
    
    // 判断是天干还是地支
    const isGan = sourceIdx < 4 && targetIdx < 4;
    const isZhi = sourceIdx >= 4 && targetIdx >= 4;
    
    // 跨干支的关系（纵向）
    if (!isGan && !isZhi) {
      return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
    }
    
    // 计算折线偏移量（根据索引防重叠）
    const baseOffset = 35;
    const offset = baseOffset + index * 15;
    
    if (isGan) {
      // 天干关系：向上折线
      const midY = source.y - offset;
      return `M ${source.x} ${source.y} 
              V ${midY} 
              H ${target.x} 
              V ${target.y}`;
    } else {
      // 地支关系：向下折线
      const midY = source.y + offset;
      return `M ${source.x} ${source.y} 
              V ${midY} 
              H ${target.x} 
              V ${target.y}`;
    }
  };

  // 获取折线中点（用于放置标签）
  const getPathMidpoint = (sourceIdx: number, targetIdx: number, index: number) => {
    const source = nodePositions[sourceIdx];
    const target = nodePositions[targetIdx];
    
    if (!source || !target) return { x: 0, y: 0 };
    
    const isGan = sourceIdx < 4 && targetIdx < 4;
    const isZhi = sourceIdx >= 4 && targetIdx >= 4;
    
    // 跨干支的关系（纵向）
    if (!isGan && !isZhi) {
      return {
        x: (source.x + target.x) / 2,
        y: (source.y + target.y) / 2
      };
    }
    
    const baseOffset = 35;
    const offset = baseOffset + index * 15;
    
    const midX = (source.x + target.x) / 2;
    const midY = isGan ? source.y - offset : source.y + offset;
    
    return { x: midX, y: midY };
  };

  // 关系类型样式
  const getRelationshipStyle = (type: string) => {
    switch (type) {
      case 'He': // 合
      case 'LiuHe': // 六合
      case 'SanHe': // 三合
      case 'SanHui': // 三会
        return { stroke: '#7FA68A', strokeWidth: 1.5, strokeDasharray: 'none', opacity: 0.7 };
      case 'Chong': // 冲
        return { stroke: '#BA5D4F', strokeWidth: 1.5, strokeDasharray: '4,3', opacity: 0.6 };
      case 'Xing': // 刑
        return { stroke: '#9B8E78', strokeWidth: 1.2, strokeDasharray: '2,2', opacity: 0.5 };
      case 'Hai': // 害
        return { stroke: '#8C7658', strokeWidth: 1.2, strokeDasharray: '3,2', opacity: 0.5 };
      default:
        return { stroke: '#A8A29E', strokeWidth: 1, strokeDasharray: 'none', opacity: 0.4 };
    }
  };

  // 格式化不相邻关系的文字描述
  const formatDistantRelation = (rel: any) => {
    const char1 = rel.chars[0];
    const char2 = rel.chars[1] || char1;
    
    // 如果是三合、三会等多字关系
    if (rel.chars.length > 2) {
      return `${rel.chars.join('')}${rel.label}`;
    }
    
    // 两字关系
    return `${char1}${char2}遥${rel.label}`;
  };

  return (
    <div className="bg-white/40 backdrop-blur-sm rounded-2xl p-3 md:p-8 mt-8">
      <div className="mb-3 md:mb-6">
        <h3 className="text-sm md:text-lg font-serif text-[#44403C] text-center tracking-wider">
          八字关系图谱
        </h3>
        <p className="text-[9px] md:text-xs font-sans text-[#A8A29E] text-center mt-1 md:mt-2">
          气 韵 流 转 · 听 见 内 在 生 命 的 呼 吸
        </p>
      </div>
      
      {/* 主图居中 - 移动端自适应缩放 */}
      <div className="flex justify-center w-full -mx-2 md:mx-0">
        <svg 
          width="100%" 
          height="auto" 
          className="overflow-visible max-w-full"
          viewBox="0 0 800 450"
          preserveAspectRatio="xMidYMid meet"
          style={{ minHeight: '300px' }}
        >
          {/* 定义箭头标记 */}
          <defs>
            {/* 生 - 绿色箭头 */}
            <marker
              id="arrow-sheng-circuit"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L6,3 z" fill="#7FA68A" />
            </marker>
            
            {/* 克 - 红色箭头 */}
            <marker
              id="arrow-ke-circuit"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L6,3 z" fill="#BA5D4F" />
            </marker>
          </defs>
          
          {/* 1. 绘制相邻关系折线 */}
          <g className="relationships">
            {adjacentRelationships.map((rel, index) => {
              const style = getRelationshipStyle(rel.type);
              const path = drawOrthogonalPath(
                rel.sourceIndex || 0,
                rel.targetIndex || 0,
                rel.distance || 0,
                rel.type,
                index
              );
              const midpoint = getPathMidpoint(
                rel.sourceIndex || 0,
                rel.targetIndex || 0,
                index
              );
              
              return (
                <g key={`rel-${index}`}>
                  <path
                    d={path}
                    fill="none"
                    stroke={style.stroke}
                    strokeWidth={style.strokeWidth}
                    strokeDasharray={style.strokeDasharray}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    opacity={style.opacity}
                  />
                  {/* 关系标签 */}
                  <g>
                    <rect
                      x={midpoint.x - 20}
                      y={midpoint.y - 8}
                      width={40}
                      height={16}
                      fill="#FFFFFF"
                      stroke={style.stroke}
                      strokeWidth={0.5}
                      rx={8}
                      opacity={0.95}
                    />
                    <text
                      x={midpoint.x}
                      y={midpoint.y + 4}
                      textAnchor="middle"
                      className="text-[9px] font-sans"
                      fill={style.stroke}
                    >
                      {rel.label}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
          
          {/* 2. 绘制能量流向箭头（相邻节点：横向相邻 + 纵向同柱） */}
          <g className="energy-flows">
            {flows
              .filter(flow => {
                const diff = Math.abs(flow.sourceIndex! - flow.targetIndex!);
                // 横向相邻（差1）或纵向同柱（差4且列相同）
                return diff === 1 || (diff === 4 && flow.sourceIndex! % 4 === flow.targetIndex! % 4);
              })
              .map((flow, index) => {
                const source = nodePositions[flow.sourceIndex!];
                const target = nodePositions[flow.targetIndex!];
                
                if (!source || !target) return null;
                
                const isSheng = flow.type === 'Sheng';
                
                // 计算起点和终点（避开节点）
                const dx = target.x - source.x;
                const dy = target.y - source.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const offset = 25;
                
                const x1 = source.x + (dx / distance) * offset;
                const y1 = source.y + (dy / distance) * offset;
                const x2 = target.x - (dx / distance) * offset;
                const y2 = target.y - (dy / distance) * offset;
                
                return (
                  <line
                    key={`flow-${index}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isSheng ? '#7FA68A' : '#BA5D4F'}
                    strokeWidth={1.2}
                    strokeDasharray={isSheng ? 'none' : '3,2'}
                    markerEnd={isSheng ? 'url(#arrow-sheng-circuit)' : 'url(#arrow-ke-circuit)'}
                    opacity={0.4}
                  />
                );
              })}
          </g>
          
          {/* 3. 绘制节点 */}
          <g className="nodes">
            {nodes.map((node, index) => {
              const pos = nodePositions[index];
              const wx = getWuxing(node.text);
              const color = wuxingColors[wx] || '#44403C';
              
              return (
                <g key={node.id}>
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={24}
                    fill="#FBF9F4"
                    stroke={color}
                    strokeWidth={2.5}
                  />
                  <text
                    x={pos.x}
                    y={pos.y + 7}
                    textAnchor="middle"
                    className="text-xl font-serif"
                    fill={color}
                  >
                    {node.text}
                  </text>
                </g>
              );
            })}
          </g>
          
          {/* 4. 柱位标签 */}
          <g className="pillar-labels">
            {['年柱', '月柱', '日柱', '时柱'].map((label, index) => (
              <text
                key={label}
                x={150 + index * 150}
                y={60}
                textAnchor="middle"
                className="text-xs font-serif fill-[#A8A29E]"
              >
                {label}
              </text>
            ))}
          </g>
        </svg>
      </div>
      
      {/* 图例 - 放在关系图和断语之间 */}
      <div className="mt-4 md:mt-8 flex flex-wrap justify-center gap-3 md:gap-6 text-[10px] md:text-[10px] font-sans text-[#A8A29E]">
        <div className="flex items-center gap-1.5 md:gap-2">
          <svg width="20" height="10" className="md:w-6 md:h-3">
            <line x1="0" y1="5" x2="20" y2="5" stroke="#7FA68A" strokeWidth="1.5" />
          </svg>
          <span>合</span>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <svg width="20" height="10" className="md:w-6 md:h-3">
            <line x1="0" y1="5" x2="20" y2="5" stroke="#BA5D4F" strokeWidth="1.5" strokeDasharray="4,3" />
          </svg>
          <span>冲</span>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <svg width="20" height="10" className="md:w-6 md:h-3">
            <line x1="0" y1="5" x2="20" y2="5" stroke="#9B8E78" strokeWidth="1.2" strokeDasharray="2,2" />
          </svg>
          <span>刑</span>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <svg width="20" height="10" className="md:w-6 md:h-3">
            <line x1="0" y1="5" x2="20" y2="5" stroke="#7FA68A" strokeWidth="1.2" markerEnd="url(#arrow-sheng-legend)" />
            <defs>
              <marker id="arrow-sheng-legend" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="#7FA68A" />
              </marker>
            </defs>
          </svg>
          <span>生</span>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <svg width="20" height="10" className="md:w-6 md:h-3">
            <line x1="0" y1="5" x2="20" y2="5" stroke="#BA5D4F" strokeWidth="1.2" strokeDasharray="3,2" markerEnd="url(#arrow-ke-legend)" />
            <defs>
              <marker id="arrow-ke-legend" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="#BA5D4F" />
              </marker>
            </defs>
          </svg>
          <span>克</span>
        </div>
      </div>
      
      {/* 原局断语列表 */}
      <div className="mt-4 md:mt-8 pt-4 md:pt-8 border-t border-stone-200 space-y-2 md:space-y-4">
        {/* 原局天干 */}
        {textualAnalysis.stems.length > 0 && (
          <div className="flex flex-col md:flex-row md:items-baseline">
            <span className="text-xs md:text-base font-serif font-bold text-[#B09F73] mb-1 md:mb-0 md:mr-2 whitespace-nowrap">
              原局天干：
            </span>
            <div className="text-[11px] md:text-sm font-sans text-stone-600 leading-relaxed">
              {textualAnalysis.stems.join(' | ')}
            </div>
          </div>
        )}

        {/* 原局地支 */}
        {textualAnalysis.branches.length > 0 && (
          <div className="flex flex-col md:flex-row md:items-baseline">
            <span className="text-xs md:text-base font-serif font-bold text-[#B09F73] mb-1 md:mb-0 md:mr-2 whitespace-nowrap">
              原局地支：
            </span>
            <div className="text-[11px] md:text-sm font-sans text-stone-600 leading-relaxed">
              {textualAnalysis.branches.join(' | ')}
            </div>
          </div>
        )}

        {/* 原局整柱 */}
        {textualAnalysis.pillars.length > 0 && (
          <div className="flex flex-col md:flex-row md:items-baseline">
            <span className="text-xs md:text-base font-serif font-bold text-[#B09F73] mb-1 md:mb-0 md:mr-2 whitespace-nowrap">
              原局整柱：
            </span>
            <div className="text-[11px] md:text-sm font-sans text-stone-600 leading-relaxed">
              {textualAnalysis.pillars.join(' | ')}
            </div>
          </div>
        )}

        {/* 如果没有任何断语 */}
        {textualAnalysis.stems.length === 0 && 
         textualAnalysis.branches.length === 0 && 
         textualAnalysis.pillars.length === 0 && (
          <div className="text-center text-xs md:text-sm font-sans text-stone-400 py-3 md:py-4">
            无特殊关系
          </div>
        )}
      </div>
    </div>
  );
};

export default CircuitGraph;
