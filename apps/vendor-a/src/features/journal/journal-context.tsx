import { createContext, useContext } from 'react';
import type { Journal } from './use-journal';

export const JournalContext = createContext<Journal | null>(null);

export function useJournalContext(): Journal {
  const journal = useContext(JournalContext);
  if (!journal) throw new Error('useJournalContext must be used inside a workspace.');
  return journal;
}
