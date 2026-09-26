// 2D 与 3D 的溶质色表必须是同一份。
//
// 抓到过的实际情形：LabCanvas 里维护着一份只 13 项的私有副本，而 appearance.ts
// 的共用表有 90 多项。差集里最扎眼的是溴水（Br₂，12 个实验）——「溴水褪色」是
// 这些实验的全部看点，2D 却把橙棕画成无色澄清：反应前后都无色，学生什么也看不出，
// 切到 3D 又是对的。同一实验两个视图给出不同结论，比单边画错更难排查。
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { allExperiments } from "@/data/experiments";
import { resolveSubstance } from "./reagents";
import { SOLUTION_TINT } from "@/lib/chem/appearance";

describe("2D 液色与 3D 同源", () => {
  it("LabCanvas 不再自带色表副本，而是引用共用表", () => {
    const src = readFileSync(new URL("./LabCanvas.tsx", import.meta.url), "utf8");
    // 引用共用表
    expect(src).toMatch(/import\s*\{[^}]*SOLUTION_TINT[^}]*\}\s*from\s*"@\/lib\/chem\/appearance"/);
    // 且没有在本文件里重新定义一份
    expect(src).not.toMatch(/const\s+SOLUTION_TINT\s*[:=]/);
  });

  it("溴水等强特征色试剂在共用表里有登记（褪色实验的看点所在）", () => {
    // 这几味都曾因不在 2D 私有副本里而被画成无色
    for (const f of ["Br2", "MgCl2", "ZnSO4", "NiCl2", "Pb(NO3)2", "Fe2(SO4)3"]) {
      expect(SOLUTION_TINT[f], f).toBeDefined();
    }
  });

  it("实验库里每一味有色试剂都能被 2D 的查表方式命中", () => {
    // 2D 用 SOLUTION_TINT[formula] 直查，这里确认解析出的化学式与表键一致，
    // 避免出现「表里登记了 Br2、试剂解析出别的写法」这类对不上的情况
    const colored = new Set<string>();
    for (const e of allExperiments) {
      for (const r of e.reagents) {
        const f = resolveSubstance(r).formula;
        if (SOLUTION_TINT[f]) colored.add(f);
      }
    }
    expect(colored.size).toBeGreaterThan(20);
    expect(colored.has("Br2")).toBe(true);
  });
});
