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

  async sendMessage(message: Partial<ChatMessage>, options: {signal?: AbortSignal} = {}) {
    if (this.pendingMessage)
      throw new Error('There is pending message being received.');
    if (!message.content)
      throw new Error('Message content can not be empty.');
    const fullMessage = {
      role: message.role ?? ChatRole.User,
      content: message.content,
    };
    this.history.push(fullMessage);

    // Yode hack.
    if (process['activateUvLoop'])
      process['activateUvLoop']();

    await this.sendMessageImpl(fullMessage, options);

    // The pendingMessage should be cleared after parsing.
    if (this.pendingMessage) {
      this.pendingMessage = null;
      throw new Error('The pending message is not cleared.');
    }
  }

  abstract sendMessageImpl(message: ChatMessage, options: {signal?: AbortSignal}): Promise<void>;

  protected handlePartialMessage(message: Partial<ChatMessage>, response: ChatResponse) {
    this.onPartialMessage.dispatch(message, response);

    // Concatenate to the pendingMessage.
    if (!this.pendingMessage) {
      if (!message.role)
        throw new Error('First partial message should include role');
      this.pendingMessage = {role: message.role};
    }
    if (message.content) {
      if (this.pendingMessage.content)
        this.pendingMessage.content += message.content;
      else
        this.pendingMessage.content = message.content;
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
