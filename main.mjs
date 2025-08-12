import axios from 'axios';
import * as cheerio from 'cheerio';
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs/promises';

// スタイルからbottomとleftをパースする補助関数
function parsePosition(style) {
  const bottomMatch = style.match(/bottom\s*:\s*(\d+)px/);
  const leftMatch = style.match(/left\s*:\s*(\d+)px/);
  return {
    bottom: bottomMatch ? parseInt(bottomMatch[1], 10) : 0,
    left: leftMatch ? parseInt(leftMatch[1], 10) : 0,
  };
}

async function fetchCharacterList() {
  const url = 'https://wiki.biligame.com/xytx/%E8%A7%92%E8%89%B2%E5%9B%BE%E9%89%B4';
  const res = await axios.get(url);
  const $ = cheerio.load(res.data);

  const characters = [];

  $('.divsort').each((_, charEl) => {
    const layers = [];
    $(charEl).find('div[style*="position: absolute"]').each((_, layerEl) => {
      const style = $(layerEl).attr('style') || '';
      const { bottom, left } = parsePosition(style);

      const imgEl = $(layerEl).find('img').first();
      if (!imgEl) return;

      let imgUrl = imgEl.attr('src');
      if (!imgUrl) return;

      // 画像URLの補正（絶対URLに）
      if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
      else if (imgUrl.startsWith('/')) imgUrl = 'https://patchwiki.biligame.com' + imgUrl;

      const width = parseInt(imgEl.attr('width')) || 0;
      const height = parseInt(imgEl.attr('height')) || 0;

      layers.push({ imgUrl, bottom, left, width, height });
    });

    // キャラ名をdivsort内のテキストやaltから取得（例として最後の絶対位置テキスト）
    const nameEl = $(charEl).find('a').attr('title');
    const name = nameEl.trim() || 'no_name';

    if (layers.length > 0) {
      characters.push({ name, layers });
    }
  });

  return characters;
}

async function composeAndSave(character) {
  const layers = character.layers;
  if (layers.length === 0) return;

  // キャンバスサイズは一番大きい画像のサイズを基準に（今回は最初のレイヤーを基準に）
  const { canvasWidth, canvasHeight, minLeft } = calcCanvasSize(layers);
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  for (const layer of layers) {
    try {
      const img = await loadImage(layer.imgUrl);

      // 左端が0になるように左位置を調整
      const x = layer.left - minLeft;
      // Y座標はcanvas下端が0なので調整
      const y = canvasHeight - layer.bottom - layer.height;

      ctx.drawImage(img, x, y, layer.width, layer.height);
    } catch (e) {
      console.error(`Failed to load image: ${layer.imgUrl}`, e);
    }
  }

  const buffer = canvas.toBuffer('image/png');
  await fs.writeFile(`output/${character.name}.png`, buffer);
  console.log(`Saved image: output/${character.name}.png`);
}


function calcCanvasSize(layers) {
  let minLeft = Infinity;
  let maxRight = -Infinity;
  let minTop = Infinity;
  let maxBottom = -Infinity;

  layers.forEach(({ left, bottom, width, height }) => {
    const top = bottom + height; // bottomは下端からの距離なので、topはそれより上（高さ方向）
    if (left < minLeft) minLeft = left;
    if (left + width > maxRight) maxRight = left + width;
    if (top > maxBottom) maxBottom = top;
    if (bottom < minTop) minTop = bottom; // ここの解釈はあとで調整

    // ※ bottomは「下からの距離」なのでキャンバス原点はtop-leftです。
  });

  // canvas幅・高さは右端-左端、下端-上端で計算
  // ただしbottomは「下からの距離」なので上下の座標変換が必要。
  // より簡単には、下のやり方で計算する場合、キャンバスはmaxBottom×スケール高さで作成し、
  // 描画時に y = canvasHeight - bottom - height で位置を決めるのがベター。

  const canvasWidth = maxRight - minLeft;
  const canvasHeight = maxBottom; // bottomは0～？で高さと同じ単位ならこれで良い

  return { canvasWidth, canvasHeight, minLeft };
}

(async () => {
  const characters = await fetchCharacterList();

  // outputフォルダがなければ作る
  try {
    await fs.mkdir('output');
  } catch { }

  for (const character of characters) {
    await composeAndSave(character);
  }
})();




