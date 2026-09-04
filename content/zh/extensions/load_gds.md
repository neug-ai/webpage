# GDS（图数据科学）扩展

自 NeuG **v0.1.3** 起，我们引入了 GDS 扩展，它提供了一系列在投影子图上运行的图算法。
它通过 `CALL` 接口，直接在 NeuG 内部支持常见的分析工作负载——社区发现、中心性分析、最短路径计算。

## 快速入门

```cypher
-- 1. 加载图数据科学（GDS）扩展
LOAD gds;

-- 2. 投影一个子图
CALL project_graph(
    'social',
    ['person'],
    [
        '[person, knows, person]'
    ]
);

-- 3. 运行一个算法
CALL page_rank('social', {max_iterations: 20})
RETURN node.fName, rank;

-- 4. 清理资源
CALL drop_projected_graph('social');
```

## 图投影

在运行任何 GDS 算法之前，您必须创建一个 **命名空间（投影图）** —— 即一个具名的子图视图，用于定义该算法所操作的节点标签、边三元组以及可选的谓词。

例如：

```cypher
CALL project_graph(
    'social',
    ['person'],
    [
        '[person, knows, person]'
    ]
);
```

随后，生成的命名空间可直接传入 GDS 算法中使用：

```cypher
CALL page_rank('social', {max_iterations: 20})
RETURN node.fName, rank;
```

命名空间的创建与管理属于 NeuG 的通用功能，并非 GDS 扩展所特有。

有关以下内容的完整文档：

- 使用 `project_graph` 创建命名空间；
- 使用谓词对节点和关系进行过滤；
- 通过 Cypher 查询命名空间；
- 使用 `show_projected_graphs` 和 `projected_graph_info` 检查命名空间；
- 使用 `drop_projected_graph` 删除命名空间；
- 命名空间的持久化及模式/数据更新；

请参阅 [命名空间](../cypher_manual/namespace.md)。

## 算法

所有算法均遵循相同的调用约定：

```cypher
CALL <algorithm_name>('<projected_graph>', {<options>})
RETURN <columns>;
```

每个算法均返回一个 `node` 列（匹配的节点）以及一个或多个结果列。`node` 列的类型为 `NODE`，因此您可在 `RETURN` 子句中通过 `node.<property>` 访问节点属性。

> **注意：** 大多数算法（标签传播算法 Label Propagation、Leiden 算法和 Louvain 算法除外）要求输入一个**同构图**子图——即仅包含一种节点标签，且边三元组也仅有一种，其源节点标签与目标节点标签均需与该节点标签一致。

### PageRank

计算每个节点的 PageRank 中心性得分。得分越高表示该节点在图中的影响力越大。

```cypher
CALL page_rank('<graph_name>', {<options>})
RETURN node, rank;
```

**选项：**

| 选项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `damping_factor` | DOUBLE | `0.85` | 跟随链接的概率（相对于随机跳转） |
| `max_iterations` | INT | `20` | 最大迭代次数 |
| `directed` | BOOL | `false` | 是否将边视为有向边 |
| `concurrency` | INT | CPU 核心数 | 并行执行的线程数 |

**输出列：**

| 列 | 类型 | 描述 |
|---|---|---|
| `node` | NODE | 节点 |
| `rank` | DOUBLE | PageRank 得分 |

**示例：**

```cypher
CALL project_graph('social', ['person'], {'[person, knows, person]': ''});
LOAD gds;

CALL page_rank('social', {damping_factor: 0.85, max_iterations: 30})
RETURN node.fName, rank
ORDER BY rank DESC;
```

**谓词支持：** 同时支持节点和边谓词。

---

### BFS（广度优先搜索）

计算从源节点到所有可达节点的最短跳数距离。

```cypher
CALL bfs('<graph_name>', {<options>})
RETURN node, distance;
```

**选项：**

