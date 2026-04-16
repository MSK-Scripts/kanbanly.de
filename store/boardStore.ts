'use client';
import { create } from 'zustand';

export type Task = {
  id: string;
  title: string;
  done: boolean;
};

export type CardT = {
  id: string;
  title: string;
  tasks: Task[];
  timeSpent: number;
  timerStartedAt: number | null;
};

export type ListT = {
  id: string;
  title: string;
  cardIds: string[];
};

type BoardState = {
  lists: Record<string, ListT>;
  cards: Record<string, CardT>;
  listOrder: string[];
  moveCard: (
    source: { listId: string; index: number },
    destination: { listId: string; index: number }
  ) => void;
  addCard: (listId: string, title: string) => void;
  toggleTimer: (cardId: string) => void;
  toggleTask: (cardId: string, taskId: string) => void;
  addTask: (cardId: string, title: string) => void;
  addList: (title: string) => void;
};

const uid = () => Math.random().toString(36).slice(2, 10);

export const useBoard = create<BoardState>((set) => ({
  lists: {
    todo: { id: 'todo', title: 'To Do', cardIds: ['c1', 'c2'] },
    doing: { id: 'doing', title: 'In Progress', cardIds: ['c3'] },
    done: { id: 'done', title: 'Done', cardIds: [] },
  },
  cards: {
    c1: {
      id: 'c1',
      title: 'Landingpage entwerfen',
      tasks: [
        { id: 't1', title: 'Hero Section', done: true },
        { id: 't2', title: 'Features', done: false },
        { id: 't3', title: 'Footer', done: false },
      ],
      timeSpent: 0,
      timerStartedAt: null,
    },
    c2: {
      id: 'c2',
      title: 'Supabase aufsetzen',
      tasks: [
        { id: 't4', title: 'Projekt erstellen', done: false },
        { id: 't5', title: 'Schema anlegen', done: false },
      ],
      timeSpent: 0,
      timerStartedAt: null,
    },
    c3: {
      id: 'c3',
      title: 'Drag & Drop testen',
      tasks: [{ id: 't6', title: 'mit @hello-pangea/dnd', done: true }],
      timeSpent: 1243,
      timerStartedAt: null,
    },
  },
  listOrder: ['todo', 'doing', 'done'],

  moveCard: (source, destination) =>
    set((state) => {
      const srcList = state.lists[source.listId];
      const dstList = state.lists[destination.listId];
      if (!srcList || !dstList) return state;

      const srcCardIds = [...srcList.cardIds];
      const [moved] = srcCardIds.splice(source.index, 1);
      if (moved === undefined) return state;

      if (source.listId === destination.listId) {
        srcCardIds.splice(destination.index, 0, moved);
        return {
          lists: {
            ...state.lists,
            [source.listId]: { ...srcList, cardIds: srcCardIds },
          },
        };
      }

      const dstCardIds = [...dstList.cardIds];
      dstCardIds.splice(destination.index, 0, moved);
      return {
        lists: {
          ...state.lists,
          [source.listId]: { ...srcList, cardIds: srcCardIds },
          [destination.listId]: { ...dstList, cardIds: dstCardIds },
        },
      };
    }),

  addCard: (listId, title) =>
    set((state) => {
      const list = state.lists[listId];
      if (!list) return state;
      const id = uid();
      return {
        cards: {
          ...state.cards,
          [id]: { id, title, tasks: [], timeSpent: 0, timerStartedAt: null },
        },
        lists: {
          ...state.lists,
          [listId]: { ...list, cardIds: [...list.cardIds, id] },
        },
      };
    }),

  toggleTimer: (cardId) =>
    set((state) => {
      const card = state.cards[cardId];
      if (!card) return state;
      const now = Date.now();
      if (card.timerStartedAt) {
        const extra = Math.floor((now - card.timerStartedAt) / 1000);
        return {
          cards: {
            ...state.cards,
            [cardId]: {
              ...card,
              timeSpent: card.timeSpent + extra,
              timerStartedAt: null,
            },
          },
        };
      }
      return {
        cards: {
          ...state.cards,
          [cardId]: { ...card, timerStartedAt: now },
        },
      };
    }),

  toggleTask: (cardId, taskId) =>
    set((state) => {
      const card = state.cards[cardId];
      if (!card) return state;
      return {
        cards: {
          ...state.cards,
          [cardId]: {
            ...card,
            tasks: card.tasks.map((t) =>
              t.id === taskId ? { ...t, done: !t.done } : t
            ),
          },
        },
      };
    }),

  addTask: (cardId, title) =>
    set((state) => {
      const card = state.cards[cardId];
      if (!card) return state;
      return {
        cards: {
          ...state.cards,
          [cardId]: {
            ...card,
            tasks: [...card.tasks, { id: uid(), title, done: false }],
          },
        },
      };
    }),

  addList: (title) =>
    set((state) => {
      const id = uid();
      return {
        lists: { ...state.lists, [id]: { id, title, cardIds: [] } },
        listOrder: [...state.listOrder, id],
      };
    }),
}));
