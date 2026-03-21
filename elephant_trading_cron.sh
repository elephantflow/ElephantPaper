#!/bin/bash

# ElephantTrading 每2小时数据更新 + 异动告警脚本
# 创建时间: 2026-03-19
# 执行频率: 每2小时

set -e

echo "=== ElephantTrading 数据更新开始: $(TZ='Asia/Shanghai' date '+%Y-%m-%d %H:%M:%S') ==="

# 工作目录
WORK_DIR="/tmp/et-update-$$"
REPO_URL="git@github.com:elephantflow/ElephantTrading.git"
SCRIPT_LOG="/tmp/et_cron_$(date +%Y%m%d_%H%M%S).log"

# 函数：记录日志
log() {
    echo "[$(TZ='Asia/Shanghai' date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$SCRIPT_LOG"
}

# 步骤1: 准备工作区
log "步骤1: 准备工作区"
rm -rf "$WORK_DIR"
git clone "$REPO_URL" "$WORK_DIR" 2>&1 | tee -a "$SCRIPT_LOG"
cd "$WORK_DIR"
git config user.email "elephantflow@github.com"
git config user.name "elephantflow"

# 步骤2: 执行数据抓取脚本
log "步骤2: 执行数据抓取脚本"
ALERT_SIGNAL=""
if [ -f "scripts/fetch_prices.js" ]; then
    SCRIPT_OUTPUT=$(node scripts/fetch_prices.js 2>&1)
    echo "$SCRIPT_OUTPUT" | tee -a "$SCRIPT_LOG"
    
    # 检测是否有告警信号
    ALERT_LINE=$(echo "$SCRIPT_OUTPUT" | grep "^ALERT_SIGNAL:" || true)
    if [ ! -z "$ALERT_LINE" ]; then
        ALERT_SIGNAL=$(echo "$ALERT_LINE" | sed 's/^ALERT_SIGNAL://')
        log "检测到异动告警: $ALERT_SIGNAL"
    fi
else
    log "错误: scripts/fetch_prices.js 不存在"
    exit 1
fi

# 步骤3: 提交并推送到 GitHub
log "步骤3: 提交并推送到 GitHub"
if [ -f "data/prices.json" ]; then
    git add data/prices.json data/alerts.json 2>&1 | tee -a "$SCRIPT_LOG"
    COMMIT_MSG="data: 自动更新价格数据 $(TZ='Asia/Shanghai' date '+%Y-%m-%d %H:%M:%S')"
    git commit -m "$COMMIT_MSG" 2>&1 | tee -a "$SCRIPT_LOG"
    git push origin main 2>&1 | tee -a "$SCRIPT_LOG"
else
    log "警告: data/prices.json 文件不存在，跳过提交"
fi

# 步骤4: 检测异动并告警（在企业微信消息中处理）
log "步骤4: 检测异动并告警"
if [ ! -z "$ALERT_SIGNAL" ]; then
    # 解析告警信息
    ASSET_NAME=$(echo "$ALERT_SIGNAL" | jq -r '.asset // "未知资产"' 2>/dev/null || echo "未知资产")
    DIRECTION=$(echo "$ALERT_SIGNAL" | jq -r '.direction // "涨跌"' 2>/dev/null || echo "涨跌")
    CHANGE_PCT=$(echo "$ALERT_SIGNAL" | jq -r '.changePct // "0.00"' 2>/dev/null || echo "0.00")
    OLD_VALUE=$(echo "$ALERT_SIGNAL" | jq -r '.oldValue // "0.00"' 2>/dev/null || echo "0.00")
    NEW_VALUE=$(echo "$ALERT_SIGNAL" | jq -r '.newValue // "0.00"' 2>/dev/null || echo "0.00")
    UPDATED_AT=$(echo "$ALERT_SIGNAL" | jq -r '.updatedAt // "'$(TZ='Asia/Shanghai' date '+%Y-%m-%d %H:%M:%S')'"' 2>/dev/null || echo "$(TZ='Asia/Shanghai' date '+%Y-%m-%d %H:%M:%S')")
    
    # 准备告警消息
    ALERT_MSG="⚠️ ElephantTrading 价格异动告警

• ${ASSET_NAME}：${DIRECTION} ${CHANGE_PCT}%
  ${OLD_VALUE} → ${NEW_VALUE}

数据来源：中国银行外汇牌价 + Stooq
更新时间：${UPDATED_AT}"
    
    # 记录告警信息（实际发送将由 OpenClaw 处理）
    log "准备发送告警消息:"
    echo "$ALERT_MSG" | tee -a "$SCRIPT_LOG"
    
    # 将告警信息保存到文件，供 OpenClaw 读取
    echo "$ALERT_MSG" > "/tmp/et_alert_$(date +%s).txt"
else
    log "无异动告警，静默结束"
fi

# 清理工作区
log "清理工作区"
cd /
rm -rf "$WORK_DIR"

log "=== ElephantTrading 数据更新完成 ==="