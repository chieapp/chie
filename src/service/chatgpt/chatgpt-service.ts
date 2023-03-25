import {createParser} from 'eventsource-parser';
import APIEndpoint, {APIEndpointType} from '../../model/api-endpoint';
import ChatService, {ChatRole, ChatMessage, ChatResponse} from '../../model/chat-service';
import {APIError, NetworkError} from '../../model/errors';

export default class ChatGPTService extends ChatService {
  constructor(endpoint: APIEndpoint) {
    if (endpoint.type != APIEndpointType.ChatGPT)
      throw new Error('Expect ChatGPT API endpoint in ChatGPTService.');
    super(endpoint);
  }

  async sendMessageImpl(options) {
    // Start request.
    const response = await fetch(this.endpoint.url, {
      body: JSON.stringify({
        // API reference:
        // https://platform.openai.com/docs/api-reference/chat/create
        model: this.endpoint.params.model,
        stream: true,
        messages: this.history.map(m => { return {
          role: m.role.toString().toLowerCase(),
          content: m.content,
        }; }),
      }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.endpoint.key}`,
      },
      signal: options.signal,
    });

    // API error happened.
    if (response.status != 200) {
      const body = await response.json();
      if (!body.error)
        throw new APIError(`Unexpected open from ChatGPT API: ${body}`);
      throw new NetworkError(body.error.message);
    }

    // Parse server sent event (SSE).
    const parser = createParser(this.#parseMessage.bind(this));
    const decoder = new TextDecoder();
    for await (const chunk of bodyToIterator(response.body)) {
      parser.feed(decoder.decode(chunk));
    }
  }

  #parseMessage(message) {
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
    const response = new ChatResponse({id: data.id});
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
    const partial: Partial<ChatMessage> = {};
    if (choice.delta.content)
      partial.content = choice.delta.content;
    // Beginning of content may include some white spaces.
    if (partial.content && (!this.pendingMessage || !this.pendingMessage.content))
      partial.content = partial.content.trimLeft();
    if (choice.delta.role) {
      const key = capitalize(choice.delta.role) as keyof typeof ChatRole;
      partial.role = ChatRole[key];
    }
    // ChatService will handle the rest.
    this.handlePartialMessage(partial, response);
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
