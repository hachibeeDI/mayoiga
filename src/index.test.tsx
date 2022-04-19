import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {test, expect, afterEach} from 'vitest';

import * as zod from 'zod';

import {createFormHook} from './index'; 


const testSchema = zod.object({
  name: zod.string(),
  description: zod.string(),
  age: zod.string().transform(val => Number(val)).refine(val => Number.isNaN(val) ? 0 : val),
});

// every fields are optional for test
type FormStateBeforeValidation = {
  name: string;
  description: string;
  age: string;
}

const createTestHook =  () => createFormHook({name:'', description: '', age: ''} as FormStateBeforeValidation, testSchema);

type TestHook = ReturnType<typeof createTestHook>;

const AgeInputComponent = (props: {formHook: TestHook}) => {
  const {formHook} = props;
  const [age, errorMessage] = formHook.useSelector(s => [s.value.age, s.errors.age] as const);
  return (
    <div>
      <input
        data-testid="age-input"
        value={age}
        name="age"
        onChange={(e) => {
          console.log('input: ', e.currentTarget.value);
          formHook.actions.handleChange('age' as const, e.currentTarget.value);
        }}
      />
      <span data-testid="age-error">{errorMessage}</span>
    </div>
  );
};

afterEach(cleanup);

test('useSelector can select the fields', async () => {
  const TestFormHook = createTestHook();

  const Top = () => {
    return (
      <div>
        <AgeInputComponent formHook={TestFormHook} />
      </div>
    )
  };

  act(() => {
    render(<Top />);
  });

  const INPUT_AGE = '4';

  act(() => {
    fireEvent.change(screen.getByTestId('age-input') , {target: {value: INPUT_AGE}})
    // calling `userEvent` in here will cause race condition...
    // userEvent.type(ageInput, INPUT_AGE);
    // TestFormHook.actions.handleBulkChange(prev => ({...prev, name: 'test', description: 'desc'}));
  });

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
        <AgeInputComponent formHook={TestFormHook} />
        <button data-testid="submit-button" onClick={handleSubmitTester} />
      </div>
    )
  };

  act(() => {
    render(<Top />);
  });

  await act(() => {
    const ageInput: HTMLInputElement  = screen.getByTestId('age-input') ;
    return userEvent.type(ageInput, INPUT_AGE);
    // TestFormHook.actions.handleBulkChange(prev => ({...prev, name: 'test', description: 'desc'}));
  });

  await waitFor(() => {
    const ageInput: HTMLInputElement = screen.getByTestId('age-input') ;
    expect(ageInput.value).toBe(INPUT_AGE);
  });

  act(() => {
    const submitButton = screen.getByTestId('submit-button');
    fireEvent.click(submitButton);
  })

  await waitFor(() => {
    console.log('waiting');
    TestFormHook.actions.peek((s) => {
      expect(s.value.age).toBe(INPUT_AGE);
      expect(s.errors.age).toBeNull();
    });
  });
});