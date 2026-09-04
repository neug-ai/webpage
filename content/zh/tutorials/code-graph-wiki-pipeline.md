# 使用图构建代码维基

本教程展示了如何利用图算法**构建并维护一个代码维基**，使用 NeuG（版本 ≥ v0.2.0）及其 GDS（图数据科学）扩展：

1. **构建** —— 导入文件级关系图，使用 Leiden 算法检测维基章节边界，并使用 PageRank 算法为每个章节选取核心文件。
2. **更新** —— 增量式添加新文件，采用冻结分配（freeze-assign）Leiden 算法重新聚类（确保已有章节保持稳定），并使用 Cypher 计算章节级变更（delta）。

本教程以从 NeuG 代码库中提取的文件级关系图为运行示例：
每个节点代表一个源文件，每条边表示“文件 A 与文件 B 相关”。这些关系源自底层代码图——例如，若文件 A 中的某个函数调用了文件 B 中的某个函数，则 A 和 B 之间存在一条边。

**耗时**：约 15 分钟
**前提条件**：`pip install neug>=0.2.0`

## 数据

本教程使用两个 CSV 文件：

| 文件                         | 列名                        | 描述                                                                 |
| ---------------------------- | --------------------------- | -------------------------------------------------------------------- |
| `file_cluster_nodes.csv`   | `id, label`                 | 每行对应一个源文件。`id` 为文件路径，`label` 为文件名。             |
| `file_cluster_edges.csv`   | `from_file, to_file, weight` | 每行对应一个关系。`from_file` 与 `to_file` 存在关联（例如：A 中的函数调用了 B 中的函数）。 |

这些文件托管在阿里云 OSS 上，并通过 `httpfs` 扩展直接加载至 NeuG —— 无需手动下载：

```python
OSS_NODES = "oss://neug/tutorial/neug-wiki-files/file_cluster_nodes.csv"
OSS_EDGES = "oss://neug/tutorial/neug-wiki-files/file_cluster_edges.csv"
```

> **注意**：该数据集共包含 **1,332 个文件** 和 **2,982 条边**。请确保在执行下方导入查询前，已安装并加载 `httpfs`（依次执行 `install httpfs` 和 `load httpfs`）。

## 步骤 1：设置数据库并加载 GDS

NeuG 在 `gds` 扩展中提供了图算法（Leiden、PageRank、BFS、SSSP 等）。请首先加载该扩展：

```python
from neug import Database
import tempfile

db = Database(db_path=tempfile.mkdtemp(), mode="w")
conn = db.connect()

conn.execute("install httpfs")  # 仅需执行一次
conn.execute("install gds")     # 仅需执行一次
conn.execute("load httpfs")     # 为当前会话启用
conn.execute("load gds")
```

> **注意**：`load gds` 用于在当前会话中启用该扩展。如果尚未安装，请先运行一次 `install gds` 以下载该扩展。

## 步骤 2：导入文件级图

`COPY TEMP` 会自动从 CSV 文件推断模式（schema）——无需编写 `CREATE TABLE` DDL 语句。第一列将作为节点的主键；对于边，前两列分别表示源节点和目标节点，并通过 `from` / `to` 指定端点标签。

```python

# 节点：第一列（id）为主键，模式自动推断
conn.execute(f"""
    COPY TEMP file FROM "{OSS_NODES}" (
        CREDENTIALS_KIND='Anonymous', ENDPOINT_OVERRIDE='oss-cn-beijing.aliyuncs.com',
        header=true, delimiter=','
    )
""")

# 边：前两列分别为源节点/目标节点的键值
conn.execute(f"""
    COPY TEMP depends FROM "{OSS_EDGES}" (
        CREDENTIALS_KIND='Anonymous', ENDPOINT_OVERRIDE='oss-cn-beijing.aliyuncs.com',
        header=true, delimiter=',',
        from='file', to='file'
    )
""")
```

验证导入结果：

```python
print(list(conn.execute("MATCH (f:file) RETURN count(f)")))        # [[1332]]
print(list(conn.execute("MATCH ()-[d:depends]->() RETURN count(d)")))  # [[2982]]
```

## 步骤 3：为 GDS 投影图

GDS 算法在**投影图（projected graph）**上运行——这是一种专为计算优化的内存中视图。
请投影 `file` 节点及其 `depends` 边：

