import * as zod from 'zod';

import {createFormHook} from './index';

/**
 * Shared form fixture for the test suites.
 *
 * `age` is edited as a string and parsed to a number on validation; an empty
 * string or a non-numeric string is rejected so tests have a deterministic
 * invalid state to start from (the initial state is invalid).
 */
export const testSchema = zod.object({
  name: zod.string(),
  description: zod.string(),
  age: zod
    .string()
    .min(1)
    .transform((val) => Number(val))
    .refine((val) => !Number.isNaN(val)),
  marked: zod.boolean(),
});

export type FormStateBeforeValidation = {
  name: string;
  description: string;
  age: string;
  marked: boolean;
};

export const initialState: FormStateBeforeValidation = {
  name: '',
  description: '',
  age: '',
  marked: false,
};

export const createTestHook = () => createFormHook(initialState, testSchema);
