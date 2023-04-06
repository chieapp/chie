import gui from 'gui';

import APIEndpoint from '../src/model/api-endpoint';
import {ChatCompletionAPI} from '../src/model/chat-api';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const addFinalizer: (obj: object, finalizer: () => void) => void = (gui as any).addFinalizer;

export function gcUntil(condition, seconds = 30) {
  return new Promise<void>((resolve, reject) => {
    let count = 0;
    function gcAndCheck() {
      setTimeout(() => {
        count++;
        gc();
        if (condition()) {
          resolve();
        } else if (count < seconds) {
          gcAndCheck();
        } else {
          reject('GC failure');
        }
      }, 1000);
    }
    gc();
    gcAndCheck();
  });
}

class FakeAPI extends ChatCompletionAPI {
  constructor(endpoint) {
    super(endpoint);
  }
  async sendConversation() {
    // Do nothing.
  }
}

export function createChatCompletionAPI() {
  const endpoint = APIEndpoint.deserialize({
    name: 'Wuhanfeiyan',
    type: 'ChatGPT',
    url: '',
    key: '',
  });
  return new FakeAPI(endpoint);
}
