#!/usr/bin/env node
/**
 * collect_papers.js v3 - ElephantPaper 论文采集脚本
 * 每次运行采集约 30 篇，从断点继续
 * 翻译由外部 AI（Cron Job 子智能体）在脚本执行后完成并写回
 * 优先级：NeurIPS 2024 → 2023 → 2022 → 2021 → ...
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_DIR = process.env.REPO_DIR || '/tmp/ElephantPaper';
const INDEX_DIR = path.join(REPO_DIR, 'index');
const DATA_DIR = path.join(REPO_DIR, 'data');
const STATS_FILE = path.join(INDEX_DIR, 'stats.json');
const ALL_INDEX_FILE = path.join(INDEX_DIR, 'all-index.json');
const PENDING_TRANSLATE_FILE = path.join(INDEX_DIR, 'pending_translate.json');
const BATCH_SIZE = 30;
const SS_DELAY_MS = 1200;

const COLLECT_QUEUE = [
  // 2024 顶会优先级顺序
  { conference: 'NeurIPS', year: 2024, method: 'openreview', invitation: 'NeurIPS.cc/2024/Conference/-/Submission' },
  { conference: 'ICLR', year: 2024, method: 'openreview', invitation: 'ICLR.cc/2024/Conference/-/Submission' },
  { conference: 'ICML', year: 2024, method: 'openreview', invitation: 'ICML.cc/2024/Conference/-/Submission' },
  { conference: 'CVPR', year: 2024, method: 'dblp', dblpVenue: 'CVPR 2024' },
  { conference: 'ECCV', year: 2024, method: 'dblp', dblpVenue: 'ECCV 2024' },
  { conference: 'ACL', year: 2024, method: 'dblp', dblpVenue: 'ACL 2024' },
  { conference: 'EMNLP', year: 2024, method: 'dblp', dblpVenue: 'EMNLP 2024' },
  // 2023 备选
  { conference: 'NeurIPS', year: 2023, method: 'openreview', invitation: 'NeurIPS.cc/2023/Conference/-/Submission' },
  { conference: 'ICLR', year: 2023, method: 'openreview', invitation: 'ICLR.cc/2023/Conference/-/Submission' },
  { conference: 'ICML', year: 2023, method: 'openreview', invitation: 'ICML.cc/2023/Conference/-/Submission' },
  // 2022 及 2021（DBLP）
  { conference: 'NeurIPS', year: 2022, method: 'dblp', dblpVenue: 'NeurIPS 2022' },
  { conference: 'ICLR', year: 2022, method: 'dblp', dblpVenue: 'ICLR 2022' },
  { conference: 'ICML', year: 2022, method: 'dblp', dblpVenue: 'ICML 2022' },
  { conference: 'NeurIPS', year: 2021, method: 'dblp', dblpVenue: 'NeurIPS 2021' },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function curlGet(url, timeoutSec = 20) {
  try {
    return execSync(
      `curl -sL --max-time ${timeoutSec} -H "User-Agent: ElephantPaper/3.0" "${url}"`,
      { encoding: 'utf8', timeout: (timeoutSec + 5) * 1000 }
    );
  } catch (e) { return null; }
}

function loadStats() {
  if (fs.existsSync(STATS_FILE)) {
    const stats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    // 确保所有队列中的任务都有进度记录（向前兼容）
    COLLECT_QUEUE.forEach(q => {
      const key = `${q.conference}_${q.year}`;
      if (!stats.progress[key]) {
        stats.progress[key] = { offset: 0, collected: 0, done: false };
      }
    });
    return stats;
  }
  const stats = { progress: {}, totalCollected: 0, totalTranslated: 0, lastUpdated: null };
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
  return fs.existsSync(ALL_INDEX_FILE) ? JSON.parse(fs.readFileSync(ALL_INDEX_FILE, 'utf8')) : [];
}

function saveAllIndex(index) {
  fs.writeFileSync(ALL_INDEX_FILE, JSON.stringify(index, null, 2));
}

function normTitle(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

function getVal(obj, field) {
  const v = (obj || {})[field];
  return (typeof v === 'object' && v !== null && 'value' in v) ? v.value : (v || '');
}

function querySemanticScholar(title) {
  try {
    const q = encodeURIComponent(title.slice(0, 80));
    const raw = curlGet(`https://api.semanticscholar.org/graph/v1/paper/search?query=${q}&limit=1&fields=citationCount,year,externalIds`, 12);
    if (!raw) return { citationCount: 0, arxivId: null };
    const data = JSON.parse(raw);
    if (data.code === '429') return { citationCount: -1, arxivId: null };
    const p = data.data?.[0];
    return { citationCount: p?.citationCount || 0, arxivId: p?.externalIds?.ArXiv || null };
  } catch (e) { return { citationCount: 0, arxivId: null }; }
}

function queryArxivAbstract(title) {
  try {
    const q = encodeURIComponent(`ti:"${title.slice(0, 60)}"`);
    const raw = curlGet(`https://export.arxiv.org/api/query?search_query=${q}&max_results=1`, 15);
    if (!raw) return { abstract: '', arxivId: null };
    const abMatch = raw.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);
    const idMatch = raw.match(/<id>https?:\/\/arxiv\.org\/abs\/([\d.]+)/);
    return {
      abstract: abMatch ? abMatch[1].trim().replace(/\s+/g, ' ').slice(0, 2000) : '',
      arxivId: idMatch ? idMatch[1] : null,
    };
  } catch (e) { return { abstract: '', arxivId: null }; }
}

function isHighQuality(venue, citationCount) {
  if (/oral|spotlight/i.test(String(venue))) return true;
  if (citationCount >= 50) return true;
  return false;
}

function buildRecord(source, note, conference, year, citationCount, arxivId, arxivAbstract) {
  const c = note.content || {};
  const title    = getVal(c, 'title');
  const abstract = source === 'openreview' ? String(getVal(c, 'abstract')).slice(0, 2000) : (arxivAbstract || '');
  const authors  = getVal(c, 'authors');
  const keywords = getVal(c, 'keywords');
  const venue    = source === 'openreview' ? getVal(c, 'venue') : `${conference} ${year}`;
  const tldr     = getVal(c, 'TLDR') || getVal(c, 'tldr') || '';
  const isDetailed = isHighQuality(venue, citationCount);
  const paperId  = note.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
  const dblpId   = (note.externalIds || []).find(id => id && id.startsWith('dblp:'));

  return {
    paperId,
    record: {
      id: paperId, or_id: note.id,
      title, title_zh: '',
      authors: Array.isArray(authors) ? authors : [String(authors)],
      conference, year, venue,
      abstract, abstract_zh: '',
      tldr: String(tldr).slice(0, 300),
      keywords: Array.isArray(keywords) ? keywords : [],
      links: {
        openreview: source === 'openreview' ? `https://openreview.net/forum?id=${note.id}` : null,
        arxiv: arxivId ? `https://arxiv.org/abs/${arxivId}` : null,
        dblp: dblpId ? `https://dblp.org/rec/${dblpId.replace('dblp:', '')}.html` : null,
        pdf: source === 'openreview' ? (c.pdf?.value ? `https://openreview.net${c.pdf.value}` : null) : (getVal(c, 'pdf') || null),
      },
      citationCount, isHighQuality: isDetailed,
      sections: isDetailed
        ? { note: 'Detailed extraction pending', method_summary: String(tldr || abstract).slice(0, 400) }
        : { method_summary: String(tldr || abstract).slice(0, 300) },
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
  // 本批新增的待翻译条目（输出给 Cron Job AI 处理）
  const pendingTranslate = fs.existsSync(PENDING_TRANSLATE_FILE)
    ? JSON.parse(fs.readFileSync(PENDING_TRANSLATE_FILE, 'utf8'))
    : [];
  const newPending = [];
  let ssRateLimited = false;

  for (const task of COLLECT_QUEUE) {
    if (collected >= BATCH_SIZE) break;

    const key = `${task.conference}_${task.year}`;
    if (!stats.progress[key]) stats.progress[key] = { offset: 0, collected: 0, done: false };
    const progress = stats.progress[key];
    if (progress.done) continue;

    const remaining = BATCH_SIZE - collected;
    const plural = BATCH_SIZE > 1 ? 's' : '';
    console.log(`\n📚 [${key}] 采集 ${task.conference} ${task.year} (${task.method})，已收 ${progress.collected} 篇，offset=${progress.offset}，拟采 ${Math.min(remaining, remaining)} 篇`);

    let notes = [];
    if (task.method === 'openreview') {
      const url = `https://api2.openreview.net/notes?invitation=${encodeURIComponent(task.invitation)}&limit=${remaining}&offset=${progress.offset}`;
      const raw = curlGet(url);
      if (!raw) { console.warn('  ⚠️ API 请求失败'); continue; }
      try { notes = JSON.parse(raw).notes || []; } catch (e) { continue; }
    } else if (task.method === 'dblp') {
      const url = `https://api2.openreview.net/notes?invitation=DBLP.org%2F-%2FRecord&content.venue=${encodeURIComponent(task.dblpVenue)}&limit=${remaining}&offset=${progress.offset}`;
      const raw = curlGet(url);
      if (!raw) { console.warn('  ⚠️ DBLP API 请求失败'); continue; }
      try { notes = JSON.parse(raw).notes || []; } catch (e) { continue; }
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
      if (existingTitles.has(normTitle(title))) continue;

      let citationCount = 0, arxivId = null, arxivAbstract = '';

      if (!ssRateLimited) {
        const ss = querySemanticScholar(title);
        if (ss.citationCount === -1) { ssRateLimited = true; console.log('  ⚠️ SS 限流'); }
        else { citationCount = ss.citationCount; arxivId = ss.arxivId; await sleep(SS_DELAY_MS); }
      }

      if (task.method === 'dblp') {
        const ax = queryArxivAbstract(title);
        arxivAbstract = ax.abstract;
        if (!arxivId && ax.arxivId) arxivId = ax.arxivId;
      }

      const { paperId, record } = buildRecord(
        task.method === 'openreview' ? 'openreview' : 'dblp',
        note, task.conference, task.year, citationCount, arxivId, arxivAbstract
      );

      const dir = path.join(DATA_DIR, task.conference, String(task.year));
      fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, `${paperId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(record, null, 2));

      // 加入待翻译队列（abstract 不为空才加）
      if (record.abstract && record.abstract.length > 20) {
        newPending.push({
          id: paperId,
          filePath: filePath.replace(REPO_DIR + '/', ''), // 相对路径
          conference: task.conference,
          year: task.year,
          title: record.title,
          abstract: record.abstract.slice(0, 800),
        });
      }

      newEntries.push({
        id: paperId, title: record.title, title_zh: '',
        authors: record.authors.slice(0, 3),
        conference: record.conference, year: record.year, venue: record.venue,
        keywords: record.keywords.slice(0, 5),
        citationCount, isHighQuality: record.isHighQuality,
        links: { openreview: record.links.openreview, arxiv: record.links.arxiv },
      });
      existingTitles.add(normTitle(title));
      collected++;

      const badge = record.isHighQuality ? '🔴' : '🔵';
      console.log(`  ${badge} [${collected}] ${title.slice(0, 58)} (cit:${citationCount})`);
    }

    progress.offset += notes.length;
    progress.collected = (progress.collected || 0) + collected;
  }

  // 保存待翻译队列（新增追加，最多保留 200 条未翻译）
  const allPending = [...pendingTranslate, ...newPending].slice(-200);
  fs.writeFileSync(PENDING_TRANSLATE_FILE, JSON.stringify(allPending, null, 2));

  allIndex.push(...newEntries);
  saveAllIndex(allIndex);
  stats.totalCollected = (stats.totalCollected || 0) + collected;
  saveStats(stats);

  // 输出待翻译摘要给 AI（供 Cron Job 的子智能体翻译）
  if (newPending.length > 0) {
    console.log('\nTRANSLATE_PENDING:' + JSON.stringify(newPending));
  }

  console.log(`\n✅ 本批完成：${collected} 篇，累计 ${stats.totalCollected} 篇，待翻译 ${allPending.length} 条`);
  return collected;
}

collectBatch().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
