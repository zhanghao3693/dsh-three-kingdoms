/* ============================================================================
 * @local/three-kingdoms-strategy — client half
 *
 * 复刻 2007–2009 年诺基亚 J2ME 手机上的三国志：回合制战略、城池内政、
 * 征兵、出征、智力定计略（火计/伏兵/离间）、武力决胜负。
 *
 * 这个文件里没有任何宿主依赖：状态全在 React 里，存档走 localStorage。
 * 宿主侧 index.js 是空壳。
 *
 * 硬约束（踩过的坑，别改）：本文件只能被 exports["./client"] 加载，
 * 顶层不得引用 Node API；React 只能从 factory 的 require 拿。
 * ========================================================================== */

window.__ModuleLoader__.load({
  id: "@local/three-kingdoms-strategy",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const h = React.createElement;
    const { useState, useRef, useEffect, useCallback } = React;

    /* ------------------------------------------------------------------ 常量 */

    const STORAGE_KEY = "dsh.three-kingdoms.save.v1";
    const NS = "three-kingdoms-strategy";
    const MONTHS = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];
    const START_YEAR = 207;

    /* ------------------------------------------------------------ 年代设定

       一个年代 = 八城的归属划分 + 开局兵粮。势力表由「谁占到城」反推，
       所以不用为每个年代手写势力列表：189 年自然多出董卓与袁绍，
       207 年自然只剩三家。

       只列差异值，没写的字段沿用 CITY_DEFS 的基准值。 */
    const ERA_DEFS = [
      {
        id: "189",
        year: 189,
        name: "董卓乱政",
        desc: "十常侍既诛，董卓挟天子入洛阳。关东诸侯起兵讨逆，天下自此多事。",
        /* 年代专属调位：曹操此时刚在陈留起兵，不在洛阳，故挪去许昌。
           不写这一条，他会被洛阳的归属带着变成董卓部将。 */
        moves: { caocao: "xuchang", xiahoudun: "xuchang", dianwei: "xuchang" },
        /* 此时尚未出仕的传统「刘备系」名将，一律放在野，等玩家去寻访 */
        free: ["zhaoyun", "huangzhong", "guanyu", "zhangfei", "chendao"],
        cities: {
          luoyang: { owner: "dong", troops: 21000, gold: 2000, food: 24000, wall: 80, morale: 70 },
          changan: { owner: "dong", troops: 15000, gold: 1000, food: 17000 },
          ye: { owner: "yuan", troops: 20000, gold: 1500, food: 22000, wall: 74, morale: 68 },
          xuchang: { owner: "cao", troops: 16000, gold: 1400, food: 15000, agri: 58, comm: 56, wall: 72, morale: 68 },
          xuzhou: { owner: "qian", troops: 12000, gold: 800, food: 12000, wall: 68 },
          chengdu: { owner: "yan", troops: 15000, gold: 1000, food: 17000, wall: 70 },
          xiangyang: { owner: "sun", troops: 9000, gold: 650, food: 8000 },
          jianye: { owner: "sun", troops: 11000, gold: 850, food: 12000 },
        },
      },
      {
        id: "200",
        year: 200,
        name: "官渡之战",
        desc: "袁绍并河北四州，曹操挟天子都许。两雄相持于官渡，天下侧目。",
        cities: {
          ye: { owner: "yuan", troops: 26000, gold: 1800, food: 28000, wall: 76, morale: 70 },
          luoyang: { owner: "cao", troops: 17000, gold: 1500, food: 19000 },
          xuchang: { owner: "cao", troops: 20000, gold: 1600, food: 21000 },
          changan: { owner: "cao", troops: 13000, gold: 900, food: 14000 },
          xuzhou: { owner: "cao", troops: 11000, gold: 700, food: 10000 },
          chengdu: { owner: "liu", troops: 12000, gold: 850, food: 14000 },
          xiangyang: { owner: "sun", troops: 11000, gold: 800, food: 11000 },
          jianye: { owner: "sun", troops: 14000, gold: 1100, food: 14000 },
        },
      },
      {
        id: "207",
        year: 207,
        name: "卧龙出山",
        desc: "官渡之后，曹操已并河北。刘备寄身荆州，孙权坐领江东。",
        cities: {
          ye: { owner: "cao", troops: 13000, gold: 900, food: 14000 },
          changan: { owner: "cao", troops: 11000, gold: 800, food: 12000 },
          luoyang: { owner: "cao", troops: 16000, gold: 1400, food: 18000 },
          xuchang: { owner: "cao", troops: 14000, gold: 1100, food: 15000 },
          xuzhou: { owner: "liu", troops: 12000, gold: 700, food: 11000 },
          xiangyang: { owner: "sun", troops: 10000, gold: 750, food: 10000 },
          jianye: { owner: "sun", troops: 16000, gold: 1200, food: 16000 },
          chengdu: { owner: "liu", troops: 14000, gold: 900, food: 16000 },
        },
      },
      {
        id: "214",
        year: 214,
        name: "益州既得",
        desc: "刘备入蜀，关羽镇荆州。曹操定关中，孙权据江东。三分之势初成。",
        moves: { guanyu: "xiangyang", zhangfei: "chengdu", huanggai: "jianye" },
        cities: {
          ye: { owner: "cao", troops: 16000, gold: 1200, food: 17000 },
          luoyang: { owner: "cao", troops: 18000, gold: 1600, food: 20000 },
          xuchang: { owner: "cao", troops: 17000, gold: 1400, food: 18000 },
          changan: { owner: "cao", troops: 13000, gold: 900, food: 14000 },
          xuzhou: { owner: "cao", troops: 12000, gold: 800, food: 11000 },
          chengdu: { owner: "liu", troops: 20000, gold: 1500, food: 22000, agri: 76, comm: 60, wall: 68 },
          xiangyang: { owner: "liu", troops: 13000, gold: 900, food: 12000 },
          jianye: { owner: "sun", troops: 19000, gold: 1500, food: 19000 },
        },
      },
    ];

    function eraById(id) {
      return ERA_DEFS.filter((e) => e.id === id)[0] || ERA_DEFS[2];
    }

    /* 势力与「谁是玩家」完全解耦：玩家开局任选其一，全局状态记
       game.playerFaction。代码里不许出现字面量 "player"，否则选了曹操
       也会按刘备结算。 */
    /* 全部势力（含只在早期年代出现的董卓、袁绍）。
       一局里实际参战的势力由年代的城市归属反推 —— 见 factionsOf(era)。 */
    const ALL_FACTIONS = {
      cao: {
        id: "cao", name: "曹操军", family: "曹", flag: "曹",
        color: "#c2544a",
        desc: "据中原之地，兵多粮足。谋士如云，正面碾压。",
      },
      liu: {
        id: "liu", name: "刘备军", family: "刘", flag: "刘",
        color: "#4a7fd4",
        desc: "徐州、成都两地，隔空相望。有关张万人敌，卧龙凤雏在野，靠名将翻盘。",
      },
      sun: {
        id: "sun", name: "孙权军", family: "孙", flag: "孙",
        color: "#3f9e6a",
        desc: "坐断东南，据襄阳建业。周瑜统帅，水陆并进，最考操作。",
      },
      dong: {
        id: "dong", name: "董卓军", family: "董", flag: "董",
        color: "#8b5cf6",
        desc: "挟天子以令诸侯，吕布为爪牙。兵甲天下之最，然人心不附。",
      },
      yuan: {
        id: "yuan", name: "袁绍军", family: "袁", flag: "袁",
        color: "#b08a3e",
        desc: "四世三公，坐拥河北。兵多而不精，谋臣相忌，最忌久战。",
      },
      yan: {
        id: "yan", name: "刘焉军", family: "焉", flag: "焉",
        color: "#4f8f8a",
        desc: "益州天府，闭关自守。张任严颜皆川中名将，守成有余，进取不足。",
      },
      qian: {
        id: "qian", name: "陶谦军", family: "陶", flag: "陶",
        color: "#9c7b5c",
        desc: "徐州牧陶谦，老成持重。地处四战，兵甲不修，最易遭人觊觎。",
      },
    };

    /* 年代 → 参战势力（按城数降序，作为默认展示顺序） */
    function factionsOf(era) {
      const cityOwners = {};
      Object.keys(era.cities).forEach((cid) => {
        const o = era.cities[cid].owner;
        cityOwners[o] = (cityOwners[o] || 0) + 1;
      });
      Object.keys(CITY_DEFS).forEach((k) => {
        const c = CITY_DEFS[k];
        if (!era.cities[c.id]) cityOwners[c.owner] = (cityOwners[c.owner] || 0) + 1;
      });
      return Object.keys(cityOwners).sort((a, b) => {
        if (cityOwners[b] !== cityOwners[a]) return cityOwners[b] - cityOwners[a];
        return FACTION_ORDER.indexOf(a) - FACTION_ORDER.indexOf(b);
      });
    }
    const FACTION_ORDER = ["cao", "liu", "sun", "yuan", "dong", "yan", "qian"];

    /* 八城。x/y 是地图上的百分比坐标（0-100）。adj 是相邻关系。 */
    const CITY_DEFS = [
      {
        id: "ye", name: "邺城", x: 64, y: 11, owner: "cao",
        adj: ["luoyang", "xuchang"],
        troops: 13000, gold: 900, food: 14000,
        agri: 62, comm: 55, wall: 70, morale: 62,
      },
      {
        id: "changan", name: "长安", x: 13, y: 27, owner: "cao",
        adj: ["luoyang", "chengdu"],
        troops: 11000, gold: 800, food: 12000,
        agri: 55, comm: 60, wall: 72, morale: 60,
      },
      {
        id: "luoyang", name: "洛阳", x: 39, y: 23, owner: "cao",
        adj: ["ye", "changan", "xuchang", "xuzhou"],
        troops: 16000, gold: 1400, food: 18000,
        agri: 70, comm: 78, wall: 78, morale: 66,
      },
      {
        id: "xuchang", name: "许昌", x: 48, y: 45, owner: "cao",
        adj: ["ye", "luoyang", "xuzhou", "xiangyang"],
        troops: 14000, gold: 1100, food: 15000,
        agri: 68, comm: 66, wall: 66, morale: 62,
      },
      {
        id: "xuzhou", name: "徐州", x: 77, y: 32, owner: "liu",
        adj: ["luoyang", "xuchang", "jianye"],
        troops: 12000, gold: 700, food: 11000,
        agri: 52, comm: 48, wall: 54, morale: 58,
      },
      {
        id: "xiangyang", name: "襄阳", x: 39, y: 66, owner: "sun",
        adj: ["xuchang", "jianye", "chengdu"],
        troops: 10000, gold: 750, food: 10000,
        agri: 56, comm: 52, wall: 64, morale: 58,
      },
      {
        id: "jianye", name: "建业", x: 79, y: 71, owner: "sun",
        adj: ["xuzhou", "xiangyang"],
        troops: 16000, gold: 1200, food: 16000,
        agri: 66, comm: 66, wall: 70, morale: 66,
      },
      {
        id: "chengdu", name: "成都", x: 12, y: 73, owner: "liu",
        adj: ["changan", "xiangyang"],
        troops: 14000, gold: 900, food: 16000,
        agri: 72, comm: 50, wall: 62, morale: 64,
      },
    ];

    /* 武将：war 武力 / int 智力 / lead 统率。统率决定能带多少兵（×400）。
       city 为 null 的是在野武将，seek 指明在哪个城能被寻访到（见「招募」）。 */
    /* faction 是「这个年代里他归谁」；在野的写 null。改名换姓的历史差异体现为
       不同年代下同一批人的归属变动，而属性恒定 —— 我们不重写史书，只重排棋盘。 */
    const GENERAL_DEFS = [
      /* ---- 刘备系 ---- */
      { key: "zhugeliang", name: "诸葛亮", war: 38, int: 100, lead: 100, city: "chengdu", faction: "liu", born: 181, died: 234 },
      { key: "zhaoyun", name: "赵云", war: 96, int: 76, lead: 91, city: "chengdu", faction: "liu", born: 168, died: 229, seek: "chengdu" },
      { key: "huangzhong", name: "黄忠", war: 92, int: 60, lead: 88, city: "chengdu", faction: "liu", born: 148, died: 220, seek: "xiangyang" },
      { key: "weiyan", name: "魏延", war: 90, int: 49, lead: 80, city: "chengdu", faction: "liu", born: 175, died: 234 },
      { key: "guanyu", name: "关羽", war: 97, int: 75, lead: 95, city: "xuzhou", faction: "liu", born: 160, died: 220, seek: "xuzhou" },
      { key: "zhangfei", name: "张飞", war: 98, int: 30, lead: 85, city: "xuzhou", faction: "liu", born: 165, died: 221, seek: "xuzhou" },
      { key: "chendao", name: "陈到", war: 80, int: 60, lead: 72, city: "xuzhou", faction: "liu", born: 170, died: 230, seek: "xuzhou" },
      /* ---- 曹操系 ---- */
      { key: "caocao", name: "曹操", war: 72, int: 91, lead: 96, city: "luoyang", faction: "cao", born: 155, died: 220 },
      { key: "simayi", name: "司马懿", war: 63, int: 96, lead: 92, city: "luoyang", faction: "cao", born: 179, died: 251 },
      { key: "dianwei", name: "典韦", war: 95, int: 30, lead: 76, city: "luoyang", faction: "cao", born: 155, died: 197 },
      { key: "zhangliao", name: "张辽", war: 92, int: 78, lead: 93, city: "ye", faction: "cao", born: 169, died: 222 },
      { key: "xuchu", name: "许褚", war: 96, int: 25, lead: 78, city: "ye", faction: "cao", born: 170, died: 230 },
      { key: "xiahoudun", name: "夏侯惇", war: 90, int: 50, lead: 85, city: "changan", faction: "cao", born: 157, died: 220 },
      { key: "xuhuang", name: "徐晃", war: 88, int: 60, lead: 88, city: "changan", faction: "cao", born: 169, died: 227 },
      { key: "caoren", name: "曹仁", war: 84, int: 58, lead: 82, city: "xuchang", faction: "cao", born: 168, died: 223 },
      { key: "yujin", name: "于禁", war: 78, int: 56, lead: 84, city: "xuchang", faction: "cao", born: 159, died: 221 },
      /* ---- 孙权系 ---- */
      { key: "zhouyu", name: "周瑜", war: 71, int: 96, lead: 94, city: "xiangyang", faction: "sun", born: 175, died: 210 },
      { key: "huanggai", name: "黄盖", war: 80, int: 62, lead: 76, city: "xiangyang", faction: "sun", born: 145, died: 215 },
      { key: "sunjian", name: "孙坚", war: 90, int: 68, lead: 88, city: "xiangyang", faction: "sun", born: 155, died: 191 },
      { key: "chengpu", name: "程普", war: 80, int: 66, lead: 78, city: "jianye", faction: "sun", born: 150, died: 210 },
      { key: "sunquan", name: "孙权", war: 60, int: 80, lead: 80, city: "jianye", faction: "sun", born: 182, died: 252 },
      { key: "ganning", name: "甘宁", war: 94, int: 44, lead: 85, city: "jianye", faction: "sun", born: 175, died: 220 },
      { key: "luxun", name: "陆逊", war: 60, int: 87, lead: 90, city: "jianye", faction: "sun", born: 183, died: 245 },
      /* ---- 董卓系：只在 189 年登场 ---- */
      { key: "dongzhuo", name: "董卓", war: 85, int: 62, lead: 88, city: "luoyang", faction: "dong", born: 140, died: 192 },
      { key: "lvbu", name: "吕布", war: 100, int: 26, lead: 87, city: "luoyang", faction: "dong", born: 160, died: 199 },
      { key: "liruj", name: "李儒", war: 30, int: 92, lead: 68, city: "changan", faction: "dong", born: 160, died: 192 },
      { key: "huaxiong", name: "华雄", war: 92, int: 40, lead: 78, city: "changan", faction: "dong", born: 160, died: 191 },
      /* ---- 袁绍系：只在 189 / 200 年登场 ---- */
      { key: "yuanshao", name: "袁绍", war: 68, int: 74, lead: 90, city: "ye", faction: "yuan", born: 154, died: 202 },
      { key: "yanliang", name: "颜良", war: 94, int: 34, lead: 82, city: "ye", faction: "yuan", born: 160, died: 200 },
      { key: "wenzhou", name: "文丑", war: 93, int: 30, lead: 80, city: "ye", faction: "yuan", born: 160, died: 200 },
      { key: "jushou", name: "沮授", war: 45, int: 94, lead: 76, city: "ye", faction: "yuan", born: 155, died: 200 },
      /* ---- 刘焉系：只在 189 年据有益州 ---- */
      { key: "liuyan", name: "刘焉", war: 40, int: 78, lead: 80, city: "chengdu", faction: "yan", born: 130, died: 194 },
      { key: "zhangren", name: "张任", war: 92, int: 74, lead: 84, city: "chengdu", faction: "yan", born: 165, died: 213 },
      { key: "yanyan", name: "严颜", war: 84, int: 66, lead: 80, city: "chengdu", faction: "yan", born: 150, died: 220 },
      /* ---- 陶谦系：189 年据徐州 ---- */
      { key: "taoqian", name: "陶谦", war: 30, int: 70, lead: 74, city: "xuzhou", faction: "qian", born: 132, died: 194 },
      { key: "caobao", name: "曹豹", war: 68, int: 40, lead: 66, city: "xuzhou", faction: "qian", born: 160, died: 196 },
      { key: "chendeng", name: "陈登", war: 48, int: 86, lead: 72, city: "xuzhou", faction: "qian", born: 163, died: 201 },
      /* ---- 在野武将：city=null，只能在 seek 指定的城里寻访登用 ---- */
      { key: "taishici", name: "太史慈", war: 93, int: 58, lead: 86, city: null, seek: "jianye", faction: null, born: 166, died: 206 },
      { key: "xushu", name: "徐庶", war: 68, int: 92, lead: 82, city: null, seek: "xuchang", faction: null, born: 170, died: 232 },
      { key: "pangtong", name: "庞统", war: 42, int: 97, lead: 88, city: null, seek: "xiangyang", faction: null, born: 179, died: 214 },
      { key: "huatuo", name: "华佗", war: 20, int: 88, lead: 40, city: null, seek: "xuzhou", faction: null, born: 145, died: 208 },
      { key: "tianfeng", name: "田丰", war: 30, int: 94, lead: 70, city: null, seek: "ye", faction: null, born: 155, died: 200 },
      { key: "machao", name: "马超", war: 97, int: 44, lead: 90, city: null, seek: "changan", faction: null, born: 176, died: 222 },
      { key: "fazheng", name: "法正", war: 47, int: 94, lead: 78, city: null, seek: "chengdu", faction: null, born: 176, died: 220 },
    ];

    /* 计略：智力门槛 + 效果。火计是这套战斗模型的核心。 */
    const TACTICS = {
      none: { id: "none", name: "强攻", need: 0, desc: "不用计略，两军正面硬撼。" },
      fire: {
        id: "fire", name: "火攻", need: 80,
        desc: "智力 ≥ 80 方可用。成败取决于智力差，命中则守军大损。诸葛亮火计必中且伤害翻倍。",
      },
      ambush: {
        id: "ambush", name: "伏兵", need: 60,
        desc: "智力 ≥ 60 方可用。命中则守军前三回合攻势减半。",
      },
      discord: {
        id: "discord", name: "离间", need: 70,
        desc: "智力 ≥ 70 方可用。命中则守军士气大跌、城防打折。",
      },
    };

    /* AI 调参旋钮。三项一起决定「多久打一次、打谁、要多少兵力优势」。
       早期版本：每城独立 45% 开战 + 几乎不要优势 → 玩家 11 个月必亡。
       这组值经 20 局 × 60 月模拟校准，目标：被动玩家 2 年内被吞并，
       主动扩张的玩家有实际胜机。 */
    const AI_ATTACK_CHANCE = 0.34;
    const AI_ADVANTAGE = 1.0;
    const AI_MIN_SEND = 5000;
    const AI_DRAFT_THRESHOLD = 14000;

    const MAX_BATTLE_ROUNDS = 8;
    const ROUT_RATIO = 0.3; /* 兵力跌破出阵时的三成即溃 */

    /* 伤害公式。atkDmg = atk × (BASE + war/1200) × 士气 × 随机抖动；
       守方再乘 wallFactor（城防），城防 100 时约 ×1.2。
       这两个数是整局难度的主轴：调高 BASE 会让「兵多者胜」压过「将强者胜」。 */
    const DMG_BASE = 0.07;
    const DMG_WAR_DIV = 1200;
    const DMG_JITTER = 0.15;
    const WALL_DIV = 500;
    const WALL_DIV_DISCORD = 900; /* 离间成功后城防效果打折 */

    /* ------------------------------------------------------------------ 工具 */

    const rand = (a, b) => a + Math.random() * (b - a);
    const roll = (p) => Math.random() < p;
    const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
    const clone = (v) => JSON.parse(JSON.stringify(v));
    const fmt = (n) => Math.round(n).toLocaleString("zh-CN");

    function cityById(game, id) {
      return game.cities.find((c) => c.id === id);
    }
    function generalOf(game, key) {
      return game.generals.find((g) => g.key === key);
    }
    function generalsIn(game, cityId) {
      return game.generals.filter((g) => g.cityId === cityId);
    }
    function bestDefender(game, cityId) {
      const list = generalsIn(game, cityId);
      if (!list.length) return null;
      return list.slice().sort((a, b) => b.lead + b.war * 0.4 - (a.lead + a.war * 0.4))[0];
    }
    function ownerCities(game, owner) {
      return game.cities.filter((c) => c.owner === owner);
    }
    function maxLead(general) {
      return Math.round(general.lead * 400);
    }

    /* -------------------------------------------------------------- 建立新局 */

    /* 某个年代下，这个武将是否已经登场。
       生于年代之后的不出场（207 年没有陆逊，才 24 岁但已从军，故按 born+16 起算；
       死于年代之前的不出场（189 年没有黄盖——黄盖 145 年生，这年 44 岁，仍在）。
       数据不追求史实精确，只求「换个年代换一批人」的手感。 */
    function isActiveAt(gen, year) {
      const startAge = 16;
      if (year < gen.born + startAge) return false;
      if (year > gen.died) return false;
      return true;
    }

    /**
     * 建立新局。
     * @param playerFaction 玩家选的势力 id
     * @param eraId 年代 id（见 ERA_DEFS），省略等于默认年代
     *
     * 城归属与初始兵粮来自年代表；武将归属跟着「他所驻的城」走：
     * 城池属于谁，城里的非在野武将就归谁 —— 所以 189 年袁绍据邺城，
     * 张辽若守邺城就自动变袁绍军，不需要为每个年代写一份武将表。
     */
    function createGame(playerFaction, eraId) {
      const era = eraById(eraId);
      const factions = factionsOf(era);
      /* UI 只列本年代的势力，但 createGame 是导出函数，可能被直接调用。
         选了本年代不存在的势力（如 207 年选董卓）就回退到首个势力，
         否则会造出一个没有城池的玩家，开局即败。 */
      const me = factions.includes(playerFaction) ? playerFaction : factions[0];

      const cities = CITY_DEFS.map((d) => {
        const patch = era.cities[d.id] || {};
        const merged = Object.assign({}, clone(d), patch, {
          doneDomestic: false,
          doneMarch: false,
          doneRecruit: false,
        });
        /* 年代表只写了变化字段，x/y/adj 始终沿用基准值 */
        merged.x = d.x;
        merged.y = d.y;
        merged.adj = d.adj.slice();
        return merged;
      });

      /* 定义里用 city，运行态统一用 cityId —— 早期版本忘了这一步，
         结果是「守将恒为空、AI 永远不出兵」，地图上两军从不交战。 */
      const generals = GENERAL_DEFS.filter((g) => isActiveAt(g, era.year)).map((g) => {
        const out = Object.assign({}, g, {
          cityId: g.city || null,
          troops: 0,
          captured: false,
        });
        /* 年代专属调位优先于默认驻地；free 名单里的武将在本年代尚未出仕 */
        if (era.moves && era.moves[g.key]) out.cityId = era.moves[g.key];
        if (era.free && era.free.indexOf(g.key) >= 0) {
          out.cityId = null;
          out.faction = null;
        }
        /* 非在野武将的势力 = 他所在城池当前的归属 */
        if (out.cityId) {
          const c = cities.filter((x) => x.id === out.cityId)[0];
          out.faction = c ? c.owner : out.faction;
        }
        return out;
      });

      return {
        version: 3,
        playerFaction: me,
        eraId: era.id,
        eraName: era.name,
        year: era.year,
        month: 0,
        turn: 1,
        factions,
        cities,
        generals,
        report: [],
        outcome: null,
        recruitLog: [],
      };
    }

    /* ---------------------------------------------------------------- 招募 */

    /**
     * 招募 = 寻访 + 登用，每城每月各一次。
     *
     * 模型：城内武将的「德望」决定能不能请动在野贤才。
     *   rate = 0.28 + (bestInt - 50) * 0.006 + (我方城数 - 1) * 0.03
     * 诸葛亮（智 100）、庞统（智 97）这类在野大才门槛高，需要高智将领坐镇。
     * 失败不会让武将消失，下月可再试 —— 否则一次手滑就永久丢人。
     */
    function doRecruit(game, cityId) {
      const g = clone(game);
      const city = cityById(g, cityId);
      if (!city) return { game, message: "城池不存在。" };
      if (city.owner !== g.playerFaction) {
        return { game, message: "只能在自己的城里招募。" };
      }
      if (city.doneRecruit) return { game, message: "本城本月已寻访过。" };

      const pool = g.generals.filter(
        (x) => x.cityId === null && x.seek === cityId && !x.captured,
      );
      if (!pool.length) {
        g.cities.find((c) => c.id === cityId).doneRecruit = true;
        return { game: g, message: `${city.name} 暂无在野贤才。` };
      }

      const inCity = generalsIn(g, cityId);
      const bestInt = inCity.length ? Math.max(...inCity.map((x) => x.int)) : 50;
      const ownedCount = ownerCities(g, g.playerFaction).length;
      const rate = clamp(0.28 + (bestInt - 50) * 0.006 + (ownedCount - 1) * 0.03, 0.1, 0.92);

      /* 取该城最难得的（智力最高）在野武将先试 */
      const target = pool.slice().sort((a, b) => b.int - a.int)[0];
      g.cities.find((c) => c.id === cityId).doneRecruit = true;

      if (roll(rate)) {
        const gen = g.generals.find((x) => x.key === target.key);
        gen.cityId = cityId;
        gen.captured = false;
        gen.loyalty = 70;
        g.recruitLog.push(`${gen.name} 加入 ${ALL_FACTIONS[g.playerFaction].name}。`);
        return {
          game: g,
          message: `登用成功：${target.name}（武 ${target.war} / 智 ${target.int}）归顺！`,
        };
      }

      g.recruitLog.push(`${target.name} 婉拒了招揽。`);
      return {
        game: g,
        message: `${target.name} 婉拒了招揽（成功率 ${Math.round(rate * 100)}%）。`,
      };
    }

    /* ---------------------------------------------------------------- 内政 */

    function doDomestic(game, cityId, kind) {
      const g = clone(game);
      const city = cityById(g, cityId);
      if (!city || city.doneDomestic) return { game, message: "本城本月已做过内政。" };
      let message = "";

      if (kind === "farm") {
        if (city.gold < 150) return { game, message: "金不足 150。" };
        city.gold -= 150;
        const up = Math.round(rand(3, 6));
        city.agri = clamp(city.agri + up, 0, 100);
        message = `开垦：${city.name} 农业 +${up}（现 ${city.agri}）。`;
      } else if (kind === "trade") {
        if (city.gold < 150) return { game, message: "金不足 150。" };
        city.gold -= 150;
        const up = Math.round(rand(3, 6));
        city.comm = clamp(city.comm + up, 0, 100);
        message = `商业：${city.name} 商业 +${up}（现 ${city.comm}）。`;
      } else if (kind === "draft") {
        const cost = 200;
        if (city.gold < cost) return { game, message: "金不足 200，无法征兵。" };
        city.gold -= cost;
        const add = Math.round(1200 + city.comm * 20 + rand(0, 400));
        city.troops += add;
        message = `征兵：${city.name} 得兵 ${fmt(add)}（现 ${fmt(city.troops)}）。`;
      } else if (kind === "drill") {
        if (city.gold < 100) return { game, message: "金不足 100。" };
        city.gold -= 100;
        const up = Math.round(rand(5, 9));
        city.morale = clamp(city.morale + up, 0, 100);
        message = `训练：${city.name} 士气 +${up}（现 ${city.morale}）。`;
      } else if (kind === "wall") {
        if (city.gold < 180) return { game, message: "金不足 180。" };
        city.gold -= 180;
        const up = Math.round(rand(4, 7));
        city.wall = clamp(city.wall + up, 0, 100);
        message = `筑城：${city.name} 城防 +${up}（现 ${city.wall}）。`;
      } else {
        return { game, message: "未知的内政。" };
      }

      city.doneDomestic = true;
      return { game: g, message };
    }

    /* ---------------------------------------------------------------- 战斗 */

    /**
     * 出征结算。纯函数 —— 返回新 state 与一份战报。
     *
     * 模型（《三国志II 霸王的大陆》一脉）：
     *   1. 智力 → 计略命中与火计伤害；武力 → 每回合杀伤；统率 → 带兵上限；城防 → 守方减伤。
     *   2. 计略只放一次，然后进入最多 8 回合的鏖战，双方同时结算伤害。
     *   3. 任一方兵力跌破出阵时的三成即溃败。
     */
    function doBattle(game, opts) {
      const g = clone(game);
      const from = cityById(g, opts.fromId);
      const target = cityById(g, opts.targetId);
      const attacker = generalOf(g, opts.generalKey);
      const defender = bestDefender(g, opts.targetId);
      const lines = [];

      if (!from || !target || !attacker) {
        return { game, report: { lines: ["出征条件不足。"], win: false }, message: "出征条件不足。" };
      }

      /* 目标合法性。UI 只列相邻敌城，但 doBattle 是导出的纯函数，
         任何调用方（脚本、未来入口）都能传任意城池 —— 不在这里挡住，
         就会出现「徐州直取成都」「徐州打徐州」这种越过地图的出征。 */
      if (target.id === from.id) {
        return { game, report: { lines: ["不能攻打自己所在的城池。"], win: false }, message: "目标不合法。" };
      }
      if (target.owner === from.owner) {
        return {
          game,
          report: { lines: [`${target.name} 本属 ${ALL_FACTIONS[target.owner] ? ALL_FACTIONS[target.owner].name : target.owner}，是自己人的城。`], win: false },
          message: "目标不合法。",
        };
      }
      if (!from.adj.includes(target.id)) {
        return {
          game,
          report: { lines: [`${from.name} 与 ${target.name} 并不相邻，无法出兵。`], win: false },
          message: "目标不合法。",
        };
      }
      if (attacker.cityId !== from.id) {
        return {
          game,
          report: { lines: [`${attacker.name} 此刻并不在 ${from.name}，不能由此出征。`], win: false },
          message: "武将不在该城。",
        };
      }

      /* 出兵数取「申请数 / 城中实有 / 主将统率上限」三者最小。
         早期写法是 Math.max(500, Math.min(...))：城中兵为 0 时 min 得 0，
         再被 max 抬成 500，于是扣兵把城池扣成负数，还能靠幽灵兵无尽出征。 */
      const canSend = Math.min(from.troops, maxLead(attacker));
      if (canSend < 500) {
        return {
          game,
          report: { lines: [`${from.name} 兵力不足 500，无法出征。`], win: false },
          message: "兵力不足。",
        };
      }
      const atkTroops = Math.max(500, Math.min(opts.troops, canSend));
      from.troops -= atkTroops;
      from.doneMarch = true;

      const defTroops = target.troops;
      const defWar = defender ? defender.war : 50;
      const defInt = defender ? defender.int : 50;
      const defName = defender ? defender.name : "守将";
      const defTroops0 = Math.max(defTroops, 1);

      lines.push(
        `${attacker.name} 引兵 ${fmt(atkTroops)} 自 ${from.name} 出兵，直取 ${target.name}。`,
      );
      lines.push(
        `守将 ${defName}（武 ${defWar} / 智 ${defInt}）闭城坚守，守军 ${fmt(defTroops)}，城防 ${target.wall}。`,
      );

      let atk = atkTroops;
      let def = defTroops;
      let defMorale = target.morale;
      let wallFactor = 1 + target.wall / WALL_DIV;
      let ambushRounds = 0;

      /* ---- 计略 ---- */
      if (opts.tactic && opts.tactic !== "none") {
        const t = TACTICS[opts.tactic];
        if (t && attacker.int >= t.need) {
          const gap = attacker.int - defInt;
          const isZhuge = attacker.key === "zhugeliang" || attacker.int >= 100;

          if (opts.tactic === "fire") {
            const chance = isZhuge ? 1 : clamp(0.42 + gap * 0.009, 0.1, 0.95);
            if (roll(chance)) {
              let ratio = 0.14 + Math.max(0, gap) * 0.0025;
              if (isZhuge) ratio *= 2;
              const burn = Math.max(300, Math.round(def * ratio));
              def = Math.max(0, def - burn);
              lines.push(
                isZhuge
                  ? `火计必中！${attacker.name} 祭起东风，${target.name} 城中烈焰冲天，守军折损 ${fmt(burn)}。`
                  : `火计得手！${target.name} 火起，守军折损 ${fmt(burn)}。`,
              );
            } else {
              lines.push(`火计失算，${defName} 早有防备，火头未起便被扑灭。`);
            }
          } else if (opts.tactic === "ambush") {
            const chance = clamp(0.38 + gap * 0.006, 0.08, 0.9);
            if (roll(chance)) {
              ambushRounds = 3;
              lines.push(`伏兵四起！${target.name} 城外伏兵杀出，守军阵脚大乱。`);
            } else {
              lines.push(`伏兵被识破，${defName} 按兵不动，伏兵无功而返。`);
            }
          } else if (opts.tactic === "discord") {
            const chance = clamp(0.34 + gap * 0.006, 0.08, 0.9);
            if (roll(chance)) {
              defMorale = clamp(defMorale - 25, 0, 100);
              wallFactor = 1 + target.wall / WALL_DIV_DISCORD;
              lines.push(`离间计成！${target.name} 军心浮动，士气大跌，城门内应四起。`);
            } else {
              lines.push(`离间计未成，${defName} 斩了说客，守军愈发同仇敌忾。`);
            }
          }
        } else {
          lines.push(`${attacker.name} 智力不足以施展${t ? t.name : "计略"}。`);
        }
      }

      /* ---- 鏖战 ---- */
      const atkMoraleF = () => 0.85 + from.morale / 300;
      const defMoraleF = () => 0.85 + defMorale / 300;
      const atkRout = atkTroops * ROUT_RATIO;
      const defRout = defTroops0 * ROUT_RATIO;

      let round = 0;
      while (round < MAX_BATTLE_ROUNDS && atk > atkRout && def > defRout) {
        round += 1;
        const jitter = () => rand(1 - DMG_JITTER, 1 + DMG_JITTER);
        const atkDmg =
          atk * (DMG_BASE + attacker.war / DMG_WAR_DIV) * atkMoraleF() * jitter();
        let defDmg =
          def * (DMG_BASE + defWar / DMG_WAR_DIV) * defMoraleF() * wallFactor * jitter();
        if (ambushRounds > 0) {
          defDmg *= 0.5;
          ambushRounds -= 1;
        }
        def = Math.max(0, def - atkDmg);
        atk = Math.max(0, atk - defDmg);

        lines.push(
          `第 ${round} 回合：${attacker.name} 部斩敌 ${fmt(atkDmg)}，自损 ${fmt(defDmg)}。` +
            `（我军 ${fmt(atk)} / 守军 ${fmt(def) }）`,
        );
      }

      const win = def <= defRout || def <= 0;
      let capturedGeneral = null;

      if (win) {
        lines.push(`${target.name} 守军溃散！${attacker.name} 破城而入。`);
        const survivors = Math.max(0, Math.round(atk));
        const oldOwner = target.owner;

        target.owner = from.owner;
        target.troops = survivors;
        target.morale = clamp(target.morale - 10, 20, 100);
        target.doneDomestic = true;
        target.doneMarch = true;
        attacker.cityId = target.id;

        /* 守将：降 or 逃 */
        const losers = g.generals.filter((x) => x.cityId === target.id && x.key !== attacker.key);
        losers.forEach((gen) => {
          if (roll(0.45)) {
            gen.cityId = target.id;
            gen.captured = false;
            lines.push(`${gen.name} 力竭被擒，愿降。`);
            if (!capturedGeneral) capturedGeneral = gen.name;
          } else {
            gen.cityId = null;
            gen.captured = true;
            lines.push(`${gen.name} 单骑突围，不知所终。`);
          }
        });

        lines.push(
          `${ALL_FACTIONS[from.owner].name} 取 ${target.name}（原属 ${ALL_FACTIONS[oldOwner].name}），余兵 ${fmt(survivors)}。`,
        );
      } else {
        lines.push(`久攻不下，${attacker.name} 鸣金收兵。`);
        if (atk <= 0) {
          attacker.troops = 0;
          lines.push(`${attacker.name} 全军覆没，仅以身免。`);
        }
        from.troops += Math.max(0, Math.round(atk));
        target.troops = Math.max(0, Math.round(def));
        target.morale = clamp(target.morale + 2, 0, 100);
        lines.push(`守军尚存 ${fmt(target.troops)}，${target.name} 仍归 ${ALL_FACTIONS[target.owner].name}。`);
      }

      /* 战败突围、标记 captured 的将领从此消失。
         注意必须用 captured 判定，不能按 cityId == null 过滤 ——
         在野武将（尚未被招募）的 cityId 本来就是 null，那样会把
         整个在野人才池一并删掉，招募功能随即失效。 */
      g.generals = g.generals.filter((x) => x.cityId != null || !x.captured);

      g.outcome = checkOutcome(g);
      return {
        game: g,
        report: {
          lines,
          win,
          attacker: attacker.name,
          targetId: target.id,
          targetName: target.name,
          captured: capturedGeneral,
        },
      };
    }

    function checkOutcome(game) {
      const p = ownerCities(game, game.playerFaction).length;
      if (p === game.cities.length) return "win";
      if (p === 0) return "lose";
      return null;
    }

    /* ------------------------------------------------------------------ AI */

    function aiTurn(game) {
      let g = clone(game);
      const log = [];

      /* 参战势力来自本局年代（189 年会有董卓、袁绍），不是固定三家 */
      (g.factions || ["cao", "liu", "sun"])
        .filter((f) => f !== g.playerFaction)
        .forEach((faction) => {
        /* 内政 */
        ownerCities(g, faction).forEach((city) => {
          if (city.doneDomestic) return;
          if (city.gold >= 200 && city.troops < AI_DRAFT_THRESHOLD) {
            const r = doDomestic(g, city.id, "draft");
            if (r.game !== g) {
              g = r.game;
              log.push(`[${ALL_FACTIONS[faction].name}] ${r.message}`);
            }
          } else if (city.gold >= 150 && city.comm < 70) {
            const r = doDomestic(g, city.id, "trade");
            if (r.game !== g) {
              g = r.game;
              log.push(`[${ALL_FACTIONS[faction].name}] ${r.message}`);
            }
          } else if (city.gold >= 150 && city.agri < 70) {
            const r = doDomestic(g, city.id, "farm");
            if (r.game !== g) {
              g = r.game;
              log.push(`[${ALL_FACTIONS[faction].name}] ${r.message}`);
            }
          } else if (city.gold >= 100 && city.morale < 75) {
            const r = doDomestic(g, city.id, "drill");
            if (r.game !== g) {
              g = r.game;
              log.push(`[${ALL_FACTIONS[faction].name}] ${r.message}`);
            }
          }
        });

        /* 出兵：每个势力每月至多一次，且必须有明显兵力优势。
           早期版本每城 45% 独立开战，曹操四城一月能打四次，玩家撑不过一年。 */
        if (!roll(AI_ATTACK_CHANCE)) return;

        const sources = ownerCities(g, faction).filter((c) => !c.doneMarch && c.troops > 5000);
        const candidates = [];
        sources.forEach((src) => {
          src.adj
            .map((id) => cityById(g, id))
            .filter((c) => c && c.owner !== faction)
            .forEach((tgt) => {
              const list = generalsIn(g, src.id);
              if (!list.length) return;
              const lead = list.slice().sort((a, b) => b.lead - a.lead)[0];
              const send = Math.min(src.troops, maxLead(lead));
              const need = tgt.troops * (1 + tgt.wall / WALL_DIV);
              if (send < need * AI_ADVANTAGE || send < AI_MIN_SEND) return;
              candidates.push({ src, tgt, lead, send, margin: send / Math.max(need, 1) });
            });
        });
        if (!candidates.length) return;

        candidates.sort((a, b) => b.margin - a.margin);
        const pick = candidates[0];
        let tactic = "none";
        if (pick.lead.int >= 80 && roll(0.6)) tactic = "fire";
        else if (pick.lead.int >= 70 && roll(0.4)) tactic = "discord";
        else if (pick.lead.int >= 60 && roll(0.35)) tactic = "ambush";

        const res = doBattle(g, {
          fromId: pick.src.id,
          targetId: pick.tgt.id,
          generalKey: pick.lead.key,
          troops: pick.send,
          tactic,
        });
        g = res.game;
        log.push(`[${ALL_FACTIONS[faction].name}]`);
        res.report.lines.forEach((l) => log.push("  " + l));
      });

      return { game: g, log };
    }

    /* -------------------------------------------------------------- 回合推进 */

    function endTurn(game) {
      let g = clone(game);

      /* AI 行动 */
      const ai = aiTurn(g);
      g = ai.game;
      const aiLog = ai.log;

      /* 换月 */
      g.month += 1;
      if (g.month > 11) {
        g.month = 0;
        g.year += 1;
      }
      g.turn += 1;

      /* 收入与消耗 */
      g.cities.forEach((city) => {
        if (!(g.factions || []).includes(city.owner)) return;
        city.gold += Math.round(city.comm * 7 + 120);
        const harvest = Math.round(city.agri * 14 + 200);
        city.food += harvest - Math.round(city.troops / 100);
        if (city.food < 0) {
          const desert = Math.min(city.troops, Math.round(-city.food * 0.5));
          city.troops -= desert;
          city.morale = clamp(city.morale - 8, 0, 100);
          city.food = 0;
          if (desert > 0) aiLog.push(`${city.name} 军粮断绝，逃亡 ${fmt(desert)} 兵。`);
        }
        city.doneDomestic = false;
        city.doneMarch = false;
        city.doneRecruit = false;
      });

      g.outcome = checkOutcome(g);
      return { game: g, log: aiLog };
    }

    /* ---------------------------------------------------------------- 存档 */

    function saveGame(game) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
      } catch {
        /* 配额满或被禁用：游戏继续，只是不持久化 */
      }
    }

    function loadGame() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        /* v1 存档没有 playerFaction 字段，v2 没有 eraId —— 都作废重开。
           宁可丢一次存档，也不能让「选曹操却按刘备结算」「年代错位」复活。 */
        if (!parsed || parsed.version !== 3 || !Array.isArray(parsed.cities)) return null;
        if (parsed.cities.length !== CITY_DEFS.length) return null;
        if (!ALL_FACTIONS[parsed.playerFaction]) return null;
        if (!parsed.eraId || !ERA_DEFS.some((e) => e.id === parsed.eraId)) return null;
        if (!Array.isArray(parsed.factions) || !parsed.factions.length) return null;
        return parsed;
      } catch {
        return null;
      }
    }

    function clearSave() {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* localStorage 不可用时静默：重开只影响持久化，不影响本局 */
      }
    }

    /* ---------------------------------------------------------------- 样式 */

    const CSS = `
.tk3k-root{position:fixed;inset:0;pointer-events:none;z-index:900;
  --tk3k-accent:#c8a24a;--tk3k-accent-strong:#b8860b;--tk3k-accent-soft:#e3c072;--tk3k-danger:#e0887e;
  font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif}
/* 浅色主题：金色 #c8a24a 压在白底上对比度不足，换成深一档的赭金。 */
body:not([data-ds-dark-theme]) .tk3k-root{--tk3k-accent:#8a6512;--tk3k-accent-strong:#7a5a10;--tk3k-accent-soft:#6f5410;--tk3k-danger:#b4362a}
.tk3k-fab{position:absolute;right:18px;bottom:18px;pointer-events:auto;display:flex;align-items:center;gap:6px;padding:9px 14px 9px 11px;border-radius:999px;cursor:pointer;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));background:var(--dsw-alias-bg-layer-1,#1f1f22);color:var(--dsw-alias-label-primary,#e8e8ea);box-shadow:0 6px 20px rgba(0,0,0,.28);font-size:13px;font-weight:600;letter-spacing:.02em;transition:transform .14s ease,box-shadow .14s ease}
.tk3k-fab:hover{transform:translateY(-1px);box-shadow:0 10px 26px rgba(0,0,0,.34)}
.tk3k-fab:active{transform:translateY(0)}
.tk3k-fab i{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:6px;background:var(--tk3k-accent-strong);color:#fff;font-style:normal;font-size:12px;font-weight:700}
.tk3k-panel{position:absolute;right:16px;bottom:16px;pointer-events:auto;display:flex;flex-direction:column;
  width:min(460px,calc(100vw - 32px));height:min(720px,calc(100vh - 32px));
  border-radius:14px;overflow:hidden;
  background:var(--dsw-alias-bg-layer-1,#1b1b1f);
  border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.3));
  box-shadow:0 18px 52px rgba(0,0,0,.42);
  color:var(--dsw-alias-label-primary,#eceef1);font-size:13px;line-height:1.5}
.tk3k-head{display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.25));background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.03))}
.tk3k-head-t{font-weight:700;letter-spacing:.14em;font-size:13px;color:var(--tk3k-accent)}
.tk3k-head-d{color:var(--dsw-alias-label-secondary,#a2a6ad);font-size:11.5px}
.tk3k-head-sp{flex:1}
.tk3k-x{border:0;background:transparent;color:var(--dsw-alias-label-secondary,#a2a6ad);cursor:pointer;font-size:15px;line-height:1;padding:3px 6px;border-radius:6px}
.tk3k-x:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.16));color:var(--dsw-alias-label-primary,#eceef1)}
.tk3k-map{position:relative;height:196px;flex:0 0 auto;margin:10px 12px 6px;border-radius:10px;overflow:hidden;
  background:radial-gradient(120% 100% at 30% 0%,rgba(184,134,11,.13),transparent 60%),var(--dsw-alias-bg-layer-2,rgba(255,255,255,.03));
  border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.22))}
.tk3k-map svg{position:absolute;inset:0;width:100%;height:100%}
.tk3k-node{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;background:transparent;border:0;padding:0;color:inherit;font:inherit}
.tk3k-node-c{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:13px;font-weight:700;color:#fff;border:2px solid rgba(255,255,255,.55);box-shadow:0 2px 10px rgba(0,0,0,.35);transition:transform .12s ease}
.tk3k-node:hover .tk3k-node-c{transform:scale(1.08)}
.tk3k-node.sel .tk3k-node-c{outline:2px solid var(--tk3k-accent);outline-offset:2px;transform:scale(1.1)}
.tk3k-node-n{font-size:10.5px;font-weight:600;color:var(--dsw-alias-label-primary,#eceef1);text-shadow:0 1px 2px rgba(0,0,0,.45);white-space:nowrap}
.tk3k-node-b{font-size:9.5px;color:var(--dsw-alias-label-secondary,#b6bac1);text-shadow:0 1px 2px rgba(0,0,0,.45);font-variant-numeric:tabular-nums}
/* min-height:0 是必需的：flex column 里子项的默认 min-height:auto 会让它
   拒绝收缩到内容高度以下，于是长内容把 footer 顶出面板、再被 panel 的
   overflow:hidden 裁掉 —— 这就是「显示不全」。 */
.tk3k-body{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:0 12px 8px}
.tk3k-body::-webkit-scrollbar{width:8px}
.tk3k-body::-webkit-scrollbar-thumb{background:rgba(128,128,128,.3);border-radius:4px}
.tk3k-empty{color:var(--dsw-alias-label-tertiary,#8b8f98);font-size:12px;padding:14px 4px;text-align:center}
.tk3k-card{border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.22));border-radius:10px;padding:10px 11px;margin-bottom:8px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.02))}
.tk3k-card-h{display:flex;align-items:baseline;gap:8px;margin-bottom:7px}
.tk3k-card-n{font-size:15px;font-weight:700;letter-spacing:.05em}
.tk3k-tag{font-size:10.5px;padding:1px 6px;border-radius:5px;color:#fff;font-weight:600}
.tk3k-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 8px;font-size:11.5px;margin-bottom:8px}
.tk3k-kv{display:flex;flex-direction:column;gap:1px}
.tk3k-kv b{font-size:13px;font-variant-numeric:tabular-nums;font-weight:600}
.tk3k-kv span{color:var(--dsw-alias-label-tertiary,#8b8f98);font-size:10.5px}
.tk3k-acts{display:flex;flex-wrap:wrap;gap:6px}
.tk3k-btn{border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.05));color:var(--dsw-alias-label-primary,#eceef1);padding:5px 10px;border-radius:7px;font-size:11.5px;cursor:pointer;font-family:inherit;transition:background .12s ease}
.tk3k-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.2))}
.tk3k-btn:disabled{opacity:.42;cursor:not-allowed}
.tk3k-btn.primary{background:var(--tk3k-accent-strong);border-color:var(--tk3k-accent-strong);color:#fff;font-weight:600}
.tk3k-btn.primary:hover:not(:disabled){background:#a57709}
.tk3k-btn.danger{background:rgba(197,72,60,.16);border-color:rgba(197,72,60,.5);color:var(--tk3k-danger)}
.tk3k-gen{display:flex;align-items:center;gap:8px;padding:5px 0;font-size:11.5px;border-top:1px dashed var(--dsw-alias-border-l2,rgba(128,128,128,.18))}
.tk3k-gen:first-child{border-top:0}
.tk3k-gen-n{font-weight:600;min-width:52px}
.tk3k-gen-s{color:var(--dsw-alias-label-tertiary,#8b8f98);font-variant-numeric:tabular-nums}
.tk3k-foot{display:flex;align-items:center;gap:6px;padding:8px 12px;border-top:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.25));background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.03))}
.tk3k-foot-sp{flex:1}
.tk3k-hint{font-size:11px;color:var(--dsw-alias-label-tertiary,#8b8f98);padding:7px 2px;line-height:1.55}
.tk3k-log{font-size:11.5px;line-height:1.72;max-height:none}
.tk3k-log p{margin:0 0 3px;color:var(--dsw-alias-label-secondary,#b6bac1)}
.tk3k-log p.hl{color:var(--tk3k-accent);font-weight:600}
.tk3k-log p.bad{color:var(--tk3k-danger)}
.tk3k-sel{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.tk3k-opt{border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.3));border-radius:8px;padding:6px 9px;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.04));cursor:pointer;font-size:11.5px;color:inherit;font-family:inherit}
.tk3k-opt.on{border-color:var(--tk3k-accent-strong);background:rgba(184,134,11,.16);color:var(--tk3k-accent-soft);font-weight:600}
.tk3k-opt:disabled{opacity:.4;cursor:not-allowed}
.tk3k-range{width:100%;accent-color:var(--tk3k-accent-strong);margin:6px 0 2px}
.tk3k-row{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11.5px;margin-bottom:6px}
.tk3k-row span{color:var(--dsw-alias-label-tertiary,#8b8f98)}
.tk3k-msg{font-size:11.5px;color:var(--tk3k-accent);padding:5px 2px;min-height:16px}
/* ---- 选择势力 ---- */
.tk3k-pick{display:flex;flex-direction:column;gap:10px;padding:16px 12px 20px}
.tk3k-pick-title{margin:0;font-size:16px;letter-spacing:.2em;text-align:center;color:var(--tk3k-accent)}
.tk3k-pick-sub{margin:0 0 6px;font-size:11.5px;line-height:1.75;text-align:center;color:var(--dsw-alias-label-secondary,#a2a6ad)}
/* 分节标题：一条金色短横 + 字 */
.tk3k-pick-sec{display:flex;align-items:center;gap:8px;margin-top:2px;font-size:11px;letter-spacing:.16em;
  color:var(--tk3k-accent-soft);font-weight:600}
.tk3k-pick-sec:before{content:"";flex:none;width:14px;height:1px;background:var(--tk3k-accent);opacity:.7}
/* 年代选择：两列网格 */
.tk3k-era-row{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.tk3k-era{display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:8px 10px;border-radius:8px;cursor:pointer;
  background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.03));border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.22));
  color:var(--dsw-alias-label-secondary,#a2a6ad);text-align:left;transition:border-color .14s ease,background .14s ease,transform .14s ease}
.tk3k-era:hover{transform:translateY(-1px);border-color:var(--tk3k-accent-soft)}
.tk3k-era.on{border-color:var(--tk3k-accent);background:rgba(200,162,74,.1);color:var(--dsw-alias-label-primary,#eceef1)}
.tk3k-era-y{font-size:10px;letter-spacing:.1em;color:var(--tk3k-accent);font-weight:700;line-height:1.2}
.tk3k-era-n{font-size:12px;font-weight:600;letter-spacing:.06em;line-height:1.35}
.tk3k-era-desc{margin:0;font-size:10.5px;line-height:1.7;color:var(--dsw-alias-label-tertiary,#8b8f98)}
.tk3k-era-hint{margin:-4px 0 2px;font-size:10.5px;line-height:1.6;color:var(--tk3k-accent-soft);opacity:.85}
.tk3k-pick-list{display:flex;flex-direction:column;gap:9px}
.tk3k-pick-card{display:flex;flex-direction:column;gap:5px;padding:11px 12px;border-radius:9px;cursor:pointer;text-align:left;
  border:1px solid color-mix(in srgb,var(--faction-color) 45%,var(--dsw-alias-border-l2,#4a4d55));
  background:linear-gradient(100deg,color-mix(in srgb,var(--faction-color) 16%,transparent),transparent 68%);
  color:var(--dsw-alias-label-primary,#e8e9ec);font:inherit;transition:transform .12s,border-color .12s}
.tk3k-pick-card:hover{transform:translateY(-1px);border-color:var(--faction-color)}
.tk3k-pick-head{display:flex;align-items:center;gap:8px}
.tk3k-pick-flag{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;
  font-size:14px;font-weight:700;color:#fff;background:var(--faction-color);flex:none}
.tk3k-pick-name{font-size:14px;font-weight:700;letter-spacing:.08em}
.tk3k-pick-lv{margin-left:auto;flex:none;font-size:10.5px;line-height:1;padding:3px 7px;
  border-radius:999px;border:1px solid currentColor;color:var(--faction-color);opacity:.85}
.tk3k-pick-desc{font-size:11px;line-height:1.65;color:var(--dsw-alias-label-secondary,#a2a6ad)}
.tk3k-pick-stats{display:flex;gap:12px;font-size:10.5px;color:var(--dsw-alias-label-tertiary,#8b8f98)}
.tk3k-pick-lead{font-size:10.5px;color:var(--tk3k-accent-soft)}
.tk3k-pick-tip{margin:4px 0 0;font-size:10.5px;line-height:1.7;text-align:center;color:var(--dsw-alias-label-tertiary,#8b8f98)}
.tk3k-banner{display:flex;flex-direction:column;align-items:center;gap:10px;padding:26px 10px;text-align:center}
.tk3k-banner h3{margin:0;font-size:19px;letter-spacing:.12em;color:var(--tk3k-accent)}
.tk3k-banner p{margin:0;font-size:12px;color:var(--dsw-alias-label-secondary,#a2a6ad);line-height:1.7}
`;

    /* ------------------------------------------------------------ 展示组件 */

    function Tag({ faction }) {
      const f = ALL_FACTIONS[faction] || { name: faction, color: "#888" };
      return h(
        "span",
        { className: "tk3k-tag", style: { background: f.color } },
        f.name,
      );
    }

    function KV({ label, value }) {
      return h("div", { className: "tk3k-kv" }, h("b", null, value), h("span", null, label));
    }

    /* ------------------------------------------------------------------ 主体 */

    function ThreeKingdomsOverlay() {
      const [open, setOpen] = useState(false);
      /* game 为 null = 还没选势力。开局必须先过「选择势力」这一屏，
         旧版本直接从 loadGame() 起步，新玩家永远看不到选势力入口。 */
      const [game, setGame] = useState(() => loadGame());
      const [screen, setScreen] = useState("map"); /* map | city | march | report */
      const [cityId, setCityId] = useState("xuzhou");
      const [targetId, setTargetId] = useState(null);
      const [generalKey, setGeneralKey] = useState(null);
      const [troops, setTroops] = useState(0);
      const [tactic, setTactic] = useState("none");
      const [message, setMessage] = useState("");
      const [report, setReport] = useState(null);
      const [log, setLog] = useState([]); /* AI 结算战报 */
      const [confirmReset, setConfirmReset] = useState(false);
      /* 选择年代：默认「卧龙出山」（207 年），这是最接近大众印象的三国开局 */
      const [pickEra, setPickEra] = useState("207");
      const bodyRef = useRef(null);

      /* 自动存档：每次状态变化落一次（未选势力时不写，否则会存成 null） */
      useEffect(() => {
        if (game) saveGame(game);
      }, [game]);

      /* game 为 null（尚未选势力）时下面这些派生值不能炸。hook 必须无条件
         调用，所以不能用 early return，只能把空值一路往下传，最后在 body()
         里统一分流到「选择势力」屏。 */
      const selected = game ? cityById(game, cityId) || game.cities[0] : null;
      const myFaction = game ? game.playerFaction : "liu";
      const isPlayerCity = selected && selected.owner === myFaction;
      const myGenerals = selected ? generalsIn(game, selected.id) : [];

      const playerGold = game ? ownerCities(game, myFaction).reduce((s, c) => s + c.gold, 0) : 0;
      const playerFood = game ? ownerCities(game, myFaction).reduce((s, c) => s + c.food, 0) : 0;
      const playerTroops = game ? ownerCities(game, myFaction).reduce((s, c) => s + c.troops, 0) : 0;

      /* ---------------- 动作 ---------------- */

      const act = useCallback(
        (kind) => {
          if (!game || !selected) return;
          const res = doDomestic(game, selected.id, kind);
          if (res.game === game) {
            setMessage(res.message);
            return;
          }
          setGame(res.game);
          setMessage(res.message);
        },
        [game, selected],
      );

      const openMarch = useCallback(() => {
        if (!game || !selected) return;
        const targets = selected.adj
          .map((id) => cityById(game, id))
          .filter((c) => c && c.owner !== myFaction);
        if (!targets.length) {
          setMessage("此城周围已无敌方城池。");
          return;
        }
        if (selected.troops < 1000) {
          setMessage("城中兵力不足 1000，无法出征。");
          return;
        }
        if (!myGenerals.length) {
          setMessage("城中无将，无法出征。");
          return;
        }
        const t = targets.slice().sort((a, b) => a.troops - b.troops)[0];
        const g = myGenerals.slice().sort((a, b) => b.lead - a.lead)[0];
        setTargetId(t.id);
        setGeneralKey(g.key);
        setTroops(Math.min(selected.troops, maxLead(g)));
        setTactic("none");
        setScreen("march");
        setMessage("");
      }, [game, selected, myGenerals]);

      const launch = useCallback(() => {
        if (!game || !selected) return;
        const res = doBattle(game, {
          fromId: selected.id,
          targetId,
          generalKey,
          troops,
          tactic,
        });
        setGame(res.game);
        setReport(res.report);
        setLog([]);
        setScreen("report");
        setMessage("");
      }, [game, selected, targetId, generalKey, troops, tactic]);

      const nextTurn = useCallback(() => {
        if (!game) return;
        const res = endTurn(game);
        setGame(res.game);
        setLog(res.log || []);
        setScreen("map");
        setMessage("");
        if (res.game.outcome) {
          /* 结局交给顶部横幅渲染 */
        }
      }, [game]);

      /* 重开 = 回到选势力屏，而不是直接开新局 —— 否则想换势力还得清缓存 */
      const resetGame = useCallback(() => {
        clearSave();
        setGame(null);
        setScreen("map");
        setReport(null);
        setLog([]);
        setMessage("");
        setConfirmReset(false);
      }, []);

      /* 选定势力后建局 */
      const startFaction = useCallback((fid, eraId) => {
        const g = createGame(fid, eraId || pickEra);
        setGame(g);
        setCityId(ownerCities(g, fid)[0] ? ownerCities(g, fid)[0].id : g.cities[0].id);
        setScreen("map");
        setReport(null);
        setLog([]);
        setMessage("");
      }, [pickEra]);

      /* 招募：每城每月一次 */
      const recruit = useCallback(() => {
        if (!game || !selected) return;
        const res = doRecruit(game, selected.id);
        if (res.game !== game) setGame(res.game);
        setMessage(res.message);
      }, [game, selected]);

      /* ---------------- 渲染片段 ---------------- */

      const renderMap = () => {
        const edges = [];
        const seen = {};
        CITY_DEFS.forEach((c) => {
          (c.adj || []).forEach((t) => {
            const k = [c.id, t].sort().join("~");
            if (seen[k]) return;
            seen[k] = true;
            edges.push([c.id, t]);
          });
        });
        const byId = {};
        CITY_DEFS.forEach((c) => {
          byId[c.id] = c;
        });

        return h(
          "div",
          { className: "tk3k-map" },
          h(
            "svg",
            { viewBox: "0 0 100 100", preserveAspectRatio: "none" },
            edges.map(([a, b2], i) => {
              const A = byId[a];
              const B = byId[b2];
              const ca = cityById(game, a);
              const cb = cityById(game, b2);
              const same = ca && cb && ca.owner === cb.owner;
              return h("line", {
                key: "e" + i,
                x1: A.x,
                y1: A.y,
                x2: B.x,
                y2: B.y,
                stroke: same ? ALL_FACTIONS[ca.owner].color : "rgba(140,140,150,.32)",
                strokeOpacity: same ? 0.45 : 1,
                strokeWidth: 0.45,
                strokeDasharray: same ? "0" : "1.6 1.4",
                vectorEffect: "non-scaling-stroke",
              });
            }),
          ),
          game.cities.map((city) => {
            const f = ALL_FACTIONS[city.owner] || { color: "#888", flag: "?" };
            return h(
              "button",
              {
                key: city.id,
                type: "button",
                className: "tk3k-node" + (city.id === cityId ? " sel" : ""),
                style: { left: city.x + "%", top: city.y + "%" },
                onClick: () => {
                  setCityId(city.id);
                  setScreen("map");
                  setMessage("");
                },
                title: `${city.name} · ${f.flag}`,
              },
              h(
                "span",
                { className: "tk3k-node-c", style: { background: f.color } },
                f.flag,
              ),
              h("span", { className: "tk3k-node-n" }, city.name),
              h("span", { className: "tk3k-node-b" }, fmt(city.troops)),
            );
          }),
        );
      };

      const renderCityCard = () => {
        if (!selected) return null;
        const f = ALL_FACTIONS[selected.owner] || { name: selected.owner };
        return h(
          "div",
          { className: "tk3k-card" },
          h(
            "div",
            { className: "tk3k-card-h" },
            h("span", { className: "tk3k-card-n" }, selected.name),
            h(Tag, { faction: selected.owner }),
            h("span", { style: { flex: 1 } }),
            h(
              "span",
              { style: { fontSize: 11, color: "var(--dsw-alias-label-tertiary,#8b8f98)" } },
              `金 ${fmt(selected.gold)} · 粮 ${fmt(selected.food)}`,
            ),
          ),
          h(
            "div",
            { className: "tk3k-grid" },
            h(KV, { label: "兵力", value: fmt(selected.troops) }),
            h(KV, { label: "城防", value: selected.wall }),
            h(KV, { label: "士气", value: selected.morale }),
            h(KV, { label: "农业", value: selected.agri }),
            h(KV, { label: "商业", value: selected.comm }),
            h(KV, { label: "武将", value: myGenerals.length }),
          ),
          myGenerals.length
            ? h(
                "div",
                null,
                myGenerals.map((g) =>
                  h(
                    "div",
                    { className: "tk3k-gen", key: g.key },
                    h("span", { className: "tk3k-gen-n" }, g.name),
                    h("span", { className: "tk3k-gen-s" }, `武 ${g.war}`),
                    h("span", { className: "tk3k-gen-s" }, `智 ${g.int}`),
                    h("span", { className: "tk3k-gen-s" }, `统 ${g.lead}`),
                    h("span", { style: { flex: 1 } }),
                    h(
                      "span",
                      { style: { fontSize: 10.5, color: "var(--dsw-alias-label-tertiary,#8b8f98)" } },
                      `可带 ${fmt(maxLead(g))}`,
                    ),
                  ),
                ),
              )
            : h(
                "div",
                { className: "tk3k-hint" },
                "城中无将 —— 无将之城无法出征，只能被动挨打。",
              ),
          isPlayerCity
            ? h(
                "div",
                { className: "tk3k-acts", style: { marginTop: 8 } },
                h(
                  "button",
                  {
                    type: "button",
                    className: "tk3k-btn",
                    disabled: selected.doneDomestic,
                    onClick: () => act("farm"),
                  },
                  "开垦",
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "tk3k-btn",
                    disabled: selected.doneDomestic,
                    onClick: () => act("trade"),
                  },
                  "商业",
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "tk3k-btn",
                    disabled: selected.doneDomestic,
                    onClick: () => act("draft"),
                  },
                  "征兵",
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "tk3k-btn",
                    disabled: selected.doneDomestic,
                    onClick: () => act("drill"),
                  },
                  "训练",
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "tk3k-btn",
                    disabled: selected.doneDomestic,
                    onClick: () => act("wall"),
                  },
                  "筑城",
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "tk3k-btn",
                    disabled: selected.doneRecruit,
                    onClick: recruit,
                    title: "招揽本城在野贤才，每城每月一次",
                  },
                  "招募",
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "tk3k-btn primary",
                    disabled: selected.doneMarch,
                    onClick: openMarch,
                  },
                  "出征",
                ),
              )
            : h(
                "div",
                { className: "tk3k-hint" },
                `此城属 ${f.name}，需先出兵攻取。`,
              ),
        );
      };

      const renderMarch = () => {
        const tgt = cityById(game, targetId);
        const gen = generalOf(game, generalKey);
        if (!tgt || !gen || !selected) return h("div", { className: "tk3k-empty" }, "出征条件不足。");
        const targets = selected.adj
          .map((id) => cityById(game, id))
          .filter((c) => c && c.owner !== myFaction);
        const cap = Math.min(selected.troops, maxLead(gen));
        const t = TACTICS[tactic] || TACTICS.none;
        const canTactic = gen.int >= t.need;

        return h(
          "div",
          null,
          h(
            "div",
            { className: "tk3k-card" },
            h(
              "div",
              { className: "tk3k-card-h" },
              h("span", { className: "tk3k-card-n" }, `${selected.name} → ${tgt.name}`),
              h(Tag, { faction: tgt.owner }),
              h("span", { style: { flex: 1 } }),
              h(
                "span",
                { style: { fontSize: 11, color: "var(--dsw-alias-label-tertiary,#8b8f98)" } },
                `守军 ${fmt(tgt.troops)} · 城防 ${tgt.wall}`,
              ),
            ),
            h("div", { className: "tk3k-row" }, h("span", null, "目标城池"), h("span", null, "")),
            h(
              "div",
              { className: "tk3k-sel" },
              targets.map((c) =>
                h(
                  "button",
                  {
                    key: c.id,
                    type: "button",
                    className: "tk3k-opt" + (c.id === targetId ? " on" : ""),
                    onClick: () => setTargetId(c.id),
                  },
                  `${c.name} · ${fmt(c.troops)}`,
                ),
              ),
            ),
            h("div", { className: "tk3k-row" }, h("span", null, "出征武将（统率决定带兵上限）"), h("span", null, "")),
            h(
              "div",
              { className: "tk3k-sel" },
              myGenerals.map((g) =>
                h(
                  "button",
                  {
                    key: g.key,
                    type: "button",
                    className: "tk3k-opt" + (g.key === generalKey ? " on" : ""),
                    onClick: () => {
                      setGeneralKey(g.key);
                      setTroops(Math.min(selected.troops, maxLead(g)));
                    },
                  },
                  `${g.name} 武${g.war}/智${g.int}`,
                ),
              ),
            ),
            h(
              "div",
              { className: "tk3k-row" },
              h("span", null, "出阵兵力"),
              h("b", { style: { fontVariantNumeric: "tabular-nums" } }, `${fmt(troops)} / 上限 ${fmt(cap)}`),
            ),
            h("input", {
              type: "range",
              className: "tk3k-range",
              min: 1000,
              max: Math.max(1000, cap),
              step: 500,
              value: Math.min(troops, Math.max(1000, cap)),
              onChange: (e) => setTroops(Number(e.target.value)),
            }),
            h(
              "div",
              { className: "tk3k-row" },
              h(
                "span",
                null,
                selected.troops - troops < 2000
                  ? "⚠ 留兵不足 2000，城防空虚"
                  : `留兵 ${fmt(selected.troops - troops)} 守城`,
              ),
              h("span", null, ""),
            ),
          ),
          h(
            "div",
            { className: "tk3k-card" },
            h("div", { className: "tk3k-row" }, h("span", null, "计略（智谋定成败）"), h("span", null, "")),
            h(
              "div",
              { className: "tk3k-sel" },
              Object.keys(TACTICS).map((k) => {
                const tt = TACTICS[k];
                return h(
                  "button",
                  {
                    key: k,
                    type: "button",
                    className: "tk3k-opt" + (tactic === k ? " on" : ""),
                    disabled: gen.int < tt.need,
                    onClick: () => setTactic(k),
                    title: tt.desc,
                  },
                  tt.name + (tt.need ? `（智≥${tt.need}）` : ""),
                );
              }),
            ),
            h(
              "div",
              { className: "tk3k-hint" },
              canTactic
                ? t.desc
                : `${gen.name} 智力 ${gen.int}，不足以施展${t.name}。`,
            ),
          ),
          h(
            "div",
            { className: "tk3k-acts" },
            h("button", { type: "button", className: "tk3k-btn primary", onClick: launch }, "开战"),
            h(
              "button",
              {
                type: "button",
                className: "tk3k-btn",
                onClick: () => {
                  setScreen("map");
                  setMessage("");
                },
              },
              "取消",
            ),
          ),
        );
      };

      const renderReport = () => {
        if (!report) return h("div", { className: "tk3k-empty" }, "暂无战报。");
        return h(
          "div",
          null,
          h(
            "div",
            { className: "tk3k-card" },
            h(
              "div",
              { className: "tk3k-card-h" },
              h(
                "span",
                { className: "tk3k-card-n" },
                report.win ? `${report.targetName} 大捷` : `${report.targetName} 攻城受阻`,
              ),
              h(
                "span",
                { className: "tk3k-tag", style: { background: report.win ? "#3f9e6a" : "#8a5a2b" } },
                report.win ? "克城" : "退兵",
              ),
            ),
            h(
              "div",
              { className: "tk3k-log" },
              report.lines.map((line, i) =>
                h(
                  "p",
                  {
                    key: i,
                    className: /火计得手|火计必中|溃散|破城|被擒|离间计成|伏兵四起/.test(line)
                      ? "hl"
                      : /失算|识破|未成|覆没|收兵/.test(line)
                        ? "bad"
                        : "",
                  },
                  line,
                ),
              ),
            ),
          ),
          h(
            "div",
            { className: "tk3k-acts" },
            h(
              "button",
              {
                type: "button",
                className: "tk3k-btn primary",
                onClick: () => {
                  if (report.targetId) setCityId(report.targetId);
                  setScreen("map");
                  setReport(null);
                },
              },
              "确定",
            ),
          ),
        );
      };

      const renderMapBody = () => {
        const parts = [renderCityCard()];
        if (log && log.length) {
          parts.push(
            h(
              "div",
              { className: "tk3k-card", key: "ailog" },
              h("div", { className: "tk3k-card-h" }, h("span", { className: "tk3k-card-n", style: { fontSize: 13 } }, "上月战报")),
              h(
                "div",
                { className: "tk3k-log" },
                log.map((line, i) =>
                  h(
                    "p",
                    { key: i, className: /大捷|破城|克城/.test(line) ? "hl" : "" },
                    line,
                  ),
                ),
              ),
            ),
          );
        }
        return parts;
      };

      /* ---------------- 主渲染 ---------------- */

      /* ---- 选择势力：没有存档时的第一屏 ---- */
      const renderFactionPick = () => {
        const era = eraById(pickEra);
        const ids = factionsOf(era);
        /* 直接用真实建局结果统计，而不是拿静态 CITY_DEFS / GENERAL_DEFS 数 ——
           年代调位（189 年曹操挪去许昌、214 年关羽移镇襄阳）只有建局后才知道，
           静态表算出来的「城 N 将 M」会和实际开局对不上。 */
        const preview = createGame(factionsOf(era)[0], era.id);

        return h(
          "div",
          { className: "tk3k-pick" },
          h("h2", { className: "tk3k-pick-title" }, "选择年代与势力"),

          /* ---- 第一步：年代 ---- */
          h("div", { className: "tk3k-pick-sec" }, "一、选择年代"),
          h(
            "div",
            { className: "tk3k-era-row" },
            ERA_DEFS.map((e) =>
              h(
                "button",
                {
                  type: "button",
                  key: e.id,
                  className: "tk3k-era" + (e.id === pickEra ? " on" : ""),
                  onClick: () => setPickEra(e.id),
                },
                h("span", { className: "tk3k-era-y" }, `${e.year}`),
                h("span", { className: "tk3k-era-n" }, e.name),
              ),
            ),
          ),
          h("p", { className: "tk3k-era-desc" }, era.desc),
          h(
            "p",
            { className: "tk3k-era-hint" },
            era.id === "189"
              ? "乱世：六家争雄。董卓挟天子兵最盛，曹操袁绍各据一城，刘备尚无寸土。"
              : era.id === "200"
                ? "对峙：曹操四城对袁绍河北，两强相争。"
                : era.id === "207"
                  ? "经典：曹操已并河北，刘备孙权偏安，标准开局。"
                  : "三分：曹操势大，刘备得蜀，孙权孤悬。",
          ),

          /* ---- 第二步：势力（随年代变） ---- */
          h("div", { className: "tk3k-pick-sec" }, "二、选择势力"),
          h(
            "div",
            { className: "tk3k-pick-list" },
            ids.map((fid) => {
              const f = ALL_FACTIONS[fid];
              const mine = preview.cities.filter((c) => c.owner === fid);
              const mineIds = mine.map((c) => c.id);
              const gens = preview.generals.filter((g) => g.cityId && mineIds.indexOf(g.cityId) >= 0);
              const lead = gens.slice().sort((a, b) => b.int - a.int)[0];
              const troops = mine.reduce((n, c) => n + (c.troops || 0), 0);
              return h(
                "button",
                {
                  type: "button",
                  key: fid,
                  className: "tk3k-pick-card",
                  style: { "--faction-color": f.color },
                  onClick: () => startFaction(fid, era.id),
                },
                h(
                  "div",
                  { className: "tk3k-pick-head" },
                  h("span", { className: "tk3k-pick-flag" }, f.family),
                  h("span", { className: "tk3k-pick-name" }, f.name),
                ),
                h("div", { className: "tk3k-pick-desc" }, f.desc),
                h(
                  "div",
                  { className: "tk3k-pick-stats" },
                  h("span", null, `城 ${mine.length}`),
                  h("span", null, `将 ${gens.length}`),
                  h("span", null, `兵 ${fmt(troops)}`),
                ),
                lead
                  ? h(
                      "div",
                      { className: "tk3k-pick-lead" },
                      `主谋 ${lead.name}（智 ${lead.int}）`,
                    )
                  : null,
              );
            }),
          ),
          h(
            "p",
            { className: "tk3k-pick-tip" },
            "提示：年代决定天下格局与登场武将；智力越高火计越准，武力越高鏖战越狠。",
          ),
        );
      };

      const body = () => {
        if (!game) return renderFactionPick();
        if (game.outcome === "win") {
          return h(
            "div",
            { className: "tk3k-banner" },
            h("h3", null, "天下一统"),
            h("p", null, `建安 ${game.year - 196} 年，${ALL_FACTIONS[game.playerFaction].name} 尽取八城，四海归一。`),
            h(
              "button",
              { type: "button", className: "tk3k-btn primary", onClick: resetGame },
              "再来一局",
            ),
          );
        }
        if (game.outcome === "lose") {
          return h(
            "div",
            { className: "tk3k-banner" },
            h("h3", null, "大势已去"),
            h("p", null, "八城尽失，主公败走。天下终归他人之手。"),
            h(
              "button",
              { type: "button", className: "tk3k-btn primary", onClick: resetGame },
              "重整旗鼓",
            ),
          );
        }
        if (screen === "march") return renderMarch();
        if (screen === "report") return renderReport();
        return renderMapBody();
      };

      const footer = () => {
        if (!game) return null;
        if (game.outcome) return null;
        if (screen === "march") return null;
        return h(
          "div",
          { className: "tk3k-foot" },
          h(
            "button",
            { type: "button", className: "tk3k-btn primary", onClick: nextTurn },
            "结束本月",
          ),
          h("span", { className: "tk3k-foot-sp" }),
          confirmReset
            ? h(
                "span",
                { style: { display: "flex", gap: 6 } },
                h(
                  "button",
                  { type: "button", className: "tk3k-btn danger", onClick: resetGame },
                  "确认重开",
                ),
                h(
                  "button",
                  { type: "button", className: "tk3k-btn", onClick: () => setConfirmReset(false) },
                  "取消",
                ),
              )
            : h(
                "button",
                {
                  type: "button",
                  className: "tk3k-btn",
                  onClick: () => setConfirmReset(true),
                },
                "重开",
              ),
        );
      };

      if (!open) {
        return h(
          "div",
          { className: "tk3k-root" },
          h("style", null, CSS),
          h(
            "button",
            {
              type: "button",
              className: "tk3k-fab",
              onClick: () => setOpen(true),
              title: "三国志 · 回合制战略",
            },
            h("i", null, "三"),
            "三国",
          ),
        );
      }

      return h(
        "div",
        { className: "tk3k-root" },
        h("style", null, CSS),
        h(
          "div",
          { className: "tk3k-panel" },
          h(
            "div",
            { className: "tk3k-head" },
            h("span", { className: "tk3k-head-t" }, "三国志"),
            h(
              "span",
              { className: "tk3k-head-d" },
              game ? `${game.year} 年 ${MONTHS[game.month]}月 · 第 ${game.turn} 月` : "群雄割据",
            ),
            h("span", { className: "tk3k-head-sp" }),
            h(
              "span",
              { className: "tk3k-head-d", style: { fontVariantNumeric: "tabular-nums" } },
              `金 ${fmt(playerGold)}  粮 ${fmt(playerFood)}  兵 ${fmt(playerTroops)}`,
            ),
            h(
              "button",
              { type: "button", className: "tk3k-x", onClick: () => setOpen(false), title: "收起" },
              "✕",
            ),
          ),
          !game || game.outcome ? null : renderMap(),
          h("div", { className: "tk3k-body", ref: bodyRef }, body()),
          message && (!game || !game.outcome) ? h("div", { className: "tk3k-msg" }, message) : null,
          footer(),
        ),
      );
    }

    /* ---------------------------------------------------------------- 插件 */

    const inject = ["slots"];

    function apply(ctx) {
      ctx.slots.inject("shell.overlay", () =>
        ctx.slots.register(
          {
            name: "shell.overlay",
            id: "three-kingdoms-strategy",
            order: 60,
            label: () => "三国",
          },
          ThreeKingdomsOverlay,
        ),
      );
    }

    exports.name = NS;
    exports.inject = inject;
    exports.apply = apply;
    exports.__internals = {
      createGame,
      doDomestic,
      doRecruit,
      doBattle,
      endTurn,
      loadGame,
      saveGame,
      CITY_DEFS,
      GENERAL_DEFS,
      TACTICS,
    };

    return module.exports;
  },
});
