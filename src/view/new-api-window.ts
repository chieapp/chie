import gui from 'gui';

import APIEndpoint from '../model/api-endpoint';
import BaseWindow from './base-window';
import ButtonsArea from './buttons-area';
import Param from '../model/param';
import ParamsView from './params-view';
import alert from '../util/alert';
import apiManager from '../controller/api-manager';
import {style} from './browser-view';

export default class NewAPIWindow extends BaseWindow {
  endpoint?: APIEndpoint;

  apiSelector: ParamsView;
  apiParams?: ParamsView;
  loginButton?: gui.Button;

  constructor(endpoint?: APIEndpoint) {
    super({pressEscToClose: true});
    this.endpoint = endpoint;

    this.contentView.setStyle({padding: style.padding});

    this.apiSelector = new ParamsView([
      {
        name: 'name',
        type: 'string',
        readableName: 'Name',
        value: endpoint?.name,
      },
      {
        name: 'type',
        type: 'selection',
        readableName: 'API Type',
        value: endpoint?.type,
        selectionHasDescription: true,
        selections: apiManager.getAPISelections(),
      },
    ]);
    this.apiSelector.onActivate.connect(this.#onSubmit.bind(this));
    this.contentView.addChildView(this.apiSelector.view);

    this.#updateAPIParamsView(endpoint);
    if (endpoint)
      this.apiSelector.getView('type').view.setEnabled(false);
    else
      this.apiSelector.getView('type').subscribeOnChange(this.#updateAPIParamsView.bind(this));

    const buttonsArea = new ButtonsArea();
    buttonsArea.view.setStyle({flex: 1});
    this.contentView.addChildView(buttonsArea.view);
    const submitButton = buttonsArea.addButton(endpoint ? 'OK' : 'Add');
    submitButton.makeDefault();
    submitButton.onClick = this.#onSubmit.bind(this);
    buttonsArea.addCloseButton();

    this.apiSelector.getView('name').view.focus();
    this.resizeToFitContentView({width: 400});

    this.window.setTitle(endpoint ? `Edit ${endpoint.name}` : 'Add New API Endpoint');
  }

  saveState() {
    return null;  // do not remember state
  }

  #updateAPIParamsView(endpoint?: APIEndpoint) {
    if (this.apiParams)
      this.contentView.removeChildView(this.apiParams.view);
    if (this.loginButton)
      this.contentView.removeChildView(this.loginButton);
    const apiRecord = this.apiSelector.getValue('type');
    // Show params for users to fill in.
    const params: Param[] = [];
    if (apiRecord.url) {
      params.push({
        name: 'url',
        type: 'string',
        readableName: 'URL',
        value: endpoint?.url ?? apiRecord.url,
      });
    }
    if (apiRecord.auth == 'key') {
      params.push({
        name: 'key',
        type: 'string',
        readableName: 'API Key',
        value: endpoint?.key,
      });
    }
    if (apiRecord.params)
      params.push(...apiRecord.params);
    this.apiParams = new ParamsView(params);
    this.apiParams.view.setStyle({marginTop: style.padding});
    this.contentView.addChildViewAt(this.apiParams.view, 1);
    // Fill current params.
    if (endpoint?.params) {
      for (const name in endpoint.params)
        this.apiParams.getView(name)?.setValue(endpoint.params[name]);
    }
    // Show a login button.
    if (apiRecord.auth == 'login') {
      this.loginButton = gui.Button.create('Login');
      this.contentView.addChildViewAt(this.loginButton, 2);
    }
    this.resizeToFitContentView({width: this.contentView.getBounds().width});
  }

  #onSubmit() {
    const name = this.apiSelector.getValue('name') as string;
    if (name.length == 0) {
      alert('Name can not be empty.');
      this.apiSelector.requestAttention('name');
      return;
    }
    const apiRecord = this.apiSelector.getValue('type');
    if (this.endpoint) {
      // Edit endpoint.
      this.endpoint.name = name;
      this.endpoint.url = this.apiParams.getValue('url');
      this.endpoint.key = this.apiParams.getValue('key');
      this.endpoint.params = this.#readAPIParams(apiRecord),
      apiManager.onUpdateEndpoint.emit(this.endpoint);
      apiManager.saveConfig();
    } else {
      if (apiManager.getEndpoints().find(e => e.name == name)) {
        alert('There is already an API endpoint with the same name.');
        this.apiSelector.requestAttention('name');
        return;
      }
      // Create a new endpoint.
      const endpoint = new APIEndpoint({
        name,
        type: this.apiSelector.getValue('type').name,
        url: this.apiParams.getValue('url'),
        key: this.apiParams.getValue('key'),
        params: this.#readAPIParams(apiRecord),
      });
      apiManager.addEndpoint(endpoint);
    }
    this.window.close();
  }

  // Read the params from the entries, and convert to key-value pairs.
  #readAPIParams(apiRecord) {
    if (!apiRecord.params)
      return;
    const params = {};
    for (const p of apiRecord.params) {
      const value = this.apiParams.getValue(p.name);
      if (value)
        params[p.name] = value;
    }
    return params;
  }
}
