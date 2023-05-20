import BaseMultiChatsService, {
  BaseMultiChatsServiceOptions,
} from '../model/base-multi-chats-service';
import ChatService, {
  ChatServiceParams,
  ChatServiceSupportedAPIs,
} from '../model/chat-service';

export default class MultiChatsService extends BaseMultiChatsService<ChatServiceSupportedAPIs, ChatServiceParams> {
  static deserialize(data) {
    return BaseMultiChatsService.deserialize(data);
  }

  constructor(options) {
    super(ChatService, options);
  }
}
