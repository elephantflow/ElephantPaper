#!/usr/bin/env node
// 尝试其他数据源获取CVPR和ICCV论文

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function curlGet(url, opts = '') {
  try {
    return execSync(`curl -sL ${opts} "${url}"`, { encoding: 'utf8', timeout: 30000 });
  } catch (e) { return null; }
}

async function trySources() {
  console.log('尝试访问不同数据源获取CVPR/ICCV论文...');
  
  // 1. 尝试Semantic Scholar搜索
  console.log('\n1. Semantic Scholar搜索CVPR 2024:');
  const ssUrl = 'https://api.semanticscholar.org/graph/v1/paper/search?query=CVPR%202024&limit=5&fields=title,year,venue,abstract';
  const ssResult = curlGet(ssUrl);
  if (ssResult) {
    try {
      const data = JSON.parse(ssResult);
      console.log(`找到 ${data.total || 0} 篇论文`);
      if (data.data && data.data.length > 0) {
        data.data.forEach(p => {
          console.log(` - ${p.title} (${p.venue}, ${p.year})`);
        });
      }
    } catch (e) {
      console.log('解析失败');
    }
  }
  
  // 2. 尝试OpenAlex搜索
  console.log('\n2. OpenAlex搜索CVPR (计算机视觉论文):');
  const oaUrl = 'https://api.openalex.org/works?filter=concepts.id:C41078148,publication_year:2024&per-page=5&select=title,publication_year,primary_location,abstract_inverted_index';
  const oaResult = curlGet(oaUrl);
  if (oaResult) {
    try {
      const data = JSON.parse(oaResult);
      console.log(`找到 ${data.meta.count || 0} 篇计算机视觉论文`);
      if (data.results && data.results.length > 0) {
        data.results.forEach(w => {
          console.log(` - ${w.title} (${w.publication_year})`);
        });
      }
    } catch (e) {
      console.log('解析失败');
    }
  }
  
  // 3. 尝试arXiv搜索CVPR相关论文
  console.log('\n3. arXiv搜索CVPR相关论文:');
  const arxivUrl = 'http://export.arxiv.org/api/query?search_query=ti:CVPR%20AND%20cat:cs.CV&start=0&max_results=5';
  const arxivResult = curlGet(arxivUrl);
  if (arxivResult) {
    console.log(`arXiv响应长度: ${arxivResult.length}`);
    // 简单提取标题
    const matches = arxivResult.match(/<title>([^<]+)<\/title>/g);
    if (matches) {
      matches.slice(1, 6).forEach((match, i) => {
        const title = match.replace(/<\/?title>/g, '');
        console.log(` - ${title}`);
      });
    }
  }
  
  // 4. 尝试直接访问CVPR官方站点（查看是否能获取列表）
  console.log('\n4. 访问CVPR官网:');
  const cvprUrl = 'https://cvpr.thecvf.com/';
  const cvprResult = curlGet(cvprUrl, '--max-time 10');
  if (cvprResult && cvprResult.length > 100) {
    console.log('成功访问CVPR官网');
    // 尝试查找论文相关信息
    if (cvprResult.includes('paper') || cvprResult.includes('Paper')) {
      console.log('网站包含论文相关信息');
    }
  }
}

trySources();