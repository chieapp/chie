import crypto from 'node:crypto';
import {
  APIEndpoint,
  APIError,
  AbortError,
  ChatAPIOptions,
  ChatConversationAPI,
  ChatMessage,
  ChatResponse,
  ChatRole,
  Icon,
  NetworkError,
} from 'chie';
import WebSocket from 'ws';
import {sydneyWebSocketUrl, chatArgument, edgeBrowserHeaders} from './bing-env';

const nullChar = '';

export default class BingChatAPI extends ChatConversationAPI {
  #invocationId = 1;
  #lastContent: string = '';
  #session?: {
    conversationId: string,
    clientId: string,
    conversationSignature: string,
  };

  constructor(endpoint: APIEndpoint) {
    if (endpoint.type != 'BingChat')
      throw new Error('Expect BingChat API endpoint in BingChatAPI.');
    super(endpoint);
    this.icon = new Icon({name: 'bingchat'});
  }

  async sendMessage(text: string, options: ChatAPIOptions) {
    if (!this.#session)
      await this.#createConversation(options);

    const ws = new WebSocket(sydneyWebSocketUrl);

    // Handle abort signals.
    const handler = ws.terminate.bind(ws);
    if (options.signal)
      options.signal.addEventListener('abort', handler);

    try {
      await this.#createWebSocketConnection(ws, options);
      await this.#sendMessageToWebSocket(ws, text, options);
      ws.close();
    } catch (error) {
      ws.terminate();
      throw error;
    } finally {
      if (options.signal)
        options.signal.removeEventListener('abort', handler);
    }
  }

  async clear() {
    this.#invocationId = 1;
    this.#lastContent = '';
    this.#session = null;
  }

  async #createConversation(options) {
    const response = await fetch(this.endpoint.url, {
      signal: options.signal,
      headers: {
        ...edgeBrowserHeaders,
        cookie: `_U=${this.endpoint.key}`,
      },
    });
    const body = await response.json();
    if (!body.result)
      throw new APIError(`Invalid response when creating conversation: ${body}`);
    if (body.result.value != 'Success')
      throw new APIError(`Unable to create conversation: ${body.result.value} - ${body.result.message}`);
    this.#session = body;
  }

  #createWebSocketConnection(ws: WebSocket, options): Promise<void> {
    return (new Promise<void>((resolve, reject) => {
      rejectOnWebSocketError(ws, reject, options.signal);
      ws.once('open', () => {
        ws.send(`{"protocol":"json","version":1}${nullChar}`);
        resolve();
      });
    })).finally(() => {
      ws.removeAllListeners();
    });
  }

  #sendMessageToWebSocket(ws: WebSocket, text: string, options): Promise<void> {
    return (new Promise<void>((resolve, reject) => {
      rejectOnWebSocketError(ws, reject, options.signal);
      ws.on('message', (data) => {
        // Handle received messages from BingChat.
        const events = data.toString()
          .split(nullChar)
          .filter(s => s != '')
          .map(s => JSON.parse(s));
        for (const event of events) {
          if (event.type == 1) {
            // Updates.
            if (!event.arguments[0].messages)
              continue;
            this.#handlePayload(event.arguments[0].messages[0], options);
          } else if (event.type == 3) {
            // Finished.
            resolve();
          }
        }
      });
      // Send the message to BingChat.
      const params = {
        type: 4,
        target: 'chat',
        invocationId: String(this.#invocationId),
        arguments: [
          {
            ...chatArgument,
            traceId: crypto.randomBytes(16).toString('hex'),
            isStartOfSession: this.#invocationId == 1,
            message: {
              messageType: 'Chat',
              author: 'user',
              text,
            },
            conversationSignature: this.#session.conversationSignature,
            participant: {id: this.#session.clientId},
            conversationId: this.#session.conversationId,
          },
        ],
      };
      this.#invocationId += 2;
      ws.send(`${JSON.stringify(params)}${nullChar}`);
    })).finally(() => {
      ws.removeAllListeners();
    });
  }

  #handlePayload(payload: object, options) {
    // We don't support special messages.
    if (payload['messageType'])
      return;

    // We assume all messages are from bot.
    if (payload['author'] != 'bot')
      throw new APIError(`Unrecognized author in chat: ${payload['author']}`);

    const delta: Partial<ChatMessage> = {role: ChatRole.Assistant};
    if (payload['text']) {
      // BingChat always return full text, while we want only deltas.
      delta.content = payload['text'].substr(this.#lastContent.length);
      this.#lastContent = payload['text'];
    }
    if (!delta.content)  // empty delta
      return;
    options.onMessageDelta(delta, new ChatResponse({
      id: payload['messageId'],
      filtered: payload['offense'] == 'OffenseTrigger',
      pending: true,
    }));
  }
}

function rejectOnWebSocketError(ws: WebSocket, reject, signal?) {
  ws.once('error', (error) => {
    reject(new NetworkError(`Connection error: ${error.message}`));
  });
  ws.once('close', () => {
    if (signal?.aborted)
      reject(new AbortError());
    else
      reject(new NetworkError('WebSocket closed without noticing'));
  });
}
