/**
 * 每日一卦：六十四卦 Slogan 与文学性译文
 * 来源：根目录「每日一卦_64卦slogan与文学译文.md」
 */

interface DailyHexagramCopyEntry {
  index: number;
  name: string;
  slogan: string;
  translation: string;
}

export interface DailyHexagramEntry extends DailyHexagramCopyEntry {
  /** 6位二进制字符串，从上爻到初爻；1=阳爻，0=阴爻 */
  code: string;
}

export const DAILY_HEXAGRAM_ENTRIES: DailyHexagramCopyEntry[] = [
  {
    "index": 1,
    "name": "乾卦",
    "slogan": "天行健，君子以自强不息。",
    "translation": "天行不息，路也不会在等待中出现。与其反复权衡，不如先走一步；人在行动中，才会慢慢长出自己的方向。"
  },
  {
    "index": 2,
    "name": "坤卦",
    "slogan": "地势坤，君子以厚德载物。",
    "translation": "大地不争，却容万物各自生长。柔和并非退让，宽厚也自有边界；放下不必要的对抗，给人也给自己多一些余地。"
  },
  {
    "index": 3,
    "name": "屯卦",
    "slogan": "云雷屯，君子以经纶。",
    "translation": "云雷初动，万事方生，混乱本就是开端的一部分。看不清全貌时，先理顺眼前的一小处；路会随着行动渐渐显出来。"
  },
  {
    "index": 4,
    "name": "蒙卦",
    "slogan": "山下出泉，君子以果行育德。",
    "translation": "山下泉水初出，细小却一直向前。不懂并不可耻，困在原地才可惜；多走一走，多问一问，见识会在来往中渐渐清明。"
  },
  {
    "index": 5,
    "name": "需卦",
    "slogan": "云上于天，君子以饮食宴乐。",
    "translation": "云已满天，雨仍有时。很多答案急不来，越催越容易乱了心绪；把日子过稳，把力气养足，时候到了，自然会落下。"
  },
  {
    "index": 6,
    "name": "讼卦",
    "slogan": "君子以作事谋始。",
    "translation": "争端常从一句没说清、一道界限没划明开始。与其争到最后，不如回头看看最初的约定；源头清楚了，许多纠缠也就散了。"
  },
  {
    "index": 7,
    "name": "师卦",
    "slogan": "君子以容民畜众。",
    "translation": "做事不能只靠一个人的冲劲。方向要清楚，也要让同行的人知道为何出发；人心有所归，分散的力量才会慢慢聚拢。"
  },
  {
    "index": 8,
    "name": "比卦",
    "slogan": "先王以建万国，亲诸侯。",
    "translation": "水在地上相亲，人也因真诚而靠近。好的关系不必时时捆在一起，而是各自站稳之后，仍愿意为彼此留一处支撑。"
  },
  {
    "index": 9,
    "name": "小畜卦",
    "slogan": "君子以懿文德。",
    "translation": "风行天上，云聚而雨未落。力量还小时，不必急着做成大事；把细小的进展一一收好，日久自会有可用之势。"
  },
  {
    "index": 10,
    "name": "履卦",
    "slogan": "君子以辨上下，定民志。",
    "translation": "有些路靠近险处，却并非不能走。知道哪里该停、哪里可进，脚下便会安稳许多；分寸不是拘束，是让人平安走远的尺度。"
  },
  {
    "index": 11,
    "name": "泰卦",
    "slogan": "天地交，泰；后以辅相天地之宜。",
    "translation": "天地相交，万物于是舒展。顺遂并非毫无阻力，而是人与事都回到合适的位置；少一点拧巴，许多力量便会自然流动。"
  },
  {
    "index": 12,
    "name": "否卦",
    "slogan": "君子以俭德辟难，不可荣以禄。",
    "translation": "天地不交，门像是关着的。此时用力越多，消耗也越多；不妨收一收锋芒，守好自己，等风向改变再走。"
  },
  {
    "index": 13,
    "name": "同人卦",
    "slogan": "君子以类族辨物。",
    "translation": "同路的人，不必处处相同。重要之处彼此认同，细微之处各有性情；能一起看向远方，也能容得下不同，同行才不会太累。"
  },
  {
    "index": 14,
    "name": "大有卦",
    "slogan": "君子以遏恶扬善，顺天休命。",
    "translation": "火在天上，所拥有的一切都被照亮。丰盛之时更要分清什么值得留下、什么不该纵容；手中有余，也别忘了照顾身边的微光。"
  },
  {
    "index": 15,
    "name": "谦卦",
    "slogan": "君子以裒多益寡，称物平施。",
    "translation": "山藏在地下，高而不显，仍不失其高。知道自己的分量，却不必处处证明；把姿态放低一些，路反而会宽一些。"
  },
  {
    "index": 16,
    "name": "豫卦",
    "slogan": "先王以作乐崇德。",
    "translation": "雷出地上，万物随之振动，喜悦也有唤醒人的力量。可以尽情高兴，却别只停在想象里；让心里的热，照到脚下的路。"
  },
  {
    "index": 17,
    "name": "随卦",
    "slogan": "君子以向晦入宴息。",
    "translation": "白日有尽，雷声也会藏入泽中。顺势不是随波逐流，而是知道何时前进、何时休息；节奏对了，路便不必走得太费力。"
  },
  {
    "index": 18,
    "name": "蛊卦",
    "slogan": "君子以振民育德。",
    "translation": "山下有风，久不流动的地方容易积下尘垢。旧问题不必再遮掩，从根上清理，慢慢修补；肯动手整理，腐处也能重新生长。"
  },
  {
    "index": 19,
    "name": "临卦",
    "slogan": "君子以教思无穷，容保民无疆。",
    "translation": "大地临近泽水，靠近了，才看得见真实的需要。少一点居高临下，多一点耐心倾听；愿意俯身的人，反而更容易被人信任。"
  },
  {
    "index": 20,
    "name": "观卦",
    "slogan": "先王以省方观民设教。",
    "translation": "风行地上，所过之处皆可观看。别急着给人和事下结论，先看看那些反复出现的细节；安静一会儿，答案会从表象后面浮出来。"
  },
  {
    "index": 21,
    "name": "噬嗑卦",
    "slogan": "先王以明罚敕法。",
    "translation": "有些阻碍，绕得越久，缠得越紧。该说清的说清，该处理的处理；果断不必带着怒气，只需让混乱重新有一条边界。"
  },
  {
    "index": 22,
    "name": "贲卦",
    "slogan": "君子以明庶政，无敢折狱。",
    "translation": "山下有火，近处明亮，远处仍藏在暗里。好看的形式可以悦目，却代替不了内里的真实；欣赏光彩，也别忘了多看一层。"
  },
  {
    "index": 23,
    "name": "剥卦",
    "slogan": "上以厚下安宅。",
    "translation": "山附于地，外层一寸寸剥落。留不住的，不必再勉强维持；先护住根基，让多余之物退去，空下来的地方自会有新生。"
  },
  {
    "index": 24,
    "name": "复卦",
    "slogan": "反复其道，七日来复。",
    "translation": "一阳从最深的静处回来，微弱，却已是转机。走偏了可以回头，走远了也可以归来；愿意重新迈出一步，路就没有断。"
  },
  {
    "index": 25,
    "name": "无妄卦",
    "slogan": "先王以茂对时，育万物。",
    "translation": "雷行天下，万物依时而生，并不多作猜想。少一些试探和算计，照真实的心意去回应；结果未必尽在掌握，心却可以不走偏。"
  },
  {
    "index": 26,
    "name": "大畜卦",
    "slogan": "君子以多识前言往行，以畜其德。",
    "translation": "天藏山中，越大的力量，越懂得先收住。多看、多学，也把走过的路沉淀成见识；不急着显露，反而更能承接远方。"
  },
  {
    "index": 27,
    "name": "颐卦",
    "slogan": "君子以慎言语，节饮食。",
    "translation": "入口之物养身，出口之言养心。吃什么、听什么、说什么，日久都在塑造一个人；留意这些寻常小事，便是在照顾生命的根。"
  },
  {
    "index": 28,
    "name": "大过卦",
    "slogan": "君子以独立不惧，遁世无闷。",
    "translation": "泽水漫过树梢，承受已超过平常。非常之时，要敢于独立，也要舍得减轻负担；站稳自己的心，别让担当变成硬撑。"
  },
  {
    "index": 29,
    "name": "坎卦",
    "slogan": "君子以常德行，习教事。",
    "translation": "水流过一重又一重险处，仍没有失去方向。反复遇到难处时，侥幸靠不住，习惯与定力才靠得住；先稳住，再渡过去。"
  },
  {
    "index": 30,
    "name": "离卦",
    "slogan": "大人以继明照于四方。",
    "translation": "明火相继，照见四方，也照见自己。模糊之处不妨再看清一点，心里亮了，选择便少了许多迟疑；有余光时，也照一照身边的人。"
  },
  {
    "index": 31,
    "name": "咸卦",
    "slogan": "君子以虚受人。",
    "translation": "山与泽相感，许多回应都发生在无声之处。心里留一点空，才听得见外面的回音；不急着表达，也是一种真诚。"
  },
  {
    "index": 32,
    "name": "恒卦",
    "slogan": "君子以立不易方。",
    "translation": "雷与风相随，变化不止，方向却可以不变。值得长守的东西，很少靠一时热情；日日做一点，时间会替坚持作答。"
  },
  {
    "index": 33,
    "name": "遁卦",
    "slogan": "君子以远小人，不恶而严。",
    "translation": "天下有山，走近不得，便留一段距离。退后并非软弱，只是不再把力气耗在无谓之处；不必争尽输赢，安静离开也有分量。"
  },
  {
    "index": 34,
    "name": "大壮卦",
    "slogan": "君子以非礼弗履。",
    "translation": "雷在天上，声势虽壮，也不能无边无际。力量在手，更要知道哪里该停；能做的很多，值得做的却需要慢慢分辨。"
  },
  {
    "index": 35,
    "name": "晋卦",
    "slogan": "君子以自昭明德。",
    "translation": "火从地上升起，光明一寸寸铺开。别等别人来照亮自己，先把心里的尘埃擦去；内在明亮了，脚下的路也会渐渐开阔。"
  },
  {
    "index": 36,
    "name": "明夷卦",
    "slogan": "君子以莅众，用晦而明。",
    "translation": "光入地中，明亮暂时藏了起来。收敛锋芒并不等于熄灭自己；外面越暗，越要护住心里那一点清明，等天色转亮。"
  },
  {
    "index": 37,
    "name": "家人卦",
    "slogan": "君子以言有物，而行有恒。",
    "translation": "风从火中生起，家的气息也从日常小事里传开。话要有内容，承诺要经得起重复；亲近之人的信任，是一天一天过出来的。"
  },
  {
    "index": 38,
    "name": "睽卦",
    "slogan": "君子以同而异。",
    "translation": "火向上，泽向下，各自有各自的方向。不同不必急着变成对立；能同行的地方一起走，无法相同之处也不必勉强。"
  },
  {
    "index": 39,
    "name": "蹇卦",
    "slogan": "君子以反身修德。",
    "translation": "山前有水，路显得格外难走。向外找不到出口时，不妨回身看看自己的脚步；换一种走法，也许比继续硬闯更接近通途。"
  },
  {
    "index": 40,
    "name": "解卦",
    "slogan": "君子以赦过宥罪。",
    "translation": "雷雨过后，天地松开，草木也舒展开来。该解的结就解开，该放的人也包括自己；总把旧错握在手里，便腾不出手迎接新日子。"
  },
  {
    "index": 41,
    "name": "损卦",
    "slogan": "君子以惩忿窒欲。",
    "translation": "山下有泽，水少了，山反而更显分明。减少未必是失去，舍去无效的消耗，才看得见什么最要紧；生活有时也需要留白。"
  },
  {
    "index": 42,
    "name": "益卦",
    "slogan": "君子以见善则迁，有过则改。",
    "translation": "风雷相助，草木因而生长。增益不只在得到更多，也在愿意修正自己；见到好的便靠近一点，发现不妥便改早一点。"
  },
  {
    "index": 43,
    "name": "夬卦",
    "slogan": "君子以施禄及下。",
    "translation": "泽水升到天上，满了便要有所决断。该说清的话不再含混，该放下的也不再拖延；坚定可以不带锋芒，却要有一个清楚的落点。"
  },
  {
    "index": 44,
    "name": "姤卦",
    "slogan": "后以施命诰四方。",
    "translation": "天下有风，相遇常来得突然。越是强烈的吸引，越值得慢一点靠近；不急着拒绝，也不急着交付，先看清风从哪里来。"
  },
  {
    "index": 45,
    "name": "萃卦",
    "slogan": "君子以除戎器，戒不虞。",
    "translation": "泽水汇聚，人声渐盛，热闹里也容易藏着疏忽。相聚时留一分清醒，备好规则，也备好应变；众心同向，才不会众声相扰。"
  },
  {
    "index": 46,
    "name": "升卦",
    "slogan": "君子以顺德，积小以高大。",
    "translation": "地中生木，不见喧响，却在一寸寸向上。缓慢不等于停滞，把细小的事长久做好；回头再看时，已走到比想象更高的地方。"
  },
  {
    "index": 47,
    "name": "困卦",
    "slogan": "君子以致命遂志。",
    "translation": "泽中无水，困意由此而生。外面没有路时，先别把心也困住；许多依靠暂时失去之后，才会看清什么始终不能放下。"
  },
  {
    "index": 48,
    "name": "井卦",
    "slogan": "君子以劳民劝相。",
    "translation": "井水不因人来人往而增减，只等合适的器具来取。所需未必都在远方，也许一直藏在熟悉之处；换一种方法，再低头看一看。"
  },
  {
    "index": 49,
    "name": "革卦",
    "slogan": "君子以治历明时。",
    "translation": "泽中有火，旧的形态已容不下新的需要。改变不必只凭一时冲动，先看准时机，也想好新的安放；破开之后，总要有地方可去。"
  },
  {
    "index": 50,
    "name": "鼎卦",
    "slogan": "君子以正位凝命。",
    "translation": "木上有火，生涩之物在鼎中慢慢成熟。走过的路不会白费，只要肯把零散的经验重新熬炼；火候到了，自会成为新的养分。"
  },
  {
    "index": 51,
    "name": "震卦",
    "slogan": "君子以恐惧修省。",
    "translation": "雷声骤起，人会惊，也会醒。先稳住心神，不必被第一阵慌乱带走；等回声稍远，再看看生活在提醒什么。"
  },
  {
    "index": 52,
    "name": "艮卦",
    "slogan": "君子以思不出其位。",
    "translation": "两山并立，行到山前便该停一停。停下不是退缩，而是不再替尚未发生的事耗尽心力；身静下来，心才知道该往哪里去。"
  },
  {
    "index": 53,
    "name": "渐卦",
    "slogan": "君子以居贤德善俗。",
    "translation": "树木沿着山势缓缓生长，不越次序，也不争朝夕。急着抵达，常会错过扎根的过程；慢一点，让该长成的自己长成。"
  },
  {
    "index": 54,
    "name": "归妹卦",
    "slogan": "君子以永终知敝。",
    "translation": "相逢容易，走到最后却需要更长的眼光。越想立刻有所归属，越要看看彼此的位置是否合宜；别只为一个开始，忽略了往后的路。"
  },
  {
    "index": 55,
    "name": "丰卦",
    "slogan": "君子以折狱致刑。",
    "translation": "雷电皆至，天地一时明亮而丰盛。高处的风景值得珍惜，光下的隐患也别忽略；花开得最盛时，也要记得照料根部。"
  },
  {
    "index": 56,
    "name": "旅卦",
    "slogan": "君子以明慎用刑，而不留狱。",
    "translation": "火在山上，明亮却停留不久。旅途中不必急着把每一处都当成归宿；轻装前行，处理好眼前的小事，也别忘了为何出发。"
  },
  {
    "index": 57,
    "name": "巽卦",
    "slogan": "君子以申命行事。",
    "translation": "风随风而入，看似轻柔，却能到达每一处缝隙。许多改变不必硬推，话说清楚，事慢慢做；温和若有方向，也能走得很深。"
  },
  {
    "index": 58,
    "name": "兑卦",
    "slogan": "君子以朋友讲习。",
    "translation": "两泽相连，彼此滋润，喜悦也在分享中增长。找一个能说真话的人聊聊，既听安慰，也听不同；好谈话会让心变轻，眼睛变亮。"
  },
  {
    "index": 59,
    "name": "涣卦",
    "slogan": "先王以享于帝，立庙。",
    "translation": "风行水上，吹散凝滞，也让水重新流动。抓得太紧时，不妨先松一松；旧结散开之后，留下的才是彼此真正珍惜的部分。"
  },
  {
    "index": 60,
    "name": "节卦",
    "slogan": "君子以制数度，议德行。",
    "translation": "水在泽中，满了便会溢出。时间、欲望和关系都需要一点尺度；边界不是拒绝，而是让珍贵之物不至于过早耗尽。"
  },
  {
    "index": 61,
    "name": "中孚卦",
    "slogan": "君子以议狱缓死。",
    "translation": "风过泽面，水波会回应，真心也自有回声。不必费力说服所有人，先让言语与内心彼此相合；可信，往往比会说更有力量。"
  },
  {
    "index": 62,
    "name": "小过卦",
    "slogan": "君子以行过乎恭，丧过乎哀，用过乎俭。",
    "translation": "山上有雷，声势虽大，脚下仍要走小步。大处不宜冒进时，就把细节照顾好；多一点谨慎，常能少一点后来难补的遗憾。"
  },
  {
    "index": 63,
    "name": "既济卦",
    "slogan": "君子以思患而预防之。",
    "translation": "水在火上，各得其位，事情看似已经完成。越到安稳处，越别急着松手；回头补一补遗漏，所得才不容易从指间滑走。"
  },
  {
    "index": 64,
    "name": "未济卦",
    "slogan": "君子以慎辨物居方。",
    "translation": "火在水上，彼此尚未相济，路还差最后一程。未完成不等于失败，也意味着仍可调整；越接近终点，越不要让急切打乱次序。"
  }
];

