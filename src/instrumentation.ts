// 服务启动钩子：预热旁遮普语语音模型。
//
// 部署机是纯 CPU，VITS 冷启动（import torch + 加载 951 MB 模型）实测 32 秒。
// 不预热的话，每天第一个点旁遮普语讲解的学生要干等半分钟。启动时后台载入模型；
// 之后闲置 2 小时才退出（见 vitsWorker 的 IDLE_EXIT_MS）。预热失败不影响服务启动。
//
// 写法必须是「if (process.env.NEXT_RUNTIME === "nodejs") { await import(...) }」：
// Next 会把本文件同时编译给 edge 运行时，webpack 只有看到这个字面量判断才会在 edge 构建里
// 把分支整段剔除；换成提前 return 或 .node 后缀文件，edge 构建都会跟进去打包
// node:child_process 然后失败（实测两种写法都报 UnhandledSchemeError）。
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.TTS_PREWARM === "0") return;
    const { prewarmVits } = await import("./server/tts/synthesize");
    // 延后几秒：让服务先把端口监听起来、首批请求不被预热抢占 CPU
    setTimeout(() => {
      prewarmVits().catch(() => {
        /* 模型未安装等，首次真实请求会再尝试 */
      });
    }, 5000);
  }
}
