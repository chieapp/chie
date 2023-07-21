import crypto from 'node:crypto';

import {createParser} from 'eventsource-parser';
import {
  APIEndpoint,
  APIError,
  ChatAPIOptions,
  ChatConversationAPI,
  ChatMessage,
  ChatRole,
} from 'chie';

interface SessionData {
  // The conversationId is given by server.
  conversationId?: string;
  // Records message IDs, index starts from 1, the 0 index is for root.
  messageIds: string[];
}

export default class ChatGPTWebAPI extends ChatConversationAPI<SessionData> {
  static canRemoveFromServer = true;
  static canRemoveMessagesAfter = true;

  constructor(endpoint: APIEndpoint) {
    if (endpoint.type != 'ChatGPT Web')
      throw new Error('Expect ChatGPT Web API endpoint in ChatGPTWebAPI.');
    super(endpoint);
  }

  async sendMessage(text: string, options: ChatAPIOptions) {
    if (!this.session)
      this.session = {messageIds: [ crypto.randomUUID() ]};

    const messageId = crypto.randomUUID();
    const response = await fetch(this.endpoint.url, {
      body: JSON.stringify({
        action: 'variant',
        model: this.getParam('model'),
        conversation_id: this.session.conversationId,
        parent_message_id: this.session.messageIds[this.session.messageIds.length - 1],
        messages: [ {
          id: messageId,
          role: 'user',
          content: {content_type: 'text', parts: [ text ]},
        } ],
      }),
      method: 'POST',
      headers: this.#getHeaders(),
      signal: options.signal,
    });

    // Error happened.
    if (response.status == 403)
      throw new APIError('Access token expired.', 'refresh');
    if (response.status == 401)
      throw new APIError('Authentication token expired.', 'relogin');
    if (response.status != 200) {
      const detail = (await response.json()).detail;
      if (typeof detail == 'string')
        throw new APIError(detail);
      else
        throw new APIError(JSON.stringify(detail));
    }

    this.session.messageIds.push(messageId);

    // Parse server sent event (SSE).
    const state = {firstDelta: true, lastContent: ''};
    const parser = createParser(this.#parseMessage.bind(this, state, options));
    const decoder = new TextDecoder();
    for await (const chunk of bodyToIterator(response.body)) {
      parser.feed(decoder.decode(chunk));
    }
  }

  async removeFromServer() {
    if (!this.session?.conversationId)
      return;
    const response = await fetch(`${this.endpoint.url}/${this.session.conversationId}`, {
      body: JSON.stringify({is_visible: false}),
      method: 'PATCH',
      headers: this.#getHeaders(),
    });
    await response.json();
  }

  async removeMessagesAfter(index: number) {
    // The index of messageIds starts from 1.
    this.session.messageIds.splice(index + 1);
  }

  #getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'User-Agent': this.getParam('userAgent'),
      Authorization: `Bearer ${this.getParam('token')}`,
      cookie: this.endpoint.cookie,
      referer: 'https://chat.openai.com/',
      authority: 'chat.openai.com',
    };
  }

  #parseMessage(state, options, message) {
    if (message.event == 'ping')
      return;
    if (!message.data)
      throw new APIError(`Unexpected message from ChatGPT API: ${message}`);
    // ChatGPT sends [DONE] when streaming message is finished.
    if (message.data == '[DONE]')
      return;
    const data = JSON.parse(message.data);
    if (data.conversation_id)
      this.session.conversationId = data.conversation_id;
    if (!data.message || data.message.author.role != 'assistant')
      return;
    // Push assistant message ID when seeing first delta.
    if (state.firstDelta) {
      this.session.messageIds.push(data.message.id);
      state.firstDelta = false;
    }
    // Construct assistant message deltas.
    const delta: Partial<ChatMessage> = {role: ChatRole.Assistant};
    const content = data.message.content?.parts[0];
    if (content) {
      delta.content = content.substr(state.lastContent.length);
      state.lastContent = content;
    }
    // ChatService will handle the rest.
    options.onMessageDelta(delta, {
      pending: true,
      id: data.message.id,
    });
  }
}

async function* bodyToIterator<T>(stream: ReadableStream<T>) {
  const reader = stream.getReader();
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done)
        return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}
