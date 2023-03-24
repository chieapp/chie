import crypto from 'node:crypto';
import WebSocket from 'ws';
import APIEndpoint, {APIEndpointType} from '../../model/api-endpoint';
import ChatService, {ChatRole, ChatMessage} from '../../model/chat-service';
import {
  sydneyWebSocketUrl,
  chatArgument,
  edgeBrowserHeaders,
} from './bing-env';

const nullChar = '';

class AbortError extends Error {
  name = 'AbortError';
}

export default class BingChatService extends ChatService {
  #ws?: WebSocket;
  #session?: {
    conversationId: string,
    clientId: string,
    conversationSignature: string,
  };

  constructor(endpoint: APIEndpoint) {
    if (endpoint.type != APIEndpointType.BingChat)
      throw new Error('Expect BingChat API endpoint in BingChatService.');
    super(endpoint);
    this.canRegenerate = false;
  }

  async sendMessageImpl(options) {
    const message = this.history[this.history.length - 1];
    if (message.role != ChatRole.User)
      throw new Error('BingChat only supports sending message as user.');

    // Close disconnected WebSocket.
    if (this.#ws && this.#ws.readyState != WebSocket.OPEN)
      this.#closeWebSocket();

    if (!this.#session)
      await this.#createConversation(options);
    if (!this.#ws)
      this.#ws = new WebSocket(sydneyWebSocketUrl);

    // Handle abort signals.
    const handler = this.#closeWebSocket.bind(this);
    if (options.signal)
      options.signal.addEventListener('abort', handler);

    try {
      await this.#createWebSocketConnection(this.#ws, options);
      await this.#sendMessageToWebSocket(this.#ws, message, options);
    } finally {
      if (options.signal)
        options.signal.removeEventListener('abort', handler);
    }
  }

  async #createConversation(options: {signal?: AbortSignal}) {
    const response = await fetch(this.endpoint.url, {
      signal: options.signal,
      headers: {
        ...edgeBrowserHeaders,
        cookie: `_U=${this.endpoint.key}`,
      },
    });
    const body = await response.json();
    if (!body.result)
      throw new Error(`Invalid response when creating conversation: ${body}`);
    if (body.result.value != 'Success')
      throw new Error(`Unable to create conversation: ${body.result.value} - ${body.result.message}`);
    this.#session = body;
  }

  #createWebSocketConnection(ws: WebSocket, options: {signal?: AbortSignal}): Promise<void> {
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

  #sendMessageToWebSocket(ws: WebSocket, message: ChatMessage, options: {signal?: AbortSignal}): Promise<void> {
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
            this.#handlePayload(event.arguments[0].messages[0]);
          } else if (event.type == 3) {
            if (this.lastResponse) {
              // Finished.
              this.lastResponse.pending = false;
              this.handlePartialMessage({}, this.lastResponse);
              resolve();
            } else {
              // Did not receive any answer, Bing cut off our conversation.
              this.#closeWebSocket();
              this.handlePartialMessage({}, {filtered: false, pending: false});
            }
          }
        }
      });
      // Send the message to BingChat.
      const params = {
        type: 4,
        target: 'chat',
        invocationId: String(this.history.length),
        arguments: [
          {
            ...chatArgument,
            traceId: crypto.randomBytes(16).toString('hex'),
            isStartOfSession: this.history.length == 1,
            message: {
              messageType: 'Chat',
              author: 'user',
              text: message.content,
            },
            conversationSignature: this.#session.conversationSignature,
            participant: {id: this.#session.clientId},
            conversationId: this.#session.conversationId,
          },
        ],
      };
      ws.send(`${JSON.stringify(params)}${nullChar}`);
    })).finally(() => {
      ws.removeAllListeners();
    });
  }

  #handlePayload(payload: object): Partial<ChatMessage> {
    // We don't support special messages.
    if (payload['messageType'])
      return;

    // We assume all messages are from bot.
    if (payload['author'] != 'bot')
      throw new Error(`Unrecognized author in chat: ${payload['author']}`);

    const message: Partial<ChatMessage> = {role: ChatRole.Assistant};
    if (payload['text']) {
      // BingChat always return full text, while we want only deltas.
      if (!this.pendingMessage || !this.pendingMessage.content)
        message.content = payload['text'];
      else
        message.content = payload['text'].substr(this.pendingMessage.content.length);
    }
    if (!message.content)  // empty delta
      return;
    this.handlePartialMessage(message, {
      id: payload['messageId'],
      filtered: payload['offense'] == 'OffenseTrigger',
      pending: true,
    });
  }

  #closeWebSocket() {
    if (this.#ws) {
      this.#ws.terminate();
      this.#ws = null;
    }
  }
}

function rejectOnWebSocketError(ws: WebSocket, reject, signal?) {
  ws.once('error', (error) => {
    reject(new Error(`Connection error: ${error}`));
  });
  ws.once('close', () => {
    if (signal?.aborted)
      reject(new AbortError());
    else
      reject(new Error('WebSocket closed without noticing'));
  });
}
