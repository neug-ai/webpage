import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  Zap,
  Code2,
  Server,
  BarChart3,
  Puzzle,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { useBasePath } from "@/contexts/base-path-context";

const coreFeatures = [
  {
    icon: Database,
    title: "Lightweight & Embeddable",
    description: "Single binary, minimal external dependencies. Embed directly into your Python app for offline analytics, or run as a service for online transactions — no DevOps overhead.",
  },
  {
    icon: Code2,
    title: "Cypher-Native, GQL-Ready",
    description: "Write queries in industry-standard Cypher. Powered by GOpt's unified IR design — ready for ISO/GQL with minimal migration cost.",
    links: [
      {
        text: "ISO/GQL Standard",
        href: "https://www.gqlstandards.org/",
      },
      {
        text: "Learn about GOpt",
        href: "https://graphscope.io/blog/tech/2024/02/22/GOpt-A-Unified-Graph-Query-Optimization-Framework-in-GraphScope",
      },
    ],
  },
  {
    icon: Puzzle,
    title: "Extensible by Design",
    description: "Postgres/DuckDB-inspired extension system. Keep the core lean. Add graph algorithms, vector search, or custom procedures through an extensible framework.",
  },
];

export const FeaturesSection = () => {
  const basePath = useBasePath();
  return (
    <section className='py-24 bg-white dark:bg-slate-900 transition-colors duration-300'>
      <div className='container mx-auto px-6'>
        {/* Section Header */}
        <div className='text-center mb-16'>
          <h2 className='text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white'>
            Why NeuG?
          </h2>
          <p className='text-lg text-gray-600 dark:text-slate-400 max-w-2xl mx-auto'>
            A graph database that gives you the best of both worlds
          </p>
        </div>

        {/* Core Features - 3 columns */}
        <div className='grid md:grid-cols-3 gap-6 mb-16'>
          {coreFeatures.map((feature, index) => (
            <Card
              key={index}
              className='p-8 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-white dark:bg-slate-800/50 border-gray-200 dark:border-slate-700/50 hover:border-blue-300 dark:hover:border-blue-700'
            >
              <div className='w-12 h-12 rounded-xl flex items-center justify-center mb-6 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'>
                <feature.icon className='w-6 h-6' />
              </div>

              <h3 className='text-xl font-semibold mb-3 text-gray-900 dark:text-white'>
                {feature.title}
              </h3>

              <p className='text-gray-600 dark:text-slate-400 leading-relaxed'>
                {feature.description}
              </p>
              {feature.links && feature.links.length > 0 && (
                <div className='mt-3 flex flex-wrap gap-3'>
                  {feature.links.map((link, linkIndex) => (
                    <a 
                      key={linkIndex}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className='text-sm text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 hover:underline inline-flex items-center gap-1'
                    >
                      {link.text} →
                    </a>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Performance Highlight - LDBC Benchmark */}
        <div className='bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-3xl p-8 md:p-10 mb-16 relative overflow-hidden border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-lg'>
          {/* 背景装饰 */}
          <div className='absolute top-0 right-0 w-64 h-64 bg-blue-500/10 dark:bg-blue-500/20 rounded-full blur-3xl' />
          
          <div className='relative z-10 flex flex-col md:flex-row items-center gap-8'>
            <div className='flex-1'>
              <Badge className='mb-4 bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/40'>
                <Zap className='w-3 h-3 mr-1' />
                Proven Performance
              </Badge>
              <h3 className='text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-3'>
                80,000+ QPS
              </h3>
              <p className='text-gray-600 dark:text-slate-300 mb-4'>
                Built on GraphScope Flex, which set the record on LDBC SNB Interactive benchmark using Cypher queries.
              </p>
              <a 
                href="https://ldbcouncil.org/benchmarks/snb/interactive/2025-04-21-graphscope-flex-sf300/"
                target="_blank"
                rel="noopener noreferrer"
                className='inline-flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium transition-colors'
              >
                View Official Audit Results
                <ExternalLink className='w-4 h-4 ml-1' />
              </a>
            </div>
            <div className='flex-shrink-0 text-center'>
              <div className='text-6xl md:text-7xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent'>
                #1
              </div>
              <div className='text-gray-500 dark:text-slate-400 text-sm mt-1'>LDBC SNB SF300</div>
            </div>
          </div>
        </div>

        {/* HTAP Architecture Visual */}
        <div className='bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900 rounded-3xl p-8 md:p-12 border border-gray-200 dark:border-slate-700/50 mb-16'>
          <div className='text-center mb-10'>
            <h3 className='text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-3'>
              One Database, Two Modes
            </h3>
            <p className='text-gray-600 dark:text-slate-400 max-w-2xl mx-auto'>
              Switch between embedded analytics and network service based on your needs
            </p>
          </div>

          <div className='grid md:grid-cols-2 gap-8'>
            {/* Embedded Mode */}
            <div className='bg-white dark:bg-slate-800/80 rounded-2xl p-8 border border-gray-200 dark:border-slate-700/50 hover:border-blue-300 dark:hover:border-blue-700 transition-colors'>
              <div className='flex items-center gap-4 mb-4'>
                <div className='w-14 h-14 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center'>
                  <BarChart3 className='w-7 h-7 text-blue-600 dark:text-blue-400' />
                </div>
                <div>
                  <h4 className='text-xl font-semibold text-gray-900 dark:text-white'>
                    Embedded Mode
                  </h4>
                  <p className='text-sm text-gray-500 dark:text-slate-500'>For Analytics</p>
                </div>
              </div>
              <p className='text-sm text-gray-600 dark:text-slate-400 mb-4'>
                Import as a library. Perfect for data science workflows, ML/AI pipelines, and research prototyping.
              </p>
              <ul className='space-y-2 text-gray-600 dark:text-slate-400 text-sm'>
                <li className='flex items-center gap-2'>
                  <span className='w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0'></span>
                  Batch data loading & ETL
                </li>
                <li className='flex items-center gap-2'>
                  <span className='w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0'></span>
                  Complex pattern matching
                </li>
                <li className='flex items-center gap-2'>
                  <span className='w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0'></span>
                  Full-graph algorithms
                </li>
              </ul>
              <div className='mt-4 pt-4 border-t border-gray-100 dark:border-slate-700/50'>
                <p className='text-xs text-gray-500 dark:text-slate-500'>
                  <span className='font-medium'>Use cases:</span> Jupyter notebooks, offline analytics, graph ML feature extraction
                </p>
              </div>
            </div>

            {/* Service Mode */}
            <div className='bg-white dark:bg-slate-800/80 rounded-2xl p-8 border border-gray-200 dark:border-slate-700/50 hover:border-gray-300 dark:hover:border-slate-600 transition-colors'>
              <div className='flex items-center gap-4 mb-4'>
                <div className='w-14 h-14 bg-gray-100 dark:bg-slate-700 rounded-xl flex items-center justify-center'>
                  <Server className='w-7 h-7 text-gray-600 dark:text-slate-400' />
                </div>
                <div>
                  <h4 className='text-xl font-semibold text-gray-900 dark:text-white'>
                    Service Mode
                  </h4>
                  <p className='text-sm text-gray-500 dark:text-slate-500'>For Transactions</p>
                </div>
              </div>
              <p className='text-sm text-gray-600 dark:text-slate-400 mb-4'>
                Run as a network service. Built for production apps with concurrent users and real-time requirements.
              </p>
              <ul className='space-y-2 text-gray-600 dark:text-slate-400 text-sm'>
                <li className='flex items-center gap-2'>
                  <span className='w-1.5 h-1.5 bg-gray-400 rounded-full flex-shrink-0'></span>
                  Concurrent read-write
                </li>
                <li className='flex items-center gap-2'>
                  <span className='w-1.5 h-1.5 bg-gray-400 rounded-full flex-shrink-0'></span>
                  Low-latency point queries
                </li>
                <li className='flex items-center gap-2'>
                  <span className='w-1.5 h-1.5 bg-gray-400 rounded-full flex-shrink-0'></span>
                  Multi-session ACID transactions
                </li>
              </ul>
              <div className='mt-4 pt-4 border-t border-gray-100 dark:border-slate-700/50'>
                <p className='text-xs text-gray-500 dark:text-slate-500'>
                  <span className='font-medium'>Use cases:</span> Web/mobile backends, real-time recommendations, anti-fraud systems
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* What's Next - Shipped + Roadmap */}
        <div className='bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/50 dark:to-blue-950/50 rounded-3xl p-8 md:p-10 border border-purple-200/50 dark:border-purple-700/50'>
          <div className='flex items-center gap-3 mb-6'>
            <Sparkles className='w-6 h-6 text-purple-500' />
            <h3 className='text-xl md:text-2xl font-bold text-gray-900 dark:text-white'>
              What's Next
            </h3>
          </div>

          {/* Recently Shipped */}
          <div className='mb-8'>
            <p className='text-sm font-medium text-gray-700 dark:text-slate-300 mb-3'>
              ✅ Recently Shipped
            </p>
            <div className='grid sm:grid-cols-3 gap-4'>
              <a href={`${basePath}/en/reference/nodejs_api/`} className='bg-white/80 dark:bg-slate-800/50 rounded-xl p-4 border border-gray-200/50 dark:border-slate-700/50 hover:border-purple-300 dark:hover:border-purple-700 transition-colors block'>
                <div className='text-sm font-medium text-gray-900 dark:text-white mb-1'>Node.js Client</div>
                <div className='text-xs text-gray-500 dark:text-slate-500'>v0.1.3 — AI Agent integration ready</div>
              </a>
              <a href={`${basePath}/en/extensions/load_gds/`} className='bg-white/80 dark:bg-slate-800/50 rounded-xl p-4 border border-gray-200/50 dark:border-slate-700/50 hover:border-purple-300 dark:hover:border-purple-700 transition-colors block'>
                <div className='text-sm font-medium text-gray-900 dark:text-white mb-1'>Graph Algorithms (GDS)</div>
                <div className='text-xs text-gray-500 dark:text-slate-500'>v0.1.3 — Leiden community detection</div>
              </a>
              <a href={`${basePath}/en/extensions/load_httpfs/`} className='bg-white/80 dark:bg-slate-800/50 rounded-xl p-4 border border-gray-200/50 dark:border-slate-700/50 hover:border-purple-300 dark:hover:border-purple-700 transition-colors block'>
                <div className='text-sm font-medium text-gray-900 dark:text-white mb-1'>Data Lake Support</div>
                <div className='text-xs text-gray-500 dark:text-slate-500'>v0.1.2 — S3/OSS + Parquet</div>
              </a>
            </div>
          </div>

          {/* Coming in v0.2 */}
          <div>
            <p className='text-sm font-medium text-gray-700 dark:text-slate-300 mb-3'>
              🚀 Coming in v0.2
            </p>
            <div className='grid sm:grid-cols-2 lg:grid-cols-3 gap-4'>
              <div className='bg-white/80 dark:bg-slate-800/50 rounded-xl p-4 border border-purple-200/50 dark:border-purple-700/50'>
                <div className='text-sm font-medium text-gray-900 dark:text-white mb-1'>Vector DB Extension</div>
                <div className='text-xs text-gray-500 dark:text-slate-500'>RAG & GraphRAG support</div>
              </div>
            </div>
          </div>

          <p className='text-sm text-gray-500 dark:text-slate-400 mt-6 text-center'>
            <a 
              href="https://github.com/alibaba/neug" 
              target="_blank" 
              rel="noopener noreferrer"
              className='inline-flex items-center gap-1 hover:text-purple-600 dark:hover:text-purple-400 transition-colors'
            >
              ⭐ Star us on GitHub to stay updated on new releases
            </a>
          </p>
        </div>
      </div>
    </section>
  );
};
