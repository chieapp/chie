import gui from 'gui';

import APIEndpoint from '../model/api-endpoint';
import APIParamsView from './api-params-view';
import BaseWindow from './base-window';
import ButtonsArea from './buttons-area';
import DashboardWindow from './dashboard-window';
import Instance from '../model/instance';
import Icon from '../model/icon';
import NewAPIWindow from './new-api-window';
import ParamsView, {IconParamRow, valueMarginLeft} from './params-view';
import WebAPI from '../model/web-api';
import alert from '../util/alert';
import apiManager from '../controller/api-manager';
import basicStyle from './basic-style';
import serviceManager, {ServiceRecord} from '../controller/service-manager';
import windowManager from '../controller/window-manager';
import {ChatCompletionAPI} from '../model/chat-api';
import {WebServiceOptions} from '../model/web-service';

export default class NewAssistantWindow extends BaseWindow {
  instance?: Instance;
  serviceSelector: ParamsView;
  serviceParams?: ParamsView;
  apiParams?: APIParamsView;

  constructor(instance?: Instance) {
    super({pressEscToClose: true});
    this.instance = instance;

    this.contentView.setStyle({
      padding: basicStyle.padding,
      paddingLeft: 50,
      paddingRight: 50,
    });

    this.serviceSelector = new ParamsView([
      {
        name: 'name',
        type: 'string',
        readableName: 'Name',
        value: instance?.service.name,
      },
      {
        name: 'icon',
        type: 'image',
        readableName: 'Icon',
        value: instance?.service.icon,
      },
      {
        name: 'api',
        type: 'selection',
        readableName: 'API',
        selection: instance?.service.api.endpoint.name,
        selections: apiManager.getEndpointSelections(),
      },
      {
        name: 'service',
        type: 'selection',
        readableName: 'Service',
        selection: instance?.serviceName,
        selections: serviceManager.getServiceSelections(),
        constrainedBy: 'api',
        constrain: (endpoint: APIEndpoint, record: ServiceRecord) => {
          const apiType = apiManager.getAPIRecord(endpoint.type).apiType;
          for (const A of record.apiTypes) {
            if (apiType == A || apiType.prototype instanceof A)
              return true;
          }
          return false;
        },
      },
      {
        name: 'view',
        type: 'selection',
        readableName: 'View',
        selection: instance?.viewType.name,
        selections: serviceManager.getViewSelections(),
        constrainedBy: 'service',
        constrain: (record: ServiceRecord, viewType) => {
          return viewType == record.viewType || viewType.prototype instanceof record.viewType;
        },
      },
    ]);
    this.serviceSelector.onActivate.connect(this.#onSubmit.bind(this));
    this.contentView.addChildView(this.serviceSelector.view);

    // Create helper button to add or edit api endpoint.
    let apiButton: gui.Button;
    if (instance) {
      apiButton = gui.Button.create('Edit API endpoint...');
      apiButton.onClick = () => {
        const win = new NewAPIWindow(instance.service.api.endpoint);
        win.window.center();
        win.window.activate();
      };
    } else {
      apiButton = gui.Button.create('Create new API endpoint...');
      apiButton.onClick = () => windowManager.showNamedWindow('newAPI');
    }
    apiButton.setStyle({
      marginBottom: basicStyle.padding / 2,
      marginLeft: valueMarginLeft,
      alignSelf: 'flex-start',
    });
    this.serviceSelector.view.addChildViewAt(apiButton, 3);

    this.#updateServiceParamsView();
    this.#updateAPIParamsView();
    this.#updateDefaultIcon();
    if (instance) {
      // We do not allow editing types of instance.
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
        this.resizeVerticallyToFitContentView();
      });
    }

    const buttonsArea = new ButtonsArea();
    buttonsArea.view.setStyle({flex: 1, paddingTop: basicStyle.padding / 2});
    this.contentView.addChildView(buttonsArea.view);
    const createButton = buttonsArea.addButton(instance ? 'OK' : 'Create');
    createButton.makeDefault();
    createButton.onClick = this.#onSubmit.bind(this);
    buttonsArea.addCloseButton();

