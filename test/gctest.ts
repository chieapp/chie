import gui from 'gui';

import APIEndpoint from '../src/model/api-endpoint';
import ChatGPTService from '../src/service/chatgpt/chatgpt-service';
import ChatView from '../src/view/chat-view';
import {addFinalizer, gcUntil} from './util';

// Tests in this file take very long time to run, so we do not run them as
// normal tests with mocha.

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
  const service = new ChatGPTService({endpoint});
  return new ChatView(service);
}
