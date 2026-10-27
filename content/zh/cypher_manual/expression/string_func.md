# 字符串函数

字符串函数用于转换字符串值，而字符串谓词用于测试字符串是否匹配指定模式。

## 字符串转换函数

| 函数 | 描述 |
|----------|-------------|
| `UPPER(value)` | 将 `value` 转换为大写 |
| `LOWER(value)` | 将 `value` 转换为小写 |
| `REVERSE(value)` | 反转 `value` 中的字符 |

`TOUPPER` 和 `UCASE` 是 `UPPER` 的别名。`TOLOWER` 和 `LCASE` 是 `LOWER` 的别名。

```cypher
RETURN UPPER('Alice'), LOWER('Alice'), REVERSE('Alice');
// 'ALICE', 'alice', 'ecilA'
```

当输入为 `NULL` 时，字符串转换函数返回 `NULL`。

```cypher
RETURN UPPER(NULL), LOWER(NULL), REVERSE(NULL);
// NULL, NULL, NULL
```

## 字符串谓词

字符串谓词将字符串与字面量模式进行比较，并返回布尔值。

| 谓词 | 描述 |
|-----------|-------------|
| `value STARTS WITH pattern` | 测试 `value` 是否以 `pattern` 开头 |
| `value ENDS WITH pattern` | 测试 `value` 是否以 `pattern` 结尾 |
| `value CONTAINS pattern` | 测试 `value` 是否包含 `pattern` |

```cypher
RETURN 'Alice' STARTS WITH 'Al',
       'Alice' ENDS WITH 'ice',
       'Alice' CONTAINS 'lic';
// TRUE, TRUE, TRUE
```

如果原始字符串或子字符串为 `NULL`，则结果为 `NULL`。

```cypher
RETURN NULL STARTS WITH 'A',
       'Alice' STARTS WITH NULL,
       NULL ENDS WITH 'e',
       'Alice' ENDS WITH NULL,
       NULL CONTAINS 'lic',
       'Alice' CONTAINS NULL;
// NULL, NULL, NULL, NULL, NULL, NULL
```
