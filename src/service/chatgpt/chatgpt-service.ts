import {fetchEventSource} from '@fortaine/fetch-event-source';
import APIEndpoint, {APIEndpointType} from '../../model/api-endpoint';
import ChatService, {ChatRole, ChatMessage} from '../../model/chat-service';

export default class ChatGPTService extends ChatService {
  constructor(endpoint: APIEndpoint) {
    if (endpoint.type != APIEndpointType.ChatGPT)
      throw new Error('Expect ChatGPT API endpoint in ChatGPTService.');
    super(endpoint);
  }

  async sendMessage(message: ChatMessage, options: {signal?: AbortSignal} = {}) {
    if (this.pendingMessage)
      throw new Error('There is pending message being received.');
    this.history.push(message);

    const opts = {
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
      onmessage: this.#parseMessage.bind(this),
    };
    await fetchEventSource(this.endpoint.url, {
      ...opts,
      async onopen(response) {
        if (response.status == 200)  // successful start
          return;
        // Parse the error.
        const body = await response.json();
        if (!body.error)
          throw new Error(`Unexpected open from ChatGPT API: ${body}`);
        throw new Error(body.error.message);
      },
      onerror(error) {
        // Throw the error to stop.
        throw error;
      },
    });

    // The pendingMessage should be cleared after parsing.
    if (this.pendingMessage) {
      this.pendingMessage = null;
      throw new Error('The pending message is not cleared.');
    }
  }

  #parseMessage(message) {
    if (!message.data)
      throw new Error(`Unexpected message from ChatGPT API: ${message}`);
    // ChatGPT sends [DONE] when streaming message is finished.
    if (message.data == '[DONE]')
      return;
    // Simple validation.
    const data = JSON.parse(message.data);
    if (data.object != 'chat.completion.chunk' ||
        !Array.isArray(data.choices) ||
        data.choices.length != 1)
      throw new Error(`Unexpected data from ChatGPT API: ${message.data}`);
    const choice = data.choices[0];
    // Parse the finish_reason.
    const response = {
      id: data.id,
      complete: true,
      filtered: false,
      pending: false,
    };
    switch (choice.finish_reason) {
      case 'stop':  // all delta received
        break;
      case null:
        response.complete = false;
        response.pending = true;
        break;
      case 'length':
        response.complete = false;
        break;
      case 'content_filter':
        response.complete = true;
        response.filtered = true;
        break;
      default:
        throw new Error(`Unknown finish_reason: ${choice.finish_reason}`);
    }
    // Build the message from delta.
    const partial: Partial<ChatMessage> = {};
    if (choice.delta.content)
      partial.content = choice.delta.content;
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
