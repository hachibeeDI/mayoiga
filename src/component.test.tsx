
import {act, cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {test, expect, afterEach} from 'vitest';

import * as zod from 'zod';

import { Field, Slicer } from './component';

import {createFormHook, } from './index';

const testSchema = zod.object({
  name: zod.string(),
  description: zod.string(),
  age: zod.string().transform(val => Number(val)).refine(val => Number.isNaN(val) ? 0 : val),
  marked: zod.boolean(),
});

// every fields are optional for test
type FormStateBeforeValidation = {
  name: string;
  description: string;
  age: string;
  marked: boolean;
}

const createTestHook =  () => createFormHook({name:'', description: '', age: '', marked: false} as FormStateBeforeValidation, testSchema);

afterEach(cleanup);

test('Field component works fine in basic usage.', async () => {
  const TestFormHook = createTestHook();

  const Top = () => {
    return (
      <div>
        <Field controller={TestFormHook.controller} name="age">{
          (tool) => <input data-testid="age-input" {...tool} />
        }</Field>
      </div>
    )
  };

  act(() => {
    render(<Top />);
  });

  const INPUT_AGE = '42';

  await act(() => {
    // calling `userEvent` in here will cause race condition...
    return userEvent.type(screen.getByTestId('age-input'), INPUT_AGE);
  });

  await waitFor(() => {
    const ageInput: HTMLInputElement = screen.getByTestId('age-input');
    expect(ageInput.value).toBe(INPUT_AGE);
    TestFormHook.api.actions.peek((s) => {
      expect(s.value.age).toBe(INPUT_AGE);
      expect(s.errors.age).toBeNull();
    });
  });
});

test('Slice component works fine in basic usage.', async () => {
  const TestFormHook = createTestHook();

  const Top = () => {
    return (
      <div>
        <Slicer controller={TestFormHook.controller} selector={s => [s.value.age] as const}>{
          (tool, age: string) => <input data-testid="age-input" name="age" value={age} onChange={e => tool.handleChange('age' as const, e.target.value)} />
        }</Slicer>
      </div>
    )
  };

  act(() => {
    render(<Top />);
  });

  const INPUT_AGE = '42';

  await act(() => {
    // calling `userEvent` in here will cause race condition...
    return userEvent.type(screen.getByTestId('age-input'), INPUT_AGE);
  });

  await waitFor(() => {
    const ageInput: HTMLInputElement = screen.getByTestId('age-input');
    expect(ageInput.value).toBe(INPUT_AGE);
    TestFormHook.api.actions.peek((s) => {
      expect(s.value.age).toBe(INPUT_AGE);
      expect(s.errors.age).toBeNull();
    });
  });
});
