# 模式匹配扩展

自 NeuG **v0.2.0** 起，我们引入了模式匹配（Pattern Match）扩展，该扩展支持在当前 NeuG 图上执行子图模式匹配。

```cypher
CALL PATTERN_MATCH(Pattern, size, is_sampled)
[YIELD ...]
RETURN *;
```

- **`Pattern`** — 待匹配的图模式，例如 `'(a:Person)-[r:person_knows_person]->(b:Person)'`。其语法采用 Cypher 的节点/关系表示法。它仅是一个模式，而非完整查询：每个节点和关系都必须显式写出（但允许内联 `WHERE` 子句，用于对节点或关系的属性进行过滤）。
- **`size`**（可选）— 一个正整数（`>= 1`）。在精确匹配模式下，它表示提前终止的界限（即找到前 `size` 个匹配结果后即停止）；在采样匹配模式下，它表示采样规模。
- **`is_sampled`**（可选）— 一个布尔值，用于选择匹配算法：`false` 表示精确匹配，`true` 表示采样匹配（FaSTest）。该参数必须明确写作 `true` 或 `false`（不可写作 `0` 或 `1`）。

`size` 和 `is_sampled` 需配合使用。若两者均省略，则执行针对全部匹配结果的普通精确匹配：

```cypher
CALL PATTERN_MATCH('(a:Person)-[r:person_knows_person]->(b:Person)') RETURN *;
```

## 支持的模式

**支持：**

- 有向关系：`->` 和 `<-`
- 每个节点仅支持一个标签，每条关系仅支持一个类型
- 多跳路径：`(a)-[r1]->(b)-[r2]->(c)`（需显式写出每一跳）
- 环路：`(a)-[r1]->(b)-[r2]->(c)-[r3]->(a)`
- 内联属性映射（仅支持字面量值）：`(a:Person {age: 20})`
- 内联 `WHERE` 子句（基于属性的过滤）：`(a:Person)-[r:knows]->(b:Person) WHERE a.age > 25`

**示例：**

```cypher
-- 反向关系
CALL PATTERN_MATCH('(a:Person)<-[r:person_knows_person]-(b:Person)') RETURN *;

-- 内联属性映射（仅匹配 age = 20 的 Person 节点）
CALL PATTERN_MATCH('(a:Person {age: 20})-[r:person_knows_person]->(b:Person)') RETURN *;

-- 内联 WHERE（仅匹配源节点 age > 25 的边）
CALL PATTERN_MATCH('(a:Person)-[r:person_knows_person]->(b:Person) WHERE a.age > 25') RETURN *;

-- 多跳路径（2 跳）
CALL PATTERN_MATCH('(a:Person)-[r1:person_knows_person]->(b:Person)-[r2:person_knows_person]->(c:Person)') RETURN *;

-- 三角环路（3 跳后回到起点）
CALL PATTERN_MATCH('(a:Person)-[r1:person_knows_person]->(b:Person)-[r2:person_knows_person]->(c:Person)-[r3:person_knows_person]->(a:Person)') RETURN *;
```

**不支持（在绑定阶段即被拒绝）：**

- 可变长度 / 递归关系：`-[:R*3]->`、`-[:R*1..3]->`、`-[*]->`
- 无向关系：`(a)-[r]-(b)`
- 多标签节点：`(a:A:B)`
- 多类型关系：`[:A|:B]`
- `OPTIONAL MATCH`、`WITH`、`UNION`、数据修改操作（mutations）
- `WHERE` 中的 `OR`、`NOT`、`XOR`
- 跨变量比较：`a.age = b.age`
- 计算型投影（computed projections）、`ORDER BY`、`SKIP`、`LIMIT`（在模式内部）

请将固定长度路径显式地逐跳写出，而非使用 `*`。

## 安装扩展

```cypher
INSTALL pattern_matching;
```

## 加载扩展

```cypher
LOAD pattern_matching;
```

从源码构建时，使用以下命令启用该扩展：

