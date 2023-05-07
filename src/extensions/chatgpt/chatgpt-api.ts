import {createParser} from 'eventsource-parser';
import {
  APIEndpoint,
  APIError,
  ChatAPIOptions,
  ChatCompletionAPI,
  ChatMessage,
  ChatResponse,
  ChatRole,
} from 'chie';

export default class ChatGPTAPI extends ChatCompletionAPI {
  constructor(endpoint: APIEndpoint) {
    if (endpoint.type != 'ChatGPT API')
      throw new Error('Expect ChatGPT API endpoint in ChatGPTAPI.');
    super(endpoint);
  }

  async sendConversation(history: ChatMessage[], options?: ChatAPIOptions) {
    // Start request.
    const headers = {'Content-Type': 'application/json'};
    if (this.endpoint.key)
      headers['Authorization'] = `Bearer ${this.endpoint.key}`;
    const response = await fetch(this.endpoint.url, {
      body: JSON.stringify({
        // API reference:
        // https://platform.openai.com/docs/api-reference/chat/create
        model: this.getParam('model'),
        stream: true,
        messages: history.map(m => ({
          role: m.role.toString().toLowerCase(),
          content: m.content,
        })),
      }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.endpoint.key}`,
      },
      signal: options?.signal,
    });

    // API error happened.
    if (response.status != 200) {
      const body = await response.json();
      if (!body.error)
        throw new APIError(`Unexpected open from ChatGPT API: ${body}`);
      throw new APIError(body.error.message);
    }

    // Parse server sent event (SSE).
    const state = {firstDelta: true};
    const parser = createParser(this.#parseMessage.bind(this, state, options));
    const decoder = new TextDecoder();
    for await (const chunk of bodyToIterator(response.body)) {
      parser.feed(decoder.decode(chunk));
    }
  }

  #parseMessage(state, options, message) {
    if (!message.data)
      throw new APIError(`Unexpected message from ChatGPT API: ${message}`);
    // ChatGPT sends [DONE] when streaming message is finished.
    if (message.data == '[DONE]')
      return;
    // Simple validation.
    const data = JSON.parse(message.data);
    if (data.object != 'chat.completion.chunk' ||
        !Array.isArray(data.choices) ||
        data.choices.length != 1)
      throw new APIError(`Unexpected data from ChatGPT API: ${message.data}`);
    const choice = data.choices[0];
    // Parse the finish_reason.
    const response: ChatResponse = {pending: false, id: data.id};
    switch (choice.finish_reason) {
      case 'stop':  // all delta received, no more action
      case 'length':  // ignored for now
        break;
      case null:
        response.pending = true;
        break;
      case 'content_filter':
        response.filtered = true;
        break;
      default:
        throw new APIError(`Unknown finish_reason: ${choice.finish_reason}`);
    }
    // Build the message from delta.
    const delta: Partial<ChatMessage> = {};
    if (choice.delta.content)
      delta.content = choice.delta.content;
    // Beginning of content may include some white spaces.
    if (delta.content && state.firstDelta) {
      delta.content = delta.content.trimLeft();
      state.firstDelta = false;
    }
    if (choice.delta.role) {
      const key = capitalize(choice.delta.role) as keyof typeof ChatRole;
      delta.role = ChatRole[key];
    }
    // ChatService will handle the rest.
    options.onMessageDelta(delta, response);
  }
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
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
