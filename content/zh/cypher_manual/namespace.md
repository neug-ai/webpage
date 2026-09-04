# 命名空间（Namespace）

**命名空间（Namespace）** 是对图中某一部分所定义的、具名称且可复用的逻辑视图。它在**不复制或物化底层图数据**的前提下，将查询与图分析限定于选定的节点类型、关系类型及属性条件之上。

命名空间可直接用于 Cypher 查询中，以定义逻辑图视图；同时，它也被 **GDS 扩展（Graph Data Science Extension）** 用作图算法的输入图视图，从而支持算法仅在原始图的指定子集上运行。

NeuG 提供了一组投影图（Projected Graph）API，包括 `project_graph`、`show_projected_graphs`、`projected_graph_info` 和 `drop_projected_graph`，用于创建和管理命名空间。

考虑一个包含两个节点表 `Entity` 和 `Product`，以及两个关系表 `rel_ee` 和 `rel_ep` 的图：

```cypher
CREATE NODE TABLE Entity(
    uid STRING PRIMARY KEY,
    name STRING,
    description STRING,
    entity_type STRING,
    product STRING,
    authority INT64,
    kg_id STRING,
    embedding FLOAT[512],
    domain STRING
);
```

```cypher
CREATE NODE TABLE Product(
    name STRING PRIMARY KEY,
    uid STRING,
    description STRING,
    domain STRING
);
```

```cypher
CREATE REL TABLE rel_ee(
    FROM Entity TO Entity,
    rel_type STRING,
    content STRING
);
```

```cypher
CREATE REL TABLE rel_ep(
    FROM Entity TO Product,
    rel_type STRING,
    content STRING
);
```

在此示例中，`Entity` 和 `Product` 均包含一个 `domain` 属性，该属性用于标识节点所属的逻辑域或分组。

> **注意：** `domain` 仅为本文档中使用的示例属性，并非命名空间所要求的特殊或保留属性；用户在使用命名空间前**无需**在自己的 Schema 中预先添加 `domain` 属性。可根据应用的数据模型，任意选用已有的属性来定义过滤条件。

例如：

```text
Entity A   domain = "user1"
Entity B   domain = "user1"
Entity C   domain = "user2"

Product X  domain = "user1"
Product Y  domain = "user2"
```

因此，多个域可共享同一套物理节点表与关系表，同时通过命名空间对外暴露图的不同逻辑子集。

例如，针对 `user1` 的命名空间可仅包含以下内容：

- `domain = "user1"` 的 `Entity` 节点；
- `domain = "user1"` 的 `Product` 节点；
- 源节点与目标节点均被纳入该命名空间的 `rel_ee` 关系；
- 源节点为 `Entity`、目标节点为 `Product`，且二者均被纳入该命名空间的 `rel_ep` 关系。

底层的 `Entity`、`Product`、`rel_ee` 和 `rel_ep` 表保持不变，且不会被复制。

一个命名空间包含：

- 一个或多个节点类型，可按节点属性进行可选过滤；
- 一个或多个关系三元组（形式为 `[源类型, 关系类型, 目标类型]`），可按关系属性进行可选过滤。

每个关系三元组的两个端点类型都必须包含在该命名空间中。

## 创建命名空间（Namespace）

使用 `CALL project_graph` 可通过指定以下参数来创建一个具名的 Namespace：

- Namespace 的名称；
- 要包含的节点类型，可选地附加属性过滤条件；
- 要包含的关系三元组（即 `[源节点类型, 关系类型, 目标节点类型]`），可选地附加属性过滤条件。

例如，以下语句创建名为 `user1_subgraph` 的 Namespace：

```cypher
CALL project_graph(
    'user1_subgraph',
    {
        'Entity': 'n.domain = "user1"',
        'Product': 'n.domain = "user1"'
    },
    [
        '[Entity, rel_ee, Entity]',
        '[Entity, rel_ep, Product]'
    ]
);
```

该 Namespace 包含如下结构：

