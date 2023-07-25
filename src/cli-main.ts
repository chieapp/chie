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

  let credentialName;
  for (let i = 2; i < process.argv.length; ++i) {
    const arg = process.argv[i];
    if (arg == '-h')
      help();
    if (arg == '-l')
      list();
    if (arg == '--credential')
      credentialName = process.argv[i + 1];
  }

  // Find an credential that supports chat service.
  const credential = apiManager.getCredentials()
    // Only search from chatable credentials.
    .filter(credential => {
      try {
        const {apiClass} = apiManager.getAPIRecord(credential.type);
        return matchClass(ChatCompletionAPI, apiClass) ||
               matchClass(ChatConversationAPI, apiClass);
      } catch (error) {
        if (error.message.includes('not exist'))
          return false;
        else
          throw error;
      }
    })
    // Return the one matches name.
    .find(credential => credentialName ? credential.name == credentialName : true);
  if (!credential)
    throw new Error('Can not find an API credential that supports chatting.');

  // Chat and exit.
  await enterConversation(credential);
  process.exit(0);
}

function help() {
  console.log(`
  Usage: chie-cli [flags]

  Options:

    -h                    show help
    -l                    list all API credentials
    --credential <name>   chat with the specified API credential
  `);
  process.exit(0);
}

function list() {
  console.log('API Credentials:');
  for (const credential of apiManager.getCredentials())
    console.log('  ' + credential.name);
  process.exit(0);
}

async function enterConversation(credential) {
  console.log('Start chatting with', credential.name + ':');
  const chat = new ChatService({
    name: credential.name,
    api: apiManager.createAPIForCredential(credential) as ChatServiceSupportedAPIs,
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