```python
conn.execute("""
    CALL project_graph(
        'code_graph',
        ['file'],
        {'[file, depends, file]': ''}
    )
""")
```

第三个参数将边三元组 `[起始标签, 关系类型, 目标标签]` 映射到一个可选的谓词（行过滤条件）。空字符串表示“不进行过滤”——即包含该类型的所有边。

## 步骤 4：使用 Leiden 算法检测概念边界

高度相关的文件会自然聚类到同一社区中——该聚类结果与目录结构无关。运行 Leiden 社区发现算法：

```python
result = conn.execute("""
    CALL leiden('code_graph', {concurrency: 1})
    YIELD node, community
    RETURN node.label, community
    ORDER BY community
""")
for row in result:
    print(row)
```

预期输出（已截断）：

```
['benchmark.cc', 5]
['main.cc', 5]
...
['binder.h', 19]
['logical_plan.h', 19]
...
```

统计社区数量：

```python
n_comm = list(conn.execute("""
    CALL leiden('code_graph', {concurrency: 1})
    YIELD node, community
    RETURN count(DISTINCT community)
"""))[0][0]
print(n_comm)  # 30
```

> **关于可重现性的重要说明**：设置 `concurrency: 1` 可获得**确定性**的社区划分结果。
> 若启用多线程，不同运行间社区数量可能略有差异。当图结构（而非大语言模型）作为“该文件属于哪个概念”的唯一事实来源时，确定性的输出正是你所需要的。

### 将社区信息写回节点

为了后续按社区进行筛选（以及为增量更新提供初始种子），需将社区 ID 存储在每个节点上。首先添加一列，然后写入数据：

```python
conn.execute("ALTER TABLE file ADD community INT64")

conn.execute("""
    CALL leiden('code_graph', {concurrency: 1})
    YIELD node, community
    MATCH (f:file) WHERE f.id = node.id
    SET f.community = community
""")
```

> **注意**：NeuG 不支持 `ADD COLUMN` 关键字，请使用 `ALTER TABLE file ADD community INT64`。

## 步骤 5：使用 PageRank 选取核心文件

每个社区都是一个候选“概念”（即维基页面的一个章节）。但为了撰写该章节，你应阅读哪些文件？PageRank 依据文件在全球引用关系中的重要性对其进行排序，因此被引用最多的文件将排在最前面。

全局最重要的前 5 个文件：

```python
result = conn.execute("""
    CALL page_rank('code_graph', {max_iterations: 20})
    YIELD node, rank
    RETURN node.label, rank
    ORDER BY rank DESC
    LIMIT 5
""")
for label, rank in result:
    print(f"{label:30s} {rank:.6f}")
```

预期输出：

```
binder.h                       0.015460
operator.h                     0.015152
database.py                    0.011829
string_format.h                0.010160
types.h                        0.009774
```

单个社区内最重要的前 5 个文件（此处为社区 `0`，即规模最大的社区，共含 191 个文件）：

```python
result = conn.execute("""
    CALL page_rank('code_graph', {max_iterations: 20})
    YIELD node, rank
    WITH node, rank WHERE node.community = 0
    RETURN node.label, rank
    ORDER BY rank DESC
    LIMIT 5
""")
for label, rank in result:
    print(f"{label:30s} {rank:.6f}")
```

预期输出：

```
string_format.h                0.010160
types.h                        0.009774
value_vector.h                 0.006664
timestamp_t.h                  0.006314
types.h                        0.003926
```

> **注意**：你不能在 `YIELD` 后直接使用 `WHERE` 子句。必须先通过 `WITH node, rank WHERE ...` 进行过渡，再执行 `RETURN`。

至此，**构建（Build）阶段**已完成：你已获得稳定的维基章节边界（Leiden 算法结果），以及每个章节对应的、经 PageRank 排序的核心文件阅读列表。将这两部分信息作为结构化起点输入大语言模型（LLM）——它将基于社区划分决定维基章节的组织方式，并优先阅读 PageRank 排名靠前的核心文件，而非凭猜测判断哪些源文件更为重要。

## 第六步：使用冻结分配 Leiden 算法进行增量更新

