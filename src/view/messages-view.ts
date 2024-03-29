import ejs from 'ejs';
import fs from 'node:fs';
import gui from 'gui';
import open from 'open';
import path from 'node:path';
import {realpathSync} from 'node:fs';

import BaseChatService from '../model/base-chat-service';
import BrowserView, {style} from '../view/browser-view';
import Icon from '../model/icon';
import StreamedMarkdown, {escapeText, highlightCode} from '../util/streamed-markdown';
import basicStyle from '../view/basic-style';
import toolManager from '../controller/tool-manager';
import {ChatRole, ChatMessage, ChatLink, ChatStep} from '../model/chat-api';

const actionsMap = {
  refresh: {
    name: 'Refresh token',
    onClick: "chie.refreshToken('refresh')",
  },
  relogin: {
    name: 'Re-login',
    onClick: "chie.refreshToken('login')",
  },
  clear: {
    name: 'Clear conversation',
    onClick: 'chie.clearConversation()',
  },
  resend: {
    name: 'Resend message',
    onClick: 'chie.resendLastMessage()',
  },
};

export default class MessagesView extends BrowserView {
  // Used to assert wrong executeJavaScript sequence.
  hasPendingMessage = false;

  constructor() {
    super({hideUntilLoaded: true});
    // Add bindings to the browser.
    this.browser.addBinding('highlightCode', this.#highlightCode.bind(this));
    this.browser.addBinding('copyText', this.#copyText.bind(this));
    this.browser.addBinding('openLink', this.#openLink.bind(this));
  }

  // Load a chat service.
  loadChatService(service: BaseChatService) {
    this.hasPendingMessage = service.pending && service.getLastMessage()?.role != ChatRole.User;
    this.loadURL(`chie://chat/${service.id}/${encodeURIComponent(service.getTitle())}`);
  }

  // Append a message.
  appendMessage(service: BaseChatService, message: Partial<ChatMessage>) {
    if (this.hasPendingMessage)
      throw new Error('Can not append message while there is pending message.');
    this.pushTask(async () => {
      const html = getTemplate('message')({
        message: messageToJSON(service, message, service.history.length - 1),
      });
      await this.executeJavaScript(`window.appendMessage(${JSON.stringify(html)})`);
    });
  }

  // Add a pending message.
  appendPendingMessage(service: BaseChatService, message: Partial<ChatMessage>) {
    if (this.hasPendingMessage)
      throw new Error('Can not append message while there is pending message.');
    this.hasPendingMessage = true;
    this.pushTask(async () => {
      const html = getTemplate('message')({
        // A pending message is not added to service.history yet, so we use one
        // pass end as its index.
        message: messageToJSON(service, message, service.history.length, true),
      });
      await this.executeJavaScript(`window.appendMessage(${JSON.stringify(html)})`);
    });
  }

  // Append html to the pending message.
  appendHtmlToPendingMessage(delta) {
    if (!this.hasPendingMessage)
      throw new Error('There is no pending message.');
    this.pushJavaScript(`window.appendHtmlToPendingMessage(${JSON.stringify(delta)})`);
  }

  // Append internal steps.
  appendSteps(steps: (ChatStep | string)[]) {
    this.pushJavaScript(`window.appendSteps(${JSON.stringify(steps.map(parseStep))})`);
  }

  // Add links to references.
  appendLinks(index: number, links: ChatLink[]) {
    this.pushJavaScript(`window.appendLinks(${index}, ${JSON.stringify(links)})`);
  }

  // Add some suggested replies.
  setSuggestdReplies(replies: string[]) {
    const buttons = replies.map(r => `<button onclick="chie.sendReply(this.textContent)">${r}</button>`);
    const html = `<div id="replies">${buttons.join('')}</div>`;
    this.pushJavaScript(`window.setSuggestdReplies(${JSON.stringify(html)})`);
  }

  // Add buttons for actions.
  setReplyActions(actions: ('refresh' | 'relogin' | 'clear' | 'resend')[]) {
    const buttons: string[] = [];
    for (const name of actions) {
      const action = actionsMap[name];
      buttons.push(`<button class="attention" onclick="${action.onClick}">${action.name}</button>`);
    }
    if (buttons.length > 0) {
      const html = `<div id="replies">${buttons.join('')}</div>`;
      this.pushJavaScript(`window.setSuggestdReplies(${JSON.stringify(html)})`);
    }
  }

  // Mark the end of pending message.
  endPending() {
    this.hasPendingMessage = false;
    this.pushJavaScript('window.endPending()');
  }

  // Show error.
  appendError(error: string) {
    this.hasPendingMessage = false;
    this.pushJavaScript(`window.appendError(${JSON.stringify(error)})`);
    this.setReplyActions(['resend']);
  }

  // Add (aborted) label to the pending message.
  abortPending() {
    this.hasPendingMessage = false;
    this.pushJavaScript('window.abortPending()');
  }

  // Remove a message.
  removeMessagesAfter(index: number) {
    this.pushJavaScript(`window.removeMessagesAfter(${index})`);
  }

  // Re-render a message.
  updateMessage(service: BaseChatService, message: ChatMessage, index: number) {
    this.pushTask(async () => {
      const html = getTemplate('message')({
        message: messageToJSON(service, message, index),
      });
      await this.executeJavaScript(`window.updateMessage(${index}, ${JSON.stringify(html)})`);
    });
  }

  // Update the name of assistant.
  changeAll(query: string, content: string) {
    this.pushJavaScript(`window.changeAll(${JSON.stringify(query)}, ${JSON.stringify(content)})`);
  }

  // Remove all messages.
  clearMessages() {
    this.pushJavaScript('messages.innerHTML = ""');
  }

  // Browser bindings.
  #highlightCode(text: string, language: string, callbackId: number) {
    const code = highlightCode(text, language);
    this.pushJavaScript(`window.executeCallback(${callbackId}, ${JSON.stringify(code)})`);
  }

  #copyText(text: string) {
    gui.Clipboard.get().setText(text);
  }

  #openLink(url: string) {
    open(url);
  }
}

