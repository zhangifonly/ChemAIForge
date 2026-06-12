// 讲解播放器 → AI 导师的轻量消息总线：讲解步骤把"请导师讲讲这一步"的提示
// 投递到此，TutorChat 订阅消费并发起一次带画布上下文的提问。解耦两个兄弟组件。
import { create } from "zustand";

interface TutorBus {
  // 待发送的提示（null 表示无）
  pending: string | null;
  // 投递一条提示
  ask: (prompt: string) => void;
  // 取出并清空（消费）
  consume: () => string | null;
}

export const useTutorBus = create<TutorBus>((set, get) => ({
  pending: null,
  ask: (prompt) => set({ pending: prompt }),
  consume: () => {
    const p = get().pending;
    if (p) set({ pending: null });
    return p;
  },
}));
