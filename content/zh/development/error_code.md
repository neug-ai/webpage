# NeuG 错误码

NeuG 在 protobuf 文件 [`error.proto`](https://github.com/alibaba/neug/blob/main/proto/error.proto) 中定义了所有运行时/服务错误码。该文件中的枚举会被编译到每个组件中，因此开发人员应将那里的定义视为单一真实来源。下表总结了每个错误码及其含义，以便在调试或显示错误时快速参考。

| 类别 | 错误码 | 数值 | 含义 |
| --- | --- | --- | --- |
| 通用 | `OK` | 0 | 操作成功；无错误。 |
| 通用 | `ERR_PERMISSION` | 1001 | 由于缺少权限而阻止操作。 |
| 通用 | `ERR_VERSION_MISMATCHED` | 1002 | 二进制文件/数据库版本与数据目录不兼容。 |
| 通用 | `ERR_DIRECTORY_NOT_EXIST` | 1003 | 目标目录路径不存在。 |
| 通用 | `ERR_DATABASE_LOCKED` | 1004 | 数据目录被另一个进程锁定。 |
| 通用 | `ERR_DISK_SPACE_EXHAUSTED` | 1005 | 磁盘空间不足，无法继续。 |
| 通用 | `ERR_CORRUPTION_DETECTED` | 1006 | 文件似乎已损坏或格式不符合预期。 |
| 通用 | `ERR_INVALID_PATH` | 1007 | 提供的文件系统路径无效。 |
| 通用 | `ERR_CONFIG_INVALID` | 1008 | 配置文件或值格式错误。 |
| 通用 | `ERR_INVALID_ARGUMENT` | 1009 | API/输入参数缺失或格式错误。 |
| 通用 | `ERR_NOT_FOUND` | 1010 | 找不到请求的资源（顶点、文件等）。 |
| 通用 | `ERR_NOT_SUPPORTED` | 1011 | 当前上下文中未实现功能或操作。 |
| 通用 | `ERR_INTERNAL_ERROR` | 1012 | 意外的内部失败；检查日志以获取堆栈跟踪。 |
| 通用 | `ERR_ILLEGAL_OPERATION` | 1013 | 当前状态/配置下不允许此操作。 |
| 通用 | `ERR_IO_ERROR` | 1014 | 底层文件系统或设备 I/O 失败。 |
| 通用 | `ERR_BAD_ENCODING` | 1015 | 遇到不支持的编码/解码。 |
| 通用 | `ERR_INVALID_FILE` | 1016 | 引用的文件不存在或不可读。 |
| 通用 | `ERR_EXTENSION` | 1017 | 加载或执行扩展时失败。 |
| 网络/会话 | `ERR_NETWORK` | 2001 | 通用网络传输错误。 |
| 网络/会话 | `ERR_SESSION_CLOSED` | 2002 | 会话句柄已关闭，不再可用。 |
| 网络/会话 | `ERR_CONNECTION_CLOSED` | 2003 | 连接断开（服务器关闭或数据库关闭）。 |
| 网络/会话 | `ERR_POOL_EXHAUSTED` | 2004 | 连接/会话池耗尽可用条目。 |
| 网络/会话 | `ERR_SERVICE_UNAVAILABLE` | 2005 | 服务离线或尚未就绪。 |
| 网络/会话 | `ERR_LOAD_OVERFLOW` | 2006 | 服务过载；客户端应重试/退避。 |
| 网络/会话 | `ERR_CONNECTION_ERROR` | 2007 | 建立或维护连接失败。 |
| 查询编译和执行 | `ERR_COMPILATION` | 3000 | 查询编译阶段失败。 |
| 查询编译和执行 | `ERR_QUERY_EXECUTION` | 3001 | 执行查询计划时的通用运行时失败。 |
| 查询编译和执行 | `ERR_QUERY_SYNTAX` | 3002 | 查询语法或语义无效。 |
| 查询编译和执行 | `ERR_QUERY_TIMEOUT` | 3003 | 查询超出配置的执行时间限制。 |
| 查询编译和执行 | `ERR_CONCURRENT_WRITE` | 3004 | 检测到冲突的并发写入。 |
| 查询编译和执行 | `ERR_CODEGEN_ERROR` | 3005 | 查询代码生成期间失败。 |
| 查询编译和执行 | `ERR_EMPTY_RESULT` | 3006 | 计划器推断出空结果集。 |
| 查询编译和执行 | `ERR_NOT_INITIALIZED` | 3007 | 查询执行前数据库/会话未初始化。 |
| 事务和 WAL | `ERR_TX_STATE_CONFLICT` | 4001 | 事务状态冲突（例如，无效转换）。 |
| 事务和 WAL | `ERR_WAL_WRITE_FAIL` | 4002 | 附加到预写日志失败。 |
| 事务和 WAL | `ERR_TX_TIMEOUT` | 4003 | 事务超出超时限制。 |
| 模式和类型 | `ERR_SCHEMA_MISMATCH` | 5001 | 操作与存储数据之间的模式不匹配。 |
| 模式和类型 | `ERR_INVALID_SCHEMA` | 5002 | 模式定义无效。 |
| 模式和类型 | `ERR_TYPE_CONVERSION` | 5003 | 请求了非法类型转换。 |
| 模式和类型 | `ERR_TYPE_OVERFLOW` | 5004 | 值无法适应目标数据类型。 |
| 模式和类型 | `ERR_INDEX_ERROR` | 5005 | 索引/偏移量超出边界。 |
| 部署/平台 | `ERR_PLATFORM_ABI` | 6001 | 二进制文件与主机平台之间的 ABI 不匹配。 |
| 部署/平台 | `ERR_PY_BIND_INIT` | 6002 | Python 绑定初始化失败。 |
| 部署/平台 | `ERR_ARCH_MISMATCH` | 6003 | 二进制架构与运行时环境不匹配。 |
| 部署/平台 | `ERR_DEPLOY_DEPENDENCY` | 6004 | 部署期间缺少运行时依赖项。 |
| 功能差距 | `ERR_NOT_IMPLEMENTED` | 7001 | 功能占位符；尚未实现。 |
| 通用 | `ERR_UNKNOWN` | 9999 | 未分类错误；检查日志以获取上下文。 |

**提示：** 添加新错误码时，请先更新 `proto/error.proto`，如有必要请重新生成 protobuf 输出，并扩展本文档，以便其他开发人员能够快速发现新代码。