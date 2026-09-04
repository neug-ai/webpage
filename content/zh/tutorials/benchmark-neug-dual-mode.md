# NeuG 性能评测：双模式图数据库

本教程演示如何复现 NeuG 的基准性能测试结果。NeuG 支持两种执行模式：

- **嵌入式模式**：直接在 Python 进程中运行查询，零序列化开销
- **服务模式**：连接到 NeuG 服务器进行并发事务工作负载

我们对两种模式与行业标准数据库进行基准测试，展示 NeuG 的性能优势。

> **注意**：LDBC SNB Interactive 基准测试部分仅涵盖复杂读取查询（IC1–IC14）。不包括写入操作和事务更新。完整的 LDBC SNB Interactive 基准测试教程将在未来版本中提供。

## 数据集：LDBC SNB SF1

两个基准测试使用相同的 LDBC SNB SF1 数据集：

- **节点**：约 300 万（Person、Post、Comment、Tag 等）
- **边**：约 1700 万（KNOWS、LIKES、HASTAG 等）
- **大小**：压缩约 282MB，解压约 1.1GB

### 下载数据集

```bash
wget https://neug.oss-cn-hangzhou.aliyuncs.com/datasets/ldbc-snb-sf1-lsqb.tar.gz
tar -xzf ldbc-snb-sf1-lsqb.tar.gz
```

---

## LSQB 基准测试（嵌入式模式）

