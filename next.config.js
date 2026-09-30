const createNextIntlPlugin = require("next-intl/plugin");

// 指向 i18n 请求配置（词条装载与回退逻辑）
const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next 14 需显式开启才会执行 src/instrumentation.ts（用于启动时预热语音模型）
  experimental: { instrumentationHook: true },
  // 页面已由 src/app/icon.svg 声明图标；爬虫、RSS 阅读器等不读 <link> 仍会盲取 /favicon.ico，
  // 指向同一份 SVG，免得每次 404
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon.svg" }];
  },
};

module.exports = withNextIntl(nextConfig);