| 选项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `source` | STRING | *(必填)* | 源节点的主键值 |
| `directed` | BOOL | `false` | 是否仅按边的存储方向进行遍历 |
| `concurrency` | INT | CPU 核心数 | 线程数 |

**输出列：**

| 列 | 类型 | 描述 |
|---|---|---|
| `node` | NODE | 节点 |
| `distance` | INT64 | 从源节点出发的跳数 |
| `path` | PATH | 从源节点到该节点的最短路径（可选，仅在 YIELD 时返回） |

**示例：**

```cypher
CALL bfs('social', {source: '0'})
RETURN node.fName, distance
ORDER BY distance;
```

**返回路径：**

```cypher
-- 返回实际的最短路径
CALL bfs('social', {source: '0'})
YIELD node, distance, path
RETURN node.fName, distance, path;

-- 提取路径详情
CALL bfs('social', {source: '0'})
YIELD node, distance, path
RETURN node.fName, distance,
       nodes(path) AS path_nodes,
       relationships(path) AS path_edges;
```

**谓词支持：** 支持节点和边谓词。

---

### SSSP（单源最短路径）

计算从源节点到所有可达节点的最短加权路径距离。如果没有权重属性，其行为类似于 BFS，但返回 `DOUBLE` 类型的距离。

```cypher
CALL sssp('<graph_name>', {<options>})
RETURN node, distance;
```

**选项：**

| 选项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `source` | STRING | *(必填)* | 源节点的主键值 |
| `directed` | BOOL | `false` | 是否仅按边的存储方向遍历 |
| `weight` | STRING | `""` | 用作权重的边属性名称（空表示单位权重） |
| `concurrency` | INT | CPU 核心数 | 线程数 |

**输出列：**

| 列 | 类型 | 描述 |
|---|---|---|
| `node` | NODE | 节点 |
| `distance` | DOUBLE | 从源节点出发的最短路径距离 |
| `path` | PATH | 从源节点到该节点的最短路径（可选，仅在 YIELD 时返回） |

**示例：**

```cypher
CALL sssp('social', {source: '0', weight: 'cost', directed: true})
RETURN node.fName, distance;
```

**返回路径：**

```cypher
-- 返回实际的最短路径
CALL sssp('social', {source: '0', weight: 'cost'})
YIELD node, distance, path
RETURN node.fName, distance, path;

-- 查找通往特定目标节点的路径
CALL sssp('social', {source: '0', weight: 'cost'})
YIELD node, distance, path
WHERE node.id = '42'
RETURN distance, path;
```

**谓词支持：** 同时支持节点和边谓词。

---

### WCC（弱连通分量）

为每个节点分配一个分量 ID。同一个连通分量中的节点共享相同的 ID。

```cypher
CALL wcc('<graph_name>', {<options>})
RETURN node, comp;
```

**选项：**

| 选项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `concurrency` | INT | CPU 核心数 | 线程数 |

**输出列：**

| 列 | 类型 | 描述 |
|---|---|---|
| `node` | NODE | 节点 |
| `comp` | INT64 | 分量标识符 |

**示例：**

```cypher
CALL wcc('social', {concurrency: 8})
RETURN node.fName, comp
ORDER BY comp;
```

**谓词支持：** 同时支持节点和边谓词。

---

### LCC（局部聚类系数）

衡量一个节点的邻居形成完全图（团）的紧密程度。取值范围为 0.0 到 1.0。

```cypher
CALL lcc('<graph_name>', {<options>})
RETURN node, lcc;
```

**选项：**

| 选项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `directed` | BOOL | `false` | 是否计算有向聚类系数 |
| `degree_threshold` | INT | MAX_INT | 跳过度数高于此阈值的节点 |
| `concurrency` | INT | CPU cores | 并行执行的线程数 |

**输出列：**

| 列 | 类型 | 描述 |
|---|---|---|
| `node` | NODE | 节点 |
| `lcc` | DOUBLE | 局部聚类系数 |

