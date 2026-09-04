# WITH 子句

WITH 主要用于进一步投影或聚合当前数据。接下来我们将从这两个方面介绍相关用法。

## 聚合

聚合类似于 SQL 中的 GROUP BY 操作，它按属性对当前数据进行分组，并对每个组的数据执行相应的聚合函数操作。NeuG 目前支持主流的聚合函数，包括：
- COUNT
- COUNT_STAR
- COLLECT
- SUM
- MIN
- MAX
- AVG

我们将在 [聚合函数章节](../../expression/agg_func) 中详细介绍这些函数。

### 按单一属性聚合
```
MATCH (a) WITH label(a) AS label, count(a.name) AS cnt RETURN label, cnt;
```

<!-- 待办：当前包中未包含 label -->

### 按多个属性聚合
```
MATCH (a)-[b:KNOWS]->(c) WITH label(a) AS a_label, label(c) AS c_label, count(b) AS cnt RETURN a_label, c_label, cnt;
```

### 应用多个聚合函数
```
MATCH (a)-[b:KNOWS]->(c) WITH label(a) AS a_label, label(c) AS c_label, count(b) AS cnt, sum(b.weight) AS weights RETURN a_label, c_label, cnt, weights;
```

### 基于聚合结果进行过滤

```
MATCH (a:Person) WITH label(a) AS label, count(a.name) AS cnt WHERE cnt > 2 RETURN label, cnt;
```

<!-- todo: 输出中 label 为 null -->

## 投影

WITH 的另一个常见用法是按列进一步投影当前结果，相当于 SQL 中的 Column Pruning，只输出后续查询需要的列。

## 投影节点数据

```
MATCH (a:Person {name: 'marko'})-[:KNOWS]->(b:Person)
WITH b
MATCH (b)-[:CREATED]->(c)
RETURN c.name;
```

<!-- 待办：当前包中未包含多重匹配 -->

## 节点/边数据投影

```
MATCH (a:Person {name: 'marko'})-[k:KNOWS]->(b:Person)
WITH b, k
MATCH (b)-[:CREATED]->(c)
RETURN k.weight, c.name;
```

## 属性投影
```
MATCH (a:Person {name: 'marko'})-[:KNOWS]->(b:Person)
WITH a, b.age AS b_age
MATCH (a)-[:CREATED]->(c)
WHERE b_age > 20
RETURN c.name;
```

对第一个 Match 生成的 b 数据的属性进行投影，通过 Filter 过滤这些属性，最后输出所有满足条件的 c.name；
