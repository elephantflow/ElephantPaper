#!/usr/bin/env python3
import json
import os

# 读取all-index.json
index_file = "/tmp/ElephantPaper/index/all-index.json"
with open(index_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

# 定义中文标题映射（基于已经翻译的和需要新增的）
# 前30篇已有的中文标题保持不变，后30篇我们根据标题生成中文翻译
title_translations = {
    # 现有的需要更新为空白的标题
    "doaJTihgIZ": "非线性感知机中监督学习与强化学习的动态特性",
    "me1MpmENpw": "涌现通信的语义与空间性",
    "Yu7H8ZOuI2": "使用非凸优化的样本高效欧几里得距离几何重建",
    "S7THlpvH8i": "归一化层逐样本梯度足以预测Transformer中的梯度噪声规模",
    "wm9JZq7RCe": "词元化分析：马尔可夫数据下的Transformer",
    "M2UzLRoqic": "通过跨层注意力减少Transformer键值缓存大小",
    "qo7NtGMr2u": "超越仿射变换的对称性发现",
    "3ZAfFoAcUI": "堆叠的归纳偏置与推理能力的改进",
    "9uolDxbYLm": "使用反事实解释的模型重构：多面体理论视角",
    "UwvjJZWjPT": "多任务学习与微调的归纳偏置：特征重用的多种机制",
    "wDirCeTIoz": "使用分布式Lion进行通信高效的分布式训练",
    "DlYNGpCuwa": "通过学习用户编辑中的潜在偏好对齐LLM智能体",
    "1sLdprsbmk": "模型能否从示例中学习技能组合？",
    "GxwnQ8sxkL": "从离散与连续数据流的快照中学习",
    "dtPIUXdJHY": "标签特定表示学习的泛化分析",
    "pPSWHsgqRp": "Smoothie：无标签的语言模型路由",
    "nF34qXcY0b": "具有非渐进保证的解析非线性动力系统辨识",
    "CSjVSnvTbG": "双模拟度量是最优传输距离，且可高效计算",
    "XHCYZNmqnv": "免费检测脆弱决策：利用深度鲁棒分类器中的边界一致性",
    "HRnSVflpgt": "Schur网络：利用局部结构实现高阶图神经网络的等变性",
    "8iPobEKUUA": "使用低秩矩阵补全算法的高效最小贝叶斯风险解码",
    "cknAewsBhD": "EGSST：基于事件的图时空敏感Transformer用于目标检测",
    "7sACcaOmGi": "重置在在线强化学习中的力量",
    "MQIET1VfoV": "通过等变性提升多智能体强化学习的样本效率与泛化能力",
    "yW3tlSwusb": "使用输出敏感技术加速数据驱动算法设计的ERM"
}

# 更新数据
updated_count = 0
for i, item in enumerate(data):
    paper_id = item.get("id")
    if paper_id in title_translations and (not item.get("title_zh") or item.get("title_zh") == ""):
        data[i]["title_zh"] = title_translations[paper_id]
        updated_count += 1

# 写回文件
with open(index_file, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"成功更新了 {updated_count} 篇论文的中文标题")
print(f"总论文数: {len(data)}")