// Register chie:// protocol to work around CROS problem with file:// protocol.
gui.Browser.registerProtocol('chie', (url) => {
  const u = new URL(url);
  if (u.host == 'app-file') {
    // Load file inside app bundle.
    const p = realpathSync(`${__dirname}/../..${u.pathname}`);
    return gui.ProtocolFileJob.create(p);
  } else if (u.host == 'user-icon') {
    // Load icons inside user data dir.
    return gui.ProtocolFileJob.create(path.join(Icon.userIconsPath, u.pathname));
  } else if (u.host == 'chat') {
    // Recieve chat service from URL.
    const [, chatServiceId, title] = u.pathname.split('/');
    const service = BaseChatService.fromId(parseInt(chatServiceId));
    if (!service)
      return gui.ProtocolStringJob.create('text/plain', `Can not find chat with id "${chatServiceId}" and title "${decodeURIComponent(title)}".`);
    // Render chat service.
    const messages = service.history.reduce(mergeToolMessages.bind(this, service), []);
    if (service.pending && service.getLastMessage()?.role != ChatRole.User)
      messages[messages.length - 1].pending = true;
    const html = getTemplate('page')({
      messages,
      style: Object.assign({}, style, basicStyle),
    });
    return gui.ProtocolStringJob.create('text/html', html);
  } else {
    return gui.ProtocolStringJob.create('text/plain', 'Unsupported type');
  }
});

interface MessageRenderJSON {
  index: number;
  role: string;
  sender: string;
  content: string;
  canEdit?: boolean;
  avatar?: string;
  steps: string[];
  links?: ChatLink[];
  pending?: boolean;
}

// Merge tool messages into assistant message.
function mergeToolMessages(service: BaseChatService, result: MessageRenderJSON[], message: Partial<ChatMessage>, index: number) {
  const lastJson = result.length > 0 ? result[result.length - 1] : null;
  if (message.role == ChatRole.Tool) {
    // Merge tool message into last message.
    lastJson.steps.push(`Result: ${message.toolResult}`);
  } else {
    const json = messageToJSON(service, message, index);
    // Add step for tool execution.
    if (message.tool)
      json.steps.push(toolManager.getToolCallDescription(message.tool));
    // Merge messages from the same role into one.
    if (json.role == lastJson?.role) {
      lastJson.content += json.content;
      lastJson.steps = lastJson.steps.concat(json.steps);
    } else {
      result.push(json);
    }
  }
  return result;
}

// Translate the message into data to be parsed by EJS template.
function messageToJSON(service: BaseChatService, message: Partial<ChatMessage>, index: number, pending: boolean = false): MessageRenderJSON {
  if (!message.role)  // should not happen
    throw new Error('Role of message expected for serialization.');
  let content = message.content;
  if (content && message.role == ChatRole.Assistant)
    content = (new StreamedMarkdown({highlight: true, links: message.links})).appendText(content).html;
  else
    content = escapeText(content);
  const sender = {
    [ChatRole.User]: 'You',
    [ChatRole.Assistant]: service.name,
    [ChatRole.System]: 'System',
  }[message.role];
  const json: MessageRenderJSON = {index, role: message.role, sender, content, steps: [], pending};
  if (service.canRegenerateFrom())
    json.canEdit = true;
  if (message.role == ChatRole.Assistant)
    json.avatar = service.icon.getChieURL();
  if (message.steps)
    json.steps = message.steps.map(parseStep);
  if (message.links)
    json.links = message.links;
  return json;
}

// EJS templates.
const templates: Record<string, ejs.TemplateFunction> = {};
function getTemplate(name: string) {
  if (!(name in templates)) {
    const filename = path.join(__dirname, '../../assets/view', `${name}.html`);
    const html = fs.readFileSync(filename);
    templates[name] = ejs.compile(html.toString(), {filename});
  }
  return templates[name];
}

// Parse the steps.
function parseStep(step: ChatStep | string) {
  if (typeof step == 'string')
    return step;
  if (step.toHTML)
    return step.toHTML();
  return step.toString();
}
