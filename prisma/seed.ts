// Prisma 种子数据 - 插入示例化学实验
import { PrismaClient } from "@prisma/client";
import {
  ExperimentCategory,
  ExperimentDifficulty,
} from "../src/server/experiment/types";

const prisma = new PrismaClient();

const experiments = [
  {
    slug: "acid-base-titration",
    title: "酸碱中和滴定",
    description:
      "通过标准盐酸滴定未知浓度的氢氧化钠溶液，借助酸碱指示剂判断终点，掌握定量分析的基本操作。",
    category: ExperimentCategory.ACID_BASE,
    difficulty: ExperimentDifficulty.MEDIUM,
    reagents: ["0.1 mol/L 盐酸标准液", "待测氢氧化钠溶液", "酚酞指示剂"],
    apparatus: ["酸式滴定管", "锥形瓶", "移液管", "铁架台"],
    objectives: [
      "理解中和滴定的原理与终点判断",
      "规范使用滴定管与移液管",
      "计算未知溶液的浓度",
    ],
    estimatedMinutes: 45,
  },
  {
    slug: "metal-acid-reaction",
    title: "金属与酸反应",
    description:
      "观察锌、铁、镁等金属与稀盐酸反应放出氢气的速率差异，比较金属活动性顺序。",
    category: ExperimentCategory.ACID_BASE,
    difficulty: ExperimentDifficulty.EASY,
    reagents: ["稀盐酸", "锌粒", "铁片", "镁条"],
    apparatus: ["试管", "试管架", "镊子", "集气瓶"],
    objectives: [
      "观察金属与酸反应的现象",
      "比较不同金属的活动性强弱",
      "认识氢气的检验方法",
    ],
    estimatedMinutes: 30,
  },
  {
    slug: "solubility-measurement",
    title: "溶解度测定",
    description:
      "在不同温度下测定硝酸钾在水中的溶解度，绘制溶解度曲线，探究温度对溶解度的影响。",
    category: ExperimentCategory.THERMODYNAMICS,
    difficulty: ExperimentDifficulty.HARD,
    reagents: ["硝酸钾固体", "蒸馏水"],
    apparatus: ["烧杯", "温度计", "电子天平", "酒精灯", "玻璃棒"],
    objectives: [
      "掌握溶解度的概念与测定方法",
      "探究温度对固体溶解度的影响",
      "绘制并分析溶解度曲线",
    ],
    estimatedMinutes: 60,
  },
];

async function main() {
  for (const { reagents, apparatus, objectives, ...rest } of experiments) {
    // SQLite 不支持 Json 类型，数组字段序列化为 JSON 字符串存储
    const data = {
      ...rest,
      reagents: JSON.stringify(reagents),
      apparatus: JSON.stringify(apparatus),
      objectives: JSON.stringify(objectives),
    };
    await prisma.experiment.upsert({
      where: { slug: data.slug },
      update: data,
      create: data,
    });
  }
  console.log(`已写入 ${experiments.length} 条示例实验`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
