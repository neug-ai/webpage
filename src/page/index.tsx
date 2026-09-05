import { ArrowRight, Columns2, FileText, Network, PenLine, Puzzle, Scale, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { HomeNavbar } from "@/components/home-navbar";
import { NeuGLogo } from "@/components/neug-logo";
import { AlgorithmDemo, ComparisonDemo, QuickStart, RetrievalDemo } from "@/components/home-product-demos";
import { ThemeProvider } from "@/contexts/theme-context";
import { homepageCopy, type HomeLocale } from "@/lib/homepage-copy";
import versions from "../../versions.json";

export default function Index({ locale = "en" }: { locale?: HomeLocale }) {
  return (
    <ThemeProvider>
      <Homepage locale={locale} />
    </ThemeProvider>
  );
}

function Homepage({ locale }: { locale: HomeLocale }) {
  const copy = homepageCopy[locale];
  const prefix = locale === "zh" ? "/zh" : "";
  const home = `${prefix}/`;
  const docs = `${prefix}/docs/overview/introduction/`;
  const blog = `${prefix}/blog/`;
  const start = `${prefix}/docs/getting_started/getting_started/`;
  const algorithms = `${prefix}/docs/extensions/load_gds/`;
  const benchmark = `${prefix}/docs/tutorials/benchmark-neug-dual-mode/`;

  return (
    <div id="neug-product-home" lang={locale === "zh" ? "zh-CN" : "en"}>
      <HomeNavbar locale={locale} />
      <main>
        <section className="np-shell np-hero">
          <div>
            <a className="np-version" href="https://github.com/alibaba/neug/releases" target="_blank" rel="noreferrer">
              {copy.hero.release} <strong>{versions.current}</strong><span>→</span>
            </a>
            <h1><NeuGLogo height={104} /></h1>
            <h2>{copy.hero.title[0]}<span>{copy.hero.title[1]}</span>{copy.hero.title[2]}</h2>
            <p>{copy.hero.body}</p>
            <div className="np-actions">
              <Link className="np-action primary" href={start}>{copy.hero.start}<ArrowRight aria-hidden="true" /></Link>
              <Link className="np-action np-resource-action" href={docs}><FileText aria-hidden="true" /><span>{copy.hero.docs}</span></Link>
              <Link className="np-action np-resource-action" href={blog}><PenLine aria-hidden="true" /><span>{copy.hero.blog}</span></Link>
              <a className="np-action np-resource-action" href="https://x.com/graphscope2021" target="_blank" rel="noreferrer"><XLogo /><span>{locale === "zh" ? "关注我们" : "Follow us"}</span></a>
            </div>
            <div className="np-runtimes"><span>Python</span><i /><span>Node.js</span><i /><span>CLI</span></div>
          </div>
        </section>

        <section className="np-section np-foundation">
          <div className="np-shell">
            <SectionHead label={copy.foundation.label} title={copy.foundation.title} body={copy.foundation.body} />
            <div className="np-foundation-features">
              {copy.foundation.features.map(([title, meta, body], index) => {
                const Icon = [Network, ShieldCheck, Columns2, Puzzle, Scale][index];
                return (
                  <article key={title}>
                    <span className="np-foundation-icon"><Icon aria-hidden="true" /></span>
                    <div><strong>{title}</strong><span>{meta}</span></div>
                    <p>{body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="np-section" id="retrieval">
          <div className="np-shell">
            <SectionHead label={copy.retrieval.label} title={copy.retrieval.title} body={copy.retrieval.body} />
            <RetrievalDemo locale={locale} />
          </div>
        </section>

        <section className="np-section" id="algorithms">
          <div className="np-shell">
            <SectionHead label={copy.algorithms.label} title={copy.algorithms.title} body={copy.algorithms.body} />
            <AlgorithmDemo locale={locale} algorithmsHref={algorithms} />
          </div>
        </section>

        <section className="np-section np-why" id="why-neug">
          <div className="np-shell">
            <SectionHead label={copy.why.label} title={copy.why.title} body={copy.why.body} />
            <ComparisonDemo locale={locale} benchmarkHref={benchmark} />
          </div>
        </section>

        <section className="np-section np-quickstart" id="quick-start">
          <div className="np-shell">
            <div className="np-quickstart-layout">
              <div className="np-quickstart-copy"><div className="np-section-label">{copy.quick.label}</div><h3>{copy.quick.title}</h3><p>{copy.quick.body}</p></div>
              <QuickStart locale={locale} />
            </div>
            <div className="np-compatibility">
              <strong>{copy.quick.compatibility}</strong>
              <dl>{copy.quick.groups.map(([term, value], index) => <div key={term}><dt>{term}</dt><dd>{value}{index === 2 && <><br /><span>{copy.quick.roadmap}</span></>}</dd></div>)}</dl>
            </div>
          </div>
        </section>

        <section className="np-close"><div className="np-shell"><div><h3>{copy.close[0]}</h3><p>{copy.close[1]}</p></div><div className="np-actions"><Link className="np-action primary" href={start}>{copy.hero.start}</Link><a className="np-action" href="https://github.com/alibaba/neug">GitHub</a></div></div></section>
      </main>
      <footer className="np-footer"><div className="np-shell"><span className="np-footer-brand"><Link href={home} aria-label="NeuG home"><NeuGLogo height={22} /></Link><span>{copy.footer}</span></span><span><a href="https://github.com/alibaba/neug" target="_blank" rel="noreferrer">GitHub</a><i>Apache 2.0</i></span></div></footer>
    </div>
  );
}

function XLogo() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817-5.966 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" /></svg>;
}

function SectionHead({ label, title, body }: { label: string; title: string; body: string }) {
  return <div className="np-section-head"><div><div className="np-section-label">{label}</div><h3>{title}</h3></div><p>{body}</p></div>;
}
