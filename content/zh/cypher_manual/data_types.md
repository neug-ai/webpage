# 数据类型

本文档全面介绍 NeuG 支持的所有数据类型。

## 数据类型汇总表

下表展示了 NeuG 支持的所有数据类型及其与 Neo4j 的差异。`System Default Value`（系统默认值）列表示在用户未在 Schema 中显式定义默认值，且原始数据中未提供相应数据字段（或提供为 `Null` 值）时，系统在数据导入过程中自动分配的值。此机制可避免产生 `Null` 值，确保数据一致性，并为后续查询和计算提供稳定的默认值。

| 类别 | 类型 | 系统默认值 | NeuG 示例 | Neo4j 示例 |
|----------|------|---------------------|--------------|---------------|
| 基本类型 | INT32 | `0` | `RETURN CAST(42, 'INT32')` | `RETURN 42` |
| 基本类型 | UINT32 | `0` | `RETURN CAST(42, 'UINT32')` | 不支持 |
| 基本类型 | INT64 | `0` | `RETURN 9223372036854775807` | `RETURN 9223372036854775807` |
| 基本类型 | UINT64 | `0` | `RETURN CAST(9223372036854775807, 'UINT64')` | 不支持 |
| 基本类型 | FLOAT | `0.0` | `RETURN CAST(3.14, 'FLOAT')` | `RETURN 3.14f` |
| 基本类型 | DOUBLE | `0.0` | `RETURN 3.14159265359` | `RETURN 3.14159265359d` |
| 基本类型 | BOOL | `false` | `RETURN true` | `RETURN true` |
| 基本类型 | NULL | `null` | `RETURN null` | `RETURN null` |
| 字符串 | VARCHAR | `''`（空字符串） | `RETURN 'Hello World'` | `RETURN 'Hello World'` |
| 时间类型 | DATE | `1970-01-01` | `RETURN date('2022-06-06')` | `RETURN date('2022-06-06')` |
| 时间类型 | DATETIME | `1970-01-01 00:00:00` | `RETURN timestamp('2022-06-06 12:00:00')` | `RETURN datetime('2022-06-06T12:00:00')` |
| 时间类型 | INTERVAL | `0 year 0 month 0 day`（零时间间隔） | `RETURN interval('1 year 2 month 3 day')` | `RETURN duration('P1Y2M3D')` |
| 复合类型 | LIST | `[]`（空列表） | `RETURN [1, 2, 3]` | `RETURN [1, 2, 3]` |
| 复合类型 | ARRAY | 固定大小的子元素默认值，例如 `INT32[3]` 的默认值为 `[0, 0, 0]` | Schema 中的 `readings INT32[3]` | 不支持作为独立的固定大小类型 |
| 模式类型 | NODE | `{}`（空节点） | `{_ID: 0, _LABEL: Person, id: 1, name: marko, age: 29}` | `(:Person {name: 'Alice', age: 30})` |
| 模式类型 | REL | `{}`（空边） | `{_ID: 2, _LABEL: KNOWS, _SRC_LABEL: Person, _DST_LABEL: Person, _SRC_ID: 0, _DST_ID: 2, weight: 1.0}` | `[:KNOWS {weight: 1.0}]` |
| 模式类型 | REPEATED PATH | `[]`（空路径） | `{_ID: 0, _LABEL: Person}, {_ID: 4294967298, _LABEL: CREATED, _SRC_LABEL: Person, _DST_LABEL: Person, _SRC_ID: 0, _DST_ID: 2}, {_ID: 2, _LABEL: Person}, {_ID: 4297064449, _LABEL: CREATED, _SRC_LABEL: Person, _DST_LABEL: Software, _SRC_ID: 2, _DST_ID: 72057594037927937}, {_ID: 72057594037927937, _LABEL: Software}` | `(:Person {name: "Kiefer", id: 4, age: 1992})-[:FOLLOWS]->(:Person {name: "Jack", id: 3, age: 1979})-[:FOLLOWS]->(:Person {name: "Kevin", id: 5, age: 1997})` |

## 详细介绍

### 基础类型

#### INT32
- **描述**：32位有符号整数类型
- **取值范围**：[-2,147,483,648, 2,147,483,647]
- **查询示例**：`RETURN CAST(42, 'INT32') AS int32_value;`

#### UINT32
- **描述**：32 位无符号整数类型
- **范围**：[0, 4,294,967,295]
- **查询示例**：`RETURN CAST(42, 'UINT32') AS uint32_value;`

