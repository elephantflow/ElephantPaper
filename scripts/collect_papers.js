#!/usr/bin/env node
/**
 * collect_papers.js - ElephantPaper 论文采集脚本
 * 每次运行采集约 30 篇，从断点继续
 * 优先级：NeurIPS 2024 → 2023 → 2022 → 2021 → ...
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_DIR = '/tmp/ElephantPaper';
const INDEX_DIR = path.join(REPO_DIR, 'index');
const DATA_DIR = path.join(REPO_DIR, 'data');
const STATS_FILE = path.join(INDEX_DIR, 'stats.json');
const ALL_INDEX_FILE = path.join(INDEX_DIR, 'all-index.json');
const BATCH_SIZE = 30;

// 采集顺序：优先最近年份
const COLLECT_QUEUE = [
  { conference: 'NeurIPS', year: 2024, invitation: 'NeurIPS.cc/2024/Conference/-/Submission' },
  { conference: 'NeurIPS', year: 2023, invitation: 'NeurIPS.cc/2023/Conference/-/Submission' },
  { conference: 'NeurIPS', year: 2022, invitation: 'NeurIPS.cc/2022/Conference/-/Submission' },
  { conference: 'NeurIPS', year: 2021, invitation: 'NeurIPS.cc/2021/Conference/-/Submission' },
];

function curlGet(url) {
  try {
    // 使用 --get 和 --data-urlencode 避免 shell 特殊字符问题
    return execSync(
      `curl -sL --max-time 20 -H "User-Agent: ElephantPaper/1.0" "${url}"`,
      { encoding: 'utf8', timeout: 25000 }
    );
  } catch (e) {
    return null;
  }
}

function loadStats() {
  if (fs.existsSync(STATS_FILE)) {
    return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
  }
  const stats = { progress: {}, totalCollected: 0, lastUpdated: null };
  COLLECT_QUEUE.forEach(q => {
    stats.progress[`${q.conference}_${q.year}`] = { offset: 0, collected: 0, done: false };
  });
  return stats;
}

function saveStats(stats) {
  stats.lastUpdated = new Date().toISOString();
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
}

function loadAllIndex() {
  if (fs.existsSync(ALL_INDEX_FILE)) {
    return JSON.parse(fs.readFileSync(ALL_INDEX_FILE, 'utf8'));
  }
  return [];
}

function saveAllIndex(index) {
  fs.writeFileSync(ALL_INDEX_FILE, JSON.stringify(index, null, 2));
}

function getPaperFile(conference, year, paperId) {
  return path.join(DATA_DIR, conference, String(year), `${paperId}.json`);
}

function normTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getSemanticScholarCitations(title) {
  try {
    const encoded = encodeURIComponent(title.slice(0, 80));
    const raw = curlGet(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encoded}&limit=1&fields=citationCount,year,externalIds`);
    if (!raw) return { citationCount: 0, arxivId: null };
    const data = JSON.parse(raw);
    const paper = data.data?.[0];
    if (!paper) return { citationCount: 0, arxivId: null };
    return {
      citationCount: paper.citationCount || 0,
      arxivId: paper.externalIds?.ArXiv || null
    };
  } catch (e) {
    return { citationCount: 0, arxivId: null };
  }
}

function isHighQuality(paper, citationCount) {
  const venue = paper.venue || '';
  // Oral/Spotlight 直接判定为优质
  if (/oral|spotlight/i.test(venue)) return true;
  // 引用数高
  if (citationCount >= 50) return true;
  // 评审分（部分论文有）
  const score = paper.average_rating || 0;
  if (score >= 8) return true;
  return false;
}

function buildPaperRecord(note, conference, year, citationCount, arxivId, isDetailed) {
  const c = note.content || {};
  const get = (field) => {
    const v = c[field];
    return (typeof v === 'object' && v !== null && 'value' in v) ? v.value : (v || '');
  };

  const title = get('title');
  const abstract = get('abstract');
  const authors = get('authors');
  const keywords = get('keywords');
  const venue = get('venue');
  const tldr = get('TLDR') || get('tldr') || '';
  const paperhash = get('paperhash') || note.id;

  const paperId = (note.id || paperhash).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);

  const openreviewUrl = `https://openreview.net/forum?id=${note.id}`;
  const arxivUrl = arxivId ? `https://arxiv.org/abs/${arxivId}` : null;

  const record = {
    id: paperId,
    or_id: note.id,
    title,
    authors: Array.isArray(authors) ? authors : [authors],
    conference,
    year,
    venue,
    abstract: abstract.slice(0, 2000),
    tldr: tldr.slice(0, 300),
    keywords: Array.isArray(keywords) ? keywords : [],
    links: {
      openreview: openreviewUrl,
      arxiv: arxivUrl,
      pdf: c.pdf?.value ? `https://openreview.net${c.pdf.value}` : null,
    },
    citationCount,
    isHighQuality: isDetailed,
    collected_at: new Date().toISOString(),
  };

  if (isDetailed) {
    record.sections = {
      introduction: '',
      method: '',
      experiments: '',
      conclusion: '',
      note: 'Full text pending - marked for detailed extraction'
    };
  } else {
    record.sections = {
      method_summary: tldr || abstract.slice(0, 300),
    };
  }

  return { paperId, record };
}

async function collectBatch() {
  const stats = loadStats();
  const allIndex = loadAllIndex();
  const existingTitles = new Set(allIndex.map(p => normTitle(p.title)));

  let collected = 0;
  let newEntries = [];

  for (const task of COLLECT_QUEUE) {
    if (collected >= BATCH_SIZE) break;

    const key = `${task.conference}_${task.year}`;
    const progress = stats.progress[key];
    if (!progress || progress.done) continue;

    console.log(`\n📚 采集 ${task.conference} ${task.year}，offset=${progress.offset}...`);

    const invEnc = encodeURIComponent(task.invitation);
    const url = `https://api2.openreview.net/notes?invitation=${invEnc}&limit=${BATCH_SIZE - collected}&offset=${progress.offset}`;
    const raw = curlGet(url);
    if (!raw) {
      console.warn(`  ⚠️ 请求失败，跳过`);
      continue;
    }

    let data;
    try { data = JSON.parse(raw); } catch (e) {
      console.warn(`  ⚠️ JSON 解析失败`);
      continue;
    }

    const notes = data.notes || [];
    if (notes.length === 0) {
      progress.done = true;
      console.log(`  ✅ ${task.conference} ${task.year} 采集完毕`);
      continue;
    }

    for (const note of notes) {
      if (collected >= BATCH_SIZE) break;

      const c = note.content || {};
      const get = (f) => { const v = c[f]; return (typeof v==='object'&&v!==null&&'value'in v)?v.value:(v||''); };
      const title = String(get('title'));
      if (!title || existingTitles.has(normTitle(title))) continue;

      // 获取引用数
      const { citationCount, arxivId } = getSemanticScholarCitations(title);

      const isDetailed = isHighQuality({ venue: get('venue') }, citationCount);
      const { paperId, record } = buildPaperRecord(note, task.conference, task.year, citationCount, arxivId, isDetailed);

      // 保存详情文件
      const paperFile = getPaperFile(task.conference, task.year, paperId);
      fs.writeFileSync(paperFile, JSON.stringify(record, null, 2));

      // 加入全量索引
      const indexEntry = {
        id: paperId,
        title: record.title,
        authors: record.authors.slice(0, 3),
        conference: record.conference,
        year: record.year,
        venue: record.venue,
        keywords: record.keywords.slice(0, 5),
        citationCount,
        isHighQuality: isDetailed,
        links: { openreview: record.links.openreview, arxiv: record.links.arxiv },
      };
      newEntries.push(indexEntry);
      existingTitles.add(normTitle(title));
      collected++;

      const quality = isDetailed ? '🔴' : '🔵';
      console.log(`  ${quality} [${collected}] ${title.slice(0, 60)} (citations: ${citationCount})`);
    }

    progress.offset += notes.length;
    progress.collected += collected;

    if (notes.length < (BATCH_SIZE - collected + notes.length)) {
      progress.done = true;
    }
  }

  // 更新索引
  allIndex.push(...newEntries);
  saveAllIndex(allIndex);

  stats.totalCollected += collected;
  saveStats(stats);

  console.log(`\n✅ 本批采集完成：${collected} 篇，累计 ${stats.totalCollected} 篇`);
  return collected;
}

collectBatch().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
