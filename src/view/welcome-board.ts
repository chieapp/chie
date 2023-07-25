import gui from 'gui';

import AppearanceAware from '../view/appearance-aware';
import apiManager from '../controller/api-manager';
import assistantManager from '../controller/assistant-manager';
import windowManager from '../controller/window-manager';

const noCredentialText = 'Start by adding an API credential first:';
const noAssistantText = 'Start by creating an assistant:';
const addCredentialLabel = 'Add API credential...';
const addAssistantLabel = 'New assistant...';

export default class WelcomeBoard extends AppearanceAware {
  constructor() {
    super();
    this.view.setStyle({
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    });

    const hasCredential = apiManager.getCredentials().length > 0;
    const hasAssistant = assistantManager.getAssistants().length > 0;
    if (hasCredential && hasAssistant)  // should not happen
      return;

    const label = gui.Label.create(hasCredential ? noAssistantText: noCredentialText);
    label.setStyle({marginBottom: 10});
    this.view.addChildView(label);

    const button = gui.Button.create(hasCredential ? addAssistantLabel : addCredentialLabel);
    this.view.addChildView(button);
    button.onClick = () => windowManager.showNamedWindow(hasCredential ? 'newAssistant' : 'newAPI');
  }
}
