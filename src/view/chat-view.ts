import gui from 'gui';

import BaseChatService from '../model/base-chat-service';
import BaseView from '../view/base-view';
import IconButton from '../view/icon-button';
import InputView from '../view/input-view';
import MessagesView from '../view/messages-view';
import StreamedMarkdown from '../util/streamed-markdown';
import SwitcherButton from '../view/switcher-button';
import TextWindow from '../view/text-window';
import alert from '../util/alert';
import apiManager from '../controller/api-manager';
import basicStyle from '../view/basic-style';
import serviceManager from '../controller/service-manager';
import toolManager from '../controller/tool-manager';
import {APIError} from '../model/errors';
import {
  ChatRole,
  ChatMessage,
  ChatResponse,
  ChatCompletionAPI,
} from '../model/chat-api';
import {deepAssign} from '../util/object-utils';
import {runExportMenu} from './conversation-exporter';

type ButtonMode = 'refresh' | 'send' | 'stop';

export default class ChatView extends BaseView<BaseChatService> {
  // Font in entry.
  static font?: gui.Font;

  // Height limitations of entry view.
  static entryHeights?: {
    max: number;
    min: number;
  };

  static getMenuItems() {
    return [
      {
        label: 'Clear Conversation',
        accelerator: 'Shift+CmdOrCtrl+C',
        validate: (view: ChatView) => view.service?.history.length > 0,
        onClick: (view: ChatView) => view.service?.clear(),
      },
    ];
  }

  messagesView: MessagesView;

  toolbar: gui.Container;
  clearButton: IconButton;
  exportButton: IconButton;
  switchers: SwitcherButton[] = [];

  input: InputView;
  replyButton: IconButton;

  #markdown?: StreamedMarkdown;

  #buttonMode: ButtonMode = 'send';
  #textWindows: Record<number, TextWindow> = {};