```bash
cmake -S . -B build -DBUILD_EXTENSIONS="pattern_matching" -DBUILD_TEST=ON
cmake --build build --target neug_pattern_matching_extension -j$(sysctl -n hw.ncpu)
```

在 Linux 系统上，请将 `-j$(sysctl -n hw.ncpu)` 替换为 `-j$(nproc)`。

## 精确匹配

仅传入模式参数调用 `PATTERN_MATCH`，即可枚举**所有**精确匹配的子图嵌入：

```cypher
CALL PATTERN_MATCH('(a:Person)-[r:person_knows_person]->(b:Person)')
RETURN *;
```

输出结构：每行对应一个匹配结果；顶点以 `Vertex` 类型列返回，边以 `Edge` 类型列返回；列名由模式中的别名指定：

| a | r | b |
| --- | --- | --- |
| `Vertex(Person)` | `Edge(person_knows_person)` | `Vertex(Person)` |

对于多跳模式，每一跳均生成独立的列：

| a | r1 | b | r2 | c |
| --- | --- | --- | --- | --- |
| `Vertex(Person)` | `Edge(person_knows_person)` | `Vertex(Person)` | `Edge(person_knows_person)` | `Vertex(Person)` |

若需在找到前 `size` 个匹配后即停止（提前终止），请传入 `size` 参数，并设置 `is_sampled = false`：

```cypher
-- 精确匹配，找到前 10 个匹配后即停止
CALL PATTERN_MATCH('(a:Person)-[r:person_knows_person]->(b:Person)', 10, false)
RETURN *;
```

## 采样匹配

当精确枚举开销过大、而采样嵌入已足够满足需求时，可传入参数 `size` 并设置 `is_sampled = true`：

```cypher
CALL PATTERN_MATCH(
  '(a:Person)-[r:person_knows_person]->(b:Person)',
  1000, true
)
RETURN *;
```

此处 `size` 表示目标采样规模。该函数返回的采样嵌入，其顶点/边列布局与精确模式完全一致。

该采样实现基于 VLDB 2024 论文《子图匹配的基数估计：一种过滤-采样方法》（"Cardinality Estimation of Subgraph Matching: A Filtering-Sampling Approach"）中提出的 FaSTest 过滤-采样算法。本实现内部会计算 FaSTest 估计值，但对外提供的表函数返回的是以原生 `QueryResult` 行形式表示的采样匹配结果，而非 `estimated_count`、`result_file` 或 `props_file` 等列。

## 对结果应用 NeuG 操作符

由于输出的顶点/边变量所携带的目录（catalog）和属性（property）元数据与 `MATCH` 绑定的节点相同，因此 NeuG 自身的流水线子句可直接应用于尾部的 `RETURN` 子句：包括属性访问、`ORDER BY <var>.<prop>`、`LIMIT`，以及聚合操作（如 `count(<var>)` 和 `count(DISTINCT <var>.<prop>)`）。

```cypher
-- 投影标量属性，并排序和限制结果数量
CALL PATTERN_MATCH('(a:Person)-[r:person_knows_person]->(b:Person)')
RETURN a.name AS src, r.weight AS weight
ORDER BY r.weight DESC
LIMIT 10;

-- 对匹配结果进行聚合
CALL PATTERN_MATCH('(a:Person)-[r:person_knows_person]->(b:Person)')
RETURN count(a) AS matches, count(DISTINCT a.name) AS distinct_sources;
```

## YIELD

`PATTERN_MATCH` 支持在调用与末尾的 `RETURN` 之间使用可选的 `YIELD` 子句。`YIELD` 用于列出需向查询其余部分暴露的模式变量，并可通过 `AS` 对其重命名：