const DAILY_HEXAGRAM_CODES = [
  '111111',
  '000000',
  '010001',
  '100010',
  '010111',
  '111010',
  '000010',
  '010000',
  '110111',
  '111011',
  '000111',
  '111000',
  '111101',
  '101111',
  '000100',
  '001000',
  '011001',
  '100110',
  '000011',
  '110000',
  '101001',
  '100101',
  '100000',
  '000001',
  '111001',
  '100111',
  '100001',
  '011110',
  '010010',
  '101101',
  '011100',
  '001110',
  '111100',
  '001111',
  '101000',
  '000101',
  '110101',
  '101011',
  '010100',
  '001010',
  '100011',
  '110001',
  '011111',
  '111110',
  '011000',
  '000110',
  '011010',
  '010110',
  '011101',
  '101110',
  '001001',
  '100100',
  '110100',
  '001011',
  '001101',
  '101100',
  '110110',
  '011011',
  '110010',
  '010011',
  '110011',
  '001100',
  '010101',
  '101010',
] as const;

function withHexagramCode(entry: DailyHexagramCopyEntry): DailyHexagramEntry {
  return {
    ...entry,
    code: DAILY_HEXAGRAM_CODES[entry.index - 1] ?? '000000',
  };
}

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const MAO_HOUR_START = 5;

