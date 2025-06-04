const Parser = require('rss-parser');
const axios = require('axios');
const fs = require('fs');
const { TwitterApi } = require('twitter-api-v2');
const { getVkAccessToken } = require('./pkce');
const postToPinterests = require('./pin');
const path = require('path');
const os = require('os');
require('dotenv').config();

const parser = new Parser();
const POSTED_FILE = path.join(__dirname, 'posted.json');
const IMG = path.join(__dirname, 'img');

const FB_PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const USER_ACCESS_TOKEN = process.env.USER_ACCESS_TOKEN;

const SOCIALS = ['facebook', 'instagram', 'pinterest', 'vk', 'twitter'];

async function getPostedUrls() {
  let posted = {};

  if (!fs.existsSync(POSTED_FILE)) {
    posted = {};
  } else {
    try {
      const data = fs.readFileSync(POSTED_FILE, 'utf-8');
      posted = JSON.parse(data);
    } catch (e) {
      console.error('❌ Failed to read or parse posted.json:', e.message);
      posted = {};
    }
  }

  // Ensure all social keys are present as arrays
  SOCIALS.forEach(social => {
    if (!Array.isArray(posted[social])) {
      posted[social] = [];
    }
  });

  return posted;
}

async function savePostedUrl(social, url) {
  const posted = await getPostedUrls();

  if (!posted[social]) posted[social] = [];

  if (!posted[social].includes(url)) {
    posted[social].push(url);

    try {
      console.log('Writing to:', POSTED_FILE);
      console.log('Data:', JSON.stringify(posted, null, 2));

      fs.writeFileSync(POSTED_FILE, JSON.stringify(posted, null, 2));
      console.log('✅ Saved to posted.json:', posted);
    } catch (err) {
      console.error('❌ Error writing posted.json:', err.message);
    }
  }
}

async function getPageAccessToken() {
  // console.log('pageId:', FB_PAGE_ID);
  // console.log('userAccessToken:', USER_ACCESS_TOKEN);
  try {
    const response = await axios.get(`https://graph.facebook.com/v22.0/${FB_PAGE_ID}`, {
      params: {
        fields: 'access_token',
        access_token: USER_ACCESS_TOKEN,
      },
    });
    return response.data.access_token;
  } catch (error) {
    //console.error("Failed to fetch page access token:", error?.response?.data || error.message);
    throw new Error("Failed to fetch page access token");
  }
}

async function postToFacebook(title, link) {
  const posted = await getPostedUrls();
  if (posted.facebook.includes(link)) {
    console.log(`Facebook already posted link: ${link}`);
    return false;
  }
  const pageAccessToken = await getPageAccessToken();
  const url = `https://graph.facebook.com/${FB_PAGE_ID}/feed`;
  await axios.post(url, null, {
    params: {
      message: `New post: ${title}`,
      link,
      access_token: pageAccessToken,
    },
  });
  console.log(`Facebook posted with link: ${link}`);
  await savePostedUrl('facebook', link);
  return true
}

async function postToInstagram(imageUrl, caption) {
  const posted = await getPostedUrls();
  if (posted.instagram.includes(caption)) {
    console.log(`Instagram already posted caption: ${caption}`);
    return false;
  }
  const pageAccessToken = await getPageAccessToken();
  const creation = await axios.post(
    `https://graph.facebook.com/v19.0/${process.env.INSTAGRAM_USER_ID}/media`,
    null,
    {
      params: {
        image_url: imageUrl,
        caption,
        access_token: pageAccessToken,
      },
    }
  );
  await axios.post(
    `https://graph.facebook.com/v19.0/${process.env.INSTAGRAM_USER_ID}/media_publish`,
    null,
    {
      params: {
        creation_id: creation.data.id,
        access_token: pageAccessToken,
      },
    }
  );
  console.log(`Instagram posted with caption: ${caption}`);
  await savePostedUrl('instagram', caption);
  return true;
}

