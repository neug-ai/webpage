import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { generateStaticParamsFor, importPage } from "nextra/pages";
import { useMDXComponents as getMDXComponents } from "../../mdx-components";
import { localePrefix, type SiteLocale } from "@/lib/site";

const defaultPath = ["overview", "introduction"];
const invalidNames = [
  "Doxyfile",
  "Makefile",
  "CMakeLists",
  "requirements",
  "setup",
  "conf",
];
const Wrapper = getMDXComponents().wrapper;

export async function getDocsStaticParams(locale: SiteLocale) {
  const generateParams = generateStaticParamsFor("mdxPath");
  const params = await generateParams();
  const normalized = params.map(({ mdxPath }) => ({
    mdxPath: Array.isArray(mdxPath) ? mdxPath : mdxPath ? [mdxPath] : [],
  }));
  const valid = normalized
    .filter(({ mdxPath }) => mdxPath[0] === locale && mdxPath[1] !== "blog")
    .map(({ mdxPath }) => ({ mdxPath: mdxPath.slice(1) }))
    .filter(({ mdxPath }) => {
      const joined = mdxPath.join("/");
      const lastSegment = mdxPath.at(-1) ?? "";

      return (
        !joined.match(/\.(png|jpg|jpeg|gif|svg|ico|webp)$/i) &&
        !invalidNames.some((name) =>
          lastSegment.toLowerCase().includes(name.toLowerCase())
        )
      );
    });

  if (!valid.some(({ mdxPath }) => mdxPath.join("/") === defaultPath.join("/"))) {
    valid.push({ mdxPath: defaultPath });
  }

  return [{ mdxPath: [] }, ...valid];
}

export async function getDocsMetadata(
  locale: SiteLocale,
  paramsPromise: Promise<{ mdxPath?: string[] }>
): Promise<Metadata> {
  const { mdxPath } = await paramsPromise;
  const path = mdxPath?.length ? mdxPath : defaultPath;
  const prefix = localePrefix(locale);
  const route = path.join("/");

  try {
    const { metadata } = await importPage([locale, ...path]);
    const title =
      typeof metadata.title === "string"
        ? metadata.title
        : locale === "zh"
          ? "NeuG 文档"
          : "NeuG Documentation";
    const description =
      typeof metadata.description === "string"
        ? metadata.description
        : locale === "zh"
          ? "NeuG 产品与开发文档。"
          : "NeuG product and developer documentation.";
    const url = `${prefix}/docs/${route}/`;

    return {
      ...metadata,
      description,
      alternates: {
        canonical: url,
        languages: {
          "en-US": `/docs/${route}/`,
          "zh-CN": `/zh/docs/${route}/`,
        },
      },
      openGraph: { title, description, url, type: "article" },
      twitter: { card: "summary", title, description },
    };
  } catch {
    return { title: locale === "zh" ? "NeuG 文档" : "NeuG Documentation" };
  }
}

export async function renderDocsPage(
  locale: SiteLocale,
  props: { params: Promise<{ mdxPath?: string[] }> }
) {
  const params = await props.params;
  const mdxPath = params.mdxPath?.length ? params.mdxPath : defaultPath;

  try {
    const { default: MDXContent, toc, metadata, sourceCode } = await importPage([
      locale,
      ...mdxPath,
    ]);

    return (
      <Wrapper toc={toc} metadata={metadata} sourceCode={sourceCode}>
        <div
          lang={locale === "zh" ? "zh-CN" : "en"}
          data-pagefind-body
          data-pagefind-filter={`lang:${locale}`}
        >
          <div data-pagefind-filter="type:docs">
            <MDXContent {...props} params={{ ...params, mdxPath, lang: locale }} />
          </div>
        </div>
      </Wrapper>
    );
  } catch {
    notFound();
  }
}
