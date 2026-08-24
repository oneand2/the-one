'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { createClient } from '@/utils/supabase/client';
import { getCached, setCached, CACHE_KEYS } from '@/utils/cache';
import localInsights20260820 from '../../content/2026-08-20.json';

const KAITI = '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif';

/** 类目：时=别的时代怎样生活，地=别处的人怎样生活，物=世界上竟有这样的存在 */
export type InsightCategory = '地' | '时' | '物';

/** 固定展示顺序 */
const CATEGORY_ORDER: InsightCategory[] = ['时', '地', '物'];

/** 从这一天起，题头插画按日期与类目存为独立 SVG，便于每日任务更新。 */
const DAILY_ILLUSTRATION_START_DATE = '2026-08-20';

const CONTENT_ILLUSTRATION_TITLES = new Set([
  '一月',
  '二十七个月',
  '日出在西',
  '爸爸日',
  '百岁观场',
  '四百岁',
  '一家四姓',
  '两段觉',
  '八条腕',
  '乳母生意',
  '母亲的家',
  '一棵森林',
]);

/**
 * 完全按标题与正文匹配的题头插画系统，不使用类目模板兜底。
 * 只用少量平涂与发丝线，像印在宣纸上的现代版画，避免抢过正文。
 */
const InsightIllustration: React.FC<{ title: string }> = ({ title }) => {
  const commonProps = {
    viewBox: '0 0 360 136',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    className: 'block h-auto w-full',
    role: 'img',
  } as const;

  if (title === '一家四姓') {
    return (
      <svg {...commonProps} aria-label="一家四姓：同一屋檐下的四张姓名笺">
        <rect width="360" height="136" fill="#F3F1E9" />
        <circle cx="296" cy="31" r="15" fill="#B87564" fillOpacity="0.66" />
        <path d="M0 92C34 77 57 81 84 58C101 44 111 38 121 38C134 38 148 62 163 67C180 73 193 58 210 48C229 37 244 39 261 55C277 70 295 72 313 61C328 53 344 49 360 49V136H0V92Z" fill="#CDD6CC" fillOpacity="0.52" />
        <path d="M82 63L180 27L278 63" stroke="#526254" strokeOpacity="0.68" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M99 58V111H261V58" stroke="#667569" strokeOpacity="0.34" strokeWidth="1" />
        <path d="M92 63H268" stroke="#526254" strokeOpacity="0.58" strokeWidth="1" strokeLinecap="round" />
        <g stroke="#59685B" strokeWidth="0.9">
          <rect x="111" y="70" width="27" height="34" rx="1.5" fill="#EEE8DA" fillOpacity="0.96" />
          <rect x="148" y="65" width="27" height="39" rx="1.5" fill="#DDE4DB" fillOpacity="0.96" />
          <rect x="185" y="68" width="27" height="36" rx="1.5" fill="#E7DDCE" fillOpacity="0.96" />
          <rect x="222" y="62" width="27" height="42" rx="1.5" fill="#D4DED5" fillOpacity="0.96" />
        </g>
        <g fill="#667569" fillOpacity="0.72">
          <circle cx="124.5" cy="78" r="2.6" />
          <circle cx="161.5" cy="73" r="2.6" />
          <circle cx="198.5" cy="76" r="2.6" />
          <circle cx="235.5" cy="70" r="2.6" />
        </g>
        <g stroke="#667569" strokeOpacity="0.52" strokeWidth="0.9" strokeLinecap="round">
          <path d="M118 87H131M118 92H128M155 82H168M155 87H166M192 85H205M192 90H202M229 79H242M229 84H239" />
        </g>
        <path d="M53 112C127 106 197 114 307 109" stroke="#647368" strokeOpacity="0.28" strokeWidth="1" strokeLinecap="round" />
      </svg>
    );
  }

  if (title === '两段觉') {
    return (
      <svg {...commonProps} aria-label="两段觉：两段睡眠之间的一盏夜灯">
        <rect width="360" height="136" fill="#F2EFE7" />
        <path d="M69 35C81 39 87 48 87 59C87 70 81 79 69 83C77 76 80 68 80 59C80 50 77 42 69 35Z" fill="#718078" fillOpacity="0.48" />
        <circle cx="278" cy="35" r="2" fill="#A86A5D" fillOpacity="0.65" />
        <circle cx="295" cy="52" r="1.5" fill="#7B887F" fillOpacity="0.5" />
        <circle cx="255" cy="57" r="1.2" fill="#7B887F" fillOpacity="0.42" />
        <path d="M42 105H318" stroke="#56645A" strokeOpacity="0.46" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M56 83C56 76 62 70 69 70H137C144 70 150 76 150 83V105H56V83Z" fill="#CBD5CC" fillOpacity="0.6" />
        <path d="M210 83C210 76 216 70 223 70H291C298 70 304 76 304 83V105H210V83Z" fill="#CBD5CC" fillOpacity="0.6" />
        <path d="M63 78C77 76 89 77 101 82M217 78C231 76 243 77 255 82" stroke="#5D6C61" strokeOpacity="0.5" strokeWidth="1" strokeLinecap="round" />
        <path d="M64 95C85 90 122 91 143 97M218 95C239 90 276 91 297 97" stroke="#748378" strokeOpacity="0.3" strokeWidth="1" strokeLinecap="round" />
        <path d="M180 74V101" stroke="#745F48" strokeOpacity="0.7" strokeWidth="1.1" />
        <path d="M173 101H187" stroke="#745F48" strokeOpacity="0.6" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M180 73C175 68 176 62 181 57C186 63 185 69 180 73Z" fill="#B66D5C" fillOpacity="0.7" />
        <ellipse cx="180" cy="103" rx="23" ry="3" fill="#9C866B" fillOpacity="0.12" />
        <path d="M58 118H146M214 118H302" stroke="#647368" strokeOpacity="0.46" strokeWidth="1.15" strokeLinecap="round" />
        <circle cx="180" cy="118" r="2.2" fill="#A86456" fillOpacity="0.68" />
      </svg>
    );
  }

  if (title === '八条腕') {
    return (
      <svg {...commonProps} aria-label="八条腕：八腕各自舒展的章鱼">
        <rect width="360" height="136" fill="#F2F0E8" />
        <circle cx="69" cy="32" r="19" fill="#C8D4CE" fillOpacity="0.38" />
        <path d="M0 29C48 36 85 24 129 30C178 37 220 26 263 31C299 35 329 31 360 25" stroke="#71857E" strokeOpacity="0.18" strokeWidth="1" />
        <path d="M0 105C53 98 99 110 147 105C203 99 254 109 305 102C326 99 344 99 360 101" stroke="#71857E" strokeOpacity="0.24" strokeWidth="1" />
        <g stroke="#8A695E" strokeOpacity="0.7" strokeWidth="2.25" strokeLinecap="round" fill="none">
          <path d="M165 63C137 76 132 105 103 116" />
          <path d="M172 67C153 87 158 111 137 122" />
          <path d="M179 69C171 91 183 111 169 124" />
          <path d="M187 69C194 92 189 115 203 124" />
          <path d="M194 67C217 84 207 110 232 120" />
          <path d="M201 63C230 75 236 103 264 111" />
          <path d="M160 58C130 59 111 83 81 88" />
          <path d="M205 57C236 53 258 73 290 75" />
        </g>
        <path d="M158 56C158 38 168 25 183 25C198 25 208 38 208 56C208 65 198 72 183 72C168 72 158 65 158 56Z" fill="#A98274" fillOpacity="0.72" />
        <path d="M164 47C170 38 177 34 186 34" stroke="#F2F0E8" strokeOpacity="0.4" strokeWidth="1.1" strokeLinecap="round" />
        <circle cx="174" cy="53" r="1.6" fill="#4E5651" />
        <circle cx="193" cy="53" r="1.6" fill="#4E5651" />
        <g fill="#F2F0E8" fillOpacity="0.75">
          <circle cx="146" cy="85" r="1.2" /><circle cx="126" cy="106" r="1.1" />
          <circle cx="161" cy="94" r="1.15" /><circle cx="152" cy="112" r="1.05" />
          <circle cx="177" cy="96" r="1.15" /><circle cx="175" cy="114" r="1.05" />
          <circle cx="191" cy="96" r="1.15" /><circle cx="195" cy="114" r="1.05" />
          <circle cx="207" cy="91" r="1.15" /><circle cx="217" cy="110" r="1.05" />
          <circle cx="221" cy="79" r="1.15" /><circle cx="246" cy="101" r="1.05" />
        </g>
        <g fill="#7F938B" fillOpacity="0.42">
          <circle cx="91" cy="53" r="1.4" />
          <circle cx="282" cy="43" r="1.2" />
          <circle cx="301" cy="92" r="1.6" />
        </g>
      </svg>
    );
  }

  if (title === '一月') {
    return (
      <svg {...commonProps} aria-label="一月：空置的诊疗室与休假行李">
        <rect width="360" height="136" fill="#F3F1E9" />
        <path d="M49 100H204" stroke="#56645A" strokeOpacity="0.58" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M59 76C59 69 65 64 72 64H157C164 64 170 69 170 76V100H59V76Z" fill="#CBD5CC" fillOpacity="0.62" />
        <path d="M68 73C89 69 119 70 145 77M68 89C94 84 131 85 162 92" stroke="#5E6C61" strokeOpacity="0.45" strokeWidth="1" strokeLinecap="round" />
        <path d="M205 100V73C205 63 213 55 223 55H234C244 55 252 63 252 73V100" stroke="#6C796E" strokeOpacity="0.58" strokeWidth="1.1" />
        <path d="M212 72H245" stroke="#6C796E" strokeOpacity="0.4" strokeWidth="1" />
        <rect x="271" y="37" width="43" height="48" rx="2" fill="#EEE8DA" stroke="#776956" strokeOpacity="0.58" strokeWidth="1" />
        <path d="M271 49H314M281 33V41M304 33V41" stroke="#776956" strokeOpacity="0.58" strokeWidth="1" strokeLinecap="round" />
        <path d="M292.5 59V74" stroke="#A86456" strokeOpacity="0.66" strokeWidth="2" strokeLinecap="round" />
        <rect x="274" y="96" width="36" height="24" rx="2" fill="#B69A7D" fillOpacity="0.4" stroke="#786956" strokeOpacity="0.58" strokeWidth="1" />
        <path d="M284 96V91H300V96M274 105H310" stroke="#786956" strokeOpacity="0.58" strokeWidth="1" />
      </svg>
    );
  }

  if (title === '爸爸日') {
    return (
      <svg {...commonProps} aria-label="爸爸日：带儿童座椅的自行车">
        <rect width="360" height="136" fill="#F3F1E9" />
        <g stroke="#56645A" strokeOpacity="0.72" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="105" cy="94" r="26" />
          <circle cx="251" cy="94" r="26" />
          <path d="M105 94L145 55L180 94H105L145 94L166 66H222L251 94M145 55H127M180 94L196 51M186 51H207" />
          <path d="M221 66V43H248V68M221 49H248" />
        </g>
        <rect x="222" y="43" width="26" height="20" rx="4" fill="#CBD5CC" fillOpacity="0.7" />
        <circle cx="235" cy="36" r="7" fill="#B78572" fillOpacity="0.72" />
        <path d="M228 61C232 66 238 66 242 61" stroke="#6C796E" strokeOpacity="0.55" strokeWidth="1" strokeLinecap="round" />
        <path d="M77 122H279" stroke="#647368" strokeOpacity="0.25" strokeWidth="1" strokeLinecap="round" />
      </svg>
    );
  }

  if (title === '二十七个月') {
    return (
      <svg {...commonProps} aria-label="二十七个月：搁置的官帽与二十七格服丧日历">
        <rect width="360" height="136" fill="#F3F0E8" />
        <path d="M55 101H167M78 96C83 81 96 74 111 74C126 74 139 81 144 96M91 74L98 52H124L131 74" stroke="#5D625C" strokeOpacity="0.68" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M72 101C78 95 86 93 94 93H129C138 93 146 95 151 101" fill="#70766F" fillOpacity="0.34" />
        <rect x="199" y="25" width="101" height="88" rx="3" fill="#EEE9DE" stroke="#6D756D" strokeOpacity="0.5" strokeWidth="1" />
        <path d="M199 42H300M215 20V30M284 20V30" stroke="#6D756D" strokeOpacity="0.5" strokeWidth="1" strokeLinecap="round" />
        <g fill="#879286" fillOpacity="0.58">
          <circle cx="217" cy="54" r="2" /><circle cx="233" cy="54" r="2" /><circle cx="249" cy="54" r="2" /><circle cx="265" cy="54" r="2" /><circle cx="281" cy="54" r="2" />
          <circle cx="217" cy="67" r="2" /><circle cx="233" cy="67" r="2" /><circle cx="249" cy="67" r="2" /><circle cx="265" cy="67" r="2" /><circle cx="281" cy="67" r="2" />
          <circle cx="217" cy="80" r="2" /><circle cx="233" cy="80" r="2" /><circle cx="249" cy="80" r="2" /><circle cx="265" cy="80" r="2" /><circle cx="281" cy="80" r="2" />
          <circle cx="217" cy="93" r="2" /><circle cx="233" cy="93" r="2" /><circle cx="249" cy="93" r="2" /><circle cx="265" cy="93" r="2" /><circle cx="281" cy="93" r="2" />
          <circle cx="217" cy="106" r="2" /><circle cx="233" cy="106" r="2" /><circle cx="249" cy="106" r="2" /><circle cx="265" cy="106" r="2" />
        </g>
        <g fill="#A86456" fillOpacity="0.7"><circle cx="281" cy="106" r="2" /><circle cx="289" cy="106" r="2" /><circle cx="297" cy="106" r="2" /></g>
      </svg>
    );
  }

  if (title === '百岁观场') {
    return (
      <svg {...commonProps} aria-label="百岁观场：手杖、灯笼与乡试号舍">
        <rect width="360" height="136" fill="#F3F0E8" />
        <path d="M232 38H308V111H232V38ZM232 56H308M248 56V111M292 56V111" stroke="#5E6A60" strokeOpacity="0.58" strokeWidth="1.1" />
        <path d="M240 38L270 23L300 38" stroke="#5E6A60" strokeOpacity="0.68" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M255 84H286M255 91H280" stroke="#7B867D" strokeOpacity="0.46" strokeWidth="1" strokeLinecap="round" />
        <path d="M102 111C102 91 108 72 121 57C127 50 132 43 132 34C132 28 128 24 122 24" stroke="#6E6254" strokeOpacity="0.72" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M151 43V103M138 55H164M141 55V79H161V55M144 79L141 91H161L158 79" stroke="#7D6854" strokeOpacity="0.65" strokeWidth="1.05" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="142" y="58" width="18" height="18" rx="2" fill="#B66D5C" fillOpacity="0.34" />
        <path d="M76 111H319" stroke="#647368" strokeOpacity="0.24" strokeWidth="1" strokeLinecap="round" />
      </svg>
    );
  }

  if (title === '日出在西') {
    return (
      <svg {...commonProps} aria-label="日出在西：金星的逆向自转">
        <rect width="360" height="136" fill="#F2F0E8" />
        <circle cx="181" cy="70" r="49" fill="#B89A7D" fillOpacity="0.42" stroke="#786956" strokeOpacity="0.5" strokeWidth="1" />
        <path d="M137 54C154 43 187 41 219 51M133 70C156 61 196 61 227 70M138 87C159 79 197 80 222 90" stroke="#F2F0E8" strokeOpacity="0.62" strokeWidth="2" strokeLinecap="round" />
        <path d="M88 34C115 14 145 10 173 14" stroke="#5E6A60" strokeOpacity="0.56" strokeWidth="1.15" strokeLinecap="round" />
        <path d="M166 9L174 14L166 19" stroke="#5E6A60" strokeOpacity="0.56" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M273 105C247 124 217 127 189 122" stroke="#A86456" strokeOpacity="0.66" strokeWidth="1.15" strokeLinecap="round" />
        <path d="M196 117L188 122L196 127" stroke="#A86456" strokeOpacity="0.66" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="79" cy="91" r="12" fill="#B66D5C" fillOpacity="0.66" />
        <path d="M55 104H104" stroke="#776956" strokeOpacity="0.46" strokeWidth="1" strokeLinecap="round" />
      </svg>
    );
  }

  if (title === '四百岁') {
    return (
      <svg {...commonProps} aria-label="四百岁：眼中留有年轮的格陵兰鲨">
        <rect width="360" height="136" fill="#F2F0E8" />
        <path d="M55 72C95 38 172 30 247 51L302 34L289 66L310 93L251 82C182 108 103 103 55 72Z" fill="#8FA099" fillOpacity="0.48" stroke="#56665F" strokeOpacity="0.58" strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M145 50L169 25L183 48M149 94L175 111L184 91" fill="#8FA099" fillOpacity="0.38" stroke="#56665F" strokeOpacity="0.48" strokeWidth="1" strokeLinejoin="round" />
        <path d="M73 69C91 61 110 58 129 58M73 77C94 83 111 85 130 84" stroke="#F2F0E8" strokeOpacity="0.52" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="232" cy="60" r="10" fill="#F2F0E8" fillOpacity="0.45" stroke="#53625B" strokeOpacity="0.58" strokeWidth="1" />
        <circle cx="232" cy="60" r="6.5" stroke="#53625B" strokeOpacity="0.48" strokeWidth="0.9" />
        <circle cx="232" cy="60" r="3" fill="#4F5A55" />
        <path d="M252 68C263 70 270 74 276 81" stroke="#53625B" strokeOpacity="0.48" strokeWidth="1" strokeLinecap="round" />
      </svg>
    );
  }

  if (title === '乳母生意') {
    return (
      <svg {...commonProps} aria-label="乳母生意：从巴黎被送往乡村乳母家的婴儿">
        <rect width="360" height="136" fill="#F3F0E8" />
        <path d="M34 102H129M47 102V57H116V102M40 57L81 35L123 57M60 70H74M88 70H102" fill="#D7DDD4" fillOpacity="0.58" stroke="#5F6D63" strokeOpacity="0.48" strokeWidth="1" strokeLinejoin="round" />
        <path d="M246 102H328M257 102V72H317V102M251 72L287 51L323 72" fill="#E6DACC" fillOpacity="0.58" stroke="#776956" strokeOpacity="0.48" strokeWidth="1" strokeLinejoin="round" />
        <path d="M120 94C150 73 181 70 211 79C229 84 242 83 258 78" stroke="#8E6A5E" strokeOpacity="0.42" strokeWidth="1.15" strokeDasharray="3 5" strokeLinecap="round" />
        <g transform="translate(160 48)">
          <path d="M0 28C0 16 10 6 22 6C34 6 44 16 44 28V52H0V28Z" fill="#CBD5CC" fillOpacity="0.82" stroke="#5E6C63" strokeOpacity="0.58" strokeWidth="1" />
          <circle cx="22" cy="19" r="6" fill="#B98272" fillOpacity="0.72" />
          <path d="M10 42C18 35 27 35 35 42" stroke="#F3F0E8" strokeOpacity="0.78" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M8 52H36" stroke="#695F52" strokeOpacity="0.52" strokeWidth="1" strokeLinecap="round" />
        </g>
        <g fill="#8A978F" fillOpacity="0.36"><circle cx="139" cy="45" r="1.4" /><circle cx="229" cy="54" r="1.4" /><circle cx="233" cy="104" r="1.1" /></g>
        <circle cx="219" cy="33" r="11" fill="#B66D5C" fillOpacity="0.22" />
        <path d="M32 112C110 108 233 110 329 114" stroke="#718078" strokeOpacity="0.2" strokeWidth="1" strokeLinecap="round" />
      </svg>
    );
  }

  if (title === '母亲的家') {
    return (
      <svg {...commonProps} aria-label="母亲的家：伴侣各自居住的两个母系家庭">
        <rect width="360" height="136" fill="#F2F0E8" />
        <circle cx="180" cy="28" r="12" fill="#B66D5C" fillOpacity="0.34" />
        <path d="M37 105H148M48 105V61H137V105M42 61L92 35L143 61M62 68H122" fill="#D4DDD5" fillOpacity="0.58" stroke="#59685F" strokeOpacity="0.56" strokeWidth="1.05" strokeLinejoin="round" />
        <path d="M212 105H323M223 105V61H312V105M217 61L267 35L318 61M237 68H297" fill="#E5D8CA" fillOpacity="0.56" stroke="#776956" strokeOpacity="0.5" strokeWidth="1.05" strokeLinejoin="round" />
        <g fill="#7D8C82" fillOpacity="0.72">
          <circle cx="72" cy="79" r="4" /><circle cx="91" cy="76" r="4" /><circle cx="110" cy="81" r="4" />
        </g>
        <g stroke="#65746A" strokeOpacity="0.58" strokeWidth="1" strokeLinecap="round">
          <path d="M65 96C66 87 68 83 72 83C76 83 78 87 79 96M84 96C85 84 87 80 91 80C95 80 97 84 98 96M103 96C104 88 106 85 110 85C114 85 116 88 117 96" />
        </g>
        <circle cx="267" cy="80" r="4" fill="#9C7768" fillOpacity="0.76" />
        <path d="M259 97C260 87 263 84 267 84C271 84 274 87 275 97" stroke="#8B6A5D" strokeOpacity="0.62" strokeWidth="1" strokeLinecap="round" />
        <path d="M138 84C160 69 181 69 204 83M204 83L198 79M204 83L199 88" stroke="#A06457" strokeOpacity="0.56" strokeWidth="1.1" strokeDasharray="3 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M221 93C197 109 166 109 139 94M139 94L145 90M139 94L145 98" stroke="#6B7A70" strokeOpacity="0.42" strokeWidth="1.05" strokeDasharray="3 4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="181" cy="83" r="2" fill="#A86456" fillOpacity="0.7" />
        <path d="M31 113C121 109 236 110 329 114" stroke="#718078" strokeOpacity="0.19" strokeWidth="1" strokeLinecap="round" />
      </svg>
    );
  }

  if (title === '一棵森林') {
    return (
      <svg {...commonProps} aria-label="一棵森林：四万七千根树干共享同一片地下根系">
        <rect width="360" height="136" fill="#F3F0E8" />
        <path d="M0 83C48 79 90 86 134 82C181 78 223 85 270 81C304 78 333 80 360 77V136H0V83Z" fill="#D9D2C3" fillOpacity="0.28" />
        <path d="M0 82C48 78 91 85 134 81C181 77 223 84 270 80C304 77 333 79 360 76" stroke="#6A786E" strokeOpacity="0.32" strokeWidth="1" />
        <g stroke="#65736A" strokeOpacity="0.58" strokeWidth="1.15" strokeLinecap="round">
          <path d="M61 82V36M95 82V25M132 82V43M168 82V20M207 82V39M246 82V28M286 82V46" />
          <path d="M61 51L51 43M61 60L71 52M95 43L83 34M95 55L107 45M132 58L120 51M132 52L141 44M168 39L154 30M168 49L181 38M207 55L196 47M207 50L217 42M246 45L234 37M246 52L258 42M286 59L275 52M286 54L296 48" />
        </g>
        <g fill="#AFC0B6" fillOpacity="0.62">
          <circle cx="48" cy="42" r="7" /><circle cx="72" cy="49" r="8" /><circle cx="82" cy="32" r="8" /><circle cx="108" cy="42" r="9" />
          <circle cx="119" cy="49" r="7" /><circle cx="143" cy="41" r="8" /><circle cx="153" cy="28" r="8" /><circle cx="181" cy="35" r="10" />
          <circle cx="195" cy="45" r="8" /><circle cx="218" cy="39" r="8" /><circle cx="233" cy="34" r="9" /><circle cx="259" cy="40" r="9" />
          <circle cx="275" cy="50" r="8" /><circle cx="298" cy="46" r="9" />
        </g>
        <g stroke="#8B705F" strokeOpacity="0.6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M38 106C63 91 84 103 105 95C128 87 143 103 168 94C191 86 205 101 230 94C254 87 271 99 304 90" />
          <path d="M60 82C61 92 68 96 79 98M95 82C95 90 101 94 110 96M132 82C132 91 144 94 153 95M168 82C168 89 163 93 154 95M207 82C207 90 199 92 189 94M246 82C246 90 238 92 230 94M286 82C286 87 295 89 304 90" />
          <path d="M105 95C95 107 83 111 66 113M168 94C177 104 188 109 205 111M230 94C224 105 218 110 206 114" />
        </g>
        <circle cx="181" cy="35" r="5" fill="#B66D5C" fillOpacity="0.68" />
        <g fill="#8A978F" fillOpacity="0.45"><circle cx="37" cy="27" r="1.3" /><circle cx="317" cy="35" r="1.5" /><circle cx="323" cy="62" r="1" /></g>
      </svg>
    );
  }

  return null;
};

