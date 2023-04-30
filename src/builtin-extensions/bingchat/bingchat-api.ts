import WebSocket from 'ws';
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
  NetworkError,
} from 'chie';

import {
  bingChatURL,
  sydneyWebSocketURL,
  chatArgument,
  edgeBrowserHeaders,
} from './bing-env';

const nullChar = '';

type SessionData = {
  conversationId: string,
  clientId: string,
  conversationSignature: string,
  invocationId: number,
};

export default class BingChatAPI extends ChatConversationAPI<SessionData> {
  #lastContent: string;
  #lastLinks: {name: string, url: string}[];

  constructor(endpoint: APIEndpoint) {
    if (endpoint.type != 'BingChat')
      throw new Error('Expect BingChat API endpoint in BingChatAPI.');
    super(endpoint);
  }

  async sendMessage(text: string, options: ChatAPIOptions) {
    if (!this.session)
      await this.#createConversation(options);
    this.#lastContent = '';
    this.#lastLinks = null;

    const ws = new WebSocket(sydneyWebSocketURL);

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

  async #createConversation(options) {
    const response = await fetch(bingChatURL, {
      signal: options.signal,
      headers: {
        ...edgeBrowserHeaders,
        cookie: this.endpoint.cookie,
      },
    });
    const body = await response.json();
    if (!body.result)
      throw new APIError(`Invalid response when creating conversation: ${body}`);
    if (body.result.value != 'Success')
      throw new APIError(`Unable to create conversation: ${body.result.value} - ${body.result.message}`);
    this.session = body as SessionData;
    this.session.invocationId = 0;
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
          } else if (event.type == 2) {
            // Possible denied service.
            if (event.item.result.value != 'Success') {
              const error = new APIError(event.item.result.message);
              if (event.item.result.value == 'InvalidSession')
                error.code = 'invalid-session';
              reject(error);
              return;
            }
            const message = event.item.messages[event.item.messages.length - 1];
            if (message['hiddenText']?.includes('Conversation disengaged.'))
              reject(new APIError('Conversation disengaged.'));
            else if (event.item.messages.find(m => m.contentOrigin == 'TurnLimiter'))
              reject(new APIError('Chat turn limit has been reached.'));
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
        invocationId: String(this.session.invocationId),
        arguments: [
          {
            ...chatArgument,
            traceId: crypto.randomBytes(16).toString('hex'),
            isStartOfSession: this.session.invocationId == 0,
            message: {
              messageType: 'Chat',
              author: 'user',
              text,
            },
            conversationSignature: this.session.conversationSignature,
            participant: {id: this.session.clientId},
            conversationId: this.session.conversationId,
          },
        ],
      };
      params.arguments[0].optionsSets.push(this.endpoint.params.tone);
      this.session.invocationId += 1;
      ws.send(`${JSON.stringify(params)}${nullChar}`);
    })).finally(() => {
      ws.removeAllListeners();
    });
  }

  #handlePayload(payload: object, options) {
    // We assume all messages are from bot.
    if (payload['author'] != 'bot')
      throw new APIError(`Unrecognized author in chat: ${payload['author']}`);
    const delta: Partial<ChatMessage> = {role: ChatRole.Assistant};

    const messageType = payload['messageType'];
    if (messageType) {
      // Parse internal text.
      if (messageType == 'InternalSearchQuery')
        delta.steps = [ payload['text'] ];
      else  // ignore other internal message for now
        return;
    } else {
      // Parse normal message.
      if (payload['text']) {
        // BingChat always return full text, while we want only deltas.
        delta.content = payload['text'].substr(this.#lastContent.length);
        this.#lastContent = payload['text'];
      }
      // Parse the links attached to the message.
      const sourceAttributions = payload['sourceAttributions'];
      if (Array.isArray(sourceAttributions) && sourceAttributions.length > 0) {
        if (!this.#lastLinks || sourceAttributions.length > this.#lastLinks.length) {
          delta.links = sourceAttributions
            .slice(this.#lastLinks ? this.#lastLinks.length : 0)
            .map(a => ({name: a.providerDisplayName, url: a.seeMoreUrl}));
          this.#lastLinks = sourceAttributions;
        }
      }
    }

    // Skipt empty delta.
    if (!delta.steps && !delta.content && !delta.links && !payload['suggestedResponses'])
      return;

    const response: ChatResponse = {
      pending: true,
      id: payload['messageId'],
      filtered: payload['offense'] == 'OffenseTrigger',
    };

    // We consider suggested replies as resposne instead of message itself,
    // because we don't want to save them in history, and we always remove them
    // after receiving a new message.
    const suggestedResponses = payload['suggestedResponses'];
    if (suggestedResponses && suggestedResponses.length > 0)
      response.suggestedReplies = suggestedResponses.map(s => s.text.trim()).filter(s => s.length > 0);

    options.onMessageDelta(delta, response);
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
