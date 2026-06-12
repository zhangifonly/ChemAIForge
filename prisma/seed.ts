// Prisma 种子数据 - 从实验目录批量写入全部化学实验，并确保访客用户存在
// 实验定义集中在 src/data/experiments，本脚本只负责序列化与 upsert。
import { PrismaClient } from "@prisma/client";
import { allExperiments } from "../src/data/experiments";
import { ensureGuestUserId } from "../src/server/guest";

const prisma = new PrismaClient();

async function main() {
  // 平台已去登录，会话归属固定访客用户，先确保其存在
  await ensureGuestUserId();

  let count = 0;
  for (const exp of allExperiments) {
    // SQLite 不支持 Json 类型，数组字段序列化为 JSON 字符串存储；
    // probe 仅用于测试与画布演示，不入库。
    const data = {
      slug: exp.slug,
      title: exp.title,
      description: exp.description,
      category: exp.category,
      difficulty: exp.difficulty,
      reagents: JSON.stringify(exp.reagents),
      apparatus: JSON.stringify(exp.apparatus),
      objectives: JSON.stringify(exp.objectives),
      estimatedMinutes: exp.estimatedMinutes,
    };
    await prisma.experiment.upsert({
      where: { slug: data.slug },
      update: data,
      create: data,
    });
    count += 1;
  }
  console.log(`已写入 ${count} 条化学实验`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