**示例：**

```cypher
CALL lcc('social', {degree_threshold: 1000})
RETURN node.fName, lcc
ORDER BY lcc DESC;
```

**谓词支持：** 支持节点和边谓词。

---

### K核分解

计算每个节点的核数。若一个节点属于 *k*-核（即每个节点度数均 >= *k* 的极大子图），但不属于 *(k+1)*-核，则该节点的核数为 *k*。

```cypher
CALL kcore('<graph_name>', {<options>})
RETURN node, core;
```

**选项：**

| 选项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `k` | INT | `2` | 最小核数阈值（必须 >= 0） |
| `concurrency` | INT | CPU 核数 | 线程数 |

**输出列：**

| 列 | 类型 | 描述 |
|---|---|---|
| `node` | NODE | 节点 |
| `core` | INT64 | 节点的核数 |

**示例：**

```cypher
CALL kcore('social', {k: 3})
RETURN node.fName, core
ORDER BY core DESC;
```

**谓词支持：** 支持节点和边谓词。

---

### CDLP（基于标签传播的社区发现）

一种通过网络传播标签来进行社区发现的算法。
每个节点最初被赋予一个唯一的标签；在每次迭代中，每个节点采用其邻居中出现频率最高的标签。

```cypher
CALL cdlp('<graph_name>', {<options>})
RETURN node, label;
```

**可选参数：**

| 参数 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `max_iterations` | INT | `5` | 标签传播的最大迭代次数 |
| `concurrency` | INT | `1` | 并行执行所使用的线程数 |

**输出列：**

| 列名 | 类型 | 描述 |
|---|---|---|
| `node` | NODE | 节点 |
| `label` | INT64 | 分配给该节点的社区标签 |

**示例：**

```cypher
CALL project_graph(
    'study_net',
    {'person': 'n.age > 20', 'organisation': 'n.name = "MIT"'},
    {'[person, studyAt, organisation]': 'r.year > 2010'}
);
LOAD gds;

CALL cdlp('study_net', {concurrency: 10})
RETURN node.id, node.fName, node.name, label;
```

**谓词支持：** 同时支持节点谓词和边谓词。

**注意：** 当前 CDLP 与其他大多数算法一样，仅支持同构图。
对多标签的支持计划在后续版本中推出。

### Louvain

一种社区发现算法，通过迭代地将节点在社区之间移动并聚合图形成超节点，以优化模块度（modularity）。

Louvain 支持**多标签图（multi-label graphs）**——即包含多个顶点标签和多个边三元组的投影图，会被视为一个统一的图进行处理。

```cypher
CALL louvain('<graph_name>', {<options>})
RETURN node, community;
```

**选项（Options）：**

| 选项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `resolution` | DOUBLE | `1.0` | 分辨率参数（gamma）。值大于 1 倾向于生成更小的社区；小于 1 倾向于生成更大的社区 |
| `directed` | BOOL | `false` | 是否将图视为有向图 |
| `threshold` | DOUBLE | `1e-7` | 模块度增益收敛阈值 |
| `concurrency` | INT | CPU 核心数 | 并行执行所用线程数 |
| `initial_community_property` | STRING | `""` | 用于初始化社区 ID 的顶点属性名，适用于增量更新。设置后，默认启用“冻结分配（freeze-assign）”模式，即已存在的顶点社区归属被冻结。 |
| `allow_relocation` | BOOL | `false` | 若为 `true`，允许已存在的顶点被重新分配至其他社区（热启动模式，warm-start mode）；若为 `false`（默认），已存在顶点的社区归属保持不变。 |
| `weight` | STRING | `""` | 用作边权重的边属性名。若设置，算法将采用加权模块度；若为空（默认），所有边权重均为 1.0（无权图）。 |

**输出列（Output columns）：**

