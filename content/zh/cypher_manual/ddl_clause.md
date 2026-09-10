# DDL 子句

DDL（数据定义语言）是一组专门用于模式管理的操作。NeuG 支持对模式中的节点、边及属性进行增、删、改操作。在创建与属性相关的模式时，用户可选择性地为属性指定默认值，以防止在数据导入过程中出现 `NULL` 字段。若未显式提供默认值，系统将自动赋予该类型所定义的默认值。

下表列出了每种受支持数据类型定义默认值的推荐语法，以及当未显式指定默认值时系统所采用的默认值。

| 数据类型         | 默认值示例                                     | 系统默认值                         |
|------------------|----------------------------------------------|--------------------------------------|
| `INT32`          | `prop INT32 DEFAULT 0`                         | `0`                                  |
| `INT64`          | `prop INT64 DEFAULT 0`                         | `0`                                  |
| `UINT32`         | `prop UINT32 DEFAULT 0`                        | `0`                                  |
| `UINT64`         | `prop UINT64 DEFAULT 0`                        | `0`                                  |
| `DOUBLE`         | `prop DOUBLE DEFAULT 0.0`                      | `0.0`                                |
| `FLOAT`          | `prop FLOAT DEFAULT 0.0`                       | `0.0`                                |
| `STRING`         | `prop STRING DEFAULT ''`                       | `''`（空字符串）                      |
| `DATE`           | `prop DATE DEFAULT DATE('1970-01-01')`         | `DATE('1970-01-01')`                 |
| `TIMESTAMP`      | `prop TIMESTAMP DEFAULT TIMESTAMP('1970-01-01')` | `TIMESTAMP('1970-01-01')`         |
| `INTERVAL`       | `prop INTERVAL DEFAULT INTERVAL('0 year 0 month 0 day')` | `INTERVAL('0 year 0 month 0 day')` |
| `ARRAY`          | `prop INT32[3] DEFAULT [1, 2, 3]`              | 子类型默认值按固定长度重复填充，例如 `INT32[3]` 对应 `[0, 0, 0]` |
| `LIST`           | `prop INT64[] DEFAULT CAST([1, 2, 3], 'INT64[]')` | `[]`（空列表）                        |

更多用法请参见以下示例。

## 创建节点类型

创建一个标签类型为“Person”的节点，并指定 Person 的属性名称、类型及主键。

每个节点表必须且仅能声明一个主键。主键列的数据类型必须为 `INT32`、`UINT32`、`INT64`、`UINT64`、`STRING` 或 `VARCHAR(n)`。不支持复合主键，也不支持其他所有类型（包括浮点型、布尔型、时间型、列表型和数组型）。

```
CREATE NODE TABLE Person (
    name STRING,
    age INT32,
    PRIMARY KEY (name)
);
```

默认情况下，若数据库中已存在 Person 类型，则会报错。可使用 `IF NOT EXISTS` 避免报错——仅当数据库中尚不存在该类型时才创建，否则不执行任何操作。

```
CREATE NODE TABLE IF NOT EXISTS Person (
    name STRING,
    age INT32,
    PRIMARY KEY (name)
);
```

## 创建边类型

创建一个从 Person 到 Person 的 "KNOWS" 类型边，并指定 KNOWS 的属性名称和类型。目前，边不支持指定主键。

```
CREATE REL TABLE IF NOT EXISTS KNOWS (
    FROM Person TO Person,
    weight DOUBLE
);
```

**多重性**

可选地，您可以在 `CREATE REL TABLE` 语句头部的右括号 `)` 之前，在最后一个列定义（及逗号）之后，添加恰好一个 *多重性* 标记。它描述了沿正向（从源到目标）的基数。允许的值包括 `ONE_TO_ONE`、`ONE_TO_MANY`、`MANY_TO_ONE` 和 `MANY_TO_MANY`。如果省略该标记，边类型将默认使用 `MANY_TO_MANY`。

例如，使用与上述相同的 `Person` / `KNOWS` / `weight` 结构：

```
CREATE REL TABLE IF NOT EXISTS KNOWS (
    FROM Person TO Person,
    weight DOUBLE,
    MANY_TO_MANY
);
```

**表选项（`WITH`）**

您可以在表头右括号 `)` *之后* 追加 `WITH ( … )` 子句。在括号内，以 `name = value` 的形式传递一个或多个选项，其中值为字面量。一个常见的键是 `sort_key_for_nbr`，其值通常是一个字符串字面量，用于命名排序所使用的边属性。该子句是可选的。

示例，仍然仅使用 `Person`、`KNOWS` 和 `weight`——此处 `weight` 用作排序列名：

```
CREATE REL TABLE IF NOT EXISTS KNOWS (
    FROM Person TO Person,
    weight DOUBLE
) WITH (sort_key_for_nbr = 'weight');
```

**多重性和选项的适用范围**

多重性和 `WITH` 选项是在 **边类型** 作用域（即边名称及其共享的列定义）中定义的，而不是在单个源-边-目标三元组级别定义的。当一个关系表为同一边类型声明多个 `FROM … TO …` 条目时，单一的多重性值和单一的选项集将统一应用于每一对这样的组合；不支持按对绑定多重性或选项。

