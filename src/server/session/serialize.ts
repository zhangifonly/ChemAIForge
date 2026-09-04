/**
 * 按会话 id 串行化写操作。
 *
 * steps / measurements 存成整块 JSON 字符串，追加是「读出→改→写回」三步，不是原子操作。
 * 客户端连点「混合反应」会并发发出多个 PATCH，两个请求各自读到同一份旧数组，
 * 后写回的那个就把先写回的那条步骤覆盖掉了 —— 记录静默丢失，报告里少了操作。
 *
 * 服务是单进程（pm2 单实例 + Next.js Node server），故用进程内队列即可，
 * 无需数据库层面的锁：同一 id 的任务排成一条链依次执行，不同 id 互不影响。
 */

// 每个会话当前的队尾（链式 then 排队）；队列空了就删除条目，避免 Map 无限增长
const tails = new Map<string, Promise<unknown>>();

export function withSessionLock<T>(id: string, task: () => Promise<T>): Promise<T> {
  const prev = tails.get(id) ?? Promise.resolve();
  // 前一个任务失败不能阻断后续（catch 掉再接），否则一次异常会让该会话永久写不进
  const next = prev.then(task, task);
  tails.set(id, next);
  // 自己仍是队尾时清理，防止 Map 随会话数无限增长
  void next.catch(() => {}).then(() => {
    if (tails.get(id) === next) tails.delete(id);
  });
  return next;
}

// 仅供测试断言队列已排空
export function pendingLockCount(): number {
  return tails.size;
}
