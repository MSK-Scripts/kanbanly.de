'use client';
import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';

export type TaskT = { id: string; title: string; done: boolean };
export type CardT = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  tasks: TaskT[];
};
export type ListT = { id: string; title: string; cardIds: string[] };

type RawList = { id: string; title: string; position: number };
type RawCard = {
  id: string;
  list_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  position: number;
};
type RawTask = {
  id: string;
  card_id: string;
  title: string;
  done: boolean;
  position: number;
};

type RawAssignee = { card_id: string; user_id: string };

type RawLabel = {
  id: string;
  name: string;
  color: string;
  created_at: string;
};

type RawCardLabel = { card_id: string; label_id: string };

export type LabelT = { id: string; name: string; color: string };

export type MemberProfile = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  role: string;
};

type State = {
  boardId: string | null;
  lists: Record<string, ListT>;
  cards: Record<string, CardT>;
  listOrder: string[];

  assignees: Record<string, string[]>;
  memberProfiles: Record<string, MemberProfile>;
  memberOrder: string[];

  labels: Record<string, LabelT>;
  labelOrder: string[];
  cardLabels: Record<string, string[]>;

  openCardId: string | null;
  setOpenCardId: (id: string | null) => void;

  hydrate: (
    boardId: string,
    lists: RawList[],
    cards: RawCard[],
    tasks: RawTask[],
    assignees: RawAssignee[],
    members: MemberProfile[],
    labels: RawLabel[],
    cardLabels: RawCardLabel[]
  ) => void;

  toggleAssignee: (cardId: string, userId: string) => Promise<void>;

  createLabel: (name: string, color: string) => Promise<void>;
  deleteLabel: (labelId: string) => Promise<void>;
  toggleCardLabel: (cardId: string, labelId: string) => Promise<void>;

  addList: (title: string) => Promise<void>;
  renameList: (listId: string, title: string) => Promise<void>;
  deleteList: (listId: string) => Promise<void>;
  addCard: (listId: string, title: string) => Promise<void>;
  moveCard: (
    source: { listId: string; index: number },
    destination: { listId: string; index: number }
  ) => Promise<void>;
  updateCardTitle: (cardId: string, title: string) => Promise<void>;
  updateCardDescription: (
    cardId: string,
    description: string | null
  ) => Promise<void>;
  updateCardDueDate: (cardId: string, due: string | null) => Promise<void>;
  deleteCard: (cardId: string) => Promise<void>;

  addTask: (cardId: string, title: string) => Promise<void>;
  toggleTask: (cardId: string, taskId: string) => Promise<void>;
  deleteTask: (cardId: string, taskId: string) => Promise<void>;
};

