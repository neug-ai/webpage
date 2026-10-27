# 时间函数

时间函数用于构造时间值、从中提取字段，并将日期或时间戳分组到时间桶中。下表列出了可用的函数及其用法。

## 函数参考

> 对于 `TIME_BUCKET`，**固定时长宽度**是指以周、天或更小单位表示的区间，这些单位可以转换为固定的毫秒数。例如，一天始终为 86,400,000 毫秒。月/年宽度则使用日历月，其长度随日历变化。

| 函数 | 描述 | 示例 | 返回类型 |
|----------|-------------|---------|-------------|
| `DATE()` | 从字符串字面量构造日期值 | `DATE('2012-01-01')` | `DATE` |
| `TIMESTAMP()` | 从字符串字面量构造时间戳值 | `TIMESTAMP('1926-11-21 13:22:19')` | `TIMESTAMP` |
| `INTERVAL()` | 从字符串字面量构造间隔值 | `INTERVAL('3 DAYS')` | `INTERVAL` |
| `DATE_PART(part, date)` | 从日期值中提取特定部分 | `DATE_PART('year', DATE('1995-11-02'))` | `INTEGER` |
| `DATE_PART(part, timestamp)` | 从时间戳值中提取特定部分 | `DATE_PART('month', TIMESTAMP('1926-11-21 13:22:19'))` | `INTEGER` |
| `DATE_PART(part, interval)` | 从间隔值中提取特定部分 | `DATE_PART('days', INTERVAL('1 days'))` | `INTEGER` |
| `TIME_BUCKET(width, date/timestamp)` | 返回包含该日期或时间戳的桶的起始位置。对于月/年宽度，桶与 `2000-01-01 00:00:00` 对齐；对于周、天及更细粒度的固定时长宽度，桶与 `2000-01-03 00:00:00`（星期一）对齐。 | `TIME_BUCKET(INTERVAL('1 week'), DATE('2024-03-20'))` | 与输入相同：`DATE` 或 `TIMESTAMP` |
| `TIME_BUCKET(width, date/timestamp, offset)` | 返回桶起始位置，并相对于默认对齐方式添加 `INTERVAL` 偏移量：对于月/年宽度为 `2000-01-01 00:00:00 + offset`，对于固定时长宽度为 `2000-01-03 00:00:00 + offset`。包含月的日历偏移量遵循下述日历规则。 | `TIME_BUCKET(INTERVAL('10 minutes'), TIMESTAMP('2024-03-20 15:26:12.345'), INTERVAL('5 minutes'))` | 与输入相同：`DATE` 或 `TIMESTAMP` |
| `TIME_BUCKET(width, date/timestamp, origin)` | 使用提供的 `DATE` 或 `TIMESTAMP` 原点而非默认对齐方式来返回桶起始位置。固定时长宽度使用完整的原点；月/年宽度仅使用其年份和月份。 | `TIME_BUCKET(INTERVAL('2 months'), DATE('2024-03-20'), DATE('2024-02-15'))` | 如果两个时间参数均为 `DATE`，则为 `DATE`；否则为 `TIMESTAMP` |

## 时间分桶

`TIME_BUCKET` 将时间值分组到给定 `width` 的区间中，并返回包含每个值的桶的起始点。使用返回值将事件分组为诸如十分钟、一周或日历月等周期。恰好位于桶边界上的值属于从该边界开始的桶。桶也会向对齐原点之前延伸。

### 支持的宽度与限制

以下规则适用于所有三种形式的 `width`：

- `width` 必须是一个大于零的 `INTERVAL`。
- 日历宽度可以包含月或年，例如 `INTERVAL('2 months')`、`INTERVAL('1 year')` 或 `INTERVAL('1 year 2 months')`。一年等于十二个日历月；月不被视为三十天。
- **宽度不能将月或年与日或时间分量组合。** 例如，`INTERVAL('1 month 1 hour')`、`INTERVAL('1 month 1 day')` 和 `INTERVAL('1 year 1 week')` 会被拒绝。
- 固定持续时间宽度可以组合周、日、时、分、秒和毫秒。例如，支持 `INTERVAL('1 week 1 hour')` 和 `INTERVAL('1 day 2 hours 30 minutes')`。这些宽度使用 `2000-01-03 00:00:00` 默认原点。
- 零值和负值宽度会被拒绝。如果总持续时间为正，固定持续时间分量可以具有不同的符号，例如 `INTERVAL('1 day -1 hour')`。

时间参数支持 `DATE` 和毫秒精度的 `TIMESTAMP`。不支持 `TIME` 和带时区的值。请使用 `INTERVAL(...)`、`DATE(...)`、`TIMESTAMP(...)` 或显式的 `CAST` 构造类型化值；纯字符串不能直接作为 `TIME_BUCKET` 参数接受。超出支持的时间范围的计算会引发错误。

### `TIME_BUCKET(width, date/timestamp)`

