import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';

const baseUrl = 'https://wiki.biligame.com';

async function fetchCharacterListUrls() {
  const listUrl = `${baseUrl}/xytx/%E8%A7%92%E8%89%B2%E5%9B%BE%E9%89%B4`;
  const res = await axios.get(listUrl);
  const $ = cheerio.load(res.data);

  const urls = [];
  // 例: 各キャラリンクは <a href="/xytx/キャラ名" ...> にある想定
  $('.divsort a').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.startsWith('/xytx/')) {
      urls.push(baseUrl + href);
    }
  });

  return Array.from(new Set(urls)); // 重複除去
}

async function fetchCharacterDetail(url) {
  const res = await axios.get(url);
  const $ = cheerio.load(res.data);

  // 必要な情報をパース（例）
  const name = $('h1').text().trim();

  // ここは実際のページ構造に合わせて要調整
  const tables = $('table.wikitable');
  let targetTable = null;

  tables.each((_, table) => {
    const $table = $(table);

    // テーブルの中の1行目thのテキストを取得
    const firstTh = $table.find('tr').first().find('th').first().text().trim();

    if (firstTh === '名称') {
      targetTable = $table;
      return false; // ループ終了
    }
  });
  const info = {};
  targetTable.find('tr').each((_, tr) => {
    const $tr = $(tr);
    const key = $tr.find('th').text().trim();
    const val = $tr.find('td').text().trim();
    if (key) {
      info[key] = val;
    }
  });

  return {
    name,
    url,
    info,
  };
}

(async () => {
  const charUrls = await fetchCharacterListUrls();

  const characters = [];
  for (const url of charUrls) {
    try {
      const charData = await fetchCharacterDetail(url);
      characters.push(charData);
      console.log(`Fetched: ${charData.name}`);
    } catch (e) {
      console.error(`Failed to fetch ${url}`, e);
    }
    await sleep(200);
  }

  // JSON保存や他処理へ
  console.log(JSON.stringify(characters, null, 2));
  fs.writeFile('characters.json', JSON.stringify(characters, null, 2))
    .then(() => console.log('Data saved to characters.json'))
    .catch(err => console.error('Error saving data:', err));
})();



function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}