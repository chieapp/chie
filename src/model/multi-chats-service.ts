import BaseMultiChatsService from '../model/base-multi-chats-service';
import ChatService, {
  ChatServiceParams,
  ChatServiceSupportedAPIs,
} from '../model/chat-service';

export default class MultiChatsService extends BaseMultiChatsService<ChatServiceSupportedAPIs, ChatServiceParams> {
  constructor(options) {
    super(ChatService, options);
  }
}