export interface DailyInsight {
  id: string;
  insight_date: string;
  category: InsightCategory;
  title: string;
  body: string;
  created_at: string;
}

const LOCAL_DAILY_INSIGHTS: DailyInsight[] = localInsights20260820.items.map((item) => ({
  id: `local-${localInsights20260820.date}-${item.category}`,
  insight_date: localInsights20260820.date,
  category: item.category as InsightCategory,
  title: item.title,
  body: item.body,
  created_at: `${localInsights20260820.date}T00:00:00+08:00`,
}));

/** 本地稿优先覆盖同日期同类目，方便在 localhost 预览而不改线上数据。 */
const mergeLocalInsights = (rows: DailyInsight[]) => {
  const localKeys = new Set(
    LOCAL_DAILY_INSIGHTS.map((item) => `${item.insight_date}:${item.category}`)
  );
  return [
    ...LOCAL_DAILY_INSIGHTS,
    ...rows.filter((item) => !localKeys.has(`${item.insight_date}:${item.category}`)),
  ];
};

/** 最多取近 120 天，够翻阅存档，也不至于一次拉太多 */
const FETCH_LIMIT = 360;

interface Props {
  /** 当前选中的日期 YYYY-MM-DD */
  date: string;
}

export const DailyInsightsView: React.FC<Props> = ({ date }) => {
  const [list, setList] = useState<DailyInsight[]>(() => mergeLocalInsights([]));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = getCached<DailyInsight[]>(CACHE_KEYS.DAILY_INSIGHTS);
    if (cached && cached.length > 0) {
      setList(mergeLocalInsights(cached));
    }

    const fetchInsights = async () => {
      let supabase;
      try {
        supabase = createClient();
      } catch (e) {
        setError(e instanceof Error ? e.message : '配置异常');
        setLoading(false);
        return;
      }
      try {
        const query = supabase
          .from('daily_insights')
          .select('id, insight_date, category, title, body, created_at')
          .order('insight_date', { ascending: false })
          .limit(FETCH_LIMIT);
        const { data, error: fetchError } = await Promise.race([
          query,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 8000)
          ),
        ]);

        if (fetchError) throw fetchError;

        const rows = mergeLocalInsights((data || []) as DailyInsight[]);
        setList(rows);
        setCached(CACHE_KEYS.DAILY_INSIGHTS, rows);
      } catch (e) {
        setError(e instanceof Error ? e.message : '加载失败');
        if (!cached) setList(mergeLocalInsights([]));
      } finally {
        setLoading(false);
      }
    };

    void fetchInsights();
  }, []);

  /** 选中日期当天的三条；当天没有则回落到最近一期 */
  const { entries, fallbackDate } = useMemo(() => {
    const ofDate = (d: string) => list.filter((item) => item.insight_date === d);

    const exact = ofDate(date);
    if (exact.length > 0) return { entries: exact, fallbackDate: null as string | null };

    // 回落：取不晚于所选日期的最近一期（列表已按日期倒序）
    const earlier = list.find((item) => item.insight_date < date);
    if (!earlier) return { entries: [] as DailyInsight[], fallbackDate: null as string | null };

    return { entries: ofDate(earlier.insight_date), fallbackDate: earlier.insight_date };
  }, [list, date]);

  const ordered = useMemo(
    () =>
      [...entries].sort(
        (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
      ),
    [entries]
  );

  if (loading) {
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error && ordered.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-stone-400 text-sm font-serif tracking-wide" style={{ fontFamily: KAITI }}>
          见闻加载失败
        </p>
      </div>
    );
  }

  if (ordered.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-stone-400 font-serif text-sm tracking-wide" style={{ fontFamily: KAITI }}>
          该日见闻暂未更新
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* 回落提示：所选日期没有内容时，展示最近一期 */}
      {fallbackDate && (
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 flex items-center gap-4"
        >
          <div className="flex-1 h-px bg-stone-200/80" />
          <span
            className="text-stone-400 text-[11px] tracking-[0.18em] whitespace-nowrap"
            style={{ fontFamily: KAITI }}
          >
            最近一期 · {fallbackDate.slice(5).replace('-', '.')}
          </span>
          <div className="flex-1 h-px bg-stone-200/80" />
        </motion.div>
      )}

      <div className="space-y-6">
        {ordered.map((item, idx) => (
          <motion.article
            key={item.id}
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: idx * 0.08, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="rounded-[25px] bg-stone-900/[0.035] p-[3px] ring-1 ring-stone-900/[0.035] transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5">
              <div className="relative overflow-hidden rounded-[22px] bg-[#fdfcf8] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_14px_40px_rgba(76,65,51,0.035)] sm:p-6">
                {/* 标题行：标题在左，单字类目挂右端 */}
                <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-stone-200/50 pb-3">
                  <h3 className="font-serif text-[17px] tracking-wide text-stone-900">
                    {item.title}
                  </h3>
                  <span
                    className="flex-shrink-0 text-[13px] tracking-[0.2em] text-stone-400"
                    style={{ fontFamily: KAITI }}
                  >
                    {item.category}
                  </span>
                </div>

                {item.insight_date >= DAILY_ILLUSTRATION_START_DATE ? (
                  <div className="mb-5 overflow-hidden rounded-[17px] bg-stone-100/70 ring-1 ring-stone-900/[0.045]">
                    <svg
                      viewBox="0 0 360 136"
                      className="block h-auto w-full"
                      role="img"
                      aria-label={`${item.title}题头插画`}
                    >
                      <image
                        href={`/daily-insights/${item.insight_date}-${item.category}.svg`}
                        width="360"
                        height="136"
                      />
                    </svg>
                  </div>
                ) : CONTENT_ILLUSTRATION_TITLES.has(item.title) ? (
                  <div className="mb-5 overflow-hidden rounded-[17px] bg-stone-100/70 ring-1 ring-stone-900/[0.045]">
                    <InsightIllustration title={item.title} />
                  </div>
                ) : null}

                {/* 正文：空行分段 */}
                <div>
                  {item.body
                    .split(/\n\s*\n/)
                    .map((para) => para.trim())
                    .filter(Boolean)
                    .map((para, pIdx) => (
                      <p
                        key={pIdx}
                        className="mb-3.5 font-sans text-[13.5px] leading-[1.85] text-stone-700 last:mb-0"
                        style={{ letterSpacing: '0.02em', textAlign: 'justify' }}
                      >
                        {para}
                      </p>
                    ))}
                </div>
              </div>
            </div>
          </motion.article>
        ))}
      </div>
    </div>
  );
};
