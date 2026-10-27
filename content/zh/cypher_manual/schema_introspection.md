# 模式内省

模式内省过程暴露当前 NeuG 图的图模式。
它们可用于发现节点表和关系三元组，或检查特定表上声明的属性。

NeuG 提供以下过程：

- `SHOW_NODE_TABLES()` 列出节点表，可按标签进行可选过滤。
- `SHOW_REL_TABLES()` 按源、关系和目标三元组列出关系表，可按三元组进行可选过滤。
- `SHOW_NODE_TABLE_INFO()` 描述一个节点表的属性。
- `SHOW_REL_TABLE_INFO()` 描述一个关系表的属性。

所有过程均使用 `CALL` 调用。您可以使用 `RETURN *` 返回每一列，或在 `RETURN` 子句中命名各个输出列。

## 列出节点表

使用 `SHOW_NODE_TABLES()` 列出当前模式中的节点表：

```cypher
CALL SHOW_NODE_TABLES() RETURN *;
```

传入一个节点标签或标签列表，以仅返回匹配的表：

```cypher
CALL SHOW_NODE_TABLES('Person') RETURN *;
CALL SHOW_NODE_TABLES(['Person', 'Company']) RETURN *;
```

如果任何显式请求的标签不存在，NeuG 将报告错误。
重复的标签不会导致行重复。

结果中每个节点表占一行，并按节点标签名称排序。

| 列 | 类型 | 描述 |
| --- | --- | --- |
| `vertex_label_name` | `STRING` | 节点标签名称。 |
| `primary_key` | `STRING` | 主键属性名称。NeuG 目前要求每个节点表恰好有一个单列主键；不支持复合主键。 |
| `temporary` | `BOOL` | 对于临时节点表为 `true`，对于持久节点表为 `false`。 |

例如，给定持久的 `Person` 和 `Company` 节点表以及临时的 `TempPerson` 节点表，结果类似于：

| vertex_label_name | primary_key | temporary |
| --- | --- | --- |
| Company | id | false |
| Person | id | false |
| TempPerson | id | true |

## 列出关系表

NeuG 通过完整的 `[source label, relationship label, destination label]` 三元组来识别关系表。使用 `SHOW_REL_TABLES()` 列出当前图模式中所有有效的关系三元组：

```cypher
CALL SHOW_REL_TABLES() RETURN *;
```

传入一个关系三元组或三元组列表，以仅返回匹配的表：

```cypher
CALL SHOW_REL_TABLES('[Person, WorksAt, Company]') RETURN *;
CALL SHOW_REL_TABLES([
    '[Person, WorksAt, Company]',
    '[Person, Knows, Person]'
]) RETURN *;
```

每个过滤器均使用 `[source label, relationship label, destination label]` 语法。在源或目标位置使用 `*` 可匹配该位置的所有端点标签。例如，以下调用分别返回所有 `WorksAt` 端点对以及所有源为 `Person` 的 `WorksAt` 对：

```cypher
CALL SHOW_REL_TABLES('[*, WorksAt, *]') RETURN *;
CALL SHOW_REL_TABLES('[Person, WorksAt, *]') RETURN *;
```

通配符过滤器也可以在列表中组合使用。如果任何三元组格式错误或未匹配到任何关系表，NeuG 将报告错误。重复和重叠的过滤器不会导致行重复。

结果按关系标签、源标签和目标标签排序。

| 列 | 类型 | 描述 |
| --- | --- | --- |
| `edge_label_name` | `STRING` | 关系标签名称。 |
| `src_label_name` | `STRING` | 源节点标签名称。 |
| `dst_label_name` | `STRING` | 目标节点标签名称。 |
| `multiplicity` | `STRING` | 关系基数：`MANY_TO_MANY`、`ONE_TO_MANY`、`MANY_TO_ONE` 或 `ONE_TO_ONE`。 |
| `temporary` | `BOOL` | 对于临时关系表为 `true`，对于持久化关系表为 `false`。 |
| `extra_options` | `STRING` | 编码为 JSON 对象的其他关系表选项。 |

对于此关系表：

```cypher
CREATE REL TABLE WorksAt(
    FROM Person TO Company,
    since INT32 DEFAULT 2000,
    role STRING,
    MANY_TO_ONE
) WITH (sort_key_for_nbr = 'since');
```

对应的行为：

| edge_label_name | src_label_name | dst_label_name | multiplicity | temporary | extra_options |
| --- | --- | --- | --- | --- | --- |
| WorksAt | Person | Company | MANY_TO_ONE | false | `{"sort_key_for_nbr":"since"}` |

当未设置其他选项时，`extra_options` 为 `{}`。

## 检查节点表属性

使用 `SHOW_NODE_TABLE_INFO()` 加上节点标签来检查节点表：

```cypher
CALL SHOW_NODE_TABLE_INFO('Person') RETURN *;
```

结果保留属性声明顺序，并包含以下列：

| 列 | 类型 | 描述 |
| --- | --- | --- |
| `property_name` | `STRING` | 属性名称。 |
| `property_type` | `STRING` | NeuG 属性类型，例如 `INT64`、`VARCHAR` 或 `BOOLEAN`。 |
| `default_value` | `STRING` | DDL 中声明的默认值，或者当 DDL 未指定时的系统默认值。 |
| `primary_key` | `BOOL` | 该属性是否为节点表的主键。 |

例如，给定：

```cypher
CREATE NODE TABLE Person(
    id INT64 PRIMARY KEY,
    name STRING DEFAULT 'anonymous',
    age INT32,
    active BOOL DEFAULT true
);
```

`CALL SHOW_NODE_TABLE_INFO('Person') RETURN *;` 返回：

| property_name | property_type | default_value | primary_key |
| --- | --- | --- | --- |
| id | INT64 | 0 | true |
| name | VARCHAR | anonymous | false |
| age | INT32 | 0 | false |
| active | BOOLEAN | true | false |

`SHOW_NODE_TABLE_INFO()` 需要一个常量节点标签字符串。如果节点标签不存在，NeuG 将报告错误。主键不能声明显式默认值；执行此类操作的 `CREATE NODE TABLE` 语句将被拒绝，而不是静默地用类型默认值替换该值。

## 检查关系表属性

将 `SHOW_REL_TABLE_INFO()` 与完整的关系三元组一起使用。该三元组的语法与 [命名空间](./namespace.md) 所使用的关系语法相同：

```cypher
CALL SHOW_REL_TABLE_INFO('[Person, WorksAt, Company]') RETURN *;
```

三元组及其元素周围的空白会被忽略。源标签和目标标签具有意义，因此交换它们会指向不同的关系表。

结果保留属性声明顺序，并包含以下列：

| 列 | 类型 | 描述 |
| --- | --- | --- |
| `property_name` | `STRING` | 属性名称。 |
| `property_type` | `STRING` | NeuG 属性类型，例如 `INT64`、`VARCHAR` 或 `BOOLEAN`。 |
| `default_value` | `STRING` | DDL 中声明的默认值；如果 DDL 未指定，则为系统默认值。 |

对于前面的 `WorksAt` 关系表，`CALL SHOW_REL_TABLE_INFO('[Person, WorksAt, Company]') RETURN *;` 返回：

| property_name | property_type | default_value |
| --- | --- | --- |
| since | INT32 | 2000 |
| role | VARCHAR |  |

`SHOW_REL_TABLE_INFO()` 需要一个常量三元组字符串。如果三元组格式错误或当前模式中不存在该确切的关系三元组，NeuG 将报告错误。与 `SHOW_REL_TABLES()` 不同，此过程不接受 `*`，因为端点对必须唯一标识一个关系表。