| 列名 | 类型 | 描述 |
|---|---|---|
| `node` | NODE | 节点 |
| `community` | INT64 | 社区 ID（从 0 开始编号） |
| `previous_community` | INT64 | 上一次运行所得的社区 ID。仅当设置了 `initial_community_property`，或该顶点此前未被分配过社区时，此字段才非 NULL。 |

**示例（单标签图）：**

```cypher
CALL louvain('social', {resolution: 1.0, concurrency: 8})
RETURN node.fName, community
ORDER BY community;
```

**示例（多标签图）：**

```cypher
CALL project_graph(
    'social_multi',
    ['person', 'organisation'],
    {'[person, knows, person]': '', '[person, studyAt, organisation]': ''}
);

CALL louvain('social_multi', {concurrency: 8})
RETURN node.fName, community
ORDER BY community;
```

**增量模式（Incremental mode）：**
为在多次运行中保持社区 ID 一致，可将结果写回顶点属性，并在后续调用中通过 `initial_community_property` 参数复用。默认采用**冻结分配（freeze-assign）模式**：已存在顶点的社区归属保持不变，仅对无先前社区归属的新顶点进行聚类。

```cypher
-- 1. 添加一列用于存储社区 ID
ALTER TABLE person ADD COLUMN comm INT64 DEFAULT -1;

-- 2. 首次运行：计算社区并将结果写回顶点属性
CALL louvain('social', {concurrency: 8}) YIELD node, community
MATCH (n:person) WHERE n.id = node.id
SET n.comm = community;

-- 3. 使用冻结分配（默认）再次运行：旧顶点社区冻结，新顶点参与聚类
CALL louvain('social', {initial_community_property: 'comm', concurrency: 8})
RETURN node.fName, community
ORDER BY community;

-- 3b. 替代方案：热启动模式（允许旧顶点被重新分配）
CALL louvain('social', {initial_community_property: 'comm', allow_relocation: true, concurrency: 8})
RETURN node.fName, community
ORDER BY community;
```

**增量差分分析（Incremental delta analysis）：**
当使用 `initial_community_property` 运行时，可通过 `YIELD` 获取可选的 `previous_community` 列，以逐顶点分析社区归属变化。在冻结分配模式下，新顶点的 `previous_community` 为 `NULL`，而已存在顶点的 `previous_community` 等于其当前 `community`。

```cypher
-- 迁移矩阵：统计顶点在社区间的迁移情况
CALL louvain('social', {initial_community_property: 'comm', allow_relocation: true, concurrency: 8})
YIELD node, community, previous_community
RETURN previous_community, community, count(*) AS members
ORDER BY previous_community, community;

-- 新增顶点（冻结分配模式）：previous_community 为 NULL
CALL louvain('social', {initial_community_property: 'comm', concurrency: 8})
YIELD node, community, previous_community
WHERE previous_community IS NULL
RETURN node.id, community;
```

**谓词支持（Predicate support）：** 同时支持节点谓词与边谓词。

### Leiden

一种社区发现算法，在 Louvain 算法基础上增加了**细化阶段（refinement phase）**，从而提升社区划分质量。该细化阶段允许在执行过程中对已有社区进行拆分，因而能更准确地识别小型社区，并生成更高品质的社区划分结果。

Leiden 支持**多标签图（multi-label graphs）**——即一个投影图中可包含多种顶点标签及多种边三元组，系统将其统一视为单个图进行处理。

```cypher
CALL leiden('<graph_name>', {<options>})
RETURN node, community;
```

**参数选项（Options）：**

