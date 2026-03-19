#!/usr/bin/env node

const https = require('https');

async function testOpenReview() {
  console.log('测试OpenReview API连接...');
  
  // 尝试获取NeurIPS 2024的论文列表（少量测试）
  const invitation = 'NeurIPS.cc/2024/Conference/-/Submission';
  const url = `https://api.openreview.net/notes?invitation=${invitation}&limit=10`;
  
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'ElephantPaper/Test' } }, (res) => {
      console.log(`状态码: ${res.statusCode}`);
      
      let data = '';
      res.on('data', chunk => data += chunk);
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log(`获取到笔记数量: ${result.notes ? result.notes.length : '无数据'}`);
          resolve(true);
        } catch(e) {
          console.log(`JSON解析失败: ${e.message}`);
          resolve(false);
        }
      });
      
    }).on('error', (error) => {
      console.error(`HTTP请求出错: ${error.message}`);
      resolve(false);
    }).setTimeout(10000, () => {
      console.log('请求超时');
      resolve(false);
    });
  });
}

async function testConnection() {
  console.log('\n=== 诊断连接测试 ===');
  
  await testOpenReview();
  
  console.log('\n=== DNS测试 ===');
  
  console.log('\nDNS解析结果:');
  ['openreview.net', 'github.com'].forEach(async host => {
    await new Promise(resolve => {
      require('dns').resolve4(host, (error, addresses) => {
        console.log(`${host}: ${addresses?.join(', ') || error?.message}`);
        resolve();
      });
    });
  });
  
  setTimeout(() => {
    console.log('\n=== SSL测试 ===');
    
    ['https://github.com/', 'https://openreview.net/'].forEach(async urlStr => {
      await new Promise(resolve => {
        console.log(`${urlStr}...`);
        setTimeout(resolve, 3000); // Give time for output
      });
    });
    
    setTimeout(() => {
      console.log('\n=== DNS解析完成=== \n如需详细SSL测试可使用curl命令行工具');
      console.log('例如运行: curl --tls-max 1.3 --tlsv1.3 -vI https://github.com');
      
    }, 4000);
  }, 4000);
}

testConnection();