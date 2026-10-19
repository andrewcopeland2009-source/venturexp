import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import App from './App';
import { initStorage } from './db/storage';
import { requestPersistentStorage } from './db/db';

const root = createRoot(document.getElementById('root')!);

initStorage()
  .then(() => {
    void requestPersistentStorage();
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((err) => {
    console.error(err);
    root.render(
      <div style={{ padding: 24, fontFamily: 'system-ui', color: '#F8FAFC' }}>
        <h1>VentureXP couldn’t start</h1>
        <p>Your browser blocked local storage, which VentureXP needs to save progress. Try opening it in a regular (non-private) Safari tab.</p>
      </div>,
    );
  });
