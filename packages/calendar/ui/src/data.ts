/** 历法数据：2025-2027 法定节假日、常见节日、节气详情；黄历宜忌为简化示意数据，仅供展示 */

import type { SolarTerm } from "./lunar";

/** 农历节日（按 "月-日" 索引） */

export interface FestivalInfo {
  name: string;
  origin?: string;
  description?: string;
}

const LUNAR_FESTIVALS: Record<string, FestivalInfo> = {
  "1-1": {
    name: "春节",
    origin: "起源于殷商时期年头岁尾的祭神祭祖活动，是中国最隆重的传统节日。",
    description: "俗称「过年」，有守岁、拜年、放鞭炮、贴春联等习俗。",
  },
  "1-15": {
    name: "元宵节",
    origin: "起源于汉代，汉武帝正月上辛夜在甘泉宫祭祀「太一」的活动。",
    description: "又称上元节，有赏花灯、吃元宵、猜灯谜、舞龙舞狮等习俗。",
  },
  "2-2": {
    name: "龙抬头",
    origin: "又称春耕节、农事节，传说此日龙王抬头，雨水渐多，适宜耕种。",
    description: "有剃龙头、吃龙须面、祭社神等习俗。",
  },
  "5-5": {
    name: "端午节",
    origin: "纪念战国时期楚国诗人屈原投汨罗江自尽，百姓划船捞救、投粽喂鱼以防鱼虾咬食屈原身体。",
    description: "有赛龙舟、吃粽子、挂艾草菖蒲、佩香囊、饮雄黄酒等习俗。",
  },
  "7-7": {
    name: "七夕节",
    origin: "源于汉代牛郎织女的爱情传说，是中国传统的情人节。",
    description: "有乞巧、拜织女、吃巧果等习俗。",
  },
  "7-15": {
    name: "中元节",
    origin: "源于道教的「三元」之说，佛教称为盂兰盆节，是祭祀祖先、超度亡灵的日子。",
    description: "俗称鬼节，有祭祖、放河灯、烧纸钱等习俗。",
  },
  "8-15": {
    name: "中秋节",
    origin: "起源于上古时代的秋夕祭月，定型于唐代，盛行于宋代。传说嫦娥奔月与此节日相关。",
    description: "有赏月、吃月饼、玩花灯、饮桂花酒等习俗。",
  },
  "9-9": {
    name: "重阳节",
    origin: "源于战国时期，九为阳数之极，九九相重，故称重阳。有登高避祸的传统。",
    description: "有登高望远、赏菊饮酒、佩茱萸、吃重阳糕等习俗。",
  },
  "12-8": {
    name: "腊八节",
    origin: "源于佛教纪念释迦牟尼成道之日，后与民间腊祭结合。",
    description: "有喝腊八粥、泡腊八蒜等习俗。",
  },
  "12-23": {
    name: "小年（北）",
    origin: "祭灶日，传说此日灶王爷上天向玉皇大帝禀报一家善恶。",
    description: "有祭灶、扫尘、吃灶糖等习俗。",
  },
  "12-24": {
    name: "小年（南）",
    origin: "南方部分地区以腊月二十四为小年，同样是祭灶日。",
    description: "有祭灶、扫尘、吃年糕等习俗。",
  },
  "12-30": {
    name: "除夕",
    origin: "源于先秦时期的「逐除」仪式，古人在新年前一天击鼓驱逐疫疠之鬼。",
    description: "有吃年夜饭、守岁、贴春联、放鞭炮、发压岁钱等习俗。",
  },
};

/** 根据农历月日查找节日 */
export function getLunarFestival(lunarMonth: number, lunarDay: number): FestivalInfo | null {
  const key = `${lunarMonth}-${lunarDay}`;
  return LUNAR_FESTIVALS[key] ?? null;
}

