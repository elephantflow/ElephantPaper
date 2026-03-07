# 🐘 ElephantPaper

**顶会论文索引库** · 持续收录 NeurIPS、ICLR、ICML、CVPR、ICCV 自 2021 年以来发表的论文。

🌐 **在线访问**：[https://elephantflow.github.io/ElephantPaper](https://elephantflow.github.io/ElephantPaper)

---

## 📖 项目简介

ElephantPaper 是一个自动化论文索引与检索系统，通过定时任务持续采集顶会论文数据，提供结构化的论文信息和可检索的前端页面。

**覆盖会议**

| 会议 | 全称 | 采集年份 |
|------|------|---------|
| NeurIPS | Neural Information Processing Systems | 2021–2024 |
| ICLR | International Conference on Learning Representations | 2021–2025 |
| ICML | International Conference on Machine Learning | 2021–2024 |
| CVPR | Conference on Computer Vision and Pattern Recognition | 2021–2024 |
| ICCV | International Conference on Computer Vision | 2021、2023 |

---

## ✨ 功能特性

- **持续采集**：每 30 分钟自动采集约 30 篇论文，从断点继续，直至覆盖全量
- **两级档案**：
  - 🔴 **优质论文**（Oral / Spotlight / 引用量 ≥ 50）：保存完整摘要、章节详情、中文翻译
  - 🔵 **标准论文**：保存摘要、核心方法摘要、来源链接
- **多源融合**：自动合并 OpenReview、arXiv、Semantic Scholar 的同一论文信息，避免重复
- **质量标注**：基于接收类型（Oral/Spotlight）和引用数自动判定论文质量
- **可检索前端**：支持标题/作者/关键词全文搜索，按会议/年份/质量筛选

---

## 🗂️ 仓库结构

```
ElephantPaper/
├── index.html                  # 前端页面（GitHub Pages 入口）
├── index/
│   ├── all-index.json          # 全量轻量索引（供前端加载）
│   └── stats.json              # 采集进度统计
├── data/
│   ├── NeurIPS/
│   │   ├── 2024/               # 每篇论文一个 JSON 文件
│   │   ├── 2023/
│   │   ├── 2022/
│   │   └── 2021/
│   ├── ICLR/
│   ├── ICML/
│   ├── CVPR/
│   └── ICCV/
├── scripts/
│   └── collect_papers.js       # 采集脚本
└── web/
    └── index.html              # 前端源文件
```

---

## 📄 数据格式

每篇论文保存为独立 JSON 文件，字段如下：

```json
{
  "id": "paper_id",
  "title": "论文标题",
  "authors": ["作者1", "作者2"],
  "conference": "NeurIPS",
  "year": 2024,
  "venue": "NeurIPS 2024 Oral",
  "abstract": "英文摘要...",
  "tldr": "一句话总结...",
  "keywords": ["keyword1", "keyword2"],
  "links": {
    "openreview": "https://openreview.net/forum?id=xxx",
    "arxiv": "https://arxiv.org/abs/xxxx.xxxxx",
    "pdf": "https://openreview.net/pdf/..."
  },
  "citationCount": 128,
  "isHighQuality": true,
  "sections": {
    "method_summary": "核心方法描述..."
  },
  "collected_at": "2026-03-07T08:00:00.000Z"
}
```

---

## 🔍 数据来源

| 来源 | 用途 |
|------|------|
| [OpenReview API](https://api2.openreview.net) | NeurIPS 2023/2024、ICLR、ICML 的结构化论文数据（标题、摘要、作者、评审信息） |
| [DBLP via OpenReview](https://openreview.net) | NeurIPS 2021/2022 的论文元数据 |
| [arXiv API](https://export.arxiv.org/api/) | 补充摘要、获取预印本链接 |
| [Semantic Scholar API](https://api.semanticscholar.org) | 引用数查询，用于质量评定 |

---

## 📊 采集进度

采集进度实时记录在 [`index/stats.json`](./index/stats.json)，前端页面也会展示当前进度。

**采集顺序**（按优先级）：
1. NeurIPS 2024 → 2023 → 2022 → 2021
2. ICLR 2025 → 2024 → 2023 → 2022 → 2021
3. ICML 2024 → 2023 → 2022 → 2021
4. CVPR 2024 → 2023 → 2022 → 2021
5. ICCV 2023 → 2021

---

## ⚙️ 本地运行

```bash
# 克隆仓库
git clone https://github.com/elephantflow/ElephantPaper.git
cd ElephantPaper

# 运行一批采集（约 30 篇）
node scripts/collect_papers.js
```

脚本会从 `index/stats.json` 中读取断点，自动继续上次进度。

---

## 📝 免责声明

本项目仅收录论文元数据（标题、作者、摘要、链接等公开信息），不存储论文 PDF 或其他受版权保护的完整内容。所有数据来源于公开学术平台，仅供学术研究参考使用。

---

*🐘 ElephantPaper · Powered by [ElephantFlow](https://github.com/elephantflow) · 持续更新中*