```cypher
-- 暴露所有匹配到的变量（等价于省略 YIELD）
CALL PATTERN_MATCH('(a:Person)-[r:person_knows_person]->(b:Person)')
YIELD a, r, b
RETURN a.name, r.weight, b.name;

-- 对匹配到的变量重命名
CALL PATTERN_MATCH('(a:Person)-[r:person_knows_person]->(b:Person)')
YIELD a AS src, b AS dst
RETURN src.name, dst.name;

-- 仅暴露子集；未在 YIELD 中列出的变量对 RETURN 不可见
CALL PATTERN_MATCH('(a:Person)-[r:person_knows_person]->(b:Person)')
YIELD b
RETURN b.name;
```

以下规则与限制与 NeuG 中其他 `YIELD` 用法保持一致：

- `YIELD` 的每一项为一个裸变量名，后可选择性地跟 `AS <别名>`。该项引用的是整个模式变量（即一个 `Vertex` 或 `Edge`）。
- **`YIELD` 中不可包含属性访问表达式。** 例如 `YIELD a.name` 是语法错误；应在末尾的 `RETURN` 中访问属性（如 `YIELD a RETURN a.name`）。
- 未在 `YIELD` 中列出的变量将被隐藏——若在 `RETURN` 中引用该变量，将触发“超出作用域”错误。
- 若 `YIELD` 中指定的名称并非模式变量，则会引发绑定错误。
- `YIELD` 后必须紧跟 `RETURN`；`YIELD` 本身不能单独终止查询。

NeuG 不支持对整个 `Vertex`/`Edge` 对象进行排序（例如 `ORDER BY a`）；应改为按标量属性排序，例如 `ORDER BY a.age`。

## 端到端示例

一个完整且可直接运行的流程：创建图模式（schema）、插入一个小图、加载扩展模块，然后执行模式匹配。所有语句均可直接在命令行界面（CLI）中运行，或通过 `conn.execute(...)` 调用：

```cypher
-- 1. 模式定义（Schema）
CREATE NODE TABLE Person(id INT32 PRIMARY KEY, name STRING, age INT32);
CREATE REL TABLE person_knows_person(FROM Person TO Person, weight DOUBLE);

-- 2. 数据（3 个人，构成一个有向三角形的 "knows" 边）
CREATE (n:Person {id: 0, name: 'Alice', age: 20});
CREATE (n:Person {id: 1, name: 'Bob',   age: 30});
CREATE (n:Person {id: 2, name: 'Carol', age: 40});
MATCH (a:Person), (b:Person) WHERE a.id = 0 AND b.id = 1
CREATE (a)-[:person_knows_person {weight: 0.5}]->(b);
MATCH (a:Person), (b:Person) WHERE a.id = 1 AND b.id = 2
CREATE (a)-[:person_knows_person {weight: 1.5}]->(b);
MATCH (a:Person), (b:Person) WHERE a.id = 2 AND b.id = 0
CREATE (a)-[:person_knows_person {weight: 0.5}]->(b);

-- 3. 加载扩展模块
LOAD pattern_matching;

-- 4. 精确匹配：返回所有满足 (a)-[r]->(b) 的嵌入（embeddings）
CALL PATTERN_MATCH('(a:Person)-[r:person_knows_person]->(b:Person)') RETURN *;

-- 5. 对匹配结果进行投影（project）、排序（order）和限制（limit）
CALL PATTERN_MATCH('(a:Person)-[r:person_knows_person]->(b:Person)')
RETURN a.name AS src, b.name AS dst, r.weight AS weight
ORDER BY weight DESC LIMIT 5;

-- 6. 对匹配结果执行聚合操作
CALL PATTERN_MATCH('(a:Person)-[r:person_knows_person]->(b:Person)')
RETURN count(a) AS matches, count(DISTINCT a.name) AS distinct_sources;

-- 7. YIELD：重命名并仅暴露所需列
CALL PATTERN_MATCH('(a:Person)-[r:person_knows_person]->(b:Person)')
YIELD a AS src, b AS dst
RETURN src.name AS source, dst.name AS destination
ORDER BY source;

-- 8. 抽样匹配（抽样大小为 2）
CALL PATTERN_MATCH('(a:Person)-[r:person_knows_person]->(b:Person)', 2, true) RETURN *;
```

