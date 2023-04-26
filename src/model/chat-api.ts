import APIEndpoint from './api-endpoint';
import WebAPI from './web-api';

export enum ChatRole {
  User = 'User',
  Assistant = 'Assistant',
  System = 'System',
}

export interface Link {
  name: string;
  url: string;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  steps?: string[];
  links?: Link[];
}

export interface ChatResponse {
  // This message is in progress, and waiting for more.
  pending: boolean;
  // Unique ID for each message.
  id?: string;
  // The content is omitted because of content filter.
  filtered?: boolean;
  // Replies suggested.
  suggestedReplies?: string[];
}

export type onMessageDeltaCallback = (delta: Partial<ChatMessage>, response: ChatResponse) => void;

export type ChatAPIOptions = {
  signal?: AbortSignal,
  onMessageDelta: onMessageDeltaCallback,
};

export abstract class ChatCompletionAPI extends WebAPI {
  constructor(endpoint: APIEndpoint) {
    super(endpoint);
  }

  // Send the whole conversation history and get reply.
  abstract sendConversation(history: ChatMessage[], options: ChatAPIOptions): Promise<void>;
}

export abstract class ChatConversationAPI<T = object> extends WebAPI {
  session?: T;

  constructor(endpoint: APIEndpoint) {
    super(endpoint);
  }

  // Send a single user message and get reply.
  abstract sendMessage(text: string, options: ChatAPIOptions): Promise<void>;
}
