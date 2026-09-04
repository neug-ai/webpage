# NeuG Web UI

NeuG Web UI 提供基于浏览器的界面来与 NeuG 数据库交互。它提供了一种直观的方式来执行 Cypher 查询、可视化结果，并通过现代 Web 界面探索您的图数据。

## 基本用法

### 启动 Web UI

启动 neug-cli 后启动 Web UI 的最简单方式：

```bash
neug > :ui
```

这将在 `http://127.0.0.1:5000` 启动打开数据库的 Web 服务器。

### 自定义主机和端口

要在不同的主机或端口上运行：

```bash
neug > :ui 127.0.0.1:8080
```

## 示例

### 示例 1：使用本地数据库启动
```bash
# 使用特定数据库启动 UI
neug-cli open ./my_graph_db
neug > :ui
```

### 示例 2：公开访问
```bash
# 允许从任何 IP 地址访问
neug-cli open ./my_graph_db
neug > :ui 0.0.0.0:8080
```

## Web 界面功能

Web UI 运行后，在浏览器中打开指定 URL（默认：`http://127.0.0.1:5000`）。

### 查询界面

Web 界面提供：

- **查询编辑器**：编写和执行 Cypher 查询
- **结果显示**：以表格格式查看结果
- **Schema 浏览器**：探索您的数据库 schema
- **查询历史**：访问先前执行的查询

### API 端点

Web UI 还公开 REST API 端点：

#### Schema 端点
```http
GET /schema
```
以 JSON 格式返回数据库 schema。

#### 查询执行端点
```http
POST /cypher
Content-Type: text/plain

{
    "query": "MATCH (n) RETURN n LIMIT 10",
    "format": "json"
}
```
执行 Cypher 查询并以 JSON 格式返回结果。

## 故障排除

### 端口已被占用
如果端口 5000 已被占用，指定不同的端口：
```bash
neug > :ui localhost:8080
```

### 数据库连接问题
确保数据库目录存在且可访问：
```bash
# 检查目录是否存在
ls -la /path/to/your/database

# 使用正确权限启动
neug-cli open /path/to/your/database
neug > :ui
```

### 缺少依赖
如果看到导入错误，安装所需依赖：
```bash
pip install flask flask-cors
```

## 安全注意事项

- Web UI 默认在 localhost 上运行以确保安全
- 使用 `0.0.0.0` 时，确保设置适当的防火墙规则
- 在生产环境中，考虑使用反向代理（nginx、Apache）
- 生产环境绝不应使用调试模式

Web 界面默认从 CDN 加载资源。对于离线开发，您可能需要本地下载静态资源。