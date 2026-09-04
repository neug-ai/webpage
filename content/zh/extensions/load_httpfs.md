# HTTPFS 扩展

HTTPFS 扩展使 NeuG 能够访问存储在兼容 S3 的对象存储服务（如 AWS S3、阿里云 OSS、MinIO 等）以及通过 HTTP/HTTPS URL 存储的文件。加载 HTTPFS 扩展后，NeuG 可以在 `LOAD FROM`（读取）和 `COPY TO`（写入）查询中透明地解析 `s3://`、`oss://` 和 `http://`/`https://` 路径。

## 安装扩展

```cypher
INSTALL HTTPFS;
```

## 加载扩展

```cypher
LOAD HTTPFS;
```

## 支持的 URI 方案

| 方案                   | 协议                                | 示例                                   |
| ---------------------- | ----------------------------------- | -------------------------------------- |
| `s3://`                | AWS S3 或任何兼容 S3 的服务         | `s3://my-bucket/path/to/file.parquet`  |
| `oss://`               | 阿里云 OSS                          | `oss://my-bucket/path/to/file.parquet` |
| `http://` / `https://` | HTTP/HTTPS 直接 URL                 | `http://example.com/data/file.parquet` |

## 配置选项

内联选项在 `LOAD FROM` 查询中文件路径后的括号内传递。所有选项名称不区分大小写。

### 凭据选项