#### INT64
- **描述**：64 位有符号整数类型，整数值的默认类型
- **范围**：[-9,223,372,036,854,775,808, 9,223,372,036,854,775,807]
- **查询示例**：`RETURN 9223372036854775807 AS int64_value;`

#### UINT64
- **描述**：64 位无符号整数类型
- **范围**：[0, 18,446,744,073,709,551,615]
- **查询示例**：`RETURN CAST(18446744073709551615, 'UINT64') AS uint64_value;`

#### FLOAT
- **描述**：单精度浮点数
- **精度**：约 7 位小数
- **查询示例**：`RETURN CAST(3.14, 'FLOAT') AS float_value;`

#### DOUBLE
- **描述**：双精度浮点数，浮点值的默认类型
- **精度**：约 15-17 位小数
- **查询示例**：`RETURN 3.14159265359 AS double_value;`

#### BOOL
- **描述**：布尔类型，表示 true 或 false 值
- **取值**：`true`、`false`
- **查询示例**：`RETURN true AS bool_value;`

#### NULL
- **描述**：表示缺失或未定义的值
- **查询示例**：`RETURN null AS null_value;`

### 字符串类型

目前我们只支持 VARCHAR 类型用于字符串。您可以使用 `VARCHAR(max_length)` 语法指定最大字符长度。`max_length` 的默认值为 256，最大限制为 65536。
您也可以使用 STRING 直接指定字符类型；STRING 等同于 VARCHAR(256)，即默认最大长度为 256 个字符的 varchar 类型。

#### VARCHAR
- **描述**：使用 UTF-8 编码的可变长度字符串
- **查询示例**：`RETURN 'Hello World' AS string_value;`
- **长度**：可变，受系统限制，默认为 `256`

### 时间类型

#### DATE
- **描述**：用于存储日历日期的日期类型
- **格式**：YYYY-MM-DD
- **查询示例**：`RETURN date('2022-06-06') AS date_value;`

#### DATETIME
- **描述**：日期和时间组合类型
- **格式**：YYYY-MM-DD HH:MM:SS
- **查询示例**：`RETURN timestamp('2022-06-06 12:00:00') AS datetime_value;`

#### INTERVAL
- **描述**：INTERVAL 类型表示持续时间或时间间隔，由以下字段组成：`year`、`month`、`day`、`hour`、`minute`、`second`、`millisecond` 和 `microsecond`。INTERVAL 类型支持两种主要格式来指定值：
    - 基于日期的组成部分（year、month、day）：使用自然语言格式指定。示例：`1 year 2 month 3 day`。
    - 基于时间的组成部分（hour、minute、second、millisecond、microsecond）：使用自然语言格式指定。示例：`12 hour 12 minute 2 second` - 表示 12 小时 12 分钟 2 秒。
- **查询示例**：`RETURN interval('1 year 2 month 3 day 12 hour 12 minute 2 second') AS interval_value;`

### 复合类型

#### LIST
- **描述**：包含异构类型值的有序集合
- **查询示例**：`RETURN [1, 2, 3] AS list_value;`

下表展示了 LIST 支持的所有组件类型：

| 类别 | 类型 | 示例 |
|----------|------|---------|
| 数值 | INT32, INT64, UINT32, UINT64, DOUBLE, FLOAT | `RETURN [1, 2, 3.0];` |
| 字符串 | VARCHAR | `RETURN ['marko', 'josh'];` |
| 日期 | DATE, DATETIME | `RETURN [date('2011-01-25'), timestamp('2011-01-25 11:20:33')];` |
| 布尔 | BOOL | `RETURN [true, false];` |
| 复合 | LIST | `RETURN [[1, 2], [4, 5]];` |

**关于 LIST 组件类型的重要说明**： 

NeuG 通过元组数据类型支持列表，这意味着复合类型可以是异构的。以下是一些示例：

在单个列表中混合不同的基本类型：
```cypher
RETURN ['marko', 2];
```

在列表中组合节点的不同属性类型：
```cypher
MATCH (n:Person) RETURN [n.name, n.age];
```

支持嵌套列表结构：
```cypher
MATCH (n:Person) RETURN [["name", n.name], ["age", n.age]];
```

