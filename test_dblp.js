#!/usr/bin/env node
const { execSync } = require('child_process');

function curlGet(url) {
  try {
    return execSync(
      `curl -sL --max-time 20 "${url}"`,
      { encoding: 'utf8', timeout: 25000 }
    );
  } catch (e) { 
    console.error(`curl error: ${e.message}`);
    return null; 
  }
}

// 测试 DBLP API
const dblpVenue = 'CVPR 2024';
const url = `https://api2.openreview.net/notes?invitation=DBLP.org%2F-%2FRecord&content.venue=${encodeURIComponent(dblpVenue)}&limit=5&offset=0`;

console.log(`Testing DBLP API URL: ${url}`);
const raw = curlGet(url);
if (raw) {
  console.log(`Response length: ${raw.length} chars`);
  try {
    const data = JSON.parse(raw);
    console.log(`Response parsed successfully`);
    console.log(`Number of notes: ${data.notes ? data.notes.length : 0}`);
    if (data.notes && data.notes.length > 0) {
      console.log(`First note: ${JSON.stringify(data.notes[0], null, 2).slice(0, 500)}...`);
    }
  } catch (e) {
    console.error(`JSON parse error: ${e.message}`);
    console.log(`Response preview: ${raw.slice(0, 500)}...`);
  }
} else {
  console.log('No response from DBLP API');
}