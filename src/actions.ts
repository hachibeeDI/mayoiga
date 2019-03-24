export type FormReducerActionTypes = 'CHANGE' | 'SUBMIT' | 'ERROR';
export type FSA<S> = {
  type: FormReducerActionTypes;
  payload: {
    name: keyof S;
    value: S[keyof S];
  };
};

export const changeField = <S>(name: keyof S, value: S[keyof S]): FSA<S> => ({
  type: 'CHANGE',
  payload: {
    name,
    value,
  },
});

export const submitValue = <S>(state: S): FSA<S> => ({
  type: 'SUBMIT',
  payload: {} as any, // FIXME: I know this is wrong but it's mendokusai. Fix FSA later.
});

export const sendErrors = <S>(name: keyof S, errors: ReadonlyArray<string>): FSA<S> => ({
  type: 'ERROR',
  payload: {
    name,
    value: errors,
  } as any, // FIXME: same
});