| 选项                                            | 类型   | 默认值    | 描述                                                                                                   |
| ----------------------------------------------- | ------ | --------- | ------------------------------------------------------------------------------------------------------ |
| `CREDENTIALS_KIND`                              | string | `Default` | 凭据模式：`Default`、`Anonymous` 或 `Explicit`。参见下面的 [凭据模式](#credential-modes)。             |
| `OSS_ACCESS_KEY_ID` / `AWS_ACCESS_KEY_ID`       | string | —         | 访问密钥 ID。当 `CREDENTIALS_KIND='Explicit'` 时必需。                                                 |
| `OSS_ACCESS_KEY_SECRET` / `AWS_SECRET_ACCESS_KEY` | string | —         | 密钥访问密钥。当 `CREDENTIALS_KIND='Explicit'` 时必需。                                                |

### TLS 和寻址选项

| 选项             | 类型   | 默认值 | 描述                                                                                                                                              |
| ---------------- | ------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VERIFY_SSL`     | bool   | `true` | 验证服务器的 TLS 证书。仅在受信任的测试环境中（例如使用自签名证书的 MinIO）才可设为 `false`。                                                       |
| `CA_CERT_FILE`   | string | auto   | 用于 TLS 验证的 CA 证书包路径。若未设置，则自动探测系统默认位置（同时也支持 `SSL_CERT_FILE` 环境变量）。                                           |
| `PATH_STYLE`     | bool   | `false` | 使用路径式寻址（`endpoint/bucket/key`），而非虚拟主机式寻址（`bucket.endpoint/key`）。当 endpoint 为 IP 地址或 `localhost` 时（MinIO 的典型场景），该选项将自动启用。 |

### 端点和区域选项

| 选项                                                      | 类型   | 默认值        | 描述                                                                                                                                 |
| --------------------------------------------------------- | ------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `OSS_ENDPOINT` / `AWS_ENDPOINT_URL` / `ENDPOINT_OVERRIDE` | string | —            | 用于 S3 兼容服务（OSS、MinIO 等）的自定义端点 URL。                                                                                  |
| `OSS_REGION` / `AWS_DEFAULT_REGION`                       | string | 自动检测      | AWS/OSS 区域（例如，`us-east-1`、`oss-cn-beijing`）。对于 OSS 端点，区域也可以从端点 URL 中自动提取。                                |

### 超时选项

| 选项              | 类型   | 默认值 | 描述                 |
| ----------------- | ------ | ------ | -------------------- |
| `CONNECT_TIMEOUT` | double | `5.0`  | 连接超时时间（秒）。 |
| `REQUEST_TIMEOUT` | double | `30.0` | 请求超时时间（秒）。 |

## 凭据模式

S3/OSS 请求使用 AWS Signature Version 4 进行签名。凭据仅从查询选项和环境变量中解析——**不支持 STS 令牌、`~/.aws/credentials` 文件以及 IAM/ECS 实例角色**。

### `Default`（默认）

凭据按以下顺序查找：

1. 查询选项：`OSS_ACCESS_KEY_ID` / `AWS_ACCESS_KEY_ID` 和
   `OSS_ACCESS_KEY_SECRET` / `AWS_SECRET_ACCESS_KEY`
2. 同名的环境变量

如果以上两种来源均未提供凭据，则查询将**以错误形式失败**，而不会静默回退至匿名访问（否则私有存储桶会返回难以诊断的 403 错误）。对于公开存储桶，请显式使用 `CREDENTIALS_KIND='Anonymous'`。

### `匿名`

不发送任何凭据（请求未签名）。此模式适用于公开可访问的存储桶。

### `Explicit`（显式）

访问密钥（access key）和密钥（secret key）直接在查询选项中指定；若缺失，则查询失败。

## 查询示例

### 从 AWS S3 加载（默认凭证）

使用环境中配置的凭证提供程序链：

```cypher
LOAD FROM "s3://my-bucket/data/person.parquet"
RETURN *;
```

### 从阿里云 OSS 加载（匿名，公共存储桶）

```cypher
LOAD FROM "oss://my-bucket/data/person.parquet" (
    CREDENTIALS_KIND='Anonymous',
    ENDPOINT_OVERRIDE='oss-cn-beijing.aliyuncs.com'
)
RETURN *;
```

### 使用显式凭证从 OSS 加载

```cypher
LOAD FROM "oss://my-bucket/data/person.parquet" (
    CREDENTIALS_KIND='Explicit',
    ENDPOINT_OVERRIDE='oss-cn-beijing.aliyuncs.com',
    OSS_ACCESS_KEY_ID='your-access-key-id',
    OSS_ACCESS_KEY_SECRET='your-access-key-secret'
)
RETURN *;
```

### 从 HTTP URL 加载数据

```cypher
LOAD FROM "http://example.com/data/person.parquet"
RETURN *;
```

HTTP/HTTPS 数据源为**只读**，且必须同时支持 `HEAD` 请求（用于确定文件大小）和 `Range` 请求（用于分段读取）。若服务器忽略 `Range` 请求并返回 `200` 状态码，则系统将报错拒绝该服务器，而不会静默地错误读取数据。

其他 HTTP 选项：

| 选项             | 类型    | 默认值  | 描述                                               |
| ---------------- | ------- | ------- | -------------------------------------------------- |
| `BEARER_TOKEN`   | 字符串  | —       | 作为 `Authorization: Bearer <token>` 请求头发送。 |
| `HTTP_HEADERS`   | 字符串  | —       | 额外的请求头。                                     |
| `VERIFY_SSL`     | 布尔值  | `true`  | 验证服务器的 TLS 证书。                            |
| `CA_CERT_FILE`   | 字符串  | 自动检测 | 用于 TLS 验证的 CA 证书包。                        |
| `CONNECT_TIMEOUT`| 浮点数  | `30.0`  | 连接超时时间（单位：秒）。                         |
| `REQUEST_TIMEOUT`| 浮点数  | `300.0` | 请求超时时间（单位：秒）。                         |

## 导出（COPY TO）

HTTPFS 扩展还支持使用 `COPY TO` 将查询结果写入 S3/OSS。这需要具备写入权限的凭据（匿名模式无法执行写入操作）。对于大于两倍分段上传大小（默认为 16 MiB）的对象，将采用分段上传方式；较小的对象则使用单次 `PutObject` 操作。

### 导出到 S3

```cypher
COPY (MATCH (n:Person) RETURN n.name, n.age)
TO "s3://my-bucket/output/person.csv" (
    CREDENTIALS_KIND='Default',
    OSS_ENDPOINT='oss-cn-beijing.aliyuncs.com'
);
```

### 使用显式凭证导出到 OSS

```cypher
COPY (MATCH (n:Person) RETURN n.name, n.age)
TO "oss://my-bucket/output/person.csv" (
    CREDENTIALS_KIND='Explicit',
    ENDPOINT_OVERRIDE='oss-cn-beijing.aliyuncs.com',
    OSS_ACCESS_KEY_ID='your-access-key-id',
    OSS_ACCESS_KEY_SECRET='your-access-key-secret'
);
```

> **注意：** HTTP/HTTPS 端点是只读的，不支持 `COPY TO`。

### 通配符模式

加载匹配模式的多个文件。支持的通配符：`*`（匹配任意字符序列）、`?`（匹配单个字符）、`[abc]`（匹配集合中的任意字符）。不支持 `**` 和 `{a,b}` 这类模式。

```cypher
LOAD FROM "s3://my-bucket/data/*.parquet"
RETURN *;
```

## 与其他扩展结合使用

HTTPFS 扩展仅提供虚拟文件系统（VFS）层。要从 S3/OSS/HTTP 加载 Parquet 文件，必须同时加载两个扩展：

```cypher
LOAD HTTPFS;
LOAD PARQUET;

LOAD FROM "oss://my-bucket/data/person.parquet" (
    CREDENTIALS_KIND='Anonymous',
    ENDPOINT_OVERRIDE='oss-cn-beijing.aliyuncs.com'
)
RETURN *;
```

> **注意：** `LOAD FROM` 支持的所有关系操作 — 包括类型转换、WHERE 过滤、聚合、排序和限制 — 在远程文件上同样有效。完整的操作列表请参见 [LOAD FROM 参考文档](../data_io/load_data)。
