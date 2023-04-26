import APIEndpoint from '../model/api-endpoint';
import BaseWindow from './base-window';
import ButtonsArea from './buttons-area';
import DashboardWindow from './dashboard-window';
import ParamsView from './params-view';
import apiManager from '../controller/api-manager';
import basicStyle from './basic-style';
import serviceManager, {ServiceRecord} from '../controller/service-manager';
import windowManager from '../controller/window-manager';

export default class NewAssistantWindow extends BaseWindow {
  paramsView: ParamsView;

  constructor() {
    super({pressEscToClose: true});

    this.contentView.setStyle({padding: basicStyle.padding});

    this.paramsView = new ParamsView([
      {
        name: 'name',
        type: 'string',
        readableName: 'Name',
      },
      {
        name: 'api',
        type: 'selection',
        readableName: 'API',
        selections: apiManager.getEndpointSelections(),
      },
      {
        name: 'service',
        type: 'selection',
        readableName: 'Service',
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
        selections: serviceManager.getViewSelections(),
        constrainedBy: 'service',
        constrain: (record: ServiceRecord, viewType) => {
          return viewType == record.viewType || viewType.prototype instanceof record.viewType;
        },
      },
    ]);
    this.paramsView.onActivate.connect(this.#onSubmit.bind(this));
    this.contentView.addChildView(this.paramsView.view);

    const buttonsArea = new ButtonsArea();
    buttonsArea.view.setStyle({flex: 1});
    this.contentView.addChildView(buttonsArea.view);
    const createButton = buttonsArea.addButton('Create');
    createButton.makeDefault();
    createButton.onClick = this.#onSubmit.bind(this);
    buttonsArea.addCloseButton();

    this.paramsView.getView('name').view.focus();
    this.resizeToFitContentView({width: 400});
    this.window.setTitle('Create New Assistant');
  }

  saveState() {
    return null;  // do not remember state
  }

  #onSubmit() {
    const name = this.paramsView.getValue('name') as string;
    if (name.length == 0) {
      alert('Name can not be empty.');
      this.paramsView.requestAttention('name');
      return;
    }
    serviceManager.createInstance(
      name,
      (this.paramsView.getValue('service') as ServiceRecord).name,
      (this.paramsView.getValue('api') as APIEndpoint));
    this.window.close();
    // Show the added assistant.
    const dashboard = windowManager.showNamedWindow('dashboard') as DashboardWindow;
    dashboard.switchTo(-1);
  }
}
