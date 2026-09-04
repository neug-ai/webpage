import React from "react";
import { useMDXComponents as getDocsMDXComponents } from "nextra-theme-docs";
import { Pre, withIcons, Tabs } from "nextra/components";
import { GitHubIcon } from "nextra/icons";
import type { UseMDXComponents } from "nextra/mdx-components";
import type { ImgHTMLAttributes } from "react";
import { getAssetPrefix } from "./asset-prefix.mjs";

// 自定义 img 组件，动态替换路径
const CustomImg = (props: ImgHTMLAttributes<HTMLImageElement>) => {
  const { src, ...rest } = props;
  // 根据环境设置资源前缀
  const assetPrefix = getAssetPrefix();
  
  // 处理 src 可能是对象的情况（Nextra 处理 Markdown 图片时会返回对象）
  let adjustedSrc: string | undefined;
  if (typeof src === 'string') {
    // 将 ../assets/ 替换为带前缀的 /assets/
    adjustedSrc = src.replace(/\.\.\/assets\//, `${assetPrefix}/assets/`);
  } else if (src && typeof src === 'object' && 'src' in src) {
    // Next.js 静态导入的图片是一个对象，包含 src 属性
    adjustedSrc = (src as { src: string }).src;
  } else {
    adjustedSrc = src as string | undefined;
  }
  
  return <img src={adjustedSrc} {...rest} />;
};

const docsComponents = getDocsMDXComponents({
  pre: withIcons(Pre, { js: GitHubIcon }),
});

export const useMDXComponents: UseMDXComponents<any> = (components = {}) => ({
  ...docsComponents,
  img: CustomImg,
  Tab: Tabs.Tab,
  ...components,
});
