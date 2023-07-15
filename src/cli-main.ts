#!/usr/bin/env node

process.env.YODE_DISABLE_NODE_WARNING = 'true';

import readline from 'node:readline/promises';
import {createSpinner} from 'nanospinner';

import apiManager from './controller/api-manager';
import extensionManager from './controller/extension-manager';
import ChatService, {ChatServiceSupportedAPIs} from './model/chat-service';
import {ChatCompletionAPI, ChatConversationAPI} from './model/chat-api';
import {config} from './controller/configs';
import {matchClass} from './util/object-utils';

cliMain();

async function cliMain() {
  config.addItem('apis', apiManager);

  // The CLI interface is stateless.
  config.inMemory = true;
  config.initFromFileSync();

  extensionManager.activateBuiltinExtensions();

  let endpointName;
  for (let i = 2; i < process.argv.length; ++i) {
    const arg = process.argv[i];
    if (arg == '-h')
      help();
    if (arg == '-l')
      list();
    if (arg == '--endpoint')
      endpointName = process.argv[i + 1];
  }

  // Find an endpoint that supports chat service.
  const endpoint = apiManager.getEndpoints()
    // Only search from chatable endpoints.
    .filter(endpoint => {
      const {apiClass} = apiManager.getAPIRecord(endpoint.type);
      return matchClass(ChatCompletionAPI, apiClass) ||
             matchClass(ChatConversationAPI, apiClass);
    })
    // Return the one matches name.
    .find(endpoint => endpointName ? endpoint.name == endpointName : true);
  if (!endpoint)
    throw new Error('Can not find an API endpoint that supports chatting.');

  // Chat and exit.
  await enterConversation(endpoint);
  process.exit(0);
}

function help() {
  console.log(`
  Usage: chie-cli [flags]

  Options:

    -h                  show help
    -l                  list all API endpoints
    --endpoint <name>   chat with the specified API endpoint
  `);
  process.exit(0);
}

function list() {
  console.log('API Endpoints:');
  for (const endpoint of apiManager.getEndpoints())
    console.log('  ' + endpoint.name);
  process.exit(0);
}

async function enterConversation(endpoint) {
  console.log('Start chatting with', endpoint.name + ':');
  const chat = new ChatService({
    name: endpoint.name,
    api: apiManager.createAPIForEndpoint(endpoint) as ChatServiceSupportedAPIs,
  });

  // Create terminal chat interface.
  let spinner;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  // Print ChatGPT answers with streaming interface.
  let state = 'waitUser';
  chat.onMessageDelta.connect((message, info) => {
    if (spinner) {
      // Clear spinner and print bot name.
      spinner.clear();
      spinner.reset();
      spinner = null;
      process.stdout.write('\x1b[?25h');  // restore cursor
      process.stdout.write(`${chat.name}> `);
    }
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
      spinner = createSpinner().start();
      await chat.sendMessage({content});
    } catch (error) {
      // Ignore abort error.
      if (error.name != 'AbortError')
        throw error;
    }
  }
}
