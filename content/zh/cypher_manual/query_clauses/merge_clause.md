# 合并子句

`MERGE` 子句确保图中存在某个模式。如果该模式已经存在，则进行匹配并返回；否则，将创建该模式。你可以将 `MERGE <pattern>` 理解为：如果 `MATCH <pattern>` 成功则返回结果，否则执行 `CREATE <pattern>`。

此外，`MERGE` 支持 `ON CREATE SET` 和 `ON MATCH SET` 操作，这允许你根据模式是新创建的还是已存在的来指定不同的属性更新。

## 合并节点

### 匹配现有节点

如果节点已经存在于图中，`MERGE` 只是简单地匹配它并返回结果，而不会创建任何新内容。

```cypher
MERGE (n:User {name: 'Adam'}) RETURN n.*;
```

假设 `Adam` 已经存在于图中，此查询直接返回 Adam 的属性。

### 创建新节点

如果节点不存在，`MERGE` 的行为类似于 `CREATE` 并插入该节点。

```cypher
MERGE (n:User {name: 'Bob', age: 45}) RETURN n.*;
```

如果图中不存在 `Bob`，则会创建一个名为 `name='Bob'` 且 `age=45` 的新 `User` 节点。

## 合并边

合并边时，必须先匹配源节点和目标节点（通常通过前面的 `MATCH` 子句），然后 `MERGE` 检查它们之间是否存在指定的边。

### 匹配已存在的边

```cypher
MATCH (u1:User {name: 'Adam'}), (u2:User {name: 'marko'})
MERGE (u1)-[e:FOLLOWS {date: 2012}]->(u2)
RETURN u1.name, e.date, u2.name;
```

如果 Adam 和 marko 之间已存在 `date=2012` 的 `FOLLOWS` 边，则直接返回该边。

### 创建新边

```cypher
MATCH (u1:User {name: 'Adam'}), (u2:User {name: 'Bob'})
MERGE (u1)-[e:FOLLOWS {date: 2012}]->(u2)
RETURN u1.name, e.date, u2.name;
```

如果 Adam 和 Bob 之间不存在 `date=2012` 的 `FOLLOWS` 边，则会创建一条新边。

### 为多对节点 MERGE 边

```cypher
MATCH (u1:User), (u2:User)
WHERE id(u1) < id(u2)
MERGE (u1)-[e:FOLLOWS {date: 2012}]->(u2)
RETURN u1.name, e.date, u2.name;
```

对于每一对 `<u1, u2>`，`MERGE` 会逐一检查是否存在 `date=2012` 的 `FOLLOWS` 边。如果存在，则返回该现有边；否则，为该对节点创建一条新边。

## ON CREATE / ON MATCH

`ON CREATE SET` 仅在模式是新创建时执行 SET 操作。`ON MATCH SET` 仅在图中已存在该模式时执行 SET 操作。

### ON CREATE SET

```cypher
MERGE (n:User {name: 'Bob'}) ON CREATE SET n.age = 60 RETURN n.name, n.age;
```

如果 `Bob` 不存在且是新创建的，则应用 `SET n.age = 60`：

```
┌────────┬───────┐
│ n.name │ n.age │
│ STRING │ INT64 │
├────────┼───────┤
│ Bob    │ 60    │
└────────┴───────┘
```

### ON MATCH SET

```cypher
MERGE (n:User {name: 'Adam'}) ON MATCH SET n.age = 35 RETURN n.name, n.age;
```

如果 `Adam` 已存在，则应用 `SET n.age = 35`：

```
┌────────┬───────┐
│ n.name │ n.age │
│ STRING │ INT64 │
├────────┼───────┤
│ Adam   │ 35    │
└────────┴───────┘
```

### ON CREATE SET 在匹配时不触发

```cypher
MERGE (n:User {name: 'Adam'}) ON CREATE SET n.age = 35 RETURN n.name, n.age;
```

如果 `Adam` 已存在，`ON CREATE SET` **不会**被触发，并保留原始属性值：

```
┌────────┬───────┐
│ n.name │ n.age │
│ STRING │ INT64 │
├────────┼───────┤
│ Adam   │ 29    │
└────────┴───────┘
```

## 限制

以下 MERGE 模式在 NeuG 中**不**支持。

### 合并多个节点

不支持在单个 `MERGE` 子句中合并多个节点：

```cypher
-- 不支持
MERGE (u1:User {name: 'Adam'}), (u2:User {name: 'Bob'})
```

这具有歧义的语义：如果任一节点缺失，无论是否已存在一个节点，都将重新创建两个节点。请改用单独的 `MERGE` 语句：

```cypher
-- 支持：分别合并每个节点
MERGE (u1:User {name: 'Adam'})
MERGE (u2:User {name: 'Bob'})
```

### MERGE 路径

不支持合并完整的路径模式：

```cypher
-- NOT supported
MERGE (:User {name: 'A'})-[:FOLLOWS {date: 2012}]->(:User {name: 'B'})
```

这将把顶点和边作为一个整体进行创建，而不会检查各个顶点是否已存在，从而可能导致重复。请改为分别合并节点和边：

```cypher
-- Supported: merge nodes first, then merge the edge
MERGE (u1:User {name: 'A'})
MERGE (u2:User {name: 'B'})
MERGE (u1)-[:FOLLOWS {date: 2012}]->(u2)
```
