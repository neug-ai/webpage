# 概述

## 什么是 Cypher？

Cypher 是一种专门为图数据库设计的声明式图查询语言。它提供了一种直观且富有表现力的方式来查询、操作和管理图数据。我们的实现基于 [OpenCypher](https://opencypher.org/) 规范，这是一个图查询语言的开放标准。

## 与 SQL 的主要区别

SQL 是为具有表和行的关系数据库设计的，而 Cypher 是为具有节点、关系和属性的图数据库优化的：

- **结构**：SQL 使用表和连接；Cypher 使用节点、关系和模式
- **模式匹配**：SQL 需要显式连接；Cypher 使用模式匹配语法
- **遍历**：SQL 需要复杂的多跳查询连接；Cypher 自然支持路径遍历
- **可读性**：Cypher 的 ASCII 艺术语法使图模式直观易懂

## 在 NeuG 中可以用 Cypher 做什么？

在 NeuG 中，我们将 Cypher 查询称为**语句**。一个语句由多个**子句**组成。例如，在以下查询中：

```cypher
MATCH (p:Person)
WHERE p.age = '29'
RETURN p.name as name;
```

其中的 `MATCH`、`WHERE` 和 `RETURN` 部分被称为子句，它们是图数据库操作的基本逻辑单元。

基于 OpenCypher，我们定义了一系列用于管理 NeuG 图数据库的语句语法，包括：

### 模式管理 (DDL)

NeuG 主要面向严格模式（Schema-Strict）的图数据场景，要求每一条数据都必须符合预定义的模式规范。这与传统的 SQL 类似；然而，图数据涉及更为复杂的节点和关系结构，这些结构同样需要遵守预定义的模式要求。

例如，考虑以下模式图：

![现代图模式](https://raw.githubusercontent.com/alibaba/neug/main/doc/source/images/modern_schema.png)

上述模式图可以通过以下语句创建：

```cypher
// 模式定义示例
CREATE NODE TABLE Person (
    name STRING,
    age INT32,
    PRIMARY KEY (name)
);

CREATE NODE TABLE Software (
    name STRING,
    lang STRING,
    PRIMARY KEY (name)
);

CREATE REL TABLE KNOWS (
    FROM Person TO Person,
    weight DOUBLE
);

CREATE REL TABLE CREATED (
    FROM Person TO Software,
    weight DOUBLE
);
```

**符合模式的查询：**
在以下查询中，顶点标签 `Person` 和边标签 `(Person-KNOWS->Person)` 均符合上述定义的模式约束。`Person` 节点包含 `age` 和 `name` 属性，且 `age` 属性为 INT32 类型，可与常量 18 进行比较。因此，该查询满足所有模式约束，是有效的：

```cypher
MATCH (p:Person)-[:KNOWS]->(f:Person)
WHERE p.age > 18
RETURN p.name, f.name;
```

**不符合模式的查询（将执行失败）：**
此查询中指定的边标签 `(Person-FOLLOWS->Person)` 在模式中不存在，因此该查询无效，并会导致“表 `FOLLOWS` 不存在”的错误。

```cypher
MATCH (p:Person)-[:FOLLOWS]->(m:Person)
RETURN p.name;
```

我们定义了一组用于创建模式图的语法，如上所示，称之为 DDL（数据定义语言）。后续所有的数据更新和查询操作都必须符合当前 DDL 定义的模式规范。我们将在 [DDL 章节](ddl_clause) 中对此进行详细介绍。

### 数据查询 (DQL)

我们还定义了一套查询语法，能够同时满足事务处理（TP）和分析处理（AP）的查询需求。

例如，您可以使用以下查询语句来查询图数据库中的所有三角形模式：

```cypher
MATCH (a:Person)-[:CREATED]->(b:Software),
      (c:Person)-[:CREATED]->(b:Software),
      (a:Person)-[:KNOWS]->(c:Person)
WHERE a.name < c.name
RETURN a.name, b.name, c.name;
```

我们将每个 `MATCH`、`WHERE` 和 `RETURN` 称为子句，它们是图数据操作的基本单元。在此示例中，`MATCH` 操作主要用于匹配构成三角形模式的所有数据，`WHERE` 进一步过滤模式数据以保证去重，而 `RETURN` 操作则对名称进行投影并输出最终结果。`MATCH` 操作主要完成图模式匹配，而 `WHERE`/`RETURN` 操作主要执行类似于 SQL 的关系操作。这些子句将在 [DQL 章节](query_clauses) 中详细介绍。

为了进一步确保子句对数据操作的合法性，我们定义了 NeuG 支持的数据类型边界，以及基于这些数据类型的表达式操作。这些内容将在 [数据类型](data_types) 和 [表达式章节](expression) 中详细介绍。

### 数据管理 (DML)

除了 DQL 和 DDL，NeuG 还支持数据更新功能，我们将其称为 DML（数据操作语言）。DML 操作可以通过批量加载或增量更新来执行。

**批量导入示例：**
```cypher
COPY Person FROM "person.csv" (delim=',');
COPY KNOWS FROM "knows.csv" (delim=',');
```

上述两条语句首先从 person.csv 批量加载带有 `person` 标签的节点数据，然后从 knows.csv 批量加载带有 `person-[knows]->person` 标签的边数据。

**增量更新示例：**

我们还提供了增量写入语法，用于增量更新图数据。

**节点创建示例：**
```cypher
CREATE (p:Person {name: 'Bob', age: 30});
```

**关系创建示例：**
```cypher
MATCH (a:Person {name: 'Bob'}), (b:Person {name: 'marko'})
CREATE (a)-[:KNOWS {weight: 3.0}]->(b);
```

**节点删除示例：**
```cypher
MATCH (p:Person {name: 'Bob'})
DELETE p;
```

我们将在 [DML 部分](dml_clause) 详细介绍这些 DML 操作。

### 临时加载

NeuG 提供**临时加载**功能，允许用户查询外部数据源（如 CSV、JSON 和 Parquet 文件），而**无需将数据导入持久化图存储**。外部数据可按需加载并直接查询，使该功能非常适合快速探索、转换和即席分析。

根据查询意图，NeuG 支持两种互补的加载模式：

* **LOAD FROM**
  将外部数据加载为**临时表**，支持投影、过滤、排序和聚合等类 SQL 操作。

* **LOAD AS**
  将外部数据加载为**临时图**，支持使用 `MATCH` 查询进行图模式匹配与遍历。

**查询示例**

您可以使用 `LOAD FROM` 直接对外部文件执行关系操作。
例如，以下查询加载一个 CSV 文件，并返回按年龄（升序）和姓名（降序）排序的前 10 条记录：

```cypher
LOAD FROM "person.csv" (delim=',')
RETURN name, age
ORDER BY age ASC, name DESC
LIMIT 10;
```

对于更复杂的面向图的分析，可以将外部数据加载为临时图，并使用图模式进行查询。

```cypher
LOAD FROM "person.csv" (delim=',')
AS Person;

LOAD FROM "knows.csv" (delim=',')
AS KNOWS;

MATCH (p1:Person)-[:KNOWS*1..2]->(p2:Person)
RETURN p1, p2;
```

这使用户无需将图物化到持久化存储中，即可探索多跳关系。

**当前状态**

目前，NeuG 已全面支持通过 `LOAD FROM` 将外部数据加载为**临时表**。
您可以参考 [Load From](../data_io/load_data) 了解详细用法和支持的操作。
通过 `LOAD AS` 将外部数据加载为**临时图**的功能目前正在开发中，详细的使用指南将在后续版本中发布。

### 性能调试（EXPLAIN 与 PROFILE）

NeuG 提供了 `EXPLAIN` 和 `PROFILE` 命令，帮助您理解并优化查询执行过程：

* **EXPLAIN**：在不实际执行查询的情况下查看其执行计划。有助于了解 NeuG 将如何执行您的查询，并识别潜在的优化机会。

* **PROFILE**：实际执行查询，并收集每个算子的耗时与行数统计信息。有助于识别性能瓶颈，并理解数据分布对执行的影响。

这两个命令均提供详细的执行计划，展示算子树结构及各项指标。有关详细用法和示例，请参阅 [EXPLAIN & PROFILE 章节](explain_profile)。

### 扩展

NeuG 提供扩展框架，支持在不修改核心引擎代码的情况下动态添加新功能。请参阅 [扩展](../extensions/index)章节了解更多详情。

### 命名空间（Namespace）

NeuG 提供 **命名空间（Namespace）** 支持，用于在图上创建具名的、可复用的逻辑视图。命名空间可在**不复制或物化底层图数据**的前提下，将图查询限制于选定的节点类型、关系类型及属性条件。更多详细信息，请参阅 [命名空间](./namespace.md) 章节。