export const useBoard = create<State>((set, get) => ({
  boardId: null,
  lists: {},
  cards: {},
  listOrder: [],
  assignees: {},
  memberProfiles: {},
  memberOrder: [],
  labels: {},
  labelOrder: [],
  cardLabels: {},
  openCardId: null,

  setOpenCardId: (id) => set({ openCardId: id }),

  hydrate(
    boardId,
    rawLists,
    rawCards,
    rawTasks,
    rawAssignees,
    members,
    rawLabels,
    rawCardLabels
  ) {
    const listsObj: Record<string, ListT> = {};
    const cardsObj: Record<string, CardT> = {};

    const sortedLists = [...rawLists].sort((a, b) => a.position - b.position);
    const listOrder = sortedLists.map((l) => l.id);

    for (const l of sortedLists) {
      const listCards = rawCards
        .filter((c) => c.list_id === l.id)
        .sort((a, b) => a.position - b.position);
      listsObj[l.id] = {
        id: l.id,
        title: l.title,
        cardIds: listCards.map((c) => c.id),
      };
    }

    for (const c of rawCards) {
      const cardTasks = rawTasks
        .filter((t) => t.card_id === c.id)
        .sort((a, b) => a.position - b.position)
        .map((t) => ({ id: t.id, title: t.title, done: t.done }));
      cardsObj[c.id] = {
        id: c.id,
        title: c.title,
        description: c.description,
        due_date: c.due_date,
        tasks: cardTasks,
      };
    }

    const assigneesObj: Record<string, string[]> = {};
    for (const a of rawAssignees) {
      if (!assigneesObj[a.card_id]) assigneesObj[a.card_id] = [];
      assigneesObj[a.card_id].push(a.user_id);
    }

    const memberProfilesObj: Record<string, MemberProfile> = {};
    const memberOrder: string[] = [];
    for (const m of members) {
      memberProfilesObj[m.user_id] = m;
      memberOrder.push(m.user_id);
    }

    const labelsObj: Record<string, LabelT> = {};
    const labelOrder: string[] = [];
    const sortedLabels = [...rawLabels].sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );
    for (const l of sortedLabels) {
      labelsObj[l.id] = { id: l.id, name: l.name, color: l.color };
      labelOrder.push(l.id);
    }

    const cardLabelsObj: Record<string, string[]> = {};
    for (const cl of rawCardLabels) {
      if (!cardLabelsObj[cl.card_id]) cardLabelsObj[cl.card_id] = [];
      cardLabelsObj[cl.card_id].push(cl.label_id);
    }

    set({
      boardId,
      lists: listsObj,
      cards: cardsObj,
      listOrder,
      assignees: assigneesObj,
      memberProfiles: memberProfilesObj,
      memberOrder,
      labels: labelsObj,
      labelOrder,
      cardLabels: cardLabelsObj,
    });
  },

  async createLabel(name, color) {
    const { boardId } = get();
    if (!boardId) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = crypto.randomUUID();

    set((state) => ({
      labels: {
        ...state.labels,
        [id]: { id, name: trimmed, color },
      },
      labelOrder: [...state.labelOrder, id],
    }));

    const supabase = createClient();
    const { error } = await supabase
      .from('labels')
      .insert({ id, board_id: boardId, name: trimmed, color });
    if (error) console.error('createLabel', error);
  },

  async deleteLabel(labelId) {
    set((state) => {
      const newLabels = { ...state.labels };
      delete newLabels[labelId];
      const newCardLabels: Record<string, string[]> = {};
      for (const [cid, ids] of Object.entries(state.cardLabels)) {
        const next = ids.filter((id) => id !== labelId);
        if (next.length > 0) newCardLabels[cid] = next;
      }
      return {
        labels: newLabels,
        labelOrder: state.labelOrder.filter((id) => id !== labelId),
        cardLabels: newCardLabels,
      };
    });

    const supabase = createClient();
    const { error } = await supabase.from('labels').delete().eq('id', labelId);
    if (error) console.error('deleteLabel', error);
  },

  async toggleCardLabel(cardId, labelId) {
    const current = get().cardLabels[cardId] ?? [];
    const applied = current.includes(labelId);

    set((state) => ({
      cardLabels: {
        ...state.cardLabels,
        [cardId]: applied
          ? current.filter((id) => id !== labelId)
          : [...current, labelId],
      },
    }));

    const supabase = createClient();
    if (applied) {
      const { error } = await supabase
        .from('card_labels')
        .delete()
        .eq('card_id', cardId)
        .eq('label_id', labelId);
      if (error) console.error('toggleCardLabel remove', error);
    } else {
      const { error } = await supabase
        .from('card_labels')
        .insert({ card_id: cardId, label_id: labelId });
      if (error) console.error('toggleCardLabel add', error);
    }
  },

  async toggleAssignee(cardId, userId) {
    const current = get().assignees[cardId] ?? [];
    const isAssigned = current.includes(userId);

    set((state) => ({
      assignees: {
        ...state.assignees,
        [cardId]: isAssigned
          ? current.filter((id) => id !== userId)
          : [...current, userId],
      },
    }));

    const supabase = createClient();
    if (isAssigned) {
      const { error } = await supabase
        .from('card_assignees')
        .delete()
        .eq('card_id', cardId)
        .eq('user_id', userId);
      if (error) console.error('toggleAssignee remove', error);
    } else {
      const { error } = await supabase
        .from('card_assignees')
        .insert({ card_id: cardId, user_id: userId });
      if (error) console.error('toggleAssignee add', error);
    }
  },

  async addList(title) {
    const { boardId, listOrder } = get();
    if (!boardId) return;
    const id = crypto.randomUUID();
    const position = listOrder.length;

    set((state) => ({
      lists: { ...state.lists, [id]: { id, title, cardIds: [] } },
      listOrder: [...state.listOrder, id],
    }));

    const supabase = createClient();
    const { error } = await supabase
      .from('lists')
      .insert({ id, board_id: boardId, title, position });
    if (error) console.error('addList', error);
  },

  async renameList(listId, title) {
    const list = get().lists[listId];
    if (!list) return;
    const trimmed = title.trim();
    if (!trimmed || trimmed === list.title) return;

    set((state) => ({
      lists: {
        ...state.lists,
        [listId]: { ...list, title: trimmed },
      },
    }));

    const supabase = createClient();
    const { error } = await supabase
      .from('lists')
      .update({ title: trimmed })
      .eq('id', listId);
    if (error) console.error('renameList', error);
  },

  async deleteList(listId) {
    const state = get();
    const list = state.lists[listId];
    if (!list) return;

    set((s) => {
      const newLists = { ...s.lists };
      delete newLists[listId];
      const newListOrder = s.listOrder.filter((id) => id !== listId);
      const newCards = { ...s.cards };
      const newAssignees = { ...s.assignees };
      const newCardLabels = { ...s.cardLabels };
      for (const cid of list.cardIds) {
        delete newCards[cid];
        delete newAssignees[cid];
        delete newCardLabels[cid];
      }
      const openWasInList =
        s.openCardId !== null && list.cardIds.includes(s.openCardId);
      return {
        lists: newLists,
        listOrder: newListOrder,
        cards: newCards,
        assignees: newAssignees,
        cardLabels: newCardLabels,
        openCardId: openWasInList ? null : s.openCardId,
      };
    });

    const supabase = createClient();
    const { error } = await supabase.from('lists').delete().eq('id', listId);
    if (error) console.error('deleteList', error);
  },

  async addCard(listId, title) {
    const list = get().lists[listId];
    if (!list) return;
    const id = crypto.randomUUID();
    const position = list.cardIds.length;

    set((state) => ({
      cards: {
        ...state.cards,
        [id]: { id, title, description: null, due_date: null, tasks: [] },
      },
      lists: {
        ...state.lists,
        [listId]: { ...list, cardIds: [...list.cardIds, id] },
      },
    }));

    const supabase = createClient();
    const { error } = await supabase
      .from('cards')
      .insert({ id, list_id: listId, title, position });
    if (error) console.error('addCard', error);
  },

  async moveCard(source, destination) {
    const state = get();
    const srcList = state.lists[source.listId];
    const dstList = state.lists[destination.listId];
    if (!srcList || !dstList) return;

    const srcCardIds = [...srcList.cardIds];
    const [moved] = srcCardIds.splice(source.index, 1);
    if (moved === undefined) return;

    let newLists: Record<string, ListT>;
    if (source.listId === destination.listId) {
      srcCardIds.splice(destination.index, 0, moved);
      newLists = {
        ...state.lists,
        [source.listId]: { ...srcList, cardIds: srcCardIds },
      };
    } else {
      const dstCardIds = [...dstList.cardIds];
      dstCardIds.splice(destination.index, 0, moved);
      newLists = {
        ...state.lists,
        [source.listId]: { ...srcList, cardIds: srcCardIds },
        [destination.listId]: { ...dstList, cardIds: dstCardIds },
      };
    }

    set({ lists: newLists });

    const supabase = createClient();
    const affectedListIds =
      source.listId === destination.listId
        ? [source.listId]
        : [source.listId, destination.listId];

    const promises: PromiseLike<unknown>[] = [];
    for (const listId of affectedListIds) {
      const list = newLists[listId];
      if (!list) continue;
      list.cardIds.forEach((cardId, idx) => {
        promises.push(
          supabase
            .from('cards')
            .update({ list_id: listId, position: idx })
            .eq('id', cardId)
        );
      });
    }
    await Promise.all(promises);
  },

  async updateCardTitle(cardId, title) {
    const card = get().cards[cardId];
    if (!card) return;
    const trimmed = title.trim();
    if (!trimmed || trimmed === card.title) return;

    set((state) => ({
      cards: {
        ...state.cards,
        [cardId]: { ...card, title: trimmed },
      },
    }));

    const supabase = createClient();
    const { error } = await supabase
      .from('cards')
      .update({ title: trimmed })
      .eq('id', cardId);
    if (error) console.error('updateCardTitle', error);
  },

  async updateCardDueDate(cardId, due) {
    const card = get().cards[cardId];
    if (!card) return;
    const next = due && due.trim() ? due : null;
    if (next === card.due_date) return;

    set((state) => ({
      cards: {
        ...state.cards,
        [cardId]: { ...card, due_date: next },
      },
    }));

    const supabase = createClient();
    const { error } = await supabase
      .from('cards')
      .update({ due_date: next })
      .eq('id', cardId);
    if (error) console.error('updateCardDueDate', error);
  },

  async updateCardDescription(cardId, description) {
    const card = get().cards[cardId];
    if (!card) return;
    const next = description && description.trim() ? description : null;
    if ((next ?? '') === (card.description ?? '')) return;

    set((state) => ({
      cards: {
        ...state.cards,
        [cardId]: { ...card, description: next },
      },
    }));

    const supabase = createClient();
    const { error } = await supabase
      .from('cards')
      .update({ description: next })
      .eq('id', cardId);
    if (error) console.error('updateCardDescription', error);
  },

  async deleteCard(cardId) {
    const state = get();
    const card = state.cards[cardId];
    if (!card) return;

    let targetListId: string | null = null;
    for (const [lid, list] of Object.entries(state.lists)) {
      if (list.cardIds.includes(cardId)) {
        targetListId = lid;
        break;
      }
    }

    set((s) => {
      const newCards = { ...s.cards };
      delete newCards[cardId];
      const newAssignees = { ...s.assignees };
      delete newAssignees[cardId];
      const newCardLabels = { ...s.cardLabels };
      delete newCardLabels[cardId];
      const newLists = targetListId
        ? {
            ...s.lists,
            [targetListId]: {
              ...s.lists[targetListId],
              cardIds: s.lists[targetListId].cardIds.filter(
                (id) => id !== cardId
              ),
            },
          }
        : s.lists;
      return {
        cards: newCards,
        assignees: newAssignees,
        cardLabels: newCardLabels,
        lists: newLists,
        openCardId: s.openCardId === cardId ? null : s.openCardId,
      };
    });

    const supabase = createClient();
    const { error } = await supabase.from('cards').delete().eq('id', cardId);
    if (error) console.error('deleteCard', error);
  },

  async addTask(cardId, title) {
    const card = get().cards[cardId];
    if (!card) return;
    const id = crypto.randomUUID();
    const position = card.tasks.length;

    set((state) => ({
      cards: {
        ...state.cards,
        [cardId]: {
          ...card,
          tasks: [...card.tasks, { id, title, done: false }],
        },
      },
    }));

    const supabase = createClient();
    const { error } = await supabase
      .from('tasks')
      .insert({ id, card_id: cardId, title, position });
    if (error) console.error('addTask', error);
  },

  async toggleTask(cardId, taskId) {
    const card = get().cards[cardId];
    if (!card) return;
    const task = card.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newDone = !task.done;

    set((state) => ({
      cards: {
        ...state.cards,
        [cardId]: {
          ...card,
          tasks: card.tasks.map((t) =>
            t.id === taskId ? { ...t, done: newDone } : t
          ),
        },
      },
    }));

    const supabase = createClient();
    const { error } = await supabase
      .from('tasks')
      .update({ done: newDone })
      .eq('id', taskId);
    if (error) console.error('toggleTask', error);
  },

  async deleteTask(cardId, taskId) {
    const card = get().cards[cardId];
    if (!card) return;

    set((state) => ({
      cards: {
        ...state.cards,
        [cardId]: {
          ...card,
          tasks: card.tasks.filter((t) => t.id !== taskId),
        },
      },
    }));

    const supabase = createClient();
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) console.error('deleteTask', error);
  },
}));