/** 每日一卦以北京时间卯时初（05:00）为刷新边界。 */
export function getDailyHexagramPeriod(now = new Date()): string {
  const beijing = new Date(now.getTime() + BEIJING_OFFSET_MS);
  if (beijing.getUTCHours() < MAO_HOUR_START) {
    beijing.setUTCDate(beijing.getUTCDate() - 1);
  }
  const year = beijing.getUTCFullYear();
  const month = String(beijing.getUTCMonth() + 1).padStart(2, '0');
  const day = String(beijing.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getHexagramByIndex(index: number): DailyHexagramEntry | null {
  if (!Number.isInteger(index) || index < 1 || index > DAILY_HEXAGRAM_ENTRIES.length) return null;
  return withHexagramCode(DAILY_HEXAGRAM_ENTRIES[index - 1]!);
}

const DAILY_HEXAGRAM_STORAGE_KEY = 'guanxin-daily-hexagram';

export type DailyHexagramSnapshot = {
  periodKey: string;
  hexagram: DailyHexagramEntry | null;
  status: 'drawn' | 'ready';
};

type StoredDailyDraw = {
  periodKey: string;
  hexagramIndex: number;
};

let memorySnapshot: DailyHexagramSnapshot | null = null;
let inflight: Promise<DailyHexagramSnapshot> | null = null;

function readStoredDraw(): StoredDailyDraw | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DAILY_HEXAGRAM_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredDailyDraw;
    if (typeof stored?.periodKey !== 'string' || !Number.isInteger(stored.hexagramIndex)) return null;
    return stored;
  } catch {
    return null;
  }
}