const SOLAR_FESTIVALS: Record<string, FestivalInfo> = {
  "1-1": {
    name: "元旦",
    origin: "公历新年第一天，辛亥革命后中国开始采用公历纪年。",
    description: "全国放假一天，迎接新年。",
  },
  "2-14": {
    name: "情人节",
    origin: "西方传统节日，纪念基督教殉道者圣瓦伦丁。",
    description: "情侣互赠礼物、表达爱意的日子。",
  },
  "3-8": {
    name: "妇女节",
    origin: "源于20世纪初北美和欧洲的工人运动，纪念妇女争取平等权利的斗争。",
    description: "国际劳动妇女节，女性放假半天。",
  },
  "4-1": {
    name: "愚人节",
    origin: "西方民间节日，起源于法国改历时期的守旧派被戏称为「四月愚人」。",
  },
  "5-1": {
    name: "劳动节",
    origin: "纪念1886年芝加哥工人争取八小时工作制的罢工运动。",
    description: "国际劳动节，中国法定节假日。",
  },
  "6-1": {
    name: "儿童节",
    origin: "为悼念1942年利迪策惨案和全世界在战争中死难的儿童而设立。",
    description: "国际儿童节，不满14岁少年儿童放假一天。",
  },
  "10-1": {
    name: "国庆节",
    origin: "纪念1949年10月1日中华人民共和国成立。",
    description: "法定节假日，通常放假7天（含调休），有阅兵、升旗、烟花等庆祝活动。",
  },
  "12-25": {
    name: "圣诞节",
    origin: "基督教纪念耶稣诞生的节日，源自罗马教会。",
    description: "西方最重要的节日，有装饰圣诞树、交换礼物等习俗。",
  },
};

/** 根据公历月日查找节日 */
export function getSolarFestival(month: number, day: number): FestivalInfo | null {
  const key = `${month}-${day}`;
  return SOLAR_FESTIVALS[key] ?? null;
}

export interface SolarTermDetail {
  name: string;
  meaning: string;
  phenology: string; // 物候
  custom: string; // 民俗
  farming: string; // 农事
  health: string; // 养生
}

