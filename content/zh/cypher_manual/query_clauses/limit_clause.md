# Limit 子句

`LIMIT` 控制查询返回的最大行数。它可以单独使用，也可以与 `ORDER BY` 结合使用来表达 Top-K 查询。 `LIMIT`
接受非负整数字面量、常量整数表达式或
动态参数。

`SKIP` 从结果开头移除行。 `SKIP` 和 `LIMIT` 可以
组合使用来选择半开区间行范围 `[skip, skip + limit)`。因为
行顺序无法保证，除非 `ORDER BY`，请使用 `ORDER BY` 当
所选行必须具有确定性时。

`SKIP`两者的值 `LIMIT` 和 `0` 必须介于 `4294967295`
(`UINT32_MAX` 和 `NULL`）之间，无论是作为字面量、常量表达式还是
动态参数提供。负数、小数、`UINT32_MAX`；如果 `skip + limit` 超过它，则上限将
饱和于 `UINT32_MAX`.

## 使用整数值的 Limit

```cypher
MATCH (a:Person)
RETURN a.age
LIMIT 2;
```
由于输出没有排序，结果可能是任意两个结果。

输出：

```text
+------------+
|   _0_a.age |
+============+
|         29 |
+------------+
|         27 |
+------------+
```

## 带有整数表达式的 Limit

```cypher
MATCH (a:Person)
RETURN a.age
LIMIT 1+1;
```

输出：

```text
+------------+
|   _0_a.age |
+============+
|         29 |
+------------+
|         27 |
+------------+
```

## 使用动态参数进行限制

当应用程序需要使用不同的限制值重用同一条语句时，请使用动态参数：

```cypher
MATCH (a:Person)
RETURN a.age
LIMIT $row_limit;
```

例如，使用 `row_limit = 2` 在 Python 中执行该语句：

```python
result = connection.execute(
    "MATCH (a:Person) RETURN a.age LIMIT $row_limit",
    parameters={"row_limit": 2},
)
```

输出：

```text
+------------+
|   _0_a.age |
+============+
|         29 |
+------------+
|         27 |
+------------+
```

# Skip 子句

`SKIP` 选择行范围 `[skip, +∞)`，假设行位置从
零开始。如果没有 `ORDER BY`，被跳过的行是不确定的。

## 使用整数值跳过

```cypher
MATCH (a:Person)
RETURN a.age
SKIP 2;
```
该查询用于跳过前两行结果。

输出：

```text
+------------+
|   _0_a.age |
+============+
|         32 |
+------------+
|         35 |
+------------+
```

## 使用整数表达式跳过

```cypher
MATCH (a:Person)
RETURN a.age
SKIP 1+1;
```

输出：

```text
+------------+
|   _0_a.age |
+============+
|         32 |
+------------+
|         35 |
+------------+
```

## 使用动态参数跳过

```cypher
MATCH (a:Person)
RETURN a.age
SKIP $row_offset;
```

对于 `row_offset = 2`，查询将跳过前两行：

```python
result = connection.execute(
    "MATCH (a:Person) RETURN a.age SKIP $row_offset",
    parameters={"row_offset": 2},
)
```

输出：

```text
+------------+
|   _0_a.age |
+============+
|         32 |
+------------+
|         35 |
+------------+
```

## 结合使用 Limit 和 Skip

将 `SKIP` 放在 `LIMIT` 之前，以选择一个有界范围。以下查询
跳过第一行并返回接下来的两行：

```cypher
MATCH (a:Person)
RETURN a.age
SKIP 1
LIMIT 2;
```

输出：

```text
+------------+
|   _0_a.age |
+============+
|         27 |
+------------+
|         32 |
+------------+
```

两个边界都可以是动态参数：

```cypher
MATCH (a:Person)
RETURN a.age
ORDER BY a.age ASC
SKIP $row_offset
LIMIT $row_limit;
```

```python
result = connection.execute(
    """
    MATCH (a:Person)
    RETURN a.age
    ORDER BY a.age ASC
    SKIP $row_offset
    LIMIT $row_limit
    """,
    parameters={"row_offset": 1, "row_limit": 2},
)
```
