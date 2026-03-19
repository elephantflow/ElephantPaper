#!/usr/bin/env node

// 测试DBLP API访问
const { execSync } = require('child_process');

function curlGet(url) {
  try {
    return execSync(
      `curl -sL --max-time 20 "${url}"`,
      { encoding: 'utf8', timeout: 25000 }
    );
  } catch (e) { return null; }
}

// 测试多个可能的DBLP端点
const endpoints = [
  'https://api2.openreview.net/notes?invitation=DBLP.org%2F-%2FRecord&content.venue=CVPR%202024&limit=1',
  'https://api2.openreview.net/notes?invitation=DBLP.org%2F-/Record&content.venue=CVPR%202024&limit=1',
  'https://api2.openreview.net/notes?invitation=DBLP.org/-/Record&content.venue=CVPR%202024&limit=1',
];

console.log('测试DBLP API端点...');
let found = false;
for (let i = 0; i < endpoints.length; i++) {
  console.log(`\n尝试端点 ${i + 1}: ${endpoints[i]}`);
  const raw = curlGet(endpoints[i]);
  if (raw) {
    console.log(`响应长度: ${raw.length}`);
    if (raw.length < 500) console.log(`响应: ${raw}`);
    
    try {
      const data = JSON.parse(raw);
      console.log('成功解析JSON');
      console.log('数据:', data);
      found = data.notes && data.notes.length > 0;
      if (found) break;
    } catch (e) {
      console.log('无法解析JSON，可能是错误信息');
    }
  } else {
    console.log('无响应');
  }
}

if (!found) {
  console.log('\n⚠️ DBLP API无法访问，尝试OpenReview替代方法');
  
  // 尝试寻找CVPR/ICCV在OpenReview中的对应invitation
  const orTest = curlGet('https://api2.openreview.net/notes?invitation=CVPR.org/2024/Conference/-/Submission&limit=1');
  console.log('OpenReview测试:', orTest?.substring(0, 200) || '无响应');
}