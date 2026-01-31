// 测试修复后的真太阳时逻辑
const { Solar } = require('lunar-javascript');

const TRUE_SOLAR_BASE_LONGITUDE = 120;

/**
 * 修复后的getBaziFromSolar函数（复制自baziLogic.ts）
 */
function getBaziFromSolar(solar, longitude) {
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
}

console.log('='.repeat(60));
console.log('八字真太阳时修复验证');
console.log('='.repeat(60));

// 测试案例：1998年10月25日19:05，吉林长春（经度125.3°）
const solar = Solar.fromYmdHms(1998, 10, 25, 19, 5, 0);
const result = getBaziFromSolar(solar, 125.3);

const bazi = `${result.yearGan}${result.yearZhi} ${result.monthGan}${result.monthZhi} ${result.dayGan}${result.dayZhi} ${result.hourGan}${result.hourZhi}`;
const expected = '戊寅 壬戌 乙巳 丙戌';

console.log('\n测试输入：');
console.log('  日期时间: 1998年10月25日 19:05');
console.log('  地点: 吉林省长春市');
console.log('  经度: 125.3°');

console.log('\n真太阳时计算：');
const minutesDiff = ((125.3 - 120) / 15) * 60;
console.log(`  经度差: ${(125.3 - 120).toFixed(1)}°`);
console.log(`  时间差: +${minutesDiff.toFixed(1)}分钟`);
console.log(`  修正后时间: 19:${Math.floor(5 + minutesDiff)}（用于判定时辰）`);

console.log('\n计算结果：');
console.log(`  年柱: ${result.yearGan}${result.yearZhi}`);
console.log(`  月柱: ${result.monthGan}${result.monthZhi}`);
console.log(`  日柱: ${result.dayGan}${result.dayZhi}`);
console.log(`  时柱: ${result.hourGan}${result.hourZhi}`);

console.log('\n预期结果：');
console.log(`  ${expected}`);

console.log('\n测试结果：');
if (bazi === expected) {
  console.log('  ✓ 测试通过！八字完全正确');
  console.log('  ✓ 时柱正确为 丙戌（没有变成戊戌）');
  console.log('  ✓ 年月日柱也保持正确');
} else {
  console.log('  ✗ 测试失败！');
  console.log(`  实际: ${bazi}`);
  console.log(`  预期: ${expected}`);
}

console.log('\n' + '='.repeat(60));

// 额外测试：不带经度修正
console.log('\n额外测试：不带经度修正（北京时间）');
const resultNoCorrection = getBaziFromSolar(solar);
const baziNoCorrection = `${resultNoCorrection.yearGan}${resultNoCorrection.yearZhi} ${resultNoCorrection.monthGan}${resultNoCorrection.monthZhi} ${resultNoCorrection.dayGan}${resultNoCorrection.dayZhi} ${resultNoCorrection.hourGan}${resultNoCorrection.hourZhi}`;
console.log(`  结果: ${baziNoCorrection}`);
console.log(`  时柱: ${resultNoCorrection.hourGan}${resultNoCorrection.hourZhi}`);
console.log('  （应该与带修正的结果相同，因为19:26和19:05都在戌时）');

console.log('\n' + '='.repeat(60));