双参数形式使用默认对齐原点：

| 参数 | 支持的类型 | 含义 |
|-----------|----------------|---------|
| `width` | `INTERVAL` | 桶宽度，受上述限制约束 |
| `date/timestamp` | `DATE` 或 `TIMESTAMP` | 要放入桶中的值 |

月/年桶从每月第一天的午夜开始，并对齐到 `2000-01-01 00:00:00`。固定时长桶对齐到 `2000-01-03 00:00:00`，因此一周的桶从星期一开始。

返回类型与时间输入匹配。`DATE` 在分桶时被视为午夜，返回的 `DATE` 仅包含桶起始的日历日期。若要保留小时、分钟、秒或毫秒，请先将输入转换为 `TIMESTAMP`。

```cypher
RETURN TIME_BUCKET(INTERVAL('10 minutes'),
                   TIMESTAMP('2024-03-20 15:26:12.345'));
// ---
// 2024-03-20 15:20:00.000
```

```cypher
RETURN TIME_BUCKET(INTERVAL('1 week'), DATE('2024-03-20'));
// ---
// 2024-03-18
```

两个月的桶使用日历月：

```cypher
RETURN TIME_BUCKET(INTERVAL('2 months'), DATE('2024-03-20'));
// ---
// 2024-03-01
```

也支持混合固定时长单位。此处，每个桶的时长为七天零一小时：

```cypher
RETURN TIME_BUCKET(INTERVAL('1 week 1 hour'),
                   TIMESTAMP('2000-01-10 02:30:00'));
// ---
// 2000-01-10 01:00:00.000
```

### `TIME_BUCKET(width, date/timestamp, offset)`

偏移形式通过一个间隔来移动默认的桶对齐方式：

| 参数 | 支持的类型 | 含义 |
|-----------|----------------|---------|
| `width` | `INTERVAL` | 桶宽度，受上述限制约束 |
| `date/timestamp` | `DATE` 或 `TIMESTAMP` | 放入桶中的值 |
| `offset` | `INTERVAL` | 相对于默认对齐方式的日历或持续时间偏移 |

对于月/年宽度，对齐从 `2000-01-01 00:00:00 + offset` 开始；对于固定持续时间宽度，对齐从 `2000-01-03 00:00:00 + offset` 开始。例如，五分钟偏移会将十分钟桶的边界从 `:00`、`:10`、`:20`、... 更改为 `:05`、`:15`、`:25`、... 。

与 `width` 不同，`offset` 可以为零、负数、大于桶宽度，或者是月、日和時間单位的混合。其时间部分仍必须是精确的整毫秒数。

当 `offset` 包含月份时，适用日历算术：从输入中减去偏移量，使用默认对齐方式对该值进行分桶，然后将偏移量加到桶起始时间上。如果移动到天数较少的月份，无效日期会调整为该月的最后一天。因此，包含月份的偏移量并不总是等同于将 `default origin + offset` 作为显式原点提供。

返回类型与 `date/timestamp` 匹配。对于 `DATE` 输入，在仅返回桶起始日期的之前，会应用完整的偏移量。

```cypher
RETURN TIME_BUCKET(INTERVAL('10 minutes'),
                   TIMESTAMP('2024-03-20 15:26:12.345'),
                   INTERVAL('5 minutes'));
// ---
// 2024-03-20 15:25:00.000
```

十五天的偏移会使月度桶从十六日开始：

```cypher
RETURN TIME_BUCKET(INTERVAL('1 month'), DATE('2024-03-20'),
                   INTERVAL('15 days'));
// ---
// 2024-03-16
```

使用六小时偏移时，3月20日的午夜属于从 `2024-03-19 06:00:00` 开始的每日桶。`DATE` 结果仅返回该边界的日期：

```cypher
RETURN TIME_BUCKET(INTERVAL('1 day'), DATE('2024-03-20'),
                   INTERVAL('6 hours'));
// ---
// 2024-03-19
```

### `TIME_BUCKET(width, date/timestamp, origin)`

原始形式用时间值替换默认对齐方式：

| 参数 | 支持的类型 | 含义 |
|-----------|----------------|---------|
| `width` | `INTERVAL` | 桶宽度，受上述限制约束 |
| `date/timestamp` | `DATE` 或 `TIMESTAMP` | 放入桶中的值 |
| `origin` | `DATE` 或 `TIMESTAMP` | 自定义桶对齐原点 |

对于固定持续时间的宽度，完整的原点决定桶边界。`DATE` 原点表示该日期的午夜。

对于月/年宽度，**仅使用原点的年份和月份**。其日期和时间被忽略，桶起始时间始终是每月第一天的午夜。例如，宽度为两个月且原点在二月的情况下，生成的桶从 2 月 1 日、4 月 1 日、6 月 1 日等开始，即使原点是 2 月 15 日中午。

返回类型取决于两个时间参数：

