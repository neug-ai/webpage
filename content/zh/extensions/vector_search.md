# 向量搜索扩展

自 NeuG v0.2.0 起，NeuG 通过专用的 `vector_search` 扩展提供向量搜索能力。

有关所有索引类型（包括检查、事务与恢复）所共用的语法和保障机制，请参阅 [存储索引](../storage_index/index.md)。

向量搜索扩展通过融合向量存储、距离计算以及基于 HNSW 的近似最近邻（ANN）索引，实现对图数据的高效相似性搜索。

.. warning::

   **余弦 HNSW 索引创建默认会覆写向量数据**

   创建余弦 HNSW 索引时，默认启用 ``cosine_normalize = true``。
   NeuG 可能永久性地将被索引属性中的每个现有值替换为其 L2 归一化后的值。
   原始向量及其模长将永久丢失，且无法恢复（即使执行 ``DROP INDEX`` 后亦不可恢复）。

   若需保留现有属性值，请显式设置 ``cosine_normalize = false``。在此模式下，您须自行确保所有现有及未来新增的向量均为合法的 L2 归一化向量。

   ``cosine_normalize`` 仅适用于余弦 HNSW 索引；对内积（IP）或 L2 HNSW 索引无任何影响，后者始终保留原始向量。NeuG 不支持也不建议对该选项用于 IP/L2 数据的归一化处理，因为这将导致模长信息丢失，并改变距离语义。

主要特性包括：

- **可选的向量搜索扩展**
  - 向量搜索功能通过专用的 `vector_search` 扩展提供。
  - 用户可根据自身需求安装并启用该扩展。

- **原生向量数据类型支持**
  - 向量以定长 `ARRAY` 列形式存储。
  - 当前支持稠密 FP32 向量。

- **多种距离度量方式**
  - L2 距离返回 zvec 所采用的平方欧氏距离；数值越小，表示向量越相似。
  - 余弦距离衡量两个向量方向上的差异；数值越小，表示其方向越接近。
  - 内积衡量向量的方向对齐程度与模长大小；数值越大，表示向量越相似。

- **基于 HNSW 的近似最近邻搜索**
  - 通过 `HNSWIndex` 支持高效的 Top-K 近似最近邻搜索。
  - 提供高性能的向量相似性检索能力。

- **在线索引维护**
  - `HNSWIndex` 同时支持：
    - 批量索引构建
    - 增量式索引更新
  - 在导入或更新数据时，对应的 HNSW 索引将自动更新。

## 向量属性

NeuG 使用固定长度的 `ARRAY` 列来表示向量属性。

目前，NeuG 支持：

- 仅密集向量（Dense vectors）
- 仅 FP32（`FLOAT`）元素类型

稀疏向量（Sparse vectors）当前不支持。

例如，以下向量：

`[0.1, 0, 0, 0.4]` 将以密集形式存储为：`[0.1, 0, 0, 0.4]`；其稀疏表示形式 `{0: 0.1, 3: 0.4}` 不被支持。

### 创建向量属性

您可以通过在节点类型（node type）的 Schema 中定义一个固定长度的数组属性来创建向量属性。

以下示例创建了一个节点类型，包含：

- 主键列 `id`
- FP32 向量列 `vec`
- 向量维度 = 4

```cypher
// 使用维度为 4 的定长 FLOAT 数组作为向量列
// 主键与向量维度在 DDL 中一并声明
CREATE NODE TABLE vector_node (
    id INT64,
    vec FLOAT[4],
    PRIMARY KEY (id)
);
```

若未指定默认值，则向量属性将被隐式初始化为 `[0.0, 0.0, 0.0, ...]`，即每个向量维度对应一个 FP32 零值。这可能导致包含默认向量的节点出现在向量相似性查询结果中。

### 删除向量属性

删除某一节点类型将自动移除：

- 在该节点类型上定义的向量属性
- 相关的 HNSW 索引

示例：

```cypher
// 级联删除：
// 移除节点类型属性及依赖的 HNSW 索引
DROP TABLE vector_node;
```

### 修改向量属性

与其他属性类似，向量属性也可通过 `ALTER TABLE` 语句添加到节点类型中。

示例：

```cypher
// 添加向量列
ALTER TABLE vector_node
ADD IF NOT EXISTS vec2 FLOAT[4];
```

## 加载向量数据

NeuG 支持从以下格式导入向量属性：CSV、JSON、Parquet。所有受支持的格式均使用统一的 `COPY FROM` 语法。

### CSV 导入

示例输入文件 `vec.csv`：

```csv
id|vec
1|[0.1, 0.2, 0.3, 0.4]
2|[0.2, 0.1, 0.1, 0.1]
...
```

