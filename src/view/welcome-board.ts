import gui from 'gui';

import AppearanceAware from '../view/appearance-aware';
import apiManager from '../controller/api-manager';
import assistantManager from '../controller/assistant-manager';
import windowManager from '../controller/window-manager';

const noEndpointText = 'Start by adding an API endpoint first:';
const noAssistantText = 'Start by creating an assistant:';
const addEndpointLabel = 'Add API endpoint...';
const addAssistantLabel = 'New assistant...';

export default class WelcomeBoard extends AppearanceAware {
  constructor() {
    super();
    this.view.setStyle({
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    });

    const hasEndpoint = apiManager.getEndpoints().length > 0;
    const hasAssistant = assistantManager.getAssistants().length > 0;
    if (hasEndpoint && hasAssistant)  // should not happen
      return;

    const label = gui.Label.create(hasEndpoint ? noAssistantText: noEndpointText);
    label.setStyle({marginBottom: 10});
    this.view.addChildView(label);

    const button = gui.Button.create(hasEndpoint ? addAssistantLabel : addEndpointLabel);
    this.view.addChildView(button);
    button.onClick = () => windowManager.showNamedWindow(hasEndpoint ? 'newAssistant' : 'newAPI');
  }
}