```text
user1_subgraph
├── Entity
│   └── domain = "user1"
├── Product
│   └── domain = "user1"
├── [Entity, rel_ee, Entity]
└── [Entity, rel_ep, Product]
```

此处，节点定义采用映射（map）形式，将每种节点类型与其对应的属性过滤条件关联起来：

```cypher
{
    'Entity': 'n.domain = "user1"',
    'Product': 'n.domain = "user1"'
}
```

因此，仅当 `Entity` 和 `Product` 节点的 `domain` 属性值为 `"user1"` 时，这些节点才会被纳入该 Namespace。

关系定义则以列表（list）形式指定：

```cypher
[
    '[Entity, rel_ee, Entity]',
    '[Entity, rel_ep, Product]'
]
```

使用列表形式意味着**不额外施加关系属性过滤条件**；关系是否被包含，仅取决于其三元组结构以及其两端节点是否属于该 Namespace 所选定的节点集合。

例如：

```text
Entity A (user1) ──rel_ep──> Product X (user1)   ← 被包含

Entity A (user1) ──rel_ep──> Product Y (user2)   ← 被排除（目标节点 domain ≠ "user1"）

Entity C (user2) ──rel_ep──> Product X (user1)   ← 被排除（源节点 domain ≠ "user1"）
```

因此，即使未对 `rel_ep` 显式定义额外的过滤条件，某条关系仍仅在其**源节点和目标节点均属于 Namespace 中对应节点集合**的前提下，才会被包含。

若需对关系施加额外的属性过滤条件，则应将关系定义指定为映射（map）形式。例如：

```cypher
CALL project_graph(
    'user1_subgraph_with_rel_filter',
    {'Entity': 'n.domain = "user1"'},
    {'[Entity, rel_ee, Entity]': 'r.year > 2010'}
);
```

该 Namespace 包含满足 `domain = "user1"` 的 `Entity` 节点，以及满足 `year > 2010` 的 `rel_ee` 关系。一条关系被包含的前提是：其自身的关系谓词（relationship predicate）**以及**其两端节点各自满足的节点谓词（node predicate）**全部成立**。

谓词表达式中使用如下变量：

- 在节点谓词中，用 `n` 引用当前节点，例如 `n.domain = "user1"`；
- 在关系谓词中，用 `r` 引用当前关系，例如 `r.year > 2010`。

### 支持的谓词表达式

命名空间（Namespace）谓词必须返回 `BOOL` 类型值。谓词支持属性表达式、字面量、动态参数，以及由这些值构成的标量运算。支持的标量运算包括：

- 比较运算符，例如 `=`, `<>`, `<`, `<=`, `>`, `>=`；
- 成员关系及字符串谓词，例如 `IN`, `CONTAINS`, `STARTS WITH`, `ENDS WITH`；
- `CAST` 表达式；
- 使用 `AND`、`OR` 和 `NOT` 进行逻辑组合。

在命名空间谓词中，不支持复杂表达式形式，例如 `CASE`、聚合表达式、lambda 表达式、路径表达式以及子查询。

## 查询命名空间

可以使用以下语句为整个查询选择一个命名空间：

```text
USE NAMESPACE <namespace>
```

例如：

```cypher
USE NAMESPACE user1_subgraph
MATCH (n:Entity)
RETURN n.uid, n.name;
```

尽管物理上的 `Entity` 表可能包含来自多个域的数据，但该查询仅匹配属于 `user1_subgraph` 的 `Entity` 节点：

```text
Entity
├── Entity A   domain = "user1"   ← 匹配
├── Entity B   domain = "user1"   ← 匹配
└── Entity C   domain = "user2"   ← 排除
```

### 将命名空间过滤器与查询过滤器结合使用

查询可以在命名空间所定义的过滤条件之上，额外添加自身的 `WHERE` 条件：

```cypher
USE NAMESPACE user1_subgraph
MATCH (n:Entity)
WHERE n.status = 'active'
RETURN n.uid, n.name;
```

