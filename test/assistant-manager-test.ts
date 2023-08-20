import fs from 'fs-extra';
import path from 'path';
import {assert} from 'chai';
import {directory} from 'tempy';

import APICredential from '../src/model/api-credential';
import ChatView from '../src/view/chat-view';
import ChatService from '../src/model/chat-service';
import Icon from '../src/model/icon';
import apiManager from '../src/controller/api-manager';
import {AssistantManager} from '../src/controller/assistant-manager';

describe('AssistantManager', () => {
  let assistantManager: AssistantManager;
  let currentUserIconsPath: string;
  const defaultUserIconsPath = Icon.userIconsPath;
  const fixtureIcon = path.resolve(__dirname, '../node_modules/yackage/resources/icon.png');

  beforeEach(() => {
    assistantManager = new AssistantManager();
    Icon.userIconsPath = currentUserIconsPath = directory();
  });

  afterEach(() => {
    Icon.userIconsPath = defaultUserIconsPath;
    fs.removeSync(currentUserIconsPath);
  });

  it('createAssistant checks API compatibility', () => {
    const credential = APICredential.deserialize({
      name: 'Some API',
      type: 'DummyConversationAPI',
      url: '',
    });
    assert.throws(
      () => assistantManager.createAssistant('TestChat', 'MultiChatsService', credential, ChatView),
      'Service "MultiChatsService" does not support API type "DummyConversationAPI".');
  });

  it('serialize and restore assistants', () => {
    const credential = apiManager.getCredentialsByType('DummyConversationAPI')[0];
    const assistant = assistantManager.createAssistant('TestChat', 'ChatService', credential, ChatView);
    assert.equal(assistant, assistantManager.getAssistants()[0]);
    // Force a re-initialization by deserializing from serialized data.
    assistantManager.deserialize(assistantManager.serialize());
    // The assistants are no longer the same object.
    assert.notEqual(assistant, assistantManager.getAssistants()[0]);
    // But they still have same members.
    delete (assistant.service as ChatService).id;
    delete (assistantManager.getAssistants()[0].service as ChatService).id;
    assert.deepEqual(assistant, assistantManager.getAssistants()[0]);
  });

  it('does not copy icon for builtin icons', () => {
    const assistant = assistantManager.createAssistant('TestChat', 'ChatService', apiManager.getCredentials()[0], ChatView);
    assert.isOk(assistant.service.icon.filePath.startsWith(Icon.builtinIconsPath));
    assert.isEmpty(fs.readdirSync(currentUserIconsPath));
  });

  it('copy icon for user icons', async () => {
    const options = {icon: new Icon({filePath: fixtureIcon})};
    const assistant = assistantManager.createAssistant('TestChat', 'ChatService', apiManager.getCredentials()[0], ChatView, options);
    assert.isOk(assistant.service.icon.filePath.startsWith(currentUserIconsPath));
    assert.isNotEmpty(fs.readdirSync(currentUserIconsPath));
    assistant.setIcon(new Icon({name: 'bot'}));
    assert.isEmpty(fs.readdirSync(currentUserIconsPath));
  });

  it('create tray icon for builtin icons', async () => {
    const assistant = assistantManager.createAssistant('TestChat', 'ChatService', apiManager.getCredentials()[0], ChatView);
    assistant.setTrayIcon(assistant.service.icon);
    assert.isOk(assistant.trayIcon.filePath.startsWith(currentUserIconsPath));
    assert.isNotEmpty(fs.readdirSync(currentUserIconsPath));
    assistant.setTrayIcon(null);
    assert.isEmpty(fs.readdirSync(currentUserIconsPath));
  });

  it('create tray icon for user icons', async () => {
    const options = {icon: new Icon({filePath: fixtureIcon})};
    const assistant = assistantManager.createAssistant('TestChat', 'ChatService', apiManager.getCredentials()[0], ChatView, options);
    assistant.setTrayIcon(assistant.service.icon);
    assert.isOk(assistant.trayIcon.filePath.startsWith(currentUserIconsPath));
    assert.equal(fs.readdirSync(currentUserIconsPath).length, 2);
    assistant.setTrayIcon(null);
    assert.equal(fs.readdirSync(currentUserIconsPath).length, 1);
    // Release file lock of image.
    assistant.destructor();
    assert.isEmpty(fs.readdirSync(currentUserIconsPath));
  });

  it('serialize and restore tray icons', async () => {
    const assistant = assistantManager.createAssistant('TestChat', 'ChatService', apiManager.getCredentials()[0], ChatView);
    assistant.setTrayIcon(new Icon({filePath: fixtureIcon}));
    assert.equal(fs.readdirSync(currentUserIconsPath).length, 1);
    assistantManager.deserialize(assistantManager.serialize());
    const newAssistant = assistantManager.getAssistants()[0];
    assert.deepEqual(assistant.trayIcon, newAssistant.trayIcon);
    assert.equal(fs.readdirSync(currentUserIconsPath).length, 1);
    // Release file lock of image.
    newAssistant.destructor();
    assert.isEmpty(fs.readdirSync(currentUserIconsPath));
  });
});
