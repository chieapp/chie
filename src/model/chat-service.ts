import BaseChatService, {BaseChatHistoryData} from '../model/base-chat-service';
import {
  ChatCompletionAPI,
  ChatConversationAPI,
  ChatConversationAPIType,
  ChatRole,
} from '../model/chat-api';

export type ChatServiceSupportedAPIs = ChatConversationAPI | ChatCompletionAPI;

export interface ChatHistoryData extends BaseChatHistoryData {
  session?: object;
}

export interface ChatServiceParams {
  systemPrompt?: string;
  contextLength?: number;
}

export default class ChatService extends BaseChatService<ChatServiceSupportedAPIs, ChatServiceParams> {
  constructor(options) {
    if (!(options.api instanceof ChatCompletionAPI) &&
        !(options.api instanceof ChatConversationAPI))
      throw new Error('Unsupported API type');
    super(options);
  }

  deserializeHistory(data: ChatHistoryData) {
    super.deserializeHistory(data);
    if (this.api instanceof ChatConversationAPI && data.session)
      this.api.session = data.session;
  }

  serializeHistory() {
    const data: ChatHistoryData = super.serializeHistory();
    if (this.api instanceof ChatConversationAPI && this.api.session)
      data.session = this.api.session;
    return data;
  }

  canRegenerateFrom() {
    if (this.api instanceof ChatCompletionAPI)
      return true;
    if (this.api instanceof ChatConversationAPI &&
        (this.api.constructor as ChatConversationAPIType).canRemoveMessagesAfter)
      return true;
    return false;
  }

  async removeMessagesAfter(index: number) {
    if (this.api instanceof ChatConversationAPI) {
      if (this.history[index - 1].role != ChatRole.User)
        throw new Error('ChatConversationAPI requires last message to be from user.');
      if (!(this.api.constructor as ChatConversationAPIType).canRemoveMessagesAfter)
        throw new Error('The API does not have ability for regeneration.');
    }
    // Tell ChatConversationAPI to remove message records.
    // Note that we are removing one more message (which is guaranteed to be
    // the user's message), because when calling the API we have to send the
    // user message again and we don't want it to be duplicated in server.
    if (this.api instanceof ChatConversationAPI)
      await this.api.removeMessagesAfter(index - 1);
    super.removeMessagesAfter(index);
  }

  async removeTrace() {
    await super.removeTrace();
    if (this.api instanceof ChatConversationAPI) {
      if ((this.api.constructor as ChatConversationAPIType).canRemoveFromServer)
        await this.api.removeFromServer().catch(() => { /* Ignore error */ });
      this.api.session = null;
    }
  }

  async sendHistoryAndGetResponse(options) {
    const apiOptions = {
      ...options,
      onMessageDelta: this.notifyMessageDelta.bind(this),
    };
    if (this.api instanceof ChatCompletionAPI) {
      let conversation = this.history;
      if (this.params?.contextLength)
        conversation = conversation.slice(-this.params.contextLength);
      if (this.params?.systemPrompt)
        conversation = [{role: ChatRole.System, content: this.params.systemPrompt}, ...conversation];
      await this.api.sendConversation(conversation, apiOptions);
    } else if (this.api instanceof ChatConversationAPI) {
      await this.api.sendMessage(this.history[this.history.length - 1].content, apiOptions);
    }
  }
}
