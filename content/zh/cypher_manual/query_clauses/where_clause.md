# WHERE 子句

WHERE 子句用于根据谓词或子查询进一步过滤先前查询操作产生的结果。过滤主要基于逻辑表达式，我们将在 [表达式章节](../../expression) 中详细介绍。它只输出符合指定条件的数据。

## 按属性筛选

在上一章中，我们介绍了如何通过 `(a:Person {name: 'marko'})` 这样的表达式来限制节点和关系的属性键值对。在此，我们进一步补充说明如何通过 WHERE 子句来实现相同的效果。

### 按节点属性过滤
```cypher
MATCH (a:Person) 
WHERE a.name = 'marko' OR a.age > 27
RETURN a.name, a.age;
```

输出：
```
+-------------+------------+
| _0_a.name   |   _0_a.age |
+=============+============+
| marko       |         29 |
+-------------+------------+
| josh        |         32 |
+-------------+------------+
| peter       |         35 |
+-------------+------------+
```

### 按节点/关系属性过滤
```cypher
MATCH (a:Person)-[b:KNOWS]->(c:Person) 
WHERE a.name = 'marko' AND b.weight = 1.0
RETURN a.name, b.weight;
```

输出：
```
+-------------+---------------+
| _0_a.name   |   _4_b.weight |
+=============+===============+
| marko       |             1 |
+-------------+---------------+
```

### 按关联属性过滤
```cypher
MATCH (a:Person)-[b:KNOWS]->(c:Person) 
WHERE a.name <> c.name AND a.age > c.age 
RETURN a.name, a.age, c.name, c.age;
```

输出：
```
+-------------+------------+-------------+------------+
| _0_a.name   |   _0_a.age | _2_c.name   |   _2_c.age |
+=============+============+=============+============+
| marko       |         29 | vadas       |         27 |
+-------------+------------+-------------+------------+
```

## 使用 NULL 过滤

NULL 值在图数据存储和计算过程中不可避免。为了保留或删除这些 NULL 值，我们可以在 WHERE 子句中使用 `IS NULL` 或 `IS NOT NULL`。

### 过滤带有 NULL 的属性数据
```cypher
MATCH (a)
WHERE a.age IS NULL
RETURN a.name;
```

```
+-------------+
| _0_a.name   |
+=============+
| lop         |
+-------------+
| ripple      |
+-------------+
```

### 使用 NULL 过滤可选数据
```cypher
MATCH (a) 
OPTIONAL MATCH (a)-[:KNOWS]->(b) 
WHERE b IS NULL 
RETURN a.name;
```

<!-- 待办：当前 pip 包中未包含 optional match -->

### 使用 IS NOT NULL 过滤可选数据
```cypher
MATCH (a) 
OPTIONAL MATCH (a)-[:KNOWS]->(b) 
WHERE b IS NOT NULL 
RETURN a.name;
```

## WHERE 与子查询

WHERE 子句也可以与子查询一起使用，执行更复杂的过滤操作。

### 存在模式
```cypher
MATCH (a) 
WHERE (a)-[:KNOWS]->(b) 
RETURN a.name;
```
此查询返回所有具有 `knows` 关系的 `a.name` 值。

### 不存在模式
```cypher
MATCH (a) 
WHERE NOT (a)-[:KNOWS]->(b) 
RETURN a.name;
```
此查询返回所有不存在 `knows` 关系的 `a.name` 值，等同于 SQL 中的 ANTI_JOIN 语义。

<!-- todo: 尚不支持 where 子查询 -->