相同流程的可运行 Python 脚本（使用仓库内提供的 Python 绑定）位于 `tools/python_bind/example/pattern_match_demo.py`：

```bash
python3 tools/python_bind/example/pattern_match_demo.py
```

## 使用本地构建的扩展

上述构建过程会生成 `build/extension/pattern_matching/libpattern_matching.neug_extension`。语句 `LOAD pattern_matching;` 将解析为 `<home>/extension/pattern_matching/libpattern_matching.neug_extension`，其中 `<home>` 来自环境变量 `NEUG_EXTENSION_HOME_PYENV`。

当你使用仓库内（in-repo）的 Python 绑定时，该过程是自动完成的：导入 `neug` 时会自动在构建目录树中发现 `neug_py_bind`，并为你将 `NEUG_EXTENSION_HOME_PYENV` 设置为 `<repo>/build`，因此 `LOAD pattern_matching;` 可直接加载最新构建的库，无需额外配置：

```python
import neug
from neug.database import Database

db = Database("/tmp/demo_db", "w")
conn = db.connect()
conn.execute("LOAD pattern_matching;")  # 加载 build/extension/pattern_matching/...
```

如果你的构建目录位于其他位置，请在导入 `neug` 之前，先将加载器指向该路径：

```bash

# 包含 tools/python_bind/neug_py_bind* 和 extension/ 的目录
export NEUG_BUILD_DIR=/path/to/neug/build

# 或直接设置扩展主目录（即包含 extension/ 的目录）：
export NEUG_EXTENSION_HOME_PYENV=/path/to/neug/build
```

## 实验

我们在 **LDBC SNB 规模因子 1（SF1）** 数据集上，对 **相同** 的子图匹配模式进行了三种执行方式的基准测试：

- **NeuG-Native** — NeuG 内置的 Cypher 引擎（`MATCH ... RETURN ...`）；
- **Exact-Match** — `CALL PATTERN_MATCH(pattern)`（精确枚举所有嵌入结果）；
- **Sample-Match** — `CALL PATTERN_MATCH(pattern, 1000000, true)`（采样匹配，样本量为 **1,000,000**）。

六个测试模式（Q1–Q6）源自 LDBC 的 [LSQB](https://github.com/ldbc/lsqb/tree/main/cypher) 查询集。每个查询均设置 **10 分钟超时限制**；若运行超时，则标记为 **OOT**（Out of Time，超时）。

![基准测试延迟（对数尺度）](/images/benchmark_latency_log.png)

该图以对数尺度展示端到端延迟（单位：秒）。关键观察如下：

- **NeuG-Native** 能够处理较小的模式（Q1、Q2），但在较大的模式（Q3–Q6）上 **超时（OOT）**；这些较大模式的完整结果集规模极为庞大（嵌入数量达千万至数十亿量级）。
- **Exact-Match** 在所有查询中均能在超时限制内完成，且在处理大规模模式时，其速度比原生引擎快 **1 至数个数量级**。
- **Sample-Match** 在全部六个模式上均保持较低且稳定的延迟，是处理规模更大、基数更高模式（Q2–Q6）时的 **最快选项**。

## 参考文献

本扩展中的匹配算法借鉴了首尔国立大学计算机科学与工程系理论与算法研究组（SNU CSE Theory & Algorithms group）以下研究成果的方法与思想，我们对此深表感谢：

- **FaSTest** —《子图匹配的基数估计：一种过滤-采样方法》（VLDB 2024）。**采样式**匹配模式基于 FaSTest 实现。<https://github.com/SNUCSE-CTA/FaSTest>
- **DAF** —《高效的子图匹配：动态规划、自适应匹配顺序与失败集的协同优化》（SIGMOD 2019）。**精确式**匹配的设计参考了 DAF 的方法。<https://github.com/SNUCSE-CTA/DAF>