代码每天都在变化，因此维基文档不能“一劳永逸”地编写完成就束之高阁。真正的挑战在于：**在不发生偏移的前提下**更新维基文档的各个章节——例如，更新前名为“编译器”的章节，在更新后仍应保持名称为“编译器”。

NeuG 的 **冻结分配 Leiden（freeze-assign Leiden）** 算法正是为此而设计：已存在的顶点其社区归属保持冻结不变，仅对新加入的顶点执行聚类。

### 6.1 追加新文件

假设向 GDS 扩展中新增了三个模式匹配算法文件，每个新文件均与两个已有文件相关。将这些新节点和边以小型 CSV 文件形式暂存，并使用 `COPY` 命令将其追加至现有的 `file` / `depends` 表中：

```python
new_files = [
    "extension/gds/include/impl/pattern_match_impl.h",
    "extension/gds/include/impl/subgraph_match_impl.h",
    "extension/gds/include/impl/motif_count_impl.h",
]
targets = [
    "extension/gds/include/utils/subgraph_utils.h",
    "extension/gds/include/gds_algo_function_collection.h",
]

# 追加新的文件节点。community = -1 是一个哨兵值，表示“无先前社区”。

# 因此 freeze-assign 将它们视为全新的顶点。

# 注意：CSV 文件必须包含 `file` 表的所有当前列（包括 `community` 列）。
nodes_csv = os.path.join(tempfile.mkdtemp(), "new_nodes.csv")
with open(nodes_csv, "w") as fp:
    fp.write("id,label,community\n")
    for f in new_files:
        fp.write(f"{f},{os.path.basename(f)},-1\n")

conn.execute(f"""
    COPY file FROM "{nodes_csv}" (
        header=true, delimiter=','
    )
""")

# 追加边：每个新文件都与现有文件相关。将它们追加到

# 使用 COPY 导入现有的 `depends` 边表。
edges_csv = os.path.join(tempfile.mkdtemp(), "new_edges.csv")
with open(edges_csv, "w") as fp:
    fp.write("from_file,to_file,weight\n")
    for f in new_files:
        for t in targets:
            fp.write(f"{f},{t},1\n")

conn.execute(f"""
    COPY depends FROM "{edges_csv}" (
        header=true, delimiter=',',
        from='file', to='file'
    )
""")

print(list(conn.execute("MATCH (f:file) RETURN count(f)")))  # [[1335]]
```

> **注意**：`community = -1` 是一个哨兵值——任何真实的社区 ID 均 `>= 0`，因此 `-1` 明确表示“尚未分配”。

### 6.2 重新投影与重新聚类

删除过时的投影图，重新进行投影以包含新增的节点和边，然后通过传入 `initial_community_property` 参数运行冻结分配式 Leiden 算法：

```python
conn.execute("CALL drop_projected_graph('code_graph')")
conn.execute("CALL project_graph('code_graph', ['file'], {'[file, depends, file]': ''})")

result = conn.execute("""
    CALL leiden('code_graph', {concurrency: 1, initial_community_property: 'community'})
    YIELD node, community, previous_community
    RETURN node.id, community, previous_community
""")
for nid, community, prev in result:
    if prev is None:                      # 新分配的顶点
        print(f"NEW: {os.path.basename(nid)} -> community {community}")
```

预期输出：

```
NEW: pattern_match_impl.h -> community 3
NEW: subgraph_match_impl.h -> community 3
NEW: motif_count_impl.h -> community 3
```

对于新顶点，`previous_community` 为 `NULL`；而对于已冻结的现有顶点，`previous_community` 等于 `community`。这三个新文件被分配至社区 `3` —— 与其关联的文件所属的社区概念一致；而所有现有顶点则保持其原始社区归属不变。

### 6.3 计算社区级别的增量（delta）

仅需为实际发生变更的社区重新生成下游内容。按社区分组，并将每个社区分类为 `stable`（稳定）、`growth`（增长）或 `new`（新增）：

```python
result = conn.execute("""
    CALL leiden('code_graph', {concurrency: 1, initial_community_property: 'community'})
    YIELD node, community, previous_community
    WITH community, count(*) AS total, count(previous_community) AS old_members
    RETURN community, total - old_members AS new_members,
      CASE WHEN old_members = 0      THEN 'new'
           WHEN old_members = total  THEN 'stable'
           ELSE 'growth' END AS change_type
""")
for community, new_members, change_type in result:
    if change_type != 'stable':
        print(f"community {community}: {change_type} (+{new_members})")
```

