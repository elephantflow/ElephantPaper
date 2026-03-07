#!/usr/bin/env node
/**
 * collect_papers.js v2 - ElephantPaper 论文采集脚本
 * 每次运行采集约 30 篇，从断点继续
 * 优先级：NeurIPS 2024 → 2023 → 2022 → 2021 → ...
 * 数据源：
 *   - NeurIPS 2024/2023: OpenReview API (invitation)
 *   - NeurIPS 2022/2021: OpenReview DBLP records + arXiv abstract 补全
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
const SS_DELAY_MS = 1200; // Semantic Scholar rate limit: ~1 req/sec

// 采集队列：按优先级排序
const COLLECT_QUEUE = [
  { conference: 'NeurIPS', year: 2024, method: 'openreview', invitation: 'NeurIPS.cc/2024/Conference/-/Submission' },
  { conference: 'NeurIPS', year: 2023, method: 'openreview', invitation: 'NeurIPS.cc/2023/Conference/-/Submission' },
  { conference: 'NeurIPS', year: 2022, method: 'dblp', dblpVenue: 'NeurIPS 2022' },
  { conference: 'NeurIPS', year: 2021, method: 'dblp', dblpVenue: 'NeurIPS 2021' },
];

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function curlGet(url, timeoutSec = 20) {
  try {
    return execSync(
      `curl -sL --max-time ${timeoutSec} -H "User-Agent: ElephantPaper/2.0" "${url}"`,
      { encoding: 'utf8', timeout: (timeoutSec + 5) * 1000 }
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

function normTitle(title) {
  return String(title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getVal(obj, field) {
  const v = (obj || {})[field];
  return (typeof v === 'object' && v !== null && 'value' in v) ? v.value : (v || '');
}

// Semantic Scholar: 按标题搜索引用数（有 rate limit，每次只查1篇）
function querySemanticScholar(title) {
  try {
    const q = encodeURIComponent(title.slice(0, 80));
    const raw = curlGet(
      `https://api.semanticscholar.org/graph/v1/paper/search?query=${q}&limit=1&fields=citationCount,year,externalIds`,
      12
    );
    if (!raw) return { citationCount: 0, arxivId: null };
    const data = JSON.parse(raw);
    if (data.code === '429') return { citationCount: -1, arxivId: null }; // rate limited
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

// arXiv: 按标题搜索摘要
function queryArxivAbstract(title) {
  try {
    const q = encodeURIComponent(`ti:"${title.slice(0, 60)}"`);
    const raw = curlGet(`https://export.arxiv.org/api/query?search_query=${q}&max_results=1`, 15);
    if (!raw) return { abstract: '', arxivId: null };
    // 简单解析 Atom XML
    const abstractMatch = raw.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);
    const idMatch = raw.match(/<id>https?:\/\/arxiv\.org\/abs\/([\d.]+)<\/id>/);
    const abstract = abstractMatch ? abstractMatch[1].trim().replace(/\s+/g, ' ') : '';
    return {
      abstract: abstract.slice(0, 2000),
      arxivId: idMatch ? idMatch[1] : null
    };
  } catch (e) {
    return { abstract: '', arxivId: null };
  }
}

function isHighQuality(venue, citationCount) {
  if (/oral|spotlight/i.test(String(venue))) return true;
  if (citationCount >= 50) return true;
  return false;
}

function buildRecordFromOpenreview(note, conference, year, citationCount, arxivId) {
  const c = note.content || {};
  const title = getVal(c, 'title');
  const abstract = getVal(c, 'abstract');
  const authors = getVal(c, 'authors');
  const keywords = getVal(c, 'keywords');
  const venue = getVal(c, 'venue');
  const tldr = getVal(c, 'TLDR') || getVal(c, 'tldr') || '';
  const isDetailed = isHighQuality(venue, citationCount);
  const paperId = note.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);

  return {
    paperId,
    record: {
      id: paperId,
      or_id: note.id,
      title,
      authors: Array.isArray(authors) ? authors : [String(authors)],
      conference,
      year,
      venue,
      abstract: String(abstract).slice(0, 2000),
      tldr: String(tldr).slice(0, 300),
      keywords: Array.isArray(keywords) ? keywords : [],
      links: {
        openreview: `https://openreview.net/forum?id=${note.id}`,
        arxiv: arxivId ? `https://arxiv.org/abs/${arxivId}` : null,
        pdf: c.pdf?.value ? `https://openreview.net${c.pdf.value}` : null,
      },
      citationCount,
      isHighQuality: isDetailed,
      sections: isDetailed
        ? { note: 'Detailed extraction pending (high-quality paper)', method_summary: String(tldr || abstract).slice(0, 400) }
        : { method_summary: String(tldr || abstract).slice(0, 300) },
      collected_at: new Date().toISOString(),
    }
  };
}

function buildRecordFromDblp(note, conference, year, citationCount, arxivId, arxivAbstract) {
  const c = note.content || {};
  const title = getVal(c, 'title');
  const authors = getVal(c, 'authors');
  const isDetailed = isHighQuality('', citationCount);
  const paperId = note.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
  const dblpId = (note.externalIds || []).find(id => id.startsWith('dblp:'));

  return {
    paperId,
    record: {
      id: paperId,
      or_id: note.id,
      title,
      authors: Array.isArray(authors) ? authors : [String(authors)],
      conference,
      year,
      venue: `${conference} ${year}`,
      abstract: arxivAbstract || '',
      tldr: '',
      keywords: [],
      links: {
        openreview: null,
        arxiv: arxivId ? `https://arxiv.org/abs/${arxivId}` : null,
        dblp: dblpId ? `https://dblp.org/rec/${dblpId.replace('dblp:', '')}.html` : null,
        pdf: getVal(c, 'pdf') || null,
      },
      citationCount,
      isHighQuality: isDetailed,
      sections: { method_summary: (arxivAbstract || '').slice(0, 300) },
      collected_at: new Date().toISOString(),
    }
  };
}

async function collectBatch() {
  const stats = loadStats();
  const allIndex = loadAllIndex();
  const existingTitles = new Set(allIndex.map(p => normTitle(p.title)));

  let collected = 0;
  const newEntries = [];
  let ssRateLimited = false;

  for (const task of COLLECT_QUEUE) {
    if (collected >= BATCH_SIZE) break;

    const key = `${task.conference}_${task.year}`;
    if (!stats.progress[key]) {
      stats.progress[key] = { offset: 0, collected: 0, done: false };
    }
    const progress = stats.progress[key];
    if (progress.done) continue;

    const remaining = BATCH_SIZE - collected;
    console.log(`\n📚 采集 ${task.conference} ${task.year} (method=${task.method})，offset=${progress.offset}，剩余配额=${remaining}...`);

    let notes = [];

    if (task.method === 'openreview') {
      const invEnc = encodeURIComponent(task.invitation);
      const url = `https://api2.openreview.net/notes?invitation=${invEnc}&limit=${remaining}&offset=${progress.offset}`;
      const raw = curlGet(url);
      if (!raw) { console.warn('  ⚠️ API 请求失败'); continue; }
      try {
        const data = JSON.parse(raw);
        notes = data.notes || [];
      } catch (e) { console.warn('  ⚠️ JSON 解析失败'); continue; }

    } else if (task.method === 'dblp') {
      const venueEnc = encodeURIComponent(task.dblpVenue);
      const url = `https://api2.openreview.net/notes?invitation=DBLP.org%2F-%2FRecord&content.venue=${venueEnc}&limit=${remaining}&offset=${progress.offset}`;
      const raw = curlGet(url);
      if (!raw) { console.warn('  ⚠️ DBLP API 请求失败'); continue; }
      try {
        const data = JSON.parse(raw);
        notes = data.notes || [];
      } catch (e) { console.warn('  ⚠️ JSON 解析失败'); continue; }
    }

    if (notes.length === 0) {
      progress.done = true;
      console.log(`  ✅ ${task.conference} ${task.year} 采集完毕（共 ${progress.collected} 篇）`);
      continue;
    }

    for (const note of notes) {
      if (collected >= BATCH_SIZE) break;

      const c = note.content || {};
      const title = String(getVal(c, 'title'));
      if (!title || title.length < 3) continue;
      if (existingTitles.has(normTitle(title))) {
        console.log(`  ⏭️ 跳过重复: ${title.slice(0, 50)}`);
        continue;
      }

      let citationCount = 0, arxivId = null, arxivAbstract = '';

      // Semantic Scholar 查引用数（限流时跳过）
      if (!ssRateLimited) {
        const ss = querySemanticScholar(title);
        if (ss.citationCount === -1) {
          ssRateLimited = true;
          console.log('  ⚠️ Semantic Scholar 限流，本批跳过引用查询');
        } else {
          citationCount = ss.citationCount;
          arxivId = ss.arxivId;
          await sleep(SS_DELAY_MS);
        }
      }

      // DBLP 来源额外用 arXiv 补 abstract
      if (task.method === 'dblp' && !arxivAbstract) {
        const ax = queryArxivAbstract(title);
        arxivAbstract = ax.abstract;
        if (!arxivId && ax.arxivId) arxivId = ax.arxivId;
      }

      let paperId, record;
      if (task.method === 'openreview') {
        ({ paperId, record } = buildRecordFromOpenreview(note, task.conference, task.year, citationCount, arxivId));
      } else {
        ({ paperId, record } = buildRecordFromDblp(note, task.conference, task.year, citationCount, arxivId, arxivAbstract));
      }

      // 写详情文件
      const dir = path.join(DATA_DIR, task.conference, String(task.year));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${paperId}.json`), JSON.stringify(record, null, 2));

      // 加入全量索引
      newEntries.push({
        id: paperId,
        title: record.title,
        authors: record.authors.slice(0, 3),
        conference: record.conference,
        year: record.year,
        venue: record.venue,
        keywords: record.keywords.slice(0, 5),
        citationCount,
        isHighQuality: record.isHighQuality,
        links: { openreview: record.links.openreview, arxiv: record.links.arxiv },
      });
      existingTitles.add(normTitle(title));
      collected++;

      const badge = record.isHighQuality ? '🔴' : '🔵';
      console.log(`  ${badge} [${collected}] ${title.slice(0, 60)} (cit:${citationCount}${arxivId ? ' arXiv' : ''})`);
    }

    progress.offset += notes.length;
    progress.collected = (progress.collected || 0) + collected - newEntries.length + newEntries.length;
  }

  allIndex.push(...newEntries);
  saveAllIndex(allIndex);
  stats.totalCollected = (stats.totalCollected || 0) + collected;
  saveStats(stats);

  console.log(`\n✅ 本批完成：${collected} 篇，累计 ${stats.totalCollected} 篇`);
  return collected;
}

collectBatch().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
