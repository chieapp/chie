import ParamsView from '../src/view/params-view';
import {addFinalizer, gcUntil} from './util';

describe('ParamsView', () => {
  it('can be garbage collected', async () => {
    let collected = false;
    (() => {
      const paramsView = new ParamsView([
        {name: 'Name', type: 'string'},
        {
          name: 'API',
          type: 'selection',
          selections: [
            {name: 'A', value: {}},
            {name: 'B', value: {}},
          ],
        },
        {
          name: 'Service',
          type: 'selection',
          selections: [
            {name: 'A', value: {}},
            {name: 'B', value: {}},
          ],
          constrainedBy: 'api',
          constrain: () => true,
        },
        {
          name: 'View',
          type: 'selection',
          selections: [
            {name: 'A', value: {}},
            {name: 'B', value: {}},
          ],
          constrainedBy: 'service',
          constrain: () => true,
        },
      ]);
      addFinalizer(paramsView, () => collected = true);
    })();
    await gcUntil(() => collected);
  });
});
