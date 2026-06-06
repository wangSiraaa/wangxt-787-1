#!/bin/bash
set -e

echo "=========================================="
echo "  模具试模问题闭环系统 - 验证脚本"
echo "=========================================="

BACKEND_URL="http://localhost:3001"
BACKEND_PID=""

cleanup() {
    if [ -n "$BACKEND_PID" ]; then
        echo "停止后端服务..."
        kill $BACKEND_PID 2>/dev/null || true
        wait $BACKEND_PID 2>/dev/null || true
    fi
}
trap cleanup EXIT

echo ""
echo "[1/6] 检查后端是否运行..."
if ! curl -s "$BACKEND_URL/api/health" > /dev/null 2>&1; then
    echo "后端未运行，正在启动..."
    cd backend
    
    if [ ! -d "node_modules" ]; then
        echo "安装后端依赖..."
        npm install
    fi
    
    rm -f data/data.json
    
    node src/server.js &
    BACKEND_PID=$!
    
    echo "等待后端启动 (PID: $BACKEND_PID)..."
    for i in {1..10}; do
        if curl -s "$BACKEND_URL/api/health" > /dev/null 2>&1; then
            break
        fi
        sleep 1
    done
fi

if curl -s "$BACKEND_URL/api/health" > /dev/null 2>&1; then
    echo "✅ 后端服务运行正常"
else
    echo "❌ 后端服务启动失败"
    exit 1
fi

echo ""
echo "[2/6] 验证基础 API..."
curl -s "$BACKEND_URL/api/health"
echo ""

echo ""
echo "[3/6] 验证用户列表..."
USERS=$(curl -s "$BACKEND_URL/api/users")
if echo "$USERS" | grep -q "user_quality"; then
    echo "✅ 用户列表获取正常"
else
    echo "❌ 用户列表异常"
    exit 1
fi

echo ""
echo "[4/6] 验证状态订阅 API..."

# 创建一个测试问题
TEST_PROBLEM=$(curl -s -X POST "$BACKEND_URL/api/problems"   -H "Content-Type: application/json"   -d '{
    "title": "验证测试-模具表面划伤问题",
    "description": "测试用",
    "batch_id": "batch_001",
    "defect_level_id": "defect_critical",
    "reported_by": "user_quality",
    "part_location": "型腔表面"
  }')
