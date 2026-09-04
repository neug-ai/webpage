# 算术运算符

NeuG 支持常见的算术运算，包括加法 (+)、减法 (-)、乘法 (*)、除法 (/) 和取模 (%)。

## 结果类型

可参与算术运算的数据类型有：INT32、UINT32、INT64、UINT64、FLOAT、DOUBLE。算术运算的结果类型由操作数类型决定，遵循以下规则：
- 如果操作数位数不同（如 32 位 vs 64 位），结果使用较大的位数
- 如果操作数位数相同但符号不同，结果提升到下一个更大的有符号类型（如 `INT32` + `UINT32` -> `INT64`），否则提升到相同位数的无符号类型（如 `INT64` + `UINT64` -> `UINT64`)
- 浮点类型优先于整数类型，DOUBLE 是最高精度的浮点类型

下表详细说明了不同操作数组合的结果类型：

| Operand0 | Operand1 | Result |
|----------|----------|--------|
| INT32    | INT32    | INT32  |
| INT32    | UINT32   | INT64  |
| INT32    | INT64    | INT64  |
| INT32    | UINT64   | UINT64 |
| INT32    | FLOAT    | FLOAT  |
| INT32    | DOUBLE   | DOUBLE |

| Operand0 | Operand1 | Result |
|----------|----------|--------|
| UINT32   | INT32    | INT64  |
| UINT32   | UINT32   | UINT32 |
| UINT32   | INT64    | INT64  |
| UINT32   | UINT64   | UINT64 |
| UINT32   | FLOAT    | FLOAT  |
| UINT32   | DOUBLE   | DOUBLE |

| Operand0 | Operand1 | Result |
|----------|----------|--------|
| INT64    | INT32    | INT64  |
| INT64    | UINT32   | INT64  |
| INT64    | INT64    | INT64  |
| INT64    | UINT64   | UINT64 |
| INT64    | FLOAT    | FLOAT  |
| INT64    | DOUBLE   | DOUBLE |

| Operand0 | Operand1 | Result |
|----------|----------|--------|
| UINT64   | INT32    | UINT64 |
| UINT64   | UINT32   | UINT64 |
| UINT64   | INT64    | UINT64 |
| UINT64   | UINT64   | UINT64 |
| UINT64   | FLOAT    | FLOAT  |
| UINT64   | DOUBLE   | DOUBLE |

| Operand0 | Operand1 | Result |
|----------|----------|--------|
| FLOAT    | INT32    | FLOAT  |
| FLOAT    | UINT32   | FLOAT  |
| FLOAT    | INT64    | FLOAT  |
| FLOAT    | UINT64   | FLOAT  |
| FLOAT    | FLOAT    | FLOAT  |
| FLOAT    | DOUBLE   | DOUBLE |

| Operand0 | Operand1 | Result |
|----------|----------|--------|
| DOUBLE   | INT32    | DOUBLE |
| DOUBLE   | UINT32   | DOUBLE |
| DOUBLE   | INT64    | DOUBLE |
| DOUBLE   | UINT64   | DOUBLE |
| DOUBLE   | FLOAT    | DOUBLE |
| DOUBLE   | DOUBLE   | DOUBLE |

## 错误处理

除了结果类型外，算术运算还可能根据操作数的值遇到溢出、下溢或除零错误。针对这些错误，NeuG 根据数据类型和部署模式提供不同的处理方式：

1. **浮点类型**：不执行特殊处理；系统依赖标准 [IEEE 754]() 行为，返回无穷大、负无穷大或 NaN 值。

2. **整数类型**：调试模式和发布模式下的行为有所不同：
   - **调试模式**：性能要求较低，允许在执行期间进行输入验证并显式抛出异常
   - **发布模式**：性能要求较高，这意味着溢出/下溢将返回未定义的值，但除零操作可能会显式抛出异常


下表详细列出了每个运算符可能遇到的错误类型：

| 运算符 | 溢出 | 下溢 | 除零 | 示例 |
|----------|----------|-----------|--------------|---------|
| +        | 是      | 是       | 不适用           | RETURN CAST(2147483647, 'int32') + CAST(1, 'int32') |
| -        | 是      | 是       | 不适用           | RETURN CAST(-2147483648, 'int32') - CAST(1, 'int32') |
| *        | 是      | 是       | 不适用           | RETURN CAST(2147483647, 'int32') * CAST(2, 'int32') |
| /        | 否       | 否        | 是          | RETURN 5 / 0 |
| %        | 否       | 否        | 是          | RETURN 5 % 0 |

## 日期算术

除数值类型外，算术运算还可用于日期时间类型和间隔类型。NeuG 支持日期时间算术运算，允许您在日期和时间戳上添加或减去间隔，以及计算时间值之间的差异。

### 支持的操作

下表详细说明了支持的日期算术操作：

| 操作 | 描述 | 示例 | 结果 |
|-----------|-------------|---------|--------|
| DATE + INTERVAL | 向日期添加间隔 | `DATE('2011-02-15') + INTERVAL('5 DAYS')` | `DATE('2011-02-20')` |
| DATE - INTERVAL | 从日期减去间隔 | `DATE('2011-02-15') - INTERVAL('5 DAYS')` | `DATE('2011-02-10')` |
| TIMESTAMP + INTERVAL | 向时间戳添加间隔 | `TIMESTAMP('2011-10-21 14:25:13') + INTERVAL('30 HOURS 20 SECONDS')` | `TIMESTAMP('2011-10-22 20:25:33')` |
| TIMESTAMP - INTERVAL | 从时间戳减去间隔 | `TIMESTAMP('2011-10-21 14:25:13') - INTERVAL('30 HOURS 20 SECONDS')` | `TIMESTAMP('2011-10-20 08:24:53')` |
| INTERVAL + INTERVAL | 两个间隔相加 | `INTERVAL('5 DAYS') + INTERVAL('30 HOURS 20 SECONDS')` | `INTERVAL('6 DAYS 6 HOURS 20 SECONDS')` |
| INTERVAL - INTERVAL | 间隔相减 | `INTERVAL('5 DAYS') - INTERVAL('30 HOURS 20 SECONDS')` | `INTERVAL('3 DAYS 17 HOURS 39 MINUTES 40 SECONDS')` |
| TIMESTAMP - TIMESTAMP | 计算时间差 | `TIMESTAMP('2011-10-21 14:25:13') - TIMESTAMP('1989-10-21 14:25:13')` | `INTERVAL('8035 DAYS')` |
