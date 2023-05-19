import readline from 'node:readline/promises';

import apiManager from './controller/api-manager';
import APIEndpoint from './model/api-endpoint';
import ChatService from './model/chat-service';
import {ChatConversationAPI} from './model/chat-api';
import {config} from './controller/configs';

cliMain();

async function cliMain() {
  config.addItem('apis', apiManager);

  // The cli interface is stateless.
  config.inMemory = true;
  config.initFromFileSync();

  const endpoint = process.argv.includes('--bingchat') ?
    createBingChat() : createChatGPT();
  const chat = new ChatService({
    name: endpoint.name,
    api: apiManager.createAPIForEndpoint(endpoint) as ChatConversationAPI,
  });

  // Create terminal chat interface.
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  // Print ChatGPT answers with streaming interface.
  let state = 'waitUser';
  chat.onMessageDelta.connect((message, info) => {
    if (state == 'waitAnswer') {
      // Print content.
      if (message.content)
        process.stdout.write(message.content);
    }
    if (info.pending)  // more messages coming.
      return;
    process.stdout.write('\n');
    state = 'waitUser';
  });
  // Quite on EOF.
  rl.once('close', () => chat.abort());
  // Make user ask question infinitely.
  while (!chat.isAborted()) {
    if (state != 'waitUser')
      throw new Error('Did not receive an answer.');
    try {
      const content = await rl.question('You> ', {signal: chat.aborter.signal});
      state = 'waitAnswer';
      process.stdout.write(`${chat.name}> `);
      await chat.sendMessage({content});
    } catch (error) {
      // Ignore abort error.
      if (error.name != 'AbortError')
        throw error;
    }
  }
  process.exit(0);
}

function createChatGPT() {
  // Search for an available endpoint.
  const available = apiManager.getEndpointsByType('ChatGPT');
  if (available.length > 0) {
    return available[0];
  } else {
    // Create a temporary one from env if not exist.
    if (!process.env['OPENAI_API_KEY']) {
      console.error('Please set the OPENAI_API_KEY with a valid key in it');
      process.exit(1);
    }
    return APIEndpoint.deserialize({
      type: 'ChatGPT',
      name: 'ChatGPT',
      url: 'https://api.openai.com/v1/chat/completions',
      key: process.env['OPENAI_API_KEY'],
      params: {model: 'gpt-3.5-turbo'},
    });
  }
}

function createBingChat() {
  // Search for an available endpoint.
  const available = apiManager.getEndpointsByType('BingChat');
  if (available.length > 0) {
    return available[0];
  } else {
    // Create a temporary one from env if not exist.
    if (!process.env['BING_COOKIE']) {
      console.error('Please set the BING_COOKIE with a valid cookie in it');
      process.exit(1);
    }
    return APIEndpoint.deserialize({
      type: 'BingChat',
      name: 'BingChat',
      url: 'https://www.bing.com/turing/conversation/create',
      key: process.env['BING_COOKIE'],
    });
  }
}
