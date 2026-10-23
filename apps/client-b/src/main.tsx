import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WagmiProvider } from 'wagmi';
import { App } from './app';
import { wagmiConfig } from './chain/wagmi';
import './styles.css';

const queryClient = new QueryClient();
const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element in index.html.');

createRoot(container).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
);
