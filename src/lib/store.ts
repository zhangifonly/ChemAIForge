import { create } from "zustand";

// 应用全局状态 - 脚手架示例
interface AppState {
  count: number;
  increment: () => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  reset: () => set({ count: 0 }),
}));
