import {Signal} from 'type-signals';
import APIEndpoint from './api-endpoint';

export enum ChatRole {
  User = 'User',
  Assistant = 'Assistant',
  System = 'System',
}

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatResponse = {
  // Unique ID for each message.
  id: string;
  // Message may not be complete because of token limitation.
  complete: boolean;
  // The content is omitted because of content filter.
  filtered: boolean;
  // This message is in progress, and waiting for more.
  pending: boolean;
};

export default abstract class ChatService {
  endpoint: APIEndpoint;
  history: ChatMessage[] = [];
  pendingMessage?: Partial<ChatMessage>;

  onPartialMessage: Signal<(message: Partial<ChatMessage>, response: ChatResponse) => void>;
  onMessage: Signal<(message: ChatMessage, response: ChatResponse) => void>;

  constructor(endpoint: APIEndpoint) {
    this.endpoint = endpoint;
    this.onPartialMessage = new Signal();
    this.onMessage = new Signal();
  }

  abstract sendMessage(message: ChatMessage, options: {signal?: AbortSignal}): Promise<void>;

  protected handlePartialMessage(message: Partial<ChatMessage>, response: ChatResponse) {
    // Beginning of content may include some white spaces.
    if (message.content && !this.pendingMessage.content)
      message.content = message.content.trimLeft();

    this.onPartialMessage.dispatch(message, response);

    // Concatenate to the pendingMessage.
    if (!this.pendingMessage)
      this.pendingMessage = {};
    if (message.role) {
      if (this.pendingMessage.role)
        throw new Error('Overwriting role in partial message.');
      this.pendingMessage.role = message.role;
    }
    if (message.content) {
      this.pendingMessage.content += message.content;
    }

    // Send onMessage when all pending messags have been received.
    if (!response.pending) {
      if (!this.pendingMessage.role || !this.pendingMessage.content)
        throw new Error('Incomplete delta received from ChatGPT');
      this.onMessage.dispatch({
        role: this.pendingMessage.role,
        content: this.pendingMessage.content.trim(),
      }, response);
      this.pendingMessage = null;
    }
  }
}
