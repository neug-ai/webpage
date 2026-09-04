# 时间函数

时间函数是一组专门为日期和间隔数据类型设计的函数。它们提供从字符串字面值构造日期/间隔类型以及从时间值提取特定字段的功能。下表列出可用的函数及其用法。

## 函数参考

| 函数 | 描述 | 示例 | 返回类型 |
|----------|-------------|---------|-------------|
| `DATE()` | 从字符串字面值构造日期值 | `DATE('2012-01-01')` | `DATE` |
| `TIMESTAMP()` | 从字符串字面值构造时间戳值 | `TIMESTAMP('1926-11-21 13:22:19')` | `TIMESTAMP` |
| `INTERVAL()` | 从字符串字面值构造间隔值 | `INTERVAL('3 DAYS')` | `INTERVAL` |
| `DATE_PART(part, date)` | 从日期值提取特定部分 | `DATE_PART('year', DATE('1995-11-02'))` | `INTEGER` |
| `DATE_PART(part, timestamp)` | 从时间戳值提取特定部分 | `DATE_PART('month', TIMESTAMP('1926-11-21 13:22:19'))` | `INTEGER` |
| `DATE_PART(part, interval)` | 从间隔值提取特定部分 | `DATE_PART('days', INTERVAL('1 days'))` | `INTEGER` |