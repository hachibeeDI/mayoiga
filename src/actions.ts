export type FormReducerActionTypes = 'SWAP' | 'CHANGE' | 'SUBMIT' | 'ERROR';
export type FSA<S> =
  | {
      type: 'SWAP';
      payload: S;
    }
  | {
      type: 'CHANGE';
      payload: {
        name: keyof S;
        value: S[keyof S];
      };
    }
  | {
      type: 'SUBMIT';
      payload: {};
    }
  | {
      type: 'ERROR';
      payload: {
        name: keyof S;
        value: ReadonlyArray<string>;
      };
    };

export const swap = <S>(newInitialState: S): FSA<S> => ({
  type: 'SWAP',
  payload: newInitialState,
});

export const changeField = <S>(name: keyof S, value: S[keyof S]): FSA<S> => ({
  type: 'CHANGE',
  payload: {
    name,
    value,
  },
});

export const submitValue = <S>(state: S): FSA<S> => ({
  type: 'SUBMIT',
  payload: {},
});

export const sendErrors = <S>(name: keyof S, errors: ReadonlyArray<string>): FSA<S> => ({
  type: 'ERROR',
  payload: {
    name,
    value: errors,
  } as any, // FIXME: same
});
