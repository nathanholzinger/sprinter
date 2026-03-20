import { createContext, useContext, useReducer, useEffect } from 'react';
import { loadState, saveState } from '../lib/storage';

const initialState = {
  templates: [],
  settings: {
    typicalDayStart: 6,
    typicalDayEnd: 22,
    loopWeekStart: 'monday',
  },
};

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_TEMPLATE': {
      return {
        ...state,
        templates: [...state.templates, action.template],
      };
    }
    case 'RENAME_TEMPLATE': {
      return {
        ...state,
        templates: state.templates.map((t) =>
          t.id === action.id ? { ...t, name: action.name } : t
        ),
      };
    }
    case 'DELETE_TEMPLATE': {
      return {
        ...state,
        templates: state.templates.filter((t) => t.id !== action.id),
      };
    }
    case 'ADD_EVENT': {
      return {
        ...state,
        templates: state.templates.map((t) =>
          t.id === action.templateId
            ? { ...t, events: [...t.events, action.event] }
            : t
        ),
      };
    }
    case 'UPDATE_EVENT': {
      return {
        ...state,
        templates: state.templates.map((t) =>
          t.id === action.templateId
            ? {
                ...t,
                events: t.events.map((e) =>
                  e.id === action.event.id ? action.event : e
                ),
              }
            : t
        ),
      };
    }
    case 'DELETE_EVENT': {
      return {
        ...state,
        templates: state.templates.map((t) =>
          t.id === action.templateId
            ? { ...t, events: t.events.filter((e) => e.id !== action.eventId) }
            : t
        ),
      };
    }
    case 'SET_SETTINGS': {
      return { ...state, settings: { ...state.settings, ...action.settings } };
    }
    default:
      return state;
  }
}

const TemplateContext = createContext(null);

export function TemplateProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState, () => {
    const saved = loadState();
    return saved
      ? { ...initialState, ...saved, settings: { ...initialState.settings, ...saved.settings } }
      : initialState;
  });

  useEffect(() => {
    saveState(state);
  }, [state]);

  return (
    <TemplateContext.Provider value={{ state, dispatch }}>
      {children}
    </TemplateContext.Provider>
  );
}

export function useTemplateStore() {
  const ctx = useContext(TemplateContext);
  if (!ctx) throw new Error('useTemplateStore must be used inside TemplateProvider');
  return ctx;
}

export function createTemplate(name) {
  return {
    id: crypto.randomUUID(),
    name,
    events: [],
  };
}

export function createEvent(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    title: '',
    days: ['monday'],
    startTime: '09:00',
    endTime: '10:00',
    notes: '',
    ...overrides,
  };
}
