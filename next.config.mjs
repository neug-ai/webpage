import nextra from "nextra";
import { remarkFixLinks } from "./plugins/remark-fix-links.mjs";

const withNextra = nextra({
  latex: true,
  search: {
    codeblocks: false,
  },
  contentDirBasePath: "/",
  mdxOptions: {
    remarkPlugins: [remarkFixLinks],
  },
});

export default withNextra({
  reactStrictMode: true,
  output: process.env.NODE_ENV === "production" ? "export" : undefined,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // 配置 webpack 忽略 content 目录中的非文档文件
  webpack: (config) => {
    // 忽略 content 目录中的非文档文件
    config.module.rules.push({
      test: /[\\/]content[\\/].*\.(py|sh|txt|rst|html|css|js|json|yaml|yml|toml|conf|ipynb)$/i,
      loader: 'raw-loader',
      options: {
        esModule: false,
      },
    });
    
    // 忽略没有扩展名的配置文件（如 Doxyfile, Makefile）
    config.module.rules.push({
      test: /[\\/]content[\\/].*(Doxyfile|Makefile|CMakeLists)$/i,
      loader: 'raw-loader',
      options: {
        esModule: false,
      },
    });
    
    return config;
  },
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
});
