import gui from 'gui';

import APIEndpoint from '../model/api-endpoint';
import APIParamsView from '../view/api-params-view';
import Assistant from '../model/assistant';
import BaseWindow from '../view/base-window';
import ButtonsArea from '../view/buttons-area';
import DashboardWindow from '../view/dashboard-window';
import Icon from '../model/icon';
import NewAPIWindow from '../view/new-api-window';
import ParamsView, {IconParamRow, valueMarginLeft} from '../view/params-view';
import alert from '../util/alert';
import apiManager from '../controller/api-manager';
import assistantManager from '../controller/assistant-manager';
import basicStyle from '../view/basic-style';
import serviceManager, {ServiceRecord} from '../controller/service-manager';
import windowManager from '../controller/window-manager';
import {BaseViewType} from '../view/base-view';
import {ChatCompletionAPI} from '../model/chat-api';
import {WebServiceOptions} from '../model/web-service';
import {isEmptyObject, matchClass} from '../util/object-utils';

const overrideAPIParamsLabel = 'Override API parameters';
const hideAPIParamsLabel = 'Use default API parameters';

export default class NewAssistantWindow extends BaseWindow {
  assistant?: Assistant;
  serviceSelector: ParamsView;
  serviceParams?: ParamsView;
  overrideButton: gui.Button;
  apiParams?: APIParamsView;

  constructor(assistant?: Assistant) {
    super({pressEscToClose: true});
    this.assistant = assistant;

    this.contentView.setStyle({
      gap: basicStyle.padding / 2,
      padding: basicStyle.padding,
      paddingLeft: 50,
      paddingRight: 50,
    });

    this.serviceSelector = new ParamsView([
      {
        name: 'name',
        type: 'string',
        displayName: 'Name',
        value: assistant?.service.name,
      },
      {
        name: 'icon',
        type: 'image',
        displayName: 'Icon',
        value: assistant?.service.icon,
      },
      {
        name: 'shortcut',
        type: 'shortcut',
        displayName: 'Shortcut',
        value: assistant?.shortcut,
      },
      {
        name: 'tray',
        type: 'boolean',
        displayName: 'Tray',
        title: 'Show tray icon for the assistant',
        value: assistant?.tray != null,
      },
      {
        name: 'api',
        type: 'selection',
        displayName: 'API',
        selection: assistant?.service.api.endpoint.name,
        selections: apiManager.getEndpointSelections(),
      },
      {
        name: 'service',
        type: 'selection',
        displayName: 'Service',
        selection: assistant?.service.constructor.name,
        selections: serviceManager.getServiceSelections(),
        constrainedBy: 'api',
        constrain: (endpoint: APIEndpoint, record: ServiceRecord) => {
          const apiClass = apiManager.getAPIRecord(endpoint.type).apiClass;
          for (const A of record.apiClasses) {
            if (matchClass(A, apiClass))
              return true;
          }
          return false;
        },
      },
      {
        name: 'view',
        type: 'selection',
        displayName: 'View',
        selection: assistant?.viewClass.name,
        selections: serviceManager.getViewSelections(),
        constrainedBy: 'service',
        constrain: (record: ServiceRecord, viewClass) => {
          for (const V of record.viewClasses) {
            if (matchClass(V, viewClass))
              return true;
          }
          return false;
        },
      },
    ]);
    this.serviceSelector.onActivate.connect(this.#onSubmit.bind(this));
    this.contentView.addChildView(this.serviceSelector.view);

    // Create helper button to add or edit api endpoint.
    let apiButton: gui.Button;
    if (assistant) {
      apiButton = gui.Button.create('Edit API endpoint...');
      apiButton.onClick = () => {
        const win = new NewAPIWindow(assistant.service.api.endpoint);
        win.window.center();
        win.window.activate();
      };
    } else {
      apiButton = gui.Button.create('Create new API endpoint...');
      apiButton.onClick = () => windowManager.showNamedWindow('newAPI');
    }
    apiButton.setStyle({
      marginLeft: valueMarginLeft,
      alignSelf: 'flex-start',
    });
    this.serviceSelector.view.addChildViewAt(apiButton, 5);

    // A helper button to show/hide overrided API params.
    this.overrideButton = gui.Button.create('Override API parameters');
    this.overrideButton.setStyle({
      marginLeft: valueMarginLeft,
      alignSelf: 'flex-start',
    });
    this.overrideButton.onClick = this.#toggleAPIParams.bind(this);
    this.serviceSelector.view.addChildViewAt(this.overrideButton, 6);
    if (!isEmptyObject(assistant?.service.api.params))
      this.#toggleAPIParams();

    this.#updateServiceParamsView();
    this.#updateAPIParamsView();
    this.#updateDefaultIcon();
    if (assistant) {
      // We do not allow editing types of assistant.
      this.serviceSelector.getRow('api').editor.setEnabled(false);
      this.serviceSelector.getRow('service').editor.setEnabled(false);
      this.serviceSelector.getRow('view').editor.setEnabled(false);
    } else {
      // Refresh params view when api is changed.
      this.serviceSelector.getRow('api').subscribeOnChange(() => {
        this.#updateServiceParamsView();
        this.#updateAPIParamsView();
        this.#updateDefaultIcon();
      });
      this.serviceSelector.getRow('service').subscribeOnChange(() => {
        this.#updateServiceParamsView();
        this.resizeVerticallyToFitContentView();
      });
    }

    const buttonsArea = new ButtonsArea();
    buttonsArea.view.setStyle({flex: 1, marginTop: basicStyle.padding / 2});
    this.contentView.addChildView(buttonsArea.view);
    const createButton = buttonsArea.addButton(assistant ? 'OK' : 'Create');
    createButton.makeDefault();
    createButton.onClick = this.#onSubmit.bind(this);
    buttonsArea.addCloseButton();

    this.serviceSelector.getRow('name').editor.focus();
    this.resizeToFitContentView({width: 550});
    this.window.setTitle(assistant ? `Edit Assistant: ${assistant.service.name}` : 'Create New Assistant');
  }

  destructor() {
    super.destructor();
    this.serviceSelector.destructor();
    this.serviceParams?.destructor();
    this.apiParams?.destructor();
  }

  saveState() {
    return null;  // do not remember state
  }

  #toggleAPIParams() {
    if (this.apiParams) {
      this.overrideButton.setTitle(overrideAPIParamsLabel);
      this.#destroyAPIParamsView();
    } else {
      this.overrideButton.setTitle(hideAPIParamsLabel);
      this.#createAPIParamsView();
    }
    this.resizeVerticallyToFitContentView();
  }

