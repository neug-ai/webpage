# 列表与数组运算符

NeuG 支持下表所示的类列表操作。这些操作适用于 `LIST` 类型值，且在注明的情况下也适用于定长 `ARRAY` 类型值。

运算符 | 说明 | 示例
-------|------|------
`IN` | 若某元素存在于给定列表中，则返回 true | `1 IN [1, 2, 3]`
`[]` | 按照从零开始的索引，从列表或定长数组中提取一个元素 | `[10, 20, 30][0]`
`UNWIND` | 将列表或定长数组展开为每行一个元素 | `MATCH (s:Sensor) UNWIND s.readings AS x RETURN x`

注意：`UNWIND` 在展开列表或数组时会保留 NULL 值。若后续使用 `collect()` 函数，则 NULL 值将被过滤掉。

## 数组值

`ARRAY` 是一种固定大小的类列表类型，使用 `T[N]` 声明。它可以与 `UNWIND` 结合使用：

```cypher
CREATE NODE TABLE Sensor(id INT64, readings INT32[3], PRIMARY KEY(id));
CREATE (s:Sensor {id: 1, readings: [3, 1, 2]});

MATCH (s:Sensor)
UNWIND s.readings AS reading
RETURN reading
ORDER BY reading;
```

结果中每个数组元素占一行：`1`、`2`、`3`。固定大小的 `ARRAY` 属性还支持直接的零基索引，例如 `s.readings[2]`。
