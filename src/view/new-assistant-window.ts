import APIEndpoint from '../model/api-endpoint';
import BaseWindow from './base-window';
import ButtonsArea from './buttons-area';
import ParamsView from './params-view';
import apiManager from '../controller/api-manager';
import serviceManager, {ServiceRecord} from '../controller/service-manager';
import {style} from './browser-view';

export default class NewAssistantWindow extends BaseWindow {
  paramsView: ParamsView;

  constructor() {
    super({pressEscToClose: true});

    this.contentView.setStyle({padding: style.padding});

    this.paramsView = new ParamsView([
      {id: 'name', name: 'Name', type: 'string'},
      {
        id: 'api',
        name: 'API',
        type: 'selection',
        selections: apiManager.getEndpointSelections(),
      },
      {
        id: 'service',
        name: 'Service',
        type: 'selection',
        selections: serviceManager.getServiceSelections(),
        constrainedBy: 'api',
        constrain: (endpoint: APIEndpoint, record: ServiceRecord) => {
          const apiType = apiManager.getAPIType(endpoint.type);
          for (const A of record.apiTypes) {
            if (apiType == A || apiType.prototype instanceof A)
              return true;
          }
          return false;
        },
      },
      {
        id: 'view',
        name: 'View',
        type: 'selection',
        selections: serviceManager.getViewSelections(),
        constrainedBy: 'service',
        constrain: (record: ServiceRecord, viewType) => {
          return viewType == record.viewType || viewType.prototype instanceof record.viewType;
        },
      },
    ]);
    this.contentView.addChildView(this.paramsView.view);

    const buttonsArea = new ButtonsArea();
    buttonsArea.view.setStyle({flex: 1});
    this.contentView.addChildView(buttonsArea.view);
    const create = buttonsArea.addButton('Create');
    create.makeDefault();
    create.onClick = this.#onClickCreateButton.bind(this);
    buttonsArea.addCloseButton();

    this.paramsView.requestAttention('name');
    this.resizeToFitContentView({width: 400});
    this.window.setTitle('Create New Assistant');
  }

  saveState() {
    return null;  // do not remember state
  }

  #onClickCreateButton() {
    const name = (this.paramsView.getValue('name') as string).trim();
    if (name.length == 0) {
      this.paramsView.requestAttention('name');
      return;
    }
    serviceManager.createInstance(
      name,
      (this.paramsView.getValue('service') as ServiceRecord).serviceName,
      (this.paramsView.getValue('api') as APIEndpoint));
    this.window.close();
  }
}
