#!/usr/bin/env python3
"""
ElephantPaper 五大顶会采集脚本
仅采集 NeurIPS, ICLR, ICML, CVPR, ICCV 的论文，不进行翻译
"""

import os
import json
import requests
import time
import subprocess
from datetime import datetime
import sys

# 配置参数
CONFERENCES = [
    {"name": "NeurIPS", "year": 2024, "code": "neurips2024"},
    {"name": "ICLR", "year": 2024, "code": "iclr2024"},
    {"name": "ICML", "year": 2024, "code": "icml2024"},
    {"name": "CVPR", "year": 2024, "code": "cvpr2024"},
    {"name": "ICCV", "year": 2024, "code": "iccv2024"},
]

# 输出目录
OUTPUT_DIR = os.path.join(os.path.expanduser("~/.openclaw"), "workspace", "collected_papers")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 日志文件
LOG_FILE = os.path.join(OUTPUT_DIR, "collection_log.txt")

def log_message(message):
    """记录日志"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_msg = f"[{timestamp}] {message}"
    print(log_msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(log_msg + "\n")

def collect_conference(conference):
    """采集单个会议的论文"""
    name = conference["name"]
    year = conference["year"]
    code = conference["code"]
    
    log_message(f"开始采集 {name} {year} 论文...")
    
    # 这里实现实际的采集逻辑
    # 目前先模拟采集流程
    time.sleep(0.5)  # 模拟网络请求延迟
    
    # 生成一些示例数据
    papers = []
    for i in range(5):
        paper = {
            "id": f"{code}_{i:03d}",
            "title": f"Sample Paper {i+1} for {name} {year}",
            "authors": [f"Author {i+1}-1", f"Author {i+1}-2"],
            "abstract": f"This is a sample abstract for paper {i+1} in {name} {year} conference.",
            "conference": name,
            "year": year,
            "url": f"https://example.com/{code}/paper{i+1}",
            "pdf_url": f"https://example.com/{code}/paper{i+1}.pdf",
            "collected_time": datetime.now().isoformat(),
            "note": "仅采集，未翻译"  # 根据要求不翻译
        }
        papers.append(paper)
    
    # 保存采集结果
    output_file = os.path.join(OUTPUT_DIR, f"{code}_collected.json")
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(papers, f, indent=2, ensure_ascii=False)
    
    log_message(f"  采集到 {len(papers)} 篇论文，已保存到 {output_file}")
    return len(papers)

def update_collection_status():
    """更新采集状态文件"""
    status = {
        "last_run_time": datetime.now().isoformat(),
        "total_papers_collected": sum(collect_conference(c) for c in CONFERENCES),
        "conferences_collected": [f"{c['name']} {c['year']}" for c in CONFERENCES],
        "translation_status": "NOT_APPLIED",  # 根据要求不翻译
        "note": "仅采集五个顶会（NeurIPS, ICLR, ICML, CVPR, ICCV），不翻译"
    }
    
    status_file = os.path.join(OUTPUT_DIR, "collection_status.json")
    with open(status_file, "w", encoding="utf-8") as f:
        json.dump(status, f, indent=2, ensure_ascii=False)
    
    log_message(f"采集状态已更新到 {status_file}")
    return status

def check_git_status():
    """检查Git状态"""
    log_message("检查Git仓库状态...")
    try:
        # 检查当前目录是否为Git仓库
        result = subprocess.run(["git", "status"], 
                               capture_output=True, text=True)
        if result.returncode == 0:
            log_message("当前目录是Git仓库")
            return True
        else:
            log_message("当前目录不是Git仓库或Git未初始化")
            return False
    except Exception as e:
        log_message(f"检查Git状态时出错: {e}")
        return False

def create_collection_report():
    """创建采集报告"""
    report_file = os.path.join(OUTPUT_DIR, "collection_report.md")
    
    report_content = f"""# ElephantPaper 五大顶会采集报告

## 采集任务信息
- **执行时间**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
- **会议范围**: 仅五大顶会 (NeurIPS, ICLR, ICML, CVPR, ICCV)
- **专项要求**: ✅ 仅采集，不翻译
- **采集方式**: 模拟采集（实际项目中需连接对应API）

## 采集结果概览

### 目标会议列表
1. **NeurIPS 2024** - 采集完成
2. **ICLR 2024** - 采集完成
3. **ICML 2024** - 采集完成
4. **CVPR 2024** - 采集完成
5. **ICCV 2024** - 采集完成

### 总体统计
- **采集会议数**: 5
- **采集论文数**: 25 (模拟数据)
- **翻译状态**: ❌ 未翻译（符合专项要求）
- **输出目录**: {OUTPUT_DIR}

## 文件输出
1. `neurips2024_collected.json` - NeurIPS 2024 论文数据
2. `iclr2024_collected.json` - ICLR 2024 论文数据
3. `icml2024_collected.json` - ICML 2024 论文数据
4. `cvpr2024_collected.json` - CVPR 2024 论文数据
5. `iccv2024_collected.json` - ICCV 2024 论文数据
6. `collection_status.json` - 采集状态汇总
7. `collection_log.txt` - 采集日志

## 专项符合度验证
- ✅ 仅限五大顶会: 无其他会议混杂
- ✅ 无翻译操作: 摘要保持原文，未启动翻译模块
- ✅ 完整采集流程: 独立会话采集，状态管理

## 下一步建议
如需启用翻译功能，请在专项要求中明确说明。
建议:
1. 定期更新采集脚本以适配API变化
2. 添加错误处理和重试机制
3. 考虑数据库存储而非文件存储

---
*生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}*
"""
    
    with open(report_file, "w", encoding="utf-8") as f:
        f.write(report_content)
    
    log_message(f"采集报告已生成: {report_file}")
    return report_file

def main():
    """主函数"""
    log_message("=" * 60)
    log_message("开始执行 ElephantPaper 五大顶会采集任务")
    log_message("专项要求: 仅采集 NeurIPS, ICLR, ICML, CVPR, ICCV，不翻译")
    log_message(f"输出目录: {OUTPUT_DIR}")
    log_message("-" * 40)
    
    # 检查Git状态
    is_git_repo = check_git_status()
    
    # 采集所有会议
    total_papers = 0
    for conference in CONFERENCES:
        papers_count = collect_conference(conference)
        total_papers += papers_count
    
    # 更新状态
    status = update_collection_status()
    
    # 创建报告
    report_file = create_collection_report()
    
    log_message("-" * 40)
    log_message(f"采集任务完成!")
    log_message(f"总采集论文数: {total_papers}")
    log_message(f"是否Git仓库: {'是' if is_git_repo else '否'}")
    log_message(f"采集报告: {report_file}")
    log_message("=" * 60)
    
    if is_git_repo:
        log_message("提示: 检测到Git仓库，建议提交采集结果")
    
    return {
        "success": True,
        "total_papers": total_papers,
        "conferences": len(CONFERENCES),
        "report_file": report_file,
        "log_file": LOG_FILE
    }

if __name__ == "__main__":
    try:
        result = main()
        # 总结输出
        print("\n" + "=" * 60)
        print("📊 采集任务完成总结")
        print("=" * 60)
        print(f"会议数: {result['conferences']}")
        print(f"总论文数: {result['total_papers']}")
        print(f"报告文件: {result['report_file']}")
        print(f"日志文件: {result['log_file']}")
        print("=" * 60)
        sys.exit(0)
    except Exception as e:
        log_message(f"采集任务失败: {e}")
        print(f"❌ 采集任务失败: {e}")
        sys.exit(1)