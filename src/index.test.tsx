import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {test, expect} from 'vitest';

import * as zod from 'zod';

import {createFormHook, useFormSlice} from './index';

import type {Controller} from './index';

const testSchema = zod.object({
  name: zod.string(),
  description: zod.string(),
  age: zod
    .string()
    .transform((val) => Number(val))
    .refine((val) => (Number.isNaN(val) ? 0 : val)),
  marked: zod.boolean(),
});

// every fields are optional for test
type FormStateBeforeValidation = {
  name: string;
  description: string;
  age: string;
  marked: boolean;
};

const createTestHook = () => createFormHook({name: '', description: '', age: '', marked: false} as FormStateBeforeValidation, testSchema);

const AgeInputComponent = (props: {controller: Controller<FormStateBeforeValidation>}) => {
  const {controller} = props;
  const [[age, errorMessage], {handleChange}] = useFormSlice(controller, (s) => [s.value.age, s.errors.age] as const);
  return (
    <div>
      <input
        data-testid="age-input"
        value={age}
        name="age"
        onChange={(e) => {
          handleChange('age' as const, e.currentTarget.value);
        }}
      />
      <span data-testid="age-error">{errorMessage}</span>
    </div>
  );
};

// afterEach(cleanup);

test('useSelector can select the fields', async () => {
  const TestFormHook = createTestHook();

  const Top = () => {
    return (
      <div>
        <AgeInputComponent controller={TestFormHook.controller} />
      </div>
    );
  };

  render(<Top />);

  const INPUT_AGE = '4';

  // fireEvent.change(screen.getByTestId('age-input') , {target: {value: INPUT_AGE}})
  // calling `userEvent` in here will cause race condition...
  await userEvent.type(screen.getByTestId('age-input'), INPUT_AGE);
  // TestFormHook.actions.handleBulkChange(prev => ({...prev, name: 'test', description: 'desc'}));

  await waitFor(() => {
    const ageInput: HTMLInputElement = screen.getByTestId('age-input');
    expect(ageInput.value).toBe(INPUT_AGE);
  });
});

test('zod parse value before submit', async () => {
  const TestFormHook = createTestHook();

  const INPUT_AGE = '9';
  const PARSED_RESULT = Number(INPUT_AGE);

  const handleSubmitTester = TestFormHook.handleSubmit((e) => (result) => {
    if (result.success) {
      expect(result.data.age).toBe(PARSED_RESULT);
    } else {
      expect('should not called').toBe(result.error);
    }
  });

  const Top = () => {
    return (
      <div>
        <AgeInputComponent controller={TestFormHook} />
        <button data-testid="submit-button" onClick={handleSubmitTester} />
      </div>
    );
  };

  render(<Top />);

  const ageInput: HTMLInputElement = screen.getByTestId('age-input');
  await userEvent.type(ageInput, INPUT_AGE);

  await waitFor(() => {
    const ageInput: HTMLInputElement = screen.getByTestId('age-input');
    expect(ageInput.value).toBe(INPUT_AGE);
  });

  const submitButton = screen.getByTestId('submit-button');
  await userEvent.click(submitButton);

  await waitFor(() => {
    console.log('waiting');
    TestFormHook.api.actions.peek((s) => {
      expect(s.value.age).toBe(INPUT_AGE);
      expect(s.errors.age).toBeNull();
    });
  });
});