| `date/timestamp` 类型 | `origin` 类型 | 返回类型 |
|-----------------------|---------------|-------------|
| `DATE` | `DATE` | `DATE` |
| `DATE` | `TIMESTAMP` | `TIMESTAMP` |
| `TIMESTAMP` | `DATE` | `TIMESTAMP` |
| `TIMESTAMP` | `TIMESTAMP` | `TIMESTAMP` |

当任一时间参数为 `TIMESTAMP` 时，`DATE` 参数被视为午夜，结果保留时间戳精度。

```cypher
RETURN TIME_BUCKET(INTERVAL('10 minutes'),
                   TIMESTAMP('2024-03-20 15:26:12.345'),
                   TIMESTAMP('2024-03-20 15:03:00'));
// ---
// 2024-03-20 15:23:00.000
```

```cypher
RETURN TIME_BUCKET(INTERVAL('2 months'),
                   TIMESTAMP('2024-03-20 15:26:12.345'),
                   TIMESTAMP('2024-02-15 12:00:00'));
// ---
// 2024-02-01 00:00:00.000
```

混合使用 `DATE` 和 `TIMESTAMP` 将返回 `TIMESTAMP`：

```cypher
RETURN TIME_BUCKET(INTERVAL('1 day'), DATE('2024-03-20'),
                   TIMESTAMP('2024-03-01 06:00:00'));
// ---
// 2024-03-19 06:00:00.000
```

### NULL 值

在所有三种形式中，只要能够确定参数的类型，所有参数都可以为 `NULL`。如果任何参数为 `NULL`，则结果为 `NULL`，其返回类型与该形式的描述一致。`NULL` 的第三个参数并不表示请求默认对齐；请省略第三个参数以使用默认值。

| 形式 | 可空参数 | 当任何参数为 `NULL` 时的结果 |
|------|--------------------|------------------------------------|
| `TIME_BUCKET(width, date/timestamp)` | `width`, `date/timestamp` | `NULL` |
| `TIME_BUCKET(width, date/timestamp, offset)` | `width`, `date/timestamp`, `offset` | `NULL` |
| `TIME_BUCKET(width, date/timestamp, origin)` | `width`, `date/timestamp`, `origin` | `NULL` |

使用 `CAST(NULL, 'INTERVAL')`、`CAST(NULL, 'DATE')` 或 `CAST(NULL, 'TIMESTAMP')` 来指定预期类型。单独的 `NULL` 作为第三个参数会被拒绝，因为它可能表示偏移量或原点。在两参数形式和偏移量形式中，单独的 `NULL` 时间输入也需要进行类型转换，以确定结果是 `DATE` 还是 `TIMESTAMP`。单独的 `NULL` 宽度可以推断为 `INTERVAL`；在原点形式中，单独的 `NULL` 时间输入可以从已类型的原点获取其类型。

#### 双参数形式

任一参数都可以是 `NULL`：

```cypher
RETURN TIME_BUCKET(CAST(NULL, 'INTERVAL'), DATE('2024-03-20')) AS null_width,
       TIME_BUCKET(INTERVAL('1 day'), CAST(NULL, 'TIMESTAMP')) AS null_timestamp;
// ---
// null_width: NULL, null_timestamp: NULL
```

#### 偏移量形式

三个参数中的任意一个都可以是 `NULL`。将 `NULL` 偏移量转换为 `INTERVAL`：

```cypher
RETURN TIME_BUCKET(CAST(NULL, 'INTERVAL'), DATE('2024-03-20'), INTERVAL('6 hours')) AS null_width,
       TIME_BUCKET(INTERVAL('1 day'), CAST(NULL, 'DATE'), INTERVAL('6 hours')) AS null_date,
       TIME_BUCKET(INTERVAL('1 day'), DATE('2024-03-20'), CAST(NULL, 'INTERVAL')) AS null_offset;
// ---
// null_width: NULL, null_date: NULL, null_offset: NULL
```

#### 原始形式

三个参数中的任意一个都可以是 `NULL`。将 `NULL` 原始类型转换为 `DATE` 或 `TIMESTAMP`：

```cypher
RETURN TIME_BUCKET(CAST(NULL, 'INTERVAL'), DATE('2024-03-20'), DATE('2024-03-01')) AS null_width,
       TIME_BUCKET(INTERVAL('1 day'), CAST(NULL, 'DATE'), DATE('2024-03-01')) AS null_date,
       TIME_BUCKET(INTERVAL('1 day'), DATE('2024-03-20'), CAST(NULL, 'TIMESTAMP')) AS null_origin;
// ---
// null_width: NULL, null_date: NULL, null_origin: NULL
```

一旦参数类型有效，`NULL` 参数就会生成 `NULL`，即使宽度在其他情况下无效：

```cypher
RETURN TIME_BUCKET(INTERVAL('0 seconds'), CAST(NULL, 'TIMESTAMP'));
// ---
// NULL
```
