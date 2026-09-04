# CodeGraph：使用知识图谱进行代码分析

## 简介

CodeGraph 是基于 **NeuG**（图数据库）和 **zvec**（向量数据库）构建的代码分析 Skill。它将源代码索引为包含节点（File、Function、Class、Module、Commit）和边（CALLS、IMPORTS、INHERITS、MODIFIES 等）的知识图谱，以及每个函数的语义嵌入。

这种组合能够实现 grep、LSP 或纯向量搜索单独无法完成的分析。

### 核心能力


| 能力              | 描述                                             |
| ----------------------- | ------------------------------------------------------- |
| 调用链分析     | 查找调用者、被调用者、N 跳影响分析            |
| 架构分析   | 自动发现层次、桥接函数、模块耦合 |
| 死代码检测     | 识别零调用者的函数                    |
| 语义搜索         | 通过自然语言描述查找函数          |
| 热点分析        | 识别高风险函数（扇入 × 扇出）        |
| 演进分析      | 跟踪提交历史、函数修改记录     |
| Bug 根因分析 | 将 GitHub issue 映射到代码位置                     |

## 示例：分析 OpenClaw 代码库

本节以 OpenClaw 代码库为例演示 CodeGraph 用法。

### 前提条件

CodeGraph 需要 Python 3.10+ 和 PyTorch 2.4+。

```bash
# 创建虚拟环境
cd /path/to/your/project
python3 -m venv .venv

# 激活并安装 codegraph-ai
source .venv/bin/activate
pip install codegraph-ai
```

### 环境设置

```bash
# 指向数据库目录
export CODESCOPE_DB_DIR="/path/to/your/project/.codegraph"

# 如果您有 HuggingFace 离线模式，可以使用离线模式
export HF_HUB_OFFLINE="1"
```

### 索引代码库

```bash
# 创建索引（首次）
codegraph init --repo /path/to/your/project --lang auto --commits 100

# 检查索引状态
codegraph status --db $CODESCOPE_DB_DIR
```

**OpenClaw 实际输出：**

```
============================================================
CodeScope Index Status: /path/to/openclaw/.codegraph
============================================================

Graph:
  File        :     12,857
  Function    :     24,173
  Class       :        255
  Module      :        380
  Commit      :        100

Edges:
  CALLS       :     41,269
  TOUCHES     :        605
  MODIFIES    :          0

Vectors: 24,173 function embeddings
============================================================
```

---

## CLI 使用示例

### 1. 检查状态

```bash
codegraph status --db $CODESCOPE_DB_DIR 2>/dev/null
```

### 2. 自然语言查询

```bash
codegraph query "谁调用了 runHeartbeatOnce?" --db $CODESCOPE_DB_DIR 2>/dev/null
```

**实际输出：**

```
Question type: structural
Retrieved 6 evidence items in 74ms:

[1] (caller) startGatewayServer (src/gateway/server.impl.ts) — hop=2
[2] (caller) createGatewayReloadHandlers (src/gateway/server-reload-handlers.ts) — hop=2
[3] (caller) executeJob (src/cron/service/timer.ts) — hop=2
[4] (caller) executeJobCore (src/cron/service/timer.ts) — hop=1
[5] (caller) buildGatewayCronService (src/gateway/server-cron.ts) — hop=1
[6] (caller) executeJobCoreWithTimeout (src/cron/service/timer.ts) — hop=2
```

### 3. 生成架构报告

```bash
codegraph analyze --db $CODESCOPE_DB_DIR --output architecture-report.md 2>/dev/null
```

**报告包括：**

- 代码库概览（文件、函数、调用边、类、模块）
- 子系统分布
- 架构层次（含 Mermaid 图）
- 桥接函数
- 热点
- 模块耦合
- 死代码密度

---

## Python API 示例

对于复杂查询，使用 Python API：

### 设置

```python
import os
os.environ['HF_HUB_OFFLINE'] = '1'

from codegraph.core import CodeScope
cs = CodeScope(os.environ['CODESCOPE_DB_DIR'])
```

### 查找函数的调用者

```python
rows = list(cs.conn.execute('''
    MATCH (caller:Function)-[:CALLS]->(f:Function {name: "runHeartbeatOnce"})
    RETURN caller.name, caller.file_path
'''))
for r in rows:
    print(f"{r[0]} @ {r[1]}")
```

**实际输出：**

```
executeJobCore @ src/cron/service/timer.ts
buildGatewayCronService @ src/gateway/server-cron.ts
```

### 查找函数调用的函数

```python
rows = list(cs.conn.execute('''
    MATCH (f:Function {name: "runHeartbeatOnce"})-[:CALLS]->(callee:Function)
    RETURN callee.name
    LIMIT 20
'''))
for r in rows:
    print(f"-> {r[0]}")
```

**实际输出：**

```
-> parseAgentSessionKey
-> resolveDefaultAgentId
-> resolveHeartbeatConfig
-> areHeartbeatsEnabled
-> isHeartbeatEnabledForAgent
-> resolveHeartbeatIntervalMs
-> nowMs
-> now
-> isWithinActiveHours
-> resolveHeartbeatPreflight
-> emitHeartbeatEvent
-> resolveCronSession
-> saveSessionStore
-> resolveHeartbeatDeliveryTarget
-> resolveHeartbeatVisibility
-> resolveHeartbeatSenderContext
-> resolveEffectiveMessagesConfig
-> resolveAgentWorkspaceDir
-> resolveHeartbeatRunPrompt
-> appendCronStyleCurrentTimeLine
```

### 影响分析（N 跳调用者）

