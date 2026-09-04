# 聚合函数

聚合函数主要用于对当前数据进行分组，并对每个分组内的元素执行聚合操作，最终为每个分组仅生成一个单一的值。NeuG 支持的聚合函数如下：

函数 | 描述 | 是否支持 DISTINCT | 示例
---------|-------------|---------------------------|--------
count | 返回行数 | 是 | RETURN count(a.name);
collect | 将元素收集到单个列表中 | 是 | RETURN collect(a.name);
min | 返回最小值 | 否 | RETURN min(a.age);
max | 返回最大值 | 否 | RETURN max(a.age);
sum | 对值求和 | 否 | RETURN sum(a.age);
avg | 返回平均值 | 否 | RETURN avg(a.age);

## NULL 值处理

- 当输入为空时，`count()` 和 `sum` 返回 `0`，`collect` 返回 `[]`，而 `avg`、`min` 和 `max` 返回 `NULL`。
- 当输入中包含 `NULL` 值时，所有聚合函数均忽略这些 `NULL` 值。特别地，`count(*)` 会对每一输入行计数，包括含有 `NULL` 值的行。
- 当输入完全由 `NULL` 值组成时，在忽略 `NULL` 后所得的聚合结果与空输入情况相同：`count()` 和 `sum` 返回 `0`，`collect` 返回 `[]`，`avg`、`min` 和 `max` 返回 `NULL`；而 `count(*)` 仍返回输入行的总数量。

输入 | `count(expr)` | `count(*)` | `collect` | `min` | `max` | `sum` | `avg`
------|---------------|------------|-----------|-------|-------|-------|------
`[]` | `0` | `0` | `[]` | `NULL` | `NULL` | `0` | `NULL`
`[1, NULL, 2]` | `2` | `3` | `[1, 2]` | `1` | `2` | `3` | `1.5`
`[NULL, NULL]` | `0` | `2` | `[]` | `NULL` | `NULL` | `0` | `NULL`
