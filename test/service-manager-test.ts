import {assert} from 'chai';

import ChatView from '../src/view/chat-view';
import ChatService from '../src/model/chat-service';
import {ChatConversationAPI} from '../src/model/chat-api';
import {ServiceManager} from '../src/controller/service-manager';

describe('ServiceManager', () => {
  let serviceManager: ServiceManager;

  beforeEach(() => {
    serviceManager = new ServiceManager();
    serviceManager.registerView(ChatView);
    serviceManager.registerService({
      serviceClass: ChatService,
      apiClasses: [ChatConversationAPI],
      viewClasses: [ChatView],
    });
  });

  it('detect duplicate registrations', () => {
    assert.throws(
      () => serviceManager.registerView(ChatView),
      'View "ChatView" has already been registered.');
  });
});
