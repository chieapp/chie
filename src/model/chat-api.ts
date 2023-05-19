import APIEndpoint from './api-endpoint';
import WebAPI from './web-api';

export enum ChatRole {
  User = 'User',
  Assistant = 'Assistant',
  System = 'System',
}

export interface ChatLink {
  name: string;
  url: string;
}

export interface ChatStep {
  toString(): string;
  toHTML?(): string;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  steps?: (ChatStep | string)[];
  links?: ChatLink[];
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

  // Tell server to delete current conversation.
  removeFromServer(): Promise<void> {
    throw new Error('Not implemented.');
  }

  // Remove all messages after index (including message at index).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  removeMessagesAfter(index: number): Promise<void> {
    throw new Error('Not implemented.');
  }
}

// Defines static properties on ChatConversationAPI.
type ChatConversationAPIConstructorType<T> = new (endpoint: APIEndpoint) => ChatConversationAPI<T>;

export interface ChatConversationAPIType<T = object> extends ChatConversationAPIConstructorType<T> {
  isHighlyRateLimited?: boolean;
  canRemoveFromServer?: boolean;
  canRemoveMessagesAfter?: boolean;
}
