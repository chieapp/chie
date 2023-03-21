import crypto from 'node:crypto';
import WebSocket from 'ws';
import APIEndpoint, {APIEndpointType} from '../../model/api-endpoint';
import ChatService, {
  ChatRole,
  ChatMessage,
  ChatResponse,
} from '../../model/chat-service';
import {
  sydneyWebSocketUrl,
  chatArgument,
  edgeBrowserHeaders,
} from './bing-env';

const nullChar = '';

export default class BingChatService extends ChatService {
  #ws?: WebSocket;
  #lastResponse?: ChatResponse;
  #session?: {
    conversationId: string,
    clientId: string,
    conversationSignature: string,
  };

  constructor(endpoint: APIEndpoint) {
    if (endpoint.type != APIEndpointType.BingChat)
      throw new Error('Expect BingChat API endpoint in BingChatService.');
    super(endpoint);
  }

  async sendMessageImpl(message, options) {
    if (message.role != ChatRole.User)
      throw new Error('BingChat only supports sending message as user.');

    // Close disconnected WebSocket.
    if (this.#ws && this.#ws.readyState != WebSocket.OPEN)
      this.#closeWebSocket();

    if (!this.#session)
      await this.#createConversation(options);
    if (!this.#ws)
      await this.#createWebSocketConnection();
    await this.#sendMessageToWebSocket(message);
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

  #createWebSocketConnection(): Promise<void> {
    return (new Promise<void>((resolve, reject) => {
      this.#ws = new WebSocket(sydneyWebSocketUrl);
      this.#ws.once('error', (error) => {
        reject(new Error(`Connection error: ${error}`));
      });
      this.#ws.once('open', () => {
        this.#ws.send(`{"protocol":"json","version":1}${nullChar}`);
        resolve();
      });
    })).finally(() => {
      this.#ws.removeAllListeners();
    });
  }

  #sendMessageToWebSocket(message: ChatMessage): Promise<void> {
    return (new Promise<void>((resolve, reject) => {
      this.#ws.once('error', (error) => {
        reject(new Error(`Connection error: ${error}`));
      });
      this.#ws.on('message', (data) => {
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
            if (this.#lastResponse) {
              // Finished.
              this.#lastResponse.pending = false;
              this.handlePartialMessage({}, this.#lastResponse);
              this.#lastResponse = null;
            } else {
              // Did not receive any answer, Bing cut off our conversation.
              this.#closeWebSocket();
              this.handlePartialMessage({}, {
                id: '',
                filtered: false,
                pending: false,
              });
            }
            resolve();
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
      this.#ws.send(`${JSON.stringify(params)}${nullChar}`);
    })).finally(() => {
      this.#ws.removeAllListeners();
    });
  }

  #handlePayload(payload: object): Partial<ChatMessage> {
    // We don't support special messages.
    if (payload['messageType'])
      return;

    // We assume all messages are from bot.
    if (payload['author'] != 'bot')
      throw new Error(`Unrecognized author in chat: ${payload['author']}`);

    if (this.#lastResponse?.id != payload['messageId']) {
      if (this.#lastResponse?.id)
        throw new Error('Received new message while current message is not done');
      this.#lastResponse = {
        id: payload['messageId'],
        filtered: false,
        pending: true,
      };
    }

    const message: Partial<ChatMessage> = {};
    if (!this.pendingMessage || !this.pendingMessage.role)
      message.role = ChatRole.Assistant;
    if (payload['text']) {
      // BingChat always return full text, while we want only deltas.
      if (!this.pendingMessage || !this.pendingMessage.content)
        message.content = payload['text'];
      else
        message.content = payload['text'].substr(this.pendingMessage.content.length);
    }
    if (!message.role && !message.content)  // empty delta
      return;
    if (payload['offense'] == 'OffenseTrigger')
      this.#lastResponse.filtered = true;
    this.handlePartialMessage(message, this.#lastResponse);
  }

  #closeWebSocket() {
    if (this.#ws) {
      this.#ws.close();
      this.#ws = null;
    }
  }
}
