import readline from 'node:readline/promises';

import main from './main';
import apiManager from './controller/api-manager';
import APIEndpoint, {APIEndpointType} from './model/api-endpoint';
import BingChatService from './service/bingchat/bingchat-service';
import ChatGPTService from './service/chatgpt/chatgpt-service';

main();
cliMain();

async function cliMain() {
  const chat = process.argv.includes('--bingchat') ?
    createBingChatService() : createChatGPTService();

  // Create terminal chat interface.
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  // Print ChatGPT answers with streaming interface.
  let state = 'waitUser';
  chat.onMessageDelta.add((message, response) => {
    if (state == 'waitAnswer') {
      // Print content.
      if (message.content)
        process.stdout.write(message.content);
    }
    if (response.pending)  // more messages coming.
      return;
    process.stdout.write('\n');
    state = 'waitUser';
  });
  // Quite on EOF.
  const ac = new AbortController();
  rl.once('close', () => ac.abort());
  // Make user ask question infinitely.
  while (!ac.signal.aborted) {
    if (state != 'waitUser')
      throw new Error('Did not receive an answer.');
    try {
      const content = await rl.question('User> ', {signal: ac.signal});
      state = 'waitAnswer';
      process.stdout.write(`${chat.endpoint.name}> `);
      await chat.sendMessage({content}, {signal: ac.signal});
    } catch (error) {
      // Ignore abort error.
      if (error.name != 'AbortError')
        throw error;
    }
  }
  process.exit(0);
}

function createChatGPTService() {
  // Search for an available endpoint.
  let endpoint: APIEndpoint;
  const available = apiManager.getEndpointsByType(APIEndpointType.ChatGPT);
  if (available.length > 0) {
    endpoint = available[0];
  } else {
    // Create a temporary one from env if not exist.
    if (!process.env['OPENAI_API_KEY']) {
      console.error('Please set the OPENAI_API_KEY with a valid key in it');
      process.exit(1);
    }
    endpoint = new APIEndpoint({
      type: 'ChatGPT',
      name: 'ChatGPT CLI',
      url: 'https://api.openai.com/v1/chat/completions',
      key: process.env['OPENAI_API_KEY'],
      params: {model: 'gpt-3.5-turbo'},
    });
    // Save it.
    apiManager.add(endpoint);
  }

  return new ChatGPTService({endpoint});
}

function createBingChatService() {
  // Search for an available endpoint.
  let endpoint: APIEndpoint;
  const available = apiManager.getEndpointsByType(APIEndpointType.BingChat);
  if (available.length > 0) {
    endpoint = available[0];
  } else {
    // Create a temporary one from env if not exist.
    if (!process.env['BING_COOKIE']) {
      console.error('Please set the BING_COOKIE with a valid cookie in it');
      process.exit(1);
    }
    endpoint = new APIEndpoint({
      type: 'BingChat',
      name: 'BingChat CLI',
      url: 'https://www.bing.com/turing/conversation/create',
      key: process.env['BING_COOKIE'],
    });
    // Save it.
    apiManager.add(endpoint);
  }

  return new BingChatService({endpoint});
}
