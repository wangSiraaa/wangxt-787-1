# 模具试模问题闭环全栈应用

## 系统入口
- 后端 API: http://localhost:3001
- 前端页面: http://localhost:5173

## 测试账号

| 用户ID | 用户名 | 角色 | 说明 |
|--------|--------|------|------|
| user_quality | 张质量 | quality | 质量工程师，登记问题 |
| user_mold | 李模具 | mold | 模具工程师，负责整改 |
| user_inspector | 王检验 | inspector | 检验员，负责复测 |
| user_engineer | 赵工艺 | engineer | 工艺工程师 |

## 复验方式（严重问题必须复测通过才能关闭）

1. **问题登记**: 质量工程师登记问题，选择缺陷等级（严重/一般/轻微）
2. **整改派发**: 指定模具工程师负责整改
3. **开始整改**: 模具工程师开始整改
4. **提交整改**: 提交整改措施和结果
5. **复测验证**:
   - 检验员进行复测
   - 选择复测结果：通过 / 不通过
   - 不通过则退回整改阶段
6. **关闭审批**:
   - 对于 **严重问题**（defect_level=1），必须至少有一次复测通过记录才能关闭
   - 系统自动校验，未通过复测的严重问题无法关闭

## 状态订阅功能

### 功能说明
用户可以订阅关注的问题，当问题状态发生变更时，系统自动推送通知。

### 订阅 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/subscriptions/problems/:problemId | 查询是否已订阅 |
| POST | /api/subscriptions/problems/:problemId | 订阅问题 |
| DELETE | /api/subscriptions/problems/:problemId | 取消订阅 |
| GET | /api/subscriptions/my | 我的订阅列表 |
| GET | /api/subscriptions/notifications | 查询通知列表 |
| PUT | /api/subscriptions/notifications/:id/read | 标记单条已读 |
| PUT | /api/subscriptions/notifications/read-all | 全部标记已读 |
| GET | /api/subscriptions/notifications/unread-count | 未读数量 |

### 三处状态一致性保证
每次状态变更时，系统同时更新：
1. **待办处理** (problems 表 status 字段)
2. **日志记录** (problem_status_logs 表)
3. **通知推送** (notifications 表 - 仅推送给订阅者)

## 启动方式

```bash
# 启动后端
cd backend && npm install && npm start

# 启动前端（新终端）
cd frontend && npm install && npm run dev
```

## 验证脚本

运行 `./verify-787.sh` 可自动验证全部功能。
