# 列表与数组运算符

NeuG 支持下表所示的类列表操作。这些操作适用于 `LIST` 值，并在注明的情况下适用于固定大小的 `ARRAY` 值。

运算符 | 描述 | 示例
---------|------------ | --------
`IN` | 如果给定列表中包含某个元素，则返回 true | `1 IN [1, 2, 3] `
`[]` | 通过基于零的索引从列表或固定大小数组中提取元素 | `[10, 20, 30][0]`
`UNWIND` | 将列表或固定大小数组展开为每个元素一行 | `MATCH (s:Sensor) UNWIND s.readings AS x RETURN x`

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

## 空值行为

### `IN`

`IN` 使用三值逻辑，当任一操作数或列表元素为
`NULL`：

- 一个 `NULL` 列表产生 `NULL`。
- 空列表产生 `FALSE`，包括当搜索值为 `NULL`。
- 确切匹配产生 `TRUE`，即使另一个列表元素为 `NULL`。
- 如果没有匹配但列表包含 `NULL`，则结果为 `NULL`。
- 如果没有匹配且列表不包含 `NULL`，则结果为 `FALSE`。

| 表达式 | 结果 |
|------------|--------|
| `1 IN NULL` | `NULL` |
| `NULL IN NULL` | `NULL` |
| `1 IN []` | `FALSE` |
| `NULL IN []` | `FALSE` |
| `1 IN [1, 2]` | `TRUE` |
| `1 IN [NULL, 1, 2]` | `TRUE` |
| `2 IN [1, NULL, 3]` | `NULL` |
| `2 IN [1, 3]` | `FALSE` |

### `UNWIND`

`UNWIND` 保留 `NULL` 非 NULL 列表
或固定大小数组中已存在的元素。例如：

```cypher
UNWIND [1, NULL, 3] AS value
RETURN value;
// 1, NULL, 3
```

如果将展开的值传递给 `collect()`，则聚合会过滤掉
这些 `NULL` 元素：

（有关聚合函数如何处理 `NULL` 值的详细信息，请参阅
[NULL 值处理](./agg_func.md#null-value-handling)。）

```cypher
UNWIND [1, NULL, 3] AS value
RETURN collect(value);
// [1, 3]
```

`UNWIND` 需要一个非 NULL 列表或数组值作为其输入。尝试
展开 `NULL` 列表会直接引发错误：

```cypher
UNWIND NULL AS value
RETURN value;
// Error: UNWIND cannot expand a NULL value
```
