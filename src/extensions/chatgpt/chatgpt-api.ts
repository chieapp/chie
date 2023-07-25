import {createParser} from 'eventsource-parser';
import {
  APICredential,
  APIError,
  ChatCompletionAPI,
  ChatCompletionAPIOptions,
  ChatMessage,
  ChatResponse,
  ChatRole,
} from 'chie';

export default class ChatGPTAPI extends ChatCompletionAPI {
  constructor(credential: APICredential) {
    if (credential.type != 'ChatGPT API')
      throw new Error('Expect ChatGPT API credential in ChatGPTAPI.');
    super(credential);
  }

  async sendConversation(history: ChatMessage[], options: ChatCompletionAPIOptions) {
    // Start request.
    const headers = {'Content-Type': 'application/json'};
    if (this.credential.key)
      headers['Authorization'] = `Bearer ${this.credential.key}`;
    const response = await fetch(this.credential.url, {
      body: JSON.stringify(this.#getRequestBody(history, options)),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.credential.key}`,
      },
      signal: options.signal,
    });

    // API error happened.
    if (response.status != 200) {
      const body = await response.json();
      if (!body.error)
        throw new APIError(`Unexpected open from ChatGPT API: ${body}`);
      throw new APIError(body.error.message);
    }

    // Parse server sent event (SSE).
    const state = {firstDelta: true, toolName: '', toolArg: ''};
    const parser = createParser(this.#parseMessage.bind(this, state, options));
    const decoder = new TextDecoder();
    for await (const chunk of bodyToIterator(response.body)) {
      parser.feed(decoder.decode(chunk));
    }
  }

  #getRequestBody(history: ChatMessage[], options: ChatCompletionAPIOptions) {
    // API reference:
    // https://platform.openai.com/docs/api-reference/chat/create
    const body = {
      model: this.getParam('model'),
      stream: true,
      messages: history.map(message => {
        const result = {
          role: fromChatRole(message.role),
          // The content must be string or null, can't be undefined.
          content: message.content ?? null,
        };
        if (message.toolName) {
          result['name'] = message.toolName;
        }
        if (message.tool) {
          result['function_call'] = {
            name: message.tool.name,
            arguments: JSON.stringify(message.tool.arg),
          };
        }
        return result;
      }),
    };
    if (options.tools) {
      body['function_call'] = 'auto';
      body['functions'] = options.tools.map(tool => {
        const properties: Record<string, object> = {};
        for (const param of tool.parameters) {
          properties[param.name] = {
            description: param.description,
            type: param.type,
          };
          if (param.enum)
            properties[param.name] = param.enum;
        }
        return {
          name: tool.name,
          description: tool.descriptionForModel,
          parameters: {
            type: 'object',
            required: tool.parameters.filter(p => !p.optional).map(p => p.name),
            properties,
          },
        };
      });
    }
    return body;
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
      case 'function_call':
        response.useTool = true;
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
    if (choice.delta.role)
      delta.role = toChatRole(choice.delta.role);
    // Function call.
    if (choice.delta.function_call) {
      if (choice.delta.function_call.name)
        state.toolName += choice.delta.function_call.name;
      if (choice.delta.function_call.arguments)
        state.toolArg += choice.delta.function_call.arguments;
      // Keep waiting for all function_call data before notifying chat service.
      return;
    }
    // All function_call data are received when finished.
    if (response.useTool) {
      delta.tool = {
        name: state.toolName,
        arg: JSON.parse(state.toolArg),
      };
    }
    // ChatService will handle the rest.
    options.onMessageDelta(delta, response);
  }
}

function fromChatRole(role: ChatRole) {
  if (role == ChatRole.Tool)
    return 'function';
  return role.toString().toLowerCase();
}

function toChatRole(role: string) {
  if (role == 'function')
    return ChatRole.Tool;
  else
    return ChatRole[capitalize(role) as keyof typeof ChatRole];
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