创建 `vector_node` 模式：

```cypher
CREATE NODE TABLE vector_node (
    id INT64,
    vec FLOAT[4],
    PRIMARY KEY (id)
);
```

导入 CSV 数据：

```cypher
// 显式将 CSV 字符串表示转换为 FLOAT 数组
COPY vector_node FROM (
    LOAD FROM 'vec.csv'
    RETURN id,
           CAST(vec, 'FLOAT[4]') AS vec
);
```

### JSON 导入

示例 JSON 文件 `vec.json`：

```json
[
  {
    "id": 1,
    "vec": [0.1, 0.2, 0.3, 0.4]
  },
  {
    "id": 2,
    "vec": [0.2, 0.1, 0.1, 0.1]
  }
]
```

导入语句：

```cypher
COPY vector_node FROM (
    LOAD FROM 'vec.json'
    RETURN id,
           CAST(vec, 'FLOAT[4]') AS vec
);
```

### Parquet 导入

矢量数据也可以从 Parquet 文件中导入。

Parquet 文件中的 `vec` 数据以 `FLOAT32[4]` 数组形式存储。

示例：

```cypher
COPY vector_node FROM (
    LOAD FROM 'vec.parquet'
    RETURN id,
           CAST(vec, 'FLOAT[4]') AS vec
);
```

## 创建 HNSW 索引