```python
rows = list(cs.conn.execute('''
    MATCH (caller:Function)-[:CALLS*1..2]->(f:Function {name: "runHeartbeatOnce"})
    RETURN DISTINCT caller.name, caller.file_path
    LIMIT 20
'''))
for r in rows:
    print(f"{r[0]} @ {r[1]}")
```

**实际输出：**

```
executeJobCore @ src/cron/service/timer.ts
buildGatewayCronService @ src/gateway/server-cron.ts
executeJobCoreWithTimeout @ src/cron/service/timer.ts
executeJob @ src/cron/service/timer.ts
createGatewayReloadHandlers @ src/gateway/server-reload-handlers.ts
startGatewayServer @ src/gateway/server.impl.ts
```

---

## 内置分析方法

### 热点

按扇入 × 扇出排序的高风险函数：

```python
for h in cs.hotspots(topk=10):
    print(f"{h.name} @ {h.file_path}")
    print(f"  fan_in={h.fan_in}, fan_out={h.fan_out}")
```

**实际输出：**

```
push @ ui/src/ui/chat/input-history.ts
  fan_in=1747, fan_out=0
createConfigIO @ src/config/io.ts
  fan_in=18, fan_out=57
fn @ extensions/diffs/assets/viewer-runtime.js
  fan_in=533, fan_out=1
runEmbeddedPiAgent @ src/agents/pi-embedded-runner/run.ts
  fan_in=14, fan_out=65
startGatewayServer @ src/gateway/server.impl.ts
  fan_in=10, fan_out=88
now @ src/auto-reply/reply/export-html/template.security.test.ts
  fan_in=857, fan_out=0
loadOpenClawPlugins @ src/plugins/loader.ts
  fan_in=21, fan_out=36
runCronIsolatedAgentTurn @ src/cron/isolated-agent/run.ts
  fan_in=11, fan_out=56
loadSessionStore @ src/config/sessions/store.ts
  fan_in=60, fan_out=8
getReplyFromConfig @ src/auto-reply/reply/get-reply.ts
  fan_in=20, fan_out=24
```

### 桥接函数

被多个不同模块调用的函数（跨子系统连接器）：

```python
for b in cs.bridge_functions(topk=10):
    print(f"{b.name} @ {b.file_path}")
    print(f"  modules={b.module_count}")
```

**实际输出：**

```
push @ ui/src/ui/chat/input-history.ts
  modules=167
now @ src/auto-reply/reply/export-html/template.security.test.ts
  modules=135
fn @ extensions/diffs/assets/viewer-runtime.js
  modules=103
error @ src/plugins/config-schema.ts
  modules=102
toString @ extensions/discord/src/send.types.ts
  modules=95
next @ src/wizard/session.ts
  modules=36
shouldLogVerbose @ src/globals.ts
  modules=33
release @ src/browser/cdp-proxy-bypass.ts
  modules=32
formatCliCommand @ src/cli/command-format.ts
  modules=31
isDirectory @ src/infra/path-env.ts
  modules=28
```

### 死代码检测

零调用者的函数：

```python
for d in cs.dead_code()[:10]:
    print(f"{d.name} @ {d.file_path}")
```

**实际输出：**

```
promptUrlWidgetExtension @ .pi/extensions/prompt-url-widget.ts
showPagedSelectList @ .pi/extensions/ui/paged-select.ts
copyToClipboard @ .venv/lib/python3.10/site-packages/sklearn/utils/_repr_html/estimator.js
CodeSection @ .venv/lib/python3.10/site-packages/torch/utils/model_dump/code.js
ExtraJsonSection @ .venv/lib/python3.10/site-packages/torch/utils/model_dump/code.js
...
```

> **注意**：死代码检测可能包含外部依赖。按 `is_external = 0` 过滤以获取项目特定结果。

### 语义搜索

通过自然语言描述查找函数：

```python
results = cs.vector_only_search('heartbeat periodic wake agent schedule', topk=5)
for r in results:
    print(f"id={r['id'][:20]}... score={r['score']:.3f}")
```

**实际输出：**

```
id=59744ec14e23575012c1... score=0.514
id=0b27570192377b7077cd... score=0.481
id=11fad68a6ba0d7fa0228... score=0.478
id=b33f6f3241c0a61d7118... score=0.477
id=8221fa3eb46b7e06e561... score=0.473
```

---

## Cypher 查询模板

以下模板作为分析代码库的参考查询。将 `FUNC_NAME`、`PATH`、`MODULE` 替换为您的具体值：

| 分析              | Cypher 查询                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| 查找调用者          | `MATCH (c:Function)-[:CALLS]->(f:Function {name: "FUNC_NAME"}) RETURN c.name, c.file_path`                    |
| 查找被调用者          | `MATCH (f:Function {name: "FUNC_NAME"})-[:CALLS]->(c:Function) RETURN c.name`                                 |
| 影响（N 跳）       | `MATCH (c:Function)-[:CALLS*1..N]->(f:Function {name: "FUNC_NAME"}) RETURN DISTINCT c.name`                   |
| 文件中的函数     | `MATCH (file:File)-[:DEFINES_FUNC]->(f:Function) WHERE file.path CONTAINS "PATH" RETURN f.name`               |
| 模块中的文件       | `MATCH (f:File)-[:BELONGS_TO]->(m:Module) WHERE m.name = "MODULE" RETURN f.path`                              |
| 类层次结构       | `MATCH (c:Class)-[:INHERITS]->(p:Class) RETURN c.name, p.name`                                                |
| 最常被调用的函数 | `MATCH (f:Function)<-[:CALLS]-(c:Function) RETURN f.name, count(c) as callers ORDER BY callers DESC LIMIT 10` |