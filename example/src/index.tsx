import * as React from 'react';

import {render} from 'react-dom';

import Demo from './demo-app';

function App() {
  return (
    <div style={{width: '100%', textAlign: 'center'}}>
      <Demo />
    </div>
  );
}

render(<App />, window.document.getElementById('app'));
