import {Signal} from 'typed-signals';

import APICredential from '../model/api-credential';
import Icon from '../model/icon';
import Param from '../model/param';
import WebAPI from '../model/web-api';
import assistantManager from '../controller/assistant-manager';
import {ConfigStoreItem} from '../model/config-store';
import {Selection} from '../model/param';
import {getNextId} from '../util/id-generator';

type WebAPIType = new (credential: APICredential) => WebAPI;

export type APIRecord = {
  name: string,
  apiClass: WebAPIType,
  auth: 'none' | 'key' | 'login',
  icon?: Icon,
  url?: string,
  description?: string,
  priority?: number,
  params?: Param[],
  login?: () => Promise<Partial<APICredential>>;
  refresh?: () => Promise<Partial<APICredential>>;
};

export class APIManager extends ConfigStoreItem {
  onAddCredential: Signal<(credential: APICredential) => void> = new Signal();
  onUpdateCredential: Signal<(credential: APICredential) => void> = new Signal();
  onRemoveCredential: Signal<(credential: APICredential) => void> = new Signal();

  #apis: Record<string, APIRecord> = {};
  #credentials: Record<string, APICredential> = {};

  deserialize(data: object) {
    if (!data)  // accepts empty config
      data = {};
    if (typeof data != 'object')
      throw new Error(`Unknown data for "apis": ${data}.`);
    this.#credentials = {};
    for (const id in data) {
      const credential = APICredential.deserialize(data[id]);
      credential.id = id;
      this.#credentials[id] = credential;
    }
  }

  serialize() {
    const data = {};
    for (const id in this.#credentials)
      data[id] = this.#credentials[id].serialize();
    return data;
  }

  registerAPI(record: APIRecord) {
    if (record.name in this.#apis)
      throw new Error(`API with name "${record.name}" has already been registered.`);
    this.#apis[record.name] = record;
    this.saveConfig();
  }

  unregisterAPI(name: string) {
    if (!(name in this.#apis))
      throw new Error(`There is no API named "${name}".`);
    if (this.getCredentials().find(e => e.type == name))
      throw new Error(`Can not unregister API "${name}" because there is an API credential using it.`);
    delete this.#apis[name];
    this.saveConfig();
  }

  getAPISelections(): Selection[] {
    return Object.keys(this.#apis).map(k => ({name: k, value: this.#apis[k]})).sort(sortByPriority);
  }

  getAPIRecord(name: string) {
    if (!(name in this.#apis))
      throw new Error(`API with name "${name}" does not exist.`);
    return this.#apis[name];
  }

  createAPIForCredential(credential: APICredential) {
    if (!(credential.type in this.#apis))
      throw new Error(`Unable to find API implementation for credential ${credential.type}.`);
    return new (this.#apis[credential.type].apiClass)(credential);
  }

  addCredential(credential: APICredential) {
    if (credential.id)
      throw new Error('Re-adding a managed APICredential.');
    credential.id = getNextId(credential.name, Object.keys(this.#credentials));
    this.#credentials[credential.id] = credential;
    this.onAddCredential.emit(credential);
    this.saveConfig();
    return credential.id;
  }

  updateCredential(credential: APICredential) {
    this.onUpdateCredential.emit(credential);
    this.saveConfig();
  }

  removeCredentialById(id: string) {
    if (!(id in this.#credentials))
      throw new Error(`Removing unknown API id: ${id}.`);
    const assistant = assistantManager.getAssistants().find(a => a.service.api.credential.id == id);
    if (assistant)
      throw new Error(`Can not remove API credential because assistant "${assistant.service.name}" is using it.`);
    const credential = this.#credentials[id];
    delete this.#credentials[id];
    this.onRemoveCredential.emit(credential);
    this.saveConfig();
    credential.id = null;
  }

  getCredentials() {
    return Object.values(this.#credentials);
  }

  getCredentialById(id: string) {
    if (!(id in this.#credentials))
      throw new Error(`Getting unknown API id: ${id}.`);
    return this.#credentials[id];
  }

  getCredentialsByType(type: string): APICredential[] {
    return Object.keys(this.#credentials)
      .filter(k => this.#credentials[k].type == type)
      .map(k => this.#credentials[k]);
  }

  getCredentialSelections(): Selection[] {
    return Object.values(this.#credentials).map(v => ({name: v.name, value: v}));
  }
}

export default new APIManager;

// Sort by priority, if no priority defined then sort by name.
export function sortByPriority(a: Selection, b: Selection) {
  if (a.value.priority && b.value.priority)
    return b.value.priority - a.value.priority;
  else if (!a.value.priority && !b.value.priority)
    return a.name.localeCompare(b.name);
  else if (a.value.priority)
    return -1;
  else
    return 1;
}
