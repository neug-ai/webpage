# 列表函数

自 v0.2.0 版本起，NeuG 提供了用于处理类列表（list-like）值的内置函数。这些函数为在 Cypher 查询中构建、组合及操作集合值提供了常见操作。

当前支持的列表函数汇总如下：

| 函数                              | 描述                                   | 示例                                 |
| --------------------------------- | -------------------------------------- | ------------------------------------ |
| `list_append(list_like, element)` | 将一个元素追加到列表或数组末尾         | `RETURN list_append([1, 2], 3)`      |
| `list_concat(left, right)`        | 连接两个列表或数组                     | `RETURN list_concat([1, 2], [3, 4])` |

各函数所接受的参数类型、返回类型、类型推断规则及其具体行为，将在下方对应章节中详细说明。

## `list_append`

`list_append` 将单个元素追加到 `LIST` 或 `ARRAY` 的末尾。
输入值和待追加的元素也可以是嵌套的 `LIST` 或 `ARRAY`，前提是它们的嵌套元素类型兼容。

### 语法

```cypher
list_append(list_like, element)
```

`list_like` 必须为 `LIST<T>` 或 `ARRAY<T, N>` 类型。

`element` 可以是常量、动态参数、属性，或另一个 Cypher 表达式。

NeuG 会在现有元素类型与待追加值的类型之间确定一个公共类型。必要时，两个输入值会隐式转换为该公共类型，然后再构造结果。

该函数返回一个新 `LIST`；输入的 `LIST` 或 `ARRAY` 不会被修改。

### 示例

#### 追加一个常量

```cypher
RETURN list_append([1, 2], 3);
// [1, 2, 3]
```

#### 追加动态参数

动态参数可用作待追加的元素：

```cypher
WITH $value AS value
RETURN list_append([1, 2], value);
```

例如，当 `$value` 为 `3` 时，结果为：

```text
[1, 2, 3]
```

参数类型参与与常量相同的方式进行通用类型推断。`WITH` 子句会在将动态参数传递给列表函数之前，将其绑定为查询中的一个值。

#### 向 `LIST` 属性追加元素

给定以下模式：

```cypher
CREATE NODE TABLE Item(
    id INT64,
    tags INT64[],
    coordinates INT64[3],
    PRIMARY KEY(id)
);
```

其中 `tags` 是一个 `LIST<INT64>` 类型的属性：

```cypher
MATCH (item:Item)
RETURN list_append(item.tags, 10);
```

返回值包含 `item.tags` 的原始元素，其后追加了 `10`。

该存储的属性本身不会被修改。

#### 向 `ARRAY` 属性追加元素

`ARRAY` 类型的值同样被支持：

```cypher
MATCH (item:Item)
RETURN list_append(item.coordinates, 10);
```

如果 `item.coordinates` 的值为：

```text
[1, 2, 3]
```

则结果为：

```text
[1, 2, 3, 10]
```

该结果是一个 `LIST<INT64>`，而非 `ARRAY<INT64, 4>`。原始的定长数组 `ARRAY<INT64, 3>` 保持不变。

#### 向空列表追加元素

```cypher
RETURN list_append([], 1);
// [1]
```

当输入为未指定类型的空列表时，所追加的值将决定结果列表的元素类型。

#### 追加 `NULL`

当输入已提供明确的元素类型时，可直接追加 `NULL`：

```cypher
RETURN list_append([1, 2], NULL);
// [1, 2, NULL]
```

在此示例中，现有列表将元素类型确定为 `INT64`，返回的列表则保留所追加的 `NULL` 值。

#### 追加兼容类型

如果现有元素与待追加的值具有不同但兼容的类型，NeuG 将确定一个公共类型，并在必要时对值进行转换：

```cypher
RETURN list_append([1, 2], 3.5);
// [1.0, 2.0, 3.5]
```

此处，整数值被提升为结果所采用的公共数值类型。

#### 向嵌套列表追加元素

支持嵌套列表。被追加的元素本身必须是兼容的列表值：

```cypher
RETURN list_append([[1, 2], [3, 4]], [5, 6]);
// [[1, 2], [3, 4], [5, 6]]
```

### 错误处理

`list_append` 在以下情况下报告错误：

* 函数未接收到恰好两个参数；
* 第一个参数不是 `LIST` 或 `ARRAY`；
* 现有元素类型与待追加的值之间不存在兼容的公共类型；
* 无法执行向推断出的公共类型所必需的隐式转换。

例如，以下调用是无效的，因为第一个参数是一个标量，而非 `LIST` 或 `ARRAY`：

```cypher
RETURN list_append(1, 2);
```

## `list_concat`

`list_concat` 用于连接两个 `LIST` 或 `ARRAY` 值。
当嵌套的 `LIST` 和 `ARRAY` 值的嵌套元素类型兼容时，也支持此类嵌套结构。

### 语法

```cypher
list_concat(left_list_like, right_list_like)
```

两个参数都必须是 `LIST` 或 `ARRAY` 类型的值。

这两个输入：

* 不必使用相同的容器类型；
* 不必具有相同的长度；
* 元素类型可以不同，但必须兼容。

