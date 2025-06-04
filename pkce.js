const crypto = require('crypto');
const axios = require('axios');
const readline = require('readline');
require('dotenv').config();

let CODE_VERIFIER = crypto.randomBytes(32).toString('hex');
const CODE_CHALLENGE = CODE_VERIFIER; // VK supports only 'plain'

const {
  VK_CLIENT_ID,
  VK_REDIRECT_URI,
  VK_SCOPE
} = process.env;

function getAuthUrl() {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: VK_CLIENT_ID,
    redirect_uri: VK_REDIRECT_URI,
    scope: VK_SCOPE,
    v: '5.131',
    code_challenge: CODE_CHALLENGE,
    code_challenge_method: 'plain',
    state: 'rss_poster'
  });

  return `https://id.vk.com/authorize?${params.toString()}`;
}

async function waitForAuthCode() {
  console.log('Open the following URL in your browser:\n');
  console.log(getAuthUrl());

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question('\nPaste the "code" parameter from the redirect URL: ', (code) => {
      rl.close();
      resolve(code.trim());
    });
  });
}

async function exchangeCodeForToken(code) {
  const tokenUrl = 'https://id.vk.com/oauth2/token';
  const response = await axios.post(tokenUrl, null, {
    params: {
      grant_type: 'authorization_code',
      client_id: VK_CLIENT_ID,
      redirect_uri: VK_REDIRECT_URI,
      code,
      code_verifier: CODE_VERIFIER,
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  return response.data; // contains access_token, refresh_token, etc.
}

async function getVkAccessToken() {
  const code = await waitForAuthCode();
  const tokenData = await exchangeCodeForToken(code);
  return tokenData.access_token;
}

module.exports = {
  getVkAccessToken
};