const SOLAR_TERM_DETAILS: Record<string, SolarTermDetail> = {
  立春: {
    name: "立春",
    meaning: "春季的开始，万物复苏，阳气初生。太阳到达黄经315°。",
    phenology: "一候东风解冻，二候蛰虫始振，三候鱼陟负冰。",
    custom: "迎春、咬春（吃春饼/春卷）、鞭春牛、贴「宜春」字。",
    farming: "春耕准备开始，检修农具，选种备肥。",
    health: "宜养肝护阳，早睡早起，适度运动，忌暴怒。",
  },
  雨水: {
    name: "雨水",
    meaning: "降雨开始增多，冰雪融化，草木萌动。",
    phenology: "一候獭祭鱼，二候鸿雁来，三候草木萌动。",
    custom: "回娘家、接寿（送节礼给岳父母）。",
    farming: "小麦返青期，需灌溉追肥，防春旱。",
    health: "健脾祛湿，少吃酸味多吃甜味，注意保暖。",
  },
  惊蛰: {
    name: "惊蛰",
    meaning: "春雷始鸣，惊醒蛰伏冬眠的昆虫，万物复苏加速。",
    phenology: "一候桃始华，二候仓庚鸣，三候鹰化为鸠。",
    custom: "祭白虎、打小人（驱赶霉运）、吃梨。",
    farming: "春耕全面展开，播种早稻、玉米。",
    health: "养肝健脾，防春季流行病，适当吃梨润肺。",
  },
  春分: {
    name: "春分",
    meaning: "昼夜平分，此后昼长夜短。春季过半，气温回升明显。",
    phenology: "一候玄鸟至，二候雷乃发声，三候始电。",
    custom: "竖蛋、吃春菜、送春牛图、粘雀子嘴。",
    farming: "越冬作物进入生长阶段，需加强田间管理。",
    health: "阴阳平衡，饮食宜清淡，多食时令蔬菜。",
  },
  清明: {
    name: "清明",
    meaning: "天气清澈明朗，万物洁净，既是节气又是传统节日。",
    phenology: "一候桐始华，二候田鼠化为鴽，三候虹始见。",
    custom: "扫墓祭祖、踏青、放风筝、荡秋千、插柳。",
    farming: "春播春种关键期，「清明前后，种瓜点豆」。",
    health: "养肝护肝，外出踏青舒展身心，忌食发物。",
  },
  谷雨: {
    name: "谷雨",
    meaning: "雨生百谷，降雨及时且充足，有利于谷物生长。",
    phenology: "一候萍始生，二候鸣鸠拂其羽，三候戴胜降于桑。",
    custom: "喝谷雨茶、赏牡丹、祭海。",
    farming: "播种移苗、种瓜点豆的最佳时节。",
    health: "健脾祛湿，适当食用薏米、山药等祛湿食物。",
  },
  立夏: {
    name: "立夏",
    meaning: "夏季开始，万物繁茂生长。",
    phenology: "一候蝼蝈鸣，二候蚯蚓出，三候王瓜生。",
    custom: "迎夏、称人、吃立夏蛋/立夏饭、斗蛋游戏。",
    farming: "早稻插秧，中耕除草，防病虫害。",
    health: "养心护阳，午休养神，饮食宜清淡。",
  },
  小满: {
    name: "小满",
    meaning: "麦类等夏熟作物籽粒开始灌浆饱满，但尚未成熟。",
    phenology: "一候苦菜秀，二候靡草死，三候麦秋至。",
    custom: "祭车神（水车）、祈蚕、吃苦菜。",
    farming: "小麦进入乳熟期，水稻追肥。",
    health: "清热利湿，多吃苦味食物，忌贪凉。",
  },
  芒种: {
    name: "芒种",
    meaning: "有芒的麦子快收，有芒的稻子可种，农忙时节。",
    phenology: "一候螳螂生，二候鵙始鸣，三候反舌无声。",
    custom: "送花神、安苗、打泥巴仗、煮青梅。",
    farming: "抢收小麦，抢种夏玉米、夏大豆。",
    health: "清热降火，多饮水，适当午休。",
  },
  夏至: {
    name: "夏至",
    meaning: "白昼最长，阳气最盛，此后阴气渐生。",
    phenology: "一候鹿角解，二候蝉始鸣，三候半夏生。",
    custom: "祭神祀祖、消夏避伏、吃面（冬至饺子夏至面）。",
    farming: "水稻需水量最大，注意灌溉防旱。",
    health: "养心安神，饮食宜清淡降火，忌过度贪凉。",
  },
  小暑: {
    name: "小暑",
    meaning: "暑为炎热之意，小暑即天气开始炎热但尚未达到极致。",
    phenology: "一候温风至，二候蟋蟀居宇，三候鹰始鸷。",
    custom: "晒伏（晒书画衣物）、食新（尝新米）。",
    farming: "早稻灌浆成熟，需防高温逼熟。",
    health: "防暑降温，多食绿豆、西瓜等消暑食物。",
  },
  大暑: {
    name: "大暑",
    meaning: "一年中最热的时期，湿热交蒸。",
    phenology: "一候腐草为萤，二候土润溽暑，三候大雨时行。",
    custom: "饮伏茶、晒伏姜、烧伏香、吃仙草/凉粉。",
    farming: "抢收抢种双抢时节，防旱防涝。",
    health: "清热解暑，健脾祛湿，避免高温时段外出。",
  },
  立秋: {
    name: "立秋",
    meaning: "秋季开始，暑去凉来，但暑气一时难消（秋老虎）。",
    phenology: "一候凉风至，二候白露降，三候寒蝉鸣。",
    custom: "贴秋膘、啃秋（吃西瓜）、晒秋。",
    farming: "秋粮作物进入灌浆成熟期，棉花开始采收。",
    health: "养肺润燥，适当进补，早卧早起。",
  },
  处暑: {
    name: "处暑",
    meaning: "「处」即止，暑气至此而止，炎热渐退。",
    phenology: "一候鹰乃祭鸟，二候天地始肃，三候禾乃登。",
    custom: "放河灯、开渔节、吃鸭子。",
    farming: "水稻孕穗抽穗，注意防秋旱。",
    health: "润肺防燥，少辛增酸，注意秋乏。",
  },
  白露: {
    name: "白露",
    meaning: "天气转凉，水汽在地面或近地物体上凝结成白色水珠。",
    phenology: "一候鸿雁来，二候玄鸟归，三候群鸟养羞。",
    custom: "收清露、喝白露茶、吃龙眼、酿米酒。",
    farming: "晚稻抽穗扬花，棉花裂铃吐絮。",
    health: "润肺生津，注意保暖添衣，预防秋燥。",
  },
  秋分: {
    name: "秋分",
    meaning: "昼夜再次平分，此后昼短夜长，秋已过半。",
    phenology: "一候雷始收声，二候蛰虫坯户，三候水始涸。",
    custom: "祭月、吃秋菜、竖蛋、送秋牛。",
    farming: "秋收秋种关键期，抢收水稻玉米。",
    health: "养肺润燥，早睡早起，保持心情平和。",
  },
  寒露: {
    name: "寒露",
    meaning: "气温更低，露水更多且带寒意，将要结冰。",
    phenology: "一候鸿雁来宾，二候雀入大水为蛤，三候菊有黄华。",
    custom: "登高望远、赏菊花、吃芝麻。",
    farming: "冬小麦播种，晚稻收割。",
    health: "养阴润燥，防寒保暖，多食滋润食物。",
  },
  霜降: {
    name: "霜降",
    meaning: "天气渐冷，开始降霜，秋季最后一个节气。",
    phenology: "一候豺乃祭兽，二候草木黄落，三候蛰虫咸俯。",
    custom: "吃柿子、赏红叶、进补。",
    farming: "秋收扫尾，冬小麦出苗管理。",
    health: "补肺养阴，健脾养胃，注意保暖防寒。",
  },
  立冬: {
    name: "立冬",
    meaning: "冬季开始，万物收藏，规避寒冷。",
    phenology: "一候水始冰，二候地始冻，三候雉入大水为蜃。",
    custom: "迎冬、贺冬、吃饺子、补冬。",
    farming: "秋收完毕，冬储开始，检修农机。",
    health: "养肾藏精，早卧晚起，适度进补。",
  },
  小雪: {
    name: "小雪",
    meaning: "开始降雪，但雪量不大，故称小雪。",
    phenology: "一候虹藏不见，二候天气上升地气下降，三候闭塞而成冬。",
    custom: "腌腊肉、吃糍粑、晒鱼干。",
    farming: "果树冬剪，蔬菜大棚保温防冻。",
    health: "养肾防寒，多食温补食物，保持情绪稳定。",
  },
  大雪: {
    name: "大雪",
    meaning: "降雪量增大，地面可能积雪，仲冬时节开始。",
    phenology: "一候鹖鴠不鸣，二候虎始交，三候荔挺出。",
    custom: "腌肉、赏雪景、吃红薯粥。",
    farming: "冬小麦越冬管理，防冻保墒。",
    health: "温补养肾，早睡晚起，注意头部保暖。",
  },
  冬至: {
    name: "冬至",
    meaning: "白昼最短，阴极之至，阳气始生。既是一个重要节气，也是传统节日。",
    phenology: "一候蚯蚓结，二候麋角解，三候水泉动。",
    custom: "吃饺子/汤圆、祭祖、数九消寒、画九九消寒图。",
    farming: "冬闲时节，兴修水利，积肥造肥。",
    health: "温补肾阳，艾灸保健，避免过度劳累。",
  },
  小寒: {
    name: "小寒",
    meaning: "天气寒冷但尚未达到极致，一年中最寒冷时段的开始。",
    phenology: "一候雁北乡，二候鹊始巢，三候雉始雊。",
    custom: "探梅、冰戏、吃腊八粥（近腊八）。",
    farming: "冬小麦越冬管理，果树修剪整形。",
    health: "温阳散寒，适当进补，注意保暖。",
  },
  大寒: {
    name: "大寒",
    meaning: "一年中最寒冷的时期，寒气逆极。",
    phenology: "一候鸡始乳，二候征鸟厉疾，三候水泽腹坚。",
    custom: "尾牙祭（祭拜土地公）、除旧布新、准备年货。",
    farming: "越冬作物防冻，积肥送肥。",
    health: "温补防寒，早睡晚起，以藏为主。",
  },
};

