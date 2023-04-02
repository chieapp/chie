import gui from 'gui';

import APIEndpoint from '../src/model/api-endpoint';
import ChatService from '../src/model/chat-service';
import ChatView from '../src/view/chat-view';
import {ChatCompletionAPI} from '../src/model/chat-api';
import {addFinalizer, gcUntil} from './util';

// Tests in this file take very long time to run, so we do not run them as
// normal tests with mocha.

class FakeAPI extends ChatCompletionAPI {
  constructor(endpoint) {
    super(endpoint);
  }
  async sendConversation() {
    // Do nothing.
  }
}

main();

async function main() {
  await testChatView();
  await testChatViewInWindow();
  process.exit(0);
}

async function testChatView() {
  let collected = false;
  (() => {
    const chatView = createChatView();
    addFinalizer(chatView, () => collected = true);
    chatView.unload();
  })();
  await gcUntil(() => collected);
}

async function testChatViewInWindow() {
  let collected = false;
  (() => {
    const win = gui.Window.create({});
    const chatView = createChatView();
    win.setContentView(chatView.view);
    addFinalizer(chatView, () => collected = true);
    chatView.unload();
  })();
  await gcUntil(() => collected);
}

function createChatView() {
  const endpoint = new APIEndpoint({
    name: 'Wuhanfeiyan',
    type: 'ChatGPT',
    url: '',
    key: '',
  });
  const api = new FakeAPI(endpoint);
  const service = new ChatService('Xijinping', api);
  return new ChatView(service);
}