**关键技术细节：**
- NeuG 中的列表可以包含不同数据类型的元素（异构列表）
- 这是通过内部元组数据类型支持来实现的
- 在可能的情况下，系统会自动处理类型转换
- 完全支持嵌套列表，以构建复杂的数据结构
- 系统在保持类型安全的同时，允许列表组合具有灵活性

#### ARRAY
- **描述**：固定大小的有序集合，其元素共享声明的子类型
- **语法**：使用 `T[N]`，其中 `T` 为子类型，`N` 为正整数固定长度
- **查询示例**：`CREATE NODE TABLE Sensor(id INT64, readings INT64[3], PRIMARY KEY(id));`

`ARRAY` 是 NeuG 中 `LIST` 的固定大小对应类型。`T[]` 声明一个可变长度列表，而 `T[N]` 声明一个恰好包含 `N` 个元素的数组。数组字面量使用与列表相同的方括号语法；声明的模式或其他类型上下文决定该值是作为 `LIST` 还是 `ARRAY` 存储。`CAST` 并非通用的 `LIST`/`ARRAY` 兼容机制。

```cypher
CREATE NODE TABLE Sensor(
    id INT64,
    readings INT32[3],
    PRIMARY KEY(id)
);

CREATE (s:Sensor {id: 1, readings: [10, 20, 30]});
MATCH (s:Sensor) RETURN s.readings;
```

数组也可用于关系属性：

```cypher
CREATE REL TABLE Knows(
    FROM Person TO Person,
    weights DOUBLE[2]
);
```

多维数组通过链式拼接固定长度来编写。`INT32[2][3]` 表示一个包含 3 个元素的外部数组，其中每个元素都是一个 `INT32[2]` 数组：

```cypher
CREATE NODE TABLE Matrix(
    id INT64,
    grid INT32[2][3],
    PRIMARY KEY(id)
);

CREATE (m:Matrix {id: 1, grid: [[1, 2], [3, 4], [5, 6]]});
```

**关键技术细节：**
- 数组值在每个固定大小维度上必须匹配声明的长度
- 在 `CREATE` 期间缺失或为 `NULL` 的数组属性，其每个元素将使用子类型的默认值
- 支持在 DDL 中使用显式数组默认字面量，例如 `prop INT32[3] DEFAULT [1, 2, 3]`
- `RETURN`、等值过滤、从零开始的索引、`SET`、`MERGE`、`collect()` 和 `UNWIND` 均支持数组值属性
- `CAST` 不会在 `LIST` 和 `ARRAY` 之间进行转换；数组属性值的类型由感知模式的编译器上下文决定
- 尚不支持将现有数组属性设置为 `NULL`

### 图类型

#### 节点
- **描述**：表示图中的节点
- **内部结构**（顺序无关紧要）：`_ID`（内部标识符）、`_LABEL`（节点类型指示）以及属性字段
- **查询示例**：`MATCH (n:Person) RETURN n AS node_value;`
- **NeuG 格式**：`{_ID: 0, _LABEL: Person, id: 1, name: marko, age: 29}`

#### REL（边）
- **描述**：表示图中的边
- **内部结构**（顺序无关紧要）：`_ID`（边内部标识符），`_LABEL`（边类型指示），`_SRC_ID`（源节点内部标识符），`_SRC_LABEL`（源节点标签），`_DST_ID`（目标节点内部标识符），`_DST_LABEL`（目标节点标签）以及属性字段
- **查询示例**：`MATCH ()-[r:KNOWS]->() RETURN r AS rel_value;`
- **NeuG 格式**：`{_ID: 2, _LABEL: KNOWS, _SRC_ID: 0, _SRC_LABEL: Person, _DST_ID: 2, _DST_LABEL: Person, weight: 1.0}`

#### 路径
- **描述**：表示由节点和边交替组成的图路径。
- **内部结构**：沿路径的节点和边的**有序序列**，包括起始和终止节点。
- **查询示例**：`MATCH (a:Person)-[p*1..2]->(c) RETURN p AS path_value;`
- **NeuG 格式**：`{_ID: 0, _LABEL: Person}, {_ID: 4294967298, _LABEL: CREATED, _SRC_LABEL: Person, _DST_LABEL: Person, _SRC_ID: 0, _DST_ID: 2}, {_ID: 2, _LABEL: Person}, {_ID: 4297064449, _LABEL: CREATED, _SRC_LABEL: Person, _DST_LABEL: Software, _SRC_ID: 2, _DST_ID: 72057594037927937}, {_ID: 72057594037927937, _LABEL: Software}`