function writeStoredDraw(periodKey: string, hexagramIndex: number) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      DAILY_HEXAGRAM_STORAGE_KEY,
      JSON.stringify({ periodKey, hexagramIndex } satisfies StoredDailyDraw),
    );
  } catch {
    // quota / private mode
  }
}

/** 同步读取本地快照：有今日之卦则直接展示，否则进入可抽取态，不经过加载占位。 */
export function readDailyHexagramSnapshot(): DailyHexagramSnapshot {
  const periodKey = getDailyHexagramPeriod();
  if (memorySnapshot?.periodKey === periodKey) return memorySnapshot;

  const stored = readStoredDraw();
  if (stored?.periodKey === periodKey) {
    const hexagram = getHexagramByIndex(stored.hexagramIndex);
    if (hexagram) {
      const snapshot: DailyHexagramSnapshot = { periodKey, hexagram, status: 'drawn' };
      memorySnapshot = snapshot;
      return snapshot;
    }
  }

  return { periodKey, hexagram: null, status: 'ready' };
}

export function rememberDailyHexagramDraw(hexagramIndex: number): DailyHexagramEntry | null {
  const hexagram = getHexagramByIndex(hexagramIndex);
  if (!hexagram) return null;
  const periodKey = getDailyHexagramPeriod();
  memorySnapshot = { periodKey, hexagram, status: 'drawn' };
  writeStoredDraw(periodKey, hexagramIndex);
  return hexagram;
}

