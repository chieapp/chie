import {assert} from 'chai';

import APIEndpoint from '../src/model/api-endpoint';
import ChatView from '../src/view/chat-view';
import ChatService from '../src/model/chat-service';
import apiManager from '../src/controller/api-manager';
import {ChatConversationAPI} from '../src/model/chat-api';
import {ServiceManager} from '../src/controller/service-manager';

describe('ServiceManager', () => {
  let serviceManager: ServiceManager;

  beforeEach(() => {
    serviceManager = new ServiceManager();
    serviceManager.registerView(ChatView);
    serviceManager.registerService({
      name: 'Chat',
      serviceType: ChatService,
      apiTypes: [ChatConversationAPI],
      viewType: ChatView,
    });
  });

  it('detect duplicate registrations', () => {
    assert.throws(
      () => serviceManager.registerView(ChatView),
      'View "ChatView" has already been registered.');
  });

  it('createInstance checks API compatibility', () => {
    const endpoint = APIEndpoint.deserialize({
      name: 'Some API',
      type: 'DummyCompletionAPI',
      url: '',
    });
    assert.throws(
      () => serviceManager.createInstance('TestChat', 'Chat', endpoint),
      'Service "Chat" does not support API type "DummyCompletionAPI".');
  });

  it('serialize and restore instances', () => {
    const endpoint = apiManager.getEndpointsByType('DummyConversationAPI')[0];
    const instance = serviceManager.createInstance('TestChat', 'Chat', endpoint);
    assert.equal(instance, serviceManager.getInstances()[0]);
    // Force a re-initialization by deserializing from serialized data.
    serviceManager.deserialize(serviceManager.serialize());
    // The instances are no longer the same object.
    assert.notEqual(instance, serviceManager.getInstances()[0]);
    // But they still have same members.
    delete (instance.service as ChatService).id;
    delete (serviceManager.getInstances()[0].service as ChatService).id;
    assert.deepEqual(instance, serviceManager.getInstances()[0]);
  });
});