从概念上讲，这两个条件将被同时应用：

```text
命名空间过滤器：
    domain = "user1"

查询过滤器：
    status = "active"

实际生效的条件：
    domain = "user1" AND status = "active"
```

命名空间定义了图数据的作用范围，而查询则可在该范围内进一步限制所返回的数据。

### 查询关系

所选的命名空间（Namespace）还会限制关系及其端点：

```cypher
USE NAMESPACE user1_subgraph
MATCH (n:Entity)-[r:rel_ep]->(p:Product)
RETURN n.name, p.name, r.rel_type;
```

该查询仅返回那些**源节点–关系–目标节点三元组整体均属于该命名空间**的 `rel_ep` 关系。

例如：

```text
实体 A（user1）──rel_ep──> 产品 X（user1）   ← 匹配

实体 A（user1）──rel_ep──> 产品 Y（user2）   ← 被排除

实体 C（user2）──rel_ep──> 产品 X（user1）   ← 被排除
```

关系的归属由完整的以下三元组定义：

```text
[源节点类型, 关系类型, 目标节点类型]
```

而非仅由关系类型单独决定。这种方式还可防止同名的关系类型在连接其他类型的节点时被意外包含进来。

### 匹配命名空间中的所有类型

省略标签或关系类型，即可匹配所选命名空间中包含的任意类型：

```cypher
USE NAMESPACE user1_subgraph
MATCH (source)-[rel]->(target)
RETURN source, rel, target;
```

对于 `user1_subgraph`，每个未标注的模式元素均解析为该命名空间中已注册的节点或关系定义。显式指定的标签也会在该命名空间中进行校验；若使用了不属于该命名空间的标签，则会报错。

当查询需作用于整个逻辑子图（而非特定的节点或关系类型）时，此功能尤为有用。

### 使用 `USE NAMESPACE` 配合 `OPTIONAL MATCH`

`USE NAMESPACE` 同样适用于 `OPTIONAL MATCH`。

例如：

```cypher
USE NAMESPACE user1_subgraph
MATCH (a:Entity)
OPTIONAL MATCH (a)-[r]->(b)
RETURN a, r, b;
```

第一个 `MATCH` 语句从 `user1_subgraph` 中选取 `Entity` 节点；随后的 `OPTIONAL MATCH` 则尝试查找同样属于该命名空间（Namespace）的出边关系及其目标节点。

如果原始图中存在匹配的关系，但该关系或其目标节点位于 `user1_subgraph` 之外，则该路径不满足可选模式。与常规 `OPTIONAL MATCH` 行为一致：前序 `MATCH` 所生成的行仍被保留，而未匹配的可选部分则以 `NULL` 返回。

例如：

```text
Entity A (user1) ──rel_ep──> Product X (user1)
    → r = rel_ep, b = Product X

Entity B (user1) ──rel_ep──> Product Y (user2)
    → r = NULL, b = NULL
```

在第二种情况下，`Entity B` 仍会被返回，因为它满足查询中必需的部分；但 `Product Y` 不在 `user1_subgraph` 内，因此 `OPTIONAL MATCH` 无法匹配该路径，并将可选模式中的元素（即 `r` 和 `b`）返回为 `NULL`。

### 查询原始图

命名空间（Namespace）的定义不会改变原始图。

不使用 `USE NAMESPACE` 的查询仍直接作用于原始图：

```cypher
MATCH (n:Entity)
RETURN n;
```

该查询可返回所有域（domain）中的 `Entity` 节点，因为它不受任何命名空间的限制。

例如：

```text
MATCH (n:Entity)
    ↓
Entity A   domain = "user1"
Entity B   domain = "user1"
Entity C   domain = "user2"

USE NAMESPACE user1_subgraph
MATCH (n:Entity)
    ↓
Entity A   domain = "user1"
Entity B   domain = "user1"
```

