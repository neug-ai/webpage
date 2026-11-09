# 存储索引

存储索引在保持与 NeuG 图存储及事务模型集成的同时，加速查询执行。索引类型由核心引擎或扩展提供，因此本节描述所有存储索引共有的生命周期和行为。

## 支持的索引类型

NeuG 当前支持以下索引类型：

| 索引类型 | 使用场景 | 文档 |
| -------- | -------- | ---- |
| `HNSW` | 在向量属性上执行近似最近邻搜索 | [向量搜索](../extensions/vector_search.md) |
| `FTS` | 在字符串属性上执行基于 BM25 排序的全文搜索 | [全文搜索](../extensions/fts_search.md) |

NeuG 计划在未来支持以下索引类型及功能：

- 针对标量属性的 `BTree` 索引，支持等值查询、范围查询和有序查询；
- 复合索引，即同时对多个属性建立索引；
- 结果重排序（reranking），即使用额外的评分标准对索引候选结果进行重新排序。

下方所述的通用索引语法与保证同样适用于未来新增的索引类型。有关各索引类型所支持的属性、选项及查询表达式，请参阅对应索引类型的文档。

## 创建索引

使用 `CREATE INDEX` 在节点属性上构建索引：

```cypher
CREATE INDEX <index_name> [IF NOT EXISTS]
ON <node_table>
USING <index_type> (<property>)
[WITH (
    <option> = <value>
    [, ...]
)];
```

- `index_name` 在数据库内唯一标识该索引。
- `IF NOT EXISTS` 可确保当同名索引已存在时，该语句仍能成功执行。
- `node_table` 和 `property` 共同标识被索引的属性。
- `index_type` 用于选择索引的具体实现方式。
- `WITH` 子句用于传入与具体实现相关的构建选项。

索引创建时，现有数据值将被自动纳入索引；后续的插入、更新和删除操作会同步维护索引及其底层图数据。

## 删除索引

通过其唯一名称删除索引：

```cypher
DROP INDEX <index_name> [IF EXISTS];
```

使用 `IF EXISTS` 可确保当指定索引不存在时，该语句仍能成功执行。
此外，当被索引的属性或拥有该索引的节点表被删除时，该索引也会一并被删除。

## 检查索引

使用只读过程 `show_indexes` 来检查所有索引类型的索引元数据、激活状态和缓冲数据计数：

```cypher
// List all indexes.
CALL show_indexes() RETURN *;

// List all HNSW indexes.
CALL show_indexes('hnsw') RETURN *;

// Select an index by name.
CALL show_indexes(name := 'entity_embedding_hnsw') RETURN *;

// Select by both type and name.
CALL show_indexes(type := 'hnsw', name := 'entity_embedding_hnsw') RETURN *;
```

两个参数均为可选字符串：

| 参数 | 位置 | 含义 |
| --- | --- | --- |
| `type` | 1 | 索引类型，例如 `'hnsw'` 或 `'fts'`；不区分大小写。 |
| `name` | 2 | 确切的索引名称。 |

命名参数使用 `:=`，而非 `=`。参数也支持查询参数，例如 `CALL show_indexes($type, $name) RETURN *;`。省略这两个参数将列出所有索引。未匹配的过滤器不返回任何行，结果按索引名称排序。

示例输出：

| name | type | label | property | options | state | buffered_count |
| --- | --- | --- | --- | --- | --- | ---: |
| entity_embedding_hnsw | hnsw | Entity | embedding | `{"metric":"cosine"}` | active | 6000 |
| entity_text_fts | fts | Entity | text | `{}` | active | 0 |

| 列 | 含义 |
| --- | --- |
| `name` | 索引名称。 |
| `type` | 索引类型。 |
| `label` | 包含被索引属性的节点表。 |
| `property` | 被索引的属性名称；多个属性表示为类似 `["title","body"]` 的字符串。 |
| `options` | 以 JSON 字符串形式表示的索引选项，选项值以字符串形式表示。 |
| `state` | 当索引实现已加载时为 `active`；当索引因其提供程序扩展未加载而未激活时为 `pending`。 |
| `buffered_count` | 索引的 LocalBuffer 中缓冲的数据槽数量。确切计数规则取决于索引实现。对于没有 LocalBuffer 的活动索引返回 0，对于待处理索引返回 `NULL`。 |

仅检查缓冲区大小：

```cypher
CALL show_indexes() RETURN name, type, buffered_count;
```

## 优化索引