预期输出：

```
community 3: growth (+3)
```

在全部 30 个社区中，29 个为 `stable`（可直接复用其现有 Wiki 章节），仅有社区 `3` 发生了增长——因此只需对该章节进行增量重写。这便是对问题“知识库中哪些部分受此次变更影响？”所给出的结构化答案。

将该增量（delta）结果传给大语言模型（LLM），它便只需重写受影响的章节，其余 29 个章节保持不变。

## 完整可运行脚本

```python
import os
import tempfile
from neug import Database

OSS_NODES = "oss://neug/toturial/neug-wiki-files/file_cluster_nodes.csv"
OSS_EDGES = "oss://neug/toturial/neug-wiki-files/file_cluster_edges.csv"

db = Database(db_path=tempfile.mkdtemp(), mode="w")
conn = db.connect()
conn.execute("install httpfs")
conn.execute("load httpfs")
conn.execute("install gds")  # 仅需执行一次
conn.execute("load gds")

# ---- 构建 ----
conn.execute(f"""
    COPY TEMP file FROM "{OSS_NODES}" (
        CREDENTIALS_KIND='Anonymous', ENDPOINT_OVERRIDE='oss-cn-beijing.aliyuncs.com',
        header=true, delimiter=','
    )
""")
conn.execute(f"""
    COPY TEMP depends FROM "{OSS_EDGES}" (
        CREDENTIALS_KIND='Anonymous', ENDPOINT_OVERRIDE='oss-cn-beijing.aliyuncs.com',
        header=true, delimiter=',',
        from='file', to='file'
    )
""")
conn.execute("ALTER TABLE file ADD community INT64")

conn.execute("CALL project_graph('code_graph', ['file'], {'[file, depends, file]': ''})")
conn.execute("""
    CALL leiden('code_graph', {concurrency: 1})
    YIELD node, community
    MATCH (f:file) WHERE f.id = node.id
    SET f.community = community
""")
print("社区数量:", list(conn.execute(
    "MATCH (f:file) RETURN count(DISTINCT f.community)"))[0][0])  # 30

print("全局 PageRank 前5名:", list(conn.execute("""
    CALL page_rank('code_graph', {max_iterations: 20})
    YIELD node, rank RETURN node.label, rank
    ORDER BY rank DESC LIMIT 5
""")))

# ---- 更新 ----
new_files = ["extension/gds/include/impl/pattern_match_impl.h",
           "extension/gds/include/impl/subgraph_match_impl.h",
           "extension/gds/include/impl/motif_count_impl.h"]
targets = ["extension/gds/include/utils/subgraph_utils.h",
           "extension/gds/include/gds_algo_function_collection.h"]

nodes_csv = os.path.join(tempfile.mkdtemp(), "new_nodes.csv")
with open(nodes_csv, "w") as fp:
    fp.write("id,label,community\n")
    for f in new_files:
        fp.write(f"{f},{os.path.basename(f)},-1\n")
conn.execute(f"""
    COPY file FROM "{nodes_csv}" (
        header=true, delimiter=','
    )
""")

edges_csv = os.path.join(tempfile.mkdtemp(), "new_edges.csv")
with open(edges_csv, "w") as fp:
    fp.write("from_file,to_file,weight\n")
    for f in new_files:
        for t in targets:
            fp.write(f"{f},{t},1\n")
conn.execute(f"""
    COPY depends FROM "{edges_csv}" (
        header=true, delimiter=',',
        from='file', to='file'
    )
""")

conn.execute("CALL drop_projected_graph('code_graph')")
conn.execute("CALL project_graph('code_graph', ['file'], {'[file, depends, file]': ''})")
print("delta:", list(conn.execute("""
    CALL leiden('code_graph', {concurrency: 1, initial_community_property: 'community'})
    YIELD node, community, previous_community
    WITH community, count(*) AS total, count(previous_community) AS old_members
    RETURN community, total - old_members AS new_members,
      CASE WHEN old_members = 0 THEN 'new'
           WHEN old_members = total THEN 'stable'
           ELSE 'growth' END AS change_type
""")))

conn.execute("CALL drop_projected_graph('code_graph')")
conn.close()
db.close()
```