/** 获取节气详情 */
export function getSolarTermDetail(termName: string): SolarTermDetail | null {
  return SOLAR_TERM_DETAILS[termName] ?? null;
}

/** 黄历宜忌（简化示意数据，正式版可替换） */

export interface AlmanacInfo {
  suitable: string[]; // 宜
  unsuitable: string[]; // 忌
  gods: string[]; // 神煞
  clash: string; // 冲煞
  favorable: string; // 吉神
}

/** 通用宜忌（按农历月日的基础数据，正式版需完整黄历） */
function getBaseAlmanac(lunarMonth: number, lunarDay: number): AlmanacInfo {
  // 按农历日期的天干地支周期给出基础宜忌
  const dayMod = (lunarMonth * 30 + lunarDay) % 12;
  const earthlyBranch = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"][
    dayMod
  ];
  const zodiacSign = ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"][
    dayMod
  ];

  const suitableSets: Record<number, string[]> = {
    0: ["祭祀", "祈福", "开光", "出行", "嫁娶"],
    1: ["纳采", "订盟", "移徙", "安床", "动土"],
    2: ["开市", "交易", "立券", "纳财", "栽种"],
    3: ["入学", "出行", "嫁娶", "修造", "安葬"],
    4: ["祭祀", "祈福", "求嗣", "开光", "拆卸"],
    5: ["解除", "沐浴", "剃头", "整手足甲", "扫舍"],
    6: ["嫁娶", "纳采", "订盟", "安床", "移徙"],
    7: ["开市", "交易", "立券", "纳财", "修造"],
    8: ["祭祀", "入宅", "安香", "出行", "会友"],
    9: ["嫁娶", "纳采", "出行", "祈福", "开光"],
    10: ["祭祀", "祈福", "开光", "拆卸", "动土"],
    11: ["嫁娶", "安床", "移徙", "入宅", "开市"],
  };

  const unsuitableSets: Record<number, string[]> = {
    0: ["作灶", "开仓", "置产", "行丧", "安葬"],
    1: ["嫁娶", "开市", "掘井", "伐木", "苫盖"],
    2: ["祭祀", "祈福", "出行", "上官", "词讼"],
    3: ["移徙", "入宅", "安香", "作灶", "开仓"],
    4: ["嫁娶", "开市", "出行", "安葬", "伐木"],
    5: ["嫁娶", "移徙", "入宅", "开市", "安葬"],
    6: ["开市", "交易", "作灶", "上梁", "伐木"],
    7: ["出行", "嫁娶", "定盟", "安床", "安葬"],
    8: ["嫁娶", "开市", "裁衣", "合帐", "安床"],
    9: ["开仓", "出货财", "造船", "行舟", "伐木"],
    10: ["嫁娶", "安床", "入宅", "开市", "伐木"],
    11: ["置产", "掘井", "作灶", "安葬", "词讼"],
  };

  return {
    suitable: suitableSets[dayMod] ?? ["祭祀", "祈福"],
    unsuitable: unsuitableSets[dayMod] ?? ["嫁娶", "安葬"],
    gods: ["天德", "月德", "天赦"],
    clash: `冲${zodiacSign}(${earthlyBranch})煞南`,
    favorable: "天德合·月德合",
  };
}

/** 获取某天的黄历宜忌信息 */
export function getAlmanac(lunarMonth: number, lunarDay: number): AlmanacInfo {
  return getBaseAlmanac(lunarMonth, lunarDay);
}
