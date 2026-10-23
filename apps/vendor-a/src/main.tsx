import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WagmiProvider } from 'wagmi';
import { wagmiConfig } from './chain/wagmi';
import { router } from './router';
import './styles.css';

const queryClient = new QueryClient();
const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element in index.html.');

createRoot(container).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
);
