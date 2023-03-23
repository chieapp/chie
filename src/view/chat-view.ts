import fs from 'node:fs/promises';
import path from 'node:path';
import ejs from 'ejs';
import gui from 'gui';
import {SignalBinding} from 'type-signals';

import {renderMarkdown} from './markdown';
import ChatService, {ChatRole, ChatMessage} from '../model/chat-service';

const assetsDir = path.join(__dirname, '../../assets/view');

export default class ChatView {
  // Height limitations of entry view.
  static entryHeights?: {
    max: number;
    min: number;
  };

  // EJS templates.
  static pageTemplate?: ejs.AsyncTemplateFunction;
  static messageTemplate?: ejs.AsyncTemplateFunction;

  service: ChatService;
  isSending: boolean = false;

  view: gui.Container;
  browser: gui.Browser;
  replyBox: gui.Container;
  replyEntry: gui.TextEdit;

  #bindings: SignalBinding[] = [];
  #pendingMessageHtml?: string;

  constructor(service: ChatService) {
    this.service = service;

    this.view = gui.Container.create();
    this.view.setStyle({flex: 1});

    this.browser = gui.Browser.create({
      devtools: true,
      contextMenu: true,
      allowFileAccessFromFiles: true,
      hardwareAcceleration: false,
    });
    this.browser.setStyle({flex: 1});
    this.#setupBrowser();
    this.view.addChildView(this.browser);

    this.replyBox = gui.Container.create();
    this.replyBox.setStyle({padding: 5});
    this.view.addChildView(this.replyBox);

    this.replyEntry = gui.TextEdit.create();
    if (process.platform != 'win32') {
      // Force using overlay scrollbar.
      this.replyEntry.setOverlayScrollbar(true);
      this.replyEntry.setScrollbarPolicy('never', 'automatic');
    }
    // Font size should be the same with messages.
    const font = gui.Font.create(gui.Font.default().getName(), 15, 'normal', 'normal');
    this.replyEntry.setFont(font);
    // Calculate height for 1 and 5 lines.
    if (!ChatView.entryHeights) {
      this.replyEntry.setText('1');
      const min = this.replyEntry.getTextBounds().height;
      this.replyEntry.setText('1\n2\n3\n4\n5');
      const max = this.replyEntry.getTextBounds().height;
      this.replyEntry.setText('');
      ChatView.entryHeights = {min, max};
    }
    this.replyEntry.setStyle({height: ChatView.entryHeights.min});
    // Handle input events.
    this.replyEntry.onTextChange = this.#adjustEntryHeight.bind(this);
    this.replyEntry.shouldInsertNewLine = this.#onEnter.bind(this);
    this.replyBox.addChildView(this.replyEntry);

    this.#bindings.push(this.service.onPartialMessage.add(this.#onPartialMessage.bind(this)));
  }

  unload() {
    for (const binding of this.#bindings)
      binding.detach();
  }

  async addMessage(message: Partial<ChatMessage>, response?: {pending: boolean}) {
    const html = await ChatView.messageTemplate({
      message: messageToDom(message),
      response,
    });
    await this.executeJavaScript(`window.addMessage(${JSON.stringify(html)})`);
  }

  getDraft(): string | null {
    if (this.isSending)
      return null;
    const content = this.replyEntry.getText().trim();
    if (content.trim().length == 0)
      return null;
    return content;
  }

  executeJavaScript(js: string) {
    return new Promise<boolean>((resolve) => {
      this.browser.executeJavaScript(js, resolve);
    });
  }

  async #setupBrowser() {
    // Delay loading the templates for rendering conversation.
    if (!ChatView.pageTemplate) {
      await Promise.all([
        (async () => {
          const filename = path.join(assetsDir, 'page.html');
          const html = await fs.readFile(filename);
          ChatView.pageTemplate = await ejs.compile(html.toString(), {filename, async: true});
        })(),
        (async () => {
          const filename = path.join(assetsDir, 'message.html');
          const html = await fs.readFile(filename);
          ChatView.messageTemplate = await ejs.compile(html.toString(), {filename, async: true});
        })(),
      ]);
    }
    // Render.
    const data = {history: this.service.history.map(messageToDom)};
    this.browser.loadHTML(await ChatView.pageTemplate(data), 'https://app');
    // Add bindings to the browser.
    this.browser.setBindingName('chie');
    this.browser.addBinding('notifyReady', this.#notifyReady.bind(this));
    this.browser.addBinding('fetchImage', this.#fetchImage.bind(this));
    this.browser.addBinding('openLink', this.#openLink.bind(this));
    this.browser.addBinding('openLinkContextMenu', this.#openLinkContextMenu.bind(this));
  }

  // User presses Enter in the reply entry.
  #onEnter() {
    if (gui.Event.isShiftPressed())  // user wants new line
      return true;
    if (this.isSending)  // should never happen
      throw new Error('Sending message while a message is being received');
    // Ignore empty reply.
    const content = this.getDraft();
    if (!content)
      return false;
    // Append user's reply directly.
    const message = {role: ChatRole.User, content};
    this.addMessage(message);
    // Show a pending message.
    this.addMessage({role: ChatRole.Assistant}, {pending: true});
    // Prevent editing until sent.
    this.isSending = true;
    this.replyEntry.setEnabled(false);
    this.replyEntry.setText('');
    this.#adjustEntryHeight();
    this.service.sendMessage(message).then(() => {
      this.replyEntry.setEnabled(true);
    }).finally(() => {
      this.isSending = false;
    });
    return false;
  }

  // Message being received.
  #onPartialMessage(message: Partial<ChatMessage>, response) {
    if (message.content) {
      if (this.#pendingMessageHtml) {
        // Get html of full message.
        const html = renderMarkdown(this.service.pendingMessage.content + message.content);
        // Pass the delta to browser.
        const pos = findStartOfDifference(this.#pendingMessageHtml, html);
        const back = this.#pendingMessageHtml.length - pos;
        const delta = html.substr(pos);
        this.#pendingMessageHtml = html;
        this.executeJavaScript(`window.updatePending(${JSON.stringify(delta)}, ${back})`);
      } else {
        // This is the first part of message, just update.
        this.#pendingMessageHtml = renderMarkdown(message.content);
        this.executeJavaScript(`window.updatePending(${JSON.stringify(this.#pendingMessageHtml)})`);
      }
    }
    if (response.pending)  // more messages coming
      return;
    this.#pendingMessageHtml = null;
    this.executeJavaScript('window.endPending()');
  }

  // Automatically changes the height of entry to show all of user's inputs.
  #adjustEntryHeight() {
    let height = this.replyEntry.getTextBounds().height;
    if (height < ChatView.entryHeights.min)
      height = ChatView.entryHeights.min;
    else if (height > ChatView.entryHeights.max)
      height = ChatView.entryHeights.max;
    this.replyEntry.setStyle({height});
  }

  // Browser bindings used inside the browser view.
  #notifyReady() {
    this.replyEntry.focus();
  }

  #fetchImage() {
    // TODO
  }

  #openLink() {
    // TODO
  }

  #openLinkContextMenu() {
    // TODO
  }
}

function messageToDom(message: Partial<ChatMessage>) {
  if (!message.role)  // should not happen
    throw new Error('Role of message expected for serialization.');
  return {
    role: message.role,
    content: message.content ? renderMarkdown(message.content) : undefined,
  };
}

function findStartOfDifference(a: string, b: string) {
  const max = Math.min(a.length, b.length);
  for (let i = 0; i < max; ++i) {
    if (a[i] != b[i])
      return i;
  }
  return max;
}
