import readline from 'node:readline/promises';

import main from './main';
import apiManager from './controller/api-manager';
import APIEndpoint, {APIEndpointType} from './model/api-endpoint';
import {ChatRole} from './model/chat-service';
import ChatGPTService from './service/chatgpt/chatgpt-service';

main();
cliMain();

async function cliMain() {
  // Search for an available endpoint.
  let endpoint: APIEndpoint;
  const available = apiManager.getEndpointsByType(APIEndpointType.ChatGPT);
  if (available.length > 0) {
    endpoint = available[0];
  } else {
    // Create a temporary one from env if not exist.
    if (!process.env['OPENAI_API_KEY']) {
      console.error('Please set the OPENAI_KEY with a valid key in it');
      process.exit(1);
    }
    endpoint = new APIEndpoint({
      type: 'ChatGPT',
      name: 'ChatGPT CLI',
      url: 'https://api.openai.com/v1/chat/completions',
      key: process.env['OPENAI_API_KEY'],
      params: {model: 'gpt-3.5-turbo'},
    });
  }

  // Create terminal chat interface.
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  // Print ChatGPT answers with streaming interface.
  let state = 'waitUser';
  const chatgpt = new ChatGPTService(endpoint);
  chatgpt.onPartialMessage.add((message, response) => {
    if (state == 'waitAnswer') {
      // Print ChatGPT's name.
      if (!message.role)
        throw new Error('First partial message received without role.');
      process.stdout.write('ChatGPT> ');
      state = 'waitContent';
    }
    if (state == 'waitContent') {
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
  rl.on('close', () => ac.abort());
  // Make user ask question infinitely.
  while (!ac.signal.aborted) {
    if (state != 'waitUser')
      throw new Error('sendMessage interrupted before messages are all received.');
    try {
      const content = await rl.question('User> ', {signal: ac.signal});
      state = 'waitAnswer';
      await chatgpt.sendMessage({role: ChatRole.User, content}, {signal: ac.signal});
    } catch (error) {
      // Ignore abort error.
      if (error.name != 'AbortError')
        throw error;
    }
  }
  process.exit(0);
}