NeuG 会推断出一个公共的元素类型，在必要时对元素进行类型转换，并返回一个新 `LIST`，其中先包含左侧输入的所有元素，再包含右侧输入的所有元素。

两个输入值本身均不会被修改。

### 示例

#### 连接两个列表

```cypher
RETURN list_concat([1, 2], [3, 4]);
// [1, 2, 3, 4]
```

#### 连接 `LIST` 和 `ARRAY` 属性

使用上文定义的 `Item` 模式：

```cypher
MATCH (item:Item)
RETURN list_concat(item.tags, item.coordinates);
```

`item.tags` 是一个变长的 `LIST<INT64>`，而 `item.coordinates` 是一个定长的 `ARRAY<INT64, 3>`。二者均可作为输入参数，结果为一个 `LIST<INT64>`。

参数顺序也可互换：

```cypher
MATCH (item:Item)
RETURN list_concat(item.coordinates, item.tags);
```

#### 连接数组

固定大小的数组可直接连接：

```cypher
MATCH (item:Item)
RETURN list_concat(item.coordinates, item.coordinates);
```

即使两个输入均为 `ARRAY` 类型，结果仍为 `LIST`。

#### 连接长度不同的值

两个输入参数无需包含相同数量的元素：

```cypher
RETURN list_concat([1], [2, 3, 4]);
// [1, 2, 3, 4]
```

#### 连接空列表

空列表在左右两侧均受支持：

```cypher
RETURN list_concat([], [1, 2]);
// [1, 2]
```

```cypher
RETURN list_concat([1, 2], []);
// [1, 2]
```

两个空列表也可进行连接：

```cypher
RETURN list_concat([], []);
// []
```

当一侧具有已知的元素类型时，该类型可用于推断未指定类型的空列表的类型。

#### 连接兼容的元素类型

如果两个输入具有不同但兼容的元素类型，NeuG 会将它们提升为一个公共类型：

```cypher
RETURN list_concat([1, 2], [3.5, 4.5]);
// [1.0, 2.0, 3.5, 4.5]
```

#### 连接嵌套列表

当嵌套列表的子列表类型兼容时，可以将它们连接起来：

```cypher
RETURN list_concat([[1, 2]], [[3, 4], [5, 6]]);
// [[1, 2], [3, 4], [5, 6]]
```

### 错误处理

`list_concat` 在以下情况下报告错误：

* 函数未恰好接收两个参数；
* 任一参数既不是 `LIST` 也不是 `ARRAY`；
* 两个输入的元素类型不存在兼容的公共类型；
* 无法对任一输入执行向推断出的公共类型所必需的隐式类型转换。

例如，以下调用无效，因为第二个参数是一个标量：

```cypher
RETURN list_concat([1], 2);
```

## 类型推断与转换

列表函数在需要时会根据其输入确定一个共同的元素类型。

当所有值已具有相同的元素类型时，则无需进行类型提升：

```cypher
RETURN list_concat([1, 2], [3, 4]);
// LIST<INT64>
```

当混合使用兼容的数值类型时，NeuG 会将这些值提升为一个共同的数值类型：

```cypher
RETURN list_append([1, 2], 3.5);
// [1.0, 2.0, 3.5]
```

```cypher
RETURN list_concat([1, 2], [3.5, 4.5]);
// [1.0, 2.0, 3.5, 4.5]
```

诸如空列表字面量和 `NULL` 这类未显式指定类型的值，其类型可由其他输入推导得出。

例如：

```cypher
RETURN list_append([], 1);
// [1]
```

此处，`1` 决定了结果的元素类型。

类似地：

```cypher
RETURN list_append([1, 2], NULL);
// [1, 2, NULL]
```

此处，`[1, 2]` 为结果提供了元素类型。

若顶层 `NULL` 输入被显式指定为某种类型（如通过 `CAST`），则该 `NULL` 将直接传播为函数结果：

```cypher
RETURN list_append(CAST(NULL, 'INT64[]'), 3);
// NULL
```

```cypher
RETURN list_concat(CAST(NULL, 'INT64[]'), [1]);
// NULL
```

如果 NeuG 无法确定一个兼容的共同元素类型，或所需隐式转换不被支持，则该函数将报告错误。

## 列表函数中的 NULL 值

当输入列表的元素类型可被确定时，`list_append` 支持向列表追加 `NULL` 值：

```cypher
RETURN list_append([1, 2], NULL);
// [1, 2, NULL]
```

返回的 `LIST` 可以保留所追加的 `NULL` 值。例如，上述结果包含三个元素，其中最后一个元素为 `NULL`。

此行为适用于列表函数所返回的值。但当前**存储的列表属性不支持将 `NULL` 作为单个列表元素**。当一个包含 `NULL` 元素的列表被写入列表属性时，该 `NULL` 元素会被转换为该属性元素类型的默认值。

例如，若目标属性类型为 `INT64[]`：

```text
[1, 2, NULL]
```

则实际存储为：

```text
[1, 2, 0]
```

其中 `0` 是 `INT64` 类型的默认值。

因此，`list_append` 返回的 `LIST` 可能包含 `NULL`，但将该值持久化到列表属性时，`NULL` 元素不会被保留。
