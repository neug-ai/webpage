// 统一管理 basePath，确保开发和生产环境一致
const GITHUB_PAGE_PREFIX = "neug";

export const getBasePath = (): string => {
  // 在客户端，检查当前 URL 是否包含 /neug
  if (typeof window !== "undefined") {
    const pathname = window.location.pathname;
    if (pathname.startsWith(`/${GITHUB_PAGE_PREFIX}`)) {
      return `/${GITHUB_PAGE_PREFIX}`;
    }
    return "";
  }
  
  // 在服务器端，使用环境变量判断
  const isProduction = process.env.NODE_ENV === "production";
  return isProduction ? `/${GITHUB_PAGE_PREFIX}` : "";
};

export const BASE_PATH = process.env.NODE_ENV === "production" ? `/${GITHUB_PAGE_PREFIX}` : "";
