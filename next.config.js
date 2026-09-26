const createNextIntlPlugin = require("next-intl/plugin");

// 指向 i18n 请求配置（词条装载与回退逻辑）
const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next 14 需显式开启才会执行 src/instrumentation.ts（用于启动时预热语音模型）
  experimental: { instrumentationHook: true },
};

module.exports = withNextIntl(nextConfig);
