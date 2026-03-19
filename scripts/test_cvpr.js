#!/usr/bin/env node

const { execSync } = require('child_process');

function curlGet(url, timeoutSec = 30) {
  try {
    return execSync(
      `curl -sL --max-time ${timeoutSec} -H "User-Agent: ElephantPaper/4.0" "${url}"`,
      { encoding: 'utf8', timeout: (timeoutSec + 5) * 1000 }
    );
  } catch (e) { 
    console.error(`curl失败: ${e.message}`);
    return null; 
  }
}

// 测试Semantic Scholar API
console.log('测试Semantic Scholar API...');
const ssUrl = 'https://api.semanticscholar.org/graph/v1/paper/search?query=CVPR%202024&limit=1&fields=title,authors,year,venue,citationCount,externalIds,abstract';
const ssRaw = curlGet(ssUrl, 15);
if (ssRaw) {
  console.log('Semantic Scholar响应:', JSON.parse(ssRaw));
} else {
  console.log('Semantic Scholar请求失败');
}

// 测试Arxiv API
console.log('\n测试Arxiv API...');
const arxivUrl = 'https://export.arxiv.org/api/query?search_query=all:cvpr%202024&max_results=1&sortBy=relevance&sortOrder=descending';
const arxivRaw = curlGet(arxivUrl, 15);
if (arxivRaw) {
  const titleMatch = arxivRaw.match(/<title[^>]*>([\s\S]*?)<\/title>/);
  const abMatch = arxivRaw.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);
  console.log('Arxiv结果 - 标题:', titleMatch ? titleMatch[1] : '未找到');
  console.log('摘要头100字符:', abMatch ? abMatch[1].trim().slice(0, 100) + '...' : '未找到');
} else {
  console.log('Arxiv请求失败');
}