  constructor() {
    super();

    this.view.setStyle({flex: 1});
    if (process.platform == 'win32')
      this.view.setBackgroundColor('#D3D3D3');

    this.messagesView = new MessagesView();
    this.messagesView.view.setStyle({flex: 1});
    this.messagesView.browser.addBinding('focusEntry', this.onFocus.bind(this));
    this.messagesView.browser.addBinding('showTextAt', this.#showTextAt.bind(this));
    this.messagesView.browser.addBinding('regenerateFrom', this.#regenerateFrom.bind(this));
    this.messagesView.browser.addBinding('resendLastMessage', this.#resendLastMessage.bind(this));
    this.messagesView.browser.addBinding('copyTextAt', this.#copyTextAt.bind(this));
    this.messagesView.browser.addBinding('sendReply', this.#sendReply.bind(this));
    this.messagesView.browser.addBinding('refreshToken', this.#refreshToken.bind(this));
    this.messagesView.browser.addBinding('clearConversation', this.#clearConversation.bind(this));
    this.messagesView.browser.endAddingBindings();
    this.messagesView.onDomReady.connect(this.#onDomReady.bind(this));
    this.view.addChildView(this.messagesView.view);

    // Font style should be the same with messages.
    if (!ChatView.font)
      ChatView.font = gui.Font.create(gui.Font.default().getName(), 15, 'normal', 'normal');

    this.toolbar = gui.Container.create();
    this.toolbar.setStyle({
      flexDirection: 'row',
      marginLeft: basicStyle.padding,
      marginTop: basicStyle.padding / 2,
      marginBottom: basicStyle.padding / 2,
    });
    this.view.addChildView(this.toolbar);

    this.clearButton = new IconButton('trash');
    this.clearButton.view.setTooltip('Clear conversation');
    this.clearButton.onClick = this.#clearConversation.bind(this);
    this.toolbar.addChildView(this.clearButton.view);

    this.exportButton = new IconButton('export');
    this.exportButton.view.setTooltip('Export conversation');
    this.exportButton.onClick = () => runExportMenu(this.exportButton.view, this.service);
    this.toolbar.addChildView(this.exportButton.view);

    this.input = new InputView();
    this.input.view.setStyle({marginTop: 0, margin: basicStyle.padding});
    this.input.entry.setFont(ChatView.font);
    // Calculate height for 1 and 5 lines.
    if (!ChatView.entryHeights) {
      this.input.entry.setText('1');
      const min = this.input.entry.getTextBounds().height;
      this.input.entry.setText('1\n2\n3\n4\n5');
      const max = this.input.entry.getTextBounds().height;
      this.input.entry.setText('');
      ChatView.entryHeights = {min, max};
    }
    this.input.setAutoResize(ChatView.entryHeights);
    this.input.entry.onTextChange = this.#resetUIState.bind(this);
    this.input.entry.shouldInsertNewLine = this.#onEnter.bind(this);
    this.view.addChildView(this.input.view);

    this.replyButton = new IconButton('send');
    this.replyButton.view.setTooltip(getTooltipForMode('send'));
    this.replyButton.onClick = this.#onButtonClick.bind(this);
    this.input.addButton(this.replyButton);

    // Disable button and entry until loaded.
    this.clearButton.setEnabled(false);
    this.exportButton.setEnabled(false);
    this.input.setEntryEnabled(false);
    this.replyButton.setEnabled(false);
  }

  destructor() {
    super.destructor();
    this.messagesView.destructor();
    this.clearButton.destructor();
    this.exportButton.destructor();
    for (const switcher of this.switchers)
      switcher.destructor();
    this.input.destructor();
  }

  onFocus() {
    if (this.view.isVisibleInHierarchy())
      this.input.entry.focus();
  }

  getTitle() {
    if (!this.service)
      return null;
    return this.service.getTitle() ?? this.service.name;
  }

  async loadService(service: BaseChatService) {
    if (!(service instanceof BaseChatService))
      throw new Error('ChatView can only be used with BaseChatService.');
    if (!await super.loadService(service))
      return false;

    // Delay loading until the service is ready.
    await service.load();
    // Load messages.
    this.#markdown = null;
    this.messagesView.loadChatService(service);
    this.onNewTitle.emit();
    this.#updateSwitchButton();

    // Connect signals.
    this.serviceConnections.add(service.onNewTitle.connect(
      this.onNewTitle.emit.bind(this.onNewTitle)));
    this.serviceConnections.add(service.onChangeName.connect(
      this.#onChangeName.bind(this)));
    this.serviceConnections.add(service.onChangeIcon.connect(
      this.#onChangeIcon.bind(this)));
    this.serviceConnections.add(service.onUserMessage.connect(
      this.#onUserMessage.bind(this)));
    this.serviceConnections.add(service.onClearError.connect(
      this.#onClearError.bind(this)));
    this.serviceConnections.add(service.onMessageBegin.connect(
      this.#onMessageBegin.bind(this)));
    this.serviceConnections.add(service.onMessageDelta.connect(
      this.#onMessageDelta.bind(this)));
    this.serviceConnections.add(service.onExecuteToolError.connect(
      this.#onMessageError.bind(this)));
    this.serviceConnections.add(service.onMessageError.connect(
      this.#onMessageError.bind(this)));
    this.serviceConnections.add(service.onMessage.connect(
      this.#onMessageEnd.bind(this)));
    this.serviceConnections.add(service.onRemoveMessagesAfter.connect(
      this.messagesView.removeMessagesAfter.bind(this.messagesView)));
    this.serviceConnections.add(service.onUpdateMessage.connect(
      this.messagesView.updateMessage.bind(this.messagesView, this.service)));
    this.serviceConnections.add(service.onClearMessages.connect(() => {
      this.messagesView.clearMessages();
      this.#resetUIState();
    }));
    if (this.service.pending) {
      // When the we have started recieving message but there is no pending
      // message in the messagesView, append one.
      if (!this.messagesView.hasPendingMessage)
        this.#onMessageBegin();
      // Load pending message.
      if (this.service.pendingMessage)
        this.#onMessageDelta(this.service.pendingMessage, {pending: true});
      if (this.service.lastError)
        this.#onMessageError(this.service.lastError);
      this.#resetUIState();
    } else {
      // If last message is from user, add a resend button.
      if (this.service.getLastMessage()?.role == ChatRole.User)
        this.messagesView.setReplyActions(['resend']);
    }
    return true;
  }

  unload() {
    super.unload();
    for (const win of Object.values(this.#textWindows))
      win.window.close();
  }

  getDraft(): string | null {
    const content = this.input.entry.getText();
    if (content.trim().length == 0)
      return null;
    return content;
  }

  // Change button mode.
  #setButtonMode(mode: ButtonMode) {
    this.replyButton.setImage(mode);
    this.replyButton.setEnabled(true);
    this.replyButton.view.setTooltip(getTooltipForMode(mode));
    this.#buttonMode = mode;
    // Disable send button when there is error happened.
    if (mode == 'send' && this.service.lastError)
      this.replyButton.setEnabled(false);
  }

  // Create the switch button.
  #updateSwitchButton() {
    for (const switcher of this.switchers) {
      this.toolbar.removeChildView(switcher.view);
      switcher.destructor();
    }
    this.switchers = [];
    const serviceRecord = serviceManager.getRegisteredServices().find(record => this.service.constructor == record.serviceClass);
    if (serviceRecord?.params) {
      for (const param of serviceRecord.params) {
        if (param.hasSwitcher) {
          const switcher = new SwitcherButton(this.service, param, false);
          this.toolbar.addChildView(switcher.view);
          this.switchers.push(switcher);
        }
      }
    }
    const apiRecord = apiManager.getAPIRecord(this.service.api.credential.type);
    if (apiRecord?.params) {
      for (const param of apiRecord.params) {
        if (param.hasSwitcher) {
          const switcher = new SwitcherButton(this.service, param, true);
          this.toolbar.addChildView(switcher.view);
          this.switchers.push(switcher);
        }
      }
    }
  }

  // Set the input and button to ready to send state.
  #resetUIState() {
    this.onFocus();
    // Button states.
    if (this.service.history.length > 0) {
      this.clearButton.setEnabled(!this.service.pending);
      this.exportButton.setEnabled(true);
    } else {
      this.clearButton.setEnabled(false);
      this.exportButton.setEnabled(false);
    }
    // Can only refresh if there was error.
    if (this.service.lastError) {
      this.#setButtonMode('refresh');
      return;
    }
    // Can only stop if there is pending message.
    if (this.service.pending) {
      this.#setButtonMode('stop');
      return;
    }
    // Show refresh button if can regenerate and there is no input.
    if (this.service.canRegenerateLastResponse() &&
        this.input.entry.getText().length == 0) {
      this.#setButtonMode('refresh');
      return;
    }
    // Show refresh button if last message is from user, this usually means
    // the last message failed to send.
    if (this.service.getLastMessage()?.role == ChatRole.User) {
      this.#setButtonMode('refresh');
      return;
    }
    // Otherwise ready to send.
    this.#setButtonMode('send');
  }

  // User presses Enter in the reply entry.
  #onEnter() {
    if (gui.Event.isShiftPressed())  // user wants new line
      return true;
    if (this.#buttonMode != 'send')
      return false;
    const content = this.getDraft();
    if (!content)
      return false;
    // Send message.
    this.replyButton.setEnabled(false);
    this.service.sendMessage({role: ChatRole.User, content});
    return false;
  }

  // Clear conversation.
  #clearConversation() {
    this.service.clear();
  }

  // User clicks on the send button.
  #onButtonClick() {
    // Do the action depending on button mode.
    if (this.#buttonMode == 'send') {
      this.#onEnter();
    } else if (this.#buttonMode == 'stop') {
      this.replyButton.setEnabled(false);
      this.service.abort();
    } else if (this.#buttonMode == 'refresh') {
      this.replyButton.setEnabled(false);
      this.service.regenerateLastResponse();
    }
  }

  // Recover current state of chat.
  #onDomReady() {
    this.input.setEntryEnabled(true);
    if (!this.service.pending)
      this.#resetUIState();
  }

  // Service's name has changed.
  #onChangeName() {
    this.messagesView.changeAll('.role-assistant .name', this.service.name);
  }

  // Service's icon has changed.
  #onChangeIcon() {
    const img = `<img src='${this.service.icon.getChieURL()}'/>`;
    this.messagesView.changeAll('.role-assistant .avatar', img);
  }

  // User has sent a message.
  #onUserMessage(message: ChatMessage) {
    if (message.role == ChatRole.User)
      this.messagesView.appendMessage(this.service, message);
    else if (message.role == ChatRole.Tool)
      this.messagesView.appendSteps([`Result: ${message.toolResult}`]);
  }

  // Last error has been cleared for regeneration.
  #onClearError() {
    this.messagesView.removeMessagesAfter(this.service.history.length);
  }

  // Begin receving response.
  #onMessageBegin() {
    // When last message is a tool result, there is no need to append pending
    // message.
    if (this.service.getLastMessage()?.role != ChatRole.User)
      return;
    // Add a bot message to indicate we are loading.
    this.messagesView.appendPendingMessage(this.service, {role: ChatRole.Assistant});
    // Clear input.
    this.#markdown = null;
    this.input.setText('');
    this.#resetUIState();
  }

  // Message being received.
  #onMessageDelta(delta: Partial<ChatMessage>, response: ChatResponse) {
    if (delta.tool)
      this.messagesView.appendSteps([toolManager.getToolCallDescription(delta.tool)]);
    if (delta.steps)
      this.messagesView.appendSteps(delta.steps);
    if (!this.#markdown && (delta.links || delta.content))
      this.#markdown = new StreamedMarkdown();
    if (delta.links) {
      this.#markdown.appendLinks(delta.links);
      this.messagesView.appendLinks(this.service.pendingMessage?.links?.length ?? 0, delta.links);
    }
    if (delta.content) {
      // Update the message when receiving deltas.
      const change = this.#markdown.appendText(delta.content);
      this.messagesView.appendHtmlToPendingMessage(change);
    }
    if (response.suggestedReplies)
      this.messagesView.setSuggestdReplies(response.suggestedReplies);
  }

  // There is error thrown when sending message.
  #onMessageError(error: Error | APIError) {
    if (error.name == 'AbortError')
      this.messagesView.abortPending();
    else if (error.name == 'APIError' || error.name == 'NetworkError')
      this.messagesView.appendError(error.message);
    else
      this.messagesView.appendError(error.stack);
    // Append refresh button.
    if (error.name == 'APIError') {
      const code = (error as APIError).code;
      if (code == 'refresh')
        this.messagesView.setReplyActions(['refresh']);
      else if (code == 'relogin')
        this.messagesView.setReplyActions(['relogin']);
      else if (code == 'invalid-session')
        this.messagesView.setReplyActions(['clear']);
    }
    this.#resetUIState();
  }

  // A full message has been received.
  #onMessageEnd(message, response) {
    // Do nothing when tool is used so the interface still shows pending state.
    if (response?.useTool)
      return;
    // Reset after message is received.
    this.#resetUIState();
    if (this.service.isAborted())
      this.messagesView.abortPending();
    this.messagesView.endPending();
  }

  // Browser bindings.
  #showTextAt(index: number, textWidth: number) {
    if (index in this.#textWindows) {
      this.#textWindows[index].window.activate();
      return;
    }
    const message = this.service.history[index];
    if (!message)
      throw new Error(`Can not find message with index "${index}".`);
    // Determine the capacity of the text window.
    let mode = 'show';
    if (this.service.api instanceof ChatCompletionAPI) {
      // Only ChatCompletionAPI can do arbitrary edits.
      if (message.role == ChatRole.User)
        mode = 'edit-regenerate';
      else
        mode = 'edit';
    } else if (this.service.canRegenerateFrom() && message.role == ChatRole.User) {
      // Others may only do regeneration.
      mode = 'regenerate';
    }
    // Show text window.
    const win = new TextWindow(mode, message.content, index, this.service);
    this.#textWindows[index] = win;
    win.window.onClose = () => delete this.#textWindows[index];
    win.showWithWidth(textWidth);
  }

  #resendLastMessage() {
    this.service.regenerateLastResponse();
  }

  #regenerateFrom(index: number) {
    this.service.regenerateFrom(index);
  }

  #copyTextAt(index: number) {
    gui.Clipboard.get().setText(this.service.history[index].content);
  }

  #sendReply(content: string) {
    this.service.sendMessage({role: ChatRole.User, content});
  }

  async #refreshToken(action: 'refresh' | 'login') {
    try {
      const record = apiManager.getAPIRecord(this.service.api.credential.type);
      deepAssign(this.service.api.credential, await record[action]());
      apiManager.updateCredential(this.service.api.credential);
      this.service.regenerateLastResponse();
    } catch (error) {
      if (error.name != 'CancelledError')
        alert(error.message);
    }
  }
}

// Return the button tooltip for button mode.
function getTooltipForMode(mode: ButtonMode) {
  if (mode == 'refresh')
    return 'Regenerate';
  else if (mode == 'send')
    return 'Send';
  else if (mode == 'stop')
    return 'Stop';
  else
    throw new Error(`Invalid button mode ${mode}.`);
}
