# 简介

**NeuG** 是一款高性能、原生图结构的事务型数据库，可嵌入您的应用程序中，或作为后端服务运行。它提供持久化存储、显式事务、原生 Cypher 查询，以及就地图分析能力。

自 **NeuG v0.2** 起，NeuG 引入了存储-索引框架，支持 HNSW 向量搜索与 BM25 全文搜索。结合 NeuG 原生的图结构，这些能力使 NeuG 成为**面向智能体（agentic）应用的统一数据索引**——在同一套受管数据之上，融合结构化信息、语义关联与精确关键词检索。这些索引能力在 NeuG v0.1.x 中不可用。如有疑问或需社区支持，请访问 [NeuG 仓库](https://github.com/alibaba/neug)。

## 核心能力

- **原生图数据管理** — 以持久化存储方式保存实体、关系及属性，并支持显式事务、检查点（checkpoints）和预写式日志（write-ahead logging）。
- **统一检索能力** — 原生查询图结构，同时利用 HNSW 和 BM25 索引，在同一份数据上实现语义检索与关键词检索。
- **Cypher 查询与图分析** — 使用 Cypher 进行图遍历与过滤，并直接运行 PageRank、Leiden、最短路径等算法，无需将图导出至其他系统。
- **嵌入式或服务化部署** — 可在进程中运行 NeuG，适用于低开销的本地工作流；也可将同一数据库作为服务对外暴露，供多个应用并发访问。参见 [双模式基准测试](../../tutorials/benchmark-neug-dual-mode) 获取可复现的性能结果。
- **可扩展且可互操作** — 通过扩展机制添加新功能，并可通过 Apache Arrow、Parquet、S3、OSS 等格式与系统进行数据交换。

## 一份数据，多种索引方式

NeuG 为同一张图提供互补的访问路径：

| | 索引内容 | 支持的功能 |
|---|---|---|
| **结构** | 实体、关系及拓扑结构 | Cypher 遍历、模式匹配，以及使用 PageRank、Leiden、最短路径和社区发现等算法进行结构分析 |
| **语义** | 稠密向量属性 | 基于 HNSW 的相似性检索，支持余弦距离、L2 距离和内积距离 |
| **关键词** | 自然语言文本 | 基于 BM25 排序的全文检索，支持短语查询、前缀查询及布尔运算符 |

图结构原生内置于 NeuG 的图存储中；图算法是使用和分析该结构的另一种方式，而非独立的索引。向量检索与全文检索则由集成 NeuG 查询及事务模型的存储索引提供。

这三种访问方式均作用于同一底层数据。插入、更新与删除操作会原子性地维护图属性及其对应的向量或全文索引。已提交的索引状态将通过检查点与预写式日志随图数据一同持久化和恢复。

> **路线图** — NeuG 的统一索引层将持续扩展，以支持更多数据类型与访问模式，且全部构建于同一份事务数据之上。

## 快速示例

以下 NeuG v0.2 示例对相同的 `Runbook` 数据同时按语义和关键词建立索引，同时保持其图结构可直接查询：

```cypher
LOAD vector_search;
LOAD fts;

CREATE INDEX runbook_vec ON Runbook
USING HNSW (embedding) WITH (metric = 'l2');

CREATE INDEX runbook_text ON Runbook
USING FTS (content);

// 结构：遍历关系
MATCH (:Service {name: 'PaymentService'})-[:HAS_RUNBOOK]->(r:Runbook)
RETURN r.title;

// 语义：查找语义相似的内容
MATCH (r:Runbook)
RETURN r.title,
       vector_distance_l2(r.embedding, [0.1, 0.2, 0.3, 0.4]) AS distance
ORDER BY distance ASC LIMIT 5;

// 关键词：对精确匹配的词项进行排序
MATCH (r:Runbook)
RETURN r.title, bm25(r.content, 'retry timeout') AS score
ORDER BY score ASC LIMIT 5;
```

有关安装配置、索引选项及完整示例，请参阅[向量搜索](../../extensions/vector_search)和[全文搜索](../../extensions/fts_search)。

## 开始探索

- **[安装](../../installation/installation)** — 为 Python、Node.js 或 C++ 安装 NeuG
- **[快速入门](../../getting_started/getting_started)** — 创建数据库并运行您的首个查询
- **[向量搜索](../../extensions/vector_search)** — 存储向量并构建 HNSW 索引
- **[全文搜索](../../extensions/fts_search)** — 构建全文索引并执行 BM25 排序的查询
- **[图算法](../../extensions/load_gds)** — 投影图结构并运行图算法
- **[事务管理](../../transaction/transaction)** — 理解 NeuG 的事务与隔离模型
