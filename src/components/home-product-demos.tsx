"use client";

import { useState } from "react";
import type { HomeLocale } from "@/lib/homepage-copy";
import { homepageCopy } from "@/lib/homepage-copy";

const nodes = [
  { id: "PaymentService", x: 360, y: 168, rank: 31, community: 1 },
  { id: "RetryPolicy", x: 145, y: 98, rank: 23, community: 0 },
  { id: "Runbook", x: 565, y: 92, rank: 18, community: 1 },
  { id: "TimeoutError", x: 574, y: 290, rank: 15, community: 1 },
  { id: "CircuitBreaker", x: 142, y: 305, rank: 12, community: 2 },
  { id: "Owner", x: 342, y: 355, rank: 9, community: 2 },
  { id: "Alert", x: 680, y: 205, rank: 7, community: 1 },
  { id: "Queue", x: 260, y: 62, rank: 6, community: 0 },
  { id: "Incident", x: 246, y: 238, rank: 5, community: 0 },
  { id: "Deploy", x: 470, y: 400, rank: 4, community: 2 },
];

const edges = [
  [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [1, 7], [1, 8],
  [2, 6], [2, 7], [3, 6], [3, 9], [4, 5], [4, 8], [5, 8], [5, 9], [7, 8],
];

const signalClass = ["structure", "vector", "fulltext"] as const;

export function RetrievalDemo({ locale }: { locale: HomeLocale }) {
  const copy = homepageCopy[locale].retrieval;
  const [signals, setSignals] = useState([true, true, true]);
  const [pulse, setPulse] = useState({ index: -1, id: 0 });

  const toggle = (index: number) => {
    setPulse((current) => ({ index, id: current.id + 1 }));
    setSignals((current) => current.map((value, i) => (i === index ? !value : value)));
  };

  const ranking = [
    { name: "RetryPolicy", indexes: [0, 1, 2], weights: [3, 2, 2] },
    { name: "Runbook", indexes: [0, 1], weights: [1.7, 2.8, 0] },
    { name: "TimeoutError", indexes: [0, 1, 2], weights: [1.5, 2, 3] },
  ].sort((a, b) => {
    const score = (item: typeof a) => item.weights.reduce((total, weight, index) => total + (signals[index] ? weight : 0), 0);
    return score(b) - score(a);
  });

  return (
    <div className="np-retrieval-demo">
      <div className="np-retrieval-query">
        <span className="np-query-label">{copy.query}</span>
        <strong>PaymentService</strong><span>+</span><strong>&quot;retry timeout&quot;</strong>
      </div>
      <div className="np-retrieval-layout">
        <div className="np-index-list">
          {copy.items.map((item, index) => {
            const name = item[0];
            return (
              <button
                key={name}
                type="button"
                className="np-index-button"
                aria-pressed={signals[index]}
                style={{ "--signal": `var(--np-${signalClass[index] === "structure" ? "blue" : signalClass[index] === "vector" ? "purple" : "teal"})` } as React.CSSProperties}
                onClick={() => toggle(index)}
              >
                <span className="num">0{index + 1}</span>
                <span><strong>{name}</strong><IndexQuery index={index} /></span>
                <i className="state" />
              </button>
            );
          })}
        </div>
        <div className="np-retrieval-visual">
          <svg viewBox="0 0 720 350" role="img" aria-label="Structure, vector, and full-text signals fused into one result">
            <g key={`edges-${pulse.id}`}>
              <line pathLength="1" className={`np-retrieval-edge hot${signals[0] ? "" : " is-off"}${pulse.id > 0 && pulse.index === 0 && signals[0] ? " is-drawing" : ""}`} x1="360" y1="168" x2="145" y2="98" />
              <line pathLength="1" className={`np-retrieval-edge hot${signals[0] ? "" : " is-off"}${pulse.id > 0 && pulse.index === 0 && signals[0] ? " is-drawing" : ""}`} x1="360" y1="168" x2="565" y2="92" />
              <line pathLength="1" className={`np-retrieval-edge hot${signals[0] ? "" : " is-off"}${pulse.id > 0 && pulse.index === 0 && signals[0] ? " is-drawing" : ""}`} x1="360" y1="168" x2="574" y2="290" />
              <line className="np-retrieval-edge" x1="145" y1="98" x2="142" y2="305" />
              <line className="np-retrieval-edge" x1="142" y1="305" x2="342" y2="290" />
              <line className="np-retrieval-edge" x1="565" y1="92" x2="665" y2="190" />
              <line className="np-retrieval-edge" x1="574" y1="290" x2="665" y2="190" />
            </g>
            <RetrievalNode key={`payment-${pulse.id}`} x={360} y={168} label="PaymentService" type="Service" signals={[true, false, false]} />
            <RetrievalNode key={`retry-${pulse.id}`} x={145} y={98} label="RetryPolicy" type="Policy" signals={signals} pulseSignal={pulse.id > 0 ? pulse.index : undefined} />
            <RetrievalNode key={`runbook-${pulse.id}`} x={565} y={92} label="Runbook" type="Document" signals={[signals[0], signals[1], false]} pulseSignal={pulse.id > 0 && pulse.index !== 2 ? pulse.index : undefined} />
            <RetrievalNode key={`timeout-${pulse.id}`} x={574} y={290} label="TimeoutError" type="Error" signals={signals} pulseSignal={pulse.id > 0 ? pulse.index : undefined} />
            <RetrievalNode x={142} y={305} label="CircuitBreaker" type="Policy" signals={[false, false, false]} faint />
            <RetrievalNode x={342} y={290} label="Owner" type="Team" signals={[false, false, false]} faint />
            <RetrievalNode x={665} y={190} label="Alert" type="Event" signals={[false, false, false]} faint />
          </svg>
          <div className="np-result-ranking" aria-live="polite">
            {ranking.map(({ name, indexes }, index) => (
              <div className="np-result-item" key={`${name}-${pulse.id}`} style={{ "--result-delay": `${index * 55}ms` } as React.CSSProperties}>
                <span>{copy.result} · #{index + 1}</span><strong>{name}</strong>
                <div className="np-result-signals">
                  {indexes.map((signal) => <i key={signal} className={`${signalClass[signal]}${signals[signal] ? "" : " is-off"}`} />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function IndexQuery({ index }: { index: number }) {
  if (index === 0) return <small className="np-index-query"><code>
    <span>MATCH</span> (:Service {"{name: "}<i>&apos;PaymentService&apos;</i>{"}"})-[r]-(n){"\n"}
    <span>RETURN</span> n
  </code></small>;

  if (index === 1) return <small className="np-index-query"><code>
    <span>MATCH</span> (n) <span>RETURN</span> n{"\n"}
    <span>ORDER BY</span> vector_distance_cosine(n.vec,<b>$q</b>) <span>LIMIT</span> <em>10</em>
  </code></small>;

  return <small className="np-index-query"><code>
    <span>MATCH</span> (n) <span>RETURN</span> n{"\n"}
    <span>ORDER BY</span> bm25(n.text,<i>&apos;retry timeout&apos;</i>) <span>LIMIT</span> <em>10</em>
  </code></small>;
}

function RetrievalNode({ x, y, label, type, signals, faint = false, pulseSignal }: {
  x: number; y: number; label: string; type: string; signals: boolean[]; faint?: boolean; pulseSignal?: number;
}) {
  return (
    <g className={`np-r-node${faint ? " is-faint" : ""}${pulseSignal === undefined ? "" : ` is-pulse-${signalClass[pulseSignal]}`}`} transform={`translate(${x} ${y})`}>
      <circle className={`semantic-ring${signals[1] ? "" : " is-off"}`} r="30" />
      <circle className="base" r="20" /><circle className="core" r="7" />
      <path className={`keyword-mark${signals[2] ? "" : " is-off"}`} pathLength="1" d="M-10 53h20M-6 58h12" />
      <text x="0" y="-42" textAnchor="middle">{label}</text>
      <text className="node-type" x="0" y="43" textAnchor="middle">{type}</text>
    </g>
  );
}

export function AlgorithmDemo({ locale, algorithmsHref }: { locale: HomeLocale; algorithmsHref: string }) {
  const copy = homepageCopy[locale].algorithms;
  const [mode, setMode] = useState<"pagerank" | "leiden">("pagerank");
  const colors = ["var(--np-blue)", "var(--np-purple)", "var(--np-teal)"];

  return (
    <div className="np-algorithm-layout">
      <div className={`np-algorithm-canvas mode-${mode}`}>
        <svg viewBox="0 0 760 470" role="img" aria-label="PageRank and Leiden over the same graph">
          <g className="np-communities">
            <path d="M55 75C105 23 249 22 310 89C347 130 310 245 233 264C146 286 49 240 31 165C22 126 31 96 55 75Z" />
            <path d="M323 48C398 10 580 22 656 92C703 136 703 258 639 294C570 333 397 291 332 222C285 172 285 68 323 48Z" />
            <path d="M123 270C210 215 455 215 555 292C613 345 574 441 476 458C354 479 185 448 122 382C89 347 91 293 123 270Z" />
            {copy.communities.map((label, index) => <text key={label} x={[55, 405, 205][index]} y={[64, 57, 439][index]}>{label}</text>)}
          </g>
          <g className="np-a-edges">
            {edges.map(([a, b], index) => <line key={index} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} />)}
          </g>
          <g className="np-a-nodes">
            {nodes.map((node, index) => {
              const visibleLabel = index < 6;
              const radius = mode === "pagerank" ? node.rank : 13;
              return (
                <g key={node.id} transform={`translate(${node.x} ${node.y})`}>
                  {mode === "pagerank" && index < 3 && <circle className="np-rank-halo" r={radius + 9} />}
                  <circle className="np-rank-core" r={radius} fill={mode === "leiden" ? colors[node.community] : "var(--np-blue)"} style={{ "--node-radius": `${radius}px`, "--node-delay": `${index * 28}ms` } as React.CSSProperties} />
                  {visibleLabel && <text x="0" y={-radius - 12} textAnchor="middle">{node.id}</text>}
                </g>
              );
            })}
          </g>
        </svg>
        <div className="np-carried-note"><i />{copy.carried}</div>
      </div>
      <div className="np-algorithm-copy">
        <div className="np-algorithm-tabs" role="tablist">
          {(["pagerank", "leiden"] as const).map((name) => (
            <button key={name} type="button" role="tab" aria-selected={mode === name} onClick={() => setMode(name)}>
              {name === "pagerank" ? "PageRank" : "Leiden"}
            </button>
          ))}
        </div>
        <div className="np-algorithm-detail" key={mode}>
          <h4>{mode === "pagerank" ? copy.pagerankTitle : copy.leidenTitle}</h4>
          <p>{mode === "pagerank" ? copy.pagerankBody : copy.leidenBody}</p>
        </div>
        <div className="np-algorithm-more">
          <strong>{copy.moreTitle}</strong><span>{copy.moreBody}</span>
          <a href={algorithmsHref}>{copy.moreLink}</a>
        </div>
      </div>
    </div>
  );
}

export function ComparisonDemo({ locale, benchmarkHref }: { locale: HomeLocale; benchmarkHref: string }) {
  const copy = homepageCopy[locale].why;
  const [mode, setMode] = useState<"graph" | "stack">("graph");
  const active = mode === "graph" ? copy.graph : copy.stack;

  return (
    <div className="np-why-demo">
      <div className="np-why-tabs" role="tablist">
        {copy.tabs.map((label, index) => (
          <button key={label} type="button" role="tab" aria-selected={(index === 0) === (mode === "graph")} onClick={() => setMode(index === 0 ? "graph" : "stack")}>{label}</button>
        ))}
      </div>
      <div className="np-why-panel">
        <div className="np-architecture">
          {mode === "graph" ? <GraphDatabaseComparison locale={locale} /> : <StackArchitecture locale={locale} />}
        </div>
        <div className="np-why-copy">
          <div className="np-why-facts">
            {active.facts.map(([title, body], index) => (
              <article key={title}><span>0{index + 1}</span><div><strong>{title}</strong><p>{body}</p></div></article>
            ))}
          </div>
          {mode === "graph" && <div className="np-validation-note">
            <span>—</span><div><strong>{copy.graph.note}</strong>
              <p>{copy.graph.methodology} <a href={benchmarkHref}>{copy.graph.link}</a></p>
            </div>
          </div>}
        </div>
      </div>
    </div>
  );
}

function GraphDatabaseComparison({ locale }: { locale: HomeLocale }) {
  const zh = locale === "zh";
  return <div className="np-mode-benchmarks">
    <article className="np-mode-card">
      <header><div><span>{zh ? "服务模式" : "Service mode"}</span><strong>NeuG <i>vs</i> Neo4j</strong></div><em>{zh ? "吞吐量" : "Throughput"} · QPS ↑</em></header>
      <div className="np-benchmark-bars">
        <BenchmarkBar label="NeuG" value="617" size="100%" accent />
        <BenchmarkBar label="Neo4j" value="12.2" size="2%" />
      </div>
      <footer>LDBC SNB Interactive SF1 · 14 {zh ? "个复杂读取查询" : "complex read queries"}</footer>
    </article>
    <article className="np-mode-card">
      <header><div><span>{zh ? "嵌入模式" : "Embedded mode"}</span><strong>NeuG <i>vs</i> LadybugDB</strong></div><em>{zh ? "查询延迟" : "Query latency"} ↓</em></header>
      <div className="np-embedded-result">
        <div><strong>8 <span>/ 9</span></strong><small>{zh ? "项查询延迟更低" : "queries with lower latency"}</small></div>
        <div className="np-latency-example"><span>Q3 {zh ? "示例" : "example"}</span><p><b>NeuG</b><strong>0.37s</strong></p><p><b>LadybugDB</b><strong>106.22s</strong></p></div>
      </div>
      <footer>LSQB SF1 · NeuG 1 {zh ? "线程 vs LadybugDB 最佳线程数" : "thread vs LadybugDB best thread count"}</footer>
    </article>
  </div>;
}

function BenchmarkBar({ label, value, size, accent = false }: { label: string; value: string; size: string; accent?: boolean }) {
  return <div className={`np-benchmark-bar${accent ? " is-accent" : ""}`}>
    <span>{label}</span><div><i style={{ "--benchmark-size": size } as React.CSSProperties} /></div><strong>{value}</strong>
  </div>;
}

function StackArchitecture({ locale }: { locale: HomeLocale }) {
  const zh = locale === "zh";
  return <>
    <ArchitectureRow label="NeuG" sub={zh ? "一个事务索引" : "One transactional index"}>
      <div className="np-process"><small>{zh ? "一份实体数据 · 一个查询运行时" : "One copy of entity data · one query runtime"}</small><div><strong>{zh ? "所有信号在此融合" : "All signals fuse here"}</strong><span className="np-index-axis"><i>Structure</i><i>Semantics</i><i>Keywords</i></span></div></div>
    </ArchitectureRow>
    <ArchitectureRow className="is-stack" label={zh ? "拼接式技术栈" : "Stitched stack"} sub={zh ? "重复的数据与查询路径" : "Replicated data and query paths"}>
      <div className="np-arch-box"><small>{zh ? "源数据" : "Source data"}</small><strong>{zh ? "事务" : "Transactions"}</strong></div>
      <b className="np-arrow"><small>CDC / ETL</small></b>
      <div className="np-engine-stack"><span>Graph DB</span><span>Vector DB</span><span>Search engine</span></div>
      <b className="np-arrow"><small>{zh ? "合并" : "Merge"}</small></b>
      <div className="np-arch-box"><small>{zh ? "应用" : "Application"}</small><strong>{zh ? "结果融合" : "Result fusion"}</strong></div>
    </ArchitectureRow>
  </>;
}

function ArchitectureRow({ label, sub, children, className = "" }: { label: string; sub: string; children: React.ReactNode; className?: string }) {
  return <div className={`np-arch-row ${className}`}><div className="np-arch-label"><strong>{label}</strong><span>{sub}</span></div><div className="np-arch-flow">{children}</div></div>;
}

type CodeTab = "python" | "node" | "cli";

const codeFiles: Record<CodeTab, string> = {
  python: "quickstart.py",
  node: "quickstart.js",
  cli: "neug-cli",
};

export function QuickStart({ locale }: { locale: HomeLocale }) {
  const [tab, setTab] = useState<CodeTab>("python");
  return <div className="np-code-surface">
    <div className="np-code-toolbar">
      <span className="np-window-dots" aria-hidden="true"><i /><i /><i /></span>
      <div className="np-code-tabs" role="tablist">
        {(["python", "node", "cli"] as const).map((name) => <button key={name} type="button" role="tab" aria-selected={tab === name} onClick={() => setTab(name)}>{name === "node" ? "Node.js" : name === "cli" ? "CLI" : "Python"}</button>)}
      </div>
      <span className="np-code-file">{codeFiles[tab]}</span>
    </div>
    <pre aria-label={locale === "zh" ? "NeuG 快速开始代码" : "NeuG quick start code"}><CodeExample tab={tab} /></pre>
  </div>;
}

function CodeExample({ tab }: { tab: CodeTab }) {
  if (tab === "python") return <code>
    <span className="np-code-prompt">$</span> pip install <span className="np-code-name">neug</span>{"\n\n"}
    <span className="np-code-keyword">import</span> neug{"\n\n"}
    db = neug.<span className="np-code-function">Database</span>(<span className="np-code-string">&quot;&quot;</span>){"\n"}
    conn = db.<span className="np-code-function">connect</span>(){"\n\n"}
    result = conn.<span className="np-code-function">execute</span>(<span className="np-code-string">&quot;&quot;&quot;</span>{"\n  "}
    <span className="np-code-query">MATCH</span> (n) <span className="np-code-query">RETURN</span> n <span className="np-code-query">LIMIT</span> <span className="np-code-number">10</span>{"\n"}
    <span className="np-code-string">&quot;&quot;&quot;</span>)
  </code>;

  if (tab === "node") return <code>
    <span className="np-code-prompt">$</span> npm install <span className="np-code-name">@graphscope-neug/neug</span>{"\n\n"}
    <span className="np-code-keyword">const</span> {"{ "}<span className="np-code-name">Database</span>{" }"} = <span className="np-code-function">require</span>({"\n  "}
    <span className="np-code-string">&quot;@graphscope-neug/neug&quot;</span>{"\n"}){"\n\n"}
    <span className="np-code-keyword">const</span> db = <span className="np-code-keyword">new</span> <span className="np-code-function">Database</span>({"{"}{"\n  "}
    databasePath: <span className="np-code-string">&quot;&quot;</span>, mode: <span className="np-code-string">&quot;w&quot;</span>{"\n"}{"}"}){"\n"}
    db.<span className="np-code-function">connect</span>().<span className="np-code-function">execute</span>({"\n  "}
    <span className="np-code-string">&quot;<span className="np-code-query">MATCH</span> (n) <span className="np-code-query">RETURN</span> n <span className="np-code-query">LIMIT</span> 10&quot;</span>{"\n"})
  </code>;

  return <code>
    <span className="np-code-prompt">$</span> pip install <span className="np-code-name">neug</span>{"\n\n"}
    <span className="np-code-prompt">$</span> neug-cli open <span className="np-code-string">./my_graph_db</span>{"\n\n"}
    <span className="np-code-name">NeuG&gt;</span> <span className="np-code-query">MATCH</span> (n){"\n      "}
    <span className="np-code-query">RETURN</span> n{"\n      "}
    <span className="np-code-query">LIMIT</span> <span className="np-code-number">10</span>;
  </code>;
}
