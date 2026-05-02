/**
 * 明信片内容状态管理
 */

import { create } from 'zustand';
import { Recipient, SentCardContent } from '@/lib/api';

interface PostcardState {
  // State
  recipients: Recipient[];
  selectedRecipient: Recipient | null;
  generatedContent: SentCardContent | null;
  userContent: Array<{
    id: string;
    title: string;
    content: string;
    type: 'blog' | 'note' | 'template';
  }>;
  generationOptions: {
    tone: string;
    topics: string[];
    includeUserContent: boolean;
  };
  isLoading: boolean;
  error: string | null;

  // Actions
  setRecipients: (recipients: Recipient[]) => void;
  setSelectedRecipient: (recipient: Recipient | null) => void;
  setSentCardContent: (content: SentCardContent | null) => void;
  setUserContent: (content: Array<{ id: string; title: string; content: string; type: 'blog' | 'note' | 'template' }>) => void;
  setGenerationOptions: (options: Partial<PostcardState['generationOptions']>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const usePostcardStore = create<PostcardState>((set) => ({
  // Initial State
  recipients: [],
  selectedRecipient: null,
  generatedContent: null,
  userContent: [],
  generationOptions: {
    tone: 'friendly',
    topics: [],
    includeUserContent: true,
  },
  isLoading: false,
  error: null,

  // Actions
  setRecipients: (recipients) => set({ recipients }),
  setSelectedRecipient: (recipient) => set({ selectedRecipient: recipient }),
  setSentCardContent: (content) => set({ generatedContent: content }),
  setUserContent: (content) => set({ userContent: content }),
  setGenerationOptions: (options) =>
    set((state) => ({
      generationOptions: { ...state.generationOptions, ...options },
    })),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));

export default usePostcardStore;
