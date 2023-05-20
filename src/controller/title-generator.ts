import WebAPI from '../model/web-api';
import {
  ChatCompletionAPI,
  ChatConversationAPI,
  ChatConversationAPIType,
  ChatMessage,
  ChatRole,
} from '../model/chat-api';

export class TitleGenerator {
  async generateForConversation(conversation: ChatMessage[], api: WebAPI, signal?: AbortSignal) {
    // Generate a prompt using stripped chat content.
    const messages = conversation.map(m => `${m.role.toString()}: ${stripContent(m.content)}`);
    const promptText = `\
Name the conversation based on following chat records:

---
${messages.join('\n\n')}
---

Provide a concise name, within 15 characters and without quotation marks.
The name should be in the same language used by the conversation.

The conversation is named:
`;

    let title = '';
    if (api instanceof ChatCompletionAPI) {
      const message = {role: ChatRole.User, content: promptText};
      await api.sendConversation([message], {
        signal,
        onMessageDelta(delta) { title += delta.content ?? ''; }
      });
    } else if (api instanceof ChatConversationAPI &&
               !(api.constructor as ChatConversationAPIType).isHighlyRateLimited) {
      // Spawn a new conversation to ask for title generation,
      const newapi = api.clone() as ChatConversationAPI;
      await newapi.sendMessage(promptText, {
        signal,
        onMessageDelta(delta) { title += delta.content ?? ''; }
      });
      // Clear the temporary conversation.
      if ((api.constructor as ChatConversationAPIType).canRemoveFromServer)
        await newapi.removeFromServer();
    } else {
      // Return the first words of last message.
      title = getFirstSentence(conversation[conversation.length - 1].content);
      // Do a fake await since this method is supposed to be async, returning
      // too early might trigger some bugs.
      await new Promise(resolve => setImmediate(resolve));
    }
    return title.trim();
  }
}

export default new TitleGenerator();

function stripContent(content: string) {
  return content.length > 100 ? content.substring(0, 100) + '...' : content;
}

function getFirstSentence(content: string) {
  // Return the first words of last message.
  const words = content.substring(0, 30).split(' ').slice(0, 5);
  // Likely a language without spaces in words.
  if (words.length < 3)
    return words[0].substring(0, 10);
  // Join the words but do not exceed 15 characters.
  let sentence = '';
  for (const word of words) {
    sentence += word + ' ';
    if (sentence.length > 15)
      break;
  }
  return sentence;
}