使用 `optimize_indexes` 显式对选定索引执行维护。
每种索引类型都实现其自身的维护逻辑，例如将缓冲数据合并到其主索引结构中。该过程适用于所有索引类型。

例如，HNSW 将 LocalBuffer 数据合并到其图中。这些数据在优化之前已经可搜索，因此应用程序无需更改其查询。

该过程接受与 `show_indexes` 相同的可选字符串参数 `type` 和 `name`，具有相同的位置顺序，并支持命名参数和查询参数：

```cypher
// Optimize one HNSW index.
CALL optimize_indexes(type := 'hnsw', name := 'entity_embedding_hnsw');

// Equivalent positional arguments.
CALL optimize_indexes('hnsw', 'entity_embedding_hnsw');

// Select by name without specifying a type.
CALL optimize_indexes(name := 'entity_embedding_hnsw');

// Optimize all HNSW indexes.
CALL optimize_indexes('hnsw');
```

省略这两个参数将选择所有索引。每个索引使用其自身的维护实现；没有维护工作的索引返回零计数。没有匹配索引的类型不返回任何行。显式指定的未知名称或名称/类型不匹配会导致错误。如果任何选定的索引处于挂起状态，调用会在优化任何索引之前失败。请先加载其提供程序扩展，或仅选择活动索引。

调用会等待维护完成，并为每个选定的索引返回一行，按索引名称排序。示例输出（计数和持续时间仅为示意）：

| type | index_name | indexed_count | skipped_count | duration_ms |
| --- | --- | ---: | ---: | ---: |
| hnsw | entity_embedding_hnsw | 5800 | 200 | 1250.0 |

| 列 | 含义 |
| --- | --- |
| `type` | 索引类型。 |
| `index_name` | 索引名称。 |
| `indexed_count` | 由此调用并入索引的条目数，由其维护实现报告。 |
| `skipped_count` | 维护期间跳过的条目数。原因取决于索引实现；HNSW 会跳过已删除或替换的条目、分配间隙以及在早期尝试中已添加的条目。 |
| `duration_ms` | 优化此索引所花费的时间（毫秒）。 |

优化使用写事务。所有选定的索引一起发布其维护更改；失败会中止操作，而不是返回部分成功。在显式写事务内部，更改在该事务提交时提交。只读事务可以检查索引，但不能优化它们。

有关何时优化 HNSW 索引的建议，请参阅 [Local Buffer 指南](../extensions/vector_search.md#when-and-how-to-optimize)。

## 索引加速查询

索引的使用已集成到常规 Cypher 查询中。请根据索引类型，使用 `MATCH`、过滤或排序表达式以及 `LIMIT` 编写查询。当存在符合条件且处于启用状态的索引时，查询优化器会将匹配的扫描操作或 Top-K 操作重写为索引扫描。查询无需调用单独的索引搜索过程。

“符合条件”（Eligibility）取决于具体索引类型：
- HNSW 索引支持在 `ORDER BY` 子句中识别向量距离表达式；详见 [向量相似性搜索](../extensions/vector_search.md#vector-similarity-search)。
- 全文搜索（FTS）索引支持识别 `bm25` 表达式；详见 [全文搜索](../extensions/fts_search.md#full-text-search)。

## 事务

索引生命周期操作和索引数据变更与图数据变更参与同一事务：

- `CREATE INDEX` 和 `DROP_INDEX` 操作在提交时原子性地对外可见。
- 插入、更新和删除操作会原子性地修改图属性及其对应的索引条目。
- 被中止的事务既不会发布图数据变更，也不会发布其对应的索引变更。

因此，读取者无法观察到已提交的图数据与过期的索引数据并存的情形，也无法观察到索引生命周期变更与其关联事务不一致的情形。有关通用 ACID 特性和隔离模型的详细信息，请参阅[事务管理](../transaction/transaction.mdx)。

## 持久化与恢复

索引的元数据和数据均随数据库检查点（checkpoint）一同存储。已提交的索引生命周期管理及维护操作也会被记录在预写日志（WAL）中。当数据库重新打开时，NeuG 会恢复该检查点，并重放其后的 WAL 记录，从而使已提交的索引随图数据一同恢复。

对于由扩展（extension）支持的索引，恢复过程最初可能将其显示为 `pending` 状态，这是因为扩展及其函数的生命周期与其所属数据库一致。需在重新打开的数据库中加载对应的提供者扩展（provider extension），方可激活已恢复的索引；详见 [扩展（Extensions）](../extensions/index.md)。
