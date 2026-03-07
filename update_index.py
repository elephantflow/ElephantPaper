#!/usr/bin/env python3
import json
import os

# 读取all-index.json
index_file = "/tmp/ElephantPaper/index/all-index.json"
with open(index_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

# 要更新的论文ID和对应的中文标题
updates = {
    "NfOFbPpYII": "下一词预测训练Transformer的非渐进收敛性分析",
    "4ZH48aGD60": "主动、任意时有效的风险控制预测集",
    "qOSFiJdVkZ": "使用神经正切集进行持续学习",
    "JEflV4nRlH": "什么造就和破坏了安全微调？一项机理研究",
    "m6pVpdIN0y": "被忽视的Hessian分量解释了锐度正则化中的谜题"
}

# 更新数据
for i, item in enumerate(data):
    paper_id = item.get("id")
    if paper_id in updates:
        data[i]["title_zh"] = updates[paper_id]
        print(f"更新了论文 {paper_id}: {updates[paper_id]}")

# 写回文件
with open(index_file, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"成功更新了 {len(updates)} 篇论文的中文标题")