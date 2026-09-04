# AI 辅助开发

NeuG 提供 AI 辅助技能来简化您的开发工作流程。这些技能与您的编码代理（Cursor、Qoder、Qwen Code 等）集成为代理技能。您可以使用斜杠命令调用它们。

## 快速开始

**1. 为您的编码代理初始化技能：**

```bash
./scripts/init_skills.sh <agent>   # 例如：qoder, qwen
```

> **注意：** Cursor 是默认代理，不需要初始化。

有关完整列表，请参阅 [支持的代理](#supported-agents)。

**2. 在聊天框中使用 `/` 前缀调用技能：**

```
/create-issue 我在运行此查询时遇到了段错误...
```

## 常用技能

### `/create-issue` - 报告 Bug 或请求功能

直接从您的 IDE 创建 GitHub issue，包含完整上下文。

**示例：报告 Bug**
```
/create-issue
Type: Bug
Assignee: @who
Parent Issue: #42

查询失败并出现段错误。终端输出：

E20260112 10:23:45.123456 12345 executor.cc:271] Query execution failed
Segmentation fault (core dumped)
```

**示例：请求功能**
```
/create-issue
Type: Feature
Assignee: @me

我需要支持带有多个模式的 OPTIONAL MATCH。
目前只支持单个模式。
```

**提示：**
- 直接复制粘贴终端错误输出 - 代理会提取关键信息
- 指定 `Type: Bug` 或 `Type: Feature` 以跳过自动检测
- 使用 `Assignee: @me` 或 `Assignee: @username` 预先分配
- 使用 `Parent Issue: #id` 链接为子 issue

### `/create-pr` - 提交 Pull Request

创建带有自动生成摘要的 PR，并链接到相关 issue。

**示例**
```
/create-pr
Fixes: #42
Reviewers: @who

这修复了查询执行中的段错误问题。
在访问结果缓冲区之前添加了空指针检查。
```

**提示：**
- 使用 `Fixes: #id` 在 PR 合并时自动关闭 issue
- 使用 `Reviewers: @user1, @user2` 请求特定审阅者
- 代理会从您的更改自动生成 PR 标题和摘要

### `/update-with-comments` - 处理 PR 反馈

自动获取并应用 PR 审阅评论。

**示例**
```
/update-with-comments
```

或指定 PR：
```
/update-with-comments #123
```

代理将：
1. 从 PR 获取所有审阅评论
2. 将请求的更改应用到您的代码
3. 显示修改摘要
4. 在您审阅后提交并推送

## 规范驱动工作流

对于较大的功能，我们提供结构化工作流，在实现之前进行规划。

### 步骤 1：`/speckit.specify` - 定义功能

从自然语言创建功能规范。

**示例**
```
/speckit.specify
为 NeuG 添加图算法扩展支持。
用户应该能够注册自定义算法并通过 Cypher 执行它们。
```

代理将：
1. 创建功能分支（如 `001-graph-algo-extension`)
2. 在 `specs/001-graph-algo-extension/spec.md` 生成规范文档
3. 创建 GitHub issue 跟踪功能
4. 如有需要询问澄清问题（最多 3 个）

### 步骤 2：`/speckit.plan` - 规划实现

从规范生成技术计划。

**示例**
```
/speckit.plan 001-graph-algo-extension
```

代理将：
1. 分析规范和代码库结构
2. 规划项目结构、数据模型和算法
3. 生成包含实现细节的 `plan.md`
4. 创建关联的 GitHub issue

### 步骤 3：`/speckit.tasks` - 分解为任务

从计划生成可执行任务。

**示例**
```
/speckit.tasks 001-graph-algo-extension
```

代理将：
1. 创建模块级别的分解
2. 为每个模块生成任务文件
3. 每个任务的大小适合独立测试

### 同步到 GitHub

创建规范/计划/任务后，将它们同步到 GitHub：

```
/sync-modules 001-graph-algo-extension    # 同步模块 issue
/sync-tasks 001-graph-algo-extension      # 同步任务 issue
```

## 设置

### 前提条件

代理技能由 markdown 文件实现，可由编码代理自动调用或用户显式调用。

为避免意外调用，我们默认为所有技能设置 `disable-model-invocation: true`。您只能通过斜杠命令调用它们。您也可以自定义技能文件以启用模型调用。

### 安装技能

我们以 Cursor 格式在 `.cursor/skills/` 提供代理技能。要为您的代理转换：

```bash
./scripts/init_skills.sh <agent-shortcut>
```

### 支持的代理

| 快捷方式   | 代理               | 文档      |
|------------|---------------------|----------------|
| cursor     | Cursor（默认）    | [Cursor Skills](https://cursor.com/docs/context/skills)               |
| claude     | Claude Code         | [Claude Code Skills](https://code.claude.com/docs/en/skills)          |
| codebuddy  | CodeBuddy           | [CodeBuddy Skills](https://www.codebuddy.ai/docs/ide/Features/Skills) |
| codex      | Codex               | [Codex Skills](https://developers.openai.com/codex/skills/)           |
| gemini     | Gemini CLI          | [Gemini CLI Skills](https://geminicli.com/docs/cli/skills/)           |
| kilocode   | Kilocode            | [Kilocode Skills](https://kilo.ai/docs/customize/skills)              |
| opencode   | OpenCode            | [OpenCode Skills](https://opencode.ai/docs/skills/)                   |
| qoder      | Qoder               | [Qoder Skills](https://docs.qoder.com/extensions/skills)              |
| qwen       | Qwen Code           | [Qwen Code Skills](https://qwenlm.github.io/qwen-code-docs/en/users/features/skills/)    |
| roo        | RooCode             | [RooCode Skills](https://docs.roocode.com/features/skills)            |
| windsurf   | Windsurf            | [Windsurf Skills](https://docs.windsurf.com/windsurf/cascade/skills)  |

注意：不同代理在代理技能标准上可能有细微差异。您可以参考文档了解更多详情。

**示例：**
```bash
./scripts/init_skills.sh qoder
```

或手动指定输出路径：
```bash
./scripts/init_skills.sh --output=.qwen/skills
```

## 技能参考

| 技能 | 目的 |
|---------|---------|
| `/create-issue` | 创建 bug 报告或功能请求 |
| `/create-pr` | 提交带有自动摘要的 pull request |
| `/update-with-comments` | 应用 PR 审阅反馈 |
| `/speckit.specify` | 定义功能规范 |
| `/speckit.plan` | 创建实现计划 |
| `/speckit.tasks` | 将计划分解为任务 |
| `/sync-modules` | 将模块 issue 同步到 GitHub |
| `/sync-tasks` | 将任务 issue 同步到 GitHub |
| `/generate_testcase` | 生成测试用例 |