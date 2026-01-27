'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { analyzeBazi, BaziInput, BaziResult, generateClassicalBaziData, calculateEnergyProfile } from '@/utils/baziLogic';

export const BaZiView: React.FC = () => {
  const router = useRouter();
  const [inputMode, setInputMode] = useState<'date' | 'bazi'>('date');
  const [calendarType, setCalendarType] = useState<'solar' | 'lunar'>('solar');

  const [name, setName] = useState('');
  const [gender, setGender] = useState<'乾造' | '坤造'>('乾造');

  const [dateInput, setDateInput] = useState({
    year: 2000,
    month: 1,
    day: 1,
    hour: 12,
    minute: 0,
    location: {
      province: '北京市',
      city: '北京市',
      longitude: 116.4
    }
  });

  const [lunarDateInput, setLunarDateInput] = useState({
    year: 2000,
    month: 1,
    day: 1,
    hour: 12,
    minute: 0,
    isLeapMonth: false,
    location: {
      province: '北京市',
      city: '北京市',
      longitude: 116.4
    }
  });

  const [baziInput, setBaziInput] = useState({
    gans: ['甲', '乙', '丙', '丁'],
    zhis: ['子', '丑', '寅', '卯']
  });

  const [result, setResult] = useState<BaziResult | null>(null);
  const [lastCalculatedInput, setLastCalculatedInput] = useState<BaziInput | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [activeSelectId, setActiveSelectId] = useState<string | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState('北京市');
  const [selectedCity, setSelectedCity] = useState('北京市');
  const [quickInputText, setQuickInputText] = useState('');
  const classicalProfile = lastCalculatedInput
    ? (() => {
        const classicalData = generateClassicalBaziData(lastCalculatedInput);
        return calculateEnergyProfile(classicalData);
      })()
    : null;

  const getDaysInMonth = (year: number, month: number): number => {
    return new Date(year, month, 0).getDate();
  };

  const generateDateOptions = (): number[] => {
    const daysInMonth = getDaysInMonth(dateInput.year, dateInput.month);
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  };

  const yearOptions = Array.from({ length: 151 }, (_, i) => 1900 + i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const hourOptions = Array.from({ length: 24 }, (_, i) => i);

  const cityCoordinates: Record<string, number> = {
    // 直辖市
    '北京市': 116.4, '上海市': 121.5, '天津市': 117.2, '重庆市': 106.5,
    // 广东省
    '广州市': 113.3, '深圳市': 114.1, '珠海市': 113.6, '汕头市': 116.7, '韶关市': 113.6, '佛山市': 113.1, '江门市': 113.1, '湛江市': 110.4, '茂名市': 110.9, '肇庆市': 112.5, '惠州市': 114.4, '梅州市': 116.1, '汕尾市': 115.4, '河源市': 114.7, '阳江市': 111.98, '清远市': 113.0, '东莞市': 113.8, '中山市': 113.4, '潮州市': 116.6, '揭阳市': 116.4, '云浮市': 112.0,
    // 江苏省
    '南京市': 118.8, '无锡市': 120.3, '徐州市': 117.2, '常州市': 119.9, '苏州市': 120.6, '南通市': 120.9, '连云港市': 119.2, '淮安市': 119.0, '盐城市': 120.1, '扬州市': 119.4, '镇江市': 119.4, '泰州市': 119.9, '宿迁市': 118.3,
    // 浙江省
    '杭州市': 120.2, '宁波市': 121.6, '温州市': 120.7, '嘉兴市': 120.8, '湖州市': 120.1, '绍兴市': 120.6, '金华市': 119.6, '衢州市': 118.9, '舟山市': 122.1, '台州市': 121.4, '丽水市': 119.9,
    // 山东省
    '济南市': 117.0, '青岛市': 120.4, '淄博市': 118.1, '枣庄市': 117.6, '东营市': 118.7, '烟台市': 121.4, '潍坊市': 119.1, '济宁市': 116.6, '泰安市': 117.1, '威海市': 122.1, '日照市': 119.5, '临沂市': 118.4, '德州市': 116.3, '聊城市': 115.9, '滨州市': 118.0, '菏泽市': 115.5,
    // 河南省
    '郑州市': 113.7, '开封市': 114.3, '洛阳市': 112.4, '平顶山市': 113.3, '安阳市': 114.4, '鹤壁市': 114.3, '新乡市': 113.9, '焦作市': 113.2, '濮阳市': 115.0, '许昌市': 113.8, '漯河市': 114.0, '三门峡市': 111.2, '南阳市': 112.5, '商丘市': 115.7, '信阳市': 114.1, '周口市': 114.6, '驻马店市': 114.0, '济源市': 112.6,
    // 四川省
    '成都市': 104.1, '自贡市': 104.8, '攀枝花市': 101.7, '泸州市': 105.4, '德阳市': 104.4, '绵阳市': 104.7, '广元市': 105.8, '遂宁市': 105.6, '内江市': 105.1, '乐山市': 103.8, '南充市': 106.1, '眉山市': 103.8, '宜宾市': 104.6, '广安市': 106.6, '达州市': 107.5, '雅安市': 103.0, '巴中市': 106.8, '资阳市': 104.6,
    // 湖北省
    '武汉市': 114.3, '黄石市': 115.0, '十堰市': 110.8, '宜昌市': 111.3, '襄阳市': 112.1, '鄂州市': 114.9, '荆门市': 112.2, '孝感市': 113.9, '荆州市': 112.2, '黄冈市': 114.9, '咸宁市': 114.3, '随州市': 113.4,
    // 湖南省
    '长沙市': 113.0, '株洲市': 113.2, '湘潭市': 112.9, '衡阳市': 112.6, '邵阳市': 111.5, '岳阳市': 113.1, '常德市': 111.7, '张家界市': 110.5, '益阳市': 112.4, '郴州市': 113.0, '永州市': 111.6, '怀化市': 110.0, '娄底市': 112.0,
    // 辽宁省
    '沈阳市': 123.4, '大连市': 121.6, '鞍山市': 122.9, '抚顺市': 123.9, '本溪市': 123.8, '丹东市': 124.4, '锦州市': 121.1, '营口市': 122.2, '阜新市': 121.7, '辽阳市': 123.2, '盘锦市': 122.1, '铁岭市': 123.8, '朝阳市': 120.5, '葫芦岛市': 120.8,
    // 陕西省
    '西安市': 108.9, '铜川市': 109.0, '宝鸡市': 107.1, '咸阳市': 108.7, '渭南市': 109.5, '延安市': 109.5, '汉中市': 107.0, '榆林市': 109.7, '安康市': 109.0, '商洛市': 109.9,
    // 福建省
    '福州市': 119.3, '厦门市': 118.1, '莆田市': 119.0, '三明市': 117.6, '泉州市': 118.6, '漳州市': 117.6, '南平市': 118.2, '龙岩市': 117.0, '宁德市': 119.5,
    // 河北省
    '石家庄市': 114.5, '唐山市': 118.2, '秦皇岛市': 119.6, '邯郸市': 114.5, '邢台市': 114.5, '保定市': 115.5, '张家口市': 114.9, '承德市': 117.9, '沧州市': 116.8, '廊坊市': 116.7, '衡水市': 115.7,
    // 山西省
    '太原市': 112.5, '大同市': 113.3, '阳泉市': 113.6, '长治市': 113.1, '晋城市': 112.8, '朔州市': 112.4, '晋中市': 112.7, '运城市': 111.0, '忻州市': 112.7, '临汾市': 111.5, '吕梁市': 111.1,
    // 内蒙古自治区
    '呼和浩特市': 111.7, '包头市': 110.0, '乌海市': 106.8, '赤峰市': 118.9, '通辽市': 122.3, '鄂尔多斯市': 109.8, '呼伦贝尔市': 119.7, '巴彦淖尔市': 107.4, '乌兰察布市': 113.1, '兴安盟': 122.0, '锡林郭勒盟': 116.1, '阿拉善盟': 105.7,
    // 吉林省
    '长春市': 125.3, '吉林市': 126.6, '四平市': 124.4, '辽源市': 125.1, '通化市': 125.9, '白山市': 126.4, '松原市': 124.8, '白城市': 122.8, '延边朝鲜族自治州': 129.5,
    // 黑龙江省
    '哈尔滨市': 126.6, '齐齐哈尔市': 123.9, '鸡西市': 130.9, '鹤岗市': 130.3, '双鸭山市': 131.1, '大庆市': 125.0, '伊春市': 128.8, '佳木斯市': 130.3, '七台河市': 131.0, '牡丹江市': 129.6, '黑河市': 127.5, '绥化市': 126.9, '大兴安岭地区': 124.1,
    // 安徽省
    '合肥市': 117.2, '芜湖市': 118.4, '蚌埠市': 117.4, '淮南市': 116.9, '马鞍山市': 118.5, '淮北市': 116.8, '铜陵市': 117.8, '安庆市': 117.1, '黄山市': 118.3, '滁州市': 118.3, '阜阳市': 115.8, '宿州市': 116.9, '六安市': 116.5, '亳州市': 115.8, '池州市': 117.5, '宣城市': 118.8,
    // 江西省
    '南昌市': 115.9, '景德镇市': 117.2, '萍乡市': 113.8, '九江市': 116.0, '新余市': 114.9, '鹰潭市': 117.1, '赣州市': 114.9, '吉安市': 114.9, '宜春市': 114.4, '抚州市': 116.3, '上饶市': 117.9,
    // 广西壮族自治区
    '南宁市': 108.3, '柳州市': 109.4, '桂林市': 110.3, '梧州市': 111.3, '北海市': 109.1, '防城港市': 108.4, '钦州市': 108.6, '贵港市': 109.6, '玉林市': 110.2, '百色市': 106.6, '贺州市': 111.6, '河池市': 108.1, '来宾市': 109.2, '崇左市': 107.4,
    // 海南省
    '海口市': 110.3, '三亚市': 109.5, '三沙市': 112.3, '儋州市': 109.6, '五指山市': 109.5, '琼海市': 110.5, '文昌市': 110.8, '万宁市': 110.4, '东方市': 108.7, '定安县': 110.3, '屯昌县': 110.1, '澄迈县': 110.0, '临高县': 109.7, '白沙黎族自治县': 109.4, '昌江黎族自治县': 109.0, '乐东黎族自治县': 109.2, '陵水黎族自治县': 110.0, '保亭黎族苗族自治县': 109.7, '琼中黎族苗族自治县': 109.8,
    // 贵州省
    '贵阳市': 106.7, '六盘水市': 104.8, '遵义市': 106.9, '安顺市': 105.9, '铜仁市': 109.2, '黔西南布依族苗族自治州': 104.9, '毕节市': 105.3, '黔东南苗族侗族自治州': 107.9, '黔南布依族苗族自治州': 107.5,
    // 云南省
    '昆明市': 102.7, '曲靖市': 103.8, '玉溪市': 102.6, '保山市': 99.1, '昭通市': 103.7, '丽江市': 100.2, '普洱市': 100.9, '临沧市': 100.1, '楚雄彝族自治州': 101.5, '红河哈尼族彝族自治州': 103.4, '文山壮族苗族自治州': 104.2, '西双版纳傣族自治州': 100.8, '大理白族自治州': 100.3, '德宏傣族景颇族自治州': 98.6, '怒江傈僳族自治州': 98.9, '迪庆藏族自治州': 99.7,
    // 西藏自治区
    '拉萨市': 91.1, '日喀则市': 88.9, '昌都市': 97.2, '林芝市': 94.4, '山南市': 91.8, '那曲市': 92.1, '阿里地区': 80.1,
    // 甘肃省
    '兰州市': 103.8, '嘉峪关市': 98.3, '金昌市': 102.2, '白银市': 104.1, '天水市': 105.7, '武威市': 102.6, '张掖市': 100.4, '平凉市': 106.7, '酒泉市': 98.5, '庆阳市': 107.6, '定西市': 104.6, '陇南市': 104.9, '临夏回族自治州': 103.2, '甘南藏族自治州': 102.9,
    // 青海省
    '西宁市': 101.8, '海东市': 102.1, '海北藏族自治州': 100.9, '黄南藏族自治州': 102.0, '海南藏族自治州': 100.6, '果洛藏族自治州': 100.2, '玉树藏族自治州': 97.0, '海西蒙古族藏族自治州': 97.4,
    // 宁夏回族自治区
    '银川市': 106.3, '石嘴山市': 106.4, '吴忠市': 106.2, '固原市': 106.3, '中卫市': 105.2,
    // 新疆维吾尔自治区
    '乌鲁木齐市': 87.6, '克拉玛依市': 84.9, '吐鲁番市': 89.2, '哈密市': 93.5, '昌吉回族自治州': 87.3, '博尔塔拉蒙古自治州': 82.1, '巴音郭楞蒙古自治州': 86.1, '阿克苏地区': 80.3, '克孜勒苏柯尔克孜自治州': 76.2, '喀什地区': 75.99, '和田地区': 79.9, '伊犁哈萨克自治州': 81.3, '塔城地区': 82.9, '阿勒泰地区': 88.1,
    // 港澳台
    '香港特别行政区': 114.2, '澳门特别行政区': 113.5,
    '台北市': 121.5, '新北市': 121.5, '桃园市': 121.3, '台中市': 120.7, '台南市': 120.2, '高雄市': 120.3, '基隆市': 121.7, '新竹市': 120.96, '嘉义市': 120.4, '新竹县': 121.0, '苗栗县': 120.8, '彰化县': 120.5, '南投县': 120.7, '云林县': 120.5, '嘉义县': 120.5, '屏东县': 120.5, '宜兰县': 121.6, '花莲县': 121.6, '台东县': 121.1, '澎湖县': 119.6, '金门县': 118.3, '连江县': 119.9,
  };

  const getCityLongitude = (cityName: string): number => {
    return cityCoordinates[cityName] || 116.4;
  };

  const getWuxingColor = (char: string): string => {
    const wuxingMap: Record<string, string> = {
      '庚': '#B09F73', '辛': '#B09F73', '申': '#B09F73', '酉': '#B09F73',
      '甲': '#7a9b85', '乙': '#7a9b85', '寅': '#7a9b85', '卯': '#7a9b85',
      '壬': '#6b7c97', '癸': '#6b7c97', '子': '#6b7c97', '亥': '#6b7c97',
      '丙': '#ba6e65', '丁': '#ba6e65', '巳': '#ba6e65', '午': '#ba6e65',
      '戊': '#8B5F45', '己': '#8B5F45', '辰': '#8B5F45', '戌': '#8B5F45', '丑': '#8B5F45', '未': '#8B5F45'
    };
    return wuxingMap[char] || '#333333';
  };

  const yinYangMap = {
    gans: {
      yang: ['甲', '丙', '戊', '庚', '壬'],
      yin: ['乙', '丁', '己', '辛', '癸']
    },
    zhis: {
      yang: ['子', '寅', '辰', '午', '申', '戌'],
      yin: ['丑', '卯', '巳', '未', '酉', '亥']
    }
  };

  const getZhiOptions = (gan: string): string[] => {
    if (!gan) return ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    const isYangGan = yinYangMap.gans.yang.includes(gan);
    return isYangGan ? yinYangMap.zhis.yang : yinYangMap.zhis.yin;
  };

  const parseQuickInput = (text: string) => {
    if (!text.trim()) return;
    const cleanText = text.replace(/\s+/g, '');
    const ganZhiPairs: string[] = [];
    for (let i = 0; i < cleanText.length - 1; i += 2) {
      if (i + 1 < cleanText.length) {
        const pair = cleanText.slice(i, i + 2);
        if (pair.length === 2) {
          ganZhiPairs.push(pair);
        }
      }
    }
    if (ganZhiPairs.length < 4) return;

    const validGans = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
    const validZhis = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    const parsedGans: string[] = [];
    const parsedZhis: string[] = [];

    for (const pair of ganZhiPairs.slice(0, 4)) {
      const [gan, zhi] = pair.split('');
      if (validGans.includes(gan) && validZhis.includes(zhi)) {
        parsedGans.push(gan);
        parsedZhis.push(zhi);
      } else {
        return;
      }
    }

    for (let i = 0; i < 4; i++) {
      const gan = parsedGans[i];
      const zhi = parsedZhis[i];
      const isYangGan = yinYangMap.gans.yang.includes(gan);
      const isYangZhi = yinYangMap.zhis.yang.includes(zhi);
      if (isYangGan !== isYangZhi) {
        return;
      }
    }

    setBaziInput({
      ...baziInput,
      gans: parsedGans,
      zhis: parsedZhis
    });
  };

  React.useEffect(() => {
    const maxDays = getDaysInMonth(dateInput.year, dateInput.month);
    if (dateInput.day > maxDays) {
      setDateInput(prev => ({ ...prev, day: maxDays }));
    }
  }, [dateInput.year, dateInput.month]);

  const handleLocationSelect = (province: string, city: string) => {
    setSelectedProvince(province);
    setSelectedCity(city);
    const longitude = getCityLongitude(city);
    setDateInput({
      ...dateInput,
      location: {
        province,
        city,
        longitude
      }
    });
    setShowLocationPicker(false);
  };

  const handleCalculate = async () => {
    setIsCalculating(true);
    setTimeout(async () => {
      try {
        let input: BaziInput;
        
        if (inputMode === 'date') {
          if (calendarType === 'lunar') {
            // @ts-ignore
            const { Lunar } = await import('lunar-javascript');
            const lunar = Lunar.fromYmd(
              lunarDateInput.year,
              lunarDateInput.month,
              lunarDateInput.day,
              lunarDateInput.isLeapMonth
            );
            const solar = lunar.getSolar();
            
            input = {
              year: solar.getYear(),
              month: solar.getMonth(),
              day: solar.getDay(),
              hour: lunarDateInput.hour,
              minute: lunarDateInput.minute,
              location: lunarDateInput.location
            };
          } else {
            input = { ...dateInput };
          }
        } else {
          input = { ...dateInput, directBazi: baziInput };
        }

        const baziResult = analyzeBazi(input);
        setResult(baziResult);
        setLastCalculatedInput(input);
      } catch (error) {
        console.error('计算失败:', error);
      }
      setIsCalculating(false);
    }, 1500);
  };

  const handleClassicalReport = async () => {
    const params = new URLSearchParams();
    if (name) params.set('name', name);
    params.set('gender', gender);

    if (inputMode === 'date') {
      params.set('mode', 'date');
      
      if (calendarType === 'lunar') {
        // @ts-ignore
        const { Lunar } = await import('lunar-javascript');
        const lunar = Lunar.fromYmd(
          lunarDateInput.year,
          lunarDateInput.month,
          lunarDateInput.day,
          lunarDateInput.isLeapMonth
        );
        const solar = lunar.getSolar();
        
        params.set('year', solar.getYear().toString());
        params.set('month', solar.getMonth().toString());
        params.set('day', solar.getDay().toString());
        params.set('hour', lunarDateInput.hour.toString());
        params.set('minute', lunarDateInput.minute.toString());
        if (lunarDateInput.location.province && lunarDateInput.location.city) {
          params.set('province', lunarDateInput.location.province);
          params.set('city', lunarDateInput.location.city);
          params.set('longitude', lunarDateInput.location.longitude.toString());
        }
      } else {
        params.set('year', dateInput.year.toString());
        params.set('month', dateInput.month.toString());
        params.set('day', dateInput.day.toString());
        params.set('hour', dateInput.hour.toString());
        params.set('minute', dateInput.minute.toString());
        if (dateInput.location.province && dateInput.location.city) {
          params.set('province', dateInput.location.province);
          params.set('city', dateInput.location.city);
          params.set('longitude', dateInput.location.longitude.toString());
        }
      }
    } else {
      params.set('mode', 'bazi');
      params.set('gans', baziInput.gans.join(','));
      params.set('zhis', baziInput.zhis.join(','));
    }

    router.push(`/report/classical?${params.toString()}`);
  };

  const CustomSelect = ({
    label,
    value,
    onChange,
    options,
    field,
    wuxingColor
  }: {
    label: string;
    value: number | string;
    onChange: (value: number | string) => void;
    options: (number | string)[];
    field: string;
    wuxingColor?: string;
  }) => {
    const isOpen = activeSelectId === field;

    return (
      <div className="space-y-2">
        <label className="text-xs font-medium text-[#666666] font-sans uppercase tracking-wider">
          {label}
        </label>
        <div className="relative">
          <div
            onClick={() => setActiveSelectId(isOpen ? null : field)}
            className="w-full bg-[#f8f6f0] border border-[#e8e3d8] rounded-md px-3 py-2 text-[#333333] font-sans cursor-pointer flex justify-between items-center hover:bg-[#f0ede6] transition-colors duration-200 focus:ring-2 focus:ring-stone-400 focus:border-stone-400"
            onFocus={() => setFocusedField(field)}
            onBlur={() => setFocusedField(null)}
          >
            <span style={{ color: wuxingColor || '#333333' }}>{value}</span>
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <svg className="w-4 h-4 text-[#666666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </motion.div>
          </div>

          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 right-0 mt-1 bg-[#fbf9f4] border border-[#e8e3d8] rounded-md shadow-sm z-50 max-h-60 overflow-y-auto"
                data-select-id={field}
                ref={(el) => {
                  if (el) {
                    setTimeout(() => {
                      const selectedItem = el.querySelector(`[data-value="${value}"]`) as HTMLElement;
                      if (selectedItem) {
                        const containerHeight = el.clientHeight;
                        const itemHeight = selectedItem.clientHeight;
                        const itemTop = selectedItem.offsetTop;
                        const scrollTop = itemTop - (containerHeight / 2) + (itemHeight / 2);
                        el.scrollTop = Math.max(0, scrollTop);
                      }
                    }, 10);
                  }
                }}
              >
                {options.map((option) => (
                  <div
                    key={option}
                    data-value={option}
                    onClick={() => {
                      onChange(option);
                      setActiveSelectId(null);
                    }}
                    className={`px-3 py-2 text-[#333333] font-sans hover:bg-[#f0ede6] cursor-pointer transition-colors duration-150 first:rounded-t-md last:rounded-b-md ${
                      option === value ? 'bg-stone-100' : ''
                    }`}
                  >
                    {option}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  const ProgressBar = ({ label, value }: { label: string; value: number }) => (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-[#333333] font-sans">
        <span>{label}</span>
        <span>{value.toFixed(1)}%</span>
      </div>
      <div className="h-px bg-[#e8e3d8]">
        <motion.div
          className="h-full bg-stone-600"
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, delay: 0.5 }}
        />
      </div>
    </div>
  );

  const LocationPicker = () => {
    const [tempProvince, setTempProvince] = useState(selectedProvince);
    const [tempCity, setTempCity] = useState(selectedCity);

    const provinceData: Record<string, string[]> = {
      '北京市': ['北京市'],
      '上海市': ['上海市'],
      '广东省': ['广州市', '深圳市', '珠海市', '汕头市', '韶关市', '佛山市', '江门市', '湛江市', '茂名市', '肇庆市', '惠州市', '梅州市', '汕尾市', '河源市', '阳江市', '清远市', '东莞市', '中山市', '潮州市', '揭阳市', '云浮市'],
      '江苏省': ['南京市', '无锡市', '徐州市', '常州市', '苏州市', '南通市', '连云港市', '淮安市', '盐城市', '扬州市', '镇江市', '泰州市', '宿迁市'],
      '浙江省': ['杭州市', '宁波市', '温州市', '嘉兴市', '湖州市', '绍兴市', '金华市', '衢州市', '舟山市', '台州市', '丽水市'],
      '山东省': ['济南市', '青岛市', '淄博市', '枣庄市', '东营市', '烟台市', '潍坊市', '济宁市', '泰安市', '威海市', '日照市', '临沂市', '德州市', '聊城市', '滨州市', '菏泽市'],
      '河南省': ['郑州市', '开封市', '洛阳市', '平顶山市', '安阳市', '鹤壁市', '新乡市', '焦作市', '濮阳市', '许昌市', '漯河市', '三门峡市', '南阳市', '商丘市', '信阳市', '周口市', '驻马店市', '济源市'],
      '四川省': ['成都市', '自贡市', '攀枝花市', '泸州市', '德阳市', '绵阳市', '广元市', '遂宁市', '内江市', '乐山市', '南充市', '眉山市', '宜宾市', '广安市', '达州市', '雅安市', '巴中市', '资阳市'],
      '湖北省': ['武汉市', '黄石市', '十堰市', '宜昌市', '襄阳市', '鄂州市', '荆门市', '孝感市', '荆州市', '黄冈市', '咸宁市', '随州市'],
      '湖南省': ['长沙市', '株洲市', '湘潭市', '衡阳市', '邵阳市', '岳阳市', '常德市', '张家界市', '益阳市', '郴州市', '永州市', '怀化市', '娄底市'],
      '辽宁省': ['沈阳市', '大连市', '鞍山市', '抚顺市', '本溪市', '丹东市', '锦州市', '营口市', '阜新市', '辽阳市', '盘锦市', '铁岭市', '朝阳市', '葫芦岛市'],
      '陕西省': ['西安市', '铜川市', '宝鸡市', '咸阳市', '渭南市', '延安市', '汉中市', '榆林市', '安康市', '商洛市'],
      '福建省': ['福州市', '厦门市', '莆田市', '三明市', '泉州市', '漳州市', '南平市', '龙岩市', '宁德市'],
      '天津市': ['天津市'],
      '重庆市': ['重庆市'],
      '河北省': ['石家庄市', '唐山市', '秦皇岛市', '邯郸市', '邢台市', '保定市', '张家口市', '承德市', '沧州市', '廊坊市', '衡水市'],
      '山西省': ['太原市', '大同市', '阳泉市', '长治市', '晋城市', '朔州市', '晋中市', '运城市', '忻州市', '临汾市', '吕梁市'],
      '内蒙古自治区': ['呼和浩特市', '包头市', '乌海市', '赤峰市', '通辽市', '鄂尔多斯市', '呼伦贝尔市', '巴彦淖尔市', '乌兰察布市', '兴安盟', '锡林郭勒盟', '阿拉善盟'],
      '吉林省': ['长春市', '吉林市', '四平市', '辽源市', '通化市', '白山市', '松原市', '白城市', '延边朝鲜族自治州'],
      '黑龙江省': ['哈尔滨市', '齐齐哈尔市', '鸡西市', '鹤岗市', '双鸭山市', '大庆市', '伊春市', '佳木斯市', '七台河市', '牡丹江市', '黑河市', '绥化市', '大兴安岭地区'],
      '安徽省': ['合肥市', '芜湖市', '蚌埠市', '淮南市', '马鞍山市', '淮北市', '铜陵市', '安庆市', '黄山市', '滁州市', '阜阳市', '宿州市', '六安市', '亳州市', '池州市', '宣城市'],
      '江西省': ['南昌市', '景德镇市', '萍乡市', '九江市', '新余市', '鹰潭市', '赣州市', '吉安市', '宜春市', '抚州市', '上饶市'],
      '广西壮族自治区': ['南宁市', '柳州市', '桂林市', '梧州市', '北海市', '防城港市', '钦州市', '贵港市', '玉林市', '百色市', '贺州市', '河池市', '来宾市', '崇左市'],
      '海南省': ['海口市', '三亚市', '三沙市', '儋州市', '五指山市', '琼海市', '文昌市', '万宁市', '东方市', '定安县', '屯昌县', '澄迈县', '临高县', '白沙黎族自治县', '昌江黎族自治县', '乐东黎族自治县', '陵水黎族自治县', '保亭黎族苗族自治县', '琼中黎族苗族自治县'],
      '贵州省': ['贵阳市', '六盘水市', '遵义市', '安顺市', '铜仁市', '黔西南布依族苗族自治州', '毕节市', '黔东南苗族侗族自治州', '黔南布依族苗族自治州'],
      '云南省': ['昆明市', '曲靖市', '玉溪市', '保山市', '昭通市', '丽江市', '普洱市', '临沧市', '楚雄彝族自治州', '红河哈尼族彝族自治州', '文山壮族苗族自治州', '西双版纳傣族自治州', '大理白族自治州', '德宏傣族景颇族自治州', '怒江傈僳族自治州', '迪庆藏族自治州'],
      '西藏自治区': ['拉萨市', '日喀则市', '昌都市', '林芝市', '山南市', '那曲市', '阿里地区'],
      '甘肃省': ['兰州市', '嘉峪关市', '金昌市', '白银市', '天水市', '武威市', '张掖市', '平凉市', '酒泉市', '庆阳市', '定西市', '陇南市', '临夏回族自治州', '甘南藏族自治州'],
      '青海省': ['西宁市', '海东市', '海北藏族自治州', '黄南藏族自治州', '海南藏族自治州', '果洛藏族自治州', '玉树藏族自治州', '海西蒙古族藏族自治州'],
      '宁夏回族自治区': ['银川市', '石嘴山市', '吴忠市', '固原市', '中卫市'],
      '新疆维吾尔自治区': ['乌鲁木齐市', '克拉玛依市', '吐鲁番市', '哈密市', '昌吉回族自治州', '博尔塔拉蒙古自治州', '巴音郭楞蒙古自治州', '阿克苏地区', '克孜勒苏柯尔克孜自治州', '喀什地区', '和田地区', '伊犁哈萨克自治州', '塔城地区', '阿勒泰地区'],
      '香港特别行政区': ['香港特别行政区'],
      '澳门特别行政区': ['澳门特别行政区'],
      '台湾省': ['台北市', '新北市', '桃园市', '台中市', '台南市', '高雄市', '基隆市', '新竹市', '嘉义市', '新竹县', '苗栗县', '彰化县', '南投县', '云林县', '嘉义县', '屏东县', '宜兰县', '花莲县', '台东县', '澎湖县', '金门县', '连江县'],
    };

    const provinces = Object.keys(provinceData);
    const cities = tempProvince ? provinceData[tempProvince] || [] : [];

    return (
      <AnimatePresence>
        {showLocationPicker && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/20 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLocationPicker(false)}
            />
            <motion.div
              className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#fbf9f4] border border-[#e8e3d8] rounded-lg shadow-lg z-50 max-w-md w-full mx-4"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="p-6">
                <h3 className="text-lg font-serif text-[#333333] mb-4">选择出生地点</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-[#666666] font-sans mb-2 block">省份</label>
                    <select
                      value={tempProvince}
                      onChange={(e) => {
                        setTempProvince(e.target.value);
                        setTempCity('');
                      }}
                      className="w-full bg-[#f8f6f0] border border-[#e8e3d8] rounded-md px-3 py-2 text-[#333333] font-sans focus:outline-none focus:ring-0"
                    >
                      {provinces.map(province => (
                        <option key={province} value={province}>
                          {province}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-[#666666] font-sans mb-2 block">城市</label>
                    <select
                      value={tempCity}
                      onChange={(e) => setTempCity(e.target.value)}
                      disabled={!tempProvince}
                      className="w-full bg-[#f8f6f0] border border-[#e8e3d8] rounded-md px-3 py-2 text-[#333333] font-sans focus:outline-none focus:ring-0 disabled:bg-[#f0f0f0] disabled:cursor-not-allowed"
                    >
                      <option value="">请选择城市</option>
                      {cities.map(city => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowLocationPicker(false)}
                    className="flex-1 py-2 px-4 text-[#666666] font-sans border border-[#e8e3d8] rounded-md hover:bg-[#f0ede6] transition-colors duration-200"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => handleLocationSelect(tempProvince, tempCity)}
                    disabled={!tempCity}
                    className="flex-1 py-2 px-4 text-stone-600 font-sans bg-stone-50 border border-stone-300 rounded-md hover:bg-stone-100 transition-colors duration-200 disabled:bg-[#e8e3d8] disabled:text-[#999] disabled:cursor-not-allowed"
                  >
                    确定
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  };

  const ModeTabs = () => (
    <div className="w-full bg-[#f8f6f0] rounded-xl p-1.5 mb-10 shadow-sm border border-[#e8e3d8]">
      <div className="grid grid-cols-2 gap-1.5">
        <motion.button
          onClick={() => setInputMode('date')}
          className={`relative px-6 py-3 text-sm font-medium font-serif rounded-lg transition-all duration-300 ${
            inputMode === 'date'
              ? 'bg-[#fbf9f4] text-stone-800 shadow-sm'
              : 'text-stone-500 hover:text-stone-700 hover:bg-[#f0ede6]/50'
          }`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          日期排盘
        </motion.button>
        <motion.button
          onClick={() => setInputMode('bazi')}
          className={`relative px-6 py-3 text-sm font-medium font-serif rounded-lg transition-all duration-300 ${
            inputMode === 'bazi'
              ? 'bg-[#fbf9f4] text-stone-800 shadow-sm'
              : 'text-stone-500 hover:text-stone-700 hover:bg-[#f0ede6]/50'
          }`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          八字排盘
        </motion.button>
      </div>
    </div>
  );

  return (
    <div className="space-y-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="space-y-8"
      >
        <ModeTabs />

        <div className="max-w-[460px] mx-auto space-y-6 mb-10">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-medium text-[#666666] font-sans uppercase tracking-wider">
                姓名
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="请输入姓名"
                className="w-full bg-[#f8f6f0] border border-[#e8e3d8] rounded-md px-3 py-2 text-[#333333] font-sans placeholder:text-[#999] focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-stone-400 transition-all duration-200"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-[#666666] font-sans uppercase tracking-wider">
                性别
              </label>
              <div className="relative">
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as '乾造' | '坤造')}
                  className="w-full bg-[#f8f6f0] border border-[#e8e3d8] rounded-md px-3 py-2 text-[#333333] font-sans cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-stone-400 transition-all duration-200"
                >
                  <option value="乾造">乾造（男）</option>
                  <option value="坤造">坤造（女）</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2.5 4.5L6 8L9.5 4.5" stroke="#666666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-[400px]">
          <div className="max-w-[460px] mx-auto">
            <AnimatePresence mode="wait">
              {inputMode === 'date' ? (
                <motion.div
                  key="date-mode"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-8"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#666666] font-sans text-sm">
                      <Calendar className="w-4 h-4" />
                      <span>出生时间</span>
                    </div>
                    
                    <div className="flex gap-2 bg-stone-100/50 rounded-lg p-1">
                      <button
                        onClick={() => setCalendarType('solar')}
                        className={`px-3 py-1 text-xs font-sans rounded-md transition-all duration-200 ${
                          calendarType === 'solar'
                            ? 'bg-white text-stone-800 shadow-sm'
                            : 'text-stone-500 hover:text-stone-700'
                        }`}
                      >
                        公历
                      </button>
                      <button
                        onClick={() => setCalendarType('lunar')}
                        className={`px-3 py-1 text-xs font-sans rounded-md transition-all duration-200 ${
                          calendarType === 'lunar'
                            ? 'bg-white text-stone-800 shadow-sm'
                            : 'text-stone-500 hover:text-stone-700'
                        }`}
                      >
                        农历
                      </button>
                    </div>
                  </div>

                  {calendarType === 'solar' && (
                    <div className="grid grid-cols-2 gap-6">
                      <CustomSelect
                        label="年"
                        value={dateInput.year}
                        onChange={(year) => setDateInput({ ...dateInput, year: year as number })}
                        options={yearOptions}
                        field="year"
                      />
                      <CustomSelect
                        label="月"
                        value={dateInput.month}
                        onChange={(month) => setDateInput({ ...dateInput, month: month as number })}
                        options={monthOptions}
                        field="month"
                      />
                      <CustomSelect
                        label="日"
                        value={dateInput.day}
                        onChange={(day) => setDateInput({ ...dateInput, day: day as number })}
                        options={generateDateOptions()}
                        field="day"
                      />
                      <CustomSelect
                        label="时"
                        value={dateInput.hour}
                        onChange={(hour) => setDateInput({ ...dateInput, hour: hour as number })}
                        options={hourOptions}
                        field="hour"
                      />
                      <CustomSelect
                        label="分"
                        value={dateInput.minute}
                        onChange={(minute) => setDateInput({ ...dateInput, minute: minute as number })}
                        options={Array.from({ length: 60 }, (_, i) => i)}
                        field="minute"
                      />
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-[#666666] font-sans uppercase tracking-wider">
                          出生地
                        </label>
                        <div
                          onClick={() => setShowLocationPicker(true)}
                          className="w-full bg-[#f8f6f0] border border-[#e8e3d8] rounded-md px-3 py-2 text-[#333333] font-sans cursor-pointer flex justify-between items-center hover:bg-[#f0ede6] transition-colors duration-200 focus:ring-2 focus:ring-stone-400 focus:border-stone-400"
                        >
                          <span>
                            {selectedProvince && selectedCity
                              ? `${selectedProvince} ${selectedCity}`
                              : '请选择地点 >'
                            }
                          </span>
                          <motion.div
                            animate={{ rotate: showLocationPicker ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <svg className="w-4 h-4 text-[#666666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </motion.div>
                        </div>
                      </div>
                    </div>
                  )}

                  {calendarType === 'lunar' && (
                    <div className="grid grid-cols-2 gap-6">
                      <CustomSelect
                        label="年"
                        value={lunarDateInput.year}
                        onChange={(year) => setLunarDateInput({ ...lunarDateInput, year: year as number })}
                        options={yearOptions}
                        field="lunar-year"
                      />
                      <CustomSelect
                        label="月"
                        value={lunarDateInput.month}
                        onChange={(month) => setLunarDateInput({ ...lunarDateInput, month: month as number })}
                        options={monthOptions}
                        field="lunar-month"
                      />
                      <CustomSelect
                        label="日"
                        value={lunarDateInput.day}
                        onChange={(day) => setLunarDateInput({ ...lunarDateInput, day: day as number })}
                        options={Array.from({ length: 30 }, (_, i) => i + 1)}
                        field="lunar-day"
                      />
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-[#666666] font-sans uppercase tracking-wider">
                          闰月
                        </label>
                        <div className="relative">
                          <select
                            value={lunarDateInput.isLeapMonth ? 'true' : 'false'}
                            onChange={(e) => setLunarDateInput({ ...lunarDateInput, isLeapMonth: e.target.value === 'true' })}
                            className="w-full bg-[#f8f6f0] border border-[#e8e3d8] rounded-md px-3 py-2 text-[#333333] font-sans cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-stone-400 transition-all duration-200"
                          >
                            <option value="false">平月</option>
                            <option value="true">闰月</option>
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M2.5 4.5L6 8L9.5 4.5" stroke="#666666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                        </div>
                      </div>
                      <CustomSelect
                        label="时"
                        value={lunarDateInput.hour}
                        onChange={(hour) => setLunarDateInput({ ...lunarDateInput, hour: hour as number })}
                        options={hourOptions}
                        field="lunar-hour"
                      />
                      <CustomSelect
                        label="分"
                        value={lunarDateInput.minute}
                        onChange={(minute) => setLunarDateInput({ ...lunarDateInput, minute: minute as number })}
                        options={Array.from({ length: 60 }, (_, i) => i)}
                        field="lunar-minute"
                      />
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-[#666666] font-sans uppercase tracking-wider">
                          出生地
                        </label>
                        <div
                          onClick={() => setShowLocationPicker(true)}
                          className="w-full bg-[#f8f6f0] border border-[#e8e3d8] rounded-md px-3 py-2 text-[#333333] font-sans cursor-pointer flex justify-between items-center hover:bg-[#f0ede6] transition-colors duration-200 focus:ring-2 focus:ring-stone-400 focus:border-stone-400"
                        >
                          <span>
                            {selectedProvince && selectedCity
                              ? `${selectedProvince} ${selectedCity}`
                              : '请选择地点 >'
                            }
                          </span>
                          <motion.div
                            animate={{ rotate: showLocationPicker ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <svg className="w-4 h-4 text-[#666666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </motion.div>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="bazi-mode"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-8"
                >
                  <div className="max-w-[500px] mx-auto space-y-8">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 text-[#666666] font-sans text-sm mb-2">
                        <Sparkles className="w-4 h-4" />
                        <span>八字信息</span>
                      </div>
                    </div>

                    <div className="my-6">
                      <input
                        type="text"
                        value={quickInputText}
                        onChange={(e) => {
                          setQuickInputText(e.target.value);
                          parseQuickInput(e.target.value);
                        }}
                        placeholder="支持快捷粘贴，例如：辛巳 丁丑 丁巳 癸巳"
                        className="w-full text-center text-lg text-stone-600 font-serif border-b border-stone-200 bg-transparent focus:border-stone-400 focus:outline-none placeholder:text-stone-300"
                      />
                      <div className="text-xs text-stone-400 font-serif text-center mt-2">
                        输入天干地支组合，系统将自动解析并填充下方四柱
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 mt-8">
                      {['年柱', '月柱', '日柱', '时柱'].map((label, idx) => (
                        <div key={idx} className="flex flex-col items-center space-y-3">
                          <div className="text-xs text-stone-400 font-serif text-center mb-2">{label}</div>
                          <div className="flex flex-col space-y-2">
                            <CustomSelect
                              label=""
                              value={baziInput.gans[idx]}
                              onChange={(gan) => {
                                const newGan = gan as string;
                                const newZhi = baziInput.zhis[idx];
                                const isYangGan = yinYangMap.gans.yang.includes(newGan);
                                const isYangZhi = yinYangMap.zhis.yang.includes(newZhi);
                                const resetZhi = isYangGan !== isYangZhi ? '' : newZhi;

                                const newGans = [...baziInput.gans];
                                const newZhis = [...baziInput.zhis];
                                newGans[idx] = newGan;
                                newZhis[idx] = resetZhi;

                                setBaziInput({
                                  gans: newGans,
                                  zhis: newZhis
                                });
                              }}
                              options={['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']}
                              field={`${label}-gan`}
                              wuxingColor={getWuxingColor(baziInput.gans[idx])}
                            />
                            <CustomSelect
                              label=""
                              value={baziInput.zhis[idx]}
                              onChange={(zhi) => {
                                const newZhis = [...baziInput.zhis];
                                newZhis[idx] = zhi as string;
                                setBaziInput({
                                  ...baziInput,
                                  zhis: newZhis
                                });
                              }}
                              options={getZhiOptions(baziInput.gans[idx])}
                              field={`${label}-zhi`}
                              wuxingColor={getWuxingColor(baziInput.zhis[idx])}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {inputMode === 'date' && dateInput.location && dateInput.location.longitude !== 116.4 && (
              <div className="text-center mb-4">
                <p className="text-xs text-[#666666] font-sans">
                  已自动校正真太阳时
                </p>
              </div>
            )}

            <div className="mt-16 pt-4 space-y-4">
              <motion.button
                onClick={handleClassicalReport}
                className="w-full py-3 px-6 bg-transparent text-stone-600 font-sans text-sm border border-stone-400 rounded-lg hover:bg-stone-50 active:bg-stone-100 transition-colors duration-300 shadow-sm"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                古典排盘
              </motion.button>

              <motion.button
                onClick={handleCalculate}
                disabled={isCalculating}
                className="w-full py-4 px-6 bg-stone-800 text-white font-sans text-sm rounded-lg hover:bg-stone-700 active:bg-stone-900 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isCalculating ? '推算中...' : '测算 MBTI'}
              </motion.button>
              
              <p className="text-xs text-stone-500 text-center mt-2">
                测算MBTI功能仍在开发中，目前准确率相当有限，不代表最终效果
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-12"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="text-center space-y-4"
            >
              <div className="text-xs text-[#666] font-sans uppercase tracking-wider">
                性格类型
              </div>
              <motion.div
                className="text-6xl font-serif text-[#2c2c2c]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 1.2 }}
              >
                {result.mbti}
              </motion.div>
              <div className="text-xs text-[#666] font-sans">
                {result.dominantFunction} · {result.auxiliaryFunction} · {result.inferiorFunction}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.4 }}
              className="space-y-4"
            >
              <div className="text-center space-y-2">
                <div className="text-xs text-[#666666] font-sans uppercase tracking-wider">
                  命局格局
                </div>
                <div className="text-lg font-serif text-[#333333]">
                  {result.pattern}
                </div>
                <div className="text-xs text-[#666666] font-sans">
                  {result.strength} · 能量占比 {result.peerEnergyPercent.toFixed(1)}%
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.6 }}
              className="space-y-6"
            >
              <div className="text-xs text-[#666666] font-sans uppercase tracking-wider text-center">
                五行能量分布
              </div>
              <div className="space-y-3">
                {Object.entries(result.energyDistribution)
                  .sort(([, a], [, b]) => b - a)
                  .map(([key, value]) => (
                    <ProgressBar key={key} label={key} value={value} />
                  ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.8 }}
              className="space-y-4"
            >
              <div className="text-xs text-[#666666] font-sans uppercase tracking-wider text-center">
                关键洞见
              </div>
              <div className="space-y-3 text-sm text-[#333333] font-sans leading-relaxed">
                <div className="flex justify-between">
                  <span className="text-[#666666]">调候用神</span>
                  <span>{result.climateGod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#666666]">最终真神</span>
                  <span>{result.trueGod}</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 2.0 }}
              className="space-y-4"
            >
              <div className="text-xs text-[#666666] font-sans uppercase tracking-wider text-center">
                十神能量分布
              </div>
              <div className="space-y-2 text-sm text-[#333333] font-sans">
                {(() => {
                  const shishenPct =
                    classicalProfile != null
                      ? classicalProfile.percentages.shishenDetailed
                      : result.ssDistribution;
                  return Object.entries(shishenPct ?? {})
                    .filter(([, v]) => (v as number) > 0)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span>{key}</span>
                        <span>{(value as number).toFixed(1)}%</span>
                      </div>
                    ));
                })()}
              </div>
            </motion.div>

            {classicalProfile && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 2.2 }}
                className="space-y-4"
              >
                <div className="text-xs text-[#666666] font-sans uppercase tracking-wider text-center">
                  十天干能量分布
                </div>
                <div className="space-y-2 text-sm text-[#333333] font-sans">
                  {Object.entries(classicalProfile.percentages.ganDetailed)
                    .filter(([, v]) => v > 0)
                    .sort(([, a], [, b]) => b - a)
                    .map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span>{key}</span>
                        <span>{value.toFixed(1)}%</span>
                      </div>
                    ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <LocationPicker />

      <p className="text-center text-xs text-stone-400 font-sans py-6">
        注：本网站仅提供排盘服务，请勿将本网站用于封建迷信活动。
      </p>
    </div>
  );
};
