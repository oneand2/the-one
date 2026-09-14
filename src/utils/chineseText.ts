import OpenCC from 'opencc-js/t2cn';

const traditionalToSimplified = OpenCC.Converter({ from: 't', to: 'cn' });

/** 仅转换中文经典原文，避免改动日语汉字及其他外语内容。 */
export const simplifyClassicalChinese = (language: string, text: string) =>
  language === '文言' ? traditionalToSimplified(text) : text;