[LSQB](https://github.com/ldbc/lsqb) 包含 9 个偏向分析工作负载的复杂子图匹配查询。此基准测试比较嵌入式模式下的 NeuG 与 LadybugDB。

> **关于 KNOWS 边的说明**：原始 LSQB 基准测试假设 KNOWS 关系是双向的（即如果 A 认识 B，则 B 也认识 A）。在我们的测试中，我们修改了所有涉及 KNOWS 边的查询以使用有向遍历（`-[:KNOWS]->`）。此调整允许 **同一 LDBC SNB SF1 数据集用于 SNB Interactive 和 LSQB 两个基准测试**，因为原始 LDBC SNB 数据中的 KNOWS 关系是单向的。此修改不影响评估图数据库查询优化和执行能力的公平性。

### 查询描述

| 查询 | 描述 |
|-------|-------------|
| Q1 | 长路径遍历（9 跳链） |
| Q2 | 带评论-帖子模式的 2 跳 |
| Q3 | 同国家的三角形模式 |
| Q4 | 带 likes/replies 的多标签 |
| Q5 | 通过评论的标签共现 |
| Q6 | 带兴趣标签的 2 跳 |
| Q7 | 用于 likes/replies 的可选匹配 |
| Q8 | 带 NOT EXISTS 的标签模式 |
| Q9 | 带 NOT EXISTS 的 2 跳 |

### 运行基准测试

```bash
# 创建虚拟环境
python -m venv neug-env
source neug-env/bin/activate

# 安装依赖
pip install neug real_ladybug

# 运行基准测试
cd neug/examples/lsqb_benchmark
python run_benchmark.py --data-dir /path/to/ldbc-snb-sf1-lsqb
```

使用 `--force` 覆盖现有数据库。

### 预期结果

在 Apple Silicon Mac (M1/M2/M3) 上，NeuG 仅用单线程就在 **9 个查询中的 8 个**获胜，即使与 LadybugDB 的最佳多线程结果比较：

| 查询 | NeuG (1 线程) | LadybugDB (最佳) | 获胜者 |
|-------|-----------------|------------------|--------|
| Q1 | 2.60s | 60.24s (4t) | NeuG **23.2x** |
| Q2 | 0.14s | 12.69s (8t) | NeuG **90.6x** |
| Q3 | 0.37s | 106.22s (2t) | NeuG **287.1x** |
| Q4 | 0.14s | 1.24s (8t) | NeuG **8.9x** |
| Q5 | 0.83s | 5.72s (8t) | NeuG **6.9x** |
| Q6 | 0.48s | 0.15s (4t) | Ladybug **3.2x** |
| Q7 | 0.58s | 4.91s (8t) | NeuG **8.5x** |
| Q8 | 0.71s | 7.09s (8t) | NeuG **10.0x** |
| Q9 | 0.60s | 1.02s (8t) | NeuG **1.7x** |

NeuG 在复杂的多连接查询上表现出色，在三角形模式（Q3）上实现了高达 **287x** 的加速，在多跳过滤（Q2）上实现了 **91x** 的加速。LadybugDB 的多线程优势在简单的遍历查询如 Q6 上体现。

---

## LDBC SNB Interactive 基准测试（服务模式）

[LDBC SNB Interactive](https://ldbcouncil.org/benchmarks/snb-interactive/) 包含 14 个复杂读取查询（IC1–IC14），涵盖多跳好友查找、最短路径和聚合。此基准测试比较服务模式下的 NeuG 与 Neo4j。

### 查询描述

| 查询 | 描述 |
|-------|-------------|
| IC1 | 具有特定名字的好友（最多 3 跳） |
| IC2 | 好友的最近消息 |
| IC3 | 在两个国家有消息的好友 |
| IC4 | 时间范围内具有特定标签的消息 |
| IC5 | 具有最多好友成员的论坛 |
| IC6 | 有带标签帖子好友 |
| IC7 | 消息的最近点赞 |
| IC8 | 消息的最近回复 |
| IC9 | 好友的好友的最近消息 |
| IC10 | 同月出生的好友 |
| IC11 | 在特定国家工作的好友 |
| IC12 | 具有特定标签类兴趣的好友 |
| IC13 | 两人之间的最短路径 |
| IC14 | 两人之间的加权最短路径 |

### 运行基准测试

```bash
# 启动 Neo4j 服务器（可选，用于比较）
docker run -d --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/neo4j123 \
  neo4j:latest

# 创建虚拟环境
python -m venv neug-env
source neug-env/bin/activate

# 安装依赖
pip install neug neo4j

# 运行基准测试
cd neug/examples/ldbc_interactive_benchmark
python run_benchmark.py --data-dir /path/to/ldbc-snb-sf1-lsqb
```

### 预期结果

在 Apple Silicon Mac (M1/M2/M3) 上，4 个并发客户端运行 300 秒：

**吞吐量比较**

| 引擎 | QPS | P50 延迟 | P95 延迟 | 总查询数 |
|--------|-----|-------------|-------------|---------------|
| NeuG | **617** | 3.1 ms | 20.6 ms | 185,156 |
| Neo4j | 12.2 | 16.0 ms | 1,728 ms | 3,659 |

NeuG 实现了 Neo4j **50.6x** 的吞吐量。在延迟方面，NeuG 的 P95 仅为 20.6ms，而 Neo4j 的 P95 达到 1,728ms。

**单查询延迟（P50 ms）**

| 查询 | NeuG | Neo4j | NeuG 获胜 |
|-------|------|-------|-----------|
| IC1 | 6.2 | 5.2 | - |
| IC2 | 3.2 | 8.4 | **2.6x** |
| IC3 | 11.1 | 984.4 | **89x** |
| IC4 | 10.9 | 8.0 | - |
| IC5 | 22.3 | 1892.4 | **85x** |
| IC6 | 2.7 | 423.0 | **159x** |
| IC7 | 4.5 | 4.0 | - |
| IC8 | 2.4 | 1.0 | - |
| IC9 | 3.9 | 829.8 | **212x** |
| IC10 | 5.3 | 84.2 | **16x** |
| IC11 | 2.4 | 6.6 | **2.7x** |
| IC12 | 3.9 | 18.8 | **4.8x** |
| IC13 | 0.4 | 0.8 | **2x** |
| IC14 | 4.5 | 185.2 | **41x** |

NeuG 在 14 个查询中的 10 个获胜，在复杂的多跳和聚合查询上实现了显著加速。

---

## 为什么 NeuG 更快

NeuG 的性能优势来自：

### 嵌入式模式优势

1. **图原生查询优化器**：[GOpt](https://graphscope.io/blog/tech/2024/02/22/GOpt-A-Unified-Graph-Query-Optimization-Framework-in-GraphScope) 执行基于代价的优化，具有图特定的基数估计。

2. **列式向量化执行**：高效的内存管理和缓存友好的遍历。

3. **零序列化开销**：进程内执行，直接内存访问。

### 服务模式优势

1. **MVCC 并发控制**：高效处理并发事务而不阻塞读取。

2. **久经考验的引擎**：NeuG 基于 [GraphScope Flex](https://graphscope.io) 构建，该引擎在 LDBC SNB Interactive 上 [创下世界纪录](https://ldbcouncil.org/benchmarks/snb/interactive/2025-04-21-graphscope-flex-sf300/)，达到 80,000+ QPS。

---

## 可复现性

所有性能结果均可独立复现：

- **数据集**：https://neug.oss-cn-hangzhou.aliyuncs.com/datasets/ldbc-snb-sf1-lsqb.tar.gz
- **LSQB 脚本**：`neug/examples/lsqb_benchmark/`
- **Interactive 脚本**：`neug/examples/ldbc_interactive_benchmark/`
- **教程**：`neug/doc/source/tutorials/benchmark-neug-dual-mode.md`

如果您在复现这些结果时遇到任何问题，请在 [GitHub Issues](https://github.com/alibaba/neug/issues) 报告。