| 选项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `resolution` | DOUBLE | `1.0` | 分辨率参数（gamma）。值 > 1 倾向于发现更小的社区；值 < 1 倾向于发现更大的社区 |
| `directed` | BOOL | `false` | 是否将图视为有向图 |
| `threshold` | DOUBLE | `1e-7` | 模块度增益收敛阈值 |
| `concurrency` | INT | CPU 核心数 | 并行执行所用线程数 |
| `initial_community_property` | STRING | `""` | 用于指定顶点属性名，以初始化社区 ID，支持增量式更新。若设置该参数，则默认启用 **冻结分配模式（freeze-assign mode）**，即已存在顶点的社区归属被冻结（保持不变）。 |
| `allow_relocation` | BOOL | `false` | 若为 `true`，则允许已存在顶点被重新分配至其他社区（即“热启动模式”，warm-start mode）；若为 `false`（默认），则已存在顶点的社区归属保持不变。 |
| `weight` | STRING | `""` | 指定边属性名，作为边权重。若设置该参数，算法将采用加权模块度（weighted modularity）；若为空（默认），所有边权重均为 1.0（即无权图）。 |

**输出列（Output columns）：**

| 列名 | 类型 | 描述 |
|---|---|---|
| `node` | NODE | 顶点 |
| `community` | INT64 | 社区 ID（从 0 开始编号） |
| `previous_community` | INT64 | 上一次运行所得的社区 ID。仅当设置了 `initial_community_property`，或该顶点此前未被分配过社区时，该字段才非 NULL。 |

**示例（单标签图）：**

```cypher
CALL leiden('social', {resolution: 1.5, concurrency: 8})
RETURN node.fName, community
ORDER BY community;
```

**示例（多标签图）：**

```cypher
CALL project_graph(
    'social_multi',
    ['person', 'organisation'],
    {'[person, knows, person]': '', '[person, studyAt, organisation]': ''}
);

CALL leiden('social_multi', {concurrency: 8})
RETURN node.fName, community
ORDER BY community;
```

**增量模式（Incremental mode）：**
为在多次运行间保持社区 ID 的一致性，可将结果写回顶点属性，并在后续调用中通过 `initial_community_property` 参数复用该属性。默认采用 **冻结分配模式（freeze-assign mode）**：已存在顶点的社区归属保持不变，仅对新增顶点（此前无社区归属）执行聚类。

```cypher
-- 1. 添加一列属性用于存储社区 ID
ALTER TABLE person ADD COLUMN comm INT64 DEFAULT -1;

-- 2. 首次运行：计算社区并写回顶点属性
CALL leiden('social', {concurrency: 8}) YIELD node, community
MATCH (n:person) WHERE n.id = node.id
SET n.comm = community;

-- 3. 使用冻结分配模式（默认）再次运行：旧顶点社区冻结，新顶点被分配
CALL leiden('social', {initial_community_property: 'comm', concurrency: 8})
RETURN node.fName, community
ORDER BY community;

-- 3b. 替代方案：热启动模式（允许旧顶点被重新分配）
CALL leiden('social', {initial_community_property: 'comm', allow_relocation: true, concurrency: 8})
RETURN node.fName, community
ORDER BY community;
```

**增量差分分析（Incremental delta analysis）：**
当使用 `initial_community_property` 运行时，可通过 `YIELD` 子句获取可选的 `previous_community` 列，以逐顶点分析社区归属变化。在冻结分配模式下，新顶点的 `previous_community` 为 `NULL`，而已存在顶点的 `previous_community` 等于其当前 `community`。

```cypher
-- 迁移矩阵：统计顶点在社区间的迁移情况
CALL leiden('social', {initial_community_property: 'comm', allow_relocation: true, concurrency: 8})
YIELD node, community, previous_community
RETURN previous_community, community, count(*) AS members
ORDER BY previous_community, community;

-- 新增顶点（冻结分配模式）：previous_community 为 NULL
CALL leiden('social', {initial_community_property: 'comm', concurrency: 8})
YIELD node, community, previous_community
WHERE previous_community IS NULL
RETURN node.id, community;
```

**谓词支持（Predicate support）：** 同时支持顶点谓词与边谓词。

**Leiden 与 Louvain 对比：**
- 若需更高品质的社区划分结果，或更优的小型社区检测能力，请选用 **Leiden**；
- 若追求极致运行速度，请选用 **Louvain**。