命名空间的选择作用于整个查询：它适用于每个 `MATCH` 和 `OPTIONAL MATCH`，包括嵌套的模式表达式及子查询；单个模式元素无法退出当前命名空间，也无法单独指定其他命名空间。

## 检查命名空间

使用 `show_projected_graphs` 列出数据库中当前定义的命名空间：

```cypher
CALL show_projected_graphs()
RETURN *;
```

要检查特定命名空间的节点类型、关系三元组以及属性过滤器，请使用 `projected_graph_info`：

```cypher
CALL projected_graph_info('user1_subgraph')
RETURN *;
```

## 删除命名空间

使用 `drop_projected_graph` 删除一个命名空间：

```cypher
CALL drop_projected_graph('user1_subgraph');
```

删除命名空间仅会移除其逻辑定义。它**不会**删除或修改原始图中的节点和关系。

## 命名空间持久化

命名空间会作为数据库的一部分被自动持久化。一旦创建了某个命名空间，其定义将在数据库关闭并重新打开后继续保持可用。

用户在重新打开数据库后无需重新创建命名空间。

例如，在执行以下操作创建命名空间后：

```cypher
CALL project_graph(
    'user1_subgraph',
    {
        'Entity': 'n.domain = "user1"',
        'Product': 'n.domain = "user1"'
    },
    [
        '[Entity, rel_ee, Entity]',
        '[Entity, rel_ep, Product]'
    ]
);
```

`user1_subgraph` 在数据库重新打开后依然可用，并可直接查询：

```cypher
USE NAMESPACE user1_subgraph
MATCH (n:Entity)
RETURN n;
```

## 自动数据与模式更新

命名空间（Namespace）是对原始图的一种**逻辑视图**，而非物化副本。因此，命名空间查询会自动作用于最新的图数据和图模式。

### 数据更新

命名空间（Namespace）不会维护图数据的独立副本。当底层数据发生变化时，后续针对该命名空间的查询将自动作用于最新数据。

例如，若向原始图中插入一个新 `Entity` 节点，且其 `domain = "user1"`，则该节点将自动通过以下方式可见：

```cypher
USE NAMESPACE user1_subgraph
MATCH (n:Entity)
RETURN n;
```

无需重新创建或手动刷新 `user1_subgraph`。

同理，若某个现有节点的 `domain` 属性发生变更，导致其不再满足该命名空间的过滤条件，则后续针对该命名空间的查询将不再返回该节点。

### 模式更新

命名空间（Namespace）还会自动反映原始图谱模式（schema）的变更。

例如，假设 `user1_subgraph` 最初包含以下节点类型：

```text
[Entity, Product]
```

若后续从原始图谱中删除了 `Entity` 节点类型，则通过该命名空间查询该标签：

```cypher
USE NAMESPACE user1_subgraph
MATCH (n:Entity)
RETURN n;
```

系统将自动检测到 `Entity` 已不存在，并报告相应的 **Label not found**（标签未找到）错误。

通配符查询同样基于最新的模式执行。在 `Entity` 被移除后，以下查询：

```cypher
USE NAMESPACE user1_subgraph
MATCH (n)
RETURN n;
```

将正确解析出当前 `user1_subgraph` 中实际存在的节点类型，即：

```text
[Product]
```

在数据或模式发生变更后，无需显式刷新或重建命名空间。

## 限制条件

`USE NAMESPACE` 当前仅支持只读图匹配操作：

- `MATCH`
- `OPTIONAL MATCH`

例如：

```cypher
USE NAMESPACE user1_subgraph
MATCH (n:Entity)
RETURN n;
```

`USE NAMESPACE` 查询当前**不支持 `CREATE` 或 `MERGE` 等写入操作**。

例如，以下用法不被支持：

```cypher
USE NAMESPACE user1_subgraph
CREATE (n:Entity {...});
```

该限制可防止命名空间（Namespace）查询直接修改底层图数据，否则可能导致预期的写入语义变得模糊不清。

命名空间（Namespace）定义的是对原始图的一个逻辑查询范围，而非一个独立的、可写入的图。
