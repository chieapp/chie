import gui from 'gui';

import APICredential from '../model/api-credential';
import APIParamsView from './api-params-view';
import BaseWindow from './base-window';
import ButtonsArea from './buttons-area';
import DashboardWindow from './dashboard-window';
import ParamsView, {valueMarginLeft} from './params-view';
import alert from '../util/alert';
import apiManager from '../controller/api-manager';
import assistantManager from '../controller/assistant-manager';
import basicStyle from './basic-style';
import serviceManager from '../controller/service-manager';
import windowManager from '../controller/window-manager';
import {deepAssign, matchClass} from '../util/object-utils';

export default class NewAPIWindow extends BaseWindow {
  credential?: APICredential;

  apiSelector: ParamsView;
  apiParams?: APIParamsView;
  createCheckbox?: gui.Button;
  submitButton: gui.Button;
  loginButton?: gui.Button;

  constructor(credential?: APICredential) {
    super({pressEscToClose: true});
    this.credential = credential;

    this.contentView.setStyle({
      gap: basicStyle.padding / 2,
      padding: basicStyle.padding,
      paddingLeft: 50,
      paddingRight: 50,
    });

    this.apiSelector = new ParamsView([
      {
        name: 'name',
        type: 'string',
        displayName: 'Name',
        value: credential?.name,
      },
      {
        name: 'type',
        type: 'selection',
        displayName: 'API Type',
        selected: credential?.type,
        selections: apiManager.getAPISelections(),
      },
    ], {nullable: false});
    this.apiSelector.onActivate.connect(this.#onSubmit.bind(this));
    this.contentView.addChildView(this.apiSelector.view);

    if (!credential) {
      this.createCheckbox = gui.Button.create({
        type: 'checkbox',
        title: 'Create an assistant for this API credential...'
      });
      this.createCheckbox.setChecked(true);
      this.createCheckbox.setStyle({marginLeft: valueMarginLeft});
      this.apiSelector.view.addChildViewAt(this.createCheckbox, 1);
    }

    this.#updateAPIParamsView(credential);
    if (credential)
      this.apiSelector.getRow('type').editor.setEnabled(false);
    else
      this.apiSelector.getRow('type').subscribeOnChange(this.#updateAPIParamsView.bind(this));

    const buttonsArea = new ButtonsArea();
    buttonsArea.view.setStyle({flex: 1, paddingTop: basicStyle.padding / 2});
    this.contentView.addChildView(buttonsArea.view);
    this.submitButton = buttonsArea.addButton(credential ? 'OK' : 'Add');
    this.submitButton.makeDefault();
    this.submitButton.onClick = this.#onSubmit.bind(this);
    buttonsArea.addCloseButton();

    this.apiSelector.getRow('name').editor.focus();
    this.resizeToFitContentView({width: 540});

    this.window.setTitle(credential ? `Edit API Credential: ${credential.name}` : 'Add New API Credential');
  }

  destructor() {
    super.destructor();
    this.apiSelector.destructor();
    this.apiParams?.destructor();
  }

  saveState() {
    return null;  // do not remember state
  }

  #updateAPIParamsView(credential?: APICredential) {
    if (this.apiParams)
      this.contentView.removeChildView(this.apiParams.view);
    if (this.loginButton)
      this.contentView.removeChildView(this.loginButton);
    this.apiParams = new APIParamsView({
      apiRecord: this.apiSelector.getValue('type'),
      showAuthParams: true,
    });
    if (credential)
      this.apiParams.fillCredential(credential);
    this.contentView.addChildViewAt(this.apiParams.view, 1);
    // Show a login button.
    if (this.apiParams.apiRecord.auth == 'login') {
      this.loginButton = gui.Button.create('Login');
      this.loginButton.setStyle({
        marginLeft: valueMarginLeft,
        alignSelf: 'flex-start',
      });
      this.loginButton.onClick = this.#onLogin.bind(this, this.apiParams.apiRecord);
      this.contentView.addChildViewAt(this.loginButton, 1);
    }
    this.resizeVerticallyToFitContentView();
  }

  async #onLogin(apiRecord) {
    this.loginButton.setEnabled(false);
    this.submitButton.setEnabled(false);
    try {
      const info = await apiRecord.login();
      if (info.cookie)
        this.apiParams.getRow('cookie').setValue(info.cookie);
      if (info.params) {
        for (const name in info.params)
          this.apiParams.getRow(name)?.setValue(info.params[name]);
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
    if (this.credential) {
      // Edit credential.
      this.credential.name = name;
      deepAssign(this.credential, this.apiParams.readCredential());
      apiManager.updateCredential(this.credential);
    } else {
      if (apiManager.getCredentials().find(e => e.name == name)) {
        alert('There is already an API credential with the same name.');
        this.apiSelector.requestAttention('name');
        return;
      }
      // Create a new credential.
      const apiRecord = this.apiSelector.getValue('type');
      const credential = new APICredential(deepAssign({
        name,
        type: apiRecord.name,
      }, this.apiParams.readCredential()));
      apiManager.addCredential(credential);
      if (this.createCheckbox?.isChecked()) {
        // Find a service type supporting the API.
        const serviceRecord = serviceManager.getRegisteredServices().find(service => {
          for (const A of service.apiClasses) {
            if (matchClass(A, apiRecord.apiClass))
              return true;
          }
          return false;
        });
        if (!serviceRecord)
          throw new Error('Unable to find a service type for the credential.');
        // Create a new assistant.
        assistantManager.createAssistant(name, serviceRecord.serviceClass.name, credential, serviceRecord.viewClasses[0]);
        // Close new assistant window since it is no longer needed.
        windowManager.getNamedWindow('newAssistant')?.close();
        // Show the added assistant.
        const dashboard = windowManager.showNamedWindow('dashboard') as DashboardWindow;
        dashboard.switchTo(-1);
      }
    }
    this.window.close();
  }
}
