#!/usr/bin/env python3
"""
翻译所有待翻译的论文
"""
import json
import os
import sys
from datetime import datetime

# 待翻译的论文列表（从collect_papers.js输出中手动提取的部分）
papers_to_translate = [
    {
        "id": "vBah12uVbD",
        "title": "Conformalized Credal Set Predictors",
        "title_zh": "Credal集的Conformal校准预测因子",
        "abstract": "Credal sets are sets of probability distributions that are considered as candidates for an imprecisely known ground-truth distribution. In machine learning, they have recently attracted attention as an appealing formalism for uncertainty representation, in particular, due to their ability to represent both the aleatoric and epistemic uncertainty in a prediction.",
        "abstract_zh": "Credal集的定义为一组可能的概率分布的集合，这些分布被认为是对某个不完全已知的真实分布的候选描述。在机器学习领域，它们最近因其能够同时表征预测中的偶发不确定性和认知不确定性而受到关注，作为一种有吸引力的不确定性表征形式。"
    },
    {
        "id": "zn6s6VQYb0",
        "title": "GraphCroc: Cross-Correlation Autoencoder for Graph Structural Reconstruction",
        "title_zh": "GraphCroc：基于互相关机制的自编码器用于图结构重构",
        "abstract": "Graph-structured data is integral to many applications, prompting the development of various graph representation methods. Graph autoencoders (GAEs), in particular, reconstruct graph structures from node embeddings.",
        "abstract_zh": "图结构数据在众多应用中不可或缺，促使了各种图表示方法的发展。图自编码器（Graph autoencoders，简称GAEs）特别是从节点嵌入中重构图结构的典型方法。"
    },
    {
        "id": "5FATPIlWUJ", 
        "title": "Robust Gaussian Processes via Relevance Pursuit",
        "title_zh": "基于相关性追踪的鲁棒高斯过程",
        "abstract": "Gaussian processes (GPs) are non-parametric probabilistic regression models that are popular due to their flexibility, data efficiency, and well-calibrated uncertainty estimates.",
        "abstract_zh": "高斯过程（Gaussian processes，简称GPs）是一种非参数的概率回归模型，因其灵活性、数据高效性和准确的不确定性估计而广受欢迎。"
    },
    {
        "id": "8ugOlbjJpp",
        "title": "Private Algorithms for Stochastic Saddle Points and Variational Inequalities: Beyond Euclidean Geometry",
        "title_zh": "针对随机鞍点与变分不等式的隐私算法设计：超越欧氏几何框架", 
        "abstract": "In this work, we conduct a systematic study of stochastic saddle point problems (SSP) and stochastic variational inequalities (SVI) under the constraint of differential privacy in both Euclidean and non-Euclidean setups.",
        "abstract_zh": "本工作系统性地研究了在欧氏和非欧氏框架下受差分隐私约束的随机鞍点问题和随机变分不等式的算法设计问题。"
    }
]

def update_paper_file(paper_id, title_zh, abstract_zh):
    """更新单篇论文的JSON文件"""
    file_path = f"data/NeurIPS/2024/{paper_id}.json"
    
    if not os.path.exists(file_path):
        print(f"❌ 文件不存在: {file_path}")
        return False
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        data['title_zh'] = title_zh
        data['abstract_zh'] = abstract_zh
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 更新论文文件: {paper_id}")
        return True
    except Exception as e:
        print(f"❌ 更新论文文件失败: {paper_id}, 错误: {e}")
        return False

def update_index_file(paper_id, title_zh):
    """更新索引文件"""
    index_file = "index/all-index.json"
    
    try:
        with open(index_file, 'r', encoding='utf-8') as f:
            index_data = json.load(f)
        
        # 查找并更新对应条目
        for item in index_data:
            if item.get('id') == paper_id:
                item['title_zh'] = title_zh
                break
        
        with open(index_file, 'w', encoding='utf-8') as f:
            json.dump(index_data, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 更新索引文件: {paper_id}")
        return True
    except Exception as e:
        print(f"❌ 更新索引文件失败: {paper_id}, 错误: {e}")
        return False

def update_stats(translated_count):
    """更新统计信息"""
    stats_file = "index/stats.json"
    
    try:
        with open(stats_file, 'r', encoding='utf-8') as f:
            stats = json.load(f)
        
        current = stats.get('totalTranslated', 0)
        stats['totalTranslated'] = current + translated_count
        stats['lastUpdate'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        with open(stats_file, 'w', encoding='utf-8') as f:
            json.dump(stats, f, ensure_ascii=False, indent=2)
        
        print(f"📊 统计已更新: totalTranslated = {stats['totalTranslated']}")
        return True
    except Exception as e:
        print(f"❌ 更新统计文件失败: {e}")
        return False

def main():
    print("🚀 开始批量翻译论文...")
    translated_count = 0
    
    for paper in papers_to_translate:
        print(f"\n📄 处理论文: {paper['id']}")
        print(f"   标题: {paper['title'][:50]}...")
        
        # 更新论文文件
        if update_paper_file(paper['id'], paper['title_zh'], paper['abstract_zh']):
            # 更新索引文件
            if update_index_file(paper['id'], paper['title_zh']):
                translated_count += 1
    
    # 更新统计信息
    if translated_count > 0:
        update_stats(translated_count)
    
    print(f"\n🎉 完成! 成功翻译 {translated_count} 篇论文")
    
    # 检查总数
    try:
        with open("index/stats.json", 'r', encoding='utf-8') as f:
            stats = json.load(f)
            print(f"📈 当前累计翻译: {stats.get('totalTranslated', 0)} 篇")
    except:
        pass

if __name__ == "__main__":
    os.chdir("/tmp/ElephantPaper")
    main()