# LIMIT 子句

`LIMIT` 控制查询返回的最大行数。它可以单独使用，也可以与 `ORDER BY` 结合使用以表达 Top-K 查询。`LIMIT` 接受非负整数字面量、常量整数表达式或动态参数。

`SKIP` 从结果开头移除行。`SKIP` 和 `LIMIT` 可以组合使用以选择左闭右开的行范围 `[skip, skip + limit)`。由于除非存在 `ORDER BY`，否则不保证行顺序，因此当所选行必须具有确定性时，请使用 `ORDER BY`。

无论是作为字面量、常量表达式还是动态参数提供，`SKIP` 和 `LIMIT` 的值都必须介于 `0` 和 `4294967295`（`UINT32_MAX`）之间。负数、分数、`NULL`、布尔值、字符串以及更大的整数值都会被拒绝。执行范围的独占上界也限制为 `UINT32_MAX`；如果 `skip + limit` 超过该值，则上界将饱和至 `UINT32_MAX`。

## 使用整数值的 LIMIT

```cypher
MATCH (a:Person)
RETURN a.age
LIMIT 2;
```
由于输出没有排序，结果可能是任意两条记录。

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

## 使用整数表达式的 LIMIT

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

## 使用动态参数的 LIMIT

当应用程序需要使用不同的限制值重复执行同一条语句时，请使用动态参数：

```cypher
MATCH (a:Person)
RETURN a.age
LIMIT $row_limit;
```

例如，在 Python 中使用 `row_limit = 2` 执行该语句：

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

# SKIP 子句

`SKIP` 选择行范围 `[skip, +∞)`，假设行位置从零开始。如果没有 `ORDER BY`，被跳过的行是不确定的。

## 使用整数值跳过

```cypher
MATCH (a:Person)
RETURN a.age
SKIP 2;
```
该查询用于跳过结果的前两行。

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

对于 `row_offset = 2`，查询会跳过前两行：

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

将 `SKIP` 放在 `LIMIT` 之前以选择有界范围。以下查询
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
