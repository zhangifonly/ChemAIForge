// 3D 现象组件库统一入口。
// 把"气泡上升 / 沉淀下沉 / 液体渐变色 / 火焰光效 / 火星 / 电极产气"等
// 可复用的现象拆分为独立组件，场景只需按需组合，避免逐个实验重写。
export { Bubbles } from "./bubbles";
export type { BubblesProps } from "./bubbles";
export { Precipitate } from "./precipitate";
export type { PrecipitateProps } from "./precipitate";
export { ColorLiquid } from "./colorLiquid";
export type { ColorLiquidProps } from "./colorLiquid";
export { BrightFlare, Smoke } from "./flame";
export { Sparks } from "./sparks";
export { OrganicLayer } from "./organicLayer";
export type { OrganicLayerProps } from "./organicLayer";
export { Turbidity } from "./turbidity";
export type { TurbidityProps } from "./turbidity";
export { Crystals } from "./crystals";
export type { CrystalsProps } from "./crystals";
export { TempShift } from "./tempShift";
export type { TempShiftProps } from "./tempShift";
