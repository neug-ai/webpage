# 字符串函数

字符串函数用于转换字符串值，而字符串谓词用于测试
字符串是否匹配指定模式。

## 字符串转换函数

| 函数 | 描述 |
|----------|-------------|
| `UPPER(value)` | 将 `value` 转换为大写 |
| `LOWER(value)` | 将 `value` 转换为小写 |
| `REVERSE(value)` | 反转 `value` |

`TOUPPER` 和 `UCASE` 是 `UPPER`. `TOLOWER` 和 `LCASE` 的别名
`LOWER`.

```cypher
RETURN UPPER('Alice'), LOWER('Alice'), REVERSE('Alice');
// 'ALICE', 'alice', 'ecilA'
```

字符串转换函数返回 `NULL` 当输入为 `NULL`.

```cypher
RETURN UPPER(NULL), LOWER(NULL), REVERSE(NULL);
// NULL, NULL, NULL
```

## 字符串谓词

字符串谓词将字符串与字面量模式进行比较，并返回一个布尔
值。

| 谓词 | 描述 |
|-----------|-------------|
| `value STARTS WITH pattern` | 测试是否 `value` 以 `pattern` |
| `value ENDS WITH pattern` | 测试是否 `value` 以 `pattern` |
| `value CONTAINS pattern` | 测试是否 `value` 包含 `pattern` |

```cypher
RETURN 'Alice' STARTS WITH 'Al',
       'Alice' ENDS WITH 'ice',
       'Alice' CONTAINS 'lic';
// TRUE, TRUE, TRUE
```

如果原始字符串或子字符串为 `NULL`，则结果为
`NULL`.

```cypher
RETURN NULL STARTS WITH 'A',
       'Alice' STARTS WITH NULL,
       NULL ENDS WITH 'e',
       'Alice' ENDS WITH NULL,
       NULL CONTAINS 'lic',
       'Alice' CONTAINS NULL;
// NULL, NULL, NULL, NULL, NULL, NULL
```
