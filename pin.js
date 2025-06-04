const puppeteer = require('puppeteer');
require('dotenv').config();
const sharp = require('sharp');
const path = require('path');

async function createFramedImage(inputPath, outputPath, index) {
  const canvasWidth = 500;
  const canvasHeight = 300;
  let bottomText="";
  switch(index){
    case 0:
        bottomText = 'Technology Manias';
        break;
    case 1:
        bottomText = 'Movies Manias';
        break;
  }

  // Get dimensions of input image
  const inputMeta = await sharp(inputPath).metadata();

  // Calculate centering position
  const left = Math.max(0, Math.floor((canvasWidth - inputMeta.width) / 2));
  const top = Math.max(0, Math.floor((canvasHeight - inputMeta.height) / 2));

  // Create black background canvas
  const background = {
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 }
    }
  };

  // Create text SVG
  const svgText = `
    <svg width="${canvasWidth}" height="40">
      <style>
        .label { fill: white; font-size: 22px; font-family: sans-serif; text-anchor: middle; }
      </style>
      <text x="50%" y="50%" class="label">${bottomText}</text>
    </svg>
  `;

  // Compose canvas + image + text
  await sharp(background)
    .composite([
      { input: inputPath, top, left },
      { input: Buffer.from(svgText), top: canvasHeight - 40, left: 0 }
    ])
    .toFile(outputPath);

  console.log(`Image saved to ${outputPath}`);
}

async function postToPinterest({ imagePath, title, link, description, boardName, index }) {
    let outputImage=null;
    (async () => {
        // const inputImage = path.join(__dirname, 'img', ima);
        outputImage = path.join(__dirname, 'img', 'framed_output.jpg');
        await createFramedImage(imagePath, outputImage, index);
        })();

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://www.pinterest.com/login/', { waitUntil: 'networkidle2' });

  // Log in
  await page.type('input[name="id"]', process.env.PINTEREST_EMAIL);
  await page.type('input[name="password"]', process.env.PINTEREST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  // Navigate to Pin builder
  await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'networkidle2' });

  // Upload image
  const fileInput = await page.$('input[type="file"]');
  await fileInput.uploadFile(outputImage);

  // Wait for image upload to finish
  //await page.waitForSelector('[aria-label="Uploaded image"]', { timeout: 15000 });
  const subtitleSelector = 'div[data-test-id="subtitle"]';

//   // Wait for the subtitle div to appear
//   await page.waitForSelector(subtitleSelector, { timeout: 20000 });

//   // Extract the inner text
//   const subtitleText = await page.$eval(subtitleSelector, el => el.innerText.trim());

//   // Check for "Changes stored!"
//   if (subtitleText.toLowerCase().includes('changes stored')) {
//     console.log('✅ Confirmed: Changes stored!');
    // Fill in title, description, and link
    await page.type('#storyboard-selector-title', title);
    // await page.type('div[role="textbox"]', description);
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.click('div.public-DraftStyleDefault-block');
    await page.keyboard.type(description);
    // await page.type('input[placeholder="Add a destination link"]', link);
    await page.type('#WebsiteField', link);

    // Select board
    // await page.waitForSelector('[data-test-id="board-dropdown-select-button"]', { timeout: 10000 });
    // await page.click('[data-test-id="board-dropdown-select-button"]');

    // Wait for the board list and click the desired board by its name
    // await page.waitForSelector(`[data-test-id="board-dropdown-select-list"]`, { timeout: 10000 });
    // await page.evaluate((name) => {
    //     const items = Array.from(document.querySelectorAll('[data-test-id="board-dropdown-select-list"] div[role="option"]'));
    //     const target = items.find(el => el.textContent.trim() === name);
    //     if (target) target.click();
    // }, boardName);
    // const chooseBoardDiv = await page.$x("//div[text()[normalize-space()='Choose a board']]");
    //     if (chooseBoardDiv.length > 0) {
    //         await chooseBoardDiv[0].click();
    //         await new Promise(resolve => setTimeout(resolve, 2000));
    //         //
    //         const divs = await page.$x("//div[text()[normalize-space()='Technology Manias']]");
    //         if (divs.length > 0) {
    //             await divs[0].click();
    //         } else {
    //             throw new Error("Could not find the div with text 'Technology Manias'");
    //         }
    //         //
    //     } else {
    //         throw new Error("Could not find the 'Choose a board' div");
    //     }
 //await new Promise(resolve => setTimeout(resolve, 4000));
    try{
        await new Promise(resolve => setTimeout(resolve, 2000));
        const dropdowns = await page.$$('div');
        for (const el of dropdowns) {
            const text = await page.evaluate(el => el.textContent.trim(), el);
            //await new Promise(resolve => setTimeout(resolve, 2000));
            if (text === "Choose a board") {
                await el.click();
                await new Promise(resolve => setTimeout(resolve, 2000));
                break;
            }
        }
        //
        const dropdowns2 = await page.$$('div');
        for (const el of dropdowns2) {
            const text = await page.evaluate(el => el.textContent.trim(), el);
            //await new Promise(resolve => setTimeout(resolve, 2000));
            if (text === boardName) {
                await el.click();
                await new Promise(resolve => setTimeout(resolve, 2000));
                break;
            }
        }
    }
    catch(e)
    {
        console.log(e);
    }
    // Publish the pin
    await new Promise(resolve => setTimeout(resolve, 2000));// Small delay for board selection to register
    // await page.click('button:has-text("Publish")');
    const publishDivs = await page.$$('div');

    for (const div of publishDivs) {
    const text = await page.evaluate(el => el.innerText.trim(), div);
    if (text.toLowerCase() === 'publish') {
        await div.click();
        console.log('Clicked the "Publish" button.');
        break;
    }
    }

    console.log(`Pinterest post published to board "${boardName}": ${title}`);

//   } else {
//     console.warn('⚠️ Unexpected subtitle text:', subtitleText);
//   }

  await browser.close();
}

module.exports = postToPinterest;