async function postToPinterest(imageUrl, title, link, ab) {
  const posted = await getPostedUrls();
  if (posted.pinterest.includes(link)) {
    console.log(`Pinterest already posted link: ${link}`);
    return false;
  }

  const filename = path.basename(new URL(imageUrl).pathname) || 'downloaded.jpg';

  const localFilePath = await downloadImage(imageUrl, filename);

  await postToPinterests({
      imagePath: localFilePath,
      title: title,
      link: link,
      alt_text: title,
      description: title,
      boardName: 'Technology Manias', // Replace this with your actual board name,
      index: ab
    });
  
  fs.readdirSync(folder).forEach(file => {
  const filePath = path.join(folder, file);
  if (fs.lstatSync(filePath).isFile()) {
    fs.unlinkSync(filePath);
  }
});

  // await axios.post(
  //   'https://api.pinterest.com/v5/pins',
  //   {
  //     board_id: process.env.PINTEREST_BOARD_ID,
  //     media_source: {
  //       source_type: 'image_url',
  //       url: imageUrl,
  //     },
  //     title,
  //     alt_text: title,
  //     link,
  //   },
  //   {
  //     headers: {
  //       Authorization: `Bearer ${process.env.PINTEREST_TOKEN}`,
  //       'Content-Type': 'application/json',
  //     },
  //   }
  // );
  console.log(`Pinterest posted with title: ${title}`);
  await savePostedUrl('pinterest', link);
  return true;
}

async function postToVK(message, url) {
  const posted = await getPostedUrls();
  if (posted.vk.includes(url)) {
    console.log(`VK already posted message: ${message}`);
    return;
  }
  const token = await getVkAccessToken();
  const apiUrl = `https://api.vk.com/method/wall.post`;
  await axios.get(apiUrl, {
    params: {
      owner_id: process.env.VK_USER_ID,
      message,
      access_token: token,
      v: '5.131',
    },
  });
  console.log(`VK posted with message: ${message}`);
  await savePostedUrl('vk', url);
}

async function postToTwitter(title, link, imageUrl) {
  const posted = await getPostedUrls();
  if (posted.twitter.includes(link)) {
    console.log(`Twitter already posted link: ${link}`);
    return;
  }
  const twitterClient = new TwitterApi({
    appKey: process.env.TWITTER_APP_KEY,
    appSecret: process.env.TWITTER_APP_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  });

  const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  const mediaId = await twitterClient.v1.uploadMedia(Buffer.from(response.data), { mimeType: 'image/jpeg' });

  await twitterClient.v2.tweet({
    text: `${title} ${link}`,
    media: { media_ids: [mediaId] },
  });
  console.log(`Twitter posted with title and link: ${title} ${link}`);
  await savePostedUrl('twitter', link);
}
async function downloadImage(url, filename) {
  const imgDir = path.join(__dirname, 'img');
  if (!fs.existsSync(imgDir)) {
    fs.mkdirSync(imgDir);
  }

  const filePath = path.join(imgDir, filename);

  const writer = fs.createWriteStream(filePath);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(filePath));
    writer.on('error', reject);
  });
}

async function run() {
  const rssUrls = process.env.RSS_URLS.split(',').map(url => url.trim());
  let ab=0;
  for (const rssUrl of rssUrls) {
    const feed = await parser.parseURL(rssUrl);

    // removed feed.items to fetch older post to be posted
    for (const item of feed.items.slice().reverse()) {
      const { title, link, enclosure } = item;
      const imageUrl = enclosure?.url;

      if (!imageUrl) {
          console.warn(`No valid image for Instagram post: ${title}, image - ${imageUrl} skipping Instagram.`);
          continue;
        }

      // We only post if at least one social hasn't posted the link yet
      const posted = await getPostedUrls();
      const allPosted = SOCIALS.every(s => posted[s]?.includes(link) || false);
      if (allPosted) {
        console.log(`Already posted on all socials: ${link}`);
        continue;
      }

      try {
        const Facebook = await postToFacebook(title, link);
        const Instagram = await postToInstagram(imageUrl, title);
        const Pinterest = await postToPinterest(imageUrl, title, link ,ab);
        // await postToVK(`${title} ${link}`, link);
        // await postToTwitter(title, link, imageUrl);
        if (Pinterest) {
          await savePostedUrl('pinterest', item.link);
        }
        if (Facebook) {
          await savePostedUrl('facebook', item.link);
        }
        if (Instagram) {
          await savePostedUrl('instagram', item.link);
        }

        console.log(`Posted all socials: ${title}`);
      } catch (err) {
          console.error(`Failed to post: ${title}`);

          if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', err.response.data);
          } else {
            console.error('Error:', err.message);
          }
        }
      //break; // Only post first new item per feed
    }
    ab=ab+1;
  }
}

run();