    this.serviceSelector.getRow('name').editor.focus();
    this.resizeToFitContentView({width: 550});
    this.window.setTitle(instance ? `Edit Assistant: ${instance.service.name}` : 'Create New Assistant');
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

  #updateServiceParamsView() {
    // Remove existing params view.
    if (this.serviceParams) {
      this.contentView.removeChildView(this.serviceParams.view);
      this.serviceParams = null;
    }

    // Service may not have params.
    const serviceRecord = this.serviceSelector.getValue('service');
    if (!serviceRecord.params)
      return;

    // There are only options for ChatCompletionAPI for now.
    // TODO(zcbenz): Add validate property to Param to make this automatic.
    const endpoint = this.serviceSelector.getValue('api');
    const apiType = apiManager.getAPIRecord(endpoint.type).apiType;
    if (!Object.prototype.isPrototypeOf.call(ChatCompletionAPI, apiType))
      return;

    // Create services view.
    this.serviceParams = new ParamsView(serviceRecord.params, true);
    this.contentView.addChildViewAt(this.serviceParams.view, 1);
    if (this.instance?.service.params)
      this.serviceParams.fillParams(this.instance.service.params);

    // Ajust window size automatically.
    for (const row of Object.values(this.serviceParams.rows)) {
      if (row.param.type == 'paragraph')
        row.subscribeOnChange(() => this.resizeVerticallyToFitContentView());
    }
  }

  #updateAPIParamsView() {
    if (this.apiParams) {
      this.contentView.removeChildView(this.apiParams.view);
      this.apiParams = null;
    }
    // Skip if the API does not support custom parameter.
    const endpoint = this.serviceSelector.getValue('api');
    const apiRecord = apiManager.getAPIRecord(endpoint.type);
    if (!apiRecord.params || apiRecord.params.length == 0)
      return;

    // Create params view and fill with service.params.
    this.apiParams = new APIParamsView({
      apiRecord,
      showAuthParams: false,
      nullable: true,
    });
    this.apiParams.clearParams();  // fill empty instead of default values
    if (this.instance?.service.api.params)
      this.apiParams.fillParams(this.instance.service.api.params);

    // Add separator and description for the params area.
    const separator = gui.Separator.create('horizontal');
    separator.setStyle({marginTop: basicStyle.padding / 2});
    this.apiParams.view.addChildViewAt(separator, 0);
    const label = gui.Label.create('Override API parameters:');
    label.setStyle({width: '100%', margin: basicStyle.padding / 2});
    this.apiParams.view.addChildViewAt(label, 1);
    this.contentView.addChildViewAt(this.apiParams.view, this.serviceParams ? 2 : 1);
    this.resizeVerticallyToFitContentView();
  }

  #updateDefaultIcon() {
    // Get default icon of endpoint.
    const endpoint = this.serviceSelector.getValue('api');
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
    if (this.instance) {
      // Update existing assistant.
      this.instance.service.setName(name);
      if (this.apiParams)
        this.instance.service.setAPIParams(this.apiParams.readParams() as Record<string, string>);
      if (this.serviceParams) {
        for (const [name, row] of Object.entries(this.serviceParams.rows))
          this.instance.service.setParam(name, row.getValue());
      }
      serviceManager.setInstanceIcon(this.instance, this.serviceSelector.getValue('icon') as Icon);
      serviceManager.saveConfig();
    } else {
      // Create a new assistant.
      const options: Partial<WebServiceOptions<WebAPI>> = {
        icon: this.serviceSelector.getValue('icon') as Icon,
      };
      if (this.apiParams)
        options.apiParams = this.apiParams.readParams() as Record<string, string>;
      if (this.serviceParams)
        options.params = this.serviceParams.readParams();
      serviceManager.createInstance(
        name,
        (this.serviceSelector.getValue('service') as ServiceRecord).name,
        (this.serviceSelector.getValue('api') as APIEndpoint),
        options);
      // Show the added assistant.
      const dashboard = windowManager.showNamedWindow('dashboard') as DashboardWindow;
      dashboard.switchTo(-1);
    }
    this.window.close();
  }
}