export function clearDailyHexagramCache() {
  memorySnapshot = null;
  inflight = null;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(DAILY_HEXAGRAM_STORAGE_KEY);
  } catch {
    // ignore
  }
}

async function loadDailyHexagramSnapshot(): Promise<DailyHexagramSnapshot> {
  const periodKey = getDailyHexagramPeriod();
  try {
    const response = await fetch('/api/daily-hexagram', { credentials: 'include', cache: 'no-store' });
    if (response.status === 401) {
      const cached = readDailyHexagramSnapshot();
      if (cached.hexagram) return cached;
      memorySnapshot = { periodKey, hexagram: null, status: 'ready' };
      return memorySnapshot;
    }
    if (!response.ok) throw new Error('LOAD_FAILED');

    const payload = await response.json() as { periodKey?: string; draw?: { hexagramIndex?: number } | null };
    const nextPeriod = payload.periodKey || periodKey;
    const index = payload.draw?.hexagramIndex;
    const hexagram = typeof index === 'number' ? getHexagramByIndex(index) : null;
    const snapshot: DailyHexagramSnapshot = {
      periodKey: nextPeriod,
      hexagram,
      status: hexagram ? 'drawn' : 'ready',
    };
    memorySnapshot = snapshot;
    if (hexagram && typeof index === 'number') {
      writeStoredDraw(nextPeriod, index);
    } else {
      const stored = readStoredDraw();
      if (stored?.periodKey === nextPeriod) {
        try {
          window.localStorage.removeItem(DAILY_HEXAGRAM_STORAGE_KEY);
        } catch {
          // ignore
        }
      }
    }
    return snapshot;
  } catch (error) {
    const cached = readDailyHexagramSnapshot();
    if (cached.hexagram) return cached;
    throw error;
  }
}

/** 首页即可预取；见自己挂载时复用同一请求，避免打开 tab 再等一轮。 */
export function prefetchDailyHexagram(): Promise<DailyHexagramSnapshot> {
  if (inflight) return inflight;
  inflight = loadDailyHexagramSnapshot().finally(() => {
    inflight = null;
  });
  return inflight;
}

if (typeof window !== 'undefined') {
  const flag = '__theoneDailyHexagramAuthListener' as const;
  const target = window as Window & { [flag]?: boolean };
  if (!target[flag]) {
    target[flag] = true;
    window.addEventListener('theone:auth-changed', () => {
      clearDailyHexagramCache();
    });
  }
}
