# CASE 表达式

`CASE`按顺序评估各个分支，并返回第一个匹配分支的结果。NeuG 同时支持简单和搜索 `CASE`
表达式。

## 简单 CASE

简单 `CASE` 将一个表达式与每个 `WHEN` 值进行比较：

```cypher
CASE expression
    WHEN value1 THEN result1
    WHEN value2 THEN result2
    ELSE default_result
END;
```

对于非 `NULL` 值，每个分支都会作为等值
比较进行计算。例如：

```cypher
RETURN CASE 2
    WHEN 1 THEN 'one'
    WHEN 2 THEN 'two'
    ELSE 'other'
END;
// "two"
```

当 `expression` 为 `NULL` 时，`WHEN NULL` 分支会被解释为
`expression IS NULL` 而不是 `expression = NULL`。这提供了一个显式
分支，用于 `NULL`。如果没有 `WHEN NULL` 分支，则 `NULL`
 表达式会转到 `ELSE` 分支。

```cypher
RETURN CASE NULL
    WHEN NULL THEN 'null value'
    ELSE 'not matched'
END;
// "null value"
```

## 搜索型 CASE

搜索型 `CASE` 对每个 `WHEN` 条件直接求值：

```cypher
CASE
    WHEN condition1 THEN result1
    WHEN condition2 THEN result2
    ELSE default_result
END;
```

只有求值结果为 `TRUE` 的条件才会匹配。求值结果为
`FALSE` 或 `NULL` 的条件不匹配。

使用 `IS NULL` 显式测试 `NULL` 值：

```cypher
RETURN CASE
    WHEN expression IS NULL THEN 'null value'
    ELSE 'not matched'
END;
```

不要使用 `expression = NULL`，因为该比较会求值为
`NULL` 而不是 `TRUE`:

```cypher
RETURN CASE
    WHEN expression = NULL THEN 'null value'
    ELSE 'not matched'
END;
// "not matched"
```

## ELSE

该`ELSE`子句是可选的。如果没有`WHEN`备选分支匹配且`ELSE`被
省略，则结果为`NULL`.
