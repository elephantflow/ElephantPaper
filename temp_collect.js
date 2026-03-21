#!/usr/bin/env node
/**
 * 临时采集脚本 - 尝试从OpenReview获取2023年会议论文
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BATCH_SIZE = 10;

const TEMP_TASKS = [
  { conference: 'NeurIPS', year: 2023, method: 'openreview', invitation: 'NeurIPS.cc/2023/Conference/-/Submission' },
  { conference: 'ICLR', year: 2023, method: 'openreview', invitation: 'ICLR.cc/2023/Conference/-/Submission' },
  { conference: 'ICML', year: 2023, method: 'openreview', invitation: 'ICML.cc/2023/Conference/-/Submission' },
];

function curlGet(url, timeoutSec = 20) {
  try {
    return execSync(
      `curl -sL --max-time ${timeoutSec} -H "User-Agent: ElephantPaper/3.0" "${url}"`,
      { encoding: 'utf8', timeout: (timeoutSec + 5) * 1000 }
    );
  } catch (e) { 
    console.error(`curl error: ${e.message}`);
    return null; 
  }
}

async function main() {
  for (const task of TEMP_TASKS) {
    console.log(`\n📚 尝试采集 ${task.conference} ${task.year}`);
    
    const url = `https://api2.openreview.net/notes?invitation=${encodeURIComponent(task.invitation)}&limit=${BATCH_SIZE}&offset=0`;
    console.log(`API URL: ${url}`);
    
    const raw = curlGet(url);
    if (!raw) {
      console.log('  ⚠️ API 请求失败');
      continue;
    }
    
    try {
      const response = JSON.parse(raw);
      console.log(`API响应: ${JSON.stringify(response).slice(0, 200)}...`);
      const notes = response.notes || [];
      console.log(`  找到 ${notes.length} 篇论文`);
      
      if (notes.length > 0) {
        // 检查第一篇文章的信息
        const first = notes[0];
        const content = first.content || {};
        const title = content.title || content.title?.value || '无标题';
        console.log(`  示例: "${title.slice(0, 50)}..."`);
        
        // 检查是否有PDF链接
        const pdf = content.pdf || content.pdf?.value || '无PDF';
        console.log(`  PDF: ${pdf}`);
      }
    } catch (e) {
      console.error(`JSON解析错误: ${e.message}`);
      console.log(`原始响应: ${raw.slice(0, 200)}...`);
    }
  }
}

main().catch(err => {
  console.error('错误:', err);
});