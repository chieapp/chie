import APIEndpoint from './api-endpoint';
import WebAPI from './web-api';

export enum ChatRole {
  User = 'User',
  Assistant = 'Assistant',
  System = 'System',
}

export class ChatMessage {
  role: ChatRole = ChatRole.User;
  content: string = '';

  constructor(init?: Partial<ChatMessage>) {
    Object.assign(this, init);
  }
}

export class ChatResponse {
  // Unique ID for each message.
  id?: string;
  // The content is omitted because of content filter.
  filtered: boolean = false;
  // This message is in progress, and waiting for more.
  pending: boolean = false;
  // The response was aborted by user.
  aborted: boolean = false;

  constructor(init?: Partial<ChatResponse>) {
    Object.assign(this, init);
  }
}

export type onMessageDeltaCallback = (delta: Partial<ChatMessage>, response: ChatResponse) => void;

export type ChatAPIOptions = {
  signal?: AbortSignal,
  onMessageDelta: onMessageDeltaCallback,
};

export abstract class ChatAPI extends WebAPI {
  constructor(endpoint: APIEndpoint) {
    super(endpoint);
  }
}

export abstract class ChatConversationAPI extends ChatAPI {
  constructor(endpoint: APIEndpoint) {
    super(endpoint);
  }

  // Send a single user message and get reply.
  abstract sendMessage(text: string, options: ChatAPIOptions): Promise<void>;
}

export abstract class ChatCompletionAPI extends ChatAPI {
  constructor(endpoint: APIEndpoint) {
    super(endpoint);
  }

  // Send the whole conversation history and get reply.
  abstract sendConversation(history: ChatMessage[], options: ChatAPIOptions): Promise<void>;
}
