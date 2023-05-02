import gui from 'gui';

import APIEndpoint from '../model/api-endpoint';
import APIParamsView from './api-params-view';
import BaseWindow from './base-window';
import ButtonsArea from './buttons-area';
import DashboardWindow from './dashboard-window';
import Instance from '../model/instance';
import Icon from '../model/icon';
import NewAPIWindow from './new-api-window';
import ParamsView, {valueMarginLeft} from './params-view';
import alert from '../util/alert';
import apiManager from '../controller/api-manager';
import basicStyle from './basic-style';
import serviceManager, {ServiceRecord} from '../controller/service-manager';
import windowManager from '../controller/window-manager';

export default class NewAssistantWindow extends BaseWindow {
  instance?: Instance;
  serviceSelector: ParamsView;
  apiParams: APIParamsView;

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
        name: 'icon',
        type: 'image',
        readableName: 'Icon',
        value: instance?.service.icon,
      },
      {
        name: 'name',
        type: 'string',
        readableName: 'Name',
        value: instance?.service.name,
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
        this.close();
      };
    } else {
      apiButton = gui.Button.create('Create new API endpoint...');
      apiButton.onClick = () => {
        windowManager.showNamedWindow('newAPI');
        this.close();
      };
    }
    apiButton.setStyle({
      marginBottom: basicStyle.padding / 2,
      marginLeft: valueMarginLeft,
      alignSelf: 'flex-start',
    });
    this.serviceSelector.view.addChildViewAt(apiButton, 3);

    this.#updateAPIParamsView();
    this.#updateDefaultIcon();
    if (instance) {
      // We do not allow editing types of instance.
      this.serviceSelector.getView('api').view.setEnabled(false);
      this.serviceSelector.getView('service').view.setEnabled(false);
      this.serviceSelector.getView('view').view.setEnabled(false);
    } else {
      // Refresh params view when api is changed.
      this.serviceSelector.getView('api').subscribeOnChange(() => {
        this.#updateAPIParamsView();
        this.#updateDefaultIcon();
      });
      this.serviceSelector.getView('service').subscribeOnChange(() => {
        this.resizeToFitContentView({width: this.contentView.getBounds().width});
      });
    }

    const buttonsArea = new ButtonsArea();
    buttonsArea.view.setStyle({flex: 1, paddingTop: basicStyle.padding / 2});
    this.contentView.addChildView(buttonsArea.view);
    const createButton = buttonsArea.addButton(instance ? 'OK' : 'Create');
    createButton.makeDefault();
    createButton.onClick = this.#onSubmit.bind(this);
    buttonsArea.addCloseButton();

    this.serviceSelector.getView('name').view.focus();
    this.resizeToFitContentView({width: 500});
    this.window.setTitle(instance ? `Edit Assistant: ${instance.service.name}` : 'Create New Assistant');
  }

  saveState() {
    return null;  // do not remember state
  }

  #updateAPIParamsView() {
    if (this.apiParams)
      this.contentView.removeChildView(this.apiParams.view);
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
    this.contentView.addChildViewAt(this.apiParams.view, 1);
    this.resizeToFitContentView({width: this.contentView.getBounds().width});
  }

  #updateDefaultIcon() {
    // Get default icon of endpoint.
    const endpoint = this.serviceSelector.getValue('api');
    const icon = apiManager.getAPIRecord(endpoint.type).icon;
    // Update the icon view.
    const view = this.serviceSelector.getView('icon');
    const currentIcon = view.getValue();
    if (!currentIcon || currentIcon.filePath.startsWith(Icon.builtinIconsPath))
      view.setValue(icon);
    // Update the default value.
    view.param.value = icon;
  }

  #onSubmit() {
    const name = this.serviceSelector.getValue('name') as string;
    if (name.length == 0) {
      alert('Name can not be empty.');
      this.serviceSelector.requestAttention('name');
      return;
    }
    if (this.instance) {
      this.instance.service.setName(name);
      this.instance.service.setParams(this.apiParams.readParams());
      serviceManager.setInstanceIcon(this.instance, this.serviceSelector.getValue('icon') as Icon);
      serviceManager.saveConfig();
    } else {
      serviceManager.createInstance(
        name,
        (this.serviceSelector.getValue('service') as ServiceRecord).name,
        (this.serviceSelector.getValue('api') as APIEndpoint),
        {icon: this.serviceSelector.getValue('icon') as Icon});
      // Show the added assistant.
      const dashboard = windowManager.showNamedWindow('dashboard') as DashboardWindow;
      dashboard.switchTo(-1);
    }
    this.window.close();
  }
}