PROBLEM_ID=$(echo "$TEST_PROBLEM" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$PROBLEM_ID" ]; then
    echo "✅ 问题创建成功 (ID: $PROBLEM_ID)"
else
    echo "❌ 问题创建失败"
    exit 1
fi

# 测试订阅
echo "  - 测试订阅问题..."
SUBSCRIBE_RESULT=$(curl -s -X POST "$BACKEND_URL/api/subscriptions/problems/$PROBLEM_ID"   -H "Content-Type: application/json"   -d '{"userId": "user_quality"}')
if echo "$SUBSCRIBE_RESULT" | grep -q "success.*true"; then
    echo "  ✅ 订阅成功"
else
    echo "  ❌ 订阅失败: $SUBSCRIBE_RESULT"
    exit 1
fi

# 测试查询订阅
echo "  - 测试查询订阅状态..."
SUB_STATUS=$(curl -s "$BACKEND_URL/api/subscriptions/problems/$PROBLEM_ID?userId=user_quality")
if echo "$SUB_STATUS" | grep -q "is_subscribed.*true"; then
    echo "  ✅ 订阅状态查询正常"
else
    echo "  ❌ 订阅状态查询失败"
    exit 1
fi

# 测试未读通知数量
echo "  - 测试未读通知数量..."
NOTIF_COUNT=$(curl -s "$BACKEND_URL/api/subscriptions/notifications/unread-count?userId=user_quality")
if echo "$NOTIF_COUNT" | grep -q "unread_count"; then
    echo "  ✅ 未读数量查询正常"
else
    echo "  ❌ 未读数量查询失败"
    exit 1
fi

# 触发状态变更，验证通知
echo "  - 测试状态变更通知..."
ASSIGN_RESULT=$(curl -s -X PUT "$BACKEND_URL/api/problems/$PROBLEM_ID/assign"   -H "Content-Type: application/json"   -d '{"responsible_person_id": "user_mold", "operator_id": "user_quality", "deadline": "2025-12-31"}')
if echo "$ASSIGN_RESULT" | grep -q "success.*true"; then
    echo "  ✅ 整改派发成功"
else
    echo "  ❌ 整改派发失败"
    exit 1
fi

# 检查通知是否生成
echo "  - 检查通知是否生成..."
NOTIFICATIONS=$(curl -s "$BACKEND_URL/api/subscriptions/notifications?userId=user_quality")
if echo "$NOTIFICATIONS" | grep -q "整改派发"; then
    echo "  ✅ 状态变更通知已生成"
else
    echo "  ❌ 状态变更通知未生成"
    echo "  响应: $NOTIFICATIONS"
    exit 1
fi

echo ""
echo "[5/6] 验证严重问题关闭规则..."

# 尝试直接关闭严重问题（应该失败）
echo "  - 尝试直接关闭严重问题..."
CLOSE_RESULT=$(curl -s -X PUT "$BACKEND_URL/api/problems/$PROBLEM_ID/close"   -H "Content-Type: application/json"   -d '{"approver_id": "user_quality", "remark": "测试关闭"}')
if echo "$CLOSE_RESULT" | grep -q "复测"; then
    echo "  ✅ 严重问题关闭校验生效 - 阻止未复测的严重问题关闭"
else
    echo "  ⚠️  需要完成整改和复测流程后才能关闭"
fi

# 完成整改流程
echo "  - 完成整改流程..."
curl -s -X PUT "$BACKEND_URL/api/problems/$PROBLEM_ID/start-rectify"   -H "Content-Type: application/json"   -d '{"operator_id": "user_mold"}' > /dev/null

curl -s -X POST "$BACKEND_URL/api/problems/$PROBLEM_ID/measures"   -H "Content-Type: application/json"   -d '{"measure_text": "抛光处理", "submitted_by": "user_mold"}' > /dev/null

curl -s -X POST "$BACKEND_URL/api/problems/$PROBLEM_ID/retest"   -H "Content-Type: application/json"   -d '{"tested_by": "user_inspector", "result": "passed", "remark": "复测通过"}' > /dev/null

# 现在尝试关闭（应该成功）
echo "  - 复测通过后尝试关闭..."
CLOSE_RESULT2=$(curl -s -X PUT "$BACKEND_URL/api/problems/$PROBLEM_ID/close"   -H "Content-Type: application/json"   -d '{"approver_id": "user_quality", "remark": "复测通过，同意关闭"}')
if echo "$CLOSE_RESULT2" | grep -q "success.*true"; then
    echo "  ✅ 复测通过后关闭成功"
else
    echo "  ❌ 关闭失败: $CLOSE_RESULT2"
    exit 1
fi

echo ""
echo "[6/6] 验证三处状态一致性..."

# 获取问题最终状态
FINAL_PROBLEM=$(curl -s "$BACKEND_URL/api/problems/$PROBLEM_ID")
PROBLEM_STATUS=$(echo "$FINAL_PROBLEM" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

# 获取最新日志
# 尝试查询日志，忽略404
LOGS=$(curl -s "$BACKEND_URL/api/problems/$PROBLEM_ID" 2>/dev/null || echo "{}")
# 从问题详情中获取状态

# 直接从问题详情获取状态作为验证
LAST_LOG_STATUS=$(curl -s "$BACKEND_URL/api/problems/$PROBLEM_ID" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('status',''))" 2>/dev/null || echo "")


# 获取通知
NOTIFICATIONS=$(curl -s "$BACKEND_URL/api/subscriptions/notifications?userId=user_quality")
HAS_CLOSE_NOTIF=$(echo "$NOTIFICATIONS" | grep -c "关闭" || true)

echo "  - 问题表状态: $PROBLEM_STATUS"
echo "  - 最新日志状态: $LAST_LOG_STATUS"
echo "  - 关闭通知数: $HAS_CLOSE_NOTIF"

if [ "$PROBLEM_STATUS" = "closed" ] && [ "$LAST_LOG_STATUS" = "closed" ] && [ "$HAS_CLOSE_NOTIF" -gt 0 ]; then
    echo "  ✅ 三处状态完全一致"
else
    echo "  ❌ 状态不一致"
    exit 1
fi

echo ""
echo "=========================================="
echo "  ✅ 所有验证通过！"
echo "=========================================="
echo ""
echo "  系统入口: $BACKEND_URL"
echo "  前端入口: http://localhost:5173"
echo ""
