import gui from 'gui';

import APIEndpoint from '../model/api-endpoint';
import APIParamsView from './api-params-view';
import BaseWindow from './base-window';
import ButtonsArea from './buttons-area';
import ParamsView, {valueMarginLeft} from './params-view';
import alert from '../util/alert';
import apiManager from '../controller/api-manager';
import basicStyle from './basic-style';
import deepAssign from '../util/deep-assign';

export default class NewAPIWindow extends BaseWindow {
  endpoint?: APIEndpoint;

  apiSelector: ParamsView;
  apiParams?: APIParamsView;
  submitButton: gui.Button;
  loginButton?: gui.Button;

  constructor(endpoint?: APIEndpoint) {
    super({pressEscToClose: true});
    this.endpoint = endpoint;

    this.contentView.setStyle({
      padding: basicStyle.padding,
      paddingLeft: 50,
      paddingRight: 50,
    });

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
        selection: endpoint?.type,
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
    this.submitButton = buttonsArea.addButton(endpoint ? 'OK' : 'Add');
    this.submitButton.makeDefault();
    this.submitButton.onClick = this.#onSubmit.bind(this);
    buttonsArea.addCloseButton();

    this.apiSelector.getView('name').view.focus();
    this.resizeToFitContentView({width: 500});

    this.window.setTitle(endpoint ? `Edit API Endpoint: ${endpoint.name}` : 'Add New API Endpoint');
  }

  saveState() {
    return null;  // do not remember state
  }

  #updateAPIParamsView(endpoint?: APIEndpoint) {
    if (this.apiParams)
      this.contentView.removeChildView(this.apiParams.view);
    if (this.loginButton)
      this.contentView.removeChildView(this.loginButton);
    this.apiParams = new APIParamsView({
      apiRecord: this.apiSelector.getValue('type'),
      showAuthParams: true,
      endpoint,
    });
    this.contentView.addChildViewAt(this.apiParams.view, 1);
    // Show a login button.
    if (this.apiParams.apiRecord.auth == 'login') {
      this.loginButton = gui.Button.create('Login');
      this.loginButton.setStyle({
        marginBottom: basicStyle.padding / 2,
        marginLeft: valueMarginLeft,
        marginRight: 0,
      });
      this.loginButton.onClick = this.#onLogin.bind(this, this.apiParams.apiRecord);
      this.contentView.addChildViewAt(this.loginButton, 1);
    }
    this.resizeToFitContentView({width: this.contentView.getBounds().width});
  }

  async #onLogin(apiRecord) {
    this.loginButton.setEnabled(false);
    this.submitButton.setEnabled(false);
    try {
      const info = await apiRecord.login();
      if (info.cookie)
        this.apiParams.getView('cookie').setValue(info.cookie);
      if (info.params) {
        for (const name in info.params)
          this.apiParams.getView(name)?.setValue(info.params[name]);
      }
    } catch (error) {
      if (error.name != 'CancelledError')
        alert(error.message);
    } finally {
      this.loginButton.setEnabled(true);
      this.submitButton.setEnabled(true);
    }
  }

  #onSubmit() {
    const name = this.apiSelector.getValue('name') as string;
    if (name.length == 0) {
      alert('Name can not be empty.');
      this.apiSelector.requestAttention('name');
      return;
    }
    if (this.endpoint) {
      // Edit endpoint.
      this.endpoint.name = name;
      deepAssign(this.endpoint, this.apiParams.readParams());
      apiManager.updateEndpoint(this.endpoint);
    } else {
      if (apiManager.getEndpoints().find(e => e.name == name)) {
        alert('There is already an API endpoint with the same name.');
        this.apiSelector.requestAttention('name');
        return;
      }
      // Create a new endpoint.
      const endpoint = new APIEndpoint(deepAssign({
        name,
        type: this.apiSelector.getValue('type').name,
      }, this.apiParams.readParams()));
      apiManager.addEndpoint(endpoint);
    }
    this.window.close();
  }
}
