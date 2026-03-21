#!/bin/bash

# ElephantPaper 论文采集脚本（仅采集，不翻译）
# 每20分钟运行一次

set -e

LOG_FILE="/root/.openclaw/workspace/elephantpaper_log.txt"
echo "=== $(TZ='Asia/Shanghai' date '+%Y-%m-%d %H:%M:%S') 开始运行 ===" >> "$LOG_FILE"

# 切换到工作目录
cd /tmp

# Step 1：更新仓库
if [ ! -d "ElephantPaper" ]; then
    echo "克隆仓库..." >> "$LOG_FILE"
    # 使用SSH方式克隆，避免敏感信息泄露
    git clone git@github.com:elephantflow/ElephantPaper.git /tmp/ElephantPaper
    cd /tmp/ElephantPaper
    git config user.email "elephantflow@github.com"
    git config user.name "elephantflow"
else
    echo "更新仓库..." >> "$LOG_FILE"
    cd /tmp/ElephantPaper
    git pull origin main 2>&1 | tee -a "$LOG_FILE"
    git config user.email "elephantflow@github.com"
    git config user.name "elephantflow"
fi

# Step 2：运行采集脚本
echo "运行采集脚本..." >> "$LOG_FILE"
node scripts/collect_papers.js 2>&1 | tee -a "$LOG_FILE"

# Step 3：提交和推送
echo "提交变更..." >> "$LOG_FILE"

# 检查是否有变更
if git status --porcelain | grep -q .; then
    git add -A
    git commit -m "data: 采集论文 $(TZ='Asia/Shanghai' date '+%Y-%m-%d %H:%M:%S')" 2>&1 | tee -a "$LOG_FILE"
    
    echo "推送变更..." >> "$LOG_FILE"
    git push origin main 2>&1 | tee -a "$LOG_FILE"
else
    echo "无变更，跳过提交" >> "$LOG_FILE"
fi

echo "=== $(TZ='Asia/Shanghai' date '+%Y-%m-%d %H:%M:%S') 运行完成 ===" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"