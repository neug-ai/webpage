import React from "react";
import { Link as DocsLink, useMDXComponents as getDocsMDXComponents } from "nextra-theme-docs";
import { Pre, withIcons, Tabs } from "nextra/components";
import { GitHubIcon } from "nextra/icons";
import type { UseMDXComponents } from "nextra/mdx-components";
import type { AnchorHTMLAttributes, ImgHTMLAttributes } from "react";
import { withAssetPrefix } from "./asset-prefix.mjs";

// 自定义 img 组件，动态替换路径
const CustomImg = (props: ImgHTMLAttributes<HTMLImageElement>) => {
  const { src, ...rest } = props;
  // 处理 src 可能是对象的情况（Nextra 处理 Markdown 图片时会返回对象）
  let adjustedSrc: string | undefined;
  if (typeof src === 'string') {
    // Keep public assets under the PR preview base path when one is configured.
    const normalizedSrc = src.replace(/\.\.\/assets\//, "/assets/");
    adjustedSrc = withAssetPrefix(normalizedSrc);
  } else if (src && typeof src === 'object' && 'src' in src) {
    // Next.js 静态导入的图片是一个对象，包含 src 属性
    adjustedSrc = withAssetPrefix((src as { src: string }).src);
  } else {
    adjustedSrc = src as string | undefined;
  }
  
  return <img src={adjustedSrc} {...rest} />;
};

const CustomLink = ({ href = "", ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
  <DocsLink href={href} {...props} />
);

const docsComponents = getDocsMDXComponents({
  pre: withIcons(Pre, { js: GitHubIcon }),
});

export const useMDXComponents: UseMDXComponents<any> = (components = {}) => ({
  ...docsComponents,
  a: CustomLink,
  img: CustomImg,
  Tab: Tabs.Tab,
  ...components,
});