  #hasCustomAPIParams() {
    const endpoint = this.serviceSelector.getValue('api');
    if (!endpoint)
      return false;
    const apiRecord = apiManager.getAPIRecord(endpoint.type);
    return apiRecord?.params?.length > 0;
  }

  #updateAPIParamsView() {
    this.overrideButton.setEnabled(this.#hasCustomAPIParams());
    if (this.apiParams) {
      this.#destroyAPIParamsView();
      this.#createAPIParamsView();
    }
  }

  #createAPIParamsView() {
    if (this.apiParams)
      throw new Error('Can not create duplicate APIParamsView.');

    // Create params view and fill with service.params.
    const endpoint = this.serviceSelector.getValue('api');
    const apiRecord = apiManager.getAPIRecord(endpoint.type);
    this.apiParams = new APIParamsView({
      apiRecord,
      showAuthParams: false,
      nullable: true,
    });
    this.apiParams.clearParams();  // fill empty instead of default values
    if (this.assistant?.service.api.params)
      this.apiParams.fillParams(this.assistant.service.api.params);

    // Add separator and description for the params area.
    const separator = gui.Separator.create('horizontal');
    separator.setStyle({marginTop: basicStyle.padding / 2});
    this.apiParams.view.addChildViewAt(separator, 0);
    const label = gui.Label.create('Override API parameters:');
    label.setStyle({width: '100%'});
    this.apiParams.view.addChildViewAt(label, 1);
    this.contentView.addChildViewAt(this.apiParams.view, this.serviceParams ? 2 : 1);
    this.resizeVerticallyToFitContentView();
  }

  #destroyAPIParamsView() {
    this.contentView.removeChildView(this.apiParams.view);
    this.apiParams.destructor();
    this.apiParams = null;
  }

  #updateServiceParamsView() {
    // Remove existing params view.
    if (this.serviceParams) {
      this.contentView.removeChildView(this.serviceParams.view);
      this.serviceParams = null;
    }

    // Service may not have params.
    const serviceRecord = this.serviceSelector.getValue('service');
    if (!serviceRecord?.params) {
      this.resizeVerticallyToFitContentView();
      return;
    }

    // There are only options for ChatCompletionAPI for now.
    // TODO(zcbenz): Add validate property to Param to make this automatic.
    const endpoint = this.serviceSelector.getValue('api');
    const apiClass = apiManager.getAPIRecord(endpoint.type).apiClass;
    if (!matchClass(ChatCompletionAPI, apiClass)) {
      this.resizeVerticallyToFitContentView();
      return;
    }

    // Create services view.
    this.serviceParams = new ParamsView(serviceRecord.params, true);
    this.contentView.addChildViewAt(this.serviceParams.view, 1);
    if (this.assistant?.service.params)
      this.serviceParams.fillParams(this.assistant.service.params);

    // Ajust window size automatically.
    for (const row of Object.values(this.serviceParams.rows)) {
      if (row.param.type == 'paragraph')
        row.subscribeOnChange(() => this.resizeVerticallyToFitContentView());
    }
    this.resizeVerticallyToFitContentView();
  }

  #updateDefaultIcon() {
    // Get default icon of endpoint.
    const endpoint = this.serviceSelector.getValue('api');
    if (!endpoint)
      return;
    const icon = apiManager.getAPIRecord(endpoint.type).icon;
    // Update the icon view.
    const row = this.serviceSelector.getRow('icon') as IconParamRow;
    if (!row.hasCustomIcon())
      row.setValue(icon);
    // Update the default value.
    row.param.value = icon;
  }

  #onSubmit() {
    const name = this.serviceSelector.getValue('name') as string;
    if (name.length == 0) {
      alert('Name can not be empty.');
      this.serviceSelector.requestAttention('name');
      return;
    }
    if (this.assistant) {
      // Update existing assistant.
      this.assistant.service.setName(name);
      if (this.apiParams)
        this.assistant.service.setAPIParams(this.apiParams.readParams() as Record<string, string>);
      else
        this.assistant.service.setAPIParams({});
      if (this.serviceParams) {
        for (const [name, row] of Object.entries(this.serviceParams.rows))
          this.assistant.service.setParam(name, row.getValue());
      }
      this.assistant.setIcon(this.serviceSelector.getValue('icon') as Icon);
      this.assistant.setShortcut(this.serviceSelector.getValue('shortcut'));
      if (this.serviceSelector.getValue('tray'))
        this.assistant.setTrayIcon(this.assistant.service.icon);
      else
        this.assistant.setTrayIcon(null);
      assistantManager.saveConfig();
    } else {
      // Create a new assistant.
      const options: Partial<WebServiceOptions> = {
        icon: this.serviceSelector.getValue('icon') as Icon,
      };
      if (this.apiParams)
        options.apiParams = this.apiParams.readParams() as Record<string, string>;
      if (this.serviceParams)
        options.params = this.serviceParams.readParams();
      const assistant = assistantManager.createAssistant(
        name,
        (this.serviceSelector.getValue('service') as ServiceRecord).serviceClass.name,
        (this.serviceSelector.getValue('api') as APIEndpoint),
        (this.serviceSelector.getValue('view') as BaseViewType),
        options);
      assistant.setShortcut(this.serviceSelector.getValue('shortcut'));
      if (this.serviceSelector.getValue('tray'))
        assistant.setTrayIcon(assistant.service.icon);
      // Show the added assistant.
      const dashboard = windowManager.showNamedWindow('dashboard') as DashboardWindow;
      dashboard.switchTo(-1);
    }
    this.window.close();
  }
}