## 数组属性

使用 `T[N]` 声明固定大小数组属性，其中 `T` 为子类型，`N` 为正整数固定长度（`N` 必须大于 0；声明 `T[0]` 会被拒绝）。`T[]` 仍为可变长度列表类型。

```cypher
CREATE NODE TABLE Sensor(
    id INT64,
    readings INT32[3],
    PRIMARY KEY(id)
);

CREATE REL TABLE MEASURED_BY(
    FROM Sensor TO Sensor,
    weights DOUBLE[2]
);
```

在 `CREATE`、`SET` 和 `MERGE` 子句中，可以使用常规方括号字面量来提供数组值：

```cypher
CREATE (s:Sensor {id: 1, readings: [10, 20, 30]});

MATCH (s:Sensor {id: 1})
SET s.readings = [30, 40, 50];
```

值的数量必须与声明的固定长度匹配。例如，将 `[1, 2]` 或 `[1, 2, 3, 4]` 赋值给 `INT32[3]` 属性会被拒绝。

通过链式维度支持嵌套固定大小数组。`INT32[2][3]` 表示一个包含 3 个元素的外部数组，其中每个元素都是一个 `INT32[2]` 数组：

```cypher
CREATE NODE TABLE Matrix(
    id INT64,
    grid INT32[2][3],
    PRIMARY KEY(id)
);
```

如果在 `CREATE` 期间省略了数组属性，或者在 `CREATE` 期间将其显式设置为 `NULL`，NeuG 会存储该数组的声明默认值。如果未声明显式默认值，系统默认值会重复使用子类型的默认值；对于 `INT32[3]`，该默认值为 `[0, 0, 0]`。目前尚不支持使用 `SET` 将现有数组属性设置为 `NULL`。

## 列表属性

使用 `T[]` 声明可变长度的列表属性，其中 `T` 为元素类型。列表可容纳任意数量的元素（包括零个元素）。与固定长度的数组类型（`T[N]`，其中 `N` 必须为正整数）不同，列表中元素的数量在 Schema 层面不受约束。

```cypher
CREATE NODE TABLE Person(
    id INT64,
    tags STRING[],
    scores INT64[],
    PRIMARY KEY(id)
);

CREATE REL TABLE Knows(
    FROM Person TO Person,
    ratings DOUBLE[]
);
```

嵌套列表通过连续使用 `[]` 声明：`STRING[][]` 表示字符串列表的列表；`STRING[][2][]` 表示由长度为 2 的固定大小数组构成的列表，而该数组的每个元素又是一个可变长度的字符串列表：

```cypher
CREATE NODE TABLE Matrix(
    id INT64,
    grid INT64[][],
    PRIMARY KEY(id)
);
```

在 `CREATE`、`SET` 和 `MERGE` 子句中，列表值必须显式进行类型转换；裸列表字面量（bare list literals）将被拒绝：

```cypher
-- 正确：显式使用 CAST
CREATE (p:Person {id: 1, tags: CAST(['a', 'b'], 'STRING[]')});

-- 错误：裸列表字面量不被接受
CREATE (p:Person {id: 2, tags: ['a', 'b']});
```

在事务型服务模式（transactional service mode）下，写入非空 LIST 属性的语句尚不支持使用 `insert`（`i`）访问模式；请改用 `update`（`u`）访问模式。当 LIST 类型嵌套在另一 LIST 或 ARRAY 类型内部时，该限制同样适用。

列表属性支持通过 `COPY FROM` 进行 CSV 和 JSON 批量加载。CSV 中的列表值采用方括号语法，例如 `[1, 2, 3]`；嵌套列表则通过嵌套方括号表示：

```
id|tags
1|[a,b,c]
2|[]
```

有关数组类型与列表类型区别的更多细节，请参阅上方的 [数组属性](#array-properties) 小节。

## 删除节点类型

删除指定的节点类型。使用 IF EXISTS 可避免在类型不存在时报错。

```
DROP TABLE IF EXISTS Person;
```

## 删除边类型

删除指定的边类型。使用 IF EXISTS 可避免在类型不存在时报错。

```
DROP TABLE IF EXISTS KNOWS;
```

## 重命名节点或边类型

使用 `RENAME TO` 重命名节点或边类型。

```
ALTER TABLE Person RENAME TO Person2;
ALTER TABLE KNOWS RENAME TO KNOWS2;
```

## 添加属性

为节点或边类型添加属性。

```
ALTER TABLE Person ADD IF NOT EXISTS gender INT32;
ALTER TABLE KNOWS ADD IF NOT EXISTS info STRING;
```

## 删除属性

从节点或边类型中移除属性。

```
ALTER TABLE Person DROP IF EXISTS gender;
ALTER TABLE KNOWS DROP IF EXISTS info;
```

## 重命名属性

重命名节点或边类型的属性。

```
ALTER TABLE Person RENAME age TO age2;
ALTER TABLE KNOWS RENAME weight TO weight2;
```
