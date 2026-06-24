// 导气吸收 / 排水集气装置判定测试：锁定"导管"不再被误判为排水集气，
// 导气→吸收/检验类正确识别（修复乙酸乙酯等装置）。
import { describe, it, expect } from "vitest";
import { allExperiments } from "@/data/experiments";
import { usesGasCollection, usesGasDelivery } from "./vesselGeom";

const exp = (slug: string) => allExperiments.find((e) => e.slug === slug)!;

describe("导气 / 集气装置判定", () => {
  it("乙酸乙酯制取 → 导气吸收（非排水集气）", () => {
    const e = exp("ester-synthesis");
    expect(usesGasCollection(e.apparatus)).toBe(false);
    expect(usesGasDelivery(e.apparatus, e.reagents)).toBe(true);
  });

  it("导气→吸收/检验类正确识别", () => {
    for (const slug of [
      "carbonate-acid-identify",
      "ethylene-bromine",
      "so2-bromine-water",
      "co2-baking-soda",
    ]) {
      const e = exp(slug);
      expect(usesGasDelivery(e.apparatus, e.reagents)).toBe(true);
    }
  });

  it("仅有'导管'但无吸收液/集气瓶的实验：两者皆 false", () => {
    for (const slug of ["aluminum-acid-base", "ethanol-sodium", "copper-nitric-acid"]) {
      const e = exp(slug);
      expect(usesGasCollection(e.apparatus)).toBe(false);
      expect(usesGasDelivery(e.apparatus, e.reagents)).toBe(false);
    }
  });

  it("真正的排水集气实验（集气瓶/水槽）仍判为集气", () => {
    for (const slug of ["co2-preparation", "o2-from-h2o2", "chlorine-preparation"]) {
      expect(usesGasCollection(exp(slug).apparatus)).toBe(true);
    }
  });

  it("排水集气与导气吸收互斥", () => {
    for (const e of allExperiments) {
      const c = usesGasCollection(e.apparatus);
      const d = usesGasDelivery(e.apparatus, e.reagents);
      expect(c && d).toBe(false);
    }
  });
});