NeuG 通过 HNSW 索引支持近似最近邻搜索。以下示例针对向量属性，对通用的 [`CREATE INDEX`](../storage_index/index.md#create-an-index) 语法进行了专门化。

示例：

```cypher
// 在向量属性上创建 HNSW 索引
CREATE INDEX vec_hnsw_index IF NOT EXISTS
ON vector_node
USING HNSW (vec)
WITH (
    metric = 'cosine',
    cosine_normalize = true,
    m = 16,
    ef_construction = 200
);
```

在该语句中：

- `vec_hnsw_index` 是索引名称。它必须在数据库内唯一，并在删除索引时用于标识该索引。
- `vector_node` 是包含向量属性的节点类型。
- `HNSW` 指定使用分层可导航小世界（Hierarchical Navigable Small World）索引类型。
- `vec` 是待索引的向量属性。

以下参数用于控制 HNSW 索引的构建与搜索行为：

| 参数               | 描述                                                                 | 默认值 |
| ------------------ | -------------------------------------------------------------------- | ------ |
| `metric`           | 距离度量方式。支持的取值包括 `l2`（或 `l2sq`）、`cosine` 和 `ip`（或 `inner_product`） | `l2` |
| `cosine_normalize` | 是否允许 **cosine** 类型的 HNSW 索引永久性地对被索引属性值执行 L2 归一化 | `true` |
| `m`                | HNSW 图中每个节点所允许创建的最大连接数                              | `50`   |
| `ef_construction`  | 构建索引过程中所使用的候选列表大小。更大的值通常可提升索引质量，但会增加构建时间和内存开销 | `500`  |

在创建索引时：

- 已存在的节点将被自动索引。
- 索引创建后插入的新节点将自动加入 HNSW 索引。

### 向量归一化

HNSW 余弦相似度搜索要求存储的向量具有单位 L2 范数。
对于余弦相似度 HNSW 索引，`cosine_normalize` 默认值为 `true`，这使得 NeuG 可在采样值尚未归一化时，对属性列执行归一化操作：

```cypher
CREATE INDEX vec_cosine_hnsw
ON vector_node
USING HNSW (vec)
WITH (metric = 'cosine', cosine_normalize = true);
```

若要防止属性被修改，请显式设置 `cosine_normalize = false`。此时 NeuG 将执行确定性的采样检查；当任意一个采样向量未归一化时，索引创建将被拒绝。需注意：一次成功的采样检查**不能保证整列数据均已归一化**；选择 `cosine_normalize = false` 的用户须自行确保所有现有及未来新增的向量均满足单位 L2 范数要求。

当 `cosine_normalize = true` 时，NeuG 首先对当前列进行采样。若所有采样向量均已满足单位范数，则跳过归一化转换；否则，NeuG 将创建一个新的缓冲区，并一次性完成全部向量的归一化。全零向量保持不变（仍为全零）。若在处理过程中遇到 `NULL`、非零但接近零的向量、`NaN`、无穷大（`infinity`）或其他无法归一化的值，则索引创建将失败，且**不会发布已部分转换的缓冲区**。

.. warning::

   采样可能遗漏未归一化的向量。该问题即使在 ``cosine_normalize = true`` 时依然存在，因为 NeuG 在采样检查成功后会跳过归一化转换。如需严格保证正确性，请在导入数据前，对整个数据集执行归一化并验证其合规性。

.. warning::

   归一化操作将**永久覆盖**存储的属性值，原始向量的模长信息不可恢复。此后所有对该属性的读取、导出、快照（checkpoint）以及在执行 ``DROP INDEX`` 后观察到的值，均为已归一化的向量。因此，在创建索引前，请务必备份原始嵌入向量，或将其归一化结果存入一个独立的属性中。

一旦某列采用归一化表示形式，后续所有 `INSERT` 和 `SET` 操作都将自动执行归一化。显式指定 `NULL` 向量值或向量内含 `NULL` 元素均不被支持。全零向量将被保留为全零；当 `vector_distance_cosine` 的任一参数为全零向量时，函数返回值为 ``1``。非零但接近零的向量以及非有限值（non-finite values）将被拒绝。若省略该属性，而其 schema 默认值可实例化为合法的非 `NULL` 向量（包括隐式的全零默认值），则该操作是允许的。

该选项对 IP（内积）或 L2 索引无任何影响。此类索引既不会触发归一化，亦会维持属性当前的原始表示形式。对 IP 数据进行归一化会丢失模长信息并改变内积得分；对 L2 数据进行归一化则会改变距离度量及最近邻排序结果。因此，NeuG **既不支持也不推荐**使用 `cosine_normalize` 对 IP/L2 类型的数据执行归一化。

NeuG 将拒绝尝试对已被基于原始向量构建的 HNSW 索引所使用的属性执行归一化操作。请避免在同一属性上混合使用要求原始表示与归一化表示的索引。删除最后一个索引**不会恢复原始向量**，亦**不会解除归一化写入约束**。

因此，用户可选择以下任一工作流：

- 工作流 1：先导入数据，再构建索引
- 工作流 2：先创建索引，再持续写入数据

### 重复向量

大量重复向量会降低 HNSW 索引的构建效率与查询性能。当 `CREATE INDEX` 批量构建 HNSW 索引时，NeuG 会基于向量哈希值估算重复率，并输出一条包含近似重复统计信息的警告，例如：

```text
HNSW 重复统计信息（索引 'vec_hnsw_index'）：83 / 100（83%）为重复向量
```

该检查旨在提供一种轻量级诊断手段。由于哈希冲突可能发生，因此结果仅为近似值。NeuG 在索引创建过程中既不会拒绝也不会自动移除重复向量。该统计信息仅在初始 `CREATE INDEX` 批量构建阶段针对已存在的向量进行计算；后续通过 `CREATE` 或 `SET` 添加或修改的向量不包含在内，且该统计信息不会持续更新。

---
如需删除或检查索引，请使用通用的 [DROP INDEX](../storage_index/index.md#drop-an-index) 和 [SHOW_INDEXES](../storage_index/index.md#inspect-indexes) 操作。删除向量属性本身或其所属的节点表，也将一并删除其对应的 HNSW 索引。

## 向量查询

NeuG 通过以下方式提供向量查询能力：

- 向量距离函数
- 基于 HNSW 的相似性搜索
- 图与向量混合检索
- 索引过滤式向量搜索
- 向量搜索过程中的图过滤

### 向量函数

NeuG 提供了三种向量距离函数，用于相似度计算。

支持的函数包括：

| 函数 | 描述 | 示例 |
|------|------|------|
| `vector_distance_l2(a, b)` | 平方 L2 距离：各维度差值的平方和。值越小，表示相似度越高。 | `vector_distance_l2(n.vec, [0.1, 0.2, 0.3, 0.4])` |
| `vector_distance_cosine(a, b)` | 余弦距离：1 减去余弦相似度。值越小，表示方向越相似。 | `vector_distance_cosine(n.vec, [0.1, 0.2, 0.3, 0.4])` |
| `vector_distance_ip(a, b)` | 内积：各维度对应元素乘积之和。值越大，表示相似度越高。 | `vector_distance_ip(n.vec, [0.1, 0.2, 0.3, 0.4])` |

向量距离函数可直接在 Cypher 表达式中使用。

以下示例计算每个节点向量与查询向量之间的 L2 距离：

```cypher
// 全表扫描式距离计算。
// 不使用 HNSW。
// 适用于验证或极小规模数据集。
MATCH (n:vector_node)
RETURN vector_distance_l2(
    n.vec,
    [0.1, 0.2, 0.3, 0.4]
) AS d;
```

> 注意：当计算向量属性与常量向量之间的距离时，该常量会自动转换为与属性相同的数值数组类型。例如，若属性类型为 `FLOAT[N]`，则 `DOUBLE[N]` 类型的常量将被转换为 `FLOAT[N]`，可能导致精度损失。为避免意外的精度损失，请尽可能使用与属性类型一致的数值数组作为参数。

该查询执行的是暴力距离计算：

- 扫描全部向量节点；
- 逐行计算向量距离；
- 返回计算所得的距离值。

对于大规模数据集，用户应创建 HNSW 索引，并使用向量相似性搜索。

### 向量相似性搜索

NeuG 提供基于索引的向量相似性搜索，其嵌入式查询语法类似于 PostgreSQL 和 DuckDB。

当存在 HNSW 索引时，NeuG 优化器会自动识别符合条件的向量查询，并将其重写为高效的 HNSW 索引扫描。

与以下方式不同：

- 为每个节点逐一计算距离；
- 按距离对所有节点进行排序；
- 返回前 K 个结果；

NeuG 直接利用 HNSW 索引检索近似最近邻（approximate nearest neighbors）。

示例：
```cypher
// 若存在 HNSW 索引，
// 优化器可将此查询重写为 HNSWIndexScan。
MATCH (n:vector_node)
ORDER BY vector_distance_l2(
    n.vec,
    [0.1, 0.2, 0.3, 0.4]
)
LIMIT 3;
```

> 注意：未显式赋值的向量属性将使用隐式的全零向量（all-zero vector），因此可能出现在相似性搜索结果中。详情请参阅[创建向量属性](#create-vector-property)。

### 图 + 向量混合搜索

NeuG 将图遍历能力与向量相似性搜索相结合。

用户可先执行向量检索，再在此基础上继续进行图遍历操作。

示例：
```cypher
MATCH (n:vector_node)
WITH n
ORDER BY vector_distance_l2(
    n.vec,
    [0.1, 0.2, 0.3, 0.4]
)
LIMIT 3

MATCH (n)-[e:links]->(n2)

RETURN n, n2;
```

### 索引过滤向量搜索

NeuG 在向量搜索过程中支持索引过滤（Index-Filtering）。

索引过滤意味着：

- 过滤条件被下推至向量索引的搜索流程中；
- 系统持续搜索，直至找到足够数量的有效 Top-K 结果。

相比之下，在后过滤（post-filtering）方式中，索引首先检索出 K 个最近邻，之后才应用谓词（predicate）进行过滤。若部分候选结果被过滤掉，则即使存在更多匹配节点，查询仍可能返回少于 K 个结果。而索引过滤在 HNSW 搜索过程中即对谓词进行求值，并持续寻找符合条件的候选节点，从而在至少存在 K 个匹配节点的前提下，提供更高的召回率及严格的 Top-K 结果保证。

示例：
```cypher
MATCH (n:vector_node)
WHERE n.id <> 1
RETURN n
ORDER BY vector_distance_l2(
    n.vec,
    [0.1, 0.2, 0.3, 0.4]
)
LIMIT 3;
```

其中过滤条件：

`WHERE n.id <> 1`

将在 HNSW 搜索过程中进行求值，而非在结果检索完成后再执行。

### 向量搜索期间的图过滤

NeuG 在向量检索过程中支持基于图的过滤。图模式会首先被求值，匹配到的顶点将作为 HNSW 搜索过程中的过滤条件。

例如，以下查询用于检索某个特定节点的最相似的出边邻居：

```cypher
MATCH (n1:vector_node {id: 1})
      -[:links]->
      (n2:vector_node)
RETURN n2,
       vector_distance_l2(
           n2.vec,
           [0.1, 0.2, 0.3, 0.4]
       ) AS score
ORDER BY score ASC
LIMIT 3;
```

该查询融合了以下功能：

- 图模式匹配；
- 向量相似度计算；
- 限制在满足图模式的节点范围内返回 top-K 近邻结果。

## 向量修改

创建 HNSW 索引后，您可以修改向量数据。插入、更新和删除操作会自动更新相应的索引，因此后续的 HNSW 查询将直接基于最新数据执行，无需手动同步索引。

### 插入向量数据

您可以使用标准的 Cypher 写操作来插入向量属性。

示例：

```cypher
// 插入节点属性数据
// 自动更新对应的 HNSW 索引
CREATE (
    n:vector_node {
        id: 3,
        vec: [0.2, 0.2, 0.1, 0.1]
    }
);
```

### 删除向量数据

删除节点会自动移除对应的向量索引条目。

示例：

```cypher
// 删除节点数据
// 移除对应的向量索引数据
MATCH (n:vector_node)
WHERE n.id = 1
DELETE n;
```

### 更新向量数据

更新向量属性会自动更新 HNSW 索引。

示例：

```cypher
// 更新向量属性
// 自动更新 HNSW 索引
MATCH (n:vector_node)
WHERE n.id = 1
SET n.vec = [0.2, 0.2, 0.1, 0.1];
```
