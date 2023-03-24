import {marked} from 'marked';

const renderer = new marked.Renderer();
renderer.code = (code) => { return `<pre>${code}</pre>`; };

export function renderMarkdown(str: string) {
  return marked.parse(str, {renderer, breaks: true});
}