## 最短路径返回

BFS 和 SSSP 算法除了支持返回距离外，还支持返回实际的最短路径（节点和关系的序列）。该路径以 `PATH` 类型返回，支持所有标准的 Cypher 路径函数。

### 请求路径

path 列是可选的，只有在显式 YIELD 时才会返回：

```cypher
-- 不包含路径（默认，最快）
CALL bfs('graph', {source: '0'})
RETURN node, distance;

-- 包含路径（返回从源节点到每个节点的最短路径）
CALL bfs('graph', {source: '0'})
YIELD node, distance, path
RETURN node, distance, path;
```

### 处理路径

使用标准的 Cypher 路径函数来提取信息：

```cypher
-- 获取路径中的节点和关系
CALL bfs('graph', {source: '0'})
YIELD node, distance, path
RETURN nodes(path) AS path_nodes,
       relationships(path) AS path_rels,
       length(path) AS path_length;

-- 按长度过滤路径
CALL bfs('graph', {source: '0'})
YIELD node, distance, path
WHERE length(path) > 2
RETURN node, distance, path;

-- 查找特定目标
CALL sssp('graph', {source: '0', weight: 'cost'})
YIELD node, distance, path
WHERE node.id = '42'
RETURN distance, path;
```

### 性能注意事项

- **未 YIELD 时无额外开销**：如果您不请求 `path` 列，与仅查询距离相比，不会产生任何性能损耗。
- **默认为完整模式**：默认情况下，路径包含所有顶点和边属性，这与标准 `MATCH p = ...` 查询的行为一致，以确保向后兼容性。
- **大型结果集**：当返回大量节点的路径时，请注意路径序列化会包含所有顶点和边属性，在大型图中可能会占用大量内存。

## 算法概览

| 算法 | CALL 名称 | 输出列 | 关键选项 |
|---|---|---|---|
| PageRank | `page_rank` | `node`, `rank` | `damping_factor`, `max_iterations`, `directed` |
| BFS | `bfs` | `node`, `distance`, `path` | `source`（必需）、`directed` |
| SSSP | `sssp` | `node`, `distance`, `path` | `source`（必需）、`weight`, `directed` |
| WCC | `wcc` | `node`, `comp` | `concurrency` |
| LCC | `lcc` | `node`, `lcc` | `directed`, `degree_threshold` |
| K-Core | `kcore` | `node`, `core` | `k` |
| CDLP | `cdlp` | `node`, `label` | `max_iterations` |
| Louvain | `louvain` | `node`, `community`, `previous_community`（*可选*） | `resolution`, `directed`, `threshold`, `concurrency`, `initial_community_property`, `allow_relocation`, `weight` |
| Leiden | `leiden` | `node`, `community`, `previous_community`（*可选*） | `resolution`, `directed`, `threshold`, `concurrency`, `initial_community_property`, `allow_relocation`, `weight` |

**注意：** BFS 和 SSSP 的 `path` 列为可选列，仅当显式在 YIELD 子句中指定时才返回。Louvain 和 Leiden 的 `previous_community` 列始终可被 YIELD，但仅当设置了 `initial_community_property` 时其值才非 NULL。详见各算法的独立章节说明。

## 常用选项

所有算法均支持 `concurrency` 选项，用于控制并行计算所使用的线程数。默认值因算法而异：

- **大多数算法：** 默认值为 CPU 核心数
- **标签传播、Personalized PageRank：** 默认值为 `1`

## 局限性

- 大多数算法要求输入为**同构图**子图（即仅含一种节点标签和一种边三元组 `[A, edge, A]`）。**Leiden 和 Louvain** 是例外，它们支持具有多种节点标签和多种边三元组的多标签图。其他算法对异构图的支持计划在后续版本中推出。
- CDLP 目前实际上尚不支持异构图——它仅处理第一个节点标签和第一个边三元组。真正的多标签支持正在规划